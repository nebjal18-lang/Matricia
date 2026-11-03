import { z } from "zod";
import { hasPlatformRole, loadMyPlatformAccess } from "@/modules/shared/lib/account-security/platform-access";
import { publicationUuidSchema, releaseStatusSchema, rollbackInputSchema, type PublicationDashboard, type PublicationResult } from "./model";

const libraryRow = z.object({ id: publicationUuidSchema, code: z.string().min(2).max(80), status: z.string().min(2).max(30), row_version: z.number().int().positive(), current_release_id: publicationUuidSchema.nullable() }).strict();
const releaseRow = z.object({
  id: publicationUuidSchema, library_id: publicationUuidSchema, release_key: z.string().min(3).max(120), status: releaseStatusSchema,
  snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/u).nullable(), based_on_release_id: publicationUuidSchema.nullable(), rollback_target_release_id: publicationUuidSchema.nullable(),
  requires_central_approval: z.boolean(), effective_from: z.string().min(10), created_at: z.string().min(10), approved_at: z.string().min(10).nullable(),
  published_at: z.string().min(10).nullable(), retired_at: z.string().min(10).nullable(), row_version: z.number().int().positive(),
}).strict();
const rollbackOutput = z.object({ outcome: z.literal("CATALOG_ROLLBACK_SCHEDULED"), release_id: publicationUuidSchema, rollback_target_release_id: publicationUuidSchema, snapshot_hash: z.string().regex(/^[0-9a-f]{64}$/u) }).strict();
const catalogueRoles = ["SUPER_ADMIN", "MATRICIA_ADMIN", "LIBRARY_MANAGER"] as const;
const rollbackRoles = new Set(["SUPER_ADMIN", "MATRICIA_ADMIN"]);

async function accessContext() {
  const access = await loadMyPlatformAccess();
  if (access.status === "error") return { status: "error", reason: access.reason === "UNAUTHENTICATED" ? "UNAUTHENTICATED" : access.reason === "INVALID_RESPONSE" ? "INVALID_RESPONSE" : "UNAVAILABLE" } as const;
  if (!hasPlatformRole(access.roles, catalogueRoles)) return { status: "error", reason: "FORBIDDEN" } as const;
  const aal = access.requirementSatisfied ? "aal2" : "aal1";
  return { status: "success", client: access.client, aal, canRollback: aal === "aal2" && [...access.roles].some((role) => rollbackRoles.has(role)) } as const;
}

async function readPublicationSnapshot(client: Extract<Awaited<ReturnType<typeof accessContext>>, { status: "success" }>["client"]) {
  const librariesQuery = await client.from("catalog_libraries").select("id,code,status,row_version,current_release_id").order("code").limit(11);
  if (librariesQuery.error) return { status: "error" as const, reason: librariesQuery.error.code === "42501" ? "FORBIDDEN" as const : "UNAVAILABLE" as const };
  const libraries = z.array(libraryRow).max(11).safeParse(librariesQuery.data);
  if (!libraries.success || libraries.data.length > 10) return { status: "error" as const, reason: "INVALID_RESPONSE" as const };
  const libraryIds = libraries.data.map((library) => library.id);
  const releasesQuery = libraryIds.length === 0 ? { data: [], error: null } : await client.from("catalog_releases")
    .select("id,library_id,release_key,status,snapshot_hash,based_on_release_id,rollback_target_release_id,requires_central_approval,effective_from,created_at,approved_at,published_at,retired_at,row_version")
    .in("library_id", libraryIds).order("created_at", { ascending: false }).limit(201);
  if (releasesQuery.error) return { status: "error" as const, reason: releasesQuery.error.code === "42501" ? "FORBIDDEN" as const : "UNAVAILABLE" as const };
  const releases = z.array(releaseRow).max(201).safeParse(releasesQuery.data);
  if (!releases.success || releases.data.some((release) => !libraryIds.includes(release.library_id))) return { status: "error" as const, reason: "INVALID_RESPONSE" as const };
  const visibleReleases = releases.data.slice(0, 200);
  return { status: "success" as const, historyTruncated: releases.data.length > 200, libraries: libraries.data.map((library) => ({
    id: library.id, code: library.code, status: library.status, rowVersion: library.row_version, currentReleaseId: library.current_release_id,
    releases: visibleReleases.filter((release) => release.library_id === library.id).map((release) => ({
      id: release.id, libraryId: release.library_id, releaseKey: release.release_key, status: release.status, snapshotHash: release.snapshot_hash,
      basedOnReleaseId: release.based_on_release_id, rollbackTargetReleaseId: release.rollback_target_release_id,
      requiresCentralApproval: release.requires_central_approval, effectiveFrom: release.effective_from, createdAt: release.created_at,
      approvedAt: release.approved_at, publishedAt: release.published_at, retiredAt: release.retired_at, rowVersion: release.row_version,
    })),
  })) };
}

export async function loadPublicationDashboard(): Promise<PublicationResult<PublicationDashboard>> {
  const access = await accessContext();
  if (access.status === "error") return access;
  const snapshot = await readPublicationSnapshot(access.client);
  if (snapshot.status === "error") return snapshot;
  return { status: "success", value: { aal: access.aal, canRollback: access.canRollback, historyTruncated: snapshot.historyTruncated, libraries: snapshot.libraries } };
}

export async function rollbackCatalogRelease(input: unknown): Promise<PublicationResult<{ releaseId: string }>> {
  const parsed = rollbackInputSchema.safeParse(input);
  if (!parsed.success) return { status: "error", reason: "INVALID_INPUT" };
  const access = await accessContext();
  if (access.status === "error") return access;
  if (access.aal !== "aal2") return { status: "error", reason: "AAL2_REQUIRED" };
  if (!access.canRollback) return { status: "error", reason: "FORBIDDEN" };
  const value = parsed.data;
  const [libraryQuery, targetQuery] = await Promise.all([
    access.client.from("catalog_libraries").select("id,current_release_id,row_version").eq("id", value.libraryId).limit(1).maybeSingle(),
    access.client.from("catalog_releases").select("id,library_id,status").eq("id", value.targetReleaseId).eq("library_id", value.libraryId).in("status", ["PUBLISHED", "RETIRED"]).limit(1).maybeSingle(),
  ]);
  if (libraryQuery.error || targetQuery.error) return { status: "error", reason: "UNAVAILABLE" };
  if (!libraryQuery.data || !targetQuery.data || libraryQuery.data.current_release_id === value.targetReleaseId) return { status: "error", reason: "INVALID_INPUT" };
  if (libraryQuery.data.row_version !== value.expectedLibraryRowVersion) return { status: "error", reason: "CONFLICT" };
  const response = await access.client.rpc("rollback_catalog_release", {
    p_library_id: value.libraryId, p_target_release_id: value.targetReleaseId, p_release_key: value.releaseKey,
    p_expected_library_row_version: value.expectedLibraryRowVersion, p_idempotency_key: value.idempotencyKey, p_correlation_id: value.correlationId,
  });
  if (response.error) {
    if (response.error.code === "42501") return { status: "error", reason: /AAL|MFA/i.test(response.error.message ?? "") ? "AAL2_REQUIRED" : "FORBIDDEN" };
    if (["23505", "40001", "55000"].includes(response.error.code ?? "")) return { status: "error", reason: "CONFLICT" };
    return { status: "error", reason: "UNAVAILABLE" };
  }
  const output = rollbackOutput.safeParse(response.data);
  if (!output.success || output.data.rollback_target_release_id !== value.targetReleaseId) return { status: "error", reason: "INVALID_RESPONSE" };
  return { status: "success", value: { releaseId: output.data.release_id } };
}
