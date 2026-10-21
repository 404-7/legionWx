'use strict';
/* ===== 战斗引擎：状态、波次流程、自动战斗、经济、国王 ===== */
let G = null;

function layoutFor(playerIndex) {
  const right = playerIndex >= 2, bottom = playerIndex % 2 === 1;
  const fx = right ? 870 : 130, fy = bottom ? 460 : 44;
  return { fx, fy, gx: fx + 36, gy: fy + 40 };
}

function newGame(diffKey) {
  const diff = CFG.DIFFS[diffKey] || CFG.DIFFS.normal;
  const names = ['你', '盟友·岚', '红将·焰', '红将·岳'];
  G = {
    phase: 'prep', diffKey, diff,
    wave: 0, timer: 0, timerMax: 1,
    speed: 1, paused: false, combatT: 0,
    players: [], kings: [], projectiles: [], floaters: [], fx: [],
    selectedShop: null, selectedFighter: null,
    hover: null, logLines: [],
    waveDef: null, result: null,
  };
  for (let i = 0; i < 4; i++) {
    const L = layoutFor(i);
    G.players.push({
      id: i, team: i < 2 ? 0 : 1, name: names[i], isHuman: i === 0,
      gold: CFG.START_GOLD, income: CFG.START_INCOME, kingLvl: 0,
      fx: L.fx, fy: L.fy, gx: L.gx, gy: L.gy,
      exitX: L.fx + 150, exitY: i % 2 ? 444 : 356,
      spawnX: L.fx + 150, spawnY: i % 2 ? 764 : 36,
      direction: i % 2 ? -1 : 1,
      fighters: [], enemies: [], mercQueue: [],
      spawnList: [], spawnT: 0, spawnIv: 1, paid: true,
      ai: null, aiT: 0,
    });
  }
  G.kings = [0, 1].map(t => ({
    team: t, x: t === 0 ? 550 : 750, y: 400,
    hp: CFG.KING_HP, max: CFG.KING_HP, lvl: 0, cd: 0, flash: 0, leaks: [],
    dmg: CFG.KING_DMG, aspd: CFG.KING_ASPD,
  }));
  aiSetupAll();
  addLog('战斗开始！守护本队国王。', 'l-blue');
  startPrep();
  return G;
}

/* ---------- 流程 ---------- */
function gainMult(p) {
  if (p.isHuman) return 1;
  return p.team === 0 ? G.diff.allyMult : G.diff.aiMult;
}

function startPrep() {
  G.wave++;
  G.waveDef = waveDefFor(G.wave);
  for (const p of G.players) {
    const inc = Math.round(p.income * gainMult(p));
    p.gold += inc;
    p.paid = true;
    p.enemies = []; p.spawnList = [];
    if (p.isHuman && G.wave > 1) addLog(`${p.name} 收入结算 +${inc} 金`, 'l-gold');
  }
  G.timerMax = G.wave === 1 ? CFG.FIRST_PREP : CFG.PREP_TIME;
  G.timer = G.timerMax;
  G.phase = 'prep';
  G.players.forEach((p, i) => { if (p.ai) p.aiT = 0.5 + i * 0.4; });
}

function startCombat() {
  G.phase = 'combat';
  G.combatT = 0;
  const iv = Math.max(0.5, 1.15 - G.wave * 0.012);
  for (const p of G.players) {
    p.paid = false;
    p.leakCount = 0;
    p.spawnIv = iv; p.spawnT = 0.2;
    p.spawnList = [];
    for (let i = 0; i < G.waveDef.count; i++) p.spawnList.push({ type: 'wave' });
    for (const mid of p.mercQueue) p.spawnList.push({ type: 'merc', id: mid });
    p.mercQueue = [];
  }
  addLog(`⚔ 第 ${G.wave} 波来袭！`, 'l-red');
}

function endWave() {
  for (const k of G.kings) {
    k.hp = Math.min(k.max, k.hp + CFG.KING_REGEN + k.lvl * 8);
    k.leaks = [];
  }
  // 每波结束战士满血复活（阵亡的不回来）
  for (const p of G.players) for (const f of p.fighters) {
    f.hp = f.max; f.deadT = 0; f.reincUsed = false; f.cd = 0.3;
  }
  if (G.wave >= CFG.TOTAL_WAVES && !G.result) {
    const a = G.kings[0].hp / G.kings[0].max, b = G.kings[1].hp / G.kings[1].max;
    if (Math.abs(a - b) >= 0.02) { gameOver(a > b ? 0 : 1); return; }
    addLog('双方国王血量接近，进入加时赛！', 'l-gold');
  }
  startPrep();
}

