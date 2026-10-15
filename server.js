import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { BurnEngine } from './burn-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.join(__dirname, 'public');

// Auto-detect default OmniRoute API key and port from environment or OpenCode files
function detectOmniRouteAuth() {
  const result = {
    baseURL: process.env.OMNIROUTE_BASE_URL || 'http://localhost:20128/v1',
    apiKey: process.env.OMNIROUTE_API_KEY || ''
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
      // Ignore detection errors, user can input manually
    }
  }

  // Leave empty if not detected - user can provide it in UI or via OMNIROUTE_API_KEY
  if (!result.apiKey) {
    result.apiKey = '';
  }

  return result;
}

const detectedAuth = detectOmniRouteAuth();

// Initialize the BurnEngine instance
const engine = new BurnEngine({
  baseURL: detectedAuth.baseURL,
  apiKey: detectedAuth.apiKey,
  model: 'fp99/spam',
  concurrency: 8,
  mode: 'infinite',
  targetTokens: 1_000_000,
  durationHours: 6,
  burnStrategy: 'prompt_heavy',
  cacheBuster: true,
  maxTokens: 4096
});

// SSE Subscribers Set
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

// Forward engine events to SSE
engine.on('stats', (stats) => broadcastSSE('stats', stats));
engine.on('request_success', (log) => broadcastSSE('request_success', log));
engine.on('request_failed', (log) => broadcastSSE('request_failed', log));
engine.on('started', (info) => broadcastSSE('started', info));
engine.on('stopped', (info) => broadcastSSE('stopped', info));

// Simple static file mime map
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
      if (body.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
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

  // CORS headers for development/CLI usage
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  // --- API Endpoints ---
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

      const response = await fetch(modelsUrl, { headers });
      if (!response.ok) {
        const text = await response.text();
        return sendJSON(res, response.status, { error: `Failed to fetch models: ${text}` });
      }

      const data = await response.json();
      const rawList = data.data || [];

      // Sort models: prioritize combos (containing '/' with fp99 or auto), then sort alphabetically
      const categorized = {
        combos: [],
        models: []
      };

      for (const item of rawList) {
        const id = item.id || '';
        if (id.startsWith('fp99/') || id.startsWith('auto/') || id.includes('combo')) {
          categorized.combos.push(item);
        } else {
          categorized.models.push(item);
        }
      }

      return sendJSON(res, 200, {
        total: rawList.length,
        combos: categorized.combos,
        models: categorized.models,
        all: rawList
      });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message || 'Error fetching models' });
    }
  }

  if (pathname === '/api/start' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      engine.updateConfig(body);
      await engine.start();
      return sendJSON(res, 200, {
        success: true,
        message: 'Token Burner started',
        stats: engine.getStats()
      });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/stop' && req.method === 'POST') {
    try {
      engine.stop('user_stopped');
      return sendJSON(res, 200, {
        success: true,
        message: 'Token Burner stopped',
        stats: engine.getStats()
      });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      engine.updateConfig(body);
      return sendJSON(res, 200, {
        success: true,
        message: 'Configuration updated',
        stats: engine.getStats()
      });
    } catch (err) {
      return sendJSON(res, 500, { success: false, error: err.message });
    }
  }

  // --- Static Files ---
  let reqPath = pathname === '/' ? '/index.html' : pathname;
  let filePath = path.join(PUBLIC_DIR, reqPath);

  // Security: Prevent path traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    return res.end('Access denied');
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routes
      filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('File not found');
      }
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    });
  });
});

const DEFAULT_PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4420;

function listenOnPort(port) {
  server.listen(port, () => {
    console.log(`\n=================================================`);
    console.log(`🔥 OMNIROUTE TOKEN BURNER WEB SERVER RUNNING 🔥`);
    console.log(`=================================================`);
    console.log(`Local UI:   http://localhost:${port}`);
    console.log(`OmniRoute:  ${engine.baseURL}`);
    console.log(`Default Key: ${engine.apiKey ? engine.apiKey.slice(0, 12) + '...' : '(none)'}`);
    console.log(`Active Model: ${engine.model}`);
    console.log(`=================================================\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying port ${port + 1}...`);
      listenOnPort(port + 1);
    } else {
      console.error('Server error:', err);
    }
  });
}

listenOnPort(DEFAULT_PORT);
