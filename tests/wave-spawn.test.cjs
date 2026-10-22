const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const createGame=require('../server/game.cjs');
function engine(){const c=vm.createContext({}),run=s=>vm.runInContext(s,c);run(['source341','config','skills341','data','behavior','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'));run("newGame('normal');G.players.forEach(p=>p.ai=null);const p=G.players[0];");return run;}
test('all 31 waves use source-map per-lane counts and actual active timer intervals',()=>{
 const run=engine(),expected=[36,45,40,36,36,36,30,36,45,3,54,45,45,26,36,45,35,45,36,3,36,48,36,35,45,36,36,18,30,3,15];
 for(let i=0;i<31;i++){
  assert.equal(run(`WAVES[${i}].count`),expected[i]);assert.equal(run(`WAVES[${i}].spawnInterval`),i===30?.5:.1);
  run(`G.wave=${i+1};G.waveDef=waveDefFor(G.wave);startCombat();`);
  for(let j=0;j<expected[i]*(i===30?10:2)-1;j++)run('fieldStep(p,.05)');
  assert.equal(run('p.spawnList.length'),1,`last creep must not arrive early on wave ${i+1}`);
  run('fieldStep(p,.05)');assert.equal(run('p.spawnList.length'),0,`all creeps arrive on schedule on wave ${i+1}`);
  assert.equal(run('p.enemies.length+p.leakCount'),expected[i]);
  run('p.enemies=[];G.kings[0].leaks=[];');
 }
 assert.equal(run('SOURCE341.waves[16].sheetQty'),34);assert.equal(run('SOURCE341.waves[23].sheetQty'),36);
});
test('mercenary pressure joins at two seconds while normal creeps continue spawning',()=>{
 const run=engine();run("p.mercQueue=['hermit','militia'];startCombat();");
 for(let i=0;i<39;i++)run('fieldStep(p,.05)');
 assert.equal(run('p.enemies.filter(e=>e.mercId).length'),0);assert.equal(run('p.mercSpawnList.length'),2);
 run('fieldStep(p,.05)');assert.equal(run('p.enemies.filter(e=>e.mercId).length'),2);
 assert.equal(run('p.enemies.filter(e=>!e.mercId).length'),20);assert.equal(run('p.spawnList.length'),16);
 run('fieldStep(p,1.6)');assert.equal(run('p.spawnList.length'),0);assert.equal(run('p.enemies.filter(e=>!e.mercId).length'),36);
});
test('pending mercenaries prevent premature clears; timeout does not drop pending units',()=>{
 const run=engine();run("p.mercQueue=['militia'];startCombat();p.spawnList=[];fieldStep(p,.5);");
 assert.equal(run('p.paid'),false);assert.equal(run('p.mercSpawnList.length'),1);
 run('forceLeakAll()');assert.equal(run('p.mercSpawnList.length'),0);assert.equal(run('p.spawnList.length'),0);
 assert.equal(run('G.kings[0].leaks.some(e=>e.mercId==="militia")'),true);
});
test('online authority emits ten creeps per lane after one second and 36 after 3.6 seconds',()=>{
 const game=createGame([0,1,2,3].map(slot=>({slot,name:'p'+slot})));
 for(let i=0;i<640;i++)game.step(.05);
 // Floating-point prep countdown can cross zero on the following simulation step.
 if(game.snapshot().phase==='prep')game.step(.05);
 for(let i=0;i<20;i++)game.step(.05);
 assert.equal(game.snapshot().players.every(p=>p.enemies.length===10&&p.spawnList.length===26),true);
 for(let i=0;i<52;i++)game.step(.05);
 assert.equal(game.snapshot().players.every(p=>p.enemies.length===36&&!p.spawnList.length),true);
 assert.equal(game.snapshot().players.reduce((n,p)=>n+p.enemies.length,0),144);
});
