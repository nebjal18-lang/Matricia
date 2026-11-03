import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { register } from 'node:module';
register(new URL('./typescript-resolution.mjs', import.meta.url), import.meta.url);
const { createWorkerDispatcher } = await import('../../apps/worker/src/dispatcher.ts');
const { pollOutboxOnce } = await import('../../apps/worker/src/poller.ts');

async function fixture(handler) {
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return { url: new URL(`http://127.0.0.1:${server.address().port}/dispatch`), close: () => new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}
const envelope = () => ({ id: randomUUID(), eventType: 'IntegrationTransportV1', aggregateId: randomUUID(), occurredAt: new Date().toISOString(), correlationId: randomUUID(), payload: { amountMinor: '9007199254740993' } });

test('outbox HTTP integration preserves envelope, authorization and correlation before acknowledgement', async () => {
  const event = envelope();
  const secret = randomUUID();
  let received;
  const service = await fixture(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    received = { auth: request.headers.authorization, correlation: request.headers['x-correlation-id'], method: request.method, body: JSON.parse(Buffer.concat(chunks).toString()) };
    response.statusCode = 202; response.setHeader('x-matricia-outbox-consumer', 'TERMINAL_OBSERVABILITY'); response.end();
  });
  const published = [], failed = [];
  const repository = { claim: async () => [event], markPublished: async id => published.push(id), recordFailure: async id => failed.push(id) };
  try {
    const dispatcher = createWorkerDispatcher({ dispatchUrl: service.url, webhookSecret: secret, documentScanConsumer: { consume: async () => null } });
    assert.deepEqual(await pollOutboxOnce(repository, dispatcher, 'integration-worker'), { claimed: 1, published: 1, failed: 0 });
    assert.equal(received.auth, `Bearer ${secret}`); assert.equal(received.correlation, event.correlationId);
    assert.equal(received.method, 'POST'); assert.deepEqual(received.body, event); assert.deepEqual(published, [event.id]); assert.deepEqual(failed, []);
  } finally { await service.close(); }
});

test('HTTP rejection records failure without publication; explicit retry keeps the same event identity', async () => {
  const event = envelope(); let attempts = 0; const ids = [];
  const service = await fixture(async (request, response) => {
    const chunks = []; for await (const chunk of request) chunks.push(chunk);
    ids.push(JSON.parse(Buffer.concat(chunks).toString()).id);
    response.statusCode = ++attempts === 1 ? 503 : 202; response.setHeader('x-matricia-outbox-consumer', 'TERMINAL_OBSERVABILITY'); response.end();
  });
  const published = [], failed = [];
  const repository = { claim: async () => [event], markPublished: async id => published.push(id), recordFailure: async (id, worker, code) => failed.push({ id, worker, code }) };
  try {
    const dispatcher = createWorkerDispatcher({ dispatchUrl: service.url, webhookSecret: randomUUID(), documentScanConsumer: { consume: async () => null } });
    assert.deepEqual(await pollOutboxOnce(repository, dispatcher, 'integration-worker'), { claimed: 1, published: 0, failed: 1 });
    assert.deepEqual(published, []); assert.equal(failed[0].code, 'OUTBOX_DISPATCH_FAILED');
    assert.deepEqual(await pollOutboxOnce(repository, dispatcher, 'integration-worker'), { claimed: 1, published: 1, failed: 0 });
    assert.deepEqual(ids, [event.id, event.id]); assert.deepEqual(published, [event.id]);
  } finally { await service.close(); }
});


test('HTTP 202 without the required consumer acknowledgement never publishes the event', async () => {
  const event = envelope();
  const service = await fixture(async (request, response) => {
    for await (const chunk of request) void chunk;
    response.statusCode = 202; response.end();
  });
  const published = [], failed = [];
  const repository = { claim: async () => [event], markPublished: async id => published.push(id), recordFailure: async (id, worker, code) => failed.push({id, worker, code}) };
  try {
    const dispatcher = createWorkerDispatcher({dispatchUrl:service.url,webhookSecret:randomUUID(),documentScanConsumer:{consume:async()=>null}});
    assert.deepEqual(await pollOutboxOnce(repository, dispatcher, 'integration-worker'), {claimed:1,published:0,failed:1});
    assert.deepEqual(published, []);
    assert.deepEqual(failed, [{id:event.id,worker:'integration-worker',code:'OUTBOX_CONSUMER_ACK_INVALID'}]);
  } finally { await service.close(); }
});
