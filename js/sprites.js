'use strict';
/* ===== 程序化贴图工厂：全部美术用代码绘制并缓存到离屏画布（56x56） ===== */
const SPR = {};          // id -> canvas
const SPR_N = 56;        // 贴图画布尺寸

/* ---------- 调色板 ---------- */
const PAL = {
  fire:  { main: '#ff7043', dark: '#b53d20', light: '#ffc38a', glow: '#ffab40', skin: '#f2b48c' },
  water: { main: '#4fc3f7', dark: '#2079a8', light: '#c4ecff', glow: '#80d8ff', skin: '#e8c9b0' },
  earth: { main: '#c9975a', dark: '#7c5a2c', light: '#ecd3a0', glow: '#ffd54f', skin: '#d9b98c' },
  wind:  { main: '#8ed08a', dark: '#4e8a52', light: '#dcf5da', glow: '#c5f2a0', skin: '#e8d5b5' },
  foe:   { main: '#c14953', dark: '#7a2530', light: '#f0a9a2', glow: '#ff8a80' },
  metal: { main: '#cfd8dc', dark: '#78909c', light: '#ffffff', glow: '#eceff1' },
  gold:  { main: '#ffd54f', dark: '#b8860b', light: '#fff3c4', glow: '#ffe082' },
  purple:{ main: '#a273ff', dark: '#5e35b1', light: '#d9c4ff', glow: '#b388ff' },
};
const OUT = 'rgba(16,12,24,.95)';   // 统一描边色

/* ---------- 基础绘制工具 ---------- */
function mkc(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return cv; }

function pth(c, pts, fill, stroke, lw) {
  c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i][0], pts[i][1]);
  c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke !== false) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || 2; c.lineJoin = 'round'; c.stroke(); }
}
function circ(c, x, y, r, fill, stroke, lw) {
  c.beginPath(); c.arc(x, y, r, 0, 7);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke !== false) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || 2; c.stroke(); }
}
function ell(c, x, y, rx, ry, fill, stroke, lw) {
  c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, 7);
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke !== false) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || 2; c.stroke(); }
}
function rct(c, x, y, w, h, r, fill, stroke, lw) {
  c.beginPath();
  const rr = Math.min(r, w / 2, h / 2);
  c.moveTo(x + rr, y); c.arcTo(x + w, y, x + w, y + h, rr); c.arcTo(x + w, y + h, x, y + h, rr);
  c.arcTo(x, y + h, x, y, rr); c.arcTo(x, y, x + w, y, rr); c.closePath();
  if (fill) { c.fillStyle = fill; c.fill(); }
  if (stroke !== false) { c.strokeStyle = stroke || OUT; c.lineWidth = lw || 2; c.stroke(); }
}
function sh(c, x = 28, y = 51) {  // 脚下阴影
  c.globalAlpha = .3; ell(c, x, y, 13, 4, '#000', false); c.globalAlpha = 1;
}
function eyes(c, x, y, dx, r, col) {
  c.fillStyle = col || '#fff';
  circ(c, x - dx, y, r, col, false); circ(c, x + dx, y, r, col, false);
  c.fillStyle = OUT;
  circ(c, x - dx + .5, y + .3, r * .5, OUT, false); circ(c, x + dx + .5, y + .3, r * .5, OUT, false);
}
function angry(c, x, y, dx) {   // 怪物怒眉
  c.strokeStyle = OUT; c.lineWidth = 2; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - dx - 2, y - 4); c.lineTo(x - 1, y - 2); c.stroke();
  c.beginPath(); c.moveTo(x + dx + 2, y - 4); c.lineTo(x + 1, y - 2); c.stroke();
}

