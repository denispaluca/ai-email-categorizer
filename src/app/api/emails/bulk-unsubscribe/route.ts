import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";
import { extractUnsubscribeLink } from "@/lib/gmail";

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

  const unsubscribeLinks: string[] = [];

  for (const email of ownedEmails) {
    const link = extractUnsubscribeLink(
      email.bodyHtml || "",
      email.bodyText || ""
    );
    if (link) {
      unsubscribeLinks.push(link);
    }
  }

  // Remove duplicates
  const uniqueLinks = [...new Set(unsubscribeLinks)];

  return NextResponse.json({
    success: true,
    processed: ownedEmails.length,
    unsubscribed: uniqueLinks.length,
    links: uniqueLinks,
  });
}
