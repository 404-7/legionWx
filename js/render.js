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
const ROAD_SKIN={pattern:null,gateAmount:0,lastTime:null};

function stonePattern(c){
  if(ROAD_SKIN.pattern)return ROAD_SKIN.pattern;
  const tile=document.createElement('canvas');tile.width=64;tile.height=64;const g=tile.getContext('2d');
  g.fillStyle='#343d38';g.fillRect(0,0,64,64);
  for(let row=0;row<4;row++)for(let col=-1;col<3;col++){
    const x=col*32+(row%2)*16,y=row*16;
    g.fillStyle=['#687063','#73796b','#5e695e','#7a7e6d'][(row*3+col+5)%4];
    roundRect(g,x+1,y+1,30,14,3);g.fill();
    g.strokeStyle='#b7b79a42';g.lineWidth=1;g.beginPath();g.moveTo(x+4,y+2);g.lineTo(x+27,y+2);g.stroke();
    g.strokeStyle='#202d2966';g.beginPath();g.moveTo(x+7,y+8);g.lineTo(x+11,y+10);g.stroke();
  }
  ROAD_SKIN.pattern=c.createPattern(tile,'repeat');return ROAD_SKIN.pattern;
}
function roundedRoad(c,points,radius=52){
  c.beginPath();c.moveTo(points[0][0],points[0][1]);
  for(let i=1;i<points.length-1;i++){
    const [x,y]=points[i],[ax,ay]=points[i-1],[bx,by]=points[i+1];
    const d1=Math.hypot(x-ax,y-ay),d2=Math.hypot(bx-x,by-y),r=Math.min(radius,d1/2,d2/2);
    c.lineTo(x+(ax-x)/d1*r,y+(ay-y)/d1*r);c.quadraticCurveTo(x,y,x+(bx-x)/d2*r,y+(by-y)/d2*r);
  }
  const end=points.at(-1);c.lineTo(end[0],end[1]);
}
function drawStoneRoad(c,points){
  c.lineJoin='round';c.lineCap='round';
  for(const [width,color] of [[102,'#08141088'],[90,'#384337'],[80,'#8a8b70'],[74,'#29372f'],[68,stonePattern(c)]]){
    c.lineWidth=width;c.strokeStyle=color;roundedRoad(c,points);c.stroke();
  }
}
function drawRiver(c,t){
  const river=()=>{c.beginPath();c.moveTo(CFG.W/2,0);for(let y=0;y<=CFG.H+80;y+=80)c.lineTo(CFG.W/2+Math.sin(y/160)*12,y);};
  c.lineJoin='round';c.lineCap='round';
  for(const [w,color] of [[77,'#0a1716'],[64,'#283d32'],[49,'#102e32'],[32,'#194149']]){c.strokeStyle=color;c.lineWidth=w;river();c.stroke();}
  c.strokeStyle='#90c5b326';c.lineWidth=1;
  for(let y=12;y<CFG.H;y+=44){const flow=(y+t*9)%CFG.H,x=CFG.W/2+Math.sin(flow/160)*12;c.beginPath();c.moveTo(x-10,flow);c.quadraticCurveTo(x,flow+4,x+9,flow);c.stroke();}
}
function gateTower(c,x,y,color){
  c.fillStyle='#050f0bb3';c.beginPath();c.ellipse(x+5,y+8,30,24,0,0,7);c.fill();
  c.fillStyle='#6b7569';c.strokeStyle='#b2b29a';c.lineWidth=2;c.beginPath();c.arc(x,y,23,0,7);c.fill();c.stroke();
  c.fillStyle='#303f38';c.beginPath();c.arc(x,y,15,0,7);c.fill();
  for(let i=0;i<8;i++){c.save();c.translate(x,y);c.rotate(i*Math.PI/4);c.fillStyle=i%2?'#92967f':'#7d8777';c.fillRect(-5,-26,10,10);c.restore();}
  c.strokeStyle='#b7aa78';c.lineWidth=2;c.beginPath();c.moveTo(x,y-5);c.lineTo(x,y-39);c.stroke();
  c.fillStyle=color;c.beginPath();c.moveTo(x+1,y-39);c.lineTo(x+19,y-33);c.lineTo(x+1,y-27);c.closePath();c.fill();
}
function drawBridge(c,t){
  const x=CFG.W/2,y=CFG.ROAD_Y,open=G.battleMode==='arena'&&G.phase==='combat';
  const dt=ROAD_SKIN.lastTime===null?0:Math.min(.1,Math.max(0,t-ROAD_SKIN.lastTime));ROAD_SKIN.lastTime=t;
  ROAD_SKIN.gateAmount+=(Number(open)-ROAD_SKIN.gateAmount)*Math.min(1,dt*7);
  c.fillStyle='#07110e99';roundRect(c,x-123,y-68,250,146,12);c.fill();
  c.fillStyle=stonePattern(c);c.strokeStyle='#9b9c82';c.lineWidth=3;roundRect(c,x-120,y-60,240,120,10);c.fill();c.stroke();
  for(const side of [-1,1]){
    c.fillStyle='#303f35';c.fillRect(x-114,y+side*59-5,228,10);
    c.fillStyle='#a5a58b';c.fillRect(x-113,y+side*59-5,226,3);
    for(let i=-100;i<=100;i+=40){c.fillStyle='#75806e';c.fillRect(x+i-5,y+side*59-9,10,18);}
  }
  // Twin portcullis leaves retract into the two stone towers; the center stays walkable during PK.
  const slide=ROAD_SKIN.gateAmount*48;
  for(const side of [-1,1]){
    c.save();c.translate(x,y+side*(22+slide));
    c.fillStyle='#131e1c99';c.fillRect(-5,-22,15,47);
    c.fillStyle='#5a4832';c.strokeStyle='#b3a579';c.lineWidth=2;roundRect(c,-7,-22,14,44,2);c.fill();c.stroke();
    c.fillStyle='#24362e';c.fillRect(-9,-14,18,4);c.fillRect(-9,10,18,4);c.restore();
  }
  gateTower(c,x,y-76,TEAM_COLORS[1]);gateTower(c,x,y+76,TEAM_COLORS[0]);
  c.fillStyle=open?'#91c9a2':'#adab87';c.beginPath();c.moveTo(x-5,y);c.lineTo(x,y-6);c.lineTo(x+5,y);c.lineTo(x,y+6);c.closePath();c.fill();
  c.textAlign='center';c.font='bold 14px "Microsoft YaHei"';c.fillStyle='#e0d2ad';c.fillText('王 庭 石 桥',x,y-122);
  c.fillStyle='#0b1c17d9';roundRect(c,x-123,y+111,246,31,9);c.fill();c.font='12px "Microsoft YaHei"';
  c.fillStyle=open?'#a4d7ad':'#bebc9b';
  const label=G.battleMode==='arena'?G.phase==='prep'?`${Math.ceil(G.timer)} 秒后开门 · 准备 PK`:G.arena.stage==='result'?'PK 已结算 · 即将继续守关':`苍岚 ${G.arena.counts[0]}   ⚔   赤焰 ${G.arena.counts[1]}`:'关隘封闭 · 第 10 / 20 波后开启';
  c.fillText(label,x,y+131);c.textAlign='left';
}

