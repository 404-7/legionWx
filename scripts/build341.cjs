'use strict';
// Rebuild browser/server data from the supplied spreadsheet and extracted 3.41 map.
const fs=require('node:fs'),crypto=require('node:crypto');
const sheet=JSON.parse(fs.readFileSync('data/legion341-sheet.json','utf8'));
const cache='.cache/source341/';
const strings={};
for(const m of fs.readFileSync(cache+'war3map.wts','utf8').matchAll(/STRING\s+(\d+)[^{]*\{\r?\n([\s\S]*?)\r?\n\}/g))strings[+m[1]]=m[2];
const clean=value=>String(value||'').replace(/TRIGSTR_(\d+)/g,(_,n)=>strings[+n]||_).replace(/\|c[0-9a-f]{8}|\|r/gi,'').replace(/\|n/g,'\n').trim();
const load=name=>JSON.parse(fs.readFileSync(cache+name+'.json','utf8')).map(o=>({...o,fields:Object.fromEntries(Object.entries(o.fields).map(([k,v])=>[k,typeof v==='string'?clean(v):v]))}));
const mapUnits=load('war3map.w3u'), mapAbilities=load('war3map.w3a');
const byId=Object.fromEntries(mapUnits.map(u=>[u.id,u])), abilities=Object.fromEntries(mapAbilities.map(a=>[a.id,a]));
const jass=fs.readFileSync(cache+'war3map.j','utf8');
const towerMap={};let fighter;
for(const m of jass.matchAll(/set udg_Tower(Unit|Type)Arr\[udg_Temp_Integer\]='(.{4})'/g)){
  if(m[1]==='Unit')fighter=m[2];else towerMap[m[2]]=fighter;
}
const aliases={'Diablotic':'Diabolic','Machine Turrent':'Machine Turret'};
const raceKeys=['beast','mech','nature','shadow','element','ghost','demi','marine','elf','arctic','goblin','human','orc','undead'];
const translations=[
  '豺狼人战士;豺狼人蛮兵;食人魔;食人魔粉碎者;鹰身女妖;美杜莎;巨魔战士;巨魔勇士;灰熊;灰鬃巨熊;龙裔;巨龙化身',
  '机械新兵;机械老兵;机枪兵;烈焰机甲;宙斯;机械队长;机械统帅;暴风战机;利维坦;生化战士;克罗戈斯;新式坦克;末日战车',
  '树人;树人守护者;游侠;森林女猎手;精灵龙;雷鸟;旅行之树;时光之树;混血巨兽;歌利亚;世界之树;生命之树;知识之树',
  '骷髅战士;骷髅勇士;烈焰弓手;黑暗法师;腐肉喷吐者;地穴潜伏者;守门人;魔犬;灾厄先驱;狂热魔犬;监视者;灵魂守卫;梦魇;幻影魔;死亡领主;地狱火;冥王;迪亚波罗',
  '质子;精修者;水灵;海洋之灵;守望者;紫罗兰;泥人;石魔;门徒;弥赛亚;黑暗先知;菲尼克斯',
  '幽灵;怨灵;幻灵;流浪者;英雄之魂·进攻;英雄之魂·防御;恶徒之魂;幻影;地狱咆哮者;放逐者;遗弃者;怨魂;守墓人;黑暗祭司;子午使者',
  '地精科学家;矮人工程师;变异体;仆从;奴隶主;部落猎手;部落首领;医者;神谕者;妖女;魅惑女王;牛头怪;大脚野人',
  '幼体;沼泽奔行者;利齿兽;亵渎者;卵囊;天龙;底栖兽;巨钳之王;美人鱼;上层精灵;科莫多巨兽;三叉戟战士;海巨人;九头蛇;小九头蛇',
  '幼驹;骑手;新兵;十字军;哨兵;夜刃豹;囚徒;独行侠;德鲁伊;飞升者;剑术法师;月之守卫;守望者',
  '海象人;海象长矛手;霜狼;熊猫人;冰霜巨魔;冰霜萨满;北极熊;猛犸巨兽;雪怪;远古雪怪;幼年冰龙;碧蓝巨龙',
  '小型地雷;中型地雷;超大型地雷;地卜师;发条机甲;机枪炮塔;机械战士;飞行器;直升机;地精炼金师;地精爆破手;蒸汽压路机;突击坦克',
  '农民;民兵;弓箭手;精锐弓箭手;步兵;卫兵;牧师;高阶牧师;骑士;重装骑士;龙鹰;皇家狮鹫',
  '兽人步兵;血斧兽人;狼獾;兽人术士;血色术士;掠夺者;血色掠夺者;年轻巫医;巫医长老;双足飞龙;风骑士;兽人酋长;萨尔',
  '侍僧;亡魂;食尸鬼;狂暴食尸鬼;绞肉车;瘟疫战车;死灵法师;死灵大法师;死亡幽魂;僵尸;屠夫;死亡守卫;死亡之龙',
].map(s=>s.split(';'));
const attack={Normal:'普通',Pierce:'穿刺',Siege:'攻城',Magic:'魔法',Chaos:'混乱'};
const armor={Light:'轻甲',Medium:'中甲',Heavy:'重甲',Fortified:'城甲',Unarmored:'无甲',small:'轻甲',medium:'中甲',large:'重甲',fort:'城甲',none:'无甲'};
const slug=name=>name.toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/_$/,'');
const counts={}, warnings=[], records=[];
const getModel=(name,race,range)=>{
  if(/Mine|Sack/.test(name))return 'mine';
  if(/Tree|Ent$|Guardian$|Yggdrasil/.test(name)&&race==='nature')return 'tree';
  if(/Tank|Doomsday|Steamroller|Machine Turr/.test(name))return 'tank';
  if(/Wagon|War Machine/.test(name))return 'wagon';
  if(/Dragon|Hydra|Wyvern|Rider|Griffin|Hawk/.test(name)&&range>180)return 'dragon';
  if(/Harpy|Sprite|Thunderbird/.test(name))return 'fairy';
  if(/Gnoll/.test(name))return 'gnoll';
  if(/Ogre|Grizzly|Greymane|Butcher|Zombie|Goliath|Minotaur|Bigfoot/.test(name))return 'ogre';
  if(/Bone|Skelet/.test(name))return 'skeleton';
  if(/Ghoul|Hatchling|Swamp|Fang|Komodo/.test(name))return 'ghoul';
  if(/Gateguard|Harbinger|Infernal|Mudman|Golem|Cyborg|Krogoth/.test(name))return 'gate';
  if(/Spitter|Nightcrawler|Claw|Feeder/.test(name))return 'spitter';
  if(/Nightmare|Doppel|Wolf|Bear|Wandigoo/.test(name))return 'nightmare';
  if(/Archer|Ranger|Meliai|Sentry|Tribesman/.test(name))return 'archer';
  if(/Infantry|Zeus|Scientist|Engineer/.test(name))return 'rifle';
  if(/Peewee|Veteran|Clock|Robot/.test(name))return 'robot';
  if(/Witch|Medicine|Oracle|Priest/.test(name))return 'witch';
  if(/Acolyte|Revenant|Specter|Wraith|Phantom|Apparition|Ghost/.test(name))return 'acolyte';
  if(/Necro|Hades|Lord of Death|Seer|Fenix/.test(name))return 'necro';
  return range<=180?'orc':'warlock';
};
for(const row of sheet.units){
  const group=Math.floor(row.sort),race=raceKeys[group-1],index=counts[race]||0;counts[race]=index+1;
  const wanted=aliases[row.name]||row.name;
  let choices=mapUnits.filter(u=>clean(u.fields.unam).toLowerCase()===wanted.toLowerCase());
  if(row.name.startsWith('Soul of Hero'))choices=mapUnits.filter(u=>u.fields.unam==='Soul of Hero'&&u.fields.unsf?.includes(row.name.includes('(atk)')?'attack':'defense'));
  const building=choices.find(u=>/Building/i.test(u.fields.unsf||''));
  const combat=byId[towerMap[building?.id]]||choices.find(u=>/fighter/i.test(u.fields.unsf||''))||(!building?choices[0]:null);
  if(!combat||(!building&&row.cost!==''))throw Error(`Unmatched source row ${row.row}: ${row.name}`);
  const id=slug(row.name), fields=combat.fields,fromSheet=key=>typeof row[key]==='number'?row[key]:null;
  const isSummon=row.cost==='';
  const record={id,race,name:translations[group-1][index]||row.name,english:row.name,row:row.row,
    baseCost:fromSheet('cost'),cost:fromSheet('total'),food:fromSheet('food'),
    hp:fromSheet('hp')??fields.uhpm,rawRange:fromSheet('range')??fields.ua1r??100,
    min:row.min,max:row.max,interval:row.interval,dps:row.dps,
    atk:attack[row.attack],armor:armor[row.armor],abilityNames:row.ability,
    buildingId:building?.id||null,fighterId:combat.id,summonOnly:isSummon,
    map:{base:combat.base,armorPoints:fields.udef??3,regen:fields.uhpr??0,manaMax:fields.umpm??0,manaStart:fields.umpi??0,manaRegen:fields.umpr??0,
      moveSpeed:fields.umvs??270,buildingCost:building?.fields.ugol??null,weapon:fields.ua1w||'normal',
      splashFull:fields.ua1f??0,splashHalf:fields.ua1h??0,splashQuarter:fields.ua1q??0,
      fields},
    skillIds:[...new Set(String(fields.uabi||'').split(',').filter(Boolean))],
    buildingSkills:String(building?.fields.uabi||'').split(',').filter(id=>id&&id!=='A008'),
    upgradeBuildingIds:String(building?.fields.uupt||'').split(',').filter(Boolean),upgrades:[],
    model:getModel(row.name,race,fromSheet('range')??fields.ua1r??100)};
  if(record.baseCost!==null&&record.map.buildingCost!==null&&record.baseCost!==record.map.buildingCost)
    warnings.push({row:row.row,name:row.name,field:'Cost',sheet:record.baseCost,map:record.map.buildingCost,resolution:'spreadsheet wins; map value retained'});
  records.push(record);
}
const byBuilding=Object.fromEntries(records.filter(r=>r.buildingId).map(r=>[r.buildingId,r]));
// Upgrade graph comes from real map object IDs, not adjacent rows or Total-Cost subtraction.
for(const r of records)for(const next of r.upgradeBuildingIds){const target=byBuilding[next];if(target)r.upgrades.push(target.id);else warnings.push({row:r.row,field:'upgrade',missing:next});}
const heroAtk=records.find(r=>r.english==='Soul of Hero (atk)'),heroDef=records.find(r=>r.english==='Soul of Hero (def)');
heroAtk.stances=[heroDef.id];heroDef.stances=[heroAtk.id];
const parent=new Map();for(const r of records)for(const id of r.upgrades)parent.set(id,r);
parent.set(heroAtk.id,parent.get(heroDef.id));
for(const r of records){r.elite=parent.has(r.id);r.tier=r.buildingId?Number((byId[r.buildingId].fields.unsf||'').match(/T(\d)/)?.[1]||0):0;}
function tier(r,seen=new Set()) {if(r.tier)return r.tier;if(seen.has(r.id))return 1;seen.add(r.id);r.tier=parent.has(r.id)?tier(parent.get(r.id),seen):1;return r.tier;}
for(const r of records){tier(r);if(parent.has(r.id)&&parent.get(r.id).cost+r.baseCost!==r.cost)warnings.push({row:r.row,name:r.english,field:'Total',sheet:r.cost,parentPlusCost:parent.get(r.id).cost+r.baseCost,resolution:'charge Cost, retain listed Total'});}
const creepIds=[...jass.matchAll(/set udg_Level_UnitType\[udg_Temp_Integer\]='(.{4})'/g)].map(m=>m[1]);
const mapWaveCounts=jass.match(/set udg_LevelWaveCountList = "([^"]+)"/)[1].split(',').filter(Boolean).map(Number);
const spawnTimer=jass.match(/function CreateCreepWaveTimer[\s\S]*?endfunction/)[0];
const intervals=[...spawnTimer.matchAll(/TimerStart\(udg_PeriodSpawnTimer\s*,\s*([\d.]+)/g)].map(m=>Number(m[1]));
const mercDelay=Number(jass.match(/call ExecuteFunc\("CreateCreepWaveTimer"\)\s*call PolledWait\(([\d.]+)\)\s*call TriggerExecute\(gg_trg_Warp_Summons\)/)[1]);
if(mapWaveCounts.length!==31||intervals.length!==2||mapWaveCounts.some(n=>!Number.isInteger(n)||n<=0))throw Error('Unrecognized source wave spawning rules');
const waves=sheet.waves.map((w,i)=>{
  if(w.qty!==mapWaveCounts[i])warnings.push({wave:w.level,field:'Qty',sheet:w.qty,map:mapWaveCounts[i],resolution:'map spawn count wins; sheetQty retained'});
  return {...w,sheetQty:w.qty,qty:mapWaveCounts[i],spawnInterval:intervals[i===30?0:1],mercDelay,mapId:creepIds[i],map:byId[creepIds[i]]?.fields||{}};
});
const summonIds=new Set();
for(const id of ['h0AX','h0D5'])summonIds.add(id);
for(const a of mapAbilities)if(a.base==='AHwe')for(const [key,value] of Object.entries(a.fields))if(key.startsWith('Hwe1:')&&byId[value])summonIds.add(value);
const summons=[...summonIds].filter(id=>!records.some(r=>r.fighterId===id)).map(id=>{
  const f=byId[id].fields,name=f.unam||id,range=f.ua1r||100,dice=f.ua1d||1,sides=f.ua1s||2,base=f.ua1b||0;
  return {id:'summon_'+id,race:['h0AX','h0D5'].includes(id)?'goblin':'shadow',name,english:name,row:null,baseCost:null,cost:0,food:0,hp:f.uhpm||100,rawRange:range,
    min:base+dice,max:base+dice*sides,interval:f.ua1c||1.5,dps:0,atk:({normal:'普通',pierce:'穿刺',siege:'攻城',magic:'魔法',chaos:'混乱'})[f.ua1t]||'普通',armor:armor[f.uarm]||'无甲',abilityNames:'地图召唤物',
    buildingId:null,fighterId:id,summonOnly:true,elite:false,tier:0,upgrades:[],skillIds:String(f.uabi||'').split(',').filter(Boolean),
    map:{fields:f,armorPoints:f.udef||0,regen:f.uhpr||0,manaMax:f.umpm||0,manaStart:f.umpi||0,manaRegen:f.umpr||0},model:getModel(name,'shadow',range)};
});
const mapSource=fs.existsSync(cache+'manifest.json')?JSON.parse(fs.readFileSync(cache+'manifest.json','utf8')):null;
const upgrades=load('war3map.w3q');
const king=require('./king341.cjs')(byId,abilities,upgrades);
const rules=require('./rules341.cjs')({misc:fs.readFileSync(cache+'war3mapMisc.txt','utf8'),jass,units:byId,abilities,upgrades});
const mercs=require('./merc341.cjs')(byId,clean,rules);
for(const w of waves){const o=byId[w.mapId];w.base=o.base;w.rawRange=o.fields.ua1r??rules.inherited[o.base]?.range;if(w.rawRange===undefined)throw Error('Missing creep range '+w.mapId);}
const payload={version:'3.41',source:sheet.file,sourceHash:sheet.sha256,mapSource,rangeScale:.25,units:records,summons,mercs,king,rules,abilities:mapAbilities,waves,warnings};
fs.writeFileSync('data/legion341-map.json',JSON.stringify({towerMap,unitCount:mapUnits.length,abilityCount:mapAbilities.length,warnings},null,2)+'\n');
fs.writeFileSync('js/source341.js',"'use strict';\n// Generated by scripts/build341.cjs. Original spreadsheet values and map provenance.\nconst SOURCE341 = "+JSON.stringify(payload)+';\n');
console.log(JSON.stringify({records:records.length,buildable:records.filter(r=>!r.summonOnly).length,bases:records.filter(r=>!r.summonOnly&&!r.elite).length,races:counts,warnings},null,2));
