import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get the email to verify ownership
  const email = await db.query.emails.findFirst({
    where: eq(emails.id, id),
    with: {
      gmailAccount: true,
    },
  });

  if (!email || email.gmailAccount.userId !== session.user.id) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  await db.update(emails).set({ isRead: true }).where(eq(emails.id, id));

  return NextResponse.json({ success: true });
}
