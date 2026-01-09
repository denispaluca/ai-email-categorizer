"use client";

import { signIn } from "next-auth/react";

interface GmailAccount {
  id: string;
  email: string;
  createdAt: Date | null;
}

interface ConnectedAccountsProps {
  accounts: GmailAccount[];
}

export function ConnectedAccounts({ accounts }: ConnectedAccountsProps) {
  const handleAddAccount = () => {
    // Use Google sign-in with prompt to select a different account
    signIn("google", undefined, { prompt: "select_account" });
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
      {accounts.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          No accounts connected yet. Sign in to connect your first account.
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-700"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900">
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
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">
                    {account.email}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Connected{" "}
                    {account.createdAt
                      ? new Date(account.createdAt).toLocaleDateString()
                      : "recently"}
                  </p>
                </div>
              </div>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <svg
                  className="h-4 w-4 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={handleAddAccount}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-600 dark:border-slate-600 dark:text-slate-400 dark:hover:border-indigo-500 dark:hover:text-indigo-400"
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
        Connect Another Gmail Account
      </button>
    </div>
  );
}
