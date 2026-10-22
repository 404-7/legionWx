'use strict';
/* ===== 战斗引擎：状态、波次流程、自动战斗、经济、国王 ===== */
let G = null;

function layoutFor(playerIndex) {
  const native=SOURCE341.rules.native.map,rect=native.rects['P'+(playerIndex+1)+'BuildArea'];
  const fx=(rect[0]-native.minX)*native.scale,fy=(native.maxY-rect[3])*native.scale;
  const spawn=nativeRect341('Creep_'+(playerIndex+1));
  return {fx,fy,gx:fx,gy:fy,laneX:spawn.x+spawn.w/2,spawnY:spawn.y+spawn.h/2};
}
function nativeRect341(name){const m=SOURCE341.rules.native.map,r=m.rects[name];return {x:(r[0]-m.minX)*m.scale,y:(m.maxY-r[3])*m.scale,w:(r[2]-r[0])*m.scale,h:(r[3]-r[1])*m.scale};}
function nativeCenter341(name){const r=nativeRect341(name);return {x:r.x+r.w/2,y:r.y+r.h/2};}
function nativePoint341(point){const m=SOURCE341.rules.native.map;return {x:(point[0]-m.minX)*m.scale,y:(m.maxY-point[1])*m.scale};}

function newGame(diffKey) {
  const diff = CFG.DIFFS[diffKey] || CFG.DIFFS.normal;
  const names = ['你','西方Ⅱ','西方Ⅲ','西方Ⅳ','东方Ⅰ','东方Ⅱ','东方Ⅲ','东方Ⅳ'];
  G = {
    phase: 'prep', diffKey, diff,
    wave: 0, timer: 0, timerMax: 1,
    speed: 1, paused: false, combatT: 0,
    players: [], kings: [], projectiles: [], floaters: [], fx: [],skillWaves:[],
    selectedShop: null, selectedFighter: null,
    hover: null, logLines: [],
    waveDef: null, result: null, battleMode:'defense', arena:null, arenaHistory:[],entitySerial:0,kingGoldPools:[0,0],bonus:null,
  };
  for (let i = 0; i < SOURCE341.rules.native.slots; i++) {
    const L = layoutFor(i);
    G.players.push({
      id: i, team: i < 4 ? 0 : 1, name: names[i], isHuman: i === 0,active:i===0,
      gold: CFG.START_GOLD, income: CFG.START_INCOME, kingLvl: 0,farmLevel:SOURCE341.rules.population.startFarm,
      wood:SOURCE341.rules.native.startWood,workers:1,workerHarvest:[0],lumberLevel:0,lumberElapsed:0,workerQueue:[],lumberResearch:null,race:null,builderChanges:0,builderChoices:null,prophetDeck:[],prophetRerolls:0,royalHealUsed:false,totalLeaks:0,leakGoldFactor:0,
      fx: L.fx, fy: L.fy, gx: L.gx, gy: L.gy,
      exitX: L.laneX, exitY: CFG.ROAD_Y,
      spawnX: L.laneX, spawnY: L.spawnY,
      direction: i % 2 ? -1 : 1,
      fighters: [], enemies: [], mercQueue: [], mines: [],
      spawnList: [], spawnT: 0, spawnIv: .1, mercSpawnList:[],mercSpawnT:0,paid: true,
      ai: null, aiT: 0,
    });
  }
  for(const p of G.players)p.towers=p.fighters;
  G.kings = [0, 1].map(t => ({
    team: t,royalTeam:t,r:26,...nativePoint341(SOURCE341.rules.native.map.kings[t]),
    hp: CFG.KING_HP, max: CFG.KING_HP, lvl: 0, cd: 0, flash: 0, leaks: [],
    dmg: CFG.KING_DMG, aspd: CFG.KING_ASPD, regen: CFG.KING_REGEN,
    min:SOURCE341.king.min,maxDamage:SOURCE341.king.max,armorPoints:SOURCE341.king.armorPoints,
    mana:SOURCE341.king.mana,manaMax:SOURCE341.king.mana,skills:[],spellCD:{},autoLevel:0,growthWave:0,windup:null,
    controller:null,controlLock:0,autocast:true,manualTarget:null,facing:Math.PI/2,
    upgrades: { health: 0, attack: 0, regen: 0 },
  }));
  addLog('战斗开始！守护本队国王。', 'l-blue');
  startPrep();
  return G;
}

/* ---------- 流程 ---------- */
function gainMult(p) {
  if (p.isHuman) return 1;
  return p.team === 0 ? G.diff.allyMult : G.diff.aiMult;
}

function startPrep(afterArena=false) {
  G.battleMode='defense';G.arena=null;
  G.wave++;
  G.waveDef = waveDefFor(G.wave);
  for (const p of G.players) {
    const inc = G.wave === 1 ? 0 : Math.round(p.income * gainMult(p));
    p.gold += inc;
    p.paid = true;
    p.enemies = []; p.spawnList = [];p.mercSpawnList=[];p.mercSpawnT=0;
    if (p.isHuman && G.wave > 1) addLog(`${p.name} 收入结算 +${inc} 金`, 'l-gold',p.team);
  }
  const timing=SOURCE341.rules.timing;
  G.timerMax = G.wave === 1 ? CFG.FIRST_PREP : afterArena?timing.afterArena:timing.prepareBase+Math.floor(G.wave/timing.prepareDivisor);
  G.timer = G.timerMax;
  G.phase = 'prep';
  G.players.forEach((p, i) => { if (p.ai) p.aiT = 0.5 + i * 0.4; });
}

function startCombat() {
  if(G.battleMode==='arena'){startArenaCombat();return;}
  G.phase = 'combat';
  G.combatT = 0;
  const iv = G.waveDef.spawnInterval;
  for (const p of G.players) {
    if(!p.active)continue;
    createBattleArmy341(p);
    const ratio=playerValue(p)/Math.max(1,G.waveDef.value)-p.totalLeaks/150;
    p.leakGoldFactor=ratio>=.1?Math.min(1,ratio):0;
    for(const f of p.fighters)if(f.steroids){f.max=f.def.hp*1.2;f.hp=f.max;}
    start341Round(p);
    p.paid = false;
    p.leakCount = 0;
    p.spawnIv = iv; p.spawnT = iv;
    p.spawnList = [];
    for (let i = 0; i < G.waveDef.count; i++) p.spawnList.push({ type: 'wave' });
    p.mercSpawnList=p.mercQueue.map(id=>({type:'merc',id}));p.mercSpawnT=G.wave===31?SOURCE341.rules.bonus.mercDelay:G.waveDef.mercDelay;
    p.mercQueue = [];
  }
  if(G.wave===31){
    G.bonus||={batch:0,sourceTimer:SOURCE341.rules.bonus.initialTimer,timer:0,started:false,cleared:false};
    G.bonus.started=true;G.bonus.batch++;G.bonus.cleared=false;
    G.bonus.sourceTimer*=SOURCE341.rules.bonus.factor;G.bonus.timer=G.bonus.sourceTimer+SOURCE341.rules.bonus.offset;
  }
  addLog(`⚔ 第 ${G.wave} 波来袭！`, 'l-red');
}