function gameOver(winner) {
  G.result = { winner };
  G.phase = 'over';
  addLog(winner === 0 ? '🏆 蓝方胜利！' : '💀 蓝方战败…', winner === 0 ? 'l-green' : 'l-red');
  if (typeof showOverlay === 'function') showOverlay('result');
}

function checkOver() {
  for (const k of G.kings) if (k.hp <= 0) { gameOver(1 - k.team); return true; }
  return false;
}

/* ---------- 波次定义 ---------- */
function waveDefFor(w) {
  let d;
  if (w <= CFG.TOTAL_WAVES) {
    d = { ...WAVES[w - 1] };
  } else {
    const base = WAVES[(w - 1) % CFG.TOTAL_WAVES];
    const m = Math.pow(CFG.OVERTIME_GROW, w - CFG.TOTAL_WAVES);
    d = { ...base, hp: base.hp * m, dmg: base.dmg * m, trait: null, boss: false, magicImmune: false, regen: 0, count: base.count };
    if (base.trait === 'boss') d.count = 1;
  }
  d.hp = Math.round(d.hp * G.diff.emult);
  d.dmg = Math.round(d.dmg * G.diff.emult);
  return d;
}

/* ---------- 模拟主循环 ---------- */
function simStep(dt) {
  if (G.phase === 'prep') {
    G.timer -= dt;
    for (const p of G.players) {
      if (!p.ai) continue;
      p.aiT -= dt;
      if (p.aiT <= 0) { aiAct(p); p.aiT = 1.4 + Math.random(); }
    }
    if (G.timer <= 0) startCombat();
  } else if (G.phase === 'combat') {
    G.combatT += dt;
    for (const p of G.players) fieldStep(p, dt);
    for (const k of G.kings) { kingStep(k, dt); if (G.phase === 'over') return; }
    G.projectiles = G.projectiles.filter(pr => projStep(pr, dt));
    G.floaters = G.floaters.filter(f => { f.t -= dt; f.y -= 20 * dt; return f.t > 0; });
    G.fx = G.fx.filter(f => (f.t -= dt) > 0);
    if (G.combatT > CFG.COMBAT_TIMEOUT) forceLeakAll();
    if (G.players.every(p => p.paid) && G.kings.every(k => k.leaks.length === 0)) endWave();
  }
  if (G.phase !== 'over' && checkOver()) return;
}

function forceLeakAll() {
  for (const p of G.players) {
    for (const e of [...p.enemies]) leak(p, e);
    p.enemies = [];
  }
  addLog('战斗超时，剩余敌人漏过！', 'l-red');
}

/* ---------- 场地战斗 ---------- */
function fieldStep(p, dt) {
  // 出兵
  if (p.spawnList.length) {
    p.spawnT -= dt;
    while (p.spawnT <= 0 && p.spawnList.length) {
      spawnEnemy(p, p.spawnList.shift());
      p.spawnT += p.spawnIv;
    }
  }
  // 战士（含复活倒计时）
  for (const f of p.fighters) {
    if (f.deadT > 0) {
      f.deadT -= dt;
      if (f.deadT <= 0) { f.hp = f.max * 0.5; addFloater(f.x, f.y, '复活!', '#7ee08a'); recalcAuras(p); }
      continue;
    }
    fighterAct(p, f, dt);
  }
  // 灼烧光环
  for (const f of p.fighters) {
    const b = f.def.abil && f.def.abil.burn;
    if (!b || f.deadT > 0) continue;
    for (const e of p.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - f.x, e.y - f.y) <= b.r) { e.hp -= b.dps * dt; e.flash = 0.08; }
    }
  }
  // 敌人
  for (const e of [...p.enemies]) enemyAct(p, e, dt);
  // 简单分离，防止重叠
  const es = p.enemies;
  for (let i = 0; i < es.length; i++) for (let j = i + 1; j < es.length; j++) {
    const a = es[i], b = es[j];
    const dx = b.x - a.x, dy = b.y - a.y, dd = Math.hypot(dx, dy), min = a.r + b.r;
    if (dd > 0.01 && dd < min) {
      const push = (min - dd) / 2, nx = dx / dd, ny = dy / dd;
      a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
    }
  }
  // 清理死亡
  for (const e of p.enemies) if (e.hp <= 0) addPuff(e.x, e.y, '#ff8a80', 6 + e.r);
  p.enemies = p.enemies.filter(e => e.hp > 0);
  const dead = p.fighters.filter(f => f.hp <= 0 && f.deadT <= 0 && !(f.def.abil && f.def.abil.reinc && !f.reincUsed));
  if (dead.length) {
    for (const f of dead) addPuff(f.x, f.y, EL_COLORS[f.def.el], 12);
    p.fighters = p.fighters.filter(f => !dead.includes(f));
    recalcAuras(p);
  }
  // 结算
  if (!p.paid && !p.spawnList.length && !p.enemies.length) payClear(p);
}