/* ---------- 武器 ---------- */
function wSword(c, x, y, len, col) {
  pth(c, [[x, y], [x + 3, y - len], [x + 6, y], [x + 3, y + 3]], col || PAL.metal.main);
  rct(c, x - 3, y + 3, 12, 3, 1, PAL.gold.main);
  rct(c, x + 1, y + 6, 4, 6, 1, '#5d4037');
}
function wSpear(c, x, y, len, tip) {
  c.strokeStyle = '#6d4c41'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 4, y + 8); c.lineTo(x + 4, y - len); c.stroke();
  pth(c, [[x + 1, y - len - 2], [x + 9, y - len + 1], [x + 3, y - len + 8]], tip || PAL.metal.main);
}
function wBow(c, x, y, col) {
  c.strokeStyle = col || '#8d6e63'; c.lineWidth = 2.5; c.lineCap = 'round';
  c.beginPath(); c.arc(x, y, 12, -1.9, 1.9); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x + Math.cos(-1.9) * 12, y + Math.sin(-1.9) * 12);
  c.lineTo(x + Math.cos(1.9) * 12, y + Math.sin(1.9) * 12); c.stroke();
}
function wStaff(c, x, y, orbCol, orbR) {
  c.strokeStyle = '#6d4c41'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y + 10); c.lineTo(x + 3, y - 14); c.stroke();
  c.globalAlpha = .5; circ(c, x + 3, y - 16, (orbR || 4) + 2.5, orbCol, false); c.globalAlpha = 1;
  circ(c, x + 3, y - 16, orbR || 4, orbCol, OUT, 1.5);
  circ(c, x + 1.6, y - 17.4, 1.2, 'rgba(255,255,255,.85)', false);
}
function wCrossbow(c, x, y, big) {
  const L = big ? 18 : 12;
  c.strokeStyle = '#5d4037'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5, y - 12); c.stroke();
  c.strokeStyle = '#8d6e63'; c.lineWidth = 2.5;
  c.beginPath(); c.moveTo(x + 5 - L * .45, y - 16); c.quadraticCurveTo(x + 5, y - 22, x + 5 + L * .45, y - 16); c.stroke();
  c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1;
  c.beginPath(); c.moveTo(x + 5 - L * .42, y - 16); c.lineTo(x + 5 + L * .42, y - 16); c.stroke();
}
function wTrident(c, x, y) {
  c.strokeStyle = '#5d4037'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(x - 2, y + 10); c.lineTo(x + 2, y - 12); c.stroke();
  c.strokeStyle = PAL.metal.main; c.lineWidth = 2.5;
  for (const [dx, dy] of [[-6, -18], [0, -21], [6, -18]]) {
    c.beginPath(); c.moveTo(x + 2 + dx * .6, y - 8); c.lineTo(x + 2 + dx, y + dy * -1 + -6); c.stroke();
  }
}
function wClaws(c, x, y, col) {
  c.strokeStyle = col || '#eceff1'; c.lineWidth = 2; c.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    c.beginPath(); c.arc(x + i * 4, y, 6, -0.5, 1.2); c.stroke();
  }
}

/* ---------- 主体形态 ---------- */

/* 人形（弓手/法师/祭司等）：o={pal,robe,hood,hat,helm,cape,weapon,staff,skin,scale,glowEye} */
function human(c, o) {
  const s = o.scale || 1, cx = 28, feet = 50, P = o.pal;
  sh(c, cx, feet);
  if (o.cape) { pth(c, [[cx - 6 * s, feet - 24 * s], [cx + 6 * s, feet - 24 * s], [cx + 9 * s, feet - 1], [cx - 9 * s, feet - 1]], o.cape, OUT); }
  // 腿
  c.fillStyle = P.dark;
  rct(c, cx - 5 * s, feet - 9 * s, 4 * s, 9 * s, 1.5, P.dark);
  rct(c, cx + 1 * s, feet - 9 * s, 4 * s, 9 * s, 1.5, P.dark);
  // 身体（长袍或短甲）
  if (o.robe) {
    pth(c, [[cx - 6 * s, feet - 22 * s], [cx + 6 * s, feet - 22 * s], [cx + 9 * s, feet - 1], [cx - 9 * s, feet - 1]], P.main, OUT);
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(cx, feet - 20 * s); c.lineTo(cx, feet - 4 * s); c.stroke();
  } else {
    rct(c, cx - 7 * s, feet - 22 * s, 14 * s, 14 * s, 4, P.main);
    rct(c, cx - 7 * s, feet - 10 * s, 14 * s, 3 * s, 1, P.dark, false);
  }
  // 肩
  circ(c, cx - 7 * s, feet - 21 * s, 3.2 * s, P.light, OUT, 1.5);
  circ(c, cx + 7 * s, feet - 21 * s, 3.2 * s, P.light, OUT, 1.5);
  // 头
  const hy = feet - 28 * s;
  circ(c, cx, hy, 6.4 * s, o.skin || P.skin || '#e8bf93', OUT);
  // 头饰
  if (o.hood) {
    pth(c, [[cx - 7 * s, hy + 2 * s], [cx, hy - 8 * s], [cx + 7 * s, hy + 2 * s], [cx + 5 * s, hy + 6 * s], [cx - 5 * s, hy + 6 * s]], P.dark, OUT);
    eyes(c, cx, hy + 1, 2.4 * s, 1.6 * s, o.glowEye || '#fff');
  } else if (o.hat) {
    pth(c, [[cx - 8 * s, hy - 2 * s], [cx, hy - 13 * s], [cx + 8 * s, hy - 2 * s]], P.dark, OUT);
    ell(c, cx, hy - 2 * s, 9 * s, 2 * s, P.dark, OUT);
    eyes(c, cx, hy + 1, 2.2 * s, 1.5 * s);
  } else if (o.helm) {
    c.beginPath(); c.arc(cx, hy - .5 * s, 7 * s, Math.PI, 0); c.fillStyle = PAL.metal.main; c.fill(); c.strokeStyle = OUT; c.stroke();
    circ(c, cx, hy + 1.5 * s, 6 * s, P.skin || '#e8bf93', false);
    eyes(c, cx, hy + 1, 2.2 * s, 1.5 * s);
  } else {
    // 头发
    c.beginPath(); c.arc(cx, hy - 1, 6.6 * s, Math.PI * 1.05, Math.PI * 1.95); c.fillStyle = P.dark; c.fill();
    eyes(c, cx, hy + 1, 2.3 * s, 1.5 * s);
  }
  // 武器
  const wx = cx + 9 * s, wy = feet - 14 * s;
  if (o.weapon === 'sword') wSword(c, wx - 4, wy, 16 * s);
  if (o.weapon === 'spear') wSpear(c, wx - 5, wy + 2, 15 * s);
  if (o.weapon === 'bow') wBow(c, wx - 2, wy + 2, '#8d6e63');
  if (o.weapon === 'crossbow') wCrossbow(c, wx - 4, wy + 4, o.bigWeapon);
  if (o.weapon === 'staff') wStaff(c, wx - 3, wy + 2, P.glow, 4);
  if (o.weapon === 'trident') wTrident(c, wx - 5, wy + 2);
}