function endWave() {
  if(G.wave>=31){clearBonusBatch341();return;}
  G.projectiles=[];G.skillWaves=[];
  settleKingGold341();
  for(const k of G.kings)growKing341(k,G.wave);
  for (const k of G.kings) {
    k.leaks = [];k.windup=null;
  }
  for (const p of G.players) {
    if(!p.active){p.fighters=[];continue;}
    p.gold += Math.round((G.waveDef.bonus || 0) * (G.wave===30?SOURCE341.rules.bonus.completionBonusMultiplier:1) * gainMult(p));
    const survivors=p.fighters.filter(f=>f.hp>0&&!f.temporary);
    if(survivors.some(f=>f.def.abil.slaveTrade))p.gold+=survivors.reduce((sum,f)=>sum+(f.uid==='slavemaster'?3:f.uid==='servant'?2:0),0);
    p.fighters = p.towers;
    for (const f of p.fighters) restoreFighter(p,f);
    recalcAuras(p);
  }
  if(G.wave===30){startPrep();G.timer=G.timerMax=SOURCE341.rules.bonus.prepare;
    G.bonus={batch:0,sourceTimer:SOURCE341.rules.bonus.initialTimer,timer:0,started:false,cleared:false};return;}
  if(CFG.ARENA_WAVES.includes(G.wave)&&!G.arenaHistory.some(a=>a.wave===G.wave))startArenaPrep();
  else startPrep();
}

function bonusStep341(dt){
  const bonus=G.bonus;if(!bonus?.started)return;
  bonus.timer-=dt;
  while(bonus.timer<=1e-9){
    bonus.batch++;bonus.cleared=false;
    for(const p of G.players.filter(p=>p.active)){
      for(let i=0;i<G.waveDef.count;i++)p.spawnList.push({type:'wave'});
      p.spawnT=Math.min(p.spawnT,p.spawnIv);p.paid=false;
      p.mercSpawnList.push(...p.mercQueue.map(id=>({type:'merc',id})));p.mercQueue=[];p.mercSpawnT=SOURCE341.rules.bonus.mercDelay;
    }
    bonus.sourceTimer*=SOURCE341.rules.bonus.factor;bonus.timer+=bonus.sourceTimer+SOURCE341.rules.bonus.offset;
    addLog(`燃烧军团第 ${bonus.batch} 批增援来袭！`,'l-red');
  }
}
function clearBonusBatch341(){
  if(!G.bonus||G.bonus.cleared)return;
  G.bonus.cleared=true;settleKingGold341();
  for(const p of G.players){const k=G.kings[p.team];let index=0;
    for(const f of p.fighters)if(f.hp>0&&f.deadT<=0){
      f.x=k.x+(index%3-1)*12;f.y=k.y+(k.y<CFG.ROAD_Y?1:-1)*Math.min(Math.abs(k.y-CFG.ROAD_Y)-40,65+Math.floor(index/3)*12);index++;
      f.homeX=f.x;f.homeY=f.y;forgetCombatTarget(f);
    }
  }
  addLog('本批军团已清除，存活部队集结王城；下一批仍按倒计时来袭。','l-gold');
}

function gameOver(winner) {
  G.result = { winner };
  G.phase = 'over';
  addLog(winner === null ? '双方守住了最终波，平局！' : winner === 0 ? '🏆 蓝方胜利！' : '💀 蓝方战败…', winner === 0 ? 'l-green' : 'l-red');
  if (typeof showOverlay === 'function') showOverlay('result');
}
function leavePlayer341(slot){
  const p=G.players[slot];if(!p?.active)return;
  p.active=false;p.isHuman=false;p.ai=null;p.towers=[];
  if(G.phase==='prep')p.fighters=[];
  p.spawnList=[];p.mercSpawnList=[];p.mercQueue=[];p.workerQueue=[];p.lumberResearch=null;
  if(!p.enemies.length)p.paid=true;
  addLog(`${p.name} 已离场，其防区停止后续刷怪。`,'l-red');
  if(!G.players.some(q=>q.active&&q.team===p.team))gameOver(1-p.team);
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
  d.hp = d.hp * G.diff.emult;
  d.dmg = Math.round(d.dmg * G.diff.emult);
  return d;
}

/* ---------- 模拟主循环 ---------- */
function simStep(dt) {
  if (G.phase === 'prep' || G.phase === 'combat') {
    G.kingControlClock=(G.kingControlClock||0)+dt;const ticks=Math.floor(G.kingControlClock+1e-9);
    if(ticks){G.kingControlClock-=ticks;for(const k of G.kings)k.controlLock=Math.max(0,k.controlLock-ticks);}
    G.floaters = G.floaters.filter(f => { f.t -= dt; f.y -= 20 * dt; return f.t > 0; });
    G.fx = G.fx.filter(f => (f.t -= dt) > 0);
    for (const p of G.players)if(p.active){stepConstruction341(p,dt);mineStep(p, dt);}
    for (const k of G.kings) if (k.hp > 0) {
      k.hp = Math.min(k.max, k.hp + k.regen * dt);
      k.mana=Math.min(k.manaMax,k.mana+SOURCE341.king.manaRegen*dt);
      if(G.phase==='prep')k.cd=Math.max(0,k.cd-dt);
      for(const id in k.spellCD)k.spellCD[id]=Math.max(0,k.spellCD[id]-dt);
    }
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
    bonusStep341(dt);
    for (const p of G.players) fieldStep(p, dt);
    for (const k of G.kings) { kingStep(k, dt); if (G.phase === 'over') return; }
    stepSkillWaves341(dt);
    stepProjectiles341(dt);
    if(G.phase==='over')return;
    if (G.players.every(p => p.paid) && G.kings.every(k => k.leaks.length === 0)) endWave();
  }
  if (G.phase !== 'over' && checkOver()) return;
}

function forceLeakAll() {
  for (const p of G.players) {
    for(const item of [...p.spawnList,...p.mercSpawnList])spawnEnemy(p,item);
    p.spawnList=[];p.mercSpawnList=[];
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
    while (p.spawnT <= 1e-9 && p.spawnList.length) {
      spawnEnemy(p, p.spawnList.shift());
      p.spawnT += p.spawnIv;
    }
  }
  if(p.mercSpawnList.length){
    p.mercSpawnT-=dt;
    if(p.mercSpawnT<=1e-9){for(const item of p.mercSpawnList)spawnEnemy(p,item);p.mercSpawnList=[];}
  }
  // Both allied armies can defend their shared king; simulation ownership stays per lane.
  const combat={...p,enemies:[...p.enemies,...G.kings[p.team].leaks]};
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
  for(const e of combat.enemies)if(e.ownerId===p.id&&e.hp>0)bossStep341(p,e,dt);
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
  if (!p.paid && !p.spawnList.length && !p.mercSpawnList.length && !p.enemies.length) payClear(p);
}

function spawnEnemy(p, item) {
  let e;
  if (item.type === 'merc') {
    const m = MERCS[item.id];
    e = { hp:m.hp,max:m.hp,dmg:m.dmg,aspd:m.aspd,range:m.range,speed:m.speed,armor:m.armor,atk:m.atk,r:m.r,
      armorPoints:m.armorPoints,regenFlat:m.regenFlat,regen:0,magicImmune:!!m.abil.magicImmune,air:m.air,boss:false,
      attackBase:m.attackBase,attackDice:m.attackDice,attackSides:m.attackSides,weapon:m.weapon,attackPoint:m.attackPoint,projectileSpeed:m.projectileSpeed,
      mana:m.manaStart,bloodCD:0 };
    e.mercId = item.id;
    e.bounty=m.sourceFields.ulev??1;
  } else {
    const d = G.waveDef;
    e = { hp: d.hp, max: d.hp, dmg: d.dmg, aspd: d.aspd, range: d.range, speed: d.speed, armor: d.armor, atk: d.atk, r: d.r, regen: d.regen, magicImmune: d.magicImmune, boss: d.boss };
    e.trait = d.trait; e.bounty=d.bounty; e.armorPoints=d.armorPoints; e.regenFlat=d.regenFlat; e.air=d.air;
    e.rawId=d.rawId;e.targets=d.targets;e.attackBase=d.attackBase;e.attackDice=d.attackDice;e.attackSides=d.attackSides;
    e.attackScale=G.diff.emult;e.attackPoint=d.attackPoint;e.projectileSpeed=d.projectileSpeed;
    e.mana=d.manaStart;e.manaMax=d.manaMax;e.manaRegen=d.manaRegen;e.spellCD={};e.bossScan=0;e.weapon=d.weapon;e.bounce=d.bounce;
  }
  e.laneX = p.gx + 16 + Math.random() * (CFG.GRID_W - 32);
  e.ownerId=p.id;combatAgent(e);
  e.x = e.laneX;
  e.y = p.spawnY;
  e.cd = 0;
  e.slowT = 0; e.slowF = 1; e.flash = 0;
  p.enemies.push(e);
}

