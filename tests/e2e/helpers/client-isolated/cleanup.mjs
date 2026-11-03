import { requireDevelopment, loadOwnState, docker } from './safety.mjs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
requireDevelopment();
const state = await loadOwnState();
// Every candidate was inspected for the exact per-run label, single INTERNAL
// network and absent published ports before any removal is attempted.
for (const name of [...state.children].reverse())
    docker(['rm', '--force', name]);
docker(['network', 'rm', state.network]);
state.status = 'CLEANED';
await writeFile(resolve(state.directory, 'state.private.json'), JSON.stringify(state), { mode: 0o600 });
console.log(JSON.stringify({ status: state.status, removedOwnContainers: state.children.length }));