function spawnEnemy(p, item) {
  let e;
  if (item.type === 'merc') {
    const m = MERCS[item.id];
    e = { hp: m.hp, max: m.hp, dmg: m.dmg, aspd: m.aspd, range: m.range, speed: m.speed, armor: m.armor, atk: m.atk, r: m.r, regen: 0, magicImmune: false, boss: false };
    e.mercId = item.id;
  } else {
    const d = G.waveDef;
    e = { hp: d.hp, max: d.hp, dmg: d.dmg, aspd: d.aspd, range: d.range, speed: d.speed, armor: d.armor, atk: d.atk, r: d.r, regen: d.regen, magicImmune: d.magicImmune, boss: d.boss };
    e.trait = d.trait;
  }
  e.laneX = p.gx + 16 + Math.random() * (CFG.GRID_W - 32);
  e.x = e.laneX;
  e.y = p.spawnY;
  e.cd = 0.6 + Math.random() * 0.5;
  e.slowT = 0; e.slowF = 1; e.flash = 0;
  p.enemies.push(e);
}

function enemyAct(p, e, dt) {
  e.cd -= dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
  if (e.regen) e.hp = Math.min(e.max, e.hp + e.max * e.regen * dt);
  const sp = e.speed * e.slowF;

  let tgt = null, td = 1e9;
  for (const f of p.fighters) {
    if (f.deadT > 0 || f.hp <= 0) continue;
    const d = Math.hypot(f.x - e.x, f.y - e.y);
    if (d < td) { td = d; tgt = f; }
  }
  if (tgt && td < CFG.AGGRO) {
    const reach = e.range + e.r;
    if (td <= reach) {
      if (e.cd <= 0) { e.cd = e.aspd; hitFighter(p, tgt, e.dmg, e.atk); e.flash = 0.12; }
    } else {
      const nx = (tgt.x - e.x) / td, ny = (tgt.y - e.y) / td;
      e.x += nx * sp * dt; e.y += ny * sp * dt;
    }
  } else {
    e.y += p.direction * sp * dt;
    e.x += (e.laneX - e.x) * 0.5 * dt;
    if ((e.y - p.exitY) * p.direction >= 0) leak(p, e);
  }
}

function hitFighter(p, f, dmg, atk) {
  const m = ATK_ARMOR[atk][f.def.armor] || 1;
  f.hp -= dmg * m;
  f.flash = 0.15;
  if (f.hp <= 0 && f.def.abil && f.def.abil.reinc && !f.reincUsed) {
    f.reincUsed = true; f.deadT = 2.2;
  }
}

function fighterAct(p, f, dt) {
  if (f.flash > 0) f.flash -= dt;
  f.cd -= dt;
  if (f.cd > 0) return;
  const R = effRange(f.def);
  let tgt = null, bx = -Infinity;
  for (const e of p.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - f.x, e.y - f.y);
    const progress = e.y * p.direction;
    if (d - e.r - 12 <= R && progress > bx) { bx = progress; tgt = e; }
  }
  if (!tgt) return;
  f.cd = f.def.aspd;
  let dmg = f.effDmg;
  const ab = f.def.abil || {};
  if (ab.crit && Math.random() < ab.crit.c) dmg *= ab.crit.m;
  if (f.def.range <= 45) {
    dmgEnemy(tgt, dmg, f.def.atk);
    afterHits(p, tgt, dmg, f.def.atk, ab);
    f.flash = 0.12;
  } else {
    G.projectiles.push({ p, x: f.x, y: f.y, px: f.x, py: f.y, tgt, sp: CFG.PROJ_SPEED, dmg, atk: f.def.atk, ab, t: 3 });
  }
}

function dmgEnemy(e, dmg, atk) {
  let m = (ATK_ARMOR[atk] && ATK_ARMOR[atk][e.armor]) || 1;
  if (e.magicImmune && atk === '魔法') m = 0.1;
  e.hp -= dmg * m;
  e.flash = 0.12;
}

