const {test}=require('node:test'),assert=require('node:assert/strict'),engine=require('./helpers/native-engine.cjs');
const createGame=require('../server/game.cjs');
test('eight seats start with 300 gold, 97 lumber, one worker, zero income, and no difficulty subsidy',()=>{
 const run=engine();assert.equal(run('G.players.length'),8);assert.equal(run('G.players.every(p=>p.gold===300&&p.wood===97&&p.workers===1&&p.income===0)'),true);
 run('simStep(10)');assert.equal(run('p.gold'),300);assert.equal(run('p.wood'),107);assert.equal(run('Object.values(CFG.DIFFS).every(d=>d.emult===1&&d.aiMult===1&&d.allyMult===1)'),true);
});
test('former mine purchases and upgrades are rejected locally and by authoritative actions without taking funds',()=>{
 const run=engine();assert.equal(run('buyMine(p,0)'),false);assert.equal(run('upgradeMine(p,0)'),false);assert.equal(run('p.gold'),300);
 const g=createGame([{slot:0,name:'a'},{slot:4,name:'b'}]);for(const type of ['mineBuy','mineUpgrade'])assert.equal(g.action(0,{type,id:0}),false);assert.equal(g.snapshot().players[0].gold,300);
});
test('vacant online slots do not receive AI armies, lumber or wave spawns; individual departures preserve surviving teammates',()=>{
 const g=createGame([{slot:0,name:'a'},{slot:1,name:'ally'},{slot:4,name:'b'},{slot:5,name:'other'}]);for(let i=0;i<1620;i++)g.step(.05);
 const s=g.snapshot();assert.equal(s.players.filter(p=>p.active).length,4);assert.equal(s.players[2].enemies.length,0);assert.equal(s.players[2].wood,0);assert.equal(s.players[2].gold,0);assert.ok(s.players[0].enemies.length>0);
 g.leaveSlot(4);assert.notEqual(g.snapshot().phase,'over');assert.equal(g.snapshot().players[4].spawnList.length,0);g.leaveSlot(5);assert.equal(g.snapshot().result.winner,0);
});
test('farm expansion consumes actual gold AND lumber, never a combined gold conversion, and failure is atomic',()=>{
 const run=engine();assert.equal(run('farmUpgrade341(p)'),true);assert.equal(run('p.gold'),276);assert.equal(run('p.wood'),17);assert.equal(run('foodCapacity341(p)'),15);run('stepConstruction341(p,6)');assert.equal(run('foodCapacity341(p)'),23);
 assert.equal(run('farmUpgrade341(p)'),false);assert.equal(run('p.gold'),276);assert.equal(run('p.wood'),17);
});
test('worker value gate, serial training, independent harvest clocks and seven-worker cap survive frame partitioning',()=>{
 function setup(){const run=engine();run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);p.towers[0].def={...p.towers[0].def,pointValue:350};p.gold=10000");return run;}
 const gate=engine();assert.equal(gate('buyWorker341(p)'),false);
 const a=setup(),b=setup();for(const run of [a,b]){for(let i=0;i<6;i++)assert.equal(run('buyWorker341(p)'),true);assert.equal(run('buyWorker341(p)'),false);}
 a('lumberStep341(p,180)');for(let i=0;i<1800;i++)b('lumberStep341(p,.1)');assert.equal(a('p.workers'),7);assert.equal(a('p.wood'),b('p.wood'));assert.equal(a('p.wood'),97+10*(18+15+12+9+6+3));
});
test('lumber research costs both resources, respects army value and town queue, then increases yield only after completion',()=>{
 const run=engine();assert.equal(run('researchLumber341(p)'),false);run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);p.towers[0].def={...p.towers[0].def,pointValue:600};p.gold=1000;p.wood=1000");
 assert.equal(run('researchLumber341(p)'),true);assert.equal(run('p.gold'),940);assert.equal(run('p.wood'),940);assert.equal(run('buyWorker341(p)'),false);run('lumberStep341(p,22)');assert.equal(run('p.lumberLevel'),1);assert.equal(run('p.wood'),960);run('lumberStep341(p,8)');assert.equal(run('p.wood'),971);
});
test('king upgrades consume lumber, share with allies, preserve gold and enforce limits',()=>{
 const run=engine();assert.equal(run("kingUpgrade(p,'health')"),true);assert.equal(run('p.gold'),300);assert.equal(run('p.wood'),17);assert.equal(run('p.income'),3);assert.equal(run('k.max'),3050);
 assert.equal(run("kingUpgrade(p,'attack')"),false);run("p.wood=100000;while(kingUpgrade(p,'health')){};while(kingUpgrade(p,'attack')){};while(kingUpgrade(p,'regen')){}");assert.equal(run('k.max'),16350);assert.equal(run('k.min'),331);assert.equal(run('k.regen'),103);
});
test('mercenaries consume lumber and rotate through the opposing four lanes instead of accepting a chosen victim or a 40-unit cap',()=>{
 const run=engine();run('p.wood=10000');for(let i=0;i<44;i++)assert.equal(run("sendMerc(p,G.players[7],'militia')"),true);
 assert.equal(run('G.players.slice(4).every(p=>p.mercQueue.length===11)'),true);assert.equal(run('p.gold'),300);assert.equal(run('p.wood'),10000-run('44*MERCS.militia.cost'));assert.equal(run('p.income'),run('44*MERCS.militia.income'));
});
test('map stats override spreadsheet disagreements, while original workbook values remain traceable',()=>{
 const run=engine();assert.equal(run('UNITS.elder_witch_doctor.purchaseCost'),200);assert.equal(run("SOURCE341.units.find(r=>r.id==='elder_witch_doctor').sheetStats.cost"),100);
 assert.equal(run('SOURCE341.units.every(r=>r.map.fields.ua1b===undefined||r.attackBase===r.map.fields.ua1b)'),true);
 assert.equal(run('SOURCE341.units.every(r=>r.map.fields.ua1s===undefined||r.attackSides===r.map.fields.ua1s)'),true);
});
test('native refunds use point value: unplayed new construction 100%, experienced normal troops 50%, feeder/claw 90%; battle sales fail',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);globalThis.f=p.towers[0]");assert.equal(run('fighterSellValue(f)'),run('f.def.pointValue'));
 run('f.newlyBuilt=false');assert.equal(run('fighterSellValue(f)'),run('Math.floor(f.def.pointValue*.5)'));run('f.def=UNITS.bottom_feeder');assert.equal(run('fighterSellValue(f)'),run('Math.floor(f.def.pointValue*.9)'));
 run("G.phase='combat'");assert.equal(run('sellFighter(p,f)'),false);
});
test('AP builder selection happens in the map, applies offline and online, and cannot be overridden by forged race/slot fields',()=>{
 const g=createGame([{slot:0,name:'a'},{slot:4,name:'b'}]);assert.equal(g.snapshot().players[0].race,null);assert.equal(g.action(0,{type:'buy',uid:'ent',col:0,row:0}),false);
 assert.equal(g.action(0,{type:'chooseBuilder',race:'nature'}),true);assert.equal(g.action(0,{type:'chooseBuilder',race:'mech'}),false);assert.equal(g.action(0,{type:'buy',uid:'infantry',race:'mech',slot:4,col:0,row:0}),false);
 assert.equal(g.action(0,{type:'buy',uid:'ent',col:0,row:0}),true);assert.equal(g.snapshot().players[4].race,null);assert.throws(()=>createGame([],{raceMode:'select'}));
});
test('buildings and battle copies are separate; constructing mid-wave cannot spawn a fighter or refresh an existing fighter',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);p.gold=10000;startCombat();p.fighters[0].hp=1;globalThis.battle=p.fighters[0]");
 assert.equal(run("buyReady341(p,'ent',1,0)"),true);assert.equal(run('p.towers.length'),2);assert.equal(run('p.fighters.length'),1);assert.equal(run('p.fighters[0].hp'),1);assert.equal(run("upgradeReady341(p,p.towers[0],'guardian')"),false);
 run('endWave()');assert.equal(run('p.fighters===p.towers'),true);assert.equal(run('p.fighters.length'),2);assert.equal(run('p.fighters.every(f=>f.hp===f.max)'),true);
});
test('native CB permits mixed armies over time, retains old buildings, offers two random builders and enforces its research limit',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);p.gold=10000;p.wood=10000;Math.random=()=>.9");assert.equal(run('changeBuilder341(p)'),true);assert.equal(run('p.builderChoices.length'),2);assert.equal(run('p.towers[0].uid'),'ent');
 run('globalThis.nextRace=p.builderChoices.find(r=>r!=="nature");chooseBuilder341(p,nextRace);globalThis.uid=AI_DECKS[nextRace][0]');assert.equal(run('buyReady341(p,uid,1,0)'),true);assert.equal(run('new Set(p.towers.map(f=>f.def.race)).size'),2);
 run('while(p.builderChanges<5){changeBuilder341(p);chooseBuilder341(p,p.builderChoices[0]);}');assert.equal(run('changeBuilder341(p)'),false);
});
test('GG uses army value minus lifetime leaks for leaked bounty and HG king kills credit BOTH computer pools before equal distribution',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');buyReady341(p,'ent',0,0);p.towers[0].def={...p.towers[0].def,pointValue:125};startCombat();spawnEnemy(p,{type:'wave'});globalThis.e=p.enemies[0];e.bounty=10;leak(p,e);e.hp=1;dmgEnemy(e,10000,'英雄',k);rewardEnemy(p,e)");
 assert.equal(run('e.leakRewardFactor'),.5);assert.equal(run('G.kingGoldPools[0]'),5);assert.equal(run('G.kingGoldPools[1]'),5);const gold=run('p.gold'),enemyGold=run('G.players[4].gold');run('settleKingGold341();settleKingGold341()');assert.equal(run('p.gold')-gold,1);assert.equal(run('G.players[4].gold')-enemyGold,1);
});
