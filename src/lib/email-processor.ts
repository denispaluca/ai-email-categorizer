import { db } from "./db";
import { emails, categories, gmailAccounts } from "./db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  archiveEmail,
  EmailMessage,
  getEmailContent,
  getHistoryChanges,
} from "./gmail";
import { categorizeAndSummarizeEmail } from "./claude";

export async function processNewEmails(userId: string) {
  // Get all Gmail accounts for this user
  const userGmailAccounts = (
    await db.query.gmailAccounts.findMany({
      where: eq(gmailAccounts.userId, userId),
    })
  ).slice(0, 1);

  // Get all categories for this user
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
  });

  // When user has no categories emails will not be processed
  if (userCategories.length === 0) {
    return;
  }

  await Promise.all(
    userGmailAccounts.map((account) =>
      withAccountLock(account.email, async () => {
        if (account.historyId) {
          try {
            const newMessageIds = await getHistoryChanges(
              account.id,
              account.historyId,
            );

            if (newMessageIds.length > 0) {
              console.log(
                `Processing ${newMessageIds.length} new messages for ${account.email}`,
              );
              await processSpecificEmails(
                account.id,
                newMessageIds,
                account.userId,
              );
            }
          } catch (e) {
            console.error("Error processing new emails:", e);
          }
        }
      }),
    ),
  );
}

export async function processSpecificEmails(
  gmailAccountId: string,
  messageIds: string[],
  userId: string,
): Promise<number> {
  // Get categories for this user
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
  });

  // When user has no categories emails will not be processed
  if (userCategories.length === 0) {
    return 0;
  }

  // Check if already processed
  const existingEmails = await db
    .select({ gmailId: emails.gmailId })
    .from(emails)
    .where(
      and(
        eq(emails.gmailAccountId, gmailAccountId),
        inArray(emails.gmailId, messageIds),
      ),
    );

  const nonExistingMessageIds = messageIds.filter((id) =>
    existingEmails.every((e) => e.gmailId !== id),
  );

  const processed = await Promise.all(
    nonExistingMessageIds.map(async (messageId) => {
      try {
        // Fetch email content
        const email = await getEmailContent(gmailAccountId, messageId);

        if (!email) {
          return false;
        }

        // Process with AI
        const { categoryId, summary } = await categorizeAndSummarizeEmail(
          {
            subject: email.subject,
            from: `${email.from.name} <${email.from.email}>`,
            snippet: email.snippet,
            bodyText: email.bodyText,
          },
          userCategories.map((c) => ({
            id: c.id,
            name: c.name,
            description: c.description,
          })),
        );

        // Emails that belong to no category will not be processed
        if (categoryId === null) {
          return false;
        }

        // Store in database
        await db.insert(emails).values({
          gmailAccountId: gmailAccountId,
          gmailId: email.id,
          threadId: email.threadId,
          categoryId: categoryId,
          fromAddress: email.from.email,
          fromName: email.from.name,
          subject: email.subject,
          snippet: email.snippet,
          bodyText: email.bodyText,
          bodyHtml: email.bodyHtml,
          summary: summary,
          receivedAt: email.receivedAt,
          isRead: false,
          isDeleted: false,
        });

        // Archive in Gmail
        await archiveEmail(gmailAccountId, email.id);

        return true;
      } catch (error) {
        console.error(`Error processing email ${messageId}:`, error);
        return false;
      }
    }),
  );

  return processed.filter(Boolean).length;
}

// In-memory lock to prevent concurrent processing for the same account
const processingLocks = new Map<string, Promise<void>>();

export async function withAccountLock<T>(
  accountEmail: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Wait for any existing processing to complete
  const existingLock = processingLocks.get(accountEmail);
  if (existingLock) {
    await existingLock;
  }

  // Create a new lock for this processing
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  processingLocks.set(accountEmail, lockPromise);

  try {
    return await fn();
  } finally {
    releaseLock!();
    processingLocks.delete(accountEmail);
  }
}
