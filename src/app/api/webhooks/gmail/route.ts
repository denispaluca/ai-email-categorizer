import { NextRequest, NextResponse } from "next/server";
import { OAuth2Client } from "google-auth-library";
import { db } from "@/lib/db";
import { gmailAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getHistoryChanges } from "@/lib/gmail";
import { processSpecificEmails, withAccountLock } from "@/lib/email-processor";

interface PubSubMessage {
  message: {
    data: string;
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

interface GmailNotification {
  emailAddress: string;
  historyId: number;
}

const authClient = new OAuth2Client();

async function verifyPubSubJwt(
  request: NextRequest,
): Promise<{ valid: true } | { valid: false; error: string }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { valid: false, error: "Missing Authorization header" };
  }

  const match = authHeader.match(/Bearer (.+)/);
  if (!match) {
    return { valid: false, error: "Invalid Authorization header format" };
  }

  const token = match[1];

  try {
    // const expectedAudience = process.env.PUBSUB_AUDIENCE;
    // if (!expectedAudience) {
    //   console.error("PUBSUB_AUDIENCE environment variable not set");
    //   return { valid: false, error: "Server configuration error" };
    // }

    const ticket = await authClient.verifyIdToken({
      idToken: token,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return { valid: false, error: "Invalid token payload" };
    }

    // // Verify the email is from the expected Pub/Sub service account
    // const expectedEmail = process.env.PUBSUB_SERVICE_ACCOUNT_EMAIL;
    // if (!expectedEmail) {
    //   console.error("PUBSUB_SERVICE_ACCOUNT_EMAIL environment variable not set");
    //   return { valid: false, error: "Server configuration error" };
    // }

    // if (payload.email !== expectedEmail) {
    //   console.error(
    //     `Unexpected service account: ${payload.email}, expected: ${expectedEmail}`,
    //   );
    //   return { valid: false, error: "Unauthorized service account" };
    // }

    if (!payload.email_verified) {
      return { valid: false, error: "Email not verified" };
    }

    return { valid: true };
  } catch (error) {
    console.error("JWT verification failed:", error);
    return { valid: false, error: "Token verification failed" };
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify the Pub/Sub JWT authentication
    const authResult = await verifyPubSubJwt(request);
    if (!authResult.valid) {
      console.error("Pub/Sub authentication failed:", authResult.error);
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const body: PubSubMessage = await request.json();

    // Decode the base64 message data
    const data = Buffer.from(body.message.data, "base64").toString("utf-8");
    const notification: GmailNotification = JSON.parse(data);

    console.log("Gmail notification received:", notification);

    // Use lock to prevent concurrent processing for the same account
    return await withAccountLock(notification.emailAddress, async () => {
      const [account] = await db
        .select({
          id: gmailAccounts.id,
          historyId: gmailAccounts.historyId,
          userId: gmailAccounts.userId,
        })
        .from(gmailAccounts)
        .where(eq(gmailAccounts.email, notification.emailAddress));

      if (!account) {
        console.warn("No account found for:", notification.emailAddress);
        return NextResponse.json(
          { error: `Account for ${notification.emailAddress} Not Found` },
          { status: 404 },
        );
      }

      // Update history ID
      await db
        .update(gmailAccounts)
        .set({ historyId: String(notification.historyId) })
        .where(eq(gmailAccounts.id, account.id));

      // If we have a history ID, fetch changes since then
      if (account.historyId) {
        try {
          const newMessageIds = await getHistoryChanges(
            account.id,
            account.historyId,
          );

          if (newMessageIds.length > 0) {
            console.log(`Processing ${newMessageIds.length} new messages`);
            await processSpecificEmails(
              account.id,
              newMessageIds,
              account.userId,
            );
          }
        } catch (e) {
          console.error("Error processing Gmail webhook:", e);
        }
      }

      return NextResponse.json({ success: true });
    });
  } catch (error) {
    console.error("Error processing Gmail webhook:", error);
    // Return 200 to prevent Pub/Sub from retrying
    return NextResponse.json({ success: false, error: "Processing failed" });
  }
}

// Handle verification requests from Pub/Sub
export async function GET() {
  return NextResponse.json({ status: "ok" });
}
