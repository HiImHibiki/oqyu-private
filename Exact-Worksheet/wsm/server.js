#!/usr/bin/env node
/* Exact Worksheet Maker — local LAN server
 * Zero-dependency static file server so this app (normally opened straight
 * from disk via file://) can also be reached by other devices on the same
 * WiFi network — e.g. a teaching assistant on their own laptop or tablet.
 *
 * Start: double-click "Start Server.command" (or run `node server.js`)
 * Stop:  double-click "Stop Server.command", or use the "Matikan Server"
 *        button that appears in the app's sidebar once it's running.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = __dirname;
const PORT = process.env.PORT ? Number(process.env.PORT) : 8420;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

function lanAddresses() {
  const nets = os.networkInterfaces();
  const addrs = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) addrs.push(net.address);
    }
  }
  return addrs;
}

const server = http.createServer((req, res) => {
  // The sidebar banner needs the real LAN address to show for sharing —
  // whichever address the CURRENT browser used to load the page (often
  // "localhost", since "Start Server.command" opens that one for you)
  // isn't necessarily reachable from another device, so it's reported
  // here instead of read off location.origin client-side.
  if (req.method === 'GET' && req.url === '/__info') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ port: PORT, addresses: lanAddresses() }));
    return;
  }

  // Lets the app's own "Matikan Server" button (and Stop Server.command, as
  // a fallback) turn the server off without needing terminal/process access
  // — the only other non-file endpoint this server exposes.
  if (req.method === 'POST' && req.url === '/__shutdown') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Server dimatikan.');
    console.log('Diminta berhenti dari aplikasi. Mematikan server...');
    server.close(() => process.exit(0));
    // In case a lingering keep-alive connection stops close() from firing.
    setTimeout(() => process.exit(0), 500);
    return;
  }

  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // Resolve against ROOT and refuse anything that escapes it — blocks a
  // "/../../etc/passwd"-style path-traversal request from the LAN.
  const filePath = path.normalize(path.join(ROOT, urlPath));
  if (!filePath.startsWith(ROOT + path.sep) && filePath !== ROOT) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const addrs = lanAddresses();
  console.log('');
  console.log('  Exact Worksheet Maker — server lokal AKTIF');
  console.log('  ------------------------------------------');
  console.log('  Di komputer ini : http://localhost:' + PORT);
  if (addrs.length) {
    addrs.forEach((a) => console.log('  Untuk asisten   : http://' + a + ':' + PORT));
  } else {
    console.log('  (Tidak terdeteksi alamat WiFi/LAN — pastikan komputer ini terhubung ke jaringan)');
  }
  console.log('');
  console.log('  Siapa pun di WiFi yang sama bisa membuka alamat "Untuk asisten" di atas.');
  console.log('  Tutup jendela ini atau jalankan "Stop Server.command" untuk mematikan.');
  console.log('');
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error('Port ' + PORT + ' sudah dipakai — server mungkin sudah berjalan.');
  } else {
    console.error('Gagal menyalakan server:', err.message);
  }
  process.exit(1);
});
