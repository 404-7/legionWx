'use strict';
module.exports=function rules341({misc,jass,units,abilities,upgrades}){
 const raw=Object.fromEntries(misc.split(/[\r\n]+/).filter(s=>s.includes('=')).map(s=>{const i=s.indexOf('=');return [s.slice(0,i),s.slice(i+1)];}));
 const armorOrder=['轻甲','中甲','重甲','城甲','普通甲','英雄甲','神圣甲','无甲'];
 const matrix={};
 for(const [attack,key] of Object.entries({'普通':'Normal','穿刺':'Pierce','魔法':'Magic','攻城':'Siege','混乱':'Chaos','英雄':'Hero','法术':'Spells'})){
  const values=raw['DamageBonus'+key]?.split(',').map(Number);if(values?.length!==8||values.some(n=>!Number.isFinite(n)))throw Error('Missing source damage matrix '+key);
  matrix[attack]=Object.fromEntries(armorOrder.map((name,i)=>[name,values[i]]));
 }
 const farms=[];let id='h024';while(id){const f=units[id].fields;farms.push({id,supply:f.ufma,gold:f.ugol,wood:f.ulum,cost:f.ugol+f.ulum,sourceFields:f});id=f.uupt;if(farms.length>30)throw Error('Farm cycle');}
 const hpLevels=Number(jass.match(/SetPlayerTechResearchedSwap\('R004'\s*,\s*(\d+)/)?.[1]);
 const hpUpgrade=upgrades.find(o=>o.id==='R004').fields;
 return {misc:raw,damage:matrix,armorOrder,magicImmunesResistDamage:Number(raw.MagicImmunesResistDamage)!==0,
  frost:{move:Number(raw.FrostMoveSpeedDecrease),attack:Number(raw.FrostAttackSpeedDecrease)},
  maxSpeed:Number(raw.MaxUnitSpeed)*.25,
  population:{town:units.h023.fields.ufma,startFarm:0,ceiling:200,farms},
  creepHp:{tech:'R004',levels:hpLevels,percent:Math.round(hpLevels*hpUpgrade['gba1:0:0']*1e6)/1e6},
  bonus:{wave:31,prepare:60,initialTimer:60,factor:5/6,offset:10,mercDelay:1,completionBonusMultiplier:2},
  bosses:{H05K:{spell:'A05H',poll:1,acquire:125,fields:abilities.A05H.fields}},
  inherited:{hfoo:{range:100,weapon:'normal',attack:'normal',armor:'large'},hrif:{range:400,weapon:'missile',attack:'pierce',armor:'medium'},Hpal:{range:100,weapon:'normal',attack:'hero',armor:'hero'},
   shockwave:{distance:900,speed:1050},unitArmorReduction:.06}};
};
