'use strict';
/* ===== Canvas 渲染（贴图版） ===== */
let CTX = null;

function setupCanvas() {
  const cv = document.getElementById('cv');
  CTX = cv.getContext('2d');
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

const PROJ_COLORS = { '普通': '#ffd27e', '穿刺': '#ffab91', '魔法': '#b388ff', '攻城': '#ffb74d' };

function drawMap(c, t) {
  const bg = c.createRadialGradient(650,400,50,650,400,750);
  bg.addColorStop(0,'#21342f'); bg.addColorStop(1,'#0b181b'); c.fillStyle=bg; c.fillRect(0,0,1300,800);
  // A single continuous landscape with four approaches and two central castles.
  for (let i=0;i<95;i++) {
    const x=(i*173+17)%1300,y=(i*97+51)%800;
    c.fillStyle=i%3?'#233b32':'#2d4638';
    c.beginPath(); c.arc(x,y,3+i%7,0,7); c.fill();
  }
  c.lineCap='round'; c.lineJoin='round';
  for (const [x, kingX] of [[280,550],[1020,750]]) {
    c.strokeStyle='#34493d'; c.lineWidth=66;
    c.beginPath(); c.moveTo(x,20); c.lineTo(x,780); c.moveTo(x,400); c.lineTo(kingX,400); c.stroke();
    c.strokeStyle='#66705a'; c.lineWidth=1; c.setLineDash([3,13]);
    c.beginPath(); c.moveTo(x,20); c.lineTo(x,780); c.stroke(); c.setLineDash([]);
    for (const [y,angle] of [[28,Math.PI/2],[350,Math.PI/2],[772,-Math.PI/2],[450,-Math.PI/2]]) mapArrow(c,x,y,angle);
    mapArrow(c,(x+kingX)/2,400,x<kingX?0:Math.PI);
  }
  c.fillStyle='#b9cfc2'; c.textAlign='center'; c.font='bold 15px "Microsoft YaHei"';
  c.fillText('苍 岚 军 团',550,308); c.fillText('赤 焰 军 团',750,308);
  c.fillStyle='#7f9c8e'; c.font='11px "Microsoft YaHei"';
  c.fillText('红色箭头 · 怪物路线     金色圆环 · 国王',650,700);
  c.fillText('LEGION / THE CONVERGENCE',650,724); c.textAlign='left';
}
function mapArrow(c,x,y,angle) {
  c.save(); c.translate(x,y); c.rotate(angle); c.strokeStyle='#ff665d'; c.fillStyle='#ff665d'; c.lineWidth=3;
  c.beginPath(); c.moveTo(-22,0); c.lineTo(17,0); c.stroke();
  c.beginPath(); c.moveTo(22,0); c.lineTo(8,-6); c.lineTo(8,6); c.closePath(); c.fill(); c.restore();
}

/* 单位哈希（用于动画相位错开） */
function hsh(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return h; }

function draw(now) {
  const c = CTX;
  if (!c || !G) return;
  const view=getMapProjection();
  c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,c.canvas.width,c.canvas.height);
  c.fillStyle='#0c1a18';c.fillRect(0,0,c.canvas.width,c.canvas.height);
  c.save();c.setTransform(view.scale*view.dpr,0,0,view.scale*view.dpr,view.tx*view.dpr,view.ty*view.dpr);
  const t = now / 1000;
  // 背景
  const bg = c.createLinearGradient(0, 0, 0, CFG.H);
  bg.addColorStop(0, '#0d1524');
  bg.addColorStop(1, '#090e18');
  c.fillStyle = bg;
  c.fillRect(0, 0, CFG.W, CFG.H);
  c.strokeStyle = 'rgba(70,100,150,.08)';
  c.lineWidth = 1;
  for (let i = 0; i < 9; i++) {
    c.beginPath(); c.moveTo(0, i * 100 + 30); c.lineTo(CFG.W, i * 100 + 30); c.stroke();
  }

  drawMap(c, t);
  for (const p of G.players) drawField(p, t);
  for (const p of G.players) drawMines(c, p, t);
  for (const k of G.kings) { drawKing(k, t); for (const e of k.leaks) drawEnemy(c, e, t); }

  // 弹道（拖尾）
  for (const pr of G.projectiles) {
    c.strokeStyle = PROJ_COLORS[pr.atk] || '#ffe9a8';
    c.globalAlpha = .55; c.lineWidth = 3; c.lineCap = 'round';
    c.beginPath(); c.moveTo(pr.px, pr.py); c.lineTo(pr.x, pr.y); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(pr.x, pr.y, 2.6, 0, 7); c.fill();
    c.fillStyle = PROJ_COLORS[pr.atk] || '#ffe9a8';
    c.globalAlpha = .45;
    c.beginPath(); c.arc(pr.x, pr.y, 5.5, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  // 死亡烟雾 / 特效
  for (const f of G.fx) {
    const k = 1 - f.t / f.max;
    c.globalAlpha = (1 - k) * .7;
    c.strokeStyle = f.color;
    c.lineWidth = 3 * (1 - k) + 1;
    c.beginPath(); c.arc(f.x, f.y, f.size * (0.4 + k * 1.3), 0, 7); c.stroke();
    c.globalAlpha = (1 - k) * .9;
    c.fillStyle = f.color;
    for (let i = 0; i < 3; i++) {
      const ang = i * 2.1 + k * 3;
      c.beginPath();
      c.arc(f.x + Math.cos(ang) * f.size * k, f.y + Math.sin(ang) * f.size * k - k * 6, 2.2 * (1 - k), 0, 7);
      c.fill();
    }
    c.globalAlpha = 1;
  }
  // 漂浮文字
  c.textAlign = 'center';
  for (const f of G.floaters) {
    c.globalAlpha = Math.min(1, f.t);
    c.fillStyle = f.color;
    c.font = 'bold 13px "Microsoft YaHei"';
    c.fillText(f.txt, f.x, f.y);
    c.globalAlpha = 1;
  }
  c.textAlign = 'left';
  c.restore();
}

function drawField(p, t) {
  const c = CTX;
  const isMine = p.id === localPlayer().id;
  const teamCol = TEAM_COLORS[p.team];

  c.fillStyle = isMine ? 'rgba(69,143,151,.12)' : 'rgba(50,74,81,.12)';
  roundRect(c, p.fx, p.fy, CFG.FIELD_W, CFG.FIELD_H, 16); c.fill();
  c.strokeStyle = isMine ? '#79d4cc' : 'rgba(132,161,151,.22)'; c.lineWidth = isMine ? 2 : 1; c.stroke();
  c.strokeStyle = 'rgba(162,192,171,.12)'; c.lineWidth = 1;
  for (let i=0;i<=CFG.COLS;i++) { c.beginPath(); c.moveTo(p.gx+i*CFG.CELL,p.gy); c.lineTo(p.gx+i*CFG.CELL,p.gy+CFG.GRID_H); c.stroke(); }
  for (let i=0;i<=CFG.ROWS;i++) { c.beginPath(); c.moveTo(p.gx,p.gy+i*CFG.CELL); c.lineTo(p.gx+CFG.GRID_W,p.gy+i*CFG.CELL); c.stroke(); }
  c.font = 'bold 13px "Microsoft YaHei"'; c.fillStyle = isMine ? '#9ee5d3' : teamCol;
  c.fillText((isMine ? '◆ 你的防区 · ' : '') + p.name, p.fx+14, p.fy+23);
  c.textAlign = 'right'; c.fillStyle = '#93a89e'; c.font = '11px "Microsoft YaHei"';
  c.fillText('战力 '+playerValue(p),p.fx+CFG.FIELD_W-14,p.fy+23); c.textAlign = 'left';

  // 战士
  for (const f of p.fighters) drawFighter(c, f, p, t);
  // 敌人
  for (const e of p.enemies) drawEnemy(c, e, t);

  // 悬停放置预览
  if (isMine && G.selectedShop && G.hover) {
    const h = G.hover;
    const x = p.gx + (h.col + 0.5) * CFG.CELL, y = p.gy + (h.row + 0.5) * CFG.CELL;
    const def = UNITS[G.selectedShop];
    c.globalAlpha = 0.55;
    c.strokeStyle = h.valid ? '#7ee08a' : '#ff6a5e';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(x, y, effRange(def), 0, 7); c.stroke();
    c.fillStyle = h.valid ? 'rgba(126,224,138,.18)' : 'rgba(255,106,94,.18)';
    roundRect(c, p.gx + h.col * CFG.CELL, p.gy + h.row * CFG.CELL, CFG.CELL, CFG.CELL, 4);
    c.fill();
    c.globalAlpha = .75;
    c.drawImage(SPR[G.selectedShop], x - SPR_N / 2, y - SPR_N / 2 + 6,SPR_N,SPR_N);
    c.globalAlpha = 1;
  }
  // 选中指示
  if (isMine && G.selectedFighter && (G.selectedFighter.hp > 0 || G.selectedFighter.deadT > 0)) {
    const f = G.selectedFighter;
    c.strokeStyle = '#f5c542';
    c.lineWidth = 1.6;
    c.setLineDash([4, 3]);
    c.beginPath(); c.arc(f.x, f.y, 20, 0, 7); c.stroke();
    c.setLineDash([]);
    c.globalAlpha = 0.3;
    c.beginPath(); c.arc(f.x, f.y, effRange(f.def), 0, 7); c.stroke();
    c.globalAlpha = 1;
  }
}

function drawMines(c, p, t) {
  const mineTop = minePosition(p, 0);
  c.textAlign = 'center'; c.font = '11px "Microsoft YaHei"';
  c.fillStyle = p.id === localPlayer().id ? '#e4ca87' : '#8b9d86';
  c.fillText(`${p.name} · 矿区 ${p.mines.length}/${MINE.LIMIT}`, mineTop.x + 27, mineTop.y - 34);
  for (let i = 0; i < MINE.LIMIT; i++) {
    const { x, y } = minePosition(p, i), mine = p.mines[i];
    const selected = p.id === localPlayer().id && G.selectedMine === i;
    c.fillStyle = mine ? '#354230' : 'rgba(38,55,43,.35)';
    c.strokeStyle = selected ? '#fff0a6' : mine ? '#a38a4e' : '#3a4b3b';
    c.lineWidth = selected ? 2 : 1;
    roundRect(c, x - 23, y - 24, 46, 51, 7); c.fill(); c.stroke();
    if (!mine) { c.fillStyle = '#536650'; c.fillText('◇', x, y + 4); continue; }
    // Rock entrance, timber beam and ore: code-native artwork matching the existing sprites.
    c.fillStyle = '#657060'; c.beginPath();
    c.moveTo(x-18,y+7); c.lineTo(x-13,y-9); c.lineTo(x-3,y-18);
    c.lineTo(x+13,y-11); c.lineTo(x+19,y+7); c.closePath(); c.fill();
    c.fillStyle = '#111b17'; c.fillRect(x-8,y-8,16,17);
    c.strokeStyle = '#bb995b'; c.lineWidth = 3;
    c.beginPath(); c.moveTo(x-10,y+8); c.lineTo(x-10,y-9); c.lineTo(x+10,y-9); c.lineTo(x+10,y+8); c.stroke();
    c.fillStyle = '#f1d068';
    for (let j=0;j<3;j++) { c.beginPath(); c.arc(x-10+j*8,y+6-(j%2)*3,3,0,7); c.fill(); }
    c.fillStyle = '#ecd59a'; c.font = '9px "Microsoft YaHei"';
    c.fillText(`${i+1} · Lv.${mine.level}`,x,y+20);
    c.fillStyle = '#1c281e'; c.fillRect(x-18,y+29,36,3);
    c.fillStyle = '#dab66b'; c.fillRect(x-18,y+29,36*Math.min(1,mine.elapsed/MINE.INTERVAL),3);
    c.font = '11px "Microsoft YaHei"';
  }
  c.textAlign = 'left';
}

function drawFighter(c, f, p, t) {
  if(f.hp<=0&&f.deadT<=0)return;
  if (f.deadT > 0) {   // 复活倒计时幽灵
    c.globalAlpha = 0.35;
    c.drawImage(SPR[f.uid], f.x - SPR_N / 2, f.y - SPR_N / 2 + 6,SPR_N,SPR_N);
    c.globalAlpha = 1;
    c.strokeStyle = '#7ee08a';
    c.lineWidth = 1.2;
    c.beginPath(); c.arc(f.x, f.y + 6, 14, -Math.PI / 2, -Math.PI / 2 + (1 - f.deadT / 2.2) * Math.PI * 2); c.stroke();
    return;
  }
  const bob = Math.sin(t * 3 + hsh(f.uid + f.col + f.row) ) * 1.4;
  const ab = f.def.abil || {};

  // 光环底圈
  const aura = ab.aura || ab.healAura;
  if (aura) {
    const pulse = .5 + Math.sin(t * 2.5) * .2;
    c.globalAlpha = .1 + pulse * .06;
    c.fillStyle = RACES[f.def.race].color;
    c.beginPath(); c.arc(f.x, f.y + 4, aura.r, 0, 7); c.fill();
    c.globalAlpha = .35;
    c.strokeStyle = RACES[f.def.race].color;
    c.setLineDash([6, 8]); c.lineDashOffset = -t * 20;
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(f.x, f.y + 4, aura.r, 0, 7); c.stroke();
    c.setLineDash([]); c.lineDashOffset = 0;
    c.globalAlpha = 1;
  }
  // 灼烧火星
  if (ab.burn) {
    for (let i = 0; i < 2; i++) {
      const ang = t * 4 + i * Math.PI;
      c.globalAlpha = .8;
      c.fillStyle = f.def.race === 'undead' ? '#89d5a5' : '#ffca62';
      c.beginPath(); c.arc(f.x + Math.cos(ang) * 12, f.y + Math.sin(ang) * 8 - 6, 1.5, 0, 7); c.fill();
    }
    c.globalAlpha = 1;
  }

  // 本体贴图（受击时抖动）
  const dx = f.flash > 0 ? Math.sin(t * 60) * 1.5 : 0;
  c.drawImage(SPR[f.uid], f.x - SPR_N / 2 + dx, f.y - SPR_N / 2 + 8 + bob,SPR_N,SPR_N);

  // 受击白闪
  if (f.flash > 0) {
    c.globalAlpha = Math.min(1, f.flash * 5) * .75;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(f.x, f.y + 4, 13, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  // 血条
  const bw = 26, ratio = Math.max(0, f.hp / f.max);
  c.fillStyle = 'rgba(0,0,0,.7)';
  c.fillRect(f.x - bw / 2 - 1, f.y - 26 + bob, bw + 2, 5);
  c.fillStyle = ratio > 0.4 ? '#6fdc7c' : '#ff6a5e';
  c.fillRect(f.x - bw / 2, f.y - 25 + bob, bw * ratio, 3);
}

function drawEnemy(c, e, t) {
  const sid = enemySpriteId(e);
  const wob = Math.sin(t * 6 + hsh('' + e.x)) * 2;
  const scale = e.boss ? 1.7 : 1;
  const w = SPR_N * scale;
  const dx = e.flash > 0 ? Math.sin(t * 60) * 1.5 : 0;
  c.save();
  c.translate(e.x + dx, e.y);
  c.rotate(Math.sin(t * 5 + e.x * .1) * .05);
  c.drawImage(SPR[sid], -w / 2, -w / 2 + (e.boss ? 4 : 8) + wob * .4, w, w);
  c.restore();

  if (e.magicImmune) {
    c.strokeStyle = 'rgba(178,102,255,.75)';
    c.lineWidth = 1.5;
    c.setLineDash([4, 4]); c.lineDashOffset = t * 15;
    c.beginPath(); c.arc(e.x, e.y + 2, e.r + 5, 0, 7); c.stroke();
    c.setLineDash([]); c.lineDashOffset = 0;
  }
  if (e.slowT > 0) {
    c.strokeStyle = 'rgba(79,195,247,.8)';
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(e.x, e.y + 2, e.r + 4, 0, 7); c.stroke();
  }
  if (e.flash > 0) {
    c.globalAlpha = Math.min(1, e.flash * 5) * .6;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(e.x, e.y, e.r + 3, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  // 血条
  const bw = e.boss ? 52 : 20;
  c.fillStyle = 'rgba(0,0,0,.7)';
  c.fillRect(e.x - bw / 2 - 1, e.y - e.r - 13, bw + 2, 5);
  c.fillStyle = '#ff8a80';
  c.fillRect(e.x - bw / 2, e.y - e.r - 12, bw * Math.max(0, e.hp / e.max), 3);
}

function drawKing(k, t) {
  const c = CTX;
  const col = TEAM_COLORS[k.team];
  c.strokeStyle = '#f5d46b'; c.lineWidth = 4;
  c.beginPath(); c.arc(k.x,k.y,43,0,Math.PI*2); c.stroke();
  // 光环底座
  const glow = c.createRadialGradient(k.x, k.y, 5, k.x, k.y, 42);
  glow.addColorStop(0, k.team === 0 ? 'rgba(77,163,255,.28)' : 'rgba(255,106,77,.28)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = glow;
  c.beginPath(); c.arc(k.x, k.y, 42, 0, 7); c.fill();
  // 震击波纹
  if (k.slamT > 0) {
    // Rendering must not advance authoritative game state.
    const kk = 1 - k.slamT / .35;
    c.globalAlpha = (1 - kk) * .8;
    c.strokeStyle = PAL.gold.glow;
    c.lineWidth = 4 * (1 - kk) + 1;
    c.beginPath(); c.arc(k.x, k.y, 30 + kk * 80, 0, 7); c.stroke();
    c.globalAlpha = 1;
  }
  const bob = Math.sin(t * 2 + k.team * 2) * 1.5;
  const dx = k.flash > 0 ? Math.sin(t * 60) * 2 : 0;
  c.drawImage(SPR['king_' + k.team], k.x - SPR_N / 2 + dx, k.y - SPR_N / 2 - 2 + bob, SPR_N, SPR_N);
  if (k.flash > 0) {
    c.globalAlpha = Math.min(1, k.flash * 5) * .5;
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(k.x, k.y, 26, 0, 7); c.fill();
    c.globalAlpha = 1;
  }
  // 血条
  const bw = 100, ratio = Math.max(0, k.hp / k.max);
  c.fillStyle = 'rgba(0,0,0,.75)';
  c.fillRect(k.x - bw / 2 - 1, k.y - 46, bw + 2, 9);
  const hb = c.createLinearGradient(k.x - bw / 2, 0, k.x + bw / 2, 0);
  if (k.team === 0) { hb.addColorStop(0, '#2f6fb5'); hb.addColorStop(1, '#6fb5ff'); }
  else { hb.addColorStop(0, '#b53d20'); hb.addColorStop(1, '#ff9b6e'); }
  c.fillStyle = hb;
  c.fillRect(k.x - bw / 2, k.y - 45, bw * ratio, 7);
  c.fillStyle = '#c3d2e8';
  c.font = 'bold 11px "Microsoft YaHei"';
  c.textAlign = 'center';
  c.fillText(`${k.team === 0 ? '蓝方国王' : '红方国王'} Lv${k.lvl} · ${Math.ceil(k.hp)}`, k.x, k.y - 51);
  c.textAlign = 'left';
}
