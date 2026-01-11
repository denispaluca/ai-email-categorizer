"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface AutoRefreshProps {
  interval?: number;
}

export function AutoRefresh({ interval = 10000 }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      router.refresh();
    }, interval);

    return () => clearInterval(id);
  }, [router, interval]);

  return null;
}
