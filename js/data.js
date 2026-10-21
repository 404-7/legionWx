'use strict';
/* ===== 数据定义：兵种 / 雇佣兵 / 波次 ===== */

/* abil 可选字段：
   splash{p,r} 溅射  slow{p,d} 减速  burn{dps,r} 灼烧光环
   aura{p,r} 攻击光环  crit{c,m} 暴击  reinc 复活  chain{n,f} 连锁  regen{p} 自愈 */
// Inspired by Warcraft III Legion TD Mega 3.41 race/unit lines.
// Web-adapted costs, combat stats and abilities; upgrade cost is the total-cost difference.
const UNITS = {};
function unitLine(race, tier, model, role, base, upgraded) {
  const [id,name,cost,hp,dmg,aspd,range,atk,armor,abil={}] = base;
  const [upId,upName,upCost,upHp,upDmg,upAspd,upRange,upAtk,upArmor,upAbil={}] = upgraded;
  UNITS[id] = { race,tier,model,role,id,name,cost,hp,dmg,aspd,range,atk,armor,abil,up:upId };
  UNITS[upId] = { race,tier,model,role,id:upId,name:upName,cost:upCost,hp:upHp,dmg:upDmg,aspd:upAspd,range:upRange,atk:upAtk,armor:upArmor,abil:upAbil,elite:true };
}

// Mechanical: frontline, guns, leadership and siege.
unitLine('mech',1,'robot','前排',
  ['peewee','机械新兵',40,540,18,1,36,'普通','中甲'],
  ['veteran','机械老兵',145,1320,48,.9,40,'普通','重甲']);
unitLine('mech',2,'rifle','速射',
  ['infantry','机枪兵',60,165,20,.62,155,'穿刺','轻甲'],
  ['pyro','烈焰机甲',185,520,40,.7,145,'穿刺','重甲',{splash:{p:.45,r:48}}]);
unitLine('mech',3,'captain','辅助',
  ['captain','机械队长',110,740,29,1.1,38,'普通','中甲',{aura:{p:.12,r:145}}],
  ['admiral','机械统帅',270,1600,67,1,42,'普通','重甲',{aura:{p:.22,r:165}}]);
unitLine('mech',4,'tank','攻城',
  ['neotank','新式坦克',280,850,76,1.4,165,'攻城','重甲',{splash:{p:.5,r:56}}],
  ['doomsday','末日战车',560,1650,145,1.25,180,'攻城','重甲',{splash:{p:.65,r:68}}]);

// Nature: sustain and ranged support.
unitLine('nature',1,'tree','前排',
  ['ent','树人',45,620,20,1,36,'普通','重甲'],
  ['guardian','树人守护者',150,1400,52,.95,40,'普通','重甲',{slow:{p:.25,d:1.5}}]);
unitLine('nature',2,'archer','狙击',
  ['ranger','游侠',60,155,25,.95,190,'穿刺','无甲'],
  ['meliai','森林女猎手',175,360,55,.85,205,'穿刺','轻甲',{crit:{c:.2,m:1.8}}]);
unitLine('nature',3,'fairy','法术',
  ['sprite','精灵龙',85,230,27,.85,140,'魔法','轻甲',{regen:{p:.01}}],
  ['thunderbird','雷鸟',225,520,59,1.05,155,'魔法','中甲',{chain:{n:2,f:.65}}]);
unitLine('nature',4,'tree','治疗',
  ['yggdrasil','世界之树',260,1500,47,1.2,42,'魔法','重甲',{healAura:{hps:7,r:155},regen:{p:.005}}],
  ['tree_life','生命之树',510,2600,88,1.1,44,'魔法','重甲',{healAura:{hps:15,r:175},regen:{p:.008}}]);

// Beast: durable bruisers and area pressure.
unitLine('beast',1,'gnoll','斗士',
  ['gnoll','豺狼人战士',40,450,21,.9,36,'普通','轻甲',{slow:{p:.12,d:1}}],
  ['gnoll_savage','豺狼人蛮兵',140,1050,48,.8,40,'普通','中甲',{slow:{p:.2,d:1.5}}]);
unitLine('beast',2,'ogre','重击',
  ['ogre','食人魔',70,840,26,1.35,38,'攻城','重甲',{crit:{c:.15,m:1.8}}],
  ['pulverizer','食人魔粉碎者',200,1720,62,1.2,42,'攻城','重甲',{crit:{c:.2,m:2},splash:{p:.3,r:45}}]);
