import { createHash } from "node:crypto";
import { isIP } from "node:net";

export type NotificationDeliveryJob = {
  deliveryId: string;
  channel: "IN_APP" | "EMAIL";
  recipientEmail: string | null;
  locale: "fr-MA" | "ar-MA";
  subject: string;
  body: string;
  ctaPath: string | null;
  providerIdempotencyKey: string | null;
};

export type NotificationDeliveryResult =
  | { outcome: "DELIVERED" | "SENT"; providerMessageId: string; evidence: Record<string, string | boolean> }
  | { outcome: "RETRYABLE_FAILURE" | "PERMANENT_FAILURE"; errorCode: string; evidence: Record<string, string | boolean> };

type DeliveryEnvironment = Record<string, string | undefined>;
type Dependencies = { env: DeliveryEnvironment; fetch: typeof fetch };

type EmailProviderRequest = {
  endpoint: string;
  token: string;
  body: Record<string, unknown>;
  adapter: "EMAIL_EXTERNAL" | "EMAIL_RESEND";
};

function allowedRecipient(email: string, rawAllowlist: string | undefined) {
  const normalized = email.trim().toLowerCase();
  const allowlist = (rawAllowlist ?? "").split(",").map((entry) => entry.trim().toLowerCase()).filter(Boolean);
  return allowlist.some((entry) => entry.startsWith("@") ? normalized.endsWith(entry) : normalized === entry);
}

function demoMessageId(job: NotificationDeliveryJob) {
  return `demo-email-${createHash("sha256").update(`${job.deliveryId}:${job.providerIdempotencyKey}`).digest("hex").slice(0, 24)}`;
}

function nonGlobalAddress(rawAddress: string) {
  const address = rawAddress.toLowerCase().split("%")[0];
  if (address.startsWith("::ffff:")) {
    const mapped = address.slice(7);
    if (isIP(mapped) === 4) return nonGlobalAddress(mapped);
    const hexadecimal = mapped.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (!hexadecimal) return true;
    const high = Number.parseInt(hexadecimal[1]!,16),low = Number.parseInt(hexadecimal[2]!,16);
    return nonGlobalAddress(`${high >>> 8}.${high & 255}.${low >>> 8}.${low & 255}`);
  }
  if (isIP(address) === 4) {
    const [a,b,c] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && (b === 0 || b === 168 || b === 2 || b === 88 && c === 99))
      || (a === 198 && (b === 18 || b === 19 || b === 51 && c === 100))
      || (a === 203 && b === 0 && c === 113);
  }
  if (isIP(address) !== 6) return true;
  const groups = address.split(":"),first = Number.parseInt(groups[0] || "0",16),second = Number.parseInt(groups[1] || "0",16);
  return first < 0x2000 || first > 0x3fff || first === 0x2002 || first === 0x3fff
    || first === 0x2001 && (second < 0x0200 || second === 0x0db8);
}

function trustedEndpoint(rawEndpoint: string | undefined, rawAllowlist: string | undefined) {
  if (!rawEndpoint) return null;
  let endpoint: URL; try { endpoint = new URL(rawEndpoint); } catch { return null; }
  const allowed = (rawAllowlist ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || endpoint.port && endpoint.port !== "443" || !allowed.includes(endpoint.href)) return null;
  const host = endpoint.hostname.toLowerCase().replace(/^\[|\]$/g,"");
  if (!isIP(host) || nonGlobalAddress(host)) return null;
  return endpoint.href;
}

function validMailbox(value: string | undefined): value is string {
  return Boolean(value && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value));
}

export function notificationText(job: NotificationDeliveryJob, env: DeliveryEnvironment): string {
  if (!job.ctaPath) return job.body;
  const base = env.NEXT_PUBLIC_APP_URL;
  if (!base || !job.ctaPath.startsWith("/") || job.ctaPath.startsWith("//") || /[\\\r\n]/u.test(job.ctaPath)) return job.body;
  try {
    const origin = new URL(base);
    const target = new URL(job.ctaPath, origin);
    if (origin.protocol !== "https:" || target.origin !== origin.origin) return job.body;
    return `${job.body}\n\n${target.href}`;
  } catch { return job.body; }
}

function resendRequest(job: NotificationDeliveryJob, env: DeliveryEnvironment): EmailProviderRequest | null {
  const token = env.RESEND_API_KEY?.trim();
  const fromEmail = env.RESEND_FROM_EMAIL?.trim();
  const fromName = env.RESEND_FROM_NAME?.trim();
  if (!token || token.length < 24 || !validMailbox(fromEmail)) return null;
  if (fromName && (fromName.length > 120 || /[\r\n]/u.test(fromName))) return null;
  return {
    endpoint: "https://api.resend.com/emails",
    token,
    adapter: "EMAIL_RESEND",
    body: {
      from: fromName ? `${fromName} <${fromEmail}>` : fromEmail,
      to: [job.recipientEmail],
      subject: job.subject,
      text: notificationText(job, env),
      headers: { "X-Entity-Ref-ID": job.providerIdempotencyKey },
    },
  };
}

