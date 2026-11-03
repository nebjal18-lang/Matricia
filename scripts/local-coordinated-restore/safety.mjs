import { createHash, createHmac } from 'node:crypto';
export const proofKind = 'LOCAL_COORDINATED_SYNTHETIC_RESTORE';
export function digest(bytes) { return createHash('sha256').update(bytes).digest('hex'); }
export function assertLab(condition, code) { if (!condition) throw new Error(`LOCAL_RESTORE_${code}`); }
export function technicalJwt(role, secret, now = Math.floor(Date.now() / 1000)) {
  assertLab(['anon', 'service_role'].includes(role), 'USER_JWT_SIGNING_FORBIDDEN');
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ iss: 'supabase-local-restore-lab', role, aud: 'authenticated', iat: now, exp: now + 7200 })).toString('base64url');
  const input = `${header}.${payload}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}
export function validateStorageTar(bytes, expectedSha, expectedSize) {
  assertLab(Buffer.isBuffer(bytes) && bytes.length % 512 === 0, 'STORAGE_ARCHIVE_TRUNCATED');
  let offset = 0, files = 0, ended = false;
  const names = new Set();
  while (offset + 512 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 512); offset += 512;
    if (header.every(value => value === 0)) { ended = true; break; }
    const field = (start, count) => header.subarray(start, start + count).toString('utf8').replace(/\0.*$/s, '').trim();
    const octal = (start, count) => { const value = field(start, count); assertLab(/^[0-7]*$/.test(value), 'STORAGE_ARCHIVE_NUMERIC_FIELD'); return Number.parseInt(value || '0', 8); };
    const name = [field(345, 155), field(0, 100)].filter(Boolean).join('/');
    assertLab(name && /^[A-Za-z0-9._/-]+$/.test(name) && !name.startsWith('/') && !name.split('/').includes('..'), 'STORAGE_ARCHIVE_PATH');
    assertLab(!names.has(name), 'STORAGE_ARCHIVE_DUPLICATE'); names.add(name);
    const type = field(156, 1), size = octal(124, 12), checksum = octal(148, 8);
    const computed = header.reduce((total, value, index) => total + (index >= 148 && index < 156 ? 32 : value), 0);
    assertLab(checksum === computed && Number.isSafeInteger(size) && size <= 10485760, 'STORAGE_ARCHIVE_HEADER');
    assertLab(['', '0', '5'].includes(type) && !field(157, 100), 'STORAGE_ARCHIVE_SPECIAL_FILE');
    assertLab((octal(100, 8) & 0o6000) === 0 && offset + size <= bytes.length, 'STORAGE_ARCHIVE_MODE_OR_SIZE');
    if (type === '5') assertLab(size === 0, 'STORAGE_ARCHIVE_DIRECTORY_DATA');
    else { files += 1; assertLab(size === expectedSize && digest(bytes.subarray(offset, offset + size)) === expectedSha, 'STORAGE_ARCHIVE_FOREIGN_BYTES'); }
    offset += Math.ceil(size / 512) * 512;
  }
  assertLab(ended && files === 1 && bytes.length-offset>=512 && bytes.subarray(offset).every(value => value === 0), 'STORAGE_ARCHIVE_CONTENT');
  return { files, sha256: digest(bytes), sizeBytes: bytes.length };
}
export function replayRoleCreates(source) {
  // pg_dumpall output is trusted local output. Only idempotent role creation is
  // adapted; ALTER/GRANT statements and ownership/ACL restoration remain intact.
  return source.replace(/^CREATE ROLE ([A-Za-z_][A-Za-z0-9_]*);$/gm, (_line, name) => `DO $lab_role$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname='${name}')THEN CREATE ROLE "${name}";END IF;END $lab_role$;`);
}

export function sanitizeLabDiagnostic(value,secrets=[]){
 let safe=String(value);for(const key of secrets)if(key)safe=safe.split(key).join('[LAB_SECRET_REDACTED]');
 return safe.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,'[JWT_REDACTED]').replace(/Bearer\s+\S+/gi,'Bearer [REDACTED]').replace(/:\/\/([^\s:@]+):[^@\s]+@/g,'://$1:[REDACTED]@').replace(/[A-Za-z0-9_.:/+-]{24,}/g,'[OPAQUE_REDACTED]');
}