unitLine('beast',3,'harpy','控制',
  ['harpy','鹰身女妖',90,260,30,1,140,'魔法','轻甲',{slow:{p:.3,d:1.6}}],
  ['medusa','美杜莎',235,600,65,.95,150,'魔法','中甲',{slow:{p:.45,d:2}}]);
unitLine('beast',4,'dragon','范围',
  ['dragon_spawn','龙裔',285,1000,65,1.1,42,'普通','重甲',{splash:{p:.45,r:55}}],
  ['dragon_aspect','巨龙化身',550,1800,122,1.05,145,'普通','重甲',{splash:{p:.6,r:65}}]);

// Shadow: attack cadence, control and reincarnation.
unitLine('shadow',1,'skeleton','快攻',
  ['bone_warrior','骷髅战士',35,350,15,.6,36,'普通','中甲'],
  ['skeletor','骷髅勇士',130,900,36,.5,40,'普通','中甲',{crit:{c:.2,m:2}}]);
unitLine('shadow',2,'spitter','控制',
  ['carrion_spitter','腐肉喷吐者',65,210,22,.85,145,'穿刺','中甲',{slow:{p:.2,d:1.4}}],
  ['nightcrawler','地穴潜伏者',185,470,44,.7,155,'穿刺','中甲',{slow:{p:.4,d:1.8}}]);
unitLine('shadow',3,'gate','守卫',
  ['gateguard','守门人',100,820,28,1.1,38,'普通','重甲',{reinc:{}}],
  ['harbinger','灾厄先驱',260,1640,61,1,42,'普通','重甲',{reinc:{},aura:{p:.12,r:135}}]);
unitLine('shadow',4,'nightmare','刺杀',
  ['nightmare','梦魇',255,1000,39,.55,38,'普通','无甲',{crit:{c:.2,m:2}}],
  ['doppelganger','幻影魔',510,1800,68,.45,42,'普通','无甲',{crit:{c:.3,m:2}}]);

// Orc: healers behind a melee line.
unitLine('orc',1,'orc','前排',
  ['orc_warrior','兽人步兵',45,590,22,1,36,'普通','重甲'],
  ['blood_warrior','血斧勇士',150,1360,51,.9,40,'普通','重甲',{crit:{c:.15,m:1.8}}]);
unitLine('orc',2,'warlock','控制',
  ['orc_warlock','兽人术士',65,205,26,1.15,140,'魔法','轻甲',{slow:{p:.25,d:1.5}}],
  ['blood_warlock','血色术士',190,460,60,1.05,150,'魔法','轻甲',{slow:{p:.35,d:2},splash:{p:.25,r:40}}]);
unitLine('orc',3,'witch','治疗',
  ['witch_doctor','巫医',100,290,23,1.2,135,'魔法','轻甲',{healAura:{hps:5,r:145}}],
  ['elder_doctor','巫医长老',250,600,49,1.1,145,'魔法','中甲',{healAura:{hps:12,r:165}}]);
unitLine('orc',4,'warchief','震击',
  ['warchief','兽人酋长',285,1560,69,1.1,42,'普通','重甲',{splash:{p:.4,r:52}}],
  ['thrall','萨尔',560,2550,122,1,44,'普通','重甲',{splash:{p:.5,r:60},chain:{n:2,f:.5}}]);

// Undead: lifesteal, corpse artillery and plague.
unitLine('undead',1,'acolyte','法术',
  ['acolyte','侍僧',35,115,17,.9,135,'魔法','轻甲'],
  ['revenant','亡魂',125,320,43,.8,145,'魔法','中甲']);
unitLine('undead',2,'ghoul','吸血',
  ['ghoul','食尸鬼',60,570,23,.85,36,'普通','无甲',{lifesteal:.15}],
  ['frenzy_ghoul','狂暴食尸鬼',180,1200,50,.7,40,'普通','无甲',{lifesteal:.25}]);
unitLine('undead',3,'wagon','攻城',
  ['meat_wagon','绞肉车',85,280,35,1.35,165,'攻城','重甲',{splash:{p:.35,r:44}}],
  ['war_machine','瘟疫战车',235,650,82,1.25,175,'攻城','重甲',{splash:{p:.55,r:58}}]);
unitLine('undead',4,'necro','瘟疫',
  ['necromancer','死灵法师',160,600,35,1.15,95,'魔法','轻甲',{burn:{dps:12,r:105}}],
  ['necrolyte','死灵大法师',360,1200,78,1.05,110,'魔法','中甲',{burn:{dps:26,r:120},aura:{p:.12,r:145}}]);

