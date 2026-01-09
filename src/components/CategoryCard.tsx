import Link from "next/link";
import { db } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { count } from "drizzle-orm";

interface Category {
  id: string;
  name: string;
  description: string;
  color: string;
  createdAt: Date | null;
}

interface CategoryCardProps {
  category: Category;
}

export async function CategoryCard({ category }: CategoryCardProps) {
  const emailCount = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.categoryId, category.id),
        eq(emails.isDeleted, false)
      )
    );

  const unreadCount = await db
    .select({ count: count() })
    .from(emails)
    .where(
      and(
        eq(emails.categoryId, category.id),
        eq(emails.isRead, false),
        eq(emails.isDeleted, false)
      )
    );

  return (
    <Link
      href={`/categories/${category.id}`}
      className="group block rounded-lg bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-slate-800"
    >
      <div className="flex items-start justify-between">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${category.color}20` }}
        >
          <svg
            className="h-5 w-5"
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
        {unreadCount[0].count > 0 && (
          <span
            className="flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium text-white"
            style={{ backgroundColor: category.color }}
          >
            {unreadCount[0].count}
          </span>
        )}
      </div>
      <h3 className="mt-3 font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-white dark:group-hover:text-indigo-400">
        {category.name}
      </h3>
      <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
        {category.description}
      </p>
      <div className="mt-3 flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
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
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
        <span>{emailCount[0].count} emails</span>
      </div>
    </Link>
  );
}