function enemyAct(p, e, dt,engageOnly=false) {
  if (e.hp <= 0 || e.stunT>0) {e.attackWindup=null;return engageOnly;}
  e.cd -= dt;
  if (e.flash > 0) e.flash -= dt;
  if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slowF = 1; }
  if (e.regen) e.hp = Math.min(e.max, e.hp + e.max * e.regen * dt);
  if(e.regenFlat)e.hp=Math.min(e.max,e.hp+e.regenFlat*dt);
  const sp = e.speed * e.slowF * (e.mercMove||1);

  const b=combatAgent(e),reach=e.range+e.r;
  const tgt=chooseCombatTarget(e,p.fighters,{sense:Math.max(CFG.AGGRO,reach+20),reach,
    canTarget:f=>defenseWalkable(p,f.x,f.y)||Math.hypot(f.x-e.x,f.y-e.y)<=reach,
    x:b.targetId?(b.anchorX??e.x):e.x,y:b.targetId?(b.anchorY??e.y):e.y,leash:COMBAT_AI.ENEMY_LEASH},dt);
  if (tgt) {
    const td=Math.hypot(tgt.x-e.x,tgt.y-e.y);
    if (td <= reach+COMBAT_AI.RANGE_EPS) {
      b.state='attack';b.chase=0;
      enemyAttack341(p,e,tgt,dt);
    } else {
      e.attackWindup=null;b.state='chase';moveCombatUnit(p,e,tgt,sp,dt,reach);b.chase+=dt;
    }
    return true;
  } else {
    b.state='advance';
    if(engageOnly)return false;
    e.attackWindup=null;
    e.y += p.direction * sp * dt;
    e.x += (e.laneX - e.x) * 0.5 * dt;
    if ((e.y - p.exitY) * p.direction >= 0) leak(p, e);
  }
}

function enemyAttack341(p,e,target,dt){
  const id=target.royalTeam!==undefined?'king:'+target.team:target.entityId;
  if(e.attackWindup&&e.attackWindup.targetId!==id)e.attackWindup=null;
  if(e.attackWindup){
    e.attackWindup.time-=dt;if(e.attackWindup.time>1e-9)return;
    e.attackWindup=null;e.flash=.12;
    const damage=enemyDamage341(e);
    if(e.weapon==='normal'||e.weapon==='instant'||e.projectileSpeed===0)resolveEnemyAttack341(p,e,target,damage);
    else G.projectiles.push({p,source:e,enemyShot:true,x:e.x,y:e.y,px:e.x,py:e.y,tgt:target,sp:e.projectileSpeed||CFG.PROJ_SPEED,dmg:damage,atk:e.atk,ab:{},t:Math.max(3,Math.hypot(target.x-e.x,target.y-e.y)/(e.projectileSpeed||CFG.PROJ_SPEED)+2)});
    return;
  }
  if(e.cd>0)return;
  const rate=(1+(e.mercHaste||0))*Math.max(.05,1-(e.attackSlow||0));
  e.cd=e.aspd/rate;e.attackWindup={targetId:id,time:(e.attackPoint??.3)/rate};
}
function resolveEnemyAttack341(p,e,target,damage,bounceOnly=false){
  if(target.royalTeam===undefined){if(bounceOnly)hitFighter(p,target,damage,e.atk,e);else mercAttack341(p,e,target,damage);return;}
  const k=target,m=ATK_ARMOR[e.atk]?.['英雄甲']??1;
  k.hp=Math.max(0,k.hp-damage*m*armorFactor(k.armorPoints+kingAura341(k.team,k).armor)*(MERCS[e.mercId]?.abil.kingMult||1));k.flash=.15;
  if(k.hp<=0)gameOver(1-k.team);
}

function hitFighter(p,f,dmg,atk,attacker) {
  const a=f.def.abil;
  if(Object.values(f.buffs||{}).some(b=>b.invulnerable))return;
  const spell=atk==='法术';
  if(!spell&&a.evasion&&Math.random()<a.evasion)return;
  if(!spell&&attacker&&Math.random()<(attacker.miss||0))return;
  if(magicDamageBlocked341(a.magicImmune,atk))return;
  let amount=dmg*(ATK_ARMOR[atk]?.[f.def.armor]??1)*(spell?1:armorFactor((f.effArmor??f.def.armorPoints)-(f.armorLoss||0)))*(f.damageTaken||1)*(1+(f.mark||0));
  if(atk==='穿刺'&&a.defend)amount*=a.defend;
  if(!spell&&a.block&&Math.random()<a.block.chance)amount=Math.max(a.block.minimum,amount-a.block.amount);
  if(a.manaShield&&f.mana>0){const absorb=Math.min(amount*a.manaShield.ratio,f.mana*a.manaShield.perMana);amount-=absorb;f.mana-=absorb/a.manaShield.perMana;}
  const dealt=Math.min(Math.max(0,f.hp),Math.max(0,amount));
  f.hp-=amount;f.flash=.15;
  recordCombatThreat(f,attacker,amount);
  if(f.hp<=0)resetCombatAgent(f);
  if(!spell&&attacker&&a.reflect&&attacker.range<=45)dmgEnemy(attacker,amount*a.reflect.p,'法术');
  if(f.hp<=0&&a.reinc&&!f.reincUsed){f.reincUsed=true;f.deadT=2.2;}
  return dealt;
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
  if(d>reach+COMBAT_AI.RANGE_EPS){
    b.windup=null;b.state='chase';
    moveCombatUnit(p,f,tgt,fighterSpeed341(p,f),dt,reach);b.chase+=dt;
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
  b.windup={targetId:tgt.entityId,time:(f.def.attackPoint??.3)/rate};
}
function executeFighterAttack(p,f,tgt,R){
  f.attacks=(f.attacks||0)+1;
  const ab=f.def.abil||{};
  let dmg=rollAttack341(f.def)*(f.def.dmg ? f.effDmg/f.def.dmg : 1)+(ab.flatDamage||0);
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
    if(f.def.melee){const dealt=dmgEnemy(target,dmg,f.def.atk,f);hit341(p,f,target,dealt,dmg);afterHits(p,target,dmg,f.def.atk,ab,f);f.flash=.12;}
    else if(f.def.weapon==='normal'||f.def.weapon==='instant'||f.def.projectileSpeed===0){const dealt=dmgEnemy(target,dmg,f.def.atk,f);hit341(p,f,target,dealt,dmg);afterHits(p,target,dmg,f.def.atk,ab,f);}
    else G.projectiles.push({p,source:f,x:f.x,y:f.y,px:f.x,py:f.y,tgt:target,sp:f.def.projectileSpeed,dmg,atk:f.def.atk,ab,t:Math.max(3,Math.hypot(target.x-f.x,target.y-f.y)/f.def.projectileSpeed+2)});
  }
}

function dmgEnemy(e, dmg, atk, attacker=null) {
  if (e.hp <= 0) return 0;
  if(e.def){const before=e.hp;hitFighter(G.players[e.ownerId],e,dmg,atk,attacker);return Math.max(0,before-Math.max(0,e.hp));}
  let m = (ATK_ARMOR[atk] && ATK_ARMOR[atk][e.armor]) || 1;
  if(magicDamageBlocked341(e.magicImmune,atk))m=0;
  if(atk!=='法术')m*=armorFactor((e.armorPoints||0)+(e.mercArmor||0)-(e.armorLoss||0));
  if(e.mark)m*=1+e.mark;
  const dealt = Math.min(e.hp, dmg * m);
  e.hp -= dmg * m;
  if(e.hp<=0){
    if(attacker?.royalTeam!==undefined)e.killedByKing=attacker.royalTeam;
    else if(attacker?.ownerId!==undefined)e.killerPlayerId=attacker.ownerId;
  }
  recordCombatThreat(e,attacker,dealt);
  e.flash = 0.12;
  return dealt;
}

