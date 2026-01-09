import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, session.user.id),
    orderBy: (categories, { asc }) => [asc(categories.createdAt)],
  });

  return NextResponse.json(userCategories);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, description, color } = body;

  if (!name || !description) {
    return NextResponse.json(
      { error: "Name and description are required" },
      { status: 400 }
    );
  }

  const newCategory = await db
    .insert(categories)
    .values({
      userId: session.user.id,
      name,
      description,
      color: color || "#6366f1",
    })
    .returning();

  return NextResponse.json(newCategory[0], { status: 201 });
}
