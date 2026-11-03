// Runs only inside the labelled laboratory network namespace. The controller
// captures stdout privately; it must never forward Auth response bodies to logs.
const chunks = [];for await (const chunk of process.stdin) chunks.push(chunk);
try {
  const request = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const url = new URL(request.url);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || !['9999','3000','5000','7500'].includes(url.port)) throw new Error('LAB_HTTP_TARGET');
  const response = await fetch(url, { method: request.method ?? 'GET', headers: request.headers ?? {}, ...(request.bodyBase64 === undefined ? {} : {body: Buffer.from(request.bodyBase64, 'base64')}), signal: AbortSignal.timeout(15000), redirect: 'error' });
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 10485760) throw new Error('LAB_HTTP_BODY_LIMIT');
  process.stdout.write(JSON.stringify({status:response.status,contentType:response.headers.get('content-type'),bodyBase64:bytes.toString('base64')}));
} catch { process.stdout.write(JSON.stringify({error:'LOCAL_RESTORE_HTTP_FAILED'}));process.exitCode=1; }
