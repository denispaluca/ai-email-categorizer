import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { findUnsubscribeLink } from "@/lib/gmail";
import { processUnsubscribeLinks } from "@/lib/unsubscribe-agent";

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { emailIds } = body;

  if (!emailIds || !Array.isArray(emailIds) || emailIds.length === 0) {
    return NextResponse.json(
      { error: "Email IDs are required" },
      { status: 400 }
    );
  }

  // Get the emails to verify ownership
  const emailsToProcess = await db.query.emails.findMany({
    where: inArray(emails.id, emailIds),
    with: {
      gmailAccount: true,
    },
  });

  // Filter to only emails owned by this user
  const ownedEmails = emailsToProcess.filter(
    (e) => e.gmailAccount.userId === session.user.id
  );

  // Extract unsubscribe links using both programmatic and AI methods
  const linkPromises = ownedEmails.map(async (email) => {
    const link = await findUnsubscribeLink(
      email.bodyHtml || "",
      email.bodyText || "",
      email.subject || "",
    );
    return link;
  });

  const links = await Promise.all(linkPromises);
  const unsubscribeLinks = links.filter((link): link is string => link !== null);

  // Remove duplicates
  const uniqueLinks = [...new Set(unsubscribeLinks)];

  if (uniqueLinks.length === 0) {
    return NextResponse.json({
      success: true,
      processed: ownedEmails.length,
      linksFound: 0,
      results: [],
      message: "No unsubscribe links found in selected emails",
    });
  }

  // Get the user's email from the first owned email's Gmail account
  const userEmail = ownedEmails[0].gmailAccount.email;

  // Run the AI agent to actually unsubscribe
  console.log(`Processing ${uniqueLinks.length} unsubscribe links for ${userEmail}...`);
  const results = await processUnsubscribeLinks(uniqueLinks, userEmail);

  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return NextResponse.json({
    success: true,
    processed: ownedEmails.length,
    linksFound: uniqueLinks.length,
    successCount,
    failedCount,
    results: results.map((r) => ({
      url: r.url,
      success: r.success,
      message: r.message,
    })),
  });
}