/* 兵种有效攻击距离：近战含索敌余量（可够到远程波敌人） */
function effRange(def) { return def.range + (def.range <= 45 ? 18 : 0); }

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
  return parts.join(' · ');
}

/* ---- 雇佣兵：送给敌方施加压力，同时提高收入 ---- */
const MERCS = {
  imp:     { name: '小恶魔',   cost: 25,  income: 1, hp: 180,  dmg: 14,  aspd: 1.1,  range: 30,  speed: 58, armor: '无甲', atk: '普通', r: 9 },
  bandit:  { name: '强盗',     cost: 40,  income: 2, hp: 300,  dmg: 22,  aspd: 1.0,  range: 30,  speed: 55, armor: '轻甲', atk: '普通', r: 10 },
  stone:   { name: '石魔',     cost: 65,  income: 3, hp: 700,  dmg: 26,  aspd: 1.1,  range: 30,  speed: 48, armor: '重甲', atk: '普通', r: 11 },
  wyvern:  { name: '双足飞龙', cost: 95,  income: 4, hp: 520,  dmg: 40,  aspd: 1.0,  range: 100, speed: 62, armor: '轻甲', atk: '穿刺', r: 10 },
  abyss:   { name: '深渊兽',   cost: 140, income: 6, hp: 1500, dmg: 75,  aspd: 1.1,  range: 32,  speed: 50, armor: '中甲', atk: '普通', r: 13 },
  ancient: { name: '远古凶兽', cost: 210, income: 9, hp: 3200, dmg: 130, aspd: 1.2,  range: 34,  speed: 44, armor: '重甲', atk: '攻城', r: 16 },
};

/* ---- 波次表（1~30）---- */
const WAVE_TRAIT_SCHEDULE = {
  4: 'fast', 6: 'regen', 7: 'magic', 9: 'ranged', 10: 'boss',
  12: 'fast', 13: 'heavy', 15: 'swarm', 16: 'regen', 17: 'magic',
  18: 'fast', 20: 'boss', 21: 'heavy', 23: 'swarm', 24: 'regen',
  26: 'magic', 27: 'fast', 28: 'heavy', 29: 'ranged', 30: 'boss',
};

const WAVES = [];
(function buildWaves() {
  for (let w = 1; w <= CFG.TOTAL_WAVES; w++) {
    let count = Math.min(6 + Math.floor(w * 0.4), 13);
    let hp   = CFG.WAVE_HP0 * Math.pow(CFG.WAVE_HP_G, w - 1);
    let dmg  = CFG.WAVE_DMG0 * Math.pow(CFG.WAVE_DMG_G, w - 1);
    let speed = Math.min(46 + w * 1.4, 90);
    let aspd = 1.15, range = 30, r = 10, regen = 0, magicImmune = false, boss = false;
    let armor = ['无甲', '轻甲', '中甲', '重甲', '轻甲'][(w - 1) % 5];
    let atk   = ['普通', '穿刺', '魔法', '攻城', '穿刺'][(w - 1) % 5];
    const trait = WAVE_TRAIT_SCHEDULE[w] || null;

    if (trait === 'fast')   { speed *= 1.35; hp *= 0.75; }
    if (trait === 'regen')  { regen = 0.015; hp *= 1.08; }
    if (trait === 'magic')  { magicImmune = true; }
    if (trait === 'heavy')  { armor = '重甲'; hp *= 1.1; dmg *= 0.9; }
    if (trait === 'swarm')  { count = Math.round(count * 1.4); hp *= 0.65; dmg *= 0.85; speed *= 1.1; }
    if (trait === 'ranged') { range = 60; atk = '魔法'; dmg *= 0.85; armor = '无甲'; }
    if (trait === 'boss')   {
      count = (w === 20) ? 2 : 1;
      const hpMult  = (w === 10) ? 5.5 : (w === 20) ? 5 : 9;
      const dmgMult = (w === 30) ? 1.5 : 1.35;
      hp *= hpMult; dmg *= dmgMult; speed *= 0.72; aspd = 1.35; r = 20; boss = true;
    }
    WAVES.push({
      w, count, hp: Math.round(hp), dmg: Math.round(dmg), speed, aspd, range, r,
      armor, atk, trait, regen, magicImmune, boss,
    });
  }
})();