/* 溅射 / 连锁 / 减速 等命中后效果 */
function afterHits(p, tgt, dmg, atk, ab) {
  if (ab.splash) {
    for (const e of p.enemies) {
      if (e === tgt || e.hp <= 0) continue;
      if (Math.hypot(e.x - tgt.x, e.y - tgt.y) <= ab.splash.r) dmgEnemy(e, dmg * ab.splash.p, atk);
    }
  }
  if (ab.chain) {
    const cand = p.enemies
      .filter(e => e !== tgt && e.hp > 0 && Math.hypot(e.x - tgt.x, e.y - tgt.y) <= 140)
      .sort((a, b) => Math.hypot(a.x - tgt.x, a.y - tgt.y) - Math.hypot(b.x - tgt.x, b.y - tgt.y))
      .slice(0, ab.chain.n);
    cand.forEach((e, i) => dmgEnemy(e, dmg * Math.pow(ab.chain.f, i + 1), atk));
  }
  if (ab.slow && tgt.hp > 0) {
    tgt.slowT = Math.max(tgt.slowT, ab.slow.d);
    tgt.slowF = Math.min(tgt.slowF, 1 - ab.slow.p);
  }
}

function projStep(pr, dt) {
  pr.t -= dt;
  const t = pr.tgt;
  if (!t || t.hp <= 0 || pr.t <= 0) return false;
  pr.px = pr.x; pr.py = pr.y;
  const dx = t.x - pr.x, dy = t.y - pr.y, d = Math.hypot(dx, dy);
  const step = pr.sp * dt;
  if (d <= step + t.r) {
    dmgEnemy(t, pr.dmg, pr.atk);
    afterHits(pr.p, t, pr.dmg, pr.atk, pr.ab);
    return false;
  }
  pr.x += dx / d * step; pr.y += dy / d * step;
  return true;
}

/* ---------- 漏怪与国王 ---------- */
function leak(p, e) {
  const i = p.enemies.indexOf(e);
  if (i >= 0) p.enemies.splice(i, 1);
  p.leakCount = (p.leakCount || 0) + 1;
  const k = G.kings[p.team];
  e.toKing = true; e.routeX = p.exitX; e.turning = true;
  k.leaks.push(e);
  addFloater(p.exitX - 20, e.y, '漏怪!', '#ff6a5e');
  if (p.isHuman) addLog(`${p.name} 第 ${G.wave} 波漏怪！国王受到威胁`, 'l-red');
}

function kingStep(k, dt) {
  if (k.slamT > 0) k.slamT -= dt;
  k.cd -= dt;
  if (k.flash > 0) k.flash -= dt;
  for (const e of k.leaks) {
    if (e.turning) {
      const dx = e.routeX - e.x, dy = 400 - e.y, d = Math.hypot(dx, dy);
      if (d < 4) { e.x = e.routeX; e.y = 400; e.turning = false; }
      else { const step = Math.min(d, e.speed * e.slowF * dt); e.x += dx / d * step; e.y += dy / d * step; continue; }
    }
    e.cd -= dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
    if (e.regen) e.hp = Math.min(e.max, e.hp + e.max * e.regen * dt);
    const dx = k.x - e.x, dy = k.y - e.y, d = Math.hypot(dx, dy);
    const reach = e.range + e.r + 26;
    if (d <= reach) {
      if (e.cd <= 0) {
        e.cd = e.aspd;
        let m = (ATK_ARMOR[e.atk] && ATK_ARMOR[e.atk]['无甲']) || 1; // 国王视为无甲
        k.hp -= e.dmg * m;
        e.flash = 0.12; k.flash = 0.15;
        if (k.hp <= 0) { k.hp = 0; gameOver(1 - k.team); return; }
      }
    } else {
      const sp = e.speed * e.slowF;
      e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
    }
  }
  // 国王反击（范围溅射）
  if (k.cd <= 0 && k.leaks.length) {
    let tgt = null, td = 1e9;
    for (const e of k.leaks) {
      const d = Math.hypot(e.x - k.x, e.y - k.y);
      if (d < td) { td = d; tgt = e; }
    }
    if (tgt && td <= CFG.KING_RANGE + tgt.r) {
      k.cd = k.aspd;
      k.slamT = .35;
      for (const e of k.leaks) {
        if (Math.hypot(e.x - tgt.x, e.y - tgt.y) <= CFG.KING_SPLASH) dmgEnemy(e, k.dmg, '普通');
      }
      k.flash = 0.2;
    }
  }
  for (const e of k.leaks) if (e.hp <= 0) addPuff(e.x, e.y, '#ff8a80', 6 + e.r);
  k.leaks = k.leaks.filter(e => e.hp > 0);
}

