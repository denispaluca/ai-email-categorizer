import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { categories, gmailAccounts } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import Link from "next/link";
import { SignOutButton } from "@/components/SignOutButton";
import { ConnectedAccounts } from "@/components/ConnectedAccounts";
import { CategoryCard } from "@/components/CategoryCard";
import { SyncButton } from "@/components/SyncButton";
import { AutoRefresh } from "@/components/AutoRefresh";

export default async function Dashboard() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  const userCategories = await db.query.categories.findMany({
    where: eq(categories.userId, session.user.id),
    orderBy: (categories, { asc }) => [asc(categories.createdAt)],
  });

  const userGmailAccounts = await db.query.gmailAccounts.findMany({
    where: eq(gmailAccounts.userId, session.user.id),
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <AutoRefresh interval={10000} />
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <svg
              className="h-8 w-8 text-indigo-600"
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
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              AI Email Sorter
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {session.user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="space-y-8">
          {/* Connected Accounts Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Connected Gmail Accounts
              </h2>
              <SyncButton />
            </div>
            <ConnectedAccounts accounts={userGmailAccounts} />
          </section>

          {/* Categories Section */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Categories
              </h2>
              <Link
                href="/categories/new"
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Category
              </Link>
            </div>

            {userCategories.length === 0 ? (
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
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
                <h3 className="mt-4 text-lg font-medium text-slate-900 dark:text-white">
                  No categories yet
                </h3>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Create categories to start sorting your emails automatically.
                </p>
                <p className="mt-2 text-sm text-amber-600 dark:text-amber-400">
                  Incoming emails will not be processed until you create at least one category.
                </p>
                <Link
                  href="/categories/new"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Create Your First Category
                </Link>
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {userCategories.map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
                <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                  Emails that cannot be assigned to any category will not be processed.
                </p>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
