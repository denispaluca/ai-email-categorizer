import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { categories, emails } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import Link from "next/link";
import { EmailList } from "@/components/EmailList";
import { DeleteCategoryButton } from "@/components/DeleteCategoryButton";
import { AutoRefresh } from "@/components/AutoRefresh";

export default async function CategoryPage({
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

  const categoryEmails = await db.query.emails.findMany({
    where: and(
      eq(emails.categoryId, id),
      eq(emails.isDeleted, false)
    ),
    orderBy: [desc(emails.receivedAt)],
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <AutoRefresh interval={10000} />
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
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
              Back
            </Link>
            <div className="h-6 w-px bg-slate-300 dark:bg-slate-600" />
            <div className="flex items-center gap-3">
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${category.color}20` }}
              >
                <svg
                  className="h-4 w-4"
                  style={{ color: category.color }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="font-semibold text-slate-900 dark:text-white">
                  {category.name}
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {categoryEmails.length} emails
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/categories/${category.id}/edit`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Edit
            </Link>
            <DeleteCategoryButton categoryId={category.id} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-4 rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">Category Description:</span>{" "}
            {category.description}
          </p>
        </div>

        {categoryEmails.length === 0 ? (
          <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-600 dark:bg-slate-800">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
              No emails in this category
            </h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Emails matching this category will appear here when they arrive.
            </p>
          </div>
        ) : (
          <EmailList emails={categoryEmails} categoryColor={category.color} />
        )}
      </main>
    </div>
  );
}
