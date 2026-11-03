import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import { randomUUID } from 'node:crypto';
import postgres from 'postgres';
import { prepareSqlTest } from './db-test-support.mjs';

function parseEnv(source) {
  return Object.fromEntries(source.split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match) return [];
    return [[match[1], match[2].replace(/^(['"])(.*)\1$/, '$2')]];
  }));
}

async function resolveDatabaseUrl(env, root) {
  const configured = env.SUPABASE_DB_POOLER_URL || env.DIRECT_URL;
  if (!configured?.startsWith('postgres')) throw new Error('A PostgreSQL DIRECT_URL is required');
  const direct = new URL(configured);
  if (!direct.hostname.startsWith('db.') || !direct.hostname.endsWith('.supabase.co')) return configured;

  const projectRef = new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split('.')[0];
  let region = env.SUPABASE_REGION;
  try {
    const metadata = JSON.parse(await readFile(resolve(root, 'supabase', 'project-metadata.json'), 'utf8'));
    if (metadata.project_ref === projectRef && metadata.environment !== 'production') region ||= metadata.region;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (!region && env.SUPABASE_ACCESS_TOKEN) {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}`, {
      headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}` },
    });
    if (!response.ok) throw new Error(`Supabase project metadata failed (${response.status})`);
    region = (await response.json()).region;
  }
  if (!region) throw new Error('SUPABASE_REGION is required when the direct host is IPv6-only');

  direct.hostname = `aws-0-${region}.pooler.supabase.com`;
  direct.port = '5432';
  direct.username = `postgres.${projectRef}`;
  direct.searchParams.set('sslmode', 'require');
  return direct.toString();
}