function drawMap(c, t) {
  const bg = c.createRadialGradient(CFG.W/2,CFG.H/2,50,CFG.W/2,CFG.H/2,CFG.H);
  bg.addColorStop(0,'#21342f'); bg.addColorStop(1,'#0b181b'); c.fillStyle=bg; c.fillRect(0,0,CFG.W,CFG.H);
  for (let i=0;i<170;i++) {
    const x=(i*173+17)%CFG.W,y=(i*97+51)%CFG.H;
    c.fillStyle=i%3?'#233b32':'#2d4638';
    c.beginPath(); c.arc(x,y,3+i%7,0,7); c.fill();
  }
  drawRiver(c,t);
  c.lineCap='round'; c.lineJoin='round';
  for (const k of G.kings) {
    const x=G.players.find(p=>p.team===k.team).exitX,color=TEAM_COLORS[k.team];
    drawStoneRoad(c,[[x,20],[x,CFG.H-20]]);
    drawStoneRoad(c,[[x,CFG.ROAD_Y],[k.x,CFG.ROAD_Y],[k.x,k.y]]);
    for(const [y,angle] of [[34,Math.PI/2],[640,Math.PI/2],[CFG.H-34,-Math.PI/2],[800,-Math.PI/2]])mapArrow(c,x,y,angle,color);
    mapArrow(c,(x+k.x)/2,CFG.ROAD_Y,x<k.x?0:Math.PI,color);
    mapArrow(c,k.x,(CFG.ROAD_Y+k.y)/2,k.y<CFG.ROAD_Y?-Math.PI/2:Math.PI/2,color);
  }
  drawBridge(c,t);
}
function mapArrow(c,x,y,angle,color='#ff665d') {
  c.save(); c.translate(x,y); c.rotate(angle); c.strokeStyle=color; c.lineWidth=3;c.globalAlpha=.65;
  for(const offset of [-8,3]){c.beginPath();c.moveTo(offset-5,-7);c.lineTo(offset+3,0);c.lineTo(offset-5,7);c.stroke();}c.restore();
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
  const zone=mineZone(p);c.fillStyle='#333b3e88';c.strokeStyle='#929ca0';c.lineWidth=2;
  roundRect(c,zone.x,zone.y,zone.w,zone.h,9);c.fill();c.stroke();
  const mineTop = minePosition(p, 0);
  c.textAlign = 'center'; c.font = '11px "Microsoft YaHei"';
  c.fillStyle = p.id === localPlayer().id ? '#e4ca87' : '#8b9d86';
  c.fillText(`${p.name} · 矿区 ${p.mines.length}/${MINE.LIMIT}`, zone.x+zone.w/2,zone.y+30);
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
  const bob = Math.sin(t * (f.moving?9:3) + hsh(f.uid + f.col + f.row) ) * (f.moving?2.5:1.4);
  c.fillStyle='#06100d66';c.beginPath();c.ellipse(f.x,f.y+19,14,6,0,0,7);c.fill();
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
  c.strokeStyle = '#f5a1c6'; c.lineWidth = 4;
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
