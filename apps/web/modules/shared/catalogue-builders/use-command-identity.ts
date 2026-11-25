"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { canonicalCommandPayload, purgeConfirmedCommandIdentity, resolveCommandIdentity, type CommandAction, type CommandIdentity } from "@/modules/shared/lib/catalogue-builder/command-identity";

export function usePersistentCommandIdentity(action: CommandAction, succeeded: boolean, fallback: CommandIdentity) {
  const idempotencyRef = useRef<HTMLInputElement>(null);
  const correlationRef = useRef<HTMLInputElement>(null);
  const submittedIdempotencyKey = useRef(fallback.idempotencyKey);
  const onSubmitCapture = (event: FormEvent<HTMLFormElement>) => {
    const payload = canonicalCommandPayload(new FormData(event.currentTarget));
    const identity = resolveCommandIdentity(window.sessionStorage, action, payload, fallback);
    submittedIdempotencyKey.current = identity.idempotencyKey;
    if (idempotencyRef.current) idempotencyRef.current.value = identity.idempotencyKey;
    if (correlationRef.current) correlationRef.current.value = identity.correlationId;
  };
  useEffect(() => {
    if (succeeded) purgeConfirmedCommandIdentity(window.sessionStorage, action, submittedIdempotencyKey.current);
  }, [action, succeeded]);
  return [idempotencyRef, correlationRef, onSubmitCapture] as const;
}
