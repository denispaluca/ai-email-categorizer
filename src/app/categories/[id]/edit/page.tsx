import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import Link from "next/link";
import { CategoryForm } from "@/components/CategoryForm";

export default async function EditCategory({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const { id } = await params;

  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, id),
      eq(categories.userId, session.user.id)
    ),
  });

  if (!category) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/categories/${id}`}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
              Back to Category
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Edit Category
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Update the category name and description.
          </p>
          <div className="mt-6">
            <CategoryForm
              category={{
                id: category.id,
                name: category.name,
                description: category.description,
                color: category.color,
              }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
