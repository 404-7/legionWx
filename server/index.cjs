'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const createGame = require('./game.cjs');
const root = path.resolve(__dirname, '..');
const rooms = new Map(), limits = new Map();
const id = n => randomBytes(n).toString('hex');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}
function publicRoom(room) {
  return { code: room.code, started: !!room.game, host: room.members[0]?.slot,raceMode:room.raceMode,
    raceReady:room.raceMode==='random'||room.members.every(m=>createGame.raceKeys.includes(m.race)),races:room.races||null,
    members: room.members.map(m => ({ slot: m.slot, name: m.name, connected: m.streams.size > 0,race:room.races?.[m.slot]??m.race })),
    waiting: room.members.some(m => !m.streams.size) };
}
function broadcast(room) {
  const info=publicRoom(room),views=new Map();
  for (const m of room.members) {
    const team=m.slot<2?0:1;
    if(!views.has(team))views.set(team,JSON.stringify({room:info,state:room.game?.snapshot(m.slot)||null}));
    const payload=views.get(team);
    for (const res of m.streams) {
      if (res.destroyed || res.writableEnded) { m.streams.delete(res); continue; }
      if (res.writableLength > 1024 * 1024) { res.destroy(); continue; }
      res.write(`data: ${payload}\n\n`);
    }
  }
}
async function body(req) {
  let raw = '';
  for await (const chunk of req) { raw += chunk; if (raw.length > 4096) throw fail('请求过大', 413); }
  try { return JSON.parse(raw || '{}'); } catch { throw fail('无效 JSON'); }
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    if (url.pathname === '/healthz') return json(res, { ok: true, rooms: rooms.size });
    if (url.pathname.startsWith('/api/')) {
      if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) throw fail('不允许跨站请求', 403);
      const ip = req.socket.remoteAddress;
      const now = Date.now(), rate = limits.get(ip) || { at: now, n: 0 };
      if (now - rate.at > 1000) { rate.at = now; rate.n = 0; }
      limits.set(ip, rate);
      if (++rate.n > 80) throw fail('操作过于频繁', 429);
      if (req.method === 'POST' && ['/api/create', '/api/join'].includes(url.pathname)) {
        const b = await body(req);
        const name = String(b.name || '指挥官').replace(/[<>&"']/g, '').trim().slice(0, 16) || '指挥官';
        let room;
        if (url.pathname === '/api/create') {
          if (rooms.size >= 100) throw fail('服务器房间已满', 503);
          const raceMode=b.raceMode??'random';
          if(!['random','select'].includes(raceMode))throw fail('请选择随机种族或自选种族');
          room = { code: id(3).toUpperCase(), members: [], game: null, touched: now,raceMode };
          rooms.set(room.code, room);
        } else {
          room = rooms.get(String(b.code || '').toUpperCase());
          if (!room) throw fail('房间不存在', 404);
          if (room.game || room.members.length >= 4) throw fail('房间已开局或已满');
        }
        const slot = [0, 2, 1, 3].find(s => !room.members.some(m => m.slot === s));
        const member = { slot, name, token: id(24), streams: new Set(), lastSeen: now,race:null };
        room.members.push(member); room.touched = now; broadcast(room);
        return json(res, { code: room.code, token: member.token, slot,raceMode:room.raceMode });
      }
      const room = rooms.get(url.searchParams.get('room'));
      const token = req.headers.authorization?.replace(/^Bearer /, '') || url.searchParams.get('token');
      const member = room?.members.find(m => m.token === token);
      if (!member) throw fail('房间凭证失效，请重新加入', 401);
      room.touched = now;
      if (req.method === 'GET' && url.pathname === '/api/events') {
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
        // One active connection per seat. Reloads replace the old stream.
        for (const old of member.streams) old.end();
        member.streams.add(res); member.lastSeen = now;
        res.on('close', () => { member.streams.delete(res); member.lastSeen = Date.now(); });
        broadcast(room); return;
      }
      if (req.method !== 'POST') throw fail('接口不存在', 404);
      const b = await body(req);
      if(url.pathname==='/api/race'){
        if(room.game)throw fail('对局已开始，种族已锁定');
        if(room.raceMode!=='select')throw fail('随机种族模式不能手动选族');
        if(!createGame.raceKeys.includes(b.race))throw fail('请选择有效种族');
        member.race=b.race;broadcast(room);return json(res,{ok:true,race:member.race});
      }
      if (url.pathname === '/api/start') {
        if (room.members[0] !== member || room.game) throw fail('仅房主可以开始未开局的房间', 403);
        if (room.members.length < 2 || room.members.some(m => !m.streams.size)) throw fail('需要至少两名已连接的真人');
        if(room.raceMode==='select'&&room.members.some(m=>!createGame.raceKeys.includes(m.race)))throw fail('所有真人玩家选择种族后才能开始');
        room.game = createGame(room.members,{raceMode:room.raceMode});room.races=room.game.snapshot().players.map(p=>p.race); broadcast(room); return json(res, { ok: true });
      }
      if (url.pathname === '/api/action') {
        if (!member.streams.size || room.members.some(m => !m.streams.size)) throw fail('等待玩家重新连接');
        if (!room.game?.action(member.slot, b)) throw fail('操作无效或金币不足');
        return json(res, { ok: true });
      }
      if (url.pathname === '/api/leave') {
        if (room.game) room.game.forfeit(member.slot < 2 ? 0 : 1);
        else room.members = room.members.filter(m => m !== member);
        for (const stream of member.streams) stream.end();
        broadcast(room); return json(res, { ok: true });
      }
      throw fail('接口不存在', 404);
    }
    if (!['GET', 'HEAD'].includes(req.method)) throw fail('方法不支持', 405);
    const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    // Only public game assets are served; server code and credentials remain private.
    if (!/^\/(index\.html|(?:js|css)\/[\w.-]+\.(?:js|css)|assets\/unit-art\/classic\/[a-z0-9-]+\.(?:png|gif))$/.test(relative)) throw fail('文件不存在', 404);
    const file = path.join(root, relative.slice(1));
    const data = await fs.promises.readFile(file).catch(() => { throw fail('文件不存在', 404); });
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png':'image/png', '.gif':'image/gif' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)], 'Cache-Control': 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (e) { if (!res.headersSent) json(res, { error: e.status ? e.message : '服务器内部错误' }, e.status || 500); else res.end(); }
});
let tick = 0;
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    const online = room.members.some(m => m.streams.size);
    if ((!online && now - room.touched > 120000) || now - room.touched > 6 * 3600000) {
      for (const m of room.members) for (const stream of m.streams) stream.end();
      rooms.delete(code); continue;
    }
    if (room.game) {
      const missing = room.members.filter(m => !m.streams.size);
      if (missing.some(m => now - m.lastSeen > 60000)) room.game.forfeit(missing[0].slot < 2 ? 0 : 1);
      else if (!missing.length) room.game.step(0.05);
    } else {
      room.members = room.members.filter(m => m.streams.size || now - m.lastSeen < 60000);
    }
    if (tick % 2 === 0) broadcast(room);
  }
  if (tick++ % 1200 === 0) for (const [ip, r] of limits) if (now - r.at > 60000) limits.delete(ip);
}, 50).unref();
if (require.main === module) server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log(`Legion Arena listening on ${server.address().port}`));
module.exports = { server, rooms };