function tapLines(value, target = []) {
  if (Array.isArray(value)) for (const item of value) tapLines(item, target);
  else if (value && typeof value === 'object') for (const item of Object.values(value)) tapLines(item, target);
  else if (typeof value === 'string') {
    for (const rawLine of value.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (/^(?:not )?ok\b|^1\.\.\d+\b|^Bail out!|^#/i.test(line)) target.push(line);
    }
  }
  return target;
}

function validateTap(file, lines) {
  const bailOut = lines.find((line) => /^Bail out!/i.test(line));
  if (bailOut) throw new Error(`${file}: ${bailOut}`);

  const plans = lines.filter((line) => /^1\.\.\d+\b/.test(line));
  if (plans.length !== 1) throw new Error(`${file}: expected exactly one TAP plan, received ${plans.length}`);

  const planned = Number.parseInt(plans[0].match(/^1\.\.(\d+)/)?.[1] ?? '', 10);
  const assertionLines = lines.filter((line) => /^(?:not )?ok\b/.test(line));
  if (!Number.isSafeInteger(planned) || planned < 1) throw new Error(`${file}: invalid TAP plan ${plans[0]}`);
  if (assertionLines.length !== planned) {
    throw new Error(`${file}: TAP plan requires ${planned} assertions, received ${assertionLines.length}`);
  }

  const numbered = assertionLines.map((line) => Number.parseInt(line.match(/^(?:not )?ok\s+(\d+)\b/)?.[1] ?? '', 10));
  if (numbered.some((number, index) => number !== index + 1)) {
    throw new Error(`${file}: TAP assertion numbers are missing, duplicated, or out of order`);
  }

  if (assertionLines.some(line => /#\s*(?:SKIP|TODO)\b/i.test(line))) {
    throw new Error(`${file}: skipped or TODO SQL assertions cannot satisfy acceptance`);
  }

  const failures = assertionLines.filter((line) => line.startsWith('not ok'));
  if (failures.length) {
    const diagnostics = lines.filter((line) => line.startsWith('#'));
    throw new Error(`${file}: ${[...failures, ...diagnostics].join(' | ')}`);
  }
  return planned;
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

async function expectBlocked(promise, label) {
  let settled = false;
  promise.finally(() => { settled = true; }).catch(() => {});
  await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  if (settled) throw new Error(`${label} did not overlap the first open transaction`);
}

function unwrap(result) {
  if (result.status === 'rejected') throw result.reason;
  return result.value;
}

async function verifyOutboxConcurrency(databaseUrl, admin) {
  const correlationId = randomUUID();
  const firstWorkerId = randomUUID();
  const secondWorkerId = randomUUID();
  const guardWorkerId = randomUUID();
  const guardReady = deferred();
  const releaseGuard = deferred();
  const rollbackGuard = new Error('ROLLBACK_OUTBOX_TEST_GUARD');
  const rollbackFirst = new Error('ROLLBACK_OUTBOX_TEST_FIRST');
  const rollbackSecond = new Error('ROLLBACK_OUTBOX_TEST_SECOND');
  let queueGuard;
  let workerA;
  let workerB;
  let guardTransaction;
  let eventId;
  let firstTransaction;
  let releaseFirst;
  let announceFirst;
  let rejectFirst;
  let primaryError;
  const lifecycleErrors = [];
  const holdFirst = new Promise((resolveHold) => { releaseFirst = resolveHold; });
  const firstClaimed = new Promise((resolveClaim, rejectClaim) => {
    announceFirst = resolveClaim;
    rejectFirst = rejectClaim;
  });

  try {
    queueGuard = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 0 });
    workerA = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 0 });
    workerB = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 0 });
    guardTransaction = queueGuard.begin(async (transaction) => {
      try {
        await transaction.unsafe('set local role service_role');
        while (true) {
          const guarded = await transaction`
            select id from public.claim_outbox_events(${guardWorkerId}::uuid,500)
          `;
          if (guarded.length === 0) break;
        }
        guardReady.resolve();
        await releaseGuard.promise;
        throw rollbackGuard;
      } catch (error) {
        guardReady.reject(error);
        throw error;
      }
    }).then(
      () => ({ status: 'rejected', reason: new Error('outbox queue guard committed instead of rolling back') }),
      (error) => error === rollbackGuard
        ? { status: 'fulfilled' }
        : { status: 'rejected', reason: error },
    );
    await guardReady.promise;
    const inserted = await admin`
      insert into public.event_outbox (
        aggregate_type,aggregate_id,event_type,correlation_id,payload,available_at
      ) values (
        'security_test',${correlationId},'OutboxConcurrencyTestV1',
        ${correlationId}::uuid,jsonb_build_object('test',true),
        '2000-01-01T00:00:00Z'::timestamptz
      )
      returning id
    `;
    eventId = inserted[0].id;
    firstTransaction = workerA.begin(async (transaction) => {
      try {
        await transaction.unsafe('set local role service_role');
        const claimed = await transaction`
          select id from public.claim_outbox_events(${firstWorkerId}::uuid,1)
        `;
        announceFirst(claimed);
        await holdFirst;
        throw rollbackFirst;
      } catch (error) {
        rejectFirst(error);
        throw error;
      }
    }).then(
      () => ({ status: 'rejected', reason: new Error('first Outbox claim committed instead of rolling back') }),
      (error) => error === rollbackFirst
        ? { status: 'fulfilled' }
        : { status: 'rejected', reason: error },
    );

    const firstRows = await firstClaimed;
    let secondRows;
    try {
      await workerB.begin(async (transaction) => {
        await transaction.unsafe('set local role service_role');
        secondRows = await transaction`
          select id from public.claim_outbox_events(${secondWorkerId}::uuid,1)
        `;
        throw rollbackSecond;
      }).catch((error) => {
        if (error !== rollbackSecond) throw error;
      });
    } finally {
      releaseFirst();
    }
    const firstResult = await firstTransaction;
    if (firstResult.status === 'rejected') throw firstResult.reason;

    if (firstRows.length !== 1 || String(firstRows[0].id) !== String(eventId)) {
      throw new Error('first Outbox worker did not claim the isolated test event');
    }
    if (!secondRows || secondRows.length !== 0) {
      throw new Error('second Outbox worker claimed a row while the first transaction held the isolated event');
    }
  } catch (error) {
    primaryError = error;
  } finally {
    releaseFirst?.();
    releaseGuard.resolve();
    const transactionResults = await Promise.all(
      [firstTransaction, guardTransaction].filter(Boolean),
    );
    for (const result of transactionResults) {
      if (result.status === 'rejected' && result.reason !== primaryError) lifecycleErrors.push(result.reason);
    }
    const closePromises = [];
    for (const client of [workerA, workerB, queueGuard].filter(Boolean)) {
      try {
        closePromises.push(Promise.resolve(client.end()));
      } catch (error) {
        lifecycleErrors.push(error);
      }
    }
    const closeResults = await Promise.allSettled(closePromises);
    for (const result of closeResults) {
      if (result.status === 'rejected') lifecycleErrors.push(result.reason);
    }
    if (eventId !== undefined) {
      try {
        await admin.begin(async (transaction) => {
          await transaction.unsafe('lock table public.event_outbox in access exclusive mode');
          await transaction.unsafe('alter table public.event_outbox disable trigger event_outbox_no_delete');
          const deleted = await transaction`
            delete from public.event_outbox
            where id=${eventId}
              and aggregate_type='security_test'
              and event_type='OutboxConcurrencyTestV1'
            returning id
          `;
          if (deleted.length !== 1) throw new Error('outbox concurrency fixture cleanup did not delete exactly one event');
          await transaction.unsafe('alter table public.event_outbox enable trigger event_outbox_no_delete');
        });
      } catch (error) {
        lifecycleErrors.push(error);
      }
    }
  }
  const errors = [primaryError, ...lifecycleErrors].filter(Boolean);
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1) throw new AggregateError(errors, 'outbox concurrency test and lifecycle failed');
}

