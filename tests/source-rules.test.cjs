const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const createGame=require('../server/game.cjs');
function engine(){const context=vm.createContext({}),run=code=>vm.runInContext(code,context);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));run("newGame('normal');G.players.forEach(p=>{p.ai=null;p.gold=100000;});globalThis.p=G.players[0];globalThis.k=G.kings[0]");return run;}
function near(actual,expected){assert.ok(Math.abs(actual-expected)<1e-5,`${actual} != ${expected}`);}

test('all seven source attack matrices retain the eight raw misc columns',()=>{
 const run=engine(),expected={普通:[.9,1.2,.9,.8,.8,1,1,1],穿刺:[1.3,.9,.8,.7,.7,1,1,1],魔法:[1.1,.8,1.2,.7,.7,1,1,1],攻城:[.9,.9,.9,1.25,1.25,1,1,1],英雄:[1,1,1,1,1,1,.35,1],混乱:Array(8).fill(1),法术:Array(8).fill(1)};
 for(const [type,values] of Object.entries(expected))assert.deepEqual(JSON.parse(run(`JSON.stringify(SOURCE341.rules.armorOrder.map(a=>ATK_ARMOR['${type}'][a]))`)),values);
});
test('spell damage ignores numeric armor consistently for fighters and creeps; source magic attacks can hit spell-immune units',()=>{
 const run=engine();run("buyFighter(p,'ent',0,0);globalThis.f=p.fighters[0];f.hp=f.max=10000;f.effArmor=20;spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.hp=e.max=10000;e.armorPoints=20;hitFighter(p,f,100,'法术');dmgEnemy(e,100,'法术')");
 assert.equal(run('f.hp'),9900);assert.equal(run('e.hp'),9900);
 run("e.magicImmune=true;dmgEnemy(e,100,'法术')");assert.equal(run('e.hp'),9900);
 run("dmgEnemy(e,100,'魔法')");near(run('9900-e.hp'),100/2.2);
 run("f.def={...f.def,abil:{...f.def.abil,magicImmune:true}};const before=f.hp;hitFighter(p,f,100,'法术');globalThis.immuneBefore=before");assert.equal(run('f.hp'),run('immuneBefore'));
});
test('wave ranges use object overrides or their actual hfoo, hrif and Hpal bases; active HP research applies only to listed tech users',()=>{
 const run=engine();near(run('WAVES[9].range'),45);near(run('WAVES[30].range'),56.25);near(run('WAVES[3].range'),100);
 near(run('WAVES[0].hp'),34.5);near(run('WAVES[12].hp'),285);near(run('WAVES[30].hp'),2670*1.15);
 assert.equal(run('SOURCE341.waves.every((w,i)=>WAVES[i].range===w.rawRange*.25)'),true);
});
test('native ground-only targeting excludes flyers and source splash uses full, half and outer-zone factors',()=>{
 const run=engine();assert.equal(run('UNITS.harpy.air'),true);assert.equal(run('UNITS.young_frost_dragon.air'),true);assert.equal(run('UNITS.azure_dragon.air'),true);assert.equal(run('UNITS.ent.air'),false);
 run("buyFighter(p,'ent',0,0);globalThis.f=p.fighters[0];f.def={...f.def,targets:'ground,enemies'};spawnEnemy(p,{type:'wave'});globalThis.air=p.enemies[0];air.air=true;air.x=f.x+1;air.y=f.y;fighterAct(p,f,.1)");assert.equal(run('f.brain.targetId'),null);
 run("p.enemies=[];for(const [x,air] of [[0,false],[1,false],[8,false],[20,false],[8,true]]){spawnEnemy(p,{type:'wave'});const e=p.enemies.at(-1);e.x=x;e.y=0;e.hp=e.max=1000;e.armor='无甲';e.armorPoints=0;e.air=air;}afterHits(p,p.enemies[0],100,'混乱',UNITS.dwarven_engineer.abil)");
 near(run('p.enemies[1].hp'),900);near(run('p.enemies[2].hp'),950);near(run('p.enemies[3].hp'),985);near(run('p.enemies[4].hp'),1000);
});
test('travel-tree movement aura supports allies, stops outside range or after death, and never exceeds native speed ceiling',()=>{
 const run=engine();run("buyFighter(p,'ent',0,0);globalThis.f=p.fighters[0];globalThis.ally=G.players[1];buyFighter(ally,'ent',0,0);globalThis.tree=ally.fighters[0];tree.def=UNITS.tree_of_travel;tree.x=f.x+10;tree.y=f.y;tick341({...p,enemies:[]},.01)");near(run('f.effMove'),.3);near(run('fighterSpeed341(p,f)'),run('f.def.speed*1.3'));
 run('tree.x+=1000;tick341({...p,enemies:[]},.01)');near(run('f.effMove'),0);
 run('tree.x=f.x;tree.hp=0;tick341({...p,enemies:[]},.01)');near(run('f.effMove'),0);
 run('f.def={...f.def,speed:500};f.effMove=1');near(run('fighterSpeed341(p,f)'),130.5);
});
test('Magnataur uses source mana, periodic acquisition, cooldown and a travelling wave that hits each eligible unit once',()=>{
 const run=engine();run("G.wave=30;G.waveDef=waveDefFor(30);spawnEnemy(p,{type:'wave'});globalThis.boss=p.enemies[0];buyFighter(p,'ent',0,0);globalThis.f=p.fighters[0];boss.x=f.x-100;boss.y=f.y;f.hp=f.max=10000;f.effArmor=100;bossStep341(p,boss,1)");
 assert.equal(run('boss.mana'),50);assert.equal(run('boss.spellCD.A05H'),20);assert.equal(run('G.skillWaves.length'),1);assert.equal(run('f.hp'),10000);
 run('stepSkillWaves341(.05)');assert.equal(run('f.hp'),10000);
 run('stepSkillWaves341(.5)');assert.equal(run('f.hp'),9900);run('stepSkillWaves341(.1)');assert.equal(run('f.hp'),9900);
 run('bossStep341(p,boss,1)');assert.equal(run('boss.spellCD.A05H'),19);assert.equal(run('boss.mana'),51);
 run('boss.spellCD.A05H=0;boss.mana=149;boss.manaRegen=0;bossStep341(p,boss,1)');assert.equal(run('boss.mana'),149);
});
test('dragon-turtle native bounce hits a second defender with 30 percent damage loss',()=>{
 const run=engine();run("G.wave=20;G.waveDef=waveDefFor(20);spawnEnemy(p,{type:'wave'});globalThis.turtle=p.enemies[0];buyFighter(p,'ent',0,0);buyFighter(p,'ent',1,0);for(const f of p.fighters){f.hp=f.max=10000;f.effArmor=0;}p.fighters[1].x=p.fighters[0].x+30;p.fighters[1].y=p.fighters[0].y;mercAttack341(p,turtle,p.fighters[0])");
 near(run('10000-p.fighters[0].hp'),run('turtle.dmg'));near(run('10000-p.fighters[1].hp'),run('turtle.dmg*.7'));
});
test('ice-troll frost reads both 10 percent slow constants from the map instead of the former guessed 25 percent',()=>{
 const run=engine();near(run('MERCS.ice_troll.abil.cold.move'),.1);near(run('MERCS.ice_troll.abil.cold.attack'),.1);
 run("buyFighter(p,'ent',0,0);spawnEnemy(p,{type:'merc',id:'ice_troll'});globalThis.f=p.fighters[0];f.hp=f.max=10000;mercAttack341(p,p.enemies[0],f);step341Enemy(f,.1)");near(run('f.slowF'),.9);near(run('f.attackSlow'),.1);
});
test('king last-hit bounty waits for end-of-round equal team distribution; guard and poison kills belong to the actual fighter owner',()=>{
 const run=engine();run("G.phase='combat';spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.hp=1;dmgEnemy(e,1000,'英雄',k);const before=G.players.map(p=>p.gold);rewardEnemy(p,e);rewardEnemy(p,e);globalThis.before=before");
 assert.equal(run('p.gold'),run('before[0]'));assert.equal(run('G.kingGoldPools[0]'),3);
 run('settleKingGold341();settleKingGold341()');assert.equal(run('p.gold-before[0]'),1);assert.equal(run('G.players[1].gold-before[1]'),1);assert.equal(run('G.players[2].gold-before[2]'),0);
 run("spawnEnemy(p,{type:'wave'});const poison=p.enemies.at(-1);poison.hp=1;add341Status(poison,'poison',{time:1,dps:100,ownerId:1});step341Enemy(poison,.1);rewardEnemy(p,poison)");assert.equal(run('G.players[1].gold-before[1]'),4);
});
test('source population starts at 15, counts dead permanent units, checks upgrades, excludes summons and refunds capacity on sales',()=>{
 const run=engine();assert.equal(run('foodCapacity341(p)'),15);
 run("for(let i=0;i<15;i++)if(!buyFighter(p,'ent',i%12,Math.floor(i/12)))throw Error('purchase failed')");assert.equal(run('armyFood341(p)'),15);assert.equal(run("buyFighter(p,'ent',3,1)"),false);
 run('p.fighters[0].hp=0');assert.equal(run('armyFood341(p)'),15);
 const gold=run('p.gold');assert.equal(run('farmUpgrade341(p)'),true);assert.equal(run('p.gold'),gold-104);assert.equal(run('foodCapacity341(p)'),23);
 run("spawn341Ally(p,p.fighters[1],UNITS.ent,10)");assert.equal(run('armyFood341(p)'),15);
 run('sellFighter(p,p.fighters[0])');assert.equal(run('armyFood341(p)'),14);
 run('while(farmUpgrade341(p)){}');assert.equal(run('foodCapacity341(p)'),200);assert.equal(run('farmUpgrade341(p)'),false);
 run("G.battleMode='arena';G.phase='combat'");assert.equal(run('farmUpgrade341(p)'),false);
});
test('an upgrade that increases food fails atomically at capacity and succeeds after a farm upgrade',()=>{
 const run=engine();run("buyFighter(p,'infantry',0,0);for(let i=1;i<15;i++)buyFighter(p,'ent',i%12,Math.floor(i/12));const gold=p.gold;globalThis.gold=gold;globalThis.f=p.fighters[0]");
 assert.equal(run("upgradeFighter(p,f,'zeus')"),false);assert.equal(run('p.gold'),run('gold'));assert.equal(run('f.uid'),'infantry');
 run('farmUpgrade341(p)');assert.equal(run("upgradeFighter(p,f,'zeus')"),true);assert.equal(run('armyFood341(p)'),16);
});
test('endurance aura applies both speed fields and active haste stacks with royal aura; Trident bash retains its source damage multiplier',()=>{
 const run=engine();run("buyFighter(p,'ent',0,0);globalThis.f=p.fighters[0];f.def=UNITS.troll_champion;tick341({...p,enemies:[]},.01)");near(run('f.effMove'),.08);near(run('f.effHaste'),.08);
 run("k.skills=['S001'];f.x=k.x;f.y=k.y;f.buffs.haste={time:10,haste:.2};tick341({...p,enemies:[]},.01)");near(run('f.effHaste'),.3);
 run("f.def=UNITS.trident;f.def={...f.def,abil:{...f.def.abil,bash:{...f.def.abil.bash,chance:1}}};spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.hp=e.max=1000;e.armor='无甲';e.armorPoints=0;hit341(p,f,e,100,100)");near(run('e.hp'),900);assert.ok(run('e.statuses.bash.time')>0);
});
test('server farm action deducts the source converted cost for the authenticated seat and enemy farm state stays private',()=>{
 const game=createGame([{slot:0,name:'A'},{slot:2,name:'B'}]);assert.equal(game.action(0,{type:'farmUpgrade'}),true);assert.equal(game.snapshot().players[0].gold,196);assert.equal(game.snapshot().players[0].farmLevel,1);assert.equal(game.snapshot().players[2].farmLevel,0);assert.equal(game.snapshot(2).players[0].farmLevel,null);assert.equal(game.action(1,{type:'farmUpgrade'}),false);
});
test('wave 30 pays double completion bonus once before the 60-second bonus preparation',()=>{
 const run=engine();run('G.wave=30;G.waveDef=waveDefFor(30);const gold=p.gold;endWave();globalThis.gold=gold');assert.equal(run('G.wave'),31);assert.equal(run('G.timer'),60);assert.equal(run('p.gold-gold'),806);assert.equal(run('G.result'),null);
});
test('bonus batches continue before previous creeps die, shrink intervals, retain survivor state and do not settle by king HP ratio',()=>{
 const run=engine();run("G.wave=30;G.waveDef=waveDefFor(30);buyFighter(p,'ent',0,0);endWave();startCombat();globalThis.f=p.fighters[0];f.hp=12;f.mana=3;f.cd=7;f.spellCD.test=9;spawnEnemy(p,{type:'wave'});const gold=p.gold;bonusStep341(60);globalThis.gold=gold");
 assert.equal(run('G.bonus.batch'),2);near(run('G.bonus.timer'),50*5/6+10);assert.equal(run('p.spawnList.length'),30);assert.equal(run('p.enemies.length'),1);assert.equal(run('f.hp'),12);assert.equal(run('p.gold'),run('gold'));
 run('p.enemies=[];G.players.forEach(p=>{p.spawnList=[];p.mercSpawnList=[];p.enemies=[];p.paid=true});endWave();endWave()');assert.equal(run('f.hp'),12);assert.equal(run('f.mana'),3);assert.equal(run('f.cd'),7);assert.equal(run('f.spellCD.test'),9);assert.equal(run('G.phase'),'combat');assert.equal(run('G.result'),null);assert.equal(run('p.gold'),run('gold'));
});