/* 石魔构装体（石头人/熔岩武士等）：o={pal,cracks,helmet,shield,big} */
function construct(c, o) {
  const s = o.big ? 1.22 : 1, cx = 28, feet = 50, P = o.pal;
  sh(c, cx, feet);
  // 粗腿
  rct(c, cx - 9 * s, feet - 8 * s, 6 * s, 8 * s, 2, P.dark);
  rct(c, cx + 3 * s, feet - 8 * s, 6 * s, 8 * s, 2, P.dark);
  // 大块躯干
  rct(c, cx - 12 * s, feet - 26 * s, 24 * s, 19 * s, 6, P.main);
  // 胸口高光
  ell(c, cx - 4 * s, feet - 21 * s, 5 * s, 3.5 * s, 'rgba(255,255,255,.22)', false);
  // 裂纹/熔岩纹
  c.strokeStyle = o.cracks || 'rgba(0,0,0,.3)'; c.lineWidth = 1.8; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - 7 * s, feet - 24 * s); c.lineTo(cx - 3 * s, feet - 18 * s); c.lineTo(cx - 6 * s, feet - 13 * s); c.stroke();
  c.beginPath(); c.moveTo(cx + 5 * s, feet - 22 * s); c.lineTo(cx + 8 * s, feet - 15 * s); c.stroke();
  // 拳头
  circ(c, cx - 13 * s, feet - 12 * s, 4.5 * s, P.dark, OUT, 1.5);
  circ(c, cx + 13 * s, feet - 12 * s, 4.5 * s, P.dark, OUT, 1.5);
  // 头（嵌在躯干上）
  const hy = feet - 31 * s;
  rct(c, cx - 6 * s, hy - 3 * s, 12 * s, 9 * s, 3, P.light === '#fff' ? P.main : P.light);
  if (o.helmet) {
    rct(c, cx - 7 * s, hy - 5 * s, 14 * s, 5 * s, 2, PAL.metal.main);
    c.fillStyle = OUT;
    rct(c, cx - 4 * s, hy - 1 * s, 8 * s, 2 * s, 1, OUT, false);
  } else {
    eyes(c, cx, hy + 1, 2.6 * s, 1.8 * s, o.glowEye || '#ffd54f');
  }
  if (o.shield) {
    ell(c, cx - 13 * s, feet - 17 * s, 4 * s, 6 * s, PAL.metal.main, OUT, 1.5);
    circ(c, cx - 13 * s, feet - 17 * s, 1.6 * s, PAL.gold.main, false);
  }
}

