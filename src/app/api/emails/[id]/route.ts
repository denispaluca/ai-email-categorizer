import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { emails, gmailAccounts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get the email with its Gmail account to verify ownership
  const email = await db.query.emails.findFirst({
    where: eq(emails.id, id),
    with: {
      gmailAccount: true,
    },
  });

  if (!email || email.gmailAccount.userId !== session.user.id) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: email.id,
    subject: email.subject,
    fromAddress: email.fromAddress,
    fromName: email.fromName,
    summary: email.summary,
    bodyHtml: email.bodyHtml,
    bodyText: email.bodyText,
    receivedAt: email.receivedAt,
  });
}
