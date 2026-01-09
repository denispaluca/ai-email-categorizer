import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SignInButton } from "@/components/SignInButton";

export default async function Home() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <main className="flex flex-col items-center gap-8 px-4 text-center">
        <div className="flex items-center gap-3">
          <svg
            className="h-12 w-12 text-indigo-600"
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
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white">
            AI Email Sorter
          </h1>
        </div>

        <p className="max-w-md text-lg text-slate-600 dark:text-slate-300">
          Automatically categorize and summarize your emails using AI. Define
          your own categories and let the AI do the sorting.
        </p>

        <div className="flex flex-col gap-4">
          <SignInButton />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sign in with Google to get started
          </p>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
              <svg
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
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
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Custom Categories
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Define categories with descriptions. AI uses them to sort your
              emails accurately.
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
              <svg
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              AI Summaries
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Get instant AI-generated summaries for every email, saving you
              time.
            </p>
          </div>

          <div className="rounded-lg bg-white p-6 shadow-md dark:bg-slate-800">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
              <svg
                className="h-5 w-5 text-indigo-600 dark:text-indigo-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              Bulk Actions
            </h3>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Delete or unsubscribe from multiple emails at once with one click.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
