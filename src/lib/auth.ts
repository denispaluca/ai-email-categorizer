import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import {
  accounts as accountsTable,
  sessions,
  users,
  verificationTokens,
  gmailAccounts,
} from "./db/schema";
import { eq } from "drizzle-orm";
import { setupWatch } from "./gmail";

export const authOptions: NextAuthOptions = {
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accountsTable,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }) as NextAuthOptions["adapter"],
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            "openid",
            "email",
            "profile",
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.modify",
          ].join(" "),
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  events: {
    // This event fires after the account is linked to the user in the database
    async linkAccount({ user, account, profile }) {
      if (
        account.provider === "google" &&
        account.access_token &&
        account.refresh_token
      ) {
        // Check if we already have this Gmail account
        const existingGmailAccount = await db.query.gmailAccounts.findFirst({
          where: eq(gmailAccounts.email, profile.email!),
        });

        let gmailAccountId: string;

        if (!existingGmailAccount) {
          const inserted = await db
            .insert(gmailAccounts)
            .values({
              userId: user.id,
              email: profile.email!,
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at,
            })
            .returning();
          gmailAccountId = inserted[0].id;
        } else {
          // Update tokens if account already exists
          await db
            .update(gmailAccounts)
            .set({
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: account.expires_at,
            })
            .where(eq(gmailAccounts.email, profile.email!));
          gmailAccountId = existingGmailAccount.id;
        }

        // Automatically set up Gmail push notifications
        try {
          await setupWatch(gmailAccountId);
          console.log(`Gmail watch set up for ${profile.email}`);
        } catch (error) {
          console.error(
            `Failed to set up Gmail watch for ${profile.email}:`,
            error,
          );
        }
      }
    },
    // Update tokens on subsequent sign-ins
    async signIn({ user, account }) {
      if (account?.provider === "google" && account.access_token) {
        const existingGmailAccount = await db.query.gmailAccounts.findFirst({
          where: eq(gmailAccounts.email, user.email!),
        });

        if (existingGmailAccount) {
          await db
            .update(gmailAccounts)
            .set({
              accessToken: account.access_token,
              ...(account.refresh_token
                ? { refreshToken: account.refresh_token }
                : {}),
              expiresAt: account.expires_at,
            })
            .where(eq(gmailAccounts.email, user.email!));
        }
      }
    },
  },
  pages: {
    signIn: "/",
  },
  session: {
    strategy: "database",
  },
};
