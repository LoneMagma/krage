import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../dist/client');
const port = Number(process.env.PORT) || 3000;

const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.ico': 'image/x-icon',
    '.map': 'application/json',
};

function send(res, status, body, headers = {}) {
    res.writeHead(status, headers);
    res.end(body);
}

const server = http.createServer((req, res) => {
    try {
        const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        let pathname = decodeURIComponent(url.pathname);
        if (pathname.endsWith('/')) pathname += 'index.html';

        const filePath = path.normalize(path.join(root, pathname));
        if (!filePath.startsWith(root)) {
            return send(res, 403, 'Forbidden');
        }

        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
            const ext = path.extname(filePath).toLowerCase();
            const data = fs.readFileSync(filePath);
            const cache =
            pathname.startsWith('/_next/static/')
            ? 'public, max-age=31536000, immutable'
            : 'public, max-age=60';
            return send(res, 200, data, {
                'Content-Type': types[ext] || 'application/octet-stream',
                'Cache-Control': cache,
            });
        }

        // SPA fallback
        const index = path.join(root, 'index.html');
        if (fs.existsSync(index)) {
            return send(res, 200, fs.readFileSync(index), {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'no-cache',
            });
        }

        send(res, 404, 'Not found');
    } catch (err) {
        console.error(err);
        send(res, 500, 'Internal Server Error');
    }
});

server.listen(port, '0.0.0.0', () => {
    console.log(`krage render static: http://0.0.0.0:${port} (root ${root})`);
});