/* 溅射 / 连锁 / 减速 等命中后效果 */
function afterHits(p, tgt, dmg, atk, ab,attacker=null) {
  if (ab.splash) {
    for (const e of p.enemies) {
      if (e === tgt || e.hp <= 0) continue;
      if(ab.splash.groundOnly&&e.air)continue;
      const distance=Math.hypot(e.x-tgt.x,e.y-tgt.y),zones=ab.splash.zones;
      const factor=zones?zones.find(zone=>distance<=zone.r)?.factor:distance<=ab.splash.r?ab.splash.p:0;
      if(factor)dmgEnemy(e,dmg*factor,atk,attacker);
    }
  }
  if (ab.chain) {
    launchBounce341(p,attacker,tgt,dmg,atk,{remaining:ab.chain.n,radius:ab.chain.r||140,factor:ab.chain.f,visited:[tgt.entityId]});
  }
  if (ab.slow && tgt.hp > 0) {
    tgt.slowT = Math.max(tgt.slowT, ab.slow.d);
    tgt.slowF = Math.min(tgt.slowF, 1 - ab.slow.p);
    add341Status(tgt,'attackSlow',{time:ab.slow.d,move:ab.slow.p});
  }
}

function launchBounce341(p,source,from,damage,atk,bounce,enemyShot=false){
  if(bounce.remaining<=0||!source)return;
  const candidates=enemyShot?G.players.filter(q=>q.team===p.team).flatMap(q=>q.fighters):p.enemies;
  const target=candidates.filter(t=>t.hp>0&&!(t.deadT>0)&&!bounce.visited.includes(t.entityId)&&allowedTarget341(source.def?.targets||source.targets,t)&&Math.hypot(t.x-from.x,t.y-from.y)<=bounce.radius)
    .sort((a,b)=>Math.hypot(a.x-from.x,a.y-from.y)-Math.hypot(b.x-from.x,b.y-from.y))[0];
  if(!target)return;
  const speed=source.def?.projectileSpeed||source.projectileSpeed||CFG.PROJ_SPEED;
  G.projectiles.push({p,source,enemyShot,bounceOnly:enemyShot,chainOnly:!enemyShot,x:from.x,y:from.y,px:from.x,py:from.y,tgt:target,sp:speed,dmg:damage*bounce.factor,atk,ab:{},t:Math.max(3,bounce.radius/speed+2),
    bounce:{...bounce,remaining:bounce.remaining-1,visited:[...bounce.visited,target.entityId]}});
}

function stepProjectiles341(dt){
  const pending=G.projectiles;G.projectiles=[];
  for(const pr of pending)if(projStep(pr,dt))G.projectiles.push(pr);
}
function projStep(pr, dt) {
  if(pr.delay>0){const wait=Math.min(pr.delay,dt);pr.delay-=wait;dt-=wait;if(dt<=0)return true;}
  pr.t -= dt;
  const t = pr.tgt;
  if (!t || t.hp <= 0 || pr.t <= 0) return false;
  pr.px = pr.x; pr.py = pr.y;
  const dx = t.x - pr.x, dy = t.y - pr.y, d = Math.hypot(dx, dy);
  const step = pr.sp * dt;
  if (d <= step + (t.r||0)) {
    if(pr.enemyShot){resolveEnemyAttack341(pr.p,pr.source,t,pr.dmg,pr.bounceOnly);if(pr.bounce)launchBounce341(pr.p,pr.source,t,pr.dmg,pr.atk,pr.bounce,true);return false;}
    const dealt=dmgEnemy(t,pr.dmg,pr.atk,pr.source);
    if(pr.chainOnly){launchBounce341(pr.p,pr.source,t,pr.dmg,pr.atk,pr.bounce);return false;}
    if(pr.source?.def)hit341(pr.p,pr.source,t,dealt,pr.dmg);
    afterHits(pr.p, t, pr.dmg, pr.atk, pr.ab,pr.source);
    return false;
  }
  pr.x += dx / d * step; pr.y += dy / d * step;
  return true;
}

/* ---------- 漏怪与国王 ---------- */
function kingAura341(team,unit){
  const k=G.kings[team],out={damage:0,armor:0,haste:0,move:0};
  if(!k||k.hp<=0||G.battleMode==='arena')return out;
  const d=Math.hypot(unit.x-k.x,unit.y-k.y);
  for(const s of SOURCE341.king.skills)if(k.skills.includes(s.id)&&s.wave>4&&d<=s.radius)
    for(const key of Object.keys(out))out[key]=Math.max(out[key],s[key]||0);
  return out;
}
function growKing341(k,wave){
  if(wave<=k.growthWave)return;
  k.growthWave=wave;
  const auto=SOURCE341.king.auto;
  k.autoLevel=Math.min(auto.limit,Math.floor(wave/auto.every)*auto.levels);
  k.armorPoints=SOURCE341.king.armorPoints+k.autoLevel*auto.armorPerLevel;
  if(wave===4){const choices=SOURCE341.king.skills.filter(s=>s.wave===4);k.skills.push(choices[Math.floor(Math.random()*choices.length)].id);}
  for(const s of SOURCE341.king.skills)if(s.wave===wave&&wave>4)k.skills.push(s.id);
}
function kingInterval341(k){return k.aspd/(1+k.autoLevel*SOURCE341.king.auto.hastePerLevel+kingAura341(k.team,k).haste);}
function kingMagic341(k,e,damage){if(!e.magicImmune)dmgEnemy(e,damage,'法术',k);}
function kingSpell341(k,target,manualId=null){
  for(const s of SOURCE341.king.skills){
    if(manualId&&s.id!==manualId)continue;
    if(!k.skills.includes(s.id)||!s.cd||(k.spellCD[s.id]||0)>0||k.mana<s.mana)continue;
    const dx=target.x-k.x,dy=target.y-k.y,d=Math.hypot(dx,dy);
    if(s.id==='A022'&&!manualId&&d>50)continue; // Original autocast condition: 200 Warcraft units.
    k.mana-=s.mana;k.spellCD[s.id]=s.cd;k.slamT=.35;k.controlLock=5;
    if(s.id==='A021'){
      launchSkillWave341(k,manualId?target:k,{damage:s.damage,radius:s.radius,length:s.length,speed:SOURCE341.rules.inherited.shockwave.speed*.25,targets:'ground',kind:'king'});
      addFloater(k.x,k.y-30,s.name,'#b0d9ff');return;
    }
    for(const e of k.leaks){
      if(e.hp<=0)continue;
      if(s.id==='A022'){
        if(Math.hypot(e.x-k.x,e.y-k.y)<=s.radius+e.r){kingMagic341(k,e,s.damage);add341Status(e,'kingStomp',{time:s.stun,stun:true});}
      }else{
        const ux=d?dx/d:0,uy=d?dy/d:(k.team===0?-1:1),ex=e.x-k.x,ey=e.y-k.y;
        const along=ex*ux+ey*uy,across=Math.abs(ex*uy-ey*ux);
        if(!e.air&&along>=0&&along<=s.length&&across<=s.radius+e.r)kingMagic341(k,e,s.damage);
      }
    }
    addFloater(k.x,k.y-30,s.name,'#b0d9ff');
    return;
  }
}
function claimKing341(p){
  const k=G.kings[p.team];if(!p.active||!['prep','combat'].includes(G.phase)||k.hp<=0||k.controlLock>0&&k.controller!==p.id)return false;
  if(k.controller!==p.id){k.controller=p.id;k.controlLock=5;}return true;
}
function royalHeal341(p){
  const k=G.kings[p.team];if(!p.active||!p.race||p.royalHealUsed||!['prep','combat'].includes(G.phase)||k.hp<=0||k.hp>=k.max)return false;
  p.royalHealUsed=true;const healed=Math.min(k.max-k.hp,SOURCE341.rules.native.royalHeal.amount);k.hp+=healed;addFloater(k.x,k.y-40,'圣光 +'+Math.round(healed),'#afeab7');return true;
}
function kingCommand341(p,command){
  const k=G.kings[p.team];if(!p.active||k.controller!==p.id||k.hp<=0||!['prep','combat'].includes(G.phase))return false;
  if(command.order==='autocast'){if(typeof command.enabled!=='boolean')return false;k.autocast=command.enabled;}
  else if(command.order==='target'){if(command.targetId!==null&&!k.leaks.some(e=>e.entityId===command.targetId&&e.hp>0))return false;k.manualTarget=command.targetId;k.windup=null;}
  else if(command.order==='spell'){
    const spell=SOURCE341.king.skills.find(s=>s.id===command.spell&&s.cd>0);if(!spell||!k.skills.includes(spell.id)||k.mana<spell.mana||(k.spellCD[spell.id]||0)>0)return false;
    const target=k.leaks.find(e=>e.entityId===command.targetId&&e.hp>0)||k.leaks.find(e=>e.hp>0)||k;
    const mana=k.mana;kingSpell341(k,target,spell.id);if(k.mana===mana)return false;
  }else return false;k.controlLock=5;return true;
}

