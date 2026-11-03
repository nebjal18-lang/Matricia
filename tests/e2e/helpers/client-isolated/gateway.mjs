import { requireDevelopment, loadOwnState } from './safety.mjs';
requireDevelopment();
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const s = await loadOwnState();
if (!['SERVICES_STARTED', 'ACTORS_READY', 'FIXTURE_READY'].includes(s.status))
    throw new Error('OWNED_TEST_SERVICES_REQUIRED');
const routes = [['/auth/v1', s.authHost, 9999], ['/rest/v1', s.restHost, 3000], ['/storage/v1', s.storageHost, 5000]];
const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    if (origin && origin !== `http://127.0.0.1:${s.appPort}`) {
        res.writeHead(403);
        res.end();
        return;
    }
    if (origin) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('access-control-allow-credentials', 'true');
        res.setHeader('vary', 'Origin');
    }
    if (req.method === 'OPTIONS') {
        res.writeHead(204, { 'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info,x-supabase-api-version', 'access-control-allow-methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' });
        res.end();
        return;
    }
    const route = routes.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix + '/') || req.url.startsWith(prefix + '?'));
    if (!route) {
        res.writeHead(404);
        res.end();
        return;
    }
    const [prefix, host, port] = route;
    const path = req.url.slice(prefix.length) || '/';
    const upstream = http.request({ host, port, method: req.method, path, headers: { ...req.headers, host: `${host}:${port}` } }, response => { if (response.statusCode >= 400) {
        let body = '';
        response.on('data', chunk => { if (body.length < 4096)
            body += chunk.toString(); });
        response.on('end', () => { try {
            const error = JSON.parse(body);
            let message = String(error.message ?? error.error ?? '').slice(0, 240);
            for (const key of [s.dbSecret, s.jwtSecret, s.anonKey, s.serviceKey])
                message = message.replaceAll(key, '[REDACTED]');
            console.log(JSON.stringify({ upstreamFailure: true, prefix, path: path.split('?')[0], status: response.statusCode, code: error.code, message }));
        }
        catch {
            console.log(JSON.stringify({ upstreamFailure: true, prefix, status: response.statusCode }));
        } });
    } res.writeHead(response.statusCode, response.headers); response.pipe(res); });
    upstream.on('error', () => { if (!res.headersSent)
        res.writeHead(503, { 'content-type': 'application/json' }); res.end('{"error":"ISOLATED_TEST_SERVICE_UNAVAILABLE"}'); });
    req.pipe(upstream);
});
server.listen(s.gatewayPort, '127.0.0.1', () => console.log(JSON.stringify({ status: 'GATEWAY_READY', port: s.gatewayPort, scope: 'OWNED_LOCAL_INTERNAL_NETWORK_ONLY' })));
