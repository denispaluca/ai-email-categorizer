import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest) {
  try {
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