/* 元素体（火苗/云朵）：o={type:'flame'|'cloud',pal,big,crown} */
function elemental(c, o) {
  const s = (o.big ? 1.15 : 1), cx = 28, base = 50, P = o.pal;
  sh(c, cx, base);
  if (o.type === 'flame') {
    // 火苗轮廓
    pth(c, [
      [cx, base - 36 * s],
      [cx + 9 * s, base - 22 * s], [cx + 11 * s, base - 10 * s],
      [cx + 5 * s, base - 2 * s], [cx - 5 * s, base - 2 * s],
      [cx - 11 * s, base - 10 * s], [cx - 9 * s, base - 22 * s],
    ], P.main, OUT);
    // 内焰
    pth(c, [
      [cx, base - 26 * s], [cx + 5 * s, base - 16 * s], [cx + 3 * s, base - 6 * s],
      [cx - 3 * s, base - 6 * s], [cx - 5 * s, base - 16 * s],
    ], P.light, false);
    eyes(c, cx, base - 15 * s, 3 * s, 2 * s, '#fff');
    angry(c, cx, base - 18 * s, 3.5 * s);
    if (o.crown) {  // 火冠
      pth(c, [[cx - 7 * s, base - 32 * s], [cx - 4 * s, base - 40 * s], [cx, base - 34 * s], [cx + 4 * s, base - 40 * s], [cx + 7 * s, base - 32 * s]], PAL.gold.glow, OUT);
    }
  } else {
    // 云朵
    const cy = base - 16 * s;
    circ(c, cx - 9 * s, cy + 2 * s, 7 * s, P.main, OUT);
    circ(c, cx + 9 * s, cy + 2 * s, 7 * s, P.main, OUT);
    circ(c, cx, cy - 3 * s, 10 * s, P.main, OUT);
    ell(c, cx, cy + 5 * s, 13 * s, 6 * s, P.main, OUT);
    ell(c, cx - 3 * s, cy - 6 * s, 5 * s, 3 * s, 'rgba(255,255,255,.5)', false);
    eyes(c, cx, cy, 3.4 * s, 2 * s, '#fff');
    if (o.bolt) {  // 闪电
      pth(c, [[cx - 2, cy + 8 * s], [cx + 4, cy + 8 * s], [cx, cy + 13 * s], [cx + 5, cy + 13 * s], [cx - 4, cy + 22 * s], [cx - 1, cy + 14 * s], [cx - 6, cy + 14 * s]], '#ffe57f', OUT, 1.5);
    }
  }
}

/* 野兽（狼系）：o={pal,big,mane} */
function beast(c, o) {
  const s = (o.big ? 1.18 : 1), cx = 28, feet = 50, P = o.pal;
  sh(c, cx, feet);
  // 后腿/身体
  ell(c, cx, feet - 12 * s, 11 * s, 8 * s, P.main, OUT);
  rct(c, cx - 9 * s, feet - 8 * s, 5 * s, 8 * s, 2, P.dark);
  rct(c, cx + 5 * s, feet - 8 * s, 5 * s, 8 * s, 2, P.dark);
  // 尾巴
  c.strokeStyle = P.dark; c.lineWidth = 3.5 * s; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx - 10 * s, feet - 14 * s); c.quadraticCurveTo(cx - 17 * s, feet - 20 * s, cx - 14 * s, feet - 26 * s); c.stroke();
  // 鬃毛
  if (o.mane) {
    for (let i = -2; i <= 2; i++) {
      pth(c, [[cx + i * 3 - 2, feet - 20 * s], [cx + i * 3 + 1, feet - 27 * s], [cx + i * 3 + 4, feet - 20 * s]], P.dark, false);
    }
  }
  // 前爪+利爪
  rct(c, cx + 6 * s, feet - 16 * s, 5 * s, 10 * s, 2, P.main);
  wClaws(c, cx + 9 * s, feet - 5 * s, '#eceff1');
  // 头
  const hx = cx + 5 * s, hy = feet - 22 * s;
  circ(c, hx, hy, 6.5 * s, P.main, OUT);
  // 耳朵
  pth(c, [[hx - 5 * s, hy - 4 * s], [hx - 6 * s, hy - 11 * s], [hx - 1 * s, hy - 6 * s]], P.main, OUT);
  pth(c, [[hx + 2 * s, hy - 6 * s], [hx + 5 * s, hy - 11 * s], [hx + 6 * s, hy - 4 * s]], P.main, OUT);
  // 吻部
  ell(c, hx + 4 * s, hy + 3 * s, 4 * s, 3 * s, P.light, OUT, 1.5);
  c.fillStyle = OUT; circ(c, hx + 7 * s, hy + 2 * s, 1.3 * s, OUT, false);
  // 怒眼
  eyes(c, hx + 1 * s, hy - 1 * s, 2.6 * s, 1.7 * s, o.glowEye || '#ffe082');
  angry(c, hx, hy - 4 * s, 3 * s);
  if (o.scar) { c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.moveTo(hx + 1, hy - 5); c.lineTo(hx + 4, hy + 1); c.stroke(); }
}

