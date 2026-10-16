import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { BurnEngine } from './burn-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// OmniRoute hitelesítés és végpont automatikus detektálása a környezetből vagy az OpenCode fájljaiból
function detectOmniRouteAuth() {
  const result = {
    baseURL: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
    apiKey: process.env.OMNIROUTE_API_KEY || '',
    preferredModel: 'agy/gemini-3.8-flash-high'
  };

  if (!result.apiKey) {
    try {
      const authPath = path.join(os.homedir(), '.local', 'share', 'opencode', 'auth.json');
      if (fs.existsSync(authPath)) {
        const raw = JSON.parse(fs.readFileSync(authPath, 'utf8'));
        if (raw['opencode-omniroute']?.key) {
          result.apiKey = raw['opencode-omniroute'].key;
        } else if (raw['omniroute']?.key) {
          result.apiKey = raw['omniroute'].key;
        }
      }
    } catch {
      // Detektálási hibák figyelmen kívül hagyása
    }
  }

  return result;
}

const detectedAuth = detectOmniRouteAuth();

// BurnEngine példány inicializálása
const engine = new BurnEngine({
  baseURL: detectedAuth.baseURL,
  apiKey: detectedAuth.apiKey,
  model: detectedAuth.preferredModel || 'auto/fast',
  concurrency: 8,
  batchSize: 'monster',
  mode: 'infinite',
  targetTokens: 1_000_000,
  durationMinutes: 30
});

// SSE feliratkozók nyilvántartása
const sseClients = new Set();

function broadcastSSE(eventType, data) {
  const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Motor eseményeinek továbbítása az SSE kliensek felé
engine.on('stats', (stats) => broadcastSSE('stats', stats));
engine.on('request_success', (log) => broadcastSSE('request_success', log));
engine.on('request_failed', (log) => broadcastSSE('request_failed', log));
engine.on('started', (info) => broadcastSSE('started', info));
engine.on('stopped', (info) => broadcastSSE('stopped', info));

// Statikus fájlok MIME típusai
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Túl nagy adatmennyiség'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-cache'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS fejlécek
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // --- API Végpontok ---
  if (pathname === '/api/status' && req.method === 'GET') {
    return sendJSON(res, 200, {
      engine: engine.getStats(),
      detectedDefaults: detectedAuth
    });
  }

  if (pathname === '/api/stream' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });
    res.write(`event: init\ndata: ${JSON.stringify(engine.getStats())}\n\n`);

    sseClients.add(res);
    req.on('close', () => {
      sseClients.delete(res);
    });
    return;
  }

  if (pathname === '/api/models' && req.method === 'GET') {
    try {
      const targetBase = parsedUrl.searchParams.get('baseURL') || engine.baseURL;
      const targetKey = parsedUrl.searchParams.get('apiKey') || engine.apiKey;
      const cleanBase = targetBase.replace(/\/+$/, '');
      const modelsUrl = cleanBase.endsWith('/v1') ? `${cleanBase}/models` : `${cleanBase}/v1/models`;

      const headers = {};
      if (targetKey) {
        headers['Authorization'] = `Bearer ${targetKey}`;
      }

      const response = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(6000) });
      if (!response.ok) {
        const text = await response.text();
        return sendJSON(res, response.status, { error: `Hiba a modellek lekérésekor: ${text}` });
      }

      const data = await response.json();
      const rawList = data.data || [];

      // Modellek kategorizálása gyors és egyéb csoportokra
      const recommended = [];
      const others = [];

      for (const item of rawList) {
        const id = item.id || '';
        if (
          id.includes('gemini') ||
          id.startsWith('auto/best-fast') ||
          id.startsWith('auto/fast') ||
          id.startsWith('auto/coding') ||
          id.includes('flash')
        ) {
          recommended.push(item);
        } else {
          others.push(item);
        }
      }

      return sendJSON(res, 200, {
        total: rawList.length,
        recommended,
        others: others.slice(0, 150),
        allCount: rawList.length
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message || 'Hiba a modellek lekérésekor' });
    }
  }

  if (pathname === '/api/start' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      engine.updateConfig(body);
      await engine.start();
      return sendJSON(res, 200, {
        success: true,
        message: 'Az égetés sikeresen elindult',
        stats: engine.getStats()
      });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/stop' && req.method === 'POST') {
    try {
      await engine.stop('felhasznaloi_leallitas');
      return sendJSON(res, 200, {
        success: true,
        message: 'Az égetés leállt',
        stats: engine.getStats()
      });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/shutdown' && req.method === 'POST') {
    await engine.stop('szerver_kilepes');
    sendJSON(res, 200, { success: true, message: 'Leállítás folyamatban...' });
    setTimeout(() => {
      console.log('\n🛑 Szerver leállítás kérelmezve. Kilépés a folyamatból.');
      process.exit(0);
    }, 400);
    return;
  }

  // --- Statikus fájlkiszolgálás ---
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Biztonság: directory traversal kivédése
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Hozzáférés megtagadva');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Belső szerverhiba');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
});

const PORT = parseInt(process.env.PORT, 10) || 4420;
const HOST = '0.0.0.0';

server.listen(PORT, HOST, () => {
  console.log(`\n======================================================`);
  console.log(`🔥 OMNIROUTE TOKEN ÉGETŐ (Magyarosított & Optimalizált) 🔥`);
  console.log(`======================================================`);
  console.log(`Webes Irányítópult: http://localhost:${PORT}`);
  console.log(`OmniRoute Cím:      ${engine.baseURL}`);
  console.log(`Alapértelmezett:    ${engine.model}`);
  console.log(`Alap szálak száma:  ${engine.concurrency} szál | Méret: ${engine.batchSize}`);
  console.log(`API Kulcs:          ${engine.apiKey ? 'Detektálva (****' + engine.apiKey.slice(-6) + ')' : 'Nem található (add meg a felületen)'}`);
  console.log(`======================================================\n`);
});

// Tiszta leállítás SIGINT / SIGTERM esetén
async function handleExit() {
  console.log('\n🛑 Leállítás kezdeményezve...');
  await engine.stop('folyamat_kilepes');
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