function launchSkillWave341(source,target,spell){
  const dx=target.x-source.x,dy=target.y-source.y,d=Math.hypot(dx,dy);
  G.skillWaves.push({...spell,x:source.x,y:source.y,px:source.x,py:source.y,startX:source.x,startY:source.y,
    ux:d?dx/d:Math.cos(source.facing??Math.PI/2),uy:d?dy/d:Math.sin(source.facing??Math.PI/2),distance:0,remainingDamage:spell.maxDamage??Infinity,hitIds:[],sourceId:source.entityId,ownerId:source.ownerId,royalTeam:source.royalTeam,team:source.royalTeam??G.players[source.ownerId].team});
}
function bossStep341(p,e,dt){
  const rule=SOURCE341.rules.bosses[e.rawId];if(!rule)return;
  e.mana=Math.min(e.manaMax,e.mana+e.manaRegen*dt);
  for(const id in e.spellCD)e.spellCD[id]=Math.max(0,e.spellCD[id]-dt);
  e.bossScan-=dt;if(e.bossScan>0||e.stunT>0)return;e.bossScan=rule.poll;
  const a=rule.fields,id=rule.spell;if((e.spellCD[id]||0)>0||e.mana<a['amcs:1:0'])return;
  const targets=G.players.filter(q=>q.team===p.team).flatMap(q=>q.fighters).filter(f=>f.hp>0&&f.deadT<=0&&Math.hypot(f.x-e.x,f.y-e.y)<=rule.acquire&&!f.def.abil.magicImmune);
  if(!targets.length)return;
  const target=targets[Math.floor(Math.random()*targets.length)];
  e.mana-=a['amcs:1:0'];e.spellCD[id]=a['acdn:1:0'];
  launchSkillWave341(e,target,{damage:a['Osh1:1:1'],radius:a['aare:1:0']*.25,length:(a['Osh3:1:3']??SOURCE341.rules.inherited.shockwave.distance)*.25,
    speed:(a['amsp:0:0']??SOURCE341.rules.inherited.shockwave.speed)*.25,maxDamage:a['Osh2:1:2']??Infinity,targets:a['atar:1:0'],kind:'boss'});
}
function stepSkillWaves341(dt){
  G.skillWaves=G.skillWaves.filter(w=>{
    const before=w.distance;w.distance=Math.min(w.length,w.distance+w.speed*dt);w.px=w.x;w.py=w.y;
    w.x=w.startX+w.ux*w.distance;w.y=w.startY+w.uy*w.distance;
    const source=w.kind==='king'?G.kings[w.royalTeam]:G.players.flatMap(p=>[...p.enemies,...G.kings[p.team].leaks]).find(e=>e.entityId===w.sourceId);
    const targets=w.kind==='king'?G.kings[w.team].leaks:G.players.filter(p=>p.team===w.team).flatMap(p=>p.fighters).concat(G.kings[w.team]);
    for(const target of targets){
      if(target.hp<=0||target.deadT>0||!allowedTarget341(w.targets,target)||magicDamageBlocked341(target.magicImmune||target.def?.abil.magicImmune,'法术'))continue;
      const id=target.royalTeam!==undefined?'king:'+target.team:combatAgent(target),key=typeof id==='string'?id:target.entityId;
      if(w.hitIds.includes(key))continue;
      const x=target.x-w.startX,y=target.y-w.startY,along=x*w.ux+y*w.uy,cross=Math.abs(x*w.uy-y*w.ux),radius=target.r||26;
      if(along+radius<before||along-radius>w.distance||cross>w.radius+radius)continue;
      w.hitIds.push(key);
      const damage=Math.min(w.damage,w.remainingDamage);w.remainingDamage-=damage;
      if(target.royalTeam!==undefined){target.hp=Math.max(0,target.hp-damage*(ATK_ARMOR['法术']['英雄甲']??1));target.flash=.15;}
      else dmgEnemy(target,damage,'法术',source||null);
    }
    return w.distance<w.length&&w.remainingDamage>0;
  });
}
function leak(p, e) {
  const i = p.enemies.indexOf(e);
  if (i >= 0) p.enemies.splice(i, 1);
  p.leakCount = (p.leakCount || 0) + 1;
  p.totalLeaks++;e.leakRewardFactor=p.leakGoldFactor;
  const k = G.kings[p.team];
  e.toKing = true;e.ownerId=p.id; e.routeX = p.exitX; e.turning = true;forgetCombatTarget(e);
  const spawn=nativeRect341(p.team===0?'LKingSpawn':'RKingSpawn');
  e.x=spawn.x+Math.random()*spawn.w;e.y=spawn.y+Math.random()*spawn.h;
  e.route=[{x:k.x,y:k.y}];e.routeIndex=0;
  k.leaks.push(e);
  addFloater(p.exitX - 20, e.y, '漏怪!', '#ff6a5e');
  if (p.isHuman) addLog(`${p.name} 第 ${G.wave} 波漏怪！国王受到威胁`, 'l-red',p.team);
}

