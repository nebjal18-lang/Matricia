import { describe, expect, it, vi } from "vitest";
import { OutboxDependencyUnavailableError } from "./dispatch-errors";
import { pollOutboxOnce } from "./poller";
import type { OutboxRepository } from "./outbox-repository";

const events = [{ id: "10", eventType: "OrganizationCreatedV1", aggregateId: "org-1", occurredAt: "2026-09-11T12:00:00Z", correlationId: "corr-1", payload: {} }];

describe("pollOutboxOnce", () => {
  it("claim, délivre et acquitte avec le même worker", async () => {
    const repository: OutboxRepository = { claim: vi.fn(async () => events), markPublished: vi.fn(async () => undefined), recordFailure: vi.fn(async () => undefined) };
    const dispatcher = { dispatch: vi.fn(async () => undefined) };
    await expect(pollOutboxOnce(repository, dispatcher, "worker-1")).resolves.toEqual({ claimed: 1, published: 1, failed: 0 });
    expect(repository.markPublished).toHaveBeenCalledWith("10", "worker-1");
    expect(repository.recordFailure).not.toHaveBeenCalled();
  });

  it("enregistre l’échec sans acquitter l’événement", async () => {
    const repository: OutboxRepository = { claim: vi.fn(async () => events), markPublished: vi.fn(async () => undefined), recordFailure: vi.fn(async () => undefined) };
    const dispatcher = { dispatch: vi.fn(async () => { throw new Error("down"); }) };
    await expect(pollOutboxOnce(repository, dispatcher, "worker-2")).resolves.toEqual({ claimed: 1, published: 0, failed: 1 });
    expect(repository.recordFailure).toHaveBeenCalledWith("10", "worker-2", "OUTBOX_DISPATCH_FAILED");
    expect(repository.markPublished).not.toHaveBeenCalled();
  });
});

it("defers a document outage without exhausting attempts while an invitation proceeds", async () => {
  const pending = [{ ...events[0]!, id: "10", eventType: "DocumentUploadedV1" }, { ...events[0]!, id: "11", eventType: "OrganizationEmailInvitationRequestedV1" }];
  const repository: OutboxRepository = { claim: vi.fn(async () => pending), deferDependency: vi.fn(async () => {}), markPublished: vi.fn(async () => {}), recordFailure: vi.fn(async () => {}) };
  const dispatcher = { dispatch: vi.fn(async (event) => { if (event.eventType === "DocumentUploadedV1") throw new OutboxDependencyUnavailableError(); }) };
  await expect(pollOutboxOnce(repository, dispatcher, "worker-1")).resolves.toEqual({ claimed: 2, published: 1, failed: 1 });
  expect(repository.deferDependency).toHaveBeenCalledWith("10", "worker-1"); expect(repository.recordFailure).not.toHaveBeenCalled(); expect(repository.markPublished).toHaveBeenCalledWith("11", "worker-1");
});
