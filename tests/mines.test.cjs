const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const createGame = require('../server/game.cjs');
function engine() {
  const context=vm.createContext({});
  vm.runInContext(['source341','config','skills341','data','engine','combat341','ai'].map(n=>fs.readFileSync(path.join(__dirname,'../js',n+'.js'),'utf8')).join('\n'),context);
  const run=code=>vm.runInContext(code,context);
  run("newGame('normal'); G.players.forEach(p=>p.ai=null)");
  return run;
}
test('mines cost gold, pay on five-second boundaries and preserve timers across waves and upgrades',()=>{
  const run=engine();
  assert.equal(run('buyMine(G.players[0])'),true);
  assert.equal(run('G.players[0].gold'),200);
  for(let i=0;i<99;i++)run('simStep(.05)');
  assert.equal(run('G.players[0].gold'),200);
  run('simStep(.05)');assert.equal(run('G.players[0].gold'),208);
  run('G.players[0].gold=500; simStep(2); upgradeMine(G.players[0],0)');
  assert.equal(run('G.players[0].gold'),420);
  assert.equal(run('G.players[0].mines[0].elapsed'),2);
  run('startCombat(); simStep(3)');assert.equal(run('G.players[0].gold'),432);
  run('G.phase="prep"; G.timer=100; simStep(12.5)');
  assert.equal(run('G.players[0].gold'),456);
  assert.equal(run('G.players[0].mines[0].elapsed'),2.5);
  run('startPrep(); simStep(2.5)');assert.equal(run('G.players[0].gold'),474);
});
test('six mines per player, personal ownership, level cap and rejected actions never charge gold',()=>{
  const run=engine();
  run('G.players[0].gold=10000');
  for(let i=0;i<6;i++)assert.equal(run('buyMine(G.players[0])'),true);
  assert.equal(run('buyMine(G.players[0])'),false);
  assert.equal(run('G.players[0].gold'),9400);
  for(let i=0;i<4;i++)assert.equal(run('upgradeMine(G.players[0],0)'),true);
  assert.equal(run('G.players[0].gold'),8760);
  assert.equal(run('G.players[0].mines[0].level'),5);
  for(const id of ['0','-1','6','0.5','NaN','"0"','null'])assert.equal(run(`upgradeMine(G.players[0],${id})`),false);
  assert.equal(run('upgradeMine(G.players[2],0)'),false);
  run('simStep(5)'); assert.equal(run('G.players[0].gold'),8836);
  assert.equal(run('G.players[2].gold'),300);
  run('G.players[0].gold=0');assert.equal(run('upgradeMine(G.players[0],1)'),false);
  run('G.phase="over"; G.players[0].gold=999; simStep(10)');
  assert.equal(run('G.players[0].gold'),999);
  assert.equal(run('upgradeMine(G.players[0],1)'),false);
  assert.equal(run('buyMine(G.players[2])'),false);
});
test('newly purchased mines have independent timers and remain separate from combat units',()=>{
  const run=engine();
  run('G.players[0].gold=1000; buyMine(G.players[0]); simStep(3); buyMine(G.players[0]); simStep(2)');
  assert.equal(run('G.players[0].gold'),808);
  assert.equal(run('G.players[0].mines[1].elapsed'),2);
  assert.equal(run('G.players[0].fighters.length'),0);
  run('simStep(3)');assert.equal(run('G.players[0].gold'),816);
});
test('online mine upgrades and payouts are owned by the authenticated seat',()=>{
  const game=createGame([{slot:0,name:'Blue'},{slot:2,name:'Red'}]);
  assert.equal(game.action(0,{type:'mineBuy',slot:2,level:5,gold:99999}),true);
  assert.equal(game.snapshot().players[0].mines[0].level,1);
  assert.equal(game.action(2,{type:'mineUpgrade',id:0,slot:0}),false);
  for(let i=0;i<300;i++)game.step(.05);
  assert.equal(game.snapshot().players[0].gold,224);
  assert.equal(game.action(0,{type:'mineUpgrade',id:0}),true);
  assert.equal(game.snapshot().players[0].gold,144);
  assert.equal(game.snapshot().players[0].mines[0].level,2);
  for(let i=0;i<100;i++)game.step(.05);
  assert.equal(game.snapshot().players[0].gold,156);
  assert.equal(game.snapshot().players[2].gold,300);
});