function genericProviderRequest(job: NotificationDeliveryJob, env: DeliveryEnvironment): EmailProviderRequest | null {
  const endpoint = trustedEndpoint(env.EMAIL_PROVIDER_ENDPOINT, env.EMAIL_PROVIDER_ENDPOINT_ALLOWLIST);
  const token = env.EMAIL_PROVIDER_TOKEN?.trim();
  if (!endpoint || !token || token.length < 24) return null;
  return {
    endpoint,
    token,
    adapter: "EMAIL_EXTERNAL",
    body: { to: job.recipientEmail, subject: job.subject, text: job.body, locale: job.locale, ctaPath: job.ctaPath },
  };
}

async function providerMessageId(response: Response, adapter: EmailProviderRequest["adapter"]): Promise<string | null> {
  if (adapter === "EMAIL_EXTERNAL") return response.headers.get("x-message-id");
  try {
    const parsed: unknown = await response.json();
    if (!parsed || typeof parsed !== "object" || typeof (parsed as { id?: unknown }).id !== "string") return null;
    return (parsed as { id: string }).id;
  } catch {
    return null;
  }
}

export async function deliverNotification(job: NotificationDeliveryJob, dependencies: Dependencies): Promise<NotificationDeliveryResult> {
  if (job.channel === "IN_APP") return { outcome: "DELIVERED", providerMessageId: `in-app-${job.deliveryId}`, evidence: { adapter: "IN_APP" } };
  if (!job.recipientEmail || !job.providerIdempotencyKey) return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_RECIPIENT_INVALID", evidence: { adapter: "EMAIL" } };
  const mode = dependencies.env.EMAIL_DELIVERY_MODE;
  if (mode === "DEMO") return (dependencies.env.NODE_ENV === "production" || dependencies.env.APP_ENV?.trim().toLowerCase() === "production")
    ? { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_DEMO_FORBIDDEN", evidence: { adapter: "EMAIL" } }
    : { outcome: "DELIVERED", providerMessageId: demoMessageId(job), evidence: { adapter: "EMAIL_DEMO", deterministic: true } };
  if (!mode) return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_MODE_UNCONFIGURED", evidence: { adapter: "EMAIL" } };
  if (mode !== "EXTERNAL" || dependencies.env.EMAIL_LIVE_DELIVERY_ENABLED !== "true") return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_LIVE_DISABLED", evidence: { adapter: "EMAIL" } };
  if (!allowedRecipient(job.recipientEmail, dependencies.env.EMAIL_RECIPIENT_ALLOWLIST)) return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_RECIPIENT_NOT_ALLOWLISTED", evidence: { adapter: "EMAIL", allowlist: false } };
  const provider = resendRequest(job, dependencies.env) ?? genericProviderRequest(job, dependencies.env);
  if (!provider) return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_PROVIDER_NOT_CONFIGURED", evidence: { adapter: "EMAIL" } };
  try {
    const response = await dependencies.fetch(provider.endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${provider.token}`, "content-type": "application/json", "idempotency-key": job.providerIdempotencyKey },
      body: JSON.stringify(provider.body),
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
    if (response.ok) {
      const messageId = await providerMessageId(response, provider.adapter);
      if (!messageId || messageId.length < 3 || messageId.length > 200 || /[\u0000-\u001f\u007f]/u.test(messageId)) return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_PROVIDER_RECONCILIATION_REQUIRED", evidence: { adapter: provider.adapter } };
      return { outcome: "SENT", providerMessageId: messageId, evidence: { adapter: provider.adapter, accepted: true, deliveryConfirmed: false, recipientHash: createHash("sha256").update(job.recipientEmail.trim().toLowerCase()).digest("hex") } };
    }
    if (response.status === 408 || response.status === 425 || response.status === 429 || response.status >= 500) return { outcome: "RETRYABLE_FAILURE", errorCode: `EMAIL_PROVIDER_${response.status}`, evidence: { adapter: provider.adapter } };
    return { outcome: "PERMANENT_FAILURE", errorCode: `EMAIL_PROVIDER_${response.status}`, evidence: { adapter: provider.adapter } };
  } catch {
    return { outcome: "PERMANENT_FAILURE", errorCode: "EMAIL_PROVIDER_RECONCILIATION_REQUIRED", evidence: { adapter: provider.adapter } };
  }
}