/* 有翼生物（凤凰/飞龙/鹰眼）：o={pal,crest,tail,beak,humanoidBow} */
function winged(c, o) {
  const cx = 28, feet = 50, P = o.pal;
  sh(c, cx, feet);
  // 展开的翅膀（左右对称羽翼）
  for (const dir of [-1, 1]) {
    c.save(); c.translate(cx, feet - 26); c.scale(dir, 1);
    pth(c, [[2, -2], [16, -12], [21, -4], [15, -1], [20, 7], [11, 6], [3, 10]], P.dark, OUT);
    c.restore();
  }
  // 身体
  ell(c, cx, feet - 15, 8, 11, P.main, OUT);
  ell(c, cx, feet - 10, 5, 6, P.light, false);
  // 头
  const hy = feet - 29;
  circ(c, cx, hy, 6, P.main, OUT);
  if (o.crest) {  // 凤冠
    pth(c, [[cx - 3, hy - 4], [cx - 6, hy - 12], [cx - 1, hy - 7], [cx, hy - 13], [cx + 1, hy - 7], [cx + 6, hy - 12], [cx + 3, hy - 4]], P.glow, OUT, 1.5);
  }
  if (o.beak) pth(c, [[cx + 4, hy - 1], [cx + 11, hy + 1], [cx + 4, hy + 3]], PAL.gold.main, OUT, 1.5);
  eyes(c, cx + 1, hy - 1, 2.4, 1.5, o.glowEye || '#fff');
  if (o.tail) { // 尾羽
    for (let i = -1; i <= 1; i++) {
      c.strokeStyle = i === 0 ? P.glow : P.dark; c.lineWidth = 2.5; c.lineCap = 'round';
      c.beginPath(); c.moveTo(cx, feet - 6); c.quadraticCurveTo(cx + i * 8, feet + 2, cx + i * 12, feet - 2); c.stroke();
    }
  }
  if (o.humanoidBow) wBow(c, cx + 13, feet - 16, '#5d4037');
}

/* 海妖特制 */
function krakenSpr(c) {
  const cx = 28, base = 46, P = PAL.water;
  sh(c, cx, 50);
  // 触手
  for (let i = -3; i <= 3; i++) {
    if (i === 0) continue;
    c.strokeStyle = P.dark; c.lineWidth = 3.2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx + i * 4, base - 4);
    c.quadraticCurveTo(cx + i * 7, base + 6, cx + i * 5, base + 9 - Math.abs(i));
    c.stroke();
    circ(c, cx + i * 5, base + 9 - Math.abs(i), 1.4, P.light, false);
  }
  // 头罩
  c.beginPath(); c.moveTo(cx - 11, base - 2);
  c.quadraticCurveTo(cx - 12, base - 20, cx, base - 22);
  c.quadraticCurveTo(cx + 12, base - 20, cx + 11, base - 2);
  c.quadraticCurveTo(cx, base + 5, cx - 11, base - 2);
  c.closePath(); c.fillStyle = P.main; c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke();
  ell(c, cx - 4, base - 15, 3.4, 5, 'rgba(255,255,255,.28)', false);
  eyes(c, cx, base - 10, 3.4, 2.2, '#eaffff');
  angry(c, cx, base - 14, 4);
}

