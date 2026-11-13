import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import { resolve } from "node:path";
import { resolvePublicSupabaseEnvironment } from "./modules/shared/lib/public-supabase-environment";
import { paymentFormActionPolicy } from "./modules/shared/lib/payment-form-policy";

loadEnvConfig(resolve(import.meta.dirname, "../.."), process.env.NODE_ENV !== "production", console, true);

const {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
} = resolvePublicSupabaseEnvironment({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  SUPABASE_URL: process.env.SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
});

const supabaseOrigin = new URL(supabaseUrl).origin;
const isProduction = process.env.NODE_ENV === "production";
const isVercelPreview = process.env.VERCEL_ENV === "preview";
const vercelLive = "https://vercel.live";
const allowVercelLive = !isProduction || isVercelPreview;
const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'none'",
  paymentFormActionPolicy({PAYMENT_PROVIDER:process.env.PAYMENT_PROVIDER,CMI_GATEWAY_URL:process.env.CMI_GATEWAY_URL,CMI_GATEWAY_ALLOWED_HOSTS:process.env.CMI_GATEWAY_ALLOWED_HOSTS}),
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}${allowVercelLive ? ` ${vercelLive}` : ""}`,
  `connect-src 'self' ${supabaseOrigin}${isProduction ? "" : " ws: wss:"}${allowVercelLive ? ` ${vercelLive}` : ""}`,
  `frame-src 'self'${allowVercelLive ? ` ${vercelLive}` : ""}`,
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "x-vercel-skip-toolbar", value: "1" },
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
] as const;

const longLivedAssetCache = [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] as const;

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Preview comments patch static files after upload. Immutable assets reject that patch.
  supportsImmutableAssets: false,
  serverExternalPackages:["pdfmake","@fontsource/noto-sans-arabic"],
  outputFileTracingIncludes:{
    "/api/**":["./node_modules/@fontsource/noto-sans-arabic/package.json","./node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-latin-400-normal.woff","./node_modules/@fontsource/noto-sans-arabic/files/noto-sans-arabic-arabic-400-normal.woff"],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui", "date-fns", "recharts", "@base-ui/react"],
    // Transport headroom only; the server action still enforces the 10 MiB document policy.
    serverActions: { bodySizeLimit: "12mb" },
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabasePublishableKey,
  },
  async headers() {
    // Immutable static caching breaks Turbopack HMR in local/dev (stale JS/CSS).
    const assetCache = isProduction ? longLivedAssetCache : [{ key: "Cache-Control", value: "no-store" }] as const;
    return [
      { source: "/:path*", headers: [...securityHeaders] },
      { source: "/_next/static/:path*", headers: [...assetCache] },
      { source: "/home-v2/:path*", headers: [...longLivedAssetCache] },
      { source: "/scenes/:path*", headers: [...longLivedAssetCache] },
      { source: "/favicon.svg", headers: [...longLivedAssetCache] },
      { source: "/social-card.svg", headers: [...longLivedAssetCache] },
    ];
  },
  async rewrites() {
    return [{ source: "/favicon.ico", destination: "/favicon.svg" }];
  },
};

export default nextConfig;
