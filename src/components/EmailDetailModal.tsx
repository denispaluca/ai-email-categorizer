"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Email {
  id: string;
  gmailAccountId: string;
  gmailId: string;
  fromAddress: string | null;
  fromName: string | null;
  subject: string | null;
  summary: string | null;
  receivedAt: Date | null;
}

interface EmailDetail {
  id: string;
  subject: string | null;
  fromAddress: string | null;
  fromName: string | null;
  summary: string | null;
  bodyHtml: string | null;
  bodyText: string | null;
  receivedAt: Date | null;
}

interface EmailDetailModalProps {
  email: Email;
  onClose: () => void;
}

export function EmailDetailModal({ email, onClose }: EmailDetailModalProps) {
  const router = useRouter();
  const [emailDetail, setEmailDetail] = useState<EmailDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showHtml, setShowHtml] = useState(true);

  useEffect(() => {
    const fetchEmail = async () => {
      try {
        const response = await fetch(`/api/emails/${email.id}`);
        if (response.ok) {
          const data = await response.json();
          setEmailDetail(data);
        }
      } catch (error) {
        console.error("Error fetching email:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchEmail();

    // Mark as read
    fetch(`/api/emails/${email.id}/read`, { method: "POST" }).then(() => {
      router.refresh();
    });
  }, [email.id, router]);

  const formatDate = (date: Date | null) => {
    if (!date) return "";
    return new Date(date).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-700">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
              {email.subject || "(No Subject)"}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              From: {email.fromName || email.fromAddress || "Unknown"}
              {email.fromName && email.fromAddress && (
                <span className="ml-1 text-slate-400 dark:text-slate-500">
                  &lt;{email.fromAddress}&gt;
                </span>
              )}
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {formatDate(email.receivedAt)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
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

        {/* Summary */}
        {email.summary && (
          <div className="border-b border-slate-200 bg-indigo-50 p-4 dark:border-slate-700 dark:bg-indigo-900/20">
            <div className="flex items-start gap-2">
              <svg
                className="mt-0.5 h-4 w-4 text-indigo-600 dark:text-indigo-400"
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
              <div>
                <p className="text-sm font-medium text-indigo-900 dark:text-indigo-300">
                  AI Summary
                </p>
                <p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">
                  {email.summary}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="max-h-[60vh] overflow-auto p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <svg
                className="h-8 w-8 animate-spin text-indigo-600"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
          ) : emailDetail ? (
            <div>
              {/* View Toggle */}
              {emailDetail.bodyHtml && emailDetail.bodyText && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => setShowHtml(true)}
                    className={`rounded-lg px-3 py-1 text-sm font-medium ${
                      showHtml
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    Rich Text
                  </button>
                  <button
                    onClick={() => setShowHtml(false)}
                    className={`rounded-lg px-3 py-1 text-sm font-medium ${
                      !showHtml
                        ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300"
                        : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                    }`}
                  >
                    Plain Text
                  </button>
                </div>
              )}

              {/* Email Body */}
              {showHtml && emailDetail.bodyHtml ? (
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: emailDetail.bodyHtml }}
                />
              ) : (
                <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  {emailDetail.bodyText || "No content available"}
                </pre>
              )}
            </div>
          ) : (
            <p className="text-center text-slate-500 dark:text-slate-400">
              Failed to load email content
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
