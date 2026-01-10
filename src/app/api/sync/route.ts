import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processNewEmails } from "@/lib/email-processor";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const processedCount = await processNewEmails(session.user.id);
    return NextResponse.json({
      success: true,
      processedCount,
      message: `Finished processing for ${session.user.email} (id: ${session.user.id})`,
    });
  } catch (error) {
    console.error("Error syncing emails:", error);
    return NextResponse.json(
      { error: "Failed to sync emails" },
      { status: 500 },
    );
  }
}