/* 怪物（敌方/雇佣兵）：o={pal,body:'blob'|'lean'|'muscle'|'dome'|'imp'|'ghost',horns,crown,glow,orb,wings} */
function monster(c, o) {
  const cx = 28, feet = 50, P = o.pal;
  sh(c, cx, feet);
  if (o.wings) {
    for (const dir of [-1, 1]) {
      pth(c, [[cx + dir * 5, feet - 30], [cx + dir * 18, feet - 38], [cx + dir * 20, feet - 28], [cx + dir * 10, feet - 22]], P.dark, OUT);
    }
  }
  if (o.body === 'lean') {
    // 疾行者：细长蜥蜴
    pth(c, [[cx - 6, feet - 3], [cx - 9, feet - 18], [cx - 3, feet - 30], [cx + 5, feet - 30], [cx + 9, feet - 18], [cx + 6, feet - 3]], P.main, OUT);
    pth(c, [[cx - 9, feet - 18], [cx - 15, feet - 26], [cx - 11, feet - 15]], P.dark, OUT, 1.5);  // 背鳍
    pth(c, [[cx + 9, feet - 18], [cx + 15, feet - 26], [cx + 11, feet - 15]], P.dark, OUT, 1.5);
    eyes(c, cx, feet - 26, 2.8, 1.8, o.glowEye || '#ffeb3b'); angry(c, cx, feet - 29, 3.2);
    pth(c, [[cx - 3, feet - 20], [cx + 3, feet - 20], [cx, feet - 16]], P.dark, false);
  } else if (o.body === 'muscle' || o.body === 'dome') {
    const r = o.body === 'dome' ? 13 : 12;
    // 健壮怪/装甲壳
    ell(c, cx, feet - 13, r, 12, P.main, OUT);
    ell(c, cx - 4, feet - 17, 4, 5, 'rgba(255,255,255,.2)', false);
    if (o.body === 'dome') {  // 甲壳纹
      c.strokeStyle = P.dark; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cx - 10, feet - 13); c.quadraticCurveTo(cx, feet - 27, cx + 10, feet - 13); c.stroke();
      c.beginPath(); c.moveTo(cx - 8, feet - 8); c.quadraticCurveTo(cx, feet - 18, cx + 8, feet - 8); c.stroke();
    } else {
      circ(c, cx - 12, feet - 8, 4, P.dark, OUT, 1.5); circ(c, cx + 12, feet - 8, 4, P.dark, OUT, 1.5);
    }
    eyes(c, cx, feet - 17, 3, 2, o.glowEye || '#fff'); angry(c, cx, feet - 21, 3.5);
    if (o.orb) { circ(c, cx, feet - 10, 3, o.orb, OUT, 1.5); }
  } else if (o.body === 'imp') {
    ell(c, cx, feet - 12, 8, 9, P.main, OUT);
    eyes(c, cx, feet - 15, 2.6, 1.7, '#ffe082'); angry(c, cx, feet - 18, 3);
    wClaws(c, cx, feet - 4, P.light);
  } else if (o.body === 'ghost') {
    c.globalAlpha = .9;
    pth(c, [[cx - 9, feet - 6], [cx - 9, feet - 20], [cx, feet - 30], [cx + 9, feet - 20], [cx + 9, feet - 6], [cx + 5, feet - 9], [cx, feet - 5], [cx - 5, feet - 9]], P.main, OUT);
    c.globalAlpha = 1;
    eyes(c, cx, feet - 19, 3, 2.2, P.glow || '#fff');
    c.strokeStyle = P.glow || P.light; c.lineWidth = 1.5;
    c.beginPath(); c.ellipse(cx, feet - 16, 13, 13, 0, 0, 7); c.globalAlpha = .4; c.stroke(); c.globalAlpha = 1;
  } else {  // blob 史莱姆/小怪
    pth(c, [[cx - 10, feet - 3], [cx - 11, feet - 14], [cx - 5, feet - 24], [cx + 5, feet - 24], [cx + 11, feet - 14], [cx + 10, feet - 3]], P.main, OUT);
    ell(c, cx - 4, feet - 18, 3, 4, 'rgba(255,255,255,.25)', false);
    if (o.bubbles) { circ(c, cx + 4, feet - 18, 1.6, P.light, false); circ(c, cx - 2, feet - 12, 1.2, P.light, false); }
    eyes(c, cx, feet - 15, 3, 2, o.glowEye || '#fff'); angry(c, cx, feet - 19, 3.5);
    if (o.teeth) { pth(c, [[cx - 3, feet - 9], [cx + 3, feet - 9], [cx, feet - 6]], '#fff', OUT, 1); }
  }
  // 角/王冠
  if (o.horns) {
    pth(c, [[cx - 8, feet - 22], [cx - 13, feet - 32], [cx - 5, feet - 25]], P.dark === '#5e35b1' ? '#3c2a70' : '#4a2a30', OUT);
    pth(c, [[cx + 8, feet - 22], [cx + 13, feet - 32], [cx + 5, feet - 25]], '#4a2a30', OUT);
  }
  if (o.crown) {
    pth(c, [[cx - 8, feet - 26], [cx - 5, feet - 34], [cx, feet - 28], [cx + 5, feet - 34], [cx + 8, feet - 26]], PAL.gold.main, OUT);
    circ(c, cx, feet - 30, 1.6, '#ff5252', false);
  }
}

/* 国王 */
function kingSpr(c, team) {
  const P = team === 0 ? PAL.water : PAL.fire;
  const gold = PAL.gold, cx = 28, feet = 50;
  sh(c, cx, feet);
  // 披风
  pth(c, [[cx - 9, feet - 30], [cx + 9, feet - 30], [cx + 14, feet - 1], [cx - 14, feet - 1]], P.dark, OUT);
  // 腿甲
  rct(c, cx - 6, feet - 9, 5, 9, 2, PAL.metal.main);
  rct(c, cx + 1, feet - 9, 5, 9, 2, PAL.metal.main);
  // 胸甲
  rct(c, cx - 9, feet - 27, 18, 19, 5, PAL.metal.main);
  ell(c, cx, feet - 18, 3.4, 4.4, gold.main, OUT, 1.5);   // 徽章
  rct(c, cx - 9, feet - 11, 18, 3, 1, gold.main);
  // 肩甲
  ell(c, cx - 10, feet - 26, 4.4, 3.4, gold.main, OUT);
  ell(c, cx + 10, feet - 26, 4.4, 3.4, gold.main, OUT);
  // 战锤
  c.strokeStyle = '#5d4037'; c.lineWidth = 3; c.lineCap = 'round';
  c.beginPath(); c.moveTo(cx + 13, feet - 2); c.lineTo(cx + 15, feet - 24); c.stroke();
  rct(c, cx + 10, feet - 30, 11, 7, 2, PAL.metal.light, OUT);
  // 头 + 王冠
  const hy = feet - 34;
  circ(c, cx, hy, 6, '#e8bf93', OUT);
  pth(c, [[cx - 7, hy - 3], [cx - 5, hy - 12], [cx - 1, hy - 6], [cx, hy - 13], [cx + 1, hy - 6], [cx + 5, hy - 12], [cx + 7, hy - 3]], gold.main, OUT);
  eyes(c, cx, hy + 1, 2.3, 1.5, P.glow);
}

