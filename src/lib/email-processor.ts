import { db } from "./db";
import { emails, categories, gmailAccounts } from "./db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { fetchNewEmails, archiveEmail, EmailMessage, getEmailContent } from "./gmail";
import { categorizeAndSummarizeEmail } from "./claude";

export async function processNewEmails(userId: string): Promise<number> {
  // Get all Gmail accounts for this user
  const userGmailAccounts = await db.query.gmailAccounts.findMany({
    where: eq(gmailAccounts.userId, userId),
  });

  // Get all categories for this user
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, userId),
  });

  // When user has no categories emails will not be processed
  if(userCategories.length === 0) {
    return 0;
  }
  
  let processedCount = 0;

  for (const account of userGmailAccounts) {
    try {
      // Fetch new emails from inbox
      const newEmails = await fetchNewEmails(account.id, 20);

      for (const email of newEmails) {
        // Check if email already exists
        const existingEmail = await db.query.emails.findFirst({
          where: and(
            eq(emails.gmailAccountId, account.id),
            eq(emails.gmailId, email.id)
          ),
        });

        if (existingEmail) {
          continue; // Skip already processed emails
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
          }))
        );

        // Store in database
        await db.insert(emails).values({
          gmailAccountId: account.id,
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

        // Archive in Gmail (remove from inbox)
        await archiveEmail(account.id, email.id);

        processedCount++;
      }
    } catch (error) {
      console.error(`Error processing emails for account ${account.email}:`, error);
    }
  }

  return processedCount;
}

export async function processSpecificEmails(
  gmailAccountId: string,
  messageIds: string[]
): Promise<number> {
  const account = await db.query.gmailAccounts.findFirst({
    where: eq(gmailAccounts.id, gmailAccountId),
  });

  if (!account) {
    throw new Error("Gmail account not found");
  }

  // Get categories for this user
  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, account.userId),
  });

  // When user has no categories emails will not be processed
  if(userCategories.length === 0) {
    return 0;
  }

  let processedCount = 0;


  // Check if already processed
  const existingEmails = await db.select({gmailId: emails.gmailId}).from(emails).where(
      and(eq(emails.gmailAccountId, gmailAccountId),inArray(emails.gmailId, messageIds))
    );

  const nonExistingMessageIds = messageIds.filter(id => existingEmails.some(e => e.gmailId === id));
  for (const messageId of nonExistingMessageIds) {
    try {
      // Check if already processed
      const existingEmail = await db.query.emails.findFirst({
        where: and(
          eq(emails.gmailAccountId, gmailAccountId),
          eq(emails.gmailId, messageId)
        ),
      });

      if (existingEmail) {
        continue;
      }

      // Fetch email content
      const email = await getEmailContent(gmailAccountId, messageId);

      if (!email) {
        continue;
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
        }))
      );

      // Emails that belong to no category will not be processed
      if(categoryId === null) {
        continue;
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

      processedCount++;
    } catch (error) {
      console.error(`Error processing email ${messageId}:`, error);
    }
  }

  return processedCount;
}
