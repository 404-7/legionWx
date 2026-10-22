'use strict';
// Mercenaries keep their enemy movement/king routes and share the same status system.
function tickMerc341(p,dt){
 const owned=e=>!e.toKing||e.ownerId===p.id;
 const units=p.enemies.filter(e=>e.hp>0&&e.mercId&&owned(e)),friends=G.players.filter(q=>q.team===p.team).flatMap(defenseTargets).filter(e=>e.hp>0);
 const foes=G.players.filter(q=>q.team===p.team).flatMap(q=>q.fighters).filter(f=>f.hp>0&&f.deadT<=0);
 for(const e of units){
  const m=MERCS[e.mercId],a=m.abil;
  e.mana=Math.min(m.manaMax,(e.mana||0)+m.manaRegen*dt);e.bloodCD=Math.max(0,(e.bloodCD||0)-dt);
  if(e.bloodBuff){e.bloodBuff.time-=dt;if(e.bloodBuff.time<=0)e.bloodBuff=null;}
  if(a.bloodRush&&e.stunT<=0&&e.bloodCD<=0&&e.mana>=a.bloodRush.mana){
   const b=a.bloodRush,target=friends.find(g=>!g.bloodBuff&&Math.hypot(g.x-e.x,g.y-e.y)<=b.r);
   if(target){target.bloodBuff={time:b.duration,haste:b.haste,move:b.move};e.mana-=b.mana;e.bloodCD=b.cd;}
  }
  let heal=0,armor=0,damage=0,move=0,vamp=0;
  for(const source of friends){
   const s=MERCS[source.mercId]?.abil;if(!s)continue;const d=Math.hypot(source.x-e.x,source.y-e.y);
   if(s.healAura&&d<=s.healAura.r)heal=Math.max(heal,s.healAura.hps);
   if(s.armorAura&&d<=s.armorAura.r)armor=Math.max(armor,s.armorAura.armor);
   if(s.aura&&d<=s.aura.r)damage=Math.max(damage,s.aura.p);
   if(s.moveAura&&d<=s.moveAura.r)move=Math.max(move,s.moveAura.p);
   if(s.vampAura&&m.rawRange<=180&&d<=s.vampAura.r)vamp=Math.max(vamp,s.vampAura.p);
  }
  e.hp=Math.min(e.max,e.hp+heal*dt);e.mercArmor=armor;e.mercDamage=damage;e.mercVamp=vamp;
  e.mercHaste=e.bloodBuff?.haste||0;e.mercMove=1+move+(e.bloodBuff?.move||0);
  if(e.stunT>0)continue;
  if(a.frostAura)for(const f of foes)if(Math.hypot(f.x-e.x,f.y-e.y)<=a.frostAura.r){
   add341Status(f,'mercFrost',{time:.15,move:a.frostAura.move,attack:a.frostAura.attack});
   if(!f.def.abil.magicImmune){f.slowF=Math.min(f.slowF,1-a.frostAura.move);f.attackSlow=Math.max(f.attackSlow,a.frostAura.attack);}
  }
  if(a.burn)for(const f of foes)if(!f.def.air&&Math.hypot(f.x-e.x,f.y-e.y)<=a.burn.r)hitFighter(p,f,a.burn.dps*dt,'法术',e);
 }
 // Support auras also affect regular wave creeps, as in the source map.
 for(const e of p.enemies.filter(e=>e.hp>0&&!e.mercId&&owned(e))){
  let heal=0,armor=0,damage=0,move=0,vamp=0;
  for(const source of friends){const a=MERCS[source.mercId]?.abil;if(!a)continue;const d=Math.hypot(source.x-e.x,source.y-e.y);
   if(a.healAura&&d<=a.healAura.r)heal=Math.max(heal,a.healAura.hps);
   if(a.armorAura&&d<=a.armorAura.r)armor=Math.max(armor,a.armorAura.armor);
   if(a.aura&&d<=a.aura.r)damage=Math.max(damage,a.aura.p);
   if(a.moveAura&&d<=a.moveAura.r)move=Math.max(move,a.moveAura.p);
   if(a.vampAura&&e.range<=45&&d<=a.vampAura.r)vamp=Math.max(vamp,a.vampAura.p);
  }
  if(e.bloodBuff){e.bloodBuff.time-=dt;if(e.bloodBuff.time<=0)e.bloodBuff=null;}
  e.hp=Math.min(e.max,e.hp+heal*dt);e.mercArmor=armor;e.mercDamage=damage;e.mercMove=1+move+(e.bloodBuff?.move||0);e.mercHaste=e.bloodBuff?.haste||0;e.mercVamp=vamp;
 }
}
function mercAttack341(p,e,target){
 const a=MERCS[e.mercId]?.abil||{};
 const bash=a.bash&&Math.random()<a.bash.chance;
 const dealt=hitFighter(p,target,(e.dmg*(1+(e.mercDamage||0))+(bash?a.bash.damage:0))*(1-(e.damageWeak||0)),e.atk,e)||0;
 if(dealt<=0)return;
 if(e.mercVamp)e.hp=Math.min(e.max,e.hp+dealt*e.mercVamp);
 if(target.hp<=0||target.def.abil.magicImmune)return;
 if(bash)add341Status(target,'mercBash',{time:a.bash.duration,stun:true});
 if(a.corrupt)add341Status(target,'mercCorruption',{time:a.corrupt.duration,armor:a.corrupt.armor});
 if(a.cold)add341Status(target,'mercCold',{time:a.cold.duration,move:a.cold.move});
 if(a.poison)add341Status(target,'mercPoison',{time:a.poison.duration,dps:a.poison.dps,move:a.poison.move,attack:a.poison.attack});
}
// Stateful combat adapters for the supplied 3.41 unit/ability records.
function armorFactor(points=0) { return points>=0 ? 1/(1+.06*points) : 2-Math.pow(.94,-points); }
function init341Fighter(f) {
  resetCombatAgent(f);
  f.mana = Math.min(f.def.manaMax||0,f.def.manaStart||0);
  f.spellCD={};f.buffs={};f.attacks=0;f.deathHandled=false;
  f.effArmor=f.def.armorPoints||0;f.effHaste=0;f.effVamp=0;
  f.guardianFactor=1;
}
function spell341Targets(p,f,r) {
  return p.enemies.filter(e=>e.hp>0&&Math.hypot(e.x-f.x,e.y-f.y)<=r+e.r)
    .sort((a,b)=>Math.hypot(a.x-f.x,a.y-f.y)-Math.hypot(b.x-f.x,b.y-f.y));
}
function add341Status(e,key,data) {
  if(e.magicImmune||e.def?.abil.magicImmune)return;
  e.statuses ||= {};
  e.statuses[key]={...data};
}
function step341Enemy(e,dt) {
  e.statuses ||= {};e.slowF=1;e.attackSlow=0;e.damageWeak=0;e.armorLoss=0;e.miss=0;e.stunT=0;
  for(const [id,b] of Object.entries(e.statuses)) {
    const active=Math.min(dt,b.time);b.time-=dt;
    if(b.dps&&e.hp>0)dmgEnemy(e,b.dps*active,'法术');
    e.slowF=Math.min(e.slowF,1-(b.move||0));
    e.attackSlow=Math.max(e.attackSlow,b.attack||0);
    e.damageWeak=Math.max(e.damageWeak,b.damage||0);
    e.armorLoss=Math.max(e.armorLoss,b.armor||0);
    e.miss=Math.max(e.miss,b.miss||0);
    if(b.stun)e.stunT=Math.max(e.stunT,Math.max(.00001,b.time));
    if(b.time<=0)delete e.statuses[id];
  }
}
function tick341(p,dt) {
  for(const e of p.enemies)if(p.arenaView||!e.toKing||e.ownerId===p.id)step341Enemy(e,dt);
  if(!p.arenaView)for(const f of p.fighters)step341Enemy(f,dt);
  if(!p.arenaView)tickMerc341(p,dt);
  const alive=p.fighters.filter(f=>f.hp>0&&f.deadT<=0);
  for(const f of alive) {
    if(!f.buffs)init341Fighter(f);
    for(const [id,b] of Object.entries(f.buffs)){b.time-=dt;if(b.time<=0)delete f.buffs[id];}
    for(const id in f.spellCD)f.spellCD[id]-=dt;
    if(f.temporary){f.life-=dt;if(f.life<=0){f.hp=0;continue;}}
    let healing=f.def.regenFlat||0,manaRegen=f.def.manaRegen||0,haste=0,vamp=0,armor=0,amp=0;
    for(const source of alive) {
      const a=source.def.abil,d=Math.hypot(source.x-f.x,source.y-f.y);
      if(a.healAura&&d<=a.healAura.r)amp=Math.max(amp,a.healAura.hps);
      if(a.manaAura&&d<=a.manaAura.r)manaRegen+=f.def.manaMax*a.manaAura.p;
      if(a.hasteAura&&d<=a.hasteAura.r)haste=Math.max(haste,a.hasteAura.p);
      if(a.vampAura&&f.def.melee&&d<=a.vampAura.r)vamp=Math.max(vamp,a.vampAura.p);
      if(a.armorAura&&d<=a.armorAura.r)armor=Math.max(armor,a.armorAura.armor);
    }
    for(const b of Object.values(f.buffs)){haste+=b.haste||0;armor+=b.armor||0;healing-=b.drain||0;}
    if(f.def.abil.berserk){const ratio=f.hp/f.max;haste+=ratio<.2?.8:ratio<.4?.6:ratio<.6?.4:0;}
    f.hp=Math.max(1,Math.min(f.max,f.hp+(healing+amp)*dt));
    f.mana=Math.min(f.def.manaMax||0,f.mana+manaRegen*dt);
    const royal=kingAura341(p.team,f);
    f.effArmor=(f.def.armorPoints||0)+Math.max(armor,royal.armor);f.effHaste=Math.max(haste,royal.haste);f.effVamp=vamp;
    f.damageTaken=(f.illusionTaken||1)*(f.guardianFactor||1);
    if(f.stunT>0||f.deadT>0||(p.arenaView&&!f.arenaReady))continue;
    for(const c of f.def.abil.casts||[])cast341(p,f,c);
    if(f.def.abil.slowAura)for(const e of spell341Targets(p,f,f.def.abil.slowAura.r))add341Status(e,'slowAura',{move:f.def.abil.slowAura.p,time:.15});
    if(f.def.abil.weakenAura)for(const e of spell341Targets(p,f,f.def.abil.weakenAura.r))add341Status(e,'weakenAura',{damage:f.def.abil.weakenAura.p,time:.15});
    if(f.def.abil.heartstopper)for(const e of spell341Targets(p,f,f.def.abil.heartstopper.r))dmgEnemy(e,e.max*f.def.abil.heartstopper.p*dt,'法术',f);
    if(f.def.abil.explode&&spell341Targets(p,f,f.def.abil.explode.range).length){for(const e of spell341Targets(p,f,f.def.abil.explode.range))dmgEnemy(e,f.def.abil.explode.damage,'法术',f);f.hp=0;}
  }
  recalcAuras(p);
}
function cast341(p,f,c) {
  if((f.spellCD[c.id]||0)>0||f.mana<c.mana)return;
  if(c.hpThreshold&&f.hp/f.max>c.hpThreshold)return;
  const r=Math.max(c.range||0,effRange(f.def)),targets=spell341Targets(p,f,r);
  const friends=p.fighters.filter(g=>g.hp>0&&g.deadT<=0&&Math.hypot(g.x-f.x,g.y-f.y)<=r)
    .sort((a,b)=>a.hp/a.max-b.hp/b.max);
  const target=targets[0];let success=false;
  if(c.kind==='heal'||c.kind==='healGroup'||c.kind==='healChain') {
    const list=friends.filter(g=>g.hp<g.max).slice(0,c.kind==='heal'?1:c.n);
    for(const [i,g] of list.entries()){const amount=Math.min(g.max-g.hp,c.amount*Math.pow(1-(c.falloff||0),i));g.hp+=amount;healingThreat(p,f,g,amount);addFloater(g.x,g.y-20,`+${Math.round(amount)}`,'#8cdbab');}
    success=list.length>0;
  } else if(c.kind==='armorBuff') {
    const g=friends.find(g=>!g.buffs?.[c.id]);if(g){g.buffs ||= {};g.buffs[c.id]={armor:c.armor,time:c.duration};success=true;}
  } else if(c.kind==='groupBuff'&&target) {
    for(const g of friends){g.buffs ||= {};g.buffs[c.id]={...c,time:c.duration};}success=friends.length>0;
  } else if(c.kind==='selfBuff'&&target) {
    if(!f.buffs[c.id]){f.buffs[c.id]={...c,time:c.duration};success=true;}
  } else if(c.kind==='allyBuff') {
    const g=friends.find(g=>g!==f&&!g.buffs?.[c.id]);if(g){g.buffs ||= {};g.buffs[c.id]={...c,time:c.duration};success=true;}
  } else if(c.kind==='illusion'&&target&&!f.temporary) {
    const copy=spawn341Ally(p,f,f.def,c.duration);if(copy){copy.illusionFactor=c.factor;copy.illusionTaken=c.taken;copy.mana=0;success=true;}
  } else if(c.kind==='summon'&&target) {
    const def=Object.values(UNITS).find(d=>d.rawId===c.rawId);
    if(def){for(let i=0;i<c.count;i++)spawn341Ally(p,f,def,c.duration);success=true;}
  } else if(target) {
    if(c.kind==='miss') {
      for(const e of targets)add341Status(e,c.id,{time:c.duration,miss:c.miss});success=true;
    } else if(c.kind==='breath') {
      for(const e of targets){dmgEnemy(e,c.damage,'法术',f);add341Status(e,c.id,{time:c.duration,dps:c.dps});}success=true;
    } else if(['debuff','haunt','root'].includes(c.kind)) {
      add341Status(target,c.id,{time:target.boss?(c.boss||c.duration):c.duration,dps:c.dps||0,
        move:c.kind==='root'?1:c.move||0,attack:c.attack||0,damage:c.damage||0});success=true;
    } else if(c.kind==='aoe'||c.kind==='nova') {
      for(const e of targets.slice(0,c.n||99)) {
        dmgEnemy(e,c.kind==='nova'?(e===target?c.damage:0)+c.aoe:c.damage,'法术',f);
        if(c.stun||c.move||c.attack)add341Status(e,c.id,{time:c.duration||c.stun,stun:!!c.stun,move:c.move||0,attack:c.attack||0});
      }
      success=true;
    } else if(c.kind==='bolt') {
      dmgEnemy(target,c.damage,'法术',f);add341Status(target,c.id,{time:target.boss?c.boss:c.stun,stun:true});success=true;
    } else if(c.kind==='chain') {
      targets.slice(0,c.n).forEach((e,i)=>dmgEnemy(e,c.damage*Math.pow(1-c.falloff,i),'法术',f));success=true;
    }
  }
  if(success){f.mana-=c.mana;f.spellCD[c.id]=Math.max(.1,c.cd||f.def.aspd);}
}
function spawn341Ally(p,parent,def,life=60) {
  if(p.fighters.filter(f=>f.temporary&&f.hp>0).length>=128)return;
  const f={def,uid:def.id,col:parent.col,row:parent.row,x:parent.x+(Math.random()-.5)*24,y:parent.y+(Math.random()-.5)*24,
    hp:def.hp,max:def.hp,cd:.3,spent:0,effDmg:def.dmg,flash:0,deadT:0,reincUsed:false,temporary:true,life};
  f.ownerId=parent.ownerId??p.id;f.homeX=f.x;f.homeY=f.y;f.r=10;init341Fighter(f);
  if(p.arenaView){const owner=G.players[parent.ownerId];prepareArenaFighter(owner,f);f.arenaReady=true;owner.fighters.push(f);}
  p.fighters.push(f);return f;
}
function death341(p,f) {
  if(f.deathHandled)return;f.deathHandled=true;
  const a=f.def.abil;
  if(a.deathRawSummon){const def=Object.values(UNITS).find(d=>d.rawId===a.deathRawSummon);if(def)spawn341Ally(p,f,def,240);}
  if(a.deathSummon){const def=UNITS[a.deathSummon.id];if(def)for(let i=0;i<a.deathSummon.count;i++)spawn341Ally(p,f,def,240);}
  if(a.deathHeal)for(const g of p.fighters.filter(g=>g!==f&&g.hp>0&&Math.hypot(g.x-f.x,g.y-f.y)<=a.deathHeal.r).slice(0,a.deathHeal.n))g.hp=Math.min(g.max,g.hp+a.deathHeal.amount);
  if(a.deathBlast)for(const e of spell341Targets(p,f,a.deathBlast.r).slice(0,a.deathBlast.n))dmgEnemy(e,a.deathBlast.amount,'法术');
}
function hit341(p,f,e,dealt) {
  const a=f.def.abil;
  if(a.poison&&(!a.poison.airOnly||e.air)&&(!a.poison.hpThreshold||f.hp/f.max<=a.poison.hpThreshold))add341Status(e,'poison:'+f.uid+(a.poison.stack?':'+f.attacks:''),{time:a.poison.duration,...a.poison});
  if(a.corrupt)add341Status(e,'corrupt',{time:a.corrupt.duration,armor:a.corrupt.armor});
  if(a.mark)e.mark=a.mark;
  if(a.bash&&Math.random()<a.bash.chance){dmgEnemy(e,a.bash.damage,'法术');add341Status(e,'bash',{time:e.boss?a.bash.boss:a.bash.duration,stun:true});}
  if(a.pulverize&&Math.random()<a.pulverize.chance)for(const target of spell341Targets(p,f,a.pulverize.r).filter(t=>!t.air))dmgEnemy(target,a.pulverize.damage,'法术');
  if(a.fireHit)dmgEnemy(e,a.fireHit,'法术');
  if(a.aftershock&&Math.random()<a.aftershock.chance)for(const target of spell341Targets(p,f,a.aftershock.r).slice(0,a.aftershock.n))dmgEnemy(target,a.aftershock.damage,'法术');
  if(a.spree&&(e.hp<=0||Math.random()<a.spree.chance))f.buffs.spree={damage:a.spree.damage,time:a.spree.duration};
  const vamp=Math.max(a.lifesteal||0,f.effVamp||0);if(vamp)f.hp=Math.min(f.max,f.hp+dealt*vamp);
  if(a.feast&&f.attacks%a.feast.every===0)f.hp=Math.min(f.max,f.hp+a.feast.heal);
}
function inject341Steroids(p,f) {
  if(G.phase!=='prep'||!p.fighters.includes(f)||f.temporary||!f.def.abil.steroids||f.steroids||p.gold<50)return false;
  p.gold-=50;f.steroids=true;addFloater(f.x,f.y,'下一波强化已准备','#b7da8e');return true;
}
function start341Round(p) {
  for(const source of p.fighters){const a=source.def.abil.guardian;if(!a)continue;
    const targets=p.fighters.filter(f=>f!==source&&!f.temporary&&Math.hypot(f.x-source.x,f.y-source.y)<=a.r)
      .sort((x,y)=>Math.hypot(x.x-source.x,x.y-source.y)-Math.hypot(y.x-source.x,y.y-source.y)).slice(0,a.n);
    for(const f of targets)f.guardianFactor=Math.min(f.guardianFactor||1,a.factor);
  }
}