function kingStep(k, dt) {
  if (k.slamT > 0) k.slamT -= dt;
  k.cd -= dt;
  if (k.flash > 0) k.flash -= dt;
  separateKingUnits(k,dt);
  const burn=SOURCE341.king.skills.find(s=>s.id==='A01T');
  if(k.skills.includes(burn.id))for(const e of k.leaks)if(!e.air&&e.hp>0&&Math.hypot(e.x-k.x,e.y-k.y)<=burn.radius+e.r)kingMagic341(k,e,burn.dps*dt);
  for (const e of k.leaks) {
    if(e.hp<=0)continue;
    const owner=G.players[e.ownerId],defenders=G.players.filter(p=>p.team===k.team).flatMap(p=>p.fighters);
    if(owner&&enemyAct({...owner,fighters:defenders},e,dt,true))continue;
    if(e.routeIndex<e.route.length-1){
      walkRoute(e,e.speed*e.slowF*(e.mercMove||1)*dt);
      e.turning=e.routeIndex===0;continue;
    }
    const dx = k.x - e.x, dy = k.y - e.y, d = Math.hypot(dx, dy);
    const reach = e.range + e.r + 26;
    if (d <= reach) {
      enemyAttack341(owner,e,k,dt);
      if(G.phase==='over')return;
    } else {
      e.attackWindup=null;const sp = e.speed * e.slowF * (e.mercMove||1);
      e.x += dx / d * sp * dt; e.y += dy / d * sp * dt;
    }
  }
  // Single-target hero missile; AoE comes only from learned spells.
  if(k.windup){
    k.windup.time-=dt;
    const target=k.leaks.find(e=>e.entityId===k.windup.targetId&&e.hp>0);
    if(!target||Math.hypot(target.x-k.x,target.y-k.y)>CFG.KING_RANGE+target.r)k.windup=null;
    else if(k.windup.time<=1e-9){
      G.projectiles.push({source:k,x:k.x,y:k.y,px:k.x,py:k.y,tgt:target,sp:SOURCE341.king.projectileSpeed,
        dmg:(rollAttack341({attackBase:SOURCE341.king.sourceFields.ua1b,attackDice:SOURCE341.king.sourceFields.ua1d,attackSides:SOURCE341.king.sourceFields.ua1s})+k.min-SOURCE341.king.min)*(1+kingAura341(k.team,k).damage),atk:'英雄',ab:{},t:3});
      k.windup=null;k.flash=.2;
    }
  }
  if (k.cd <= 0 && !k.windup && k.leaks.length) {
    let tgt = null, td = 1e9;
    for (const e of k.leaks) {
      if(e.hp<=0)continue;
      const d = Math.hypot(e.x - k.x, e.y - k.y);
      if (d < td) { td = d; tgt = e; }
    }
    const manual=k.leaks.find(e=>e.entityId===k.manualTarget&&e.hp>0);if(manual){tgt=manual;td=Math.hypot(tgt.x-k.x,tgt.y-k.y);}
    if (tgt && td <= CFG.KING_RANGE + tgt.r) {
      k.facing=Math.atan2(tgt.y-k.y,tgt.x-k.x);if(k.autocast)kingSpell341(k,tgt);
      k.cd = kingInterval341(k);
      k.windup={targetId:tgt.entityId,time:SOURCE341.king.windup*k.cd/k.aspd};
    }
  }
  for (const e of k.leaks) if (e.hp <= 0) {rewardEnemy(G.players[e.ownerId],e);addPuff(e.x, e.y, '#ff8a80', 6 + e.r);}
  k.leaks = k.leaks.filter(e => e.hp > 0);
}

/* ---------- 经济 / 操作 ---------- */
function armyFood341(p){return p.towers.reduce((sum,f)=>sum+((UNITS[f.upgradePending]||f.def).food||0),0);}
function foodCapacity341(p){const rules=SOURCE341.rules.population;return Math.min(rules.ceiling,rules.town+(rules.farms[p.farmLevel]?.supply||0));}
function farmUpgrade341(p){
  if(!['prep','combat'].includes(G.phase))return false;
  const next=SOURCE341.rules.population.farms[p.farmLevel+1];
  if(p.farmPending||!next||foodCapacity341(p)>=SOURCE341.rules.population.ceiling||p.gold<next.gold||p.wood<next.wood)return false;
  p.gold-=next.gold;p.wood-=next.wood;p.farmPending={time:next.time,level:p.farmLevel+1};
  addLog(`${p.name} 开始升级农场，${next.time} 秒后扩容。`,'l-gold',p.team);return true;
}
function minePosition(p, index) {
  const zone=mineZone(p);
  return { x:zone.x+32+(index%2)*96,y:zone.y+100+Math.floor(index/2)*150 };
}
function mineZone(p){const at=townPosition341(p);return {x:at.x-100,y:at.y-100,w:200,h:200};}
function townPosition341(p){const m=SOURCE341.rules.native.map,at=m.towns[p.id];return {x:(at[0]-m.minX)*m.scale,y:(m.maxY-at[1])*m.scale};}

function buyMine(){return false;}

function upgradeMine(){return false;}

function mineStep(p,dt){lumberStep341(p,dt);}

function buyWorker341(p){
  const r=SOURCE341.rules.native.workers;
  if(!['prep','combat'].includes(G.phase)||p.lumberResearch||p.workers+p.workerQueue.length>=r.limit||p.gold<r.gold||playerValue(p)<r.requireValue)return false;
  p.gold-=r.gold;p.workerQueue.push({time:r.time});return true;
}
function researchLumber341(p){
  const r=SOURCE341.rules.native.workers.upgrades[p.lumberLevel],required=[600,1300,2000][Math.min(p.lumberLevel,2)];
  if(!r||p.workerQueue.length||p.lumberResearch||p.gold<r.gold||p.wood<r.wood||playerValue(p)<required||!['prep','combat'].includes(G.phase))return false;
  p.gold-=r.gold;p.wood-=r.wood;p.lumberResearch={time:r.time};return true;
}
function lumberStep341(p,dt){
  const r=SOURCE341.rules.native.workers;
  while(dt>1e-9){
    const step=Math.min(dt,p.workerQueue[0]?.time??Infinity,p.lumberResearch?.time??Infinity,...p.workerHarvest.map(t=>r.cycle-t));
    for(let i=0;i<p.workerHarvest.length;i++){p.workerHarvest[i]+=step;if(p.workerHarvest[i]>=r.cycle-1e-9){p.workerHarvest[i]=0;p.wood+=r.amount+p.lumberLevel;}}
    if(p.workerQueue.length){p.workerQueue[0].time-=step;if(p.workerQueue[0].time<=1e-9){p.workerQueue.shift();p.workers++;p.workerHarvest.push(0);}}
    if(p.lumberResearch){p.lumberResearch.time-=step;if(p.lumberResearch.time<=1e-9){p.lumberLevel++;p.lumberResearch=null;}}
    dt-=step;
  }
}

function payClear(p) {
  p.paid=true;
  if(p.isHuman)addLog(p.leakCount ? `第 ${G.wave} 波漏怪 ${p.leakCount} 个` : `第 ${G.wave} 波防守成功`,p.leakCount?'l-red':'l-gold',p.team);
}
function rewardEnemy(p,e){
  if(!p||e.rewarded)return;
  const bounty=G.wave>=31?0:Math.floor((e.bounty||0)*(e.toKing?(e.leakRewardFactor??0):1));
  if(e.killedByKing!==undefined){
    const gold=bounty;for(const team of [0,1])G.kingGoldPools[team]+=gold;e.rewarded=true;
    if(gold>0)addFloater(e.x,e.y-e.r-18,`+${gold} 团队金`,'#f5cf65','gold');return;
  }
  p=G.players[e.killerPlayerId]||p;
  const gold=Math.round(bounty*gainMult(p));
  p.gold+=gold;e.rewarded=true;
  if(gold>0)addFloater(e.x,e.y-e.r-18,`+${gold} 金`,'#f5cf65','gold');
}
function settleKingGold341(){
  for(const team of [0,1]){
    const players=G.players.filter(p=>p.active&&p.team===team),share=players.length?Math.floor(G.kingGoldPools[team]/players.length):0;
    for(const p of players)if(share>0){p.gold+=Math.round(share*gainMult(p));addLog(`${p.name} 获得国王击杀分红 +${share} 金`,'l-gold',team);}
    G.kingGoldPools[team]=0;
  }
}

function cellFree(p, col, row) {
  return !p.towers.some(f => f.col === col && f.row === row);
}