/* ---------- 组装全部贴图 ---------- */
function buildSprites() {
  const mk = (id, fn) => { const cv = mkc(SPR_N, SPR_N); fn(cv.getContext('2d')); SPR[id] = cv; };

  /* 火 */
  mk('fire_elem', c => elemental(c, { type: 'flame', pal: PAL.fire }));
  mk('fire_lord', c => elemental(c, { type: 'flame', pal: PAL.fire, big: 1, crown: 1 }));
  mk('lava_warrior', c => construct(c, { pal: PAL.fire, cracks: '#ffca62' }));
  mk('lava_giant', c => construct(c, { pal: PAL.fire, cracks: '#ffca62', big: 1, glowEye: '#ffca62' }));
  mk('flame_archer', c => human(c, { pal: PAL.fire, robe: 1, hood: 1, weapon: 'bow' }));
  mk('sniper', c => human(c, { pal: PAL.fire, robe: 1, hat: 1, weapon: 'crossbow', bigWeapon: 1, glowEye: '#ffe082' }));
  mk('phoenix', c => winged(c, { pal: PAL.fire, crest: 1, tail: 1, beak: 1, glowEye: '#fff59d' }));

  /* 水 */
  mk('water_nymph', c => human(c, { pal: PAL.water, robe: 1, weapon: 'staff' }));
  mk('tide_maiden', c => human(c, { pal: PAL.water, robe: 1, cape: PAL.water.dark, weapon: 'trident' }));
  mk('coral_guard', c => construct(c, { pal: PAL.water, helmet: 1, shield: 1 }));
  mk('deep_giant', c => construct(c, { pal: PAL.water, big: 1, glowEye: '#b3e5fc' }));
  mk('ice_mage', c => human(c, { pal: { main: '#81d4fa', dark: '#3d8eb4', light: '#e1f5fe', glow: '#b3ecff', skin: '#e8c9b0' }, robe: 1, hat: 1, weapon: 'staff' }));
  mk('kraken', c => krakenSpr(c));

  /* 土 */
  mk('golem', c => construct(c, { pal: PAL.earth }));
  mk('rock_guard', c => construct(c, { pal: PAL.earth, helmet: 1, shield: 1 }));
  mk('earth_priest', c => human(c, { pal: { main: '#9c8b5e', dark: '#5d5030', light: '#cfc093', glow: '#a5d6a7', skin: '#d9b98c' }, robe: 1, hood: 1, weapon: 'staff' }));
  mk('prophet', c => human(c, { pal: { main: '#8b9c5e', dark: '#4c5d30', light: '#cfe0a8', glow: '#e6ffb3', skin: '#d9b98c' }, robe: 1, cape: '#5d5030', weapon: 'staff' }));
  mk('thorn_archer', c => human(c, { pal: { main: '#7cb342', dark: '#43671e', light: '#c0e8a0', glow: '#d9ff9e', skin: '#cbe6a0' }, robe: 1, hood: 1, weapon: 'bow' }));
  mk('siege_ballista', c => construct(c, { pal: PAL.earth, helmet: 1, big: 1 }));
  mk('titan', c => construct(c, { pal: { main: '#a9825e', dark: '#6d4a2c', light: '#e0c49a', glow: '#ffd54f' }, big: 1, helmet: 1, glowEye: '#ffd54f' }));

  /* 风 */
  mk('wind_elem', c => elemental(c, { type: 'cloud', pal: PAL.wind }));
  mk('storm', c => elemental(c, { type: 'cloud', pal: { main: '#90caf9', dark: '#5470a8', light: '#e3f2fd', glow: '#ffe57f' }, bolt: 1 }));
  mk('wolf_rider', c => beast(c, { pal: { main: '#9aa86e', dark: '#5c6b3a', light: '#d4e0b0', glow: '#ffe082' } }));
  mk('alpha_wolf', c => beast(c, { pal: { main: '#8a9862', dark: '#4c5a2e', light: '#c8d8a0', glow: '#ffab40' }, big: 1, mane: 1, scar: 1, glowEye: '#ffab40' }));
  mk('eagle_eye', c => winged(c, { pal: { main: '#b0bec5', dark: '#607d8b', light: '#eceff1', glow: '#80d8ff' }, beak: 1, humanoidBow: 1, glowEye: '#80d8ff' }));
  mk('storm_lord', c => human(c, { pal: { main: '#7986cb', dark: '#3949ab', light: '#c5cae9', glow: '#ffe57f', skin: '#e8d5b5' }, robe: 1, hat: 1, weapon: 'staff', glowEye: '#ffe57f' }));

  /* 敌方（按波次特性选形象） */
  mk('en_grunt', c => monster(c, { pal: PAL.foe, body: 'blob', horns: 1, teeth: 1 }));
  mk('en_runner', c => monster(c, { pal: { main: '#d4a24c', dark: '#8c5a1e', light: '#ffe0a0', glow: '#ffeb3b' }, body: 'lean' }));
  mk('en_brute', c => monster(c, { pal: { main: '#b5651d', dark: '#6e3a10', light: '#e8b078', glow: '#ffab40' }, body: 'muscle' }));
  mk('en_knight', c => monster(c, { pal: { main: '#8d99ae', dark: '#4a5568', light: '#ced4da', glow: '#ff8a80' }, body: 'dome' }));
  mk('en_shaman', c => monster(c, { pal: PAL.purple, body: 'blob', horns: 1, orb: '#b388ff' }));
  mk('en_slime', c => monster(c, { pal: { main: '#7cc48a', dark: '#3f7a4c', light: '#c8f0cf', glow: '#d0f5d8' }, body: 'blob', bubbles: 1 }));
  mk('en_ghost', c => monster(c, { pal: { main: '#9575cd', dark: '#5e35b1', light: '#d9c4ff', glow: '#e8ddff' }, body: 'ghost' }));
  mk('en_bat', c => monster(c, { pal: { main: '#a1887f', dark: '#5d4037', light: '#d7ccc8', glow: '#ffab40' }, body: 'imp', wings: 1 }));
  mk('en_boss', c => monster(c, { pal: { main: '#a03040', dark: '#5c1520', light: '#e07878', glow: '#ff5252' }, body: 'muscle', horns: 1, crown: 1, glowEye: '#ff5252' }));

  /* 雇佣兵 */
  mk('m_imp', c => monster(c, { pal: { main: '#c0576b', dark: '#701f30', light: '#eb9aab', glow: '#ffe082' }, body: 'imp', horns: 1, wings: 1 }));
  mk('m_bandit', c => human(c, { pal: { main: '#8d6e63', dark: '#4e342e', light: '#bcaaa4', glow: '#ffab40', skin: '#c9a07a' }, robe: 1, hood: 1, weapon: 'sword' }));
  mk('m_stone', c => construct(c, { pal: { main: '#90a4ae', dark: '#546e7a', light: '#cfd8dc', glow: '#ff8a80' } }));
  mk('m_wyvern', c => winged(c, { pal: { main: '#a1887f', dark: '#5d4037', light: '#d7ccc8', glow: '#ff7043' }, crest: 1, tail: 1, beak: 0 }));
  mk('m_abyss', c => monster(c, { pal: { main: '#6a3ab0', dark: '#31125c', light: '#a982d8', glow: '#b388ff' }, body: 'muscle', horns: 1, glowEye: '#d1b3ff' }));
  mk('m_ancient', c => construct(c, { pal: { main: '#4e6e58', dark: '#274234', light: '#93b8a0', glow: '#a5d6a7' }, big: 1, helmet: 1, glowEye: '#a5d6a7' }));

  /* 国王 */
  mk('king_0', c => kingSpr(c, 0));
  mk('king_1', c => kingSpr(c, 1));
}

/* 把贴图按尺寸画到目标画布（头像用） */
function drawPortrait(cv, id, size) {
  const c = cv.getContext('2d');
  c.clearRect(0, 0, size, size);
  c.drawImage(SPR[id], 0, 0, size, size);
}

/* 根据波次定义选敌人贴图 */
function enemySpriteId(e) {
  if (e.mercId) return 'm_' + e.mercId;
  const t = e.trait;
  if (t === 'boss') return 'en_boss';
  if (t === 'ranged') return 'en_shaman';
  if (t === 'fast') return 'en_runner';
  if (t === 'regen') return 'en_slime';
  if (t === 'magic') return 'en_ghost';
  if (t === 'heavy') return 'en_knight';
  if (t === 'swarm') return 'en_bat';
  return (e.armor === '重甲') ? 'en_brute' : 'en_grunt';
}
