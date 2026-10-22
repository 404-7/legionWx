// The four live barracks sell 24 classes. Read-only/retired entries are not extra units.
module.exports=function merc341(byId,clean){
 const ids=byId.h05C.fields.useu.split(',').concat(byId.h0B0.fields.useu.split(','));
 const keys='militia bowman ghoul warrior whelp hermit dino commander furbolg wyvern chariot blood_orc frost_wolf ice_troll warlock pandaren ballista shaman pudge gargoyle behemoth kraken infernal demon'.split(' ');
 const names='民兵 弓箭手 食尸鬼 兽人战士 幼龙 隐士 恐龙 指挥官 熊怪 双足飞龙 绞肉战车 血色兽人 霜狼 冰霜巨魔 术士 熊猫人 弩车 萨满 帕吉 石像鬼 巨兽 克拉肯 地狱火 恶魔'.split(' ');
 const introductions=['最便宜的基础前排，适合低成本增加收入和补充进攻数量。','基础远程射手，在前排保护下持续输出。','移动迅速的近战突击兵，能快速接近敌方防线。','携带眩晕重击的兽人前排，可打断敌军输出。','年轻的飞行龙类，使用穿刺攻击。','以治疗光环支援附近进攻部队的魔法远程兵。','移动缓慢、拥有穿刺远程攻击的恐龙。','为附近盟军提供战鼓伤害增益的支援骑手。','利用坚韧光环保护整支进攻军团的近战野兽。','投掷长矛的飞行部队，提供稳定穿刺火力。','拥有超远射程的攻城战车，突破防线后特别威胁国王。','移动异常迅速、近战攻击强劲的血色兽人。','具有减速光环的凶猛近战狼，能拖慢敌方反应。','来自诺森德的远程巨魔，以寒冷攻击牵制目标。','能削弱敌人护甲的魔法远程兵，适合搭配物理进攻。','具有持续生命恢复的熊猫人，可在持久战中保持压力。','远程攻城兵，在其他单位掩护下可威胁敌军和国王。','以嗜血冲锋强化友军攻速和移速的兽人施法者。','为近战盟军提供吸血效果的重型血肉怪物。','高阶飞行进攻单位，依靠普通攻击持续输出。','坚固的攻城前排，同时为附近友军提供护甲光环。','兼具剧毒、治疗光环和魔法免疫的多用途精锐。','来自燃烧军团的重型前排，利用重击和献祭持续压制。','拥有强力远程混乱攻击，能用迅捷与命令光环统率盟军。'];
 const skills={
  warrior:[['重击','攻击有 25% 概率眩晕目标 1 秒。','A04G',{bash:{chance:.25,damage:0,duration:1}}]],
  hermit:[['治疗光环','范围内友军每秒恢复 3 点生命；同类光环取最高值。','A035',{healAura:{hps:3,r:75}}]],
  dino:[['闪电攻击','使用闪电攻击视觉效果，不额外增加伤害。','A0BM',{}]],
  commander:[['战鼓','范围内友军攻击伤害提高 4%。','A07F',{aura:{p:.04,r:75}}]],
  furbolg:[['坚韧光环','范围内友军获得 3 点额外护甲。','A07E',{armorAura:{armor:3,r:75}}]],
  chariot:[['弑君','对国王造成双倍伤害；对战士不触发。','A037',{kingMult:2}]],
  frost_wolf:[['冰霜光环','范围内敌军移动速度和攻击速度降低 10%。','A039',{frostAura:{move:.1,attack:.1,r:75}}]],
  ice_troll:[['寒冷攻击','命中降低移动速度 25%，持续 2 秒。原技能未覆盖减速比例，25% 为网页版适配值。','A01M',{cold:{move:.25,duration:2}}]],
  warlock:[['腐蚀','命中使目标护甲降低 4 点，持续 4 秒。','A03A',{corrupt:{armor:4,duration:4}}]],
  pandaren:[['热血','每秒额外恢复 7 点生命。','A03O',{}]],
  ballista:[['弑君','对国王造成双倍伤害；对战士不触发。','A037',{kingMult:2}]],
  shaman:[['嗜血冲锋','消耗 20 法力，为附近一名友军提高 20% 攻速和移速，持续 30 秒；冷却 10 秒。','A03B',{bloodRush:{haste:.2,move:.2,duration:30,mana:20,cd:10,r:150}}]],
  pudge:[['鲜肉光环','范围内近战友军的攻击回复相当于实际伤害 8% 的生命。','A03C',{vampAura:{p:.08,r:75}}]],
  behemoth:[['坚韧光环','范围内友军获得 3 点额外护甲。','A07E',{armorAura:{armor:3,r:75}}],['魔法免疫','免疫魔法攻击、法术伤害及敌方施加的法术减益。','A038',{magicImmune:true}]],
  kraken:[['深海剧毒','命中附加每秒 20 点毒伤，移速和攻速降低 20%，持续 6 秒。','A03E',{poison:{dps:20,move:.2,attack:.2,duration:6}}],['治疗光环','范围内友军每秒恢复 10 点生命。','A03K',{healAura:{hps:10,r:100}}],['魔法免疫','免疫魔法攻击、法术伤害及敌方施加的法术减益。','A038',{magicImmune:true}]],
  infernal:[['重击','攻击有 25% 概率额外造成 120 点伤害，并眩晕 1 秒。','A03D',{bash:{chance:.25,damage:120,duration:1}}],['献祭','范围内地面敌军每秒受到 10 点法术伤害。','A00T',{burn:{dps:10,r:100}}],['魔法免疫','免疫魔法攻击、法术伤害及敌方施加的法术减益。','A038',{magicImmune:true}]],
  demon:[['迅捷光环','范围内友军移动速度提高 15%。','A043',{moveAura:{p:.15,r:75}}],['命令光环','范围内友军攻击伤害提高 10%。','A0BL',{aura:{p:.1,r:75}}],['魔法免疫','免疫魔法攻击、法术伤害及敌方施加的法术减益。','A038',{magicImmune:true}]],
 };
 const armor={small:'轻甲',medium:'中甲',large:'重甲',normal:'城甲',none:'无甲'};
 const armorText={Light:'轻甲',Medium:'中甲',Heavy:'重甲',Fortified:'城甲',Unarmored:'无甲'};
 const attack={normal:'普通',pierce:'穿刺',magic:'魔法',siege:'攻城',chaos:'混乱'};
 return ids.map((rawId,i)=>{
  const f=byId[rawId].fields,english=clean(f.unam),tooltip=clean(f.utub),id=keys[i];
  const dice=f.ua1d??1,sides=f.ua1s??2,min=(f.ua1b??0)+dice,max=(f.ua1b??0)+dice*sides;
  const rawRange=f.ua1r??(byId[rawId].base==='hrif'?400:100),list=skills[id]||[];
  return {id,name:names[i],english,description:introductions[i],rawId,sourceShop:i<12?'h05C':i<20?'h0AZ':'h0B0',
   unlockWave:i<12?1:i<20?10:15,cost:f.ulum,income:f.upoi,hp:f.uhpm,min,max,dmg:(min+max)/2,
   aspd:Math.round(f.ua1c*1000)/1000,rawRange,range:rawRange*.25,rawSpeed:f.umvs??270,speed:(f.umvs??270)*.25,
   armor:armor[f.udty]||armorText[tooltip.match(/(Light|Medium|Heavy|Fortified|Unarmored)(?: armor|\.)/)?.[1]]||'重甲',armorPoints:f.udef??0,
   atk:attack[f.ua1t]||attack[tooltip.match(/(Normal|Pierce|Magic|Siege|Chaos) damage/)?.[1]?.toLowerCase()]||'普通',
   air:f.utar==='air',r:i>=20?16:i>=12?12:10,regenFlat:f.uhpr??0,manaMax:f.umpm??0,manaStart:f.umpi??0,manaRegen:f.umpr??0,
   skills:list.map(([name,description,source])=>({name,description,source})),abil:Object.assign({},...list.map(s=>s[3])),
   tooltip,model:f.umdl,sourceFields:f};
 });
};
