const {test}=require('node:test'),assert=require('node:assert/strict'),engine=require('./helpers/native-engine.cjs');
test('all sixteen original builders are represented and all six pools map every extracted building ID without losing entries',()=>{
 const run=engine();assert.equal(run('Object.keys(RACES).length'),16);assert.equal(run('UNIT_POOLS341.every((p,i)=>p.length===SOURCE341.rules.native.unitPools[i].length&&p.length>0)'),true);
});
test('Hybrid pays its tier price, stays under construction for 5.3 seconds, rolls only after completion and cannot claim a full new-tower refund',()=>{
 const run=engine();run("chooseBuilder341(p,'hybrid');Math.random=()=>0;buyFighter(p,'hybrid_1',0,0);globalThis.t=p.towers[0]");assert.equal(run('p.gold'),282);assert.equal(run('t.uid'),'hybrid_1');assert.equal(run('sellFighter(p,t)'),false);
 run('stepConstruction341(p,5.29)');assert.equal(run('t.uid'),'hybrid_1');run('stepConstruction341(p,.01)');assert.equal(run('t.uid'),run('UNIT_POOLS341[0][0]'));assert.equal(run('t.newlyBuilt'),false);assert.equal(run('fighterSellValue(t)'),run('Math.floor(t.def.pointValue*(t.def.abil.refund??.5))'));
});
test('Prophet offers one actual unit per source tier; reroll changes the pool, preserves old towers, pays escalating costs and is limited',()=>{
 const run=engine();run("Math.random=()=>0;chooseBuilder341(p,'prophet');p.gold=p.wood=10000;globalThis.before=p.prophetDeck.join(',');buyReady341(p,p.prophetDeck[0],0,0);Math.random=()=>.999999");
 assert.equal(run('p.prophetDeck.length'),6);assert.equal(run('rerollProphet341(p)'),true);assert.notEqual(run('p.prophetDeck.join(",")'),run('before'));assert.equal(run('p.towers.length'),1);
 const gold=run('p.gold'),wood=run('p.wood');assert.equal(run('rerollProphet341(p)'),true);assert.equal(run('p.gold'),gold-50);assert.equal(run('p.wood'),wood-50);
 run('while(p.prophetRerolls<5)rerollProphet341(p)');assert.equal(run('rerollProphet341(p)'),false);
});
test('ordinary source construction and upgrades are timed; unfinished construction and unfinished upgrades do not produce a battle copy',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');p.gold=10000;buyFighter(p,'ent',0,0);globalThis.t=p.towers[0]");assert.equal(run('t.constructionRemaining'),5);assert.equal(run("upgradeFighter(p,t,'guardian')"),false);
 run('startCombat()');assert.equal(run('p.fighters.length'),0);run('stepConstruction341(p,5)');assert.equal(run('p.fighters.length'),0);
 run('endWave();upgradeFighter(p,t,"guardian")');assert.equal(run('t.uid'),'ent');assert.equal(run('t.upgradePending'),'guardian');run('startCombat()');assert.equal(run('p.fighters.length'),0);run('stepConstruction341(p,5)');assert.equal(run('t.uid'),'guardian');assert.equal(run('p.fighters.length'),0);
});
test('native construction and upgrade cancellation refund BOTH resources at the source 100 percent rates without duplicate refunds',()=>{
 const run=engine();run("chooseBuilder341(p,'nature');buyFighter(p,'ent',0,0);globalThis.t=p.towers[0]");assert.equal(run('cancelConstruction341(p,t)'),true);assert.equal(run('p.gold'),300);assert.equal(run('cancelConstruction341(p,t)'),false);
 run('farmUpgrade341(p)');assert.equal(run('p.wood'),17);assert.equal(run('cancelFarm341(p)'),true);assert.equal(run('p.gold'),300);assert.equal(run('p.wood'),97);assert.equal(run('cancelFarm341(p)'),false);
 run("buyReady341(p,'ent',0,0);globalThis.u=p.towers[0];globalThis.before=p.gold;upgradeFighter(p,u,'guardian')");assert.equal(run('cancelConstruction341(p,u)'),true);assert.equal(run('p.gold'),run('before'));assert.equal(run('u.uid'),'ent');assert.equal(run('u.constructionRemaining'),0);
});
