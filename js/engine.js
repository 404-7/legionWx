'use strict';
/* ===== 战斗引擎：状态、波次流程、自动战斗、经济、国王 ===== */
let G = null;

function layoutFor(playerIndex) {
  const right = playerIndex < 2, bottom = playerIndex % 2 === 1;
  const fx = right ? 1284 : 84, fy = bottom ? 824 : 40;
  return { fx, fy, gx: fx + 24, gy: fy + 40, laneX:right?1500:300 };
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
    waveDef: null, result: null, battleMode:'defense', arena:null, arenaHistory:[],entitySerial:0,
  };
  for (let i = 0; i < 4; i++) {
    const L = layoutFor(i);
    G.players.push({
      id: i, team: i < 2 ? 0 : 1, name: names[i], isHuman: i === 0,
      gold: CFG.START_GOLD, income: CFG.START_INCOME, kingLvl: 0,
      fx: L.fx, fy: L.fy, gx: L.gx, gy: L.gy,
      exitX: L.laneX, exitY: i % 2 ? 776 : 664,
      spawnX: L.laneX, spawnY: i % 2 ? CFG.H-20 : 20,
      direction: i % 2 ? -1 : 1,
      fighters: [], enemies: [], mercQueue: [], mines: [],
      spawnList: [], spawnT: 0, spawnIv: 1, paid: true,
      ai: null, aiT: 0,
    });
  }
  G.kings = [0, 1].map(t => ({
    team: t, x: t === 0 ? CFG.GATE_RIGHT : CFG.GATE_LEFT, y: t===0?1260:180,
    hp: CFG.KING_HP, max: CFG.KING_HP, lvl: 0, cd: 0, flash: 0, leaks: [],
    dmg: CFG.KING_DMG, aspd: CFG.KING_ASPD, regen: CFG.KING_REGEN,
    upgrades: { health: 0, attack: 0, regen: 0 },
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
  G.battleMode='defense';G.arena=null;
  G.wave++;
  G.waveDef = waveDefFor(G.wave);
  for (const p of G.players) {
    const inc = G.wave === 1 ? 0 : Math.round(p.income * gainMult(p));
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
  if(G.battleMode==='arena'){startArenaCombat();return;}
  G.phase = 'combat';
  G.combatT = 0;
  const iv = Math.max(0.5, 1.15 - G.wave * 0.012);
  for (const p of G.players) {
    for(const f of p.fighters)if(f.steroids){f.max=f.def.hp*1.2;f.hp=f.max;}
    start341Round(p);
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
    k.leaks = [];
  }
  for (const p of G.players) {
    p.gold += Math.round((G.waveDef.bonus || 0) * gainMult(p));
    const survivors=p.fighters.filter(f=>f.hp>0&&!f.temporary);
    if(survivors.some(f=>f.def.abil.slaveTrade))p.gold+=survivors.reduce((sum,f)=>sum+(f.uid==='slavemaster'?3:f.uid==='servant'?2:0),0);
    p.fighters = p.fighters.filter(f => !f.temporary);
    for (const f of p.fighters) restoreFighter(p,f);
    recalcAuras(p);
  }
  if (G.wave >= CFG.TOTAL_WAVES && !G.result) {
    const a=G.kings[0].hp/G.kings[0].max,b=G.kings[1].hp/G.kings[1].max;
    gameOver(Math.abs(a-b)<.00001 ? null : a>b ? 0 : 1); return;
  }
  if(CFG.ARENA_WAVES.includes(G.wave)&&!G.arenaHistory.some(a=>a.wave===G.wave))startArenaPrep();
  else startPrep();
}

function gameOver(winner) {
  G.result = { winner };
  G.phase = 'over';
  addLog(winner === null ? '双方守住了最终波，平局！' : winner === 0 ? '🏆 蓝方胜利！' : '💀 蓝方战败…', winner === 0 ? 'l-green' : 'l-red');
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
  if (G.phase === 'prep' || G.phase === 'combat') {
    G.floaters = G.floaters.filter(f => { f.t -= dt; f.y -= 20 * dt; return f.t > 0; });
    G.fx = G.fx.filter(f => (f.t -= dt) > 0);
    for (const p of G.players) mineStep(p, dt);
    for (const k of G.kings) if (k.hp > 0) k.hp = Math.min(k.max, k.hp + k.regen * dt);
  }
  if (G.phase === 'prep') {
    G.timer -= dt;
    for (const p of G.players) {
      if (!p.ai) continue;
      p.aiT -= dt;
      if (p.aiT <= 0) { aiAct(p); p.aiT = 1.4 + Math.random(); }
    }
    if (G.timer <= 0) startCombat();
  } else if (G.phase === 'combat') {
    if(G.battleMode==='arena'){arenaStep(dt);return;}
    G.combatT += dt;
    for (const p of G.players) fieldStep(p, dt);
    for (const k of G.kings) { kingStep(k, dt); if (G.phase === 'over') return; }
    G.projectiles = G.projectiles.filter(pr => projStep(pr, dt));
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
  const combat={...p,enemies:defenseTargets(p)};
  tick341(combat, dt);
  // 战士（含复活倒计时）
  for (const f of p.fighters) {
    if (f.hp <= 0 && f.deadT <= 0) continue;
    if (f.deadT > 0) {
      f.deadT -= dt;
      if (f.deadT <= 0) { f.hp = f.max * 0.5; addFloater(f.x, f.y, '复活!', '#7ee08a'); recalcAuras(p); }
      continue;
    }
    fighterAct(combat, f, dt);
  }
  // 灼烧光环
  for (const f of p.fighters) {
    const b = f.def.abil && f.def.abil.burn;
    if (!b || f.hp <= 0 || f.deadT > 0) continue;
    for (const e of combat.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - f.x, e.y - f.y) <= b.r) dmgEnemy(e,b.dps*dt,'法术',f);
    }
  }
  // 敌人
  for (const e of [...p.enemies]) enemyAct(p, e, dt);
  // 简单分离，防止重叠
  separateDefenseUnits(p,dt);
  // 清理死亡
  for (const e of p.enemies) if (e.hp <= 0) {
    rewardEnemy(p,e);
    addPuff(e.x,e.y,'#ff8a80',6+e.r);
  }
  p.enemies = p.enemies.filter(e => e.hp > 0);
  const dead = p.fighters.filter(f => f.hp <= 0 && f.deadT <= 0 && !(f.def.abil && f.def.abil.reinc && !f.reincUsed));
  if (dead.length) {
    for (const f of dead) if(!f.deathHandled){addPuff(f.x,f.y,RACES[f.def.race].color,12);death341(p,f);}
    p.fighters = p.fighters.filter(f => !f.temporary || f.hp>0);
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
    e.trait = d.trait; e.bounty=d.bounty; e.armorPoints=d.armorPoints; e.regenFlat=d.regenFlat; e.air=d.air;
  }
  e.laneX = p.gx + 16 + Math.random() * (CFG.GRID_W - 32);
  e.ownerId=p.id;combatAgent(e);
  e.x = e.laneX;
  e.y = p.spawnY;
  e.cd = 0.6 + Math.random() * 0.5;
  e.slowT = 0; e.slowF = 1; e.flash = 0;
  p.enemies.push(e);
}

function enemyAct(p, e, dt,engageOnly=false) {
  if (e.hp <= 0 || e.stunT>0) return engageOnly;
  e.cd -= dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
  if (e.regen) e.hp = Math.min(e.max, e.hp + e.max * e.regen * dt);
  if(e.regenFlat)e.hp=Math.min(e.max,e.hp+e.regenFlat*dt);
  const sp = e.speed * e.slowF;

  const b=combatAgent(e),reach=e.range+e.r;
  const tgt=chooseCombatTarget(e,p.fighters,{sense:Math.max(CFG.AGGRO,reach+20),reach,
    x:b.targetId?(b.anchorX??e.x):e.x,y:b.targetId?(b.anchorY??e.y):e.y,leash:COMBAT_AI.ENEMY_LEASH},dt);
  if (tgt) {
    const td=Math.hypot(tgt.x-e.x,tgt.y-e.y);
    if (td <= reach) {
      b.state='attack';b.chase=0;
      if (e.cd <= 0) { e.cd = e.aspd/Math.max(.05,1-(e.attackSlow||0)); hitFighter(p, tgt, e.dmg*(1-(e.damageWeak||0)), e.atk, e); e.flash = 0.12; }
    } else {
      b.state='chase';if(moveCombatUnit(p,e,tgt,sp,dt,reach))b.chase+=dt;
    }
    return true;
  } else {
    b.state='advance';
    if(engageOnly)return false;
    e.y += p.direction * sp * dt;
    e.x += (e.laneX - e.x) * 0.5 * dt;
    if ((e.y - p.exitY) * p.direction >= 0) leak(p, e);
  }
}

function hitFighter(p,f,dmg,atk,attacker) {
  const a=f.def.abil;
  if(Object.values(f.buffs||{}).some(b=>b.invulnerable))return;
  if(a.evasion&&Math.random()<a.evasion)return;
  if(attacker&&Math.random()<(attacker.miss||0))return;
  if(a.magicImmune&&(atk==='魔法'||atk==='法术'))return;
  let amount=dmg*(ATK_ARMOR[atk]?.[f.def.armor]??1)*armorFactor((f.effArmor??f.def.armorPoints)-(f.armorLoss||0))*(f.damageTaken||1)*(1+(f.mark||0));
  if(atk==='穿刺'&&a.defend)amount*=a.defend;
  if(a.block&&Math.random()<a.block.chance)amount=Math.max(a.block.minimum,amount-a.block.amount);
  if(a.manaShield&&f.mana>0){const absorb=Math.min(amount*a.manaShield.ratio,f.mana*a.manaShield.perMana);amount-=absorb;f.mana-=absorb/a.manaShield.perMana;}
  f.hp-=amount;f.flash=.15;
  recordCombatThreat(f,attacker,amount);
  if(f.hp<=0)resetCombatAgent(f);
  if(attacker&&a.reflect&&attacker.range<=45)dmgEnemy(attacker,amount*a.reflect.p,'法术');
  if(f.hp<=0&&a.reinc&&!f.reincUsed){f.reincUsed=true;f.deadT=2.2;}
}

function fighterAct(p, f, dt) {
  f.moving=false;
  if (f.hp <= 0 || f.deadT>0) return;
  if (f.flash > 0) f.flash -= dt;
  f.cd -= dt;
  if(f.stunT>0){if(f.brain)f.brain.windup=null;return;}
  const R = f.def.max===0?Math.max(effRange(f.def),...(f.def.abil.casts||[]).map(c=>c.range||0)):effRange(f.def);
  const home=guardHome(p,f),tgt=chooseCombatTarget(f,p.enemies,{sense:Math.max(f.def.acquireRange||125,R+28,p.arenaView?260:0),
    reach:R+24,x:home.x,y:home.y,leash:p.arenaView?Infinity:COMBAT_AI.LEASH,returnHome:!p.arenaView},dt);
  const b=combatAgent(f);
  if(!tgt){idleGuard(p,f,dt);return;}
  const reach=R+(tgt.r||10)+12,d=Math.hypot(tgt.x-f.x,tgt.y-f.y);
  if(d>reach){
    b.windup=null;b.state='chase';
    if(moveCombatUnit(p,f,tgt,f.def.speed*(f.slowF??1),dt,reach))b.chase+=dt;
    return;
  }
  b.state='attack';b.chase=0;
  if(f.def.max===0){b.state='cast';return;}
  if(b.windup){
    b.windup.time-=dt;
    if(b.windup.time>0)return;
    b.windup=null;executeFighterAttack(p,f,tgt,R);return;
  }
  if(f.cd>0)return;
  const rate=(1+(f.effHaste||0))*Math.max(.05,1-(f.attackSlow||0));
  f.cd=f.def.aspd/rate;
  b.windup={targetId:tgt.entityId,time:Math.min(f.def.attackPoint??.3,f.def.aspd*.6)/rate};
}
function executeFighterAttack(p,f,tgt,R){
  f.attacks=(f.attacks||0)+1;
  const ab=f.def.abil||{};
  let dmg=(f.def.min+Math.random()*(f.def.max-f.def.min))*(f.def.dmg ? f.effDmg/f.def.dmg : 1)+(ab.flatDamage||0);
  for(const b of Object.values(f.buffs||{}))dmg*=1+(b.damage||0);
  if(ab.crit&&(!ab.crit.airOnly||tgt.air)&&Math.random()<ab.crit.c)dmg*=ab.crit.m;
  if(ab.attackMana)f.mana=Math.min(f.def.manaMax,f.mana+ab.attackMana);
  if(ab.manaHit&&f.mana>=ab.manaHit.mana&&(f.spellCD[ab.manaHit.id]||0)<=0){dmg+=ab.manaHit.damage;f.mana-=ab.manaHit.mana;f.spellCD[ab.manaHit.id]=ab.manaHit.cd;}
  if(f.steroids)dmg*=1.25;
  if(ab.focusManaDivisor)dmg+=Math.floor(f.mana/ab.focusManaDivisor);
  if(f.illusionFactor)dmg*=f.illusionFactor;
  dmg*=1-(f.damageWeak||0);
  const targets=[tgt,...p.enemies.filter(e=>e!==tgt&&e.hp>0&&Math.hypot(e.x-f.x,e.y-f.y)-e.r-12<=R).slice(0,(ab.multishot||1)-1)];
  for(const target of targets){
    if(f.def.melee){const dealt=dmgEnemy(target,dmg,f.def.atk,f);hit341(p,f,target,dealt);afterHits(p,target,dmg,f.def.atk,ab);f.flash=.12;}
    else G.projectiles.push({p,source:f,x:f.x,y:f.y,px:f.x,py:f.y,tgt:target,sp:CFG.PROJ_SPEED,dmg,atk:f.def.atk,ab,t:3});
  }
}

function dmgEnemy(e, dmg, atk, attacker=null) {
  if (e.hp <= 0) return 0;
  if(e.def){const before=e.hp;hitFighter(G.players[e.ownerId],e,dmg,atk,attacker);return Math.max(0,before-Math.max(0,e.hp));}
  let m = (ATK_ARMOR[atk] && ATK_ARMOR[atk][e.armor]) || 1;
  if(e.magicImmune && (atk==='魔法'||atk==='法术'))m=0;
  if(atk!=='法术')m*=armorFactor((e.armorPoints||0)-(e.armorLoss||0));
  if(e.mark)m*=1+e.mark;
  const dealt = Math.min(e.hp, dmg * m);
  e.hp -= dmg * m;
  recordCombatThreat(e,attacker,dealt);
  e.flash = 0.12;
  return dealt;
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
    add341Status(tgt,'attackSlow',{time:ab.slow.d,move:ab.slow.p});
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
    const dealt=dmgEnemy(t,pr.dmg,pr.atk,pr.source);
    if(pr.source)hit341(pr.p,pr.source,t,dealt);
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
  e.toKing = true;e.ownerId=p.id; e.routeX = p.exitX; e.turning = true;forgetCombatTarget(e);
  e.route=[{x:p.exitX,y:CFG.ROAD_Y},{x:k.x,y:CFG.ROAD_Y},{x:k.x,y:k.y}];e.routeIndex=0;
  k.leaks.push(e);
  addFloater(p.exitX - 20, e.y, '漏怪!', '#ff6a5e');
  if (p.isHuman) addLog(`${p.name} 第 ${G.wave} 波漏怪！国王受到威胁`, 'l-red');
}

function kingStep(k, dt) {
  if (k.slamT > 0) k.slamT -= dt;
  k.cd -= dt;
  if (k.flash > 0) k.flash -= dt;
  for (const e of k.leaks) {
    if(e.hp<=0)continue;
    const owner=G.players[e.ownerId],defenders=G.players.filter(p=>p.team===k.team).flatMap(p=>p.fighters);
    if(owner&&enemyAct({...owner,fighters:defenders},e,dt,true))continue;
    if(e.routeIndex<e.route.length-1){
      walkRoute(e,e.speed*e.slowF*dt);
      e.turning=e.routeIndex===0;continue;
    }
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
  for (const e of k.leaks) if (e.hp <= 0) {rewardEnemy(G.players[e.ownerId],e);addPuff(e.x, e.y, '#ff8a80', 6 + e.r);}
  k.leaks = k.leaks.filter(e => e.hp > 0);
}

/* ---------- 经济 / 操作 ---------- */
function minePosition(p, index) {
  const zone=mineZone(p);
  return { x:zone.x+44+(index%2)*72,y:zone.y+100+Math.floor(index/2)*150 };
}
function mineZone(p){return {x:p.team===0?1060:580,y:p.id%2?870:70,w:160,h:500};}

function buyMine(p) {
  if (!['prep', 'combat'].includes(G.phase) || p.mines.length >= MINE.LIMIT || p.gold < MINE.COST) return false;
  p.gold -= MINE.COST;
  p.mines.push({ id: p.mines.length, level: 1, elapsed: 0 });
  addLog(`${p.name} 建造金矿（${p.mines.length}/${MINE.LIMIT}）`, 'l-gold');
  return true;
}

function upgradeMine(p, id) {
  if (!['prep', 'combat'].includes(G.phase) || !Number.isInteger(id)) return false;
  const mine = p.mines.find(m => m.id === id);
  if (!mine || mine.level >= MINE.LEVELS.length) return false;
  const cost = MINE.LEVELS[mine.level - 1].upgrade;
  if (p.gold < cost) return false;
  p.gold -= cost; mine.level++;
  addLog(`${p.name} 的 ${id + 1} 号金矿升至 Lv.${mine.level}`, 'l-gold');
  return true;
}

function mineStep(p, dt) {
  for (const mine of p.mines) {
    mine.elapsed += dt;
    const ticks = Math.floor((mine.elapsed + 1e-9) / MINE.INTERVAL);
    if (!ticks) continue;
    mine.elapsed = Math.max(0, mine.elapsed - ticks * MINE.INTERVAL);
    const gold = ticks * MINE.LEVELS[mine.level - 1].gold;
    p.gold += gold;
    const pos = minePosition(p, mine.id);
    addFloater(pos.x, pos.y - 15, `+${gold}金`, '#f5c542');
  }
}

function payClear(p) {
  p.paid=true;
  if(p.isHuman)addLog(p.leakCount ? `第 ${G.wave} 波漏怪 ${p.leakCount} 个` : `第 ${G.wave} 波防守成功`,p.leakCount?'l-red':'l-gold');
}
function rewardEnemy(p,e){if(p&&!e.rewarded){p.gold+=Math.round((e.bounty||0)*gainMult(p));e.rewarded=true;}}

function cellFree(p, col, row) {
  return !p.fighters.some(f => !f.temporary && f.col === col && f.row === row);
}

function buyFighter(p, uid, col, row) {
  if(!canManageArmy())return false;
  const def = UNITS[uid];
  if (!Object.hasOwn(UNITS,uid) || !def || def.elite || def.summonOnly || !Number.isInteger(col) || !Number.isInteger(row) || p.gold < def.purchaseCost || col < 0 || col >= CFG.COLS || row < 0 || row >= CFG.ROWS || !cellFree(p, col, row)) return false;
  p.gold -= def.purchaseCost;
  p.fighters.push({
    def, uid, col, row,ownerId:p.id,r:10,
    x: p.gx + (col + 0.5) * CFG.CELL, y: p.gy + (row + 0.5) * CFG.CELL,
    hp: def.hp, max: def.hp, cd: 0.3, spent: def.purchaseCost,
    effDmg: def.dmg, flash: 0, deadT: 0, reincUsed: false,
  });
  init341Fighter(p.fighters[p.fighters.length-1]);
  recalcAuras(p);
  return true;
}

function upgradeFighter(p,f,targetId) {
  if(!canManageArmy())return false;
  if(!p.fighters.includes(f)||f.temporary)return false;
  const nextId=targetId??f.def.up;
  const stance=f.def.stances.includes(nextId);
  if(!stance&&!f.def.upgrades.includes(nextId))return false;
  const next=UNITS[nextId];if(!next)return false;
  const cost=stance?0:next.purchaseCost;
  if(p.gold<cost)return false;
  const ratio=f.hp/f.max,mana=f.mana;
  p.gold-=cost;f.spent+=cost;f.def=next;f.uid=nextId;f.hp=next.hp;f.max=next.hp;
  init341Fighter(f);
  if(stance){f.hp=f.max*ratio;f.mana=Math.min(next.manaMax,mana);}
  addFloater(f.x,f.y,stance?'切换形态':'升级!','#7ee08a');recalcAuras(p);return true;
}

function sellFighter(p, f) {
  if(!canManageArmy())return false;
  const i = p.fighters.indexOf(f);
  if (i < 0 || f.temporary) return false;
  p.fighters.splice(i, 1);
  const refund=Math.floor(f.spent*(f.def.abil.refund||1));p.gold += refund;
  addFloater(f.x, f.y, `+${refund}金`, '#f5c542');
  if (G.selectedFighter === f) G.selectedFighter = null;
  recalcAuras(p);
  return true;
}

function recalcAuras(p) {
  for(const f of p.fighters){let amp=0;
    for(const src of p.fighters){const a=src.def.abil.aura;
      if(a&&src.hp>0&&(!a.rangedOnly||!f.def.melee)&&Math.hypot(f.x-src.x,f.y-src.y)<=a.r)amp=Math.max(amp,a.p);
    }
    f.effDmg=f.def.dmg*(1+amp);
  }
}

function kingUpgradeCost(k, stat = 'health') {
  if (!Object.hasOwn(KING_UPGRADES, stat)) return Infinity;
  return CFG.KING_UP_BASE + CFG.KING_UP_GROW * k.upgrades[stat];
}

function kingUpgrade(p, stat = 'health') {
  if (!Object.hasOwn(KING_UPGRADES, stat) || !['prep', 'combat'].includes(G.phase)) return false;
  const k = G.kings[p.team];
  const cost = kingUpgradeCost(k, stat);
  if (p.gold < cost) return false;
  p.gold -= cost;
  k.lvl++;
  k.upgrades[stat]++;
  const amount = KING_UPGRADES[stat].amount;
  if (stat === 'health') { k.max += amount; k.hp = Math.min(k.max, k.hp + amount); }
  if (stat === 'attack') k.dmg += amount;
  if (stat === 'regen') k.regen += amount;
  p.income += 2;
  addFloater(k.x, k.y - 30, `${KING_UPGRADES[stat].name}强化!`, '#f5c542');
  addLog(`${p.name} 强化国王${KING_UPGRADES[stat].name}（Lv.${k.upgrades[stat]}），收入 +2`, 'l-blue');
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

/* ---------- 3.41 阵营竞技场：第 10 / 20 波后的独立奖励回合 ---------- */
function canManageArmy(){return ['prep','combat'].includes(G.phase)&&!(G.battleMode==='arena'&&G.phase==='combat');}
function restoreFighter(p,f){
  f.x=p.gx+(f.col+.5)*CFG.CELL;f.y=p.gy+(f.row+.5)*CFG.CELL;
  f.max=f.def.hp;f.hp=f.max;f.deadT=0;f.reincUsed=false;f.cd=.3;f.steroids=false;
  delete f.route;delete f.routeIndex;delete f.statuses;delete f.arenaReady;
  f.slowF=1;f.slowT=0;f.stunT=0;f.mark=0;f.armorLoss=0;f.attackSlow=0;f.damageWeak=0;f.miss=0;
  init341Fighter(f);
  resetCombatAgent(f);
}
function startArenaPrep(){
  G.battleMode='arena';G.phase='prep';G.timerMax=CFG.ARENA_PREP;G.timer=G.timerMax;
  G.arena={stage:'prepare',elapsed:0,counts:[0,0],winner:null};
  G.projectiles=[];G.selectedShop=null;G.selectedFighter=null;
  for(const p of G.players){p.paid=true;p.aiT=.5;p.spawnList=[];p.enemies=[];}
  addLog(`第 ${G.wave} 波已守住！${CFG.ARENA_PREP} 秒后开放中央路口，开始阵营 PK。`,'l-gold');
}
function startArenaCombat(){
  G.phase='combat';G.combatT=0;G.arena.stage='march';G.arena.elapsed=0;
  G.projectiles=[];G.selectedShop=null;G.selectedFighter=null;
  for(const p of G.players){
    p.fighters=p.fighters.filter(f=>!f.temporary);
    for(const f of p.fighters){
      const steroids=f.steroids;restoreFighter(p,f);f.steroids=steroids;
      if(steroids){f.max=f.def.hp*1.2;f.hp=f.max;}
      prepareArenaFighter(p,f);
      f.cd=.2+Math.random()*.2;
      f.route=[{x:p.exitX,y:f.y},{x:p.exitX,y:CFG.ROAD_Y},{x:p.team===0?CFG.GATE_RIGHT:CFG.GATE_LEFT,y:CFG.ROAD_Y}];f.routeIndex=0;
    }
    start341Round(p);
  }
  G.arena.counts=arenaCounts();
  addLog('中央路口已开放！双方军团沿本阵营路线进场，国王和金矿不参战。','l-red');
}
function prepareArenaFighter(p,f){
  f.ownerId=p.id;f.team=p.team;f.r=12;f.armor=f.def.armor;f.armorPoints=f.def.armorPoints;
  f.range=f.def.range;f.air=!!f.def.air;f.boss=false;f.magicImmune=!!f.def.abil.magicImmune;
  f.slowF=1;f.slowT=0;f.arenaReady=false;
}
function walkRoute(unit,distance){
  const startX=unit.x,startY=unit.y;
  while(unit.routeIndex<unit.route.length&&distance>0){
    const point=unit.route[unit.routeIndex],dx=point.x-unit.x,dy=point.y-unit.y,d=Math.hypot(dx,dy);
    if(d<=distance){unit.x=point.x;unit.y=point.y;unit.routeIndex++;distance-=d;}
    else{unit.x+=dx/d*distance;unit.y+=dy/d*distance;distance=0;}
  }
  unit.moving=Math.hypot(unit.x-startX,unit.y-startY)>.01;
  return unit.routeIndex>=unit.route.length;
}
function arenaCounts(){return [0,1].map(team=>G.players.filter(p=>p.team===team).reduce((n,p)=>n+p.fighters.filter(f=>f.hp>0||f.deadT>0).length,0));}
function arenaViews(){
  const sides=[0,1].map(team=>G.players.filter(p=>p.team===team).flatMap(p=>p.fighters));
  return sides.map((fighters,team)=>({arenaView:true,team,fighters,enemies:sides[1-team],direction:team===0?-1:1}));
}
function arenaStep(dt){
  const arena=G.arena;arena.elapsed+=dt;G.combatT+=dt;
  if(arena.stage==='result'){if(arena.elapsed>=5){restoreArenaArmies();startPrep();}return;}
  let views=arenaViews();
  // Status effects and ally auras run once per side. Views are transient and never serialized.
  for(const view of views)tick341(view,dt);
  views=arenaViews();
  for(const view of views){
    for(const f of [...view.fighters]){
      if(f.deadT>0){f.deadT-=dt;if(f.deadT<=0){f.hp=f.max*.5;addFloater(f.x,f.y,'复活!','#7ee08a');}continue;}
      if(f.hp<=0)continue;
      if(f.stunT>0){f.cd-=dt;continue;}
      if(f.route&&!f.arenaReady){
        f.arenaReady=walkRoute(f,(f.def.speed||75)*f.slowF*dt);
        f.cd=Math.max(0,f.cd-dt);continue;
      }
      const targets=view.enemies.filter(e=>e.hp>0&&e.deadT<=0&&e.arenaReady);
      fighterAct({...view,enemies:targets},f,dt);
      if(f.def.abil.burn)for(const e of targets)if(Math.hypot(e.x-f.x,e.y-f.y)<=f.def.abil.burn.r)dmgEnemy(e,f.def.abil.burn.dps*dt,'法术',f);
    }
  }
  spreadArenaUnits(dt);
  G.projectiles=G.projectiles.filter(pr=>projStep(pr,dt));
  // Death summons and reincarnation must resolve before testing for an empty team.
  for(let pass=0;pass<4;pass++)for(const view of arenaViews())for(const f of [...view.fighters]){
    if(f.hp<=0&&f.deadT<=0&&!f.deathHandled)death341(view,f);
  }
  for(const p of G.players)p.fighters=p.fighters.filter(f=>!f.temporary||f.hp>0||f.deadT>0);
  arena.counts=arenaCounts();
  const [blue,red]=arena.counts;
  if(!blue||!red){finishArena(blue?0:red?1:null);return;}
  arena.stage=G.players.some(p=>p.fighters.some(f=>f.arenaReady))?'fight':'march';
  if(arena.elapsed>=CFG.ARENA_LIMIT){finishArena(null,true);}
}
function finishArena(winner,timeout=false){
  if(G.arena.stage==='result')return;
  const bonus=G.wave*(winner===null?5:10);
  for(const p of G.players)if(winner===null||p.team===winner)p.gold+=bonus;
  G.arena.stage='result';G.arena.winner=winner;G.arena.elapsed=0;G.projectiles=[];
  G.arenaHistory.push({wave:G.wave,winner,bonus,timeout});
  addLog(`${timeout?'PK 超时，判为平局':winner===null?'双方军团全灭，PK 平局':(winner===0?'苍岚':'赤焰')+'军团赢得 PK'}！${winner===null?'双方':'胜方'}每人 +${bonus} 金，5 秒后继续守关。`,'l-gold');
}
function spreadArenaUnits(dt){
  const units=G.players.flatMap(p=>p.fighters).filter(f=>f.hp>0&&f.deadT<=0&&f.arenaReady);
  for(let i=0;i<units.length;i++)for(let j=i+1;j<units.length;j++){
    const a=units[i],b=units[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);
    if(d>=24)continue;
    if(d<.01){const angle=(i*37+j*17)*2.39996;dx=Math.cos(angle);dy=Math.sin(angle);d=1;}
    const push=Math.min((24-d)/2,36*dt);
    a.x-=dx/d*push;a.y-=dy/d*push;b.x+=dx/d*push;b.y+=dy/d*push;
  }
  for(const f of units){f.x=Math.max(CFG.GATE_LEFT-80,Math.min(CFG.GATE_RIGHT+80,f.x));f.y=Math.max(CFG.ROAD_Y-55,Math.min(CFG.ROAD_Y+55,f.y));}
}
function restoreArenaArmies(){
  for(const p of G.players){p.fighters=p.fighters.filter(f=>!f.temporary);for(const f of p.fighters)restoreFighter(p,f);recalcAuras(p);}
}
