"use client";

import { useEffect } from "react";
import { RouteErrorFallback } from "@/components/RouteErrorFallback";
import { shouldLogRouteErrors } from "@/lib/client-debug";

export default function GameSegmentErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    if (shouldLogRouteErrors()) {
      console.error(error);
    }
  }, [error]);

  return <RouteErrorFallback unstable_retry={unstable_retry} />;
}