async function cleanupFinancialConcurrencyFixture(admin, organizationId, actorId, membershipId) {
  await admin.begin(async (transaction) => {
    await transaction.unsafe('lock table public.event_outbox, public.audit_events, public.financial_entries, public.financial_journals, public.financial_accounts, public.credit_lots, public.credit_ledger_entries, public.credit_wallets in access exclusive mode');
    await transaction.unsafe('alter table public.event_outbox disable trigger event_outbox_no_delete');
    await transaction.unsafe('alter table public.audit_events disable trigger audit_events_immutable');
    await transaction.unsafe('alter table public.financial_entries disable trigger financial_entries_immutable');
    await transaction.unsafe('alter table public.financial_entries disable trigger financial_journal_balanced');
    await transaction.unsafe('alter table public.financial_journals disable trigger financial_journals_immutable');
    await transaction.unsafe('alter table public.financial_accounts disable trigger financial_accounts_immutable');
    await transaction.unsafe('alter table public.credit_lots disable trigger credit_lots_immutable');
    await transaction.unsafe('alter table public.credit_ledger_entries disable trigger credit_ledger_entries_immutable');
    await transaction.unsafe('alter table public.credit_wallets disable trigger credit_wallets_immutable');
    await transaction`delete from public.event_outbox where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.audit_events where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.idempotency_keys where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.financial_entries where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.financial_journals where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.financial_accounts where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.credit_lots where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.credit_ledger_entries where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.credit_wallets where organization_id=${organizationId}::uuid`;
    await transaction`delete from public.organization_member_roles where membership_id=${membershipId}::uuid`;
    await transaction`delete from public.organization_memberships where id=${membershipId}::uuid`;
    await transaction`delete from public.organizations where id=${organizationId}::uuid`;
    await transaction`delete from auth.users where id=${actorId}::uuid`;
    await transaction.unsafe('alter table public.credit_wallets enable trigger credit_wallets_immutable');
    await transaction.unsafe('alter table public.credit_ledger_entries enable trigger credit_ledger_entries_immutable');
    await transaction.unsafe('alter table public.credit_lots enable trigger credit_lots_immutable');
    await transaction.unsafe('alter table public.financial_accounts enable trigger financial_accounts_immutable');
    await transaction.unsafe('alter table public.financial_journals enable trigger financial_journals_immutable');
    await transaction.unsafe('alter table public.financial_entries enable trigger financial_journal_balanced');
    await transaction.unsafe('alter table public.financial_entries enable trigger financial_entries_immutable');
    await transaction.unsafe('alter table public.audit_events enable trigger audit_events_immutable');
    await transaction.unsafe('alter table public.event_outbox enable trigger event_outbox_no_delete');
  });
}

async function cleanupStaleFinancialConcurrencyFixtures(admin) {
  const stale = await admin`
    select organization.id as organization_id,organization.created_by as actor_id,membership.id as membership_id
    from public.organizations organization
    join public.organization_memberships membership
      on membership.organization_id=organization.id and membership.user_id=organization.created_by
    where organization.legal_name='P03 Concurrency SARL'
      and organization.display_name='P03 Concurrency'
  `;
  for (const fixture of stale) {
    await cleanupFinancialConcurrencyFixture(
      admin, fixture.organization_id, fixture.actor_id, fixture.membership_id,
    );
  }
}