function buyFighter(p, uid, col, row) {
  if(!canManageArmy())return false;
  const def = UNITS[uid];
  if(!p.race||(p.race==='prophet'?!p.prophetDeck.includes(uid):def?.race!==p.race))return false;
  if(def&&armyFood341(p)+(def.food||0)>foodCapacity341(p))return false;
  if (!Object.hasOwn(UNITS,uid) || !def || def.elite || def.summonOnly || !Number.isInteger(col) || !Number.isInteger(row) || p.gold < def.purchaseCost || col < 0 || col >= CFG.COLS || row < 0 || row >= CFG.ROWS || !cellFree(p, col, row)) return false;
  if(p.wood<def.woodCost)return false;
  p.gold -= def.purchaseCost;p.wood-=def.woodCost;
  p.towers.push({
    def, uid, col, row,ownerId:p.id,r:10,
    x: p.gx + (col + 0.5) * CFG.CELL, y: p.gy + (row + 0.5) * CFG.CELL,
    hp: def.hp, max: def.hp, cd: 0.3, spent: def.purchaseCost,newlyBuilt:p.race!=='hybrid',constructionRemaining:def.constructionTime,constructionGold:def.purchaseCost,constructionWood:def.woodCost,hybridTier:def.hybridTier,pendingBattle:G.phase==='combat',
    effDmg: def.dmg, flash: 0, deadT: 0, reincUsed: false,
  });
  init341Fighter(p.towers[p.towers.length-1]);
  recalcAuras(p);
  return true;
}
function chooseBuilder341(p,race){
  if(!['prep','combat'].includes(G.phase)||p.race||!Object.hasOwn(RACES,race)||p.builderChoices&&!p.builderChoices.includes(race)||!p.builderChoices&&p.towers.length)return false;
  p.race=race;p.builderChoices=null;p.prophetDeck=race==='prophet'?rollProphet341():[];return true;
}
function rollProphet341(){return UNIT_POOLS341.map(pool=>pool[Math.floor(Math.random()*pool.length)]);}
function rerollProphet341(p){
  const r=SOURCE341.rules.native.prophetReroll,n=p.prophetRerolls;
  if(!['prep','combat'].includes(G.phase)||p.race!=='prophet'||n>=r.limit||p.gold<r.gold+n*r.goldStep||p.wood<r.wood+n*r.woodStep)return false;
  p.gold-=r.gold+n*r.goldStep;p.wood-=r.wood+n*r.woodStep;p.prophetRerolls++;p.prophetDeck=rollProphet341();return true;
}
function stepConstruction341(p,dt){
  if(p.farmPending){p.farmPending.time-=dt;if(p.farmPending.time<=1e-9){p.farmLevel=p.farmPending.level;p.farmPending=null;}}
  for(const f of p.towers){
    if(!(f.constructionRemaining>0))continue;f.constructionRemaining=Math.max(0,f.constructionRemaining-dt);if(f.constructionRemaining>1e-9)continue;
    f.constructionRemaining=0;
    if(f.hybridTier!==undefined){const pool=UNIT_POOLS341[f.hybridTier];f.uid=pool[Math.floor(Math.random()*pool.length)];f.def=UNITS[f.uid];delete f.hybridTier;}
    if(f.upgradePending){f.uid=f.upgradePending;f.def=UNITS[f.uid];delete f.upgradePending;}
    f.hp=f.max=f.def.hp;f.effDmg=f.def.dmg;init341Fighter(f);
  }
}
function changeBuilder341(p){
  const r=SOURCE341.rules.native.changeBuilder,n=p.builderChanges;
  if(!['prep','combat'].includes(G.phase)||!p.race||n>=r.limit||p.gold<r.gold+n*r.goldStep||p.wood<r.wood+n*r.woodStep)return false;
  p.gold-=r.gold+n*r.goldStep;p.wood-=r.wood+n*r.woodStep;p.builderChanges++;
  const pool=Object.keys(RACES),first=pool.splice(Math.floor(Math.random()*pool.length),1)[0],second=pool[Math.floor(Math.random()*pool.length)];
  p.race=null;p.builderChoices=[first,second];return true;
}

function upgradeFighter(p,f,targetId) {
  if(!canManageArmy())return false;
  if(!p.towers.includes(f)||f.constructionRemaining>0||G.phase==='combat'&&!f.pendingBattle)return false;
  const nextId=targetId??f.def.up;
  const stance=f.def.stances.includes(nextId);
  if(!stance&&!f.def.upgrades.includes(nextId))return false;
  const next=UNITS[nextId];if(!next)return false;
  if(armyFood341(p)-(f.def.food||0)+(next.food||0)>foodCapacity341(p))return false;
  const cost=stance?0:next.purchaseCost;
  if(p.gold<cost||p.wood<(stance?0:next.woodCost))return false;
  const ratio=f.hp/f.max,mana=f.mana;
  p.gold-=cost;p.wood-=stance?0:next.woodCost;f.spent+=cost;
  if(!stance&&next.constructionTime>0){f.upgradePending=nextId;f.constructionRemaining=next.constructionTime;f.constructionGold=cost;f.constructionWood=next.woodCost;return true;}
  f.def=next;f.uid=nextId;f.hp=next.hp;f.max=next.hp;
  init341Fighter(f);
  if(stance){f.hp=f.max*ratio;f.mana=Math.min(next.manaMax,mana);}
  addFloater(f.x,f.y,stance?'切换形态':'升级!','#7ee08a');recalcAuras(p);return true;
}

function fighterSellValue(f){return Math.floor(f.def.pointValue*(f.newlyBuilt?1:f.def.abil.refund??SOURCE341.rules.native.sellPercent));}
function cancelConstruction341(p,f){
  if(!['prep','combat'].includes(G.phase)||!p.towers.includes(f)||!(f.constructionRemaining>0)||f.hybridTier!==undefined&&f.constructionRemaining<=.3)return false;
  const rate=Number(SOURCE341.rules.misc[f.upgradePending?'UpgradeRefundRate':'ConstructionRefundRate']);
  p.gold+=Math.floor(f.constructionGold*rate);p.wood+=Math.floor(f.constructionWood*rate);
  if(f.upgradePending){f.spent-=f.constructionGold;delete f.upgradePending;f.constructionRemaining=0;}else p.towers.splice(p.towers.indexOf(f),1);
  return true;
}
function cancelFarm341(p){
  if(!['prep','combat'].includes(G.phase)||!p.farmPending)return false;const farm=SOURCE341.rules.population.farms[p.farmPending.level],rate=Number(SOURCE341.rules.misc.UpgradeRefundRate);
  p.gold+=Math.floor(farm.gold*rate);p.wood+=Math.floor(farm.wood*rate);p.farmPending=null;return true;
}
function sellFighter(p, f) {
  if(G.phase!=='prep')return false;
  const i = p.towers.indexOf(f);
  if (i < 0 || f.temporary||f.constructionRemaining>0) return false;
  p.towers.splice(i, 1);
  const refund=fighterSellValue(f);p.gold += refund;
  addFloater(f.x, f.y, `+${refund}金`, '#f5c542');
  if (G.selectedFighter === f) G.selectedFighter = null;
  recalcAuras(p);
  return true;
}

function recalcAuras(p) {
  for(const f of p.fighters){let amp=kingAura341(p.team,f).damage;
    for(const src of p.fighters){const a=src.def.abil.aura;
      if(a&&src.hp>0&&(!a.rangedOnly||!f.def.melee)&&Math.hypot(f.x-src.x,f.y-src.y)<=a.r)amp=Math.max(amp,a.p);
    }
    f.effDmg=f.def.dmg*(1+amp);
  }
}

function kingUpgradeCost(k, stat = 'health') {
  if (!Object.hasOwn(KING_UPGRADES, stat)) return Infinity;
  const def=KING_UPGRADES[stat];
  return k.upgrades[stat]>=def.limit?Infinity:def.cost;
}

