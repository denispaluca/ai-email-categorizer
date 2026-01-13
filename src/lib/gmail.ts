import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { gmailAccounts } from "./db/schema";
import { eq } from "drizzle-orm";
import { JSDOM } from 'jsdom';

// Lazy-load the Anthropic client to avoid issues during testing
let anthropicClient: Anthropic | null = null;
function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

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

function createOAuth2Client(
  gmailAccountId: string,
  accessToken: string,
  refreshToken: string,
) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
  );

  oauth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
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

  return oauth2Client;
}

export async function getGmailClient(gmailAccountId: string) {
  const account = await db.query.gmailAccounts.findFirst({
    where: eq(gmailAccounts.id, gmailAccountId),
  });

  if (!account) {
    throw new Error("Gmail account not found");
  }

  const oauth2Client = createOAuth2Client(
    gmailAccountId,
    account.accessToken,
    account.refreshToken,
  );

  return google.gmail({ version: "v1", auth: oauth2Client });
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
  messageId: string,
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
  messageId: string,
): Promise<void> {
  const gmail = await getGmailClient(gmailAccountId);

  await gmail.users.messages.trash({
    userId: "me",
    id: messageId,
  });
}

export async function getEmailContent(
  gmailAccountId: string,
  messageId: string,
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

export async function setupWatch(
  gmailAccountId: string,
): Promise<string | null> {
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
  startHistoryId: string,
): Promise<string[]> {
  const gmail = await getGmailClient(gmailAccountId);

  try {
    console.log(
      `Querying history of ${gmailAccountId} from history ID ${startHistoryId}`,
    );
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
    console.error(
      `Error fetching history of ${gmailAccountId} from history ID ${startHistoryId}`,
      error,
    );
    return [];
  }
}

const unsubscribeKeywords = ["unsubscribe", "opt out", "opt-out", "manage preferences", "email preferences", "stop receiving", "subscription"];

const regexp = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,63}\b([-a-zA-Z0-9()'@:%_\+.~#?!&//=]*)/gi;
const bracketsRegexp = /[()]|\.$/g;

function extractUrls(str: string): string[] {
  const urls = str.match(regexp);
  return urls?.map((item) => item.replace(bracketsRegexp, '')) || [];
}

export async function findUnsubscribeLink(bodyHtml: string, bodyText: string, subject: string): Promise<string | null> {
  const doc = new JSDOM(bodyHtml);
  const anchors = doc.window.document.querySelectorAll("a");
  const anchorsWithText = Array.from(anchors).map(a => [a.href, a.textContent?.toLowerCase()]);

  const possibleUnsubscribeAnchors = anchorsWithText.filter(([link, text]) => {
    return unsubscribeKeywords.some((keyword) => text?.includes(keyword) || link?.includes(keyword))
  });

  if (possibleUnsubscribeAnchors.length === 1) {
    const unsubscribeLink = possibleUnsubscribeAnchors[0][0];
    return unsubscribeLink;
  }

  const newLinksInBodyText = extractUrls(bodyText).filter(url => !anchorsWithText.some(([link]) => link === url));

  const possibleUnsubscribeLinks = newLinksInBodyText.filter((url) => {
    return unsubscribeKeywords.some((keyword) => url.includes(keyword))
  });

  if (possibleUnsubscribeLinks.length === 1) {
    const unsubscribeLink = possibleUnsubscribeLinks[0];
    return unsubscribeLink;
  }

  const anchorsToAnalyze = possibleUnsubscribeAnchors.length > 1 ? possibleUnsubscribeAnchors : anchorsWithText;
  const linksToAnalyze = possibleUnsubscribeLinks.length > 1 ? possibleUnsubscribeLinks : newLinksInBodyText;

  const prompt = `You are analyzing links an email to find the unsubscribe link. Your job is to identify the URL that would allow a user to unsubscribe from this mailing list.

  Email Subject: ${subject}
  
  Here are all the anchor tags found in the email with their text and href (if available):
  Anchor Text, Anchor Href Link
  ${anchorsToAnalyze.map(([link, text]) => `${text}, ${link}`).join("\n")}

  Here are all the other links found in the email body text:
  ${linksToAnalyze.join("\n")}

  INSTRUCTIONS:
  1. Find the URL that is most likely the unsubscribe link
  2. Look for links with text like "unsubscribe", "opt out", "manage preferences", "email preferences", "stop receiving", etc.
  3. The URL might not contain the word "unsubscribe" - focus on the link text and context
  4. If there are multiple potential unsubscribe links, choose the most direct one (prefer "unsubscribe" over "manage preferences")
  5. Do NOT return tracking pixels, images, or the main website URL
  
  Respond with ONLY a JSON object in this exact format:
  {
    "url": "the unsubscribe URL or null if not found",
    "confidence": "high" | "medium" | "low",
    "reason": "brief explanation of why this is the unsubscribe link"
  }
  
  If no unsubscribe link is found, return:
  {
    "url": null,
    "confidence": "low",
    "reason": "No unsubscribe link found"
  }`;

  try {
    const response = await getAnthropicClient().messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (
          parsed.url &&
          parsed.url !== "null" &&
          parsed.url.startsWith("http")
        ) {
          console.log(
            `AI found unsubscribe link: ${parsed.url} (confidence: ${parsed.confidence}, reason: ${parsed.reason})`,
          );
          return parsed.url;
        }
      }
    }
    return null;
  } catch (error) {
    console.error("Error extracting unsubscribe link with AI:", error);
    return null;
  }
}
