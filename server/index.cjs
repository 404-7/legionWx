'use strict';
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const createGame = require('./game.cjs');
const Sync341=require('../js/sync341.js');
const {createGzip,constants:ZLIB}=require('node:zlib');
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
    raceReady:true,races:room.races||null,
    members: room.members.map(m => ({ slot: m.slot, name: m.name, connected: m.streams.size > 0,race:room.races?.[m.slot]??m.race })),
    waiting: room.members.some(m => !m.streams.size) };
}
function broadcast(room) {
  const info=publicRoom(room),views=new Map();
  for (const m of room.members) {
    const team=m.slot<4?0:1;
    if(!m.streams.size)continue;
    if(!views.has(team)){
      const state=room.game?.snapshot(m.slot)||null,value={room:info,state:Sync341.project(state)};
      room.syncChannels??=new Map();if(!room.syncChannels.has(team))room.syncChannels.set(team,Sync341.encoder());
      const channel=room.syncChannels.get(team);views.set(team,{legacy:{room:info,state},channel,frame:channel.next(value)});
    }
    const view=views.get(team);
    for (const res of m.streams) {
      if (res.destroyed || res.writableEnded) { m.streams.delete(res); continue; }
      if (res.writableLength+(res.syncGzip?.writableLength||0) > 1024 * 1024) { res.destroy(); continue; }
      const kind=res.syncProtocol?(res.syncSeq===view.frame.base?'delta':'full'):'legacy';view.text??={};
      const frame=view.text[kind]??=( `data: ${JSON.stringify(kind==='legacy'?view.legacy:kind==='delta'?view.frame:view.channel.full())}\n\n`);
      if(res.syncGzip){res.syncGzip.write(frame);res.syncGzip.flush(ZLIB.Z_SYNC_FLUSH);}else res.write(frame);
      res.syncSeq=view.frame.seq;
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
          const raceMode='ap';

          room = { code: id(3).toUpperCase(), members: [], game: null, touched: now,raceMode };
          rooms.set(room.code, room);
        } else {
          room = rooms.get(String(b.code || '').toUpperCase());
          if (!room) throw fail('房间不存在', 404);
          if (room.game || room.members.length >= 8) throw fail('房间已开局或已满');
        }
        const slot = [0, 4, 1, 5, 2, 6, 3, 7].find(s => !room.members.some(m => m.slot === s));
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
        const gzip=String(req.headers['accept-encoding']||'').split(',').some(v=>{const [encoding,...params]=v.split(';'),quality=params.find(p=>/^\s*q\s*=/i.test(p));return encoding.trim().toLowerCase()==='gzip'&&(quality===undefined||Number(quality.split('=')[1])>0);});
        res.syncProtocol=url.searchParams.get('sync')==='1';res.syncSeq=null;
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no',Vary:'Accept-Encoding',...(gzip?{'Content-Encoding':'gzip'}:{}) });
        req.socket.setNoDelay(true);
        if(gzip){res.syncGzip=createGzip({level:3});res.syncGzip.on('error',()=>res.destroy());res.syncGzip.pipe(res);res.on('close',()=>res.syncGzip.destroy());}
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

        room.game = createGame(room.members,{raceMode:room.raceMode});room.races=room.game.snapshot().players.map(p=>p.race); broadcast(room); return json(res, { ok: true });
      }
      if (url.pathname === '/api/action') {
        if (!member.streams.size || room.members.some(m => !m.streams.size)) throw fail('等待玩家重新连接');
        if (!room.game?.action(member.slot, b)) throw fail('操作无效或金币不足');
        return json(res, { ok: true });
      }
      if (url.pathname === '/api/leave') {
        if (room.game) room.game.leaveSlot(member.slot);
        room.members = room.members.filter(m => m !== member);
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
      const departed=missing.filter(m=>now-m.lastSeen>60000);
      for(const m of departed){room.game.leaveSlot(m.slot);room.members=room.members.filter(other=>other!==m);}
      if(!room.members.some(m=>!m.streams.size))room.game.step(0.05);
    } else {
      room.members = room.members.filter(m => m.streams.size || now - m.lastSeen < 60000);
    }
    if (tick % 2 === 0) broadcast(room);
  }
  if (tick++ % 1200 === 0) for (const [ip, r] of limits) if (now - r.at > 60000) limits.delete(ip);
}, 50).unref();
if (require.main === module) server.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0', () => console.log(`Legion Arena listening on ${server.address().port}`));
module.exports = { server, rooms };