async function verifyFinancialConcurrency(databaseUrl, admin) {
  await cleanupStaleFinancialConcurrencyFixtures(admin);
  const fixture = {
    actorId: randomUUID(),
    organizationId: randomUUID(),
    membershipId: randomUUID(),
    debitAccountId: randomUUID(),
    creditAccountId: randomUUID(),
    walletId: randomUUID(),
    journalCorrelationId: randomUUID(),
    creditCorrelationId: randomUUID(),
    auditCorrelationA: randomUUID(),
    auditCorrelationB: randomUUID(),
    journalKey: `p03-journal-${randomUUID()}`,
    creditKey: `p03-credit-${randomUUID()}`,
    effectiveAt: '2026-09-11T12:00:00.000Z',
  };
  const workerA = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 0 });
  const workerB = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 0 });

  async function authenticated(transaction) {
    await transaction.unsafe('set local role authenticated');
    await transaction`select set_config('request.jwt.claim.sub',${fixture.actorId},true)`;
    await transaction`select set_config('request.jwt.claims',${JSON.stringify({ sub: fixture.actorId, role: 'authenticated', aal: 'aal2' })},true)`;
  }

  async function invokeJournal(transaction) {
    await authenticated(transaction);
    return transaction`
      select public.post_financial_journal(
        ${fixture.organizationId}::uuid,${fixture.journalKey},null,'P03_CONCURRENCY','MAD'::char(3),
        ${fixture.effectiveAt}::timestamptz,'P03 two-connection journal',
        ${[
          { account_id: fixture.debitAccountId, direction: 'DEBIT', amount_minor: 9900 },
          { account_id: fixture.creditAccountId, direction: 'CREDIT', amount_minor: 9900 },
        ]}::jsonb,${fixture.journalCorrelationId}::uuid
      ) as id
    `;
  }

  async function invokeCredit(transaction) {
    await authenticated(transaction);
    return transaction`
      select (public.issue_credits(
        ${fixture.organizationId}::uuid,${fixture.walletId}::uuid,'ADMIN_GRANT',17,
        '2027-09-11T12:00:00.000Z'::timestamptz,null,'two-connection-credit',0,
        'P03_TEST','P03_CONCURRENCY',${fixture.creditKey},${fixture.creditCorrelationId}::uuid
      )->>'entry_id')::bigint as id
    `;
  }

  async function runDuplicateRace(invoke, label) {
    const firstReady = deferred();
    const releaseFirst = deferred();
    const first = workerA.begin(async (transaction) => {
      try {
        const rows = await invoke(transaction);
        firstReady.resolve(rows);
        await releaseFirst.promise;
        return rows;
      } catch (error) {
        firstReady.reject(error);
        throw error;
      }
    });
    const firstRows = await firstReady.promise;
    const second = workerB.begin(invoke).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    );
    try {
      await expectBlocked(second, label);
    } finally {
      releaseFirst.resolve();
    }
    const [committedFirst, secondResult] = await Promise.all([first, second]);
    const secondRows = unwrap(secondResult);
    if (String(firstRows[0]?.id) !== String(committedFirst[0]?.id)
      || String(firstRows[0]?.id) !== String(secondRows[0]?.id)) {
      throw new Error(`${label} returned different identifiers for one idempotency key`);
    }
    return String(firstRows[0].id);
  }

  async function runAuditRace() {
    const firstReady = deferred();
    const releaseFirst = deferred();
    const insertAudit = (transaction, correlationId, resourceId) => transaction`
      insert into public.audit_events (
        organization_id,actor_user_id,actor_type,action,resource_type,resource_id,
        correlation_id,metadata,previous_hash,event_hash
      ) values (
        ${fixture.organizationId}::uuid,${fixture.actorId}::uuid,'USER','p03.audit.concurrent',
        'p03_test',${resourceId}::text,${correlationId}::uuid,jsonb_build_object('resource',${resourceId}::text),
        null,repeat('0',64)
      ) returning id,event_hash,previous_hash
    `;
    const first = workerA.begin(async (transaction) => {
      try {
        const rows = await insertAudit(transaction, fixture.auditCorrelationA, 'first');
        firstReady.resolve(rows);
        await releaseFirst.promise;
        return rows;
      } catch (error) {
        firstReady.reject(error);
        throw error;
      }
    });
    const firstRows = await firstReady.promise;
    const second = workerB.begin((transaction) => insertAudit(
      transaction, fixture.auditCorrelationB, 'second',
    )).then(
      (value) => ({ status: 'fulfilled', value }),
      (reason) => ({ status: 'rejected', reason }),
    );
    try {
      await expectBlocked(second, 'audit chain race');
    } finally {
      releaseFirst.resolve();
    }
    await first;
    const secondRows = unwrap(await second);
    if (secondRows[0]?.previous_hash !== firstRows[0]?.event_hash) {
      throw new Error('concurrent audit event did not link to the committed predecessor');
    }
  }

  try {
    await admin.begin(async (transaction) => {
      await transaction`
        insert into auth.users (
          id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,
          raw_app_meta_data,raw_user_meta_data,created_at,updated_at
        ) values (
          ${fixture.actorId}::uuid,'00000000-0000-0000-0000-000000000000',
          'authenticated','authenticated',${`p03-${fixture.actorId}@example.invalid`},'',now(),'{}','{}',now(),now()
        )
      `;
      await transaction`
        insert into public.organizations (id,legal_name,display_name,status,created_by)
        values (${fixture.organizationId}::uuid,'P03 Concurrency SARL','P03 Concurrency','ACTIVE',${fixture.actorId}::uuid)
      `;
      await transaction`
        insert into public.organization_memberships (id,organization_id,user_id,status,activated_at)
        values (${fixture.membershipId}::uuid,${fixture.organizationId}::uuid,${fixture.actorId}::uuid,'ACTIVE',now())
      `;
      await transaction`
        insert into public.organization_member_roles (membership_id,role_code)
        values (${fixture.membershipId}::uuid,'CLIENT_ACCOUNTING')
      `;
      await transaction`
        insert into public.platform_user_roles (user_id,role_code)
        values (${fixture.actorId}::uuid,'SUPER_ADMIN')
      `;
      await transaction`
        insert into public.financial_accounts (id,organization_id,code,name,account_type,currency) values
        (${fixture.debitAccountId}::uuid,${fixture.organizationId}::uuid,'P03-CASH','P03 Cash','ASSET','MAD'),
        (${fixture.creditAccountId}::uuid,${fixture.organizationId}::uuid,'P03-REVENUE','P03 Revenue','REVENUE','MAD')
      `;
      await transaction`
        insert into public.credit_wallets (id,organization_id,wallet_type)
        values (${fixture.walletId}::uuid,${fixture.organizationId}::uuid,'CLIENT')
      `;
    });

    const journalId = await runDuplicateRace(invokeJournal, 'journal duplicate invocation');
    const journalEvidence = await admin`
      select
        (select count(*)::integer from public.financial_journals where organization_id=${fixture.organizationId}::uuid and id=${journalId}::uuid) as journals,
        (select count(*)::integer from public.financial_entries where organization_id=${fixture.organizationId}::uuid and journal_id=${journalId}::uuid) as entries,
        (select count(*)::integer from public.audit_events where organization_id=${fixture.organizationId}::uuid and action='financial.journal.posted') as audits,
        (select count(*)::integer from public.event_outbox where organization_id=${fixture.organizationId}::uuid and event_type='FinancialJournalPostedV1') as outbox
    `;
    if (journalEvidence[0].journals !== 1 || journalEvidence[0].entries !== 2
      || journalEvidence[0].audits !== 1 || journalEvidence[0].outbox !== 1) {
      throw new Error('journal duplicate invocation produced duplicate or incomplete durable effects');
    }

    const creditEntryId = await runDuplicateRace(invokeCredit, 'credit duplicate invocation');
    const creditEvidence = await admin`
      select
        (select count(*)::integer from public.credit_ledger_entries where organization_id=${fixture.organizationId}::uuid and id=${creditEntryId}::bigint) as entries,
        (select balance from public.credit_wallet_balances where organization_id=${fixture.organizationId}::uuid and wallet_id=${fixture.walletId}::uuid) as balance,
        (select count(*)::integer from public.audit_events where organization_id=${fixture.organizationId}::uuid and action='credits.issued') as audits,
        (select count(*)::integer from public.event_outbox where organization_id=${fixture.organizationId}::uuid and event_type='CreditsGrantedV1') as outbox
    `;
    if (creditEvidence[0].entries !== 1 || String(creditEvidence[0].balance) !== '17'
      || creditEvidence[0].audits !== 1 || creditEvidence[0].outbox !== 1) {
      throw new Error('credit duplicate invocation produced duplicate or incomplete durable effects');
    }

    await runAuditRace();
    const auditEvidence = await admin`
      select count(*)::integer as count,
        bool_and(event_hash=encode(extensions.digest(convert_to(jsonb_build_object(
          'previous_hash',coalesce(previous_hash,''),'organization_id',organization_id,'actor_user_id',actor_user_id,
          'actor_type',actor_type,'action',action,'resource_type',resource_type,'resource_id',resource_id,
          'correlation_id',correlation_id,'occurred_at',occurred_at,'request_ip',request_ip,
          'user_agent',user_agent,'metadata',metadata
        )::text,'UTF8'),'sha256'),'hex')) as hashes_valid
      from public.audit_events
      where correlation_id in (${fixture.auditCorrelationA}::uuid,${fixture.auditCorrelationB}::uuid)
    `;
    if (auditEvidence[0].count !== 2 || auditEvidence[0].hashes_valid !== true) {
      throw new Error('concurrent audit chain hashes failed independent recomputation');
    }
  } finally {
    await Promise.allSettled([workerA.end(), workerB.end()]);
    await cleanupFinancialConcurrencyFixture(
      admin, fixture.organizationId, fixture.actorId, fixture.membershipId,
    );
  }
}

