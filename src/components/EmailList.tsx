"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailDetailModal } from "./EmailDetailModal";

interface Email {
  id: string;
  gmailAccountId: string;
  gmailId: string;
  fromAddress: string | null;
  fromName: string | null;
  subject: string | null;
  summary: string | null;
  receivedAt: Date | null;
  isRead: boolean | null;
}

interface EmailListProps {
  emails: Email[];
  categoryColor: string;
}

interface UnsubscribeResult {
  url: string;
  success: boolean;
  message: string;
}

interface UnsubscribeResponse {
  success: boolean;
  processed: number;
  linksFound: number;
  successCount?: number;
  failedCount?: number;
  results: UnsubscribeResult[];
  message?: string;
}

export function EmailList({ emails, categoryColor }: EmailListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [unsubscribeResults, setUnsubscribeResults] =
    useState<UnsubscribeResponse | null>(null);

  const allSelected = selectedIds.size === emails.length && emails.length > 0;
  const someSelected = selectedIds.size > 0;

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(emails.map((e) => e.id)));
    }
  };

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const response = await fetch("/api/emails/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error("Failed to delete emails");
      }

      setSelectedIds(new Set());
      router.refresh();
    } catch (error) {
      console.error("Error deleting emails:", error);
      alert("Failed to delete emails. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (selectedIds.size === 0) return;

    setIsUnsubscribing(true);
    setUnsubscribeResults(null);
    try {
      const response = await fetch("/api/emails/bulk-unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error("Failed to unsubscribe");
      }

      const result: UnsubscribeResponse = await response.json();
      setUnsubscribeResults(result);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Error unsubscribing:", error);
      alert("Failed to process unsubscribe requests.");
    } finally {
      setIsUnsubscribing(false);
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    } else {
      return d.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  return (
    <div className="space-y-4">
      {/* Bulk Actions Bar */}
      <div className="flex items-center justify-between rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {someSelected
                ? `${selectedIds.size} selected`
                : "Select all"}
            </span>
          </label>
        </div>
        {someSelected && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
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
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={handleUnsubscribe}
              disabled={isUnsubscribing}
              className="flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
                  d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
                />
              </svg>
              {isUnsubscribing ? "Processing..." : "Unsubscribe"}
            </button>
          </div>
        )}
      </div>

      {/* Email List */}
      <div className="divide-y divide-slate-200 rounded-lg bg-white shadow-sm dark:divide-slate-700 dark:bg-slate-800">
        {emails.map((email) => (
          <div
            key={email.id}
            className={`flex items-start gap-4 p-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700 ${
              !email.isRead ? "bg-indigo-50/50 dark:bg-indigo-900/10" : ""
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.has(email.id)}
              onChange={() => toggleSelect(email.id)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <button
              onClick={() => setSelectedEmail(email)}
              className="flex-1 text-left"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!email.isRead && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: categoryColor }}
                      />
                    )}
                    <p
                      className={`truncate text-sm ${
                        email.isRead
                          ? "text-slate-600 dark:text-slate-400"
                          : "font-semibold text-slate-900 dark:text-white"
                      }`}
                    >
                      {email.fromName || email.fromAddress || "Unknown"}
                    </p>
                  </div>
                  <p
                    className={`mt-0.5 truncate ${
                      email.isRead
                        ? "text-slate-600 dark:text-slate-400"
                        : "font-medium text-slate-900 dark:text-white"
                    }`}
                  >
                    {email.subject || "(No Subject)"}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {email.summary || "No summary available"}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                  {formatDate(email.receivedAt)}
                </span>
              </div>
            </button>
          </div>
        ))}
      </div>

      {/* Email Detail Modal */}
      {selectedEmail && (
        <EmailDetailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      )}

      {/* Unsubscribe Results Modal */}
      {unsubscribeResults && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 max-h-[80vh] w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Unsubscribe Results
              </h2>
              <button
                onClick={() => setUnsubscribeResults(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-4">
              <div className="mb-4 rounded-lg bg-slate-100 p-3 dark:bg-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Processed {unsubscribeResults.processed} emails,{" "}
                  {unsubscribeResults.linksFound} unsubscribe links found
                </p>
                {unsubscribeResults.linksFound > 0 && (
                  <p className="mt-1 text-sm">
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {unsubscribeResults.successCount} successful
                    </span>
                    {unsubscribeResults.failedCount &&
                      unsubscribeResults.failedCount > 0 && (
                        <span className="ml-2 font-medium text-red-600 dark:text-red-400">
                          {unsubscribeResults.failedCount} failed
                        </span>
                      )}
                  </p>
                )}
              </div>

              {unsubscribeResults.message && (
                <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                  {unsubscribeResults.message}
                </p>
              )}

              {unsubscribeResults.results.length > 0 && (
                <div className="space-y-3">
                  {unsubscribeResults.results.map((result, index) => (
                    <div
                      key={index}
                      className={`rounded-lg border p-3 ${
                        result.success
                          ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                          : "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        {result.success ? (
                          <svg
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400"
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
                        ) : (
                          <svg
                            className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600 dark:text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        )}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium ${
                              result.success
                                ? "text-green-800 dark:text-green-200"
                                : "text-red-800 dark:text-red-200"
                            }`}
                          >
                            {result.success ? "Unsubscribed" : "Failed"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
                            {result.url}
                          </p>
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {result.message}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border-t border-slate-200 p-4 dark:border-slate-700">
              <button
                onClick={() => setUnsubscribeResults(null)}
                className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
