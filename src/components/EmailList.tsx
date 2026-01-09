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

export function EmailList({ emails, categoryColor }: EmailListProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);

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
    try {
      const response = await fetch("/api/emails/bulk-unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        throw new Error("Failed to unsubscribe");
      }

      const result = await response.json();
      alert(
        `Processed ${result.processed} emails. ${result.unsubscribed} unsubscribe links found and opened.`
      );
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
    </div>
  );
}
