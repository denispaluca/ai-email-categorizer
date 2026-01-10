import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { db } from "./db";
import { gmailAccounts } from "./db/schema";
import { eq } from "drizzle-orm";

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

function createOAuth2Client(gmailAccountId: string, accessToken: string, refreshToken: string) {
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

export function extractUnsubscribeLink(
  bodyHtml: string,
  bodyText: string,
): string | null {
  // Method 1: Find links where the URL contains unsubscribe keywords
  const urlMatch = bodyHtml.match(
    /href=["'](https?:\/\/[^"']*(?:unsubscribe|opt-out|optout|remove|email-preferences|subscription)[^"']*)["']/i,
  );
  if (urlMatch) {
    return urlMatch[1];
  }

  // Method 2: Find anchor tags where the link TEXT contains unsubscribe keywords
  // This handles cases like <a href="https://example.com/abc123">Unsubscribe</a>
  const anchorRegex =
    /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*(?:unsubscribe|opt[\s-]?out|manage\s+(?:preferences|subscription)|stop\s+(?:receiving|emails))[^<]*)<\/a>/gi;
  let anchorMatch;
  while ((anchorMatch = anchorRegex.exec(bodyHtml)) !== null) {
    const href = anchorMatch[1];
    // Make sure it's a valid http(s) URL and not a mailto link
    if (href.startsWith("http")) {
      return href;
    }
  }

  // Method 3: Check for href before the anchor text (different attribute order)
  const reverseAnchorRegex =
    /<a\s+[^>]*>([^<]*(?:unsubscribe|opt[\s-]?out|manage\s+(?:preferences|subscription)|stop\s+(?:receiving|emails))[^<]*)<\/a>/gi;
  while ((anchorMatch = reverseAnchorRegex.exec(bodyHtml)) !== null) {
    // Extract the full anchor tag to find href
    const fullTagMatch = bodyHtml
      .substring(anchorMatch.index - 200, anchorMatch.index + anchorMatch[0].length)
      .match(/<a\s+([^>]*)href=["']([^"']+)["']/i);
    if (fullTagMatch && fullTagMatch[2].startsWith("http")) {
      return fullTagMatch[2];
    }
  }

  // Method 4: Try to find in plain text - URLs with unsubscribe keywords
  const textMatch = bodyText.match(
    /(https?:\/\/[^\s]*(?:unsubscribe|opt-out|optout|remove|email-preferences|subscription)[^\s]*)/i,
  );
  if (textMatch) {
    return textMatch[1];
  }

  // Method 5: Look for URLs near the word "unsubscribe" in plain text
  const unsubscribeIndex = bodyText.toLowerCase().indexOf("unsubscribe");
  if (unsubscribeIndex !== -1) {
    // Look for a URL within 200 characters of the word "unsubscribe"
    const surroundingText = bodyText.substring(
      Math.max(0, unsubscribeIndex - 100),
      Math.min(bodyText.length, unsubscribeIndex + 200),
    );
    const nearbyUrlMatch = surroundingText.match(/(https?:\/\/[^\s]+)/i);
    if (nearbyUrlMatch) {
      return nearbyUrlMatch[1];
    }
  }

  return null;
}

/**
 * Uses AI to extract unsubscribe links from email content.
 * This is more robust than regex-based extraction as it can understand context.
 */
export async function extractUnsubscribeLinkWithAI(
  bodyHtml: string,
  bodyText: string,
  subject: string,
  fromAddress: string,
): Promise<string | null> {
  // First extract all URLs from the email for the AI to analyze
  const urlRegex = /https?:\/\/[^\s"'<>]+/gi;
  const htmlUrls = bodyHtml.match(urlRegex) || [];
  const textUrls = bodyText.match(urlRegex) || [];
  const allUrls = [...new Set([...htmlUrls, ...textUrls])];

  if (allUrls.length === 0) {
    return null;
  }

  // Also extract anchor tags with their text for context
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
  const anchors: { url: string; text: string }[] = [];
  let match;
  while ((match = anchorRegex.exec(bodyHtml)) !== null) {
    if (match[1].startsWith("http")) {
      anchors.push({ url: match[1], text: match[2].trim() });
    }
  }

  const prompt = `You are analyzing an email to find the unsubscribe link. Your job is to identify the URL that would allow a user to unsubscribe from this mailing list.

Email Subject: ${subject}
From: ${fromAddress}

Here are all the links found in the email with their link text (if available):
${anchors.map((a) => `- "${a.text}" -> ${a.url}`).join("\n")}

Additional URLs found:
${allUrls.filter((u) => !anchors.some((a) => a.url === u)).join("\n")}

Plain text content (truncated):
${bodyText.substring(0, 1500)}

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
        if (parsed.url && parsed.url !== "null" && parsed.url.startsWith("http")) {
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

/**
 * Smart unsubscribe link extraction that tries programmatic methods first,
 * then falls back to AI if needed.
 */
export async function findUnsubscribeLink(
  bodyHtml: string,
  bodyText: string,
  subject: string = "",
  fromAddress: string = "",
): Promise<string | null> {
  // First try the fast programmatic extraction
  const programmaticResult = extractUnsubscribeLink(bodyHtml, bodyText);
  if (programmaticResult) {
    console.log(`Found unsubscribe link programmatically: ${programmaticResult}`);
    return programmaticResult;
  }

  // Fall back to AI-based extraction
  console.log("Programmatic extraction failed, trying AI...");
  const aiResult = await extractUnsubscribeLinkWithAI(
    bodyHtml,
    bodyText,
    subject,
    fromAddress,
  );
  return aiResult;
}