/* ---------- 经济 / 操作 ---------- */
function payClear(p) {
  let g = Math.round((18 + G.wave * 3.4) * gainMult(p));
  if (p.fighters.length === 0) g += 25 + G.wave * 3;   // 全灭重建补贴，避免一蹶不振
  p.gold += g;
  p.paid = true;
  addFloater(p.gx + CFG.GRID_W / 2, p.gy + 14, `+${g}金`, '#f5c542');
  if (p.isHuman) {
    if (p.leakCount > 0) addLog(`${p.name} 第 ${G.wave} 波漏怪 ${p.leakCount} 个，奖励 +${g} 金`, 'l-red');
    else addLog(`${p.name} 第 ${G.wave} 波防守成功，+${g} 金`, 'l-gold');
  }
}

function cellFree(p, col, row) {
  return !p.fighters.some(f => f.col === col && f.row === row);
}

function buyFighter(p, uid, col, row) {
  const def = UNITS[uid];
  if (!def || p.gold < def.cost || col < 0 || col >= CFG.COLS || row < 0 || row >= CFG.ROWS || !cellFree(p, col, row)) return false;
  p.gold -= def.cost;
  p.fighters.push({
    def, uid, col, row,
    x: p.gx + (col + 0.5) * CFG.CELL, y: p.gy + (row + 0.5) * CFG.CELL,
    hp: def.hp, max: def.hp, cd: 0.3, spent: def.cost,
    effDmg: def.dmg, flash: 0, deadT: 0, reincUsed: false,
  });
  recalcAuras(p);
  return true;
}

function upgradeFighter(p, f) {
  const nextId = f.def.up;
  if (!nextId) return false;
  const next = UNITS[nextId];
  const cost = next.cost - f.def.cost;
  if (p.gold < cost) return false;
  p.gold -= cost;
  f.spent += cost;
  f.def = next; f.uid = nextId;
  f.hp = next.hp; f.max = next.hp;
  addFloater(f.x, f.y, '升级!', '#7ee08a');
  recalcAuras(p);
  return true;
}

function sellFighter(p, f) {
  const i = p.fighters.indexOf(f);
  if (i < 0) return false;
  p.fighters.splice(i, 1);
  p.gold += f.spent;
  addFloater(f.x, f.y, `+${f.spent}金`, '#f5c542');
  if (G.selectedFighter === f) G.selectedFighter = null;
  recalcAuras(p);
  return true;
}

function recalcAuras(p) {
  for (const f of p.fighters) f.effDmg = f.def.dmg;
  for (const src of p.fighters) {
    const a = src.def.abil && src.def.abil.aura;
    if (!a || src.deadT > 0 || src.hp <= 0) continue;
    for (const f of p.fighters) {
      if (f !== src && f.deadT <= 0 && Math.hypot(f.x - src.x, f.y - src.y) <= a.r) {
        f.effDmg *= (1 + a.p);
      }
    }
  }
}

function kingUpgradeCost(k) { return CFG.KING_UP_BASE + CFG.KING_UP_GROW * k.lvl; }

function kingUpgrade(p) {
  const k = G.kings[p.team];
  const cost = kingUpgradeCost(k);
  if (p.gold < cost) return false;
  p.gold -= cost;
  k.lvl++;
  k.dmg = Math.round(CFG.KING_DMG * (1 + 0.15 * k.lvl));
  k.aspd = CFG.KING_ASPD * Math.pow(0.965, k.lvl);
  k.max += 150; k.hp = Math.min(k.max, k.hp + 150);
  p.income += 2;
  addFloater(k.x, k.y - 30, '国王强化!', '#f5c542');
  addLog(`${p.name} 强化国王（Lv.${k.lvl}），收入 +2`, 'l-blue');
  return true;
}

function sendMerc(from, target, mercId) {
  const m = MERCS[mercId];
  if (!m || from.gold < m.cost || target.team === from.team) return false;
  from.gold -= m.cost;
  from.income += m.income;
  target.mercQueue.push(mercId);
  if (from.isHuman) addLog(`${from.name} 雇佣「${m.name}」→ ${target.name}，收入 +${m.income}`, 'l-green');
  else if (target.isHuman) addLog(`${from.name} 向 ${target.name} 派遣了「${m.name}」！`, 'l-red');
  return true;
}

/* ---------- 杂项 ---------- */
function addPuff(x, y, color, size) {
  G.fx.push({ x, y, color, size: size || 10, t: .5, max: .5 });
  if (G.fx.length > 90) G.fx.shift();
}
function addFloater(x, y, txt, color) { G.floaters.push({ x, y, txt, color, t: 1.3 }); }
function addLog(txt, cls) {
  G.logLines.push({ txt, cls: cls || '' });
  if (G.logLines.length > 60) G.logLines.shift();
}
function playerValue(p) { return p.fighters.reduce((s, f) => s + f.spent, 0); }
