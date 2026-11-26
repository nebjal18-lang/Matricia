import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { demoPersonaEmail } from "./demo-policy";

type DemoFranchiseAdmin = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;
};

/** Same deterministic UUID scheme as scripts/provision-demo-franchise-persona.mjs */
export function demoFranchiseUuid(seed: string): string {
  const chars = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16]!, 16) & 3) | 8).toString(16);
  return `${chars.slice(0, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12, 16).join("")}-${chars.slice(16, 20).join("")}-${chars.slice(20).join("")}`;
}

type DemoProjectRefEnv = {
  SUPABASE_PROJECT_REF?: string | undefined;
  NEXT_PUBLIC_SUPABASE_PROJECT_REF?: string | undefined;
  NEXT_PUBLIC_SUPABASE_URL?: string | undefined;
};

export function resolveDemoProjectRef(env: DemoProjectRefEnv = process.env as DemoProjectRefEnv): string | null {
  const fromEnv = env.SUPABASE_PROJECT_REF?.trim() || env.NEXT_PUBLIC_SUPABASE_PROJECT_REF?.trim();
  if (fromEnv) return fromEnv;
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (url) {
    try {
      const host = new URL(url).hostname;
      const match = /^([a-z0-9]+)\.supabase\.co$/i.exec(host);
      if (match?.[1]) return match[1];
    } catch {
      // ignore malformed URL; fall through to metadata file
    }
  }
  try {
    const metadata = JSON.parse(readFileSync(resolve(process.cwd(), "../../supabase/project-metadata.json"), "utf8")) as {
      project_ref?: string;
    };
    if (typeof metadata.project_ref === "string" && metadata.project_ref.trim()) return metadata.project_ref.trim();
  } catch {
    try {
      const metadata = JSON.parse(readFileSync(resolve(process.cwd(), "supabase/project-metadata.json"), "utf8")) as {
        project_ref?: string;
      };
      if (typeof metadata.project_ref === "string" && metadata.project_ref.trim()) return metadata.project_ref.trim();
    } catch {
      return null;
    }
  }
  return null;
}

export function demoFranchisePersonaIds(projectRef: string) {
  const operatorOrg = demoFranchiseUuid(`${projectRef}:demo:franchise:operator-org`);
  return {
    organizationId: operatorOrg,
    membershipId: demoFranchiseUuid(`${operatorOrg}:membership`),
    franchiseId: demoFranchiseUuid(`${projectRef}:demo:franchise:franchise`),
    territoryVersionId: demoFranchiseUuid(`${projectRef}:demo:franchise:territory:v1`),
    mandateVersionId: demoFranchiseUuid(`${projectRef}:demo:franchise:mandate:v1`),
    catalogMandateId: demoFranchiseUuid(`${projectRef}:demo:franchise:catalog-mandate`),
  };
}

/**
 * Attache org + mandat ACTIVE + ACL catalogue pour le persona franchisé global.
 * Idempotent ; service_role uniquement côté SQL.
 */
export async function ensureDemoFranchisePersona(input: {
  admin: DemoFranchiseAdmin;
  userId: string;
  email?: string;
}): Promise<{ organizationId: string; franchiseId: string } | null> {
  const projectRef = resolveDemoProjectRef();
  if (!projectRef) return null;
  const ids = demoFranchisePersonaIds(projectRef);
  const email = (input.email ?? demoPersonaEmail("franchise")).trim().toLowerCase();
  const attached = await input.admin.rpc("ensure_demo_franchise_persona_v1", {
    p_user_id: input.userId,
    p_organization_id: ids.organizationId,
    p_membership_id: ids.membershipId,
    p_franchise_id: ids.franchiseId,
    p_territory_version_id: ids.territoryVersionId,
    p_mandate_version_id: ids.mandateVersionId,
    p_catalog_mandate_id: ids.catalogMandateId,
    p_email: email,
    p_display_name: "Franchisé · Démo Matricia",
  });
  if (attached.error || !attached.data) return null;
  return { organizationId: ids.organizationId, franchiseId: ids.franchiseId };
}
