"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface DeleteCategoryButtonProps {
  categoryId: string;
}

export function DeleteCategoryButton({ categoryId }: DeleteCategoryButtonProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this category? Emails in this category will become uncategorized.")) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete category");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
    >
      {isDeleting ? "Deleting..." : "Delete"}
    </button>
  );
}
