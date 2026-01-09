import { google } from "googleapis";
import { db } from "./db";
import { gmailAccounts } from "./db/schema";
import { eq } from "drizzle-orm";

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

export interface EmailMessage {
  id: string;
  threadId: string;
  snippet: string;
  subject: string;
  from: {
    name: string;
    email: string;
  };
  bodyText: string;
  bodyHtml: string;
  receivedAt: Date;
  labelIds: string[];
}

export async function getGmailClient(gmailAccountId: string) {
  const account = await db.query.gmailAccounts.findFirst({
    where: eq(gmailAccounts.id, gmailAccountId),
  });

  if (!account) {
    throw new Error("Gmail account not found");
  }

  oauth2Client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
  });

  // Handle token refresh
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db
        .update(gmailAccounts)
        .set({
          accessToken: tokens.access_token,
          expiresAt: tokens.expiry_date
            ? Math.floor(tokens.expiry_date / 1000)
            : null,
        })
        .where(eq(gmailAccounts.id, gmailAccountId));
    }
  });

  return google.gmail({ version: "v1", auth: oauth2Client });
}

export async function fetchNewEmails(
  gmailAccountId: string,
  maxResults = 10
): Promise<EmailMessage[]> {
  const gmail = await getGmailClient(gmailAccountId);

  // Fetch messages from inbox
  const response = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults,
  });

  if (!response.data.messages) {
    return [];
  }

  const emails: EmailMessage[] = await Promise.all(response.data.messages.map(async message => {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: message.id!,
      format: "full",
    });

    const headers = fullMessage.data.payload?.headers || [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ||
      "(No Subject)";
    const from =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
    const dateStr =
      headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

    // Parse from field
    const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    const fromName = fromMatch?.[1] || from.split("@")[0];
    const fromEmail = fromMatch?.[2] || from;

    // Extract body
    const { text, html } = extractBody(fullMessage.data.payload);

    return {
      id: message.id!,
      threadId: message.threadId!,
      snippet: fullMessage.data.snippet || "",
      subject,
      from: {
        name: fromName,
        email: fromEmail,
      },
      bodyText: text,
      bodyHtml: html,
      receivedAt: new Date(dateStr),
      labelIds: fullMessage.data.labelIds || [],
    }
  }))

  return emails;
}

function extractBody(payload: any): { text: string; html: string } {
  let text = "";
  let html = "";

  if (payload.body?.data) {
    const content = Buffer.from(payload.body.data, "base64").toString("utf-8");
    if (payload.mimeType === "text/plain") {
      text = content;
    } else if (payload.mimeType === "text/html") {
      html = content;
    }
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const result = extractBody(part);
      if (result.text && !text) text = result.text;
      if (result.html && !html) html = result.html;
    }
  }

  return { text, html };
}

export async function archiveEmail(
  gmailAccountId: string,
  messageId: string
): Promise<void> {
  const gmail = await getGmailClient(gmailAccountId);

  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: {
      removeLabelIds: ["INBOX"],
    },
  });
}

export async function deleteEmail(
  gmailAccountId: string,
  messageId: string
): Promise<void> {
  const gmail = await getGmailClient(gmailAccountId);

  await gmail.users.messages.trash({
    userId: "me",
    id: messageId,
  });
}

export async function getEmailContent(
  gmailAccountId: string,
  messageId: string
): Promise<EmailMessage | null> {
  const gmail = await getGmailClient(gmailAccountId);

  try {
    const fullMessage = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = fullMessage.data.payload?.headers || [];
    const subject =
      headers.find((h) => h.name?.toLowerCase() === "subject")?.value ||
      "(No Subject)";
    const from =
      headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
    const dateStr =
      headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";

    const fromMatch = from.match(/^(?:"?([^"]*)"?\s)?<?([^>]+)>?$/);
    const fromName = fromMatch?.[1] || from.split("@")[0];
    const fromEmail = fromMatch?.[2] || from;

    const { text, html } = extractBody(fullMessage.data.payload);

    return {
      id: messageId,
      threadId: fullMessage.data.threadId!,
      snippet: fullMessage.data.snippet || "",
      subject,
      from: {
        name: fromName,
        email: fromEmail,
      },
      bodyText: text,
      bodyHtml: html,
      receivedAt: new Date(dateStr),
      labelIds: fullMessage.data.labelIds || [],
    };
  } catch (error) {
    console.error("Error fetching email:", error);
    return null;
  }
}

export async function setupWatch(gmailAccountId: string): Promise<string | null> {
  const gmail = await getGmailClient(gmailAccountId);

  try {
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName: `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/topics/gmail-notifications`,
        labelIds: ["INBOX"],
      },
    });

    if (response.data.historyId) {
      await db
        .update(gmailAccounts)
        .set({
          historyId: String(response.data.historyId),
          watchExpiration: response.data.expiration
            ? new Date(parseInt(response.data.expiration))
            : null,
        })
        .where(eq(gmailAccounts.id, gmailAccountId));
    }

    return response.data.historyId || null;
  } catch (error) {
    console.error("Error setting up watch:", error);
    return null;
  }
}

export async function getHistoryChanges(
  gmailAccountId: string,
  startHistoryId: string
): Promise<string[]> {
  const gmail = await getGmailClient(gmailAccountId);

  try {
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes: ["messageAdded"],
      labelId: "INBOX",
    });

    const messageIds: string[] = [];

    if (response.data.history) {
      for (const record of response.data.history) {
        if (record.messagesAdded) {
          for (const added of record.messagesAdded) {
            if (added.message?.id) {
              messageIds.push(added.message.id);
            }
          }
        }
      }
    }

    // Update history ID
    if (response.data.historyId) {
      await db
        .update(gmailAccounts)
        .set({ historyId: response.data.historyId })
        .where(eq(gmailAccounts.id, gmailAccountId));
    }

    return messageIds;
  } catch (error) {
    console.error("Error fetching history:", error);
    return [];
  }
}

export function extractUnsubscribeLink(bodyHtml: string, bodyText: string): string | null {
  // Try to find unsubscribe link in HTML
  const htmlMatch = bodyHtml.match(
    /href=["']([^"']*(?:unsubscribe|opt-out|remove)[^"']*)["']/i
  );
  if (htmlMatch) {
    return htmlMatch[1];
  }

  // Try to find in plain text
  const textMatch = bodyText.match(
    /(https?:\/\/[^\s]*(?:unsubscribe|opt-out|remove)[^\s]*)/i
  );
  if (textMatch) {
    return textMatch[1];
  }

  return null;
}
