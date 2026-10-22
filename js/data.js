'use strict';
/* ===== 数据定义：兵种 / 雇佣兵 / 波次 ===== */

/* abil 可选字段：
   splash{p,r} 溅射  slow{p,d} 减速  burn{dps,r} 灼烧光环
   aura{p,r} 攻击光环  crit{c,m} 暴击  reinc 复活  chain{n,f} 连锁  regen{p} 自愈 */
// Full 3.41 roster: spreadsheet stats, real map upgrade object IDs and ability parameters.
const UNITS = {};
for (const row of [...SOURCE341.units,...SOURCE341.summons]) {
  const abil = compile341Skills(row);
  const rawRange = row.rawRange;
  UNITS[row.id] = { id:row.id,name:row.name,english:row.english,race:row.race,tier:row.tier,model:row.model,
    cost:row.cost??0, purchaseCost:row.baseCost, hp:row.hp,
    dmg:(row.min+row.max)/2, min:row.min,max:row.max,aspd:row.interval,range:rawRange*SOURCE341.rangeScale,
    rawRange,melee:rawRange<=180,atk:row.atk,armor:row.armor,food:row.food,
    armorPoints:row.map.armorPoints,regenFlat:row.map.regen,speed:(row.map.moveSpeed??270)*SOURCE341.rangeScale,
    acquireRange:(row.map.fields.uacq??(rawRange<=180?500:650))*SOURCE341.rangeScale,
    attackPoint:row.map.fields.udp1??.3,air:row.map.fields.umvt==='fly',
    manaMax:row.map.manaMax,manaStart:row.map.manaStart,manaRegen:row.map.manaRegen,
    upgrades:row.upgrades,up:row.upgrades[0],stances:row.stances||[],elite:row.elite,summonOnly:row.summonOnly,
    role:row.rawRange<=180?'前排':row.min===0?'法术':'远程',
    abil,abilityNames:row.abilityNames,sourceRow:row.row,sourceDps:row.dps,
    rawId:row.fighterId,buildingId:row.buildingId };
}

/* 兵种有效攻击距离：近战含索敌余量（可够到远程波敌人） */
function effRange(def) { return def.range + (def.melee ? 18 : 0); }

/* 兵种能力文字描述（商店/详情用） */
function abilDesc(def) {
  const a = def.abil || {};
  const parts = [];
  if (a.splash) parts.push(`溅射${Math.round(a.splash.p * 100)}%`);
  if (a.slow)   parts.push(`减速${Math.round(a.slow.p * 100)}%/${a.slow.d}s`);
  if (a.healAura) parts.push('治疗光环 '+a.healAura.hps+'/秒');
  if (a.lifesteal) parts.push('吸血 '+Math.round(a.lifesteal*100)+'%');
  if (a.burn)   parts.push(`${def.race === 'undead' ? '瘟疫' : '灼烧'}${a.burn.dps}/s`);
  if (a.aura)   parts.push(`光环+${Math.round(a.aura.p * 100)}%攻`);
  if (a.crit)   parts.push(`${Math.round(a.crit.c * 100)}%暴击×${a.crit.m}`);
  if (a.reinc)  parts.push('每波复活一次');
  if (a.chain)  parts.push(`连锁${a.chain.n}目标`);
  if (a.regen)  parts.push(`自愈${(a.regen.p * 100).toFixed(1)}%/s`);
  if (a.evasion) parts.push('闪避 '+Math.round(a.evasion*100)+'%');
  if (a.bash) parts.push('重击 '+Math.round(a.bash.chance*100)+'%');
  if (a.poison?.dps) parts.push('毒伤 '+a.poison.dps+'/秒');
  if (a.casts?.some(c=>c.kind==='summon')) parts.push('召唤');
  if (a.manaShield) parts.push('法力护盾');
  if (!parts.length && def.abilityNames && def.abilityNames!=='None') parts.push(def.abilityNames);
  return parts.join(' · ');
}

/* ---- 雇佣兵：送给敌方施加压力，同时提高收入 ---- */
const MERCS = Object.fromEntries(SOURCE341.mercs.map(m=>[m.id,m]));

/* ---- 波次表（原表全部31波）---- */

const WAVES = SOURCE341.waves.map((w,i)=>{
  const m=w.map, boss=[10,20,30].includes(w.level);
  const ranged=[4,8,12,16,20,24,28,29].includes(w.level);
  const attacks={normal:'普通',pierce:'穿刺',magic:'魔法',siege:'攻城',chaos:'混乱'};
  const armorByWave=['无甲','无甲','中甲','重甲','轻甲','城甲','轻甲','中甲','重甲','轻甲','城甲','中甲','轻甲','中甲','重甲','轻甲','城甲','中甲','轻甲','重甲','轻甲','城甲','重甲','中甲','轻甲','重甲','中甲','城甲','重甲','城甲','无甲'];
  const dice=m.ua1d||1,sides=m.ua1s||2,base=m.ua1b||0;
  return {w:w.level,name:m.unam,count:w.qty,spawnInterval:w.spawnInterval,mercDelay:w.mercDelay,bounty:w.bounty,bonus:w.bonus,value:w.value,
    hp:m.uhpm,dmg:base+dice*(1+sides)/2,aspd:m.ua1c||1.25,
    speed:(m.umvs||270)*SOURCE341.rangeScale,range:ranged?(m.ua1r||400)*SOURCE341.rangeScale:30,
    armor:armorByWave[i],armorPoints:m.udef||0,atk:attacks[m.ua1t]||'普通',
    air:[5,13,21,29].includes(w.level),r:boss?17:9,regen:0,regenFlat:m.uhpr||0,
    magicImmune:false,boss,trait:boss?'boss':ranged?'ranged':null};
});
