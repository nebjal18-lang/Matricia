import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ access: vi.fn(), role: vi.fn(), rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/modules/shared/lib/account-security/platform-access", () => ({ loadMyPlatformAccess: mocks.access, hasPlatformRole: mocks.role }));
vi.mock("@/modules/admin/data/spaces/demo-hubs", () => ({ canApplyAdminDemoHubs: () => false, buildDemoFinanceDashboard: vi.fn() }));
import { reconcileAdminProviderPayment } from "./repository";

const id = "11111111-1111-4111-8111-111111111111";
const invoiceId = "22222222-2222-4222-8222-222222222222";
const input = { paymentId: id, invoiceId, amountMinor: "100", idempotencyKey: id, correlationId: id };
let payment: { id: string; provider_organization_id: string; currency: string; amount_minor: string };
let invoice: { id: string; provider_organization_id: string; currency: string; outstanding_minor: string };
let allocations: { amount_minor: string }[];

beforeEach(() => {
  vi.clearAllMocks();
  payment = { id, provider_organization_id: id, currency: "MAD", amount_minor: "1000" };
  invoice = { id: invoiceId, provider_organization_id: id, currency: "MAD", outstanding_minor: "900" };
  allocations = [{ amount_minor: "100" }];
  mocks.access.mockResolvedValue({ status: "success", roles: ["FINANCE_MANAGER"], requirementSatisfied: true, client: { from: mocks.from, rpc: mocks.rpc } });
  mocks.role.mockReturnValue(true);
  mocks.rpc.mockResolvedValue({ data: { outcome: "PROVIDER_PAYMENT_RECONCILED", payment_id: id, reconciliation_batch_id: id, allocated_minor: "100", unallocated_minor: "800" }, error: null });
  mocks.from.mockImplementation((table: string) => {
    const response = () => Promise.resolve({ data: table === "provider_payments" ? payment : table === "provider_invoice_balances" ? invoice : allocations, error: null });
    const query = { select() { return query; }, eq() { return query; }, limit() { return query; }, maybeSingle: response, then: (...args: Parameters<ReturnType<typeof response>["then"]>) => response().then(...args) };
    return query;
  });
});

describe("provider payment reconciliation boundaries", () => {
  it("sends exact minor units to the transactional command", async () => {
    expect(await reconcileAdminProviderPayment(input)).toEqual({ status: "success", value: { batchId: id } });
    expect(mocks.rpc).toHaveBeenCalledWith("reconcile_provider_payment", expect.objectContaining({ p_allocations: [{ invoice_id: invoiceId, amount_minor: "100" }], p_idempotency_key: id }));
  });
  it.each(["currency", "provider_organization_id"] as const)("rejects mismatched %s before mutation", async (field) => {
    invoice[field] = field === "currency" ? "EUR" : invoiceId;
    expect(await reconcileAdminProviderPayment(input)).toEqual({ status: "error", reason: "INVALID_INPUT" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses an amount beyond the unallocated balance", async () => {
    allocations = [{ amount_minor: "950" }];
    expect(await reconcileAdminProviderPayment(input)).toEqual({ status: "error", reason: "CONFLICT" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("refuses partial allocation reads", async () => {
    allocations = Array.from({ length: 201 }, () => ({ amount_minor: "1" }));
    expect(await reconcileAdminProviderPayment(input)).toEqual({ status: "error", reason: "UNAVAILABLE" });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires current MFA before reading financial data", async () => {
    mocks.access.mockResolvedValue({ status: "success", roles: ["FINANCE_MANAGER"], requirementSatisfied: false });
    expect(await reconcileAdminProviderPayment(input)).toEqual({ status: "error", reason: "MFA_REQUIRED" });
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["allocated_minor", "unallocated_minor"])("rejects an inexact numeric receipt field %s", async (field) => {
    mocks.rpc.mockResolvedValue({ data: { outcome: "PROVIDER_PAYMENT_RECONCILED", payment_id: id, reconciliation_batch_id: id, allocated_minor: "100", unallocated_minor: "800", [field]: 9007199254740992 }, error: null });
    expect(await reconcileAdminProviderPayment(input)).toEqual({ status: "error", reason: "INVALID_RESPONSE" });
  });
});
