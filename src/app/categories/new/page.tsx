import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CategoryForm } from "@/components/CategoryForm";
import Link from "next/link";

export default async function NewCategory() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <header className="border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
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
              Back to Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="rounded-lg bg-white p-6 shadow-sm dark:bg-slate-800">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Create New Category
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Define a category with a name and description. The AI will use the
            description to automatically sort your emails.
          </p>
          <div className="mt-6">
            <CategoryForm />
          </div>
        </div>
      </main>
    </div>
  );
}
