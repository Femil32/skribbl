"use client";

import { useEffect } from "react";
import { maybeDemoPingWs } from "@/lib/ws-client";

/** Dev-only optional WS ping demo — gated by env (see `maybeDemoPingWs`). */
export function ComponentWsPingDemo() {
  useEffect(() => {
    maybeDemoPingWs();
  }, []);
  return null;
}
