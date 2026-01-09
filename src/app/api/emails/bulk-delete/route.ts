import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { eq, inArray } from "drizzle-orm";
import { deleteEmail } from "@/lib/gmail";

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

  // Get the emails to verify ownership and get Gmail IDs
  const emailsToDelete = await db.query.emails.findMany({
    where: inArray(emails.id, emailIds),
    with: {
      gmailAccount: true,
    },
  });

  // Filter to only emails owned by this user
  const ownedEmails = emailsToDelete.filter(
    (e) => e.gmailAccount.userId === session.user.id
  );

  let deletedCount = 0;

  for (const email of ownedEmails) {
    try {
      // Delete from Gmail (move to trash)
      await deleteEmail(email.gmailAccountId, email.gmailId);

      // Mark as deleted in our database
      await db
        .update(emails)
        .set({ isDeleted: true })
        .where(eq(emails.id, email.id));

      deletedCount++;
    } catch (error) {
      console.error(`Error deleting email ${email.id}:`, error);
    }
  }

  return NextResponse.json({ success: true, deletedCount });
}