function kingUpgrade(p, stat = 'health') {
  if (!Object.hasOwn(KING_UPGRADES, stat) || !['prep', 'combat'].includes(G.phase)) return false;
  const k = G.kings[p.team];
  const cost = kingUpgradeCost(k, stat);
  if (!Number.isFinite(cost)||p.wood < cost) return false;
  p.wood -= cost;
  k.lvl++;
  k.upgrades[stat]++;
  const def=KING_UPGRADES[stat],amount = def.amounts?.[k.upgrades[stat]-1]??def.amount;
  if (stat === 'health') { k.max += amount; k.hp = Math.min(k.max, k.hp + amount); }
  if (stat === 'attack') {k.dmg += amount;k.min+=amount;k.maxDamage+=amount;}
  if (stat === 'regen') k.regen += amount;
  p.income += def.income;
  addFloater(k.x, k.y - 30, `${KING_UPGRADES[stat].name}强化!`, '#f5c542');
  addLog(`${p.name} 强化国王${KING_UPGRADES[stat].name}（Lv.${k.upgrades[stat]}），收入 +${def.income}`, 'l-blue');
  return true;
}

function sendMerc(from, target, mercId) {
  const m = Object.hasOwn(MERCS,mercId)?MERCS[mercId]:null;
  const enemies=G.players.filter(p=>p.active&&p.team!==from.team);
  if (!m || !from.active || !['prep','combat'].includes(G.phase) || G.wave<m.unlockWave || from.wood < m.cost || !enemies.length) return false;
  from.wood -= m.cost;
  from.income += m.income;
  G.mercCursor||=[0,0];target=enemies[G.mercCursor[from.team]++%enemies.length];
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
function addFloater(x, y, txt, color, kind='text') { G.floaters.push({ x, y, txt, color,kind, t:kind==='gold'?1.7:1.3 }); }
function addLog(txt, cls,team=null) {
  G.logLines.push({ txt, cls: cls || '',team });
  if (G.logLines.length > 60) G.logLines.shift();
}
function playerValue(p) { return p.towers.reduce((s, f) => s + f.def.pointValue, 0); }

/* ---------- 3.41 阵营竞技场：第 10 / 20 波后的独立奖励回合 ---------- */
function canManageArmy(){return ['prep','combat'].includes(G.phase)&&!(G.battleMode==='arena'&&G.phase==='combat');}
function createBattleArmy341(p){
  for(const t of p.towers)if(t.constructionRemaining>0)t.pendingBattle=true;
  p.fighters=p.towers.filter(t=>!(t.constructionRemaining>0)).map(tower=>{tower.newlyBuilt=false;tower.pendingBattle=false;const f={...tower,entityId:undefined,brain:undefined},steroids=tower.steroids;restoreFighter(p,f);f.steroids=steroids;tower.steroids=false;return f;});
}
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
  for(const p of G.players){p.paid=true;p.aiT=.5;p.spawnList=[];p.mercSpawnList=[];p.enemies=[];}
  addLog(`第 ${G.wave} 波已守住！${CFG.ARENA_PREP} 秒后传送至独立竞技场，开始阵营 PK。`,'l-gold');
}
function startArenaCombat(){
  G.phase='combat';G.combatT=0;G.arena.stage='march';G.arena.elapsed=0;
  G.projectiles=[];G.selectedShop=null;G.selectedFighter=null;
  for(const p of G.players){
    createBattleArmy341(p);
    for(const f of p.fighters){
      const steroids=f.steroids;restoreFighter(p,f);f.steroids=steroids;
      if(steroids){f.max=f.def.hp*1.2;f.hp=f.max;}
      prepareArenaFighter(p,f);
      f.cd=0;f.newlyBuilt=false;
      const area=nativeRect341(p.team===0?'ArenaTopBig':'ArenaBotBig');f.x=area.x+Math.random()*area.w;f.y=area.y+Math.random()*area.h;
      f.route=[nativeCenter341('ArenaCenter')];f.routeIndex=0;
    }
    start341Round(p);
  }
  G.arena.counts=arenaCounts();G.arena.countdown=5.5;
  addLog('双方军团已传送至独立竞技场，倒计时后交战。','l-red');
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
function arenaResultText341(){
  const timing=SOURCE341.rules.timing,arena=G.arena;
  return arena.awarded?`PK 已结算 · ${Math.max(0,Math.ceil(timing.arenaAwardDelay+timing.arenaResult-arena.elapsed))} 秒后准备下一关`:`PK 已分胜负 · ${Math.max(0,Math.ceil(timing.arenaAwardDelay-arena.elapsed))} 秒后发奖`;
}
function arenaViews(){
  const sides=[0,1].map(team=>G.players.filter(p=>p.team===team).flatMap(p=>p.fighters));
  return sides.map((fighters,team)=>({arenaView:true,team,fighters,enemies:sides[1-team],direction:team===0?-1:1}));
}
function arenaStep(dt){
  const arena=G.arena;arena.elapsed+=dt;G.combatT+=dt;
  if(arena.stage==='result'){
    const timing=SOURCE341.rules.timing;
    if(!arena.awarded&&arena.elapsed>=timing.arenaAwardDelay){
      arena.awarded=true;for(const p of G.players)if(p.active&&(arena.winner===null||p.team===arena.winner))p.gold+=arena.bonus;
      addLog(`PK 奖励已发放：${arena.winner===null?'双方':'胜方'}每人 +${arena.bonus} 金。`,'l-gold');
    }
    if(arena.elapsed>=timing.arenaAwardDelay+timing.arenaResult){restoreArenaArmies();startPrep(true);}return;
  }
  if(arena.countdown>0){arena.countdown=Math.max(0,arena.countdown-dt);return;}
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
        const enemies=views[1-view.team].fighters.filter(e=>e.hp>0);const nearby=enemies.some(e=>Math.hypot(e.x-f.x,e.y-f.y)<=Math.max(f.def.acquireRange||125,effRange(f.def)+28));
        f.arenaReady=nearby||walkRoute(f,(f.def.speed||75)*f.slowF*dt);
        f.cd=Math.max(0,f.cd-dt);continue;
      }
      const targets=view.enemies.filter(e=>e.hp>0&&e.deadT<=0&&e.arenaReady);
      fighterAct({...view,enemies:targets},f,dt);
      if(f.def.abil.burn)for(const e of targets)if(Math.hypot(e.x-f.x,e.y-f.y)<=f.def.abil.burn.r)dmgEnemy(e,f.def.abil.burn.dps*dt,'法术',f);
    }
  }
  spreadArenaUnits(dt);
  stepProjectiles341(dt);
  // Death summons and reincarnation must resolve before testing for an empty team.
  for(let pass=0;pass<4;pass++)for(const view of arenaViews())for(const f of [...view.fighters]){
    if(f.hp<=0&&f.deadT<=0&&!f.deathHandled)death341(view,f);
  }
  for(const p of G.players)p.fighters=p.fighters.filter(f=>!f.temporary||f.hp>0||f.deadT>0);
  arena.counts=arenaCounts();
  const [blue,red]=arena.counts;
  if(!blue||!red){finishArena(blue?0:red?1:null);return;}
  arena.stage=G.players.some(p=>p.fighters.some(f=>f.arenaReady))?'fight':'march';
}
function finishArena(winner){
  if(G.arena.stage==='result')return;
  const bonus=G.wave*(winner===null?5:10);
  G.arena.stage='result';G.arena.winner=winner;G.arena.bonus=bonus;G.arena.awarded=false;G.arena.elapsed=0;G.projectiles=[];
  G.arenaHistory.push({wave:G.wave,winner,bonus,timeout:false});
  addLog(`${winner===null?'双方军团全灭，PK 平局':(winner===0?'苍岚':'赤焰')+'军团赢得 PK'}！2 秒后发放奖励，展示结果 20 秒后继续守关。`,'l-gold');
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
  const area=nativeRect341('ArenaVision');for(const f of units){f.x=Math.max(area.x,Math.min(area.x+area.w,f.x));f.y=Math.max(200,Math.min(1900,f.y));}
}
function restoreArenaArmies(){
  for(const p of G.players){p.fighters=p.towers;for(const f of p.fighters)restoreFighter(p,f);recalcAuras(p);}
}
