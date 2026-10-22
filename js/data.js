'use strict';
/* ===== 数据定义：兵种 / 雇佣兵 / 波次 ===== */

/* abil 可选字段：
   splash{p,r} 溅射  slow{p,d} 减速  burn{dps,r} 灼烧光环
   aura{p,r} 攻击光环  crit{c,m} 暴击  reinc 复活  chain{n,f} 连锁  regen{p} 自愈 */
// Full 3.41 roster: spreadsheet stats, real map upgrade object IDs and ability parameters.
const UNITS = {};
// Keep the supplied spreadsheet's damage bounds. Object dice preserve the native
// distribution when compatible; disagreements remain explicit instead of hidden.
function attackDice341(min,max,fields={}) {
  const inferred=min-(fields.ua1b??min-1);
  const count=fields.ua1d??(inferred>0&&Number.isInteger(inferred)?inferred:1);
  const dice=count>0&&Number.isInteger((max-min)/count)?count:1;
  return {attackBase:min-dice,attackDice:dice,attackSides:(max-min)/dice+1};
}
function rollAttack341(weapon,random=Math.random) {
  const count=weapon.attackDice??0,sides=weapon.attackSides??1;
  let damage=weapon.attackBase??weapon.dmg??0;
  for(let i=0;i<count;i++)damage+=1+Math.min(sides-1,Math.floor(random()*sides));
  return damage;
}
function weapon341(fields,base,melee) {
  const inherited=SOURCE341.rules.inherited[base]||{};
  return {weapon:fields.ua1w??inherited.weapon??(melee?'normal':'missile'),
    attackPoint:fields.udp1??inherited.attackPoint??.3,
    projectileSpeed:(fields.ua1z??inherited.projectileSpeed??1360)*SOURCE341.rangeScale};
}
for (const row of [...SOURCE341.units,...SOURCE341.summons]) {
  const abil = compile341Skills(row);
  const rawRange = row.rawRange;
  UNITS[row.id] = { id:row.id,name:row.name,english:row.english,race:row.race,tier:row.tier,model:row.model,
    cost:row.cost??0, purchaseCost:row.baseCost, hp:row.hp,
    dmg:(row.min+row.max)/2, min:row.min,max:row.max,aspd:row.interval,range:rawRange*SOURCE341.rangeScale,
    rawRange,melee:rawRange<=180,atk:row.atk,armor:row.armor,food:row.food,
    armorPoints:row.map.armorPoints,regenFlat:row.map.regen,speed:(row.map.moveSpeed??270)*SOURCE341.rangeScale,
    acquireRange:(row.map.fields.uacq??(rawRange<=180?500:650))*SOURCE341.rangeScale,
    ...attackDice341(row.min,row.max,row.map.fields),...weapon341(row.map.fields,row.map.base,rawRange<=180),
    air:row.map.fields.utar==='air'||(row.map.fields.umvt??(['hdhw','nadk'].includes(row.map.base)?'fly':'foot'))==='fly',
    targets:row.map.fields.ua1g||'enemies',
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
  const ranged=w.rawRange>180;
  const attacks={normal:'普通',pierce:'穿刺',magic:'魔法',siege:'攻城',chaos:'混乱'};
  const armorTypes={none:'无甲',small:'轻甲',medium:'中甲',large:'重甲',normal:'城甲',fort:'城甲',hero:'英雄甲'};
  const inherited=SOURCE341.rules.inherited[w.base];
  const dice=m.ua1d??inherited.attackDice??1,sides=m.ua1s??inherited.attackSides??2,base=m.ua1b??0;
  return {w:w.level,name:m.unam,count:w.qty,spawnInterval:w.spawnInterval,mercDelay:w.mercDelay,bounty:w.bounty,bonus:w.bonus,value:w.value,
    hp:m.uhpm*(String(m.upgr||'').split(',').includes(SOURCE341.rules.creepHp.tech)?1+SOURCE341.rules.creepHp.percent:1),dmg:base+dice*(1+sides)/2,aspd:m.ua1c||1.25,
    attackBase:base,attackDice:dice,attackSides:sides,rawId:w.mapId,targets:m.ua1g||'enemies',
    speed:(m.umvs||270)*SOURCE341.rangeScale,range:w.rawRange*SOURCE341.rangeScale,
    spellIds:String(m.uabi||'').split(',').filter(Boolean),manaMax:m.umpm||0,manaStart:m.umpi||0,manaRegen:m.umpr||0,
    ...weapon341(m,w.base,!ranged),bounce:m.ua1w==='mbounce'?{count:(m.utc1||1)-1,r:(m.ua1f||300)*.25,loss:m.udl1??.3}:null,
    armor:armorTypes[m.udty??SOURCE341.rules.inherited[w.base].armor],armorPoints:m.udef||0,atk:attacks[m.ua1t??SOURCE341.rules.inherited[w.base].attack]||'英雄',
    air:m.utar==='air'||m.umvt==='fly',r:boss?17:9,regen:0,regenFlat:m.uhpr||0,
    magicImmune:false,boss,trait:boss?'boss':ranged?'ranged':null};
});
for(const m of Object.values(MERCS))Object.assign(m,attackDice341(m.min,m.max,m.sourceFields),weapon341(m.sourceFields,m.base,m.rawRange<=180));
