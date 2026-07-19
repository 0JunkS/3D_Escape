/**
 * 3D Escape – Multiplayer WebSocket Relay Server + Leaderboard API
 * Deploy this file to Render (Node.js Web Service).
 *
 * Start command : node server.mjs
 * Environment   : PORT (Render sets this automatically)
 */

import { createServer } from "http";
import { WebSocketServer, WebSocket } from "ws";

const PORT = Number(process.env.PORT ?? 10000);

// ── Room state ───────────────────────────────────────────────────────────────
const rooms = new Map(); // code → { host: WebSocket, guest: WebSocket|null }

function safeSend(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function getOpponent(room, ws) {
  if (room.host === ws) return room.guest;
  if (room.guest === ws) return room.host;
  return null;
}

function cleanupRoom(code, ws) {
  const room = rooms.get(code);
  if (!room) return;
  const opponent = getOpponent(room, ws);
  if (opponent) safeSend(opponent, { type: "opponent_disconnected" });
  rooms.delete(code);
  console.log(`[room:${code}] cleaned up — total rooms: ${rooms.size}`);
}

// ── Leaderboard (in-memory) ──────────────────────────────────────────────────
// Map: name → { name, pts, type: 'human'|'ai', updatedAt }
const leaderboard = new Map();

// Seed AI rivals (initial state)
const AI_RIVALS = [
  { name: "ArrowMaster", pts: 820 },
  { name: "QuickEscape",  pts: 710 },
  { name: "NeonFlight",   pts: 650 },
  { name: "StarRider",    pts: 580 },
  { name: "BlazePath",    pts: 490 },
  { name: "SkyBolt",      pts: 420 },
  { name: "CrystalRun",   pts: 350 },
  { name: "SwiftWing",    pts: 260 },
  { name: "LightStep",    pts: 180 },
  { name: "NewPlayer",    pts:  80 },
];
for (const r of AI_RIVALS) {
  leaderboard.set(r.name, { name: r.name, pts: r.pts, type: "ai", updatedAt: Date.now() });
}

// AI score fluctuation every 60 s (simulates ongoing AI battles)
setInterval(() => {
  for (const [, entry] of leaderboard) {
    if (entry.type !== "ai") continue;
    const won = Math.random() < 0.55;
    const delta = Math.floor(10 + Math.random() * 20) * (won ? 1 : -1);
    entry.pts = Math.max(10, Math.min(2000, entry.pts + delta));
    entry.updatedAt = Date.now();
  }
}, 60_000);

/** Returns top-N leaderboard entries sorted by pts descending */
function getTopLeaderboard(n = 20) {
  return [...leaderboard.values()]
    .sort((a, b) => b.pts - a.pts)
    .slice(0, n);
}

/** Upsert a player score. type = 'human' | 'ai' */
function upsertScore(name, pts, type = "human") {
  if (!name || typeof pts !== "number" || pts < 0) return;
  const existing = leaderboard.get(name);
  leaderboard.set(name, {
    name,
    pts,           // always update to latest score (not just best)
    type: existing?.type ?? type,
    updatedAt: Date.now(),
  });
}

// ── CORS helper ──────────────────────────────────────────────────────────────
function setCORSHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ── HTTP server ──────────────────────────────────────────────────────────────
const httpServer = createServer((req, res) => {
  setCORSHeaders(res);

  // Pre-flight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost`);

  // GET /leaderboard → top-20 list
  if (req.method === "GET" && url.pathname === "/leaderboard") {
    const top = getTopLeaderboard(20);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, data: top }));
    return;
  }

  // POST /leaderboard → { name, pts }  (upsert player score)
  if (req.method === "POST" && url.pathname === "/leaderboard") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { name, pts } = JSON.parse(body);
        if (!name || typeof pts !== "number") throw new Error("invalid");
        upsertScore(String(name).slice(0, 20), Math.max(0, Math.round(pts)), "human");
        const top = getTopLeaderboard(20);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, data: top }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "bad request" }));
      }
    });
    return;
  }

  // POST /battle → { winner, winnerPts, loser?, loserPts?, winnerType?, loserType? }
  if (req.method === "POST" && url.pathname === "/battle") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const d = JSON.parse(body);
        if (d.winner && typeof d.winnerPts === "number") {
          upsertScore(String(d.winner).slice(0, 20), Math.round(d.winnerPts), d.winnerType ?? "human");
        }
        if (d.loser && typeof d.loserPts === "number") {
          upsertScore(String(d.loser).slice(0, 20), Math.round(d.loserPts), d.loserType ?? "human");
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true }));
      } catch {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: "bad request" }));
      }
    });
    return;
  }

  // Health check (default)
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", rooms: rooms.size, players: leaderboard.size }));
});

// ── WebSocket server (noServer = explicit upgrade handling) ──────────────────
const wss = new WebSocketServer({ noServer: true });

httpServer.on("upgrade", (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit("connection", ws, req);
  });
});

wss.on("connection", (ws, req) => {
  const ip = req.socket?.remoteAddress ?? "unknown";
  console.log(`[ws] connected from ${ip}`);

  let assignedCode = null;

  ws.on("message", (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    if (!msg?.type) return;

    // ── JOIN ────────────────────────────────────────────────────────────────
    if (msg.type === "join") {
      const code = String(msg.code ?? "").trim();
      if (!code || code.length !== 4) return;

      assignedCode = code;
      const existing = rooms.get(code);

      if (!existing) {
        rooms.set(code, { host: ws, guest: null });
        safeSend(ws, { type: "joined", role: "host" });
        console.log(`[room:${code}] created (host) — total: ${rooms.size}`);
      } else if (!existing.guest) {
        existing.guest = ws;
        safeSend(ws, { type: "joined", role: "guest" });
        safeSend(existing.host, { type: "opponent_joined" });
        console.log(`[room:${code}] guest joined`);
      } else {
        safeSend(ws, { type: "room_full" });
        assignedCode = null;
        ws.close();
      }
      return;
    }

    // ── RELAY to opponent ───────────────────────────────────────────────────
    if (!assignedCode) return;
    const room = rooms.get(assignedCode);
    if (!room) return;
    const opponent = getOpponent(room, ws);
    if (opponent) safeSend(opponent, msg);
  });

  ws.on("close", () => {
    console.log(`[ws] disconnected (room: ${assignedCode ?? "none"})`);
    if (assignedCode) cleanupRoom(assignedCode, ws);
  });

  ws.on("error", (err) => {
    console.error(`[ws] error (room: ${assignedCode ?? "none"})`, err.message);
    if (assignedCode) cleanupRoom(assignedCode, ws);
  });
});

// Ping every 25s to keep Render connections alive
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) ws.ping();
  });
}, 25_000);

httpServer.listen(PORT, () => {
  console.log(`3D Escape relay server running on port ${PORT}`);
});
