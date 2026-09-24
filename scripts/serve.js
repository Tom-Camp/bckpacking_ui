// Serves the static build the way production should: files from build/, index.html as the SPA
// fallback, and /api proxied to the backend so the app and API share one origin.
// Usage: node scripts/serve.js [--port 4173]   (API_TARGET defaults to http://localhost:8000)

import { createReadStream, existsSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../build');
const port = Number(process.argv[process.argv.indexOf('--port') + 1]) || 4173;
const apiTarget = new URL(process.env.API_TARGET ?? 'http://localhost:8000');

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript',
	'.css': 'text/css',
	'.json': 'application/json',
	'.webmanifest': 'application/manifest+json',
	'.svg': 'image/svg+xml',
	'.png': 'image/png',
	'.ico': 'image/x-icon',
	'.woff2': 'font/woff2',
	'.txt': 'text/plain'
};

function proxy(req, res) {
	const upstream = http.request(
		{
			hostname: apiTarget.hostname,
			port: apiTarget.port,
			path: req.url,
			method: req.method,
			headers: { ...req.headers, host: apiTarget.host }
		},
		(up) => {
			res.writeHead(up.statusCode ?? 502, up.headers);
			up.pipe(res);
		}
	);
	upstream.on('error', () => {
		res.writeHead(502).end('API unavailable');
	});
	req.pipe(upstream);
}

function sendFile(res, file, cacheControl) {
	res.writeHead(200, {
		'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream',
		'Cache-Control': cacheControl
	});
	createReadStream(file).pipe(res);
}

http
	.createServer((req, res) => {
		const url = new URL(req.url ?? '/', 'http://x');
		if (url.pathname.startsWith('/api/')) return proxy(req, res);

		const file = path.join(root, decodeURIComponent(url.pathname));
		if (file.startsWith(root) && existsSync(file) && statSync(file).isFile()) {
			// Hashed assets never change; everything else (sw.js, index.html, manifest) must revalidate.
			const immutable = url.pathname.startsWith('/_app/immutable/');
			return sendFile(res, file, immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
		}
		sendFile(res, path.join(root, 'index.html'), 'no-cache');
	})
	.listen(port, () =>
		console.log(`Serving build/ on http://localhost:${port} (API → ${apiTarget.origin})`)
	);
