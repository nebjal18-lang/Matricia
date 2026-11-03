import { OutboxAcknowledgementError, OutboxDependencyUnavailableError } from "./dispatch-errors";
import type { OutboxDispatcher } from "./index";
import type { OutboxRepository } from "./outbox-repository";

export type PollResult = Readonly<{ claimed: number; published: number; failed: number }>;

export async function pollOutboxOnce(repository: OutboxRepository, dispatcher: OutboxDispatcher, workerId: string, limit = 50): Promise<PollResult> {
  const events = await repository.claim(workerId, limit);
  let published = 0;
  let failed = 0;
  for (const event of events) {
    try {
      await dispatcher.dispatch(event);
      await repository.markPublished(event.id, workerId);
      published += 1;
    } catch (error) {
      if (error instanceof OutboxDependencyUnavailableError && repository.deferDependency) await repository.deferDependency(event.id, workerId);
      else await repository.recordFailure(event.id, workerId, error instanceof OutboxAcknowledgementError ? "OUTBOX_CONSUMER_ACK_INVALID" : "OUTBOX_DISPATCH_FAILED");
      failed += 1;
    }
  }
  return Object.freeze({ claimed: events.length, published, failed });
}
