const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const createGame=require('../server/game.cjs');
function engine(){const c=vm.createContext({});vm.runInContext(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'),c);const run=s=>vm.runInContext(s,c);run("newGame('normal');G.players.forEach(p=>p.ai=null);const p=G.players[0];G.wave=15;G.phase='combat';G.combatT=0;");return run;}
test('24 source mercenary classes retain stock costs, income, provenance and unlock gates',()=>{
 const run=engine();assert.equal(run('Object.keys(MERCS).length'),24);
 assert.equal(run('Object.values(MERCS).every(m=>m.cost===m.sourceFields.ulum&&m.income===m.sourceFields.upoi&&m.hp===m.sourceFields.uhpm)'),true);
 assert.equal(run('MERCS.militia.cost'),20);assert.equal(run('MERCS.demon.cost'),1500);
 assert.equal(run('Object.values(MERCS).every(m=>m.rawId&&m.sourceShop&&m.min<=m.max&&Number.isFinite(m.range)&&m.aspd>0)'),true);
 const game=createGame([{slot:0,name:'a'},{slot:2,name:'b'}]);
 for(const mid of ['frost_wolf','behemoth','demon'])assert.equal(game.action(0,{type:'merc',mid,target:2}),false);
 assert.equal(game.snapshot().players[0].gold,300);assert.equal(game.action(0,{type:'merc',mid:'militia',target:2}),true);
 assert.equal(game.snapshot().players[0].gold,280);assert.equal(game.snapshot().players[0].income,7);
});
test('all 24 mercs can spawn, fight, leak and serialize without invalid state',()=>{
 const run=engine();run("p.gold=100000;for(const mid of Object.keys(MERCS)){if(!sendMerc(G.players[2],p,mid)){G.players[2].gold=100000;sendMerc(G.players[2],p,mid);}spawnEnemy(p,{type:'merc',id:mid});}buyFighter(p,'ent',5,7);G.kings[0].hp=G.kings[0].max=10000000;G.kings[1].hp=G.kings[1].max=10000000;");
 for(let i=0;i<2500;i++){
  run('simStep(.05)');
  if(i%20===0)assert.equal(run('[...p.enemies,...G.kings[0].leaks].every(e=>[e.hp,e.x,e.y,e.cd,e.dmg,e.speed].every(Number.isFinite))'),true);
 }
 assert.doesNotThrow(()=>run('JSON.stringify(G)'));
 assert.equal(run('[...p.enemies,...G.kings[0].leaks].every(e=>Number.isFinite(e.hp)&&Number.isFinite(e.x)&&Number.isFinite(e.cd))'),true);
});
test('merc healing, armor and damage auras affect wave creeps and stop after the source dies',()=>{
 const run=engine();run("for(const mid of ['hermit','furbolg','commander'])spawnEnemy(p,{type:'merc',id:mid});spawnEnemy(p,{type:'wave'});p.enemies.forEach(e=>{e.x=1500;e.y=300;e.hp-=20;});const creep=p.enemies[3];const before=creep.hp;tick341({...p,enemies:defenseTargets(p)},1);");
 assert.equal(run('creep.hp-before'),3);assert.equal(run('creep.mercArmor'),3);assert.equal(run('creep.mercDamage'),.04);
 run('p.enemies.slice(0,3).forEach(e=>e.hp=0);tick341({...p,enemies:defenseTargets(p)},1)');
 assert.equal(run('creep.mercArmor'),0);assert.equal(run('creep.mercDamage'),0);assert.equal(run('creep.hp-before'),3);
});
test('merc poison, corruption and frost apply real statuses while spell immunity rejects them',()=>{
 const run=engine();run("buyFighter(p,'ent',5,7);const f=p.fighters[0];f.hp=f.max=10000;spawnEnemy(p,{type:'merc',id:'kraken'});const e=p.enemies[0];e.x=f.x;e.y=f.y;mercAttack341(p,e,f);const hp=f.hp;step341Enemy(f,1);");
 assert.equal(run('f.slowF'),.8);assert.equal(run('f.attackSlow'),.2);assert.ok(run('hp-f.hp')>0);
 run("spawnEnemy(p,{type:'merc',id:'warlock'});mercAttack341(p,p.enemies[1],f);step341Enemy(f,.1)");assert.equal(run('f.armorLoss'),4);
 run("const immune=p.enemies[0];const old=immune.hp;dmgEnemy(immune,100,'法术');add341Status(immune,'bad',{dps:100,time:5});");
 assert.equal(run('immune.hp===old'),true);assert.equal(run('immune.statuses?.bad'),undefined);
});
test('blood rush uses mana and buffs an ally; vampirism heals on actual damage; regicide doubles king damage',()=>{
 const run=engine();run("for(const mid of ['militia','shaman','pudge'])spawnEnemy(p,{type:'merc',id:mid});p.enemies.forEach(e=>{e.x=1500;e.y=300;});const militia=p.enemies[0],shaman=p.enemies[1];tick341({...p,enemies:defenseTargets(p)},.05);");
 assert.equal(run('shaman.mana'),0);assert.ok(run('militia.bloodBuff.time')>0);
 run("buyFighter(p,'ent',5,7);const f=p.fighters[0];f.hp=f.max=10000;militia.hp-=20;const oldHp=militia.hp;mercAttack341(p,militia,f)");assert.ok(run('militia.hp')>run('oldHp'));
 run("p.enemies=[];p.fighters=[];spawnEnemy(p,{type:'merc',id:'chariot'});const e=p.enemies[0],k=G.kings[0];leak(p,e);e.x=k.x;e.y=k.y;e.routeIndex=e.route.length-1;e.cd=0;k.cd=100;const before=k.hp;kingStep(k,.01);");
 assert.equal(run('before-k.hp'),run("e.dmg*2"));
});