const root = resolve(import.meta.dirname, '..');
let fileEnv = {};
try {
  fileEnv = parseEnv(await readFile(resolve(root, '.env.local'), 'utf8'));
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}
const env = { ...fileEnv, ...process.env };
if (!['development', 'staging'].includes(env.APP_ENV)) throw new Error('DB tests are restricted to development/staging');

const databaseUrl = await resolveDatabaseUrl(env, root);
const sql = postgres(databaseUrl, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 0 });
const testDirectory = resolve(root, 'supabase', 'tests');
const testPattern = process.env.DB_TEST_PATTERN
  ? new RegExp(process.env.DB_TEST_PATTERN)
  : null;
const files = (await readdir(testDirectory))
  .filter((file) => file.endsWith('.test.sql'))
  .filter((file) => !testPattern || testPattern.test(file))
  .sort();
if (files.length === 0) throw new Error('DB_TEST_PATTERN matched no SQL test files');
let assertions = 0;
let evidence = null;

const evidencePath = process.env.DB_TEST_EVIDENCE_PATH
  ? resolve(root, process.env.DB_TEST_EVIDENCE_PATH)
  : null;
if (evidencePath) {
  const allowedDirectory = resolve(root, 'docs', 'evidence');
  const evidenceRelativePath = relative(allowedDirectory, evidencePath);
  if (evidenceRelativePath.startsWith(`..${sep}`) || evidenceRelativePath === '..') {
    throw new Error('DB_TEST_EVIDENCE_PATH must stay inside docs/evidence');
  }
}

try {
  await cleanupStaleFinancialConcurrencyFixtures(sql);
  for (const file of files) {
    const source = await readFile(resolve(testDirectory, file), 'utf8');
    const result = await sql.unsafe(prepareSqlTest(source), [], { simple: true });
    const lines = tapLines(result);
    assertions += validateTap(file, lines);
    console.log(`PASS ${file}`);
  }
  await verifyOutboxConcurrency(databaseUrl, sql);
  console.log('PASS outbox_concurrency (2 connections)');
  await verifyFinancialConcurrency(databaseUrl, sql);
  console.log('PASS journal_idempotency_concurrency (2 connections)');
  console.log('PASS credit_idempotency_concurrency (2 connections)');
  console.log('PASS audit_chain_concurrency (2 connections)');
  console.log(`DB tests passed: ${files.length} files, ${assertions} assertions, 4 concurrency scenarios`);
  evidence = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    environment: env.APP_ENV,
    outcome: 'PASS',
    files,
    assertions,
    concurrencyScenarios: 4,
  };
} finally {
  await sql.end({ timeout: 2 });
}

if (evidencePath && evidence) {
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(`Evidence written: ${relative(root, evidencePath)}`);
}
