import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { gmailAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { setupWatch } from "@/lib/gmail";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Get all Gmail accounts for this user
    const accounts = await db.query.gmailAccounts.findMany({
      where: eq(gmailAccounts.userId, session.user.id),
    });

    const results = [];

    for (const account of accounts) {
      const historyId = await setupWatch(account.id);
      results.push({
        email: account.email,
        success: !!historyId,
        historyId,
      });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error("Error setting up watch:", error);
    return NextResponse.json(
      { error: "Failed to set up watch" },
      { status: 500 }
    );
  }
}
