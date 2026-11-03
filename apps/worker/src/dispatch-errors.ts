export class OutboxDependencyUnavailableError extends Error {
  constructor() { super("ANTIVIRUS_UNAVAILABLE"); this.name = "OutboxDependencyUnavailableError"; }
}

export class OutboxAcknowledgementError extends Error {
  constructor() { super("OUTBOX_CONSUMER_ACK_INVALID"); this.name = "OutboxAcknowledgementError"; }
}
