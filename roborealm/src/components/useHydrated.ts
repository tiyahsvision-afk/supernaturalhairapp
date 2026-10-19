"use client";
import { useEffect, useState } from "react";

/** True once persisted progress has loaded on the client (avoids SSR/localStorage mismatches). */
export function useHydrated() {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(true), []);
  return ok;
}
