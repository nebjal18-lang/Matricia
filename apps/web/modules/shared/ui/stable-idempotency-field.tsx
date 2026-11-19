"use client";

import { useEffect, useState } from "react";

/** Hidden idempotency key that stays stable across re-renders; rotate after success. */
export function StableIdempotencyField({
  name = "idempotencyKey",
  rotateToken,
}: {
  name?: string;
  /** Change this value (e.g. success count) to mint a fresh key after a completed mutation. */
  rotateToken?: string | number | boolean;
}) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (rotateToken === undefined) return;
    setKey(crypto.randomUUID());
  }, [rotateToken]);
  return <input type="hidden" name={name} value={key} />;
}

export function useStableIdempotencyKey(rotateToken?: string | number | boolean): string {
  const [key, setKey] = useState(() => crypto.randomUUID());
  useEffect(() => {
    if (rotateToken === undefined) return;
    setKey(crypto.randomUUID());
  }, [rotateToken]);
  return key;
}
