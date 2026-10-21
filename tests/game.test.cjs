const { test } = require('node:test');
const assert = require('node:assert/strict');
const createGame = require('../server/game.cjs');
const humans = [{ slot:0,name:'蓝方真人' }, { slot:2,name:'红方真人' }];
test('king stats upgrade independently, share within the team and reject invalid choices', () => {
  const game=createGame([{slot:0,name:'A'},{slot:1,name:'B'},{slot:2,name:'C'}]);
  assert.equal(game.action(0,{type:'king',stat:'health'}),true);
  let king=game.snapshot().kings[0];
  assert.equal(king.max,4350); assert.equal(king.hp,4350);
  assert.equal(king.dmg,60); assert.equal(king.regen,2);
  assert.equal(game.action(1,{type:'king',stat:'attack'}),true);
  king=game.snapshot().kings[0];
  assert.deepEqual({...king.upgrades},{health:1,attack:1,regen:0});
  assert.equal(king.dmg,69); assert.equal(king.max,4350); assert.equal(king.regen,2);
  assert.equal(game.snapshot().players[1].gold,220);
  assert.equal(game.action(1,{type:'king',stat:'attack'}),true);
  assert.equal(game.action(1,{type:'king',stat:'attack'}),false);
  assert.equal(game.action(2,{type:'king',stat:'regen'}),true);
  assert.equal(game.snapshot().kings[1].regen,3);
  assert.equal(game.snapshot().kings[1].max,4200);
  assert.equal(game.snapshot().kings[1].dmg,60);
  const before=game.snapshot();
  for(const stat of ['invalid','__proto__','constructor',null,{}])
    assert.equal(game.action(0,{type:'king',stat}),false);
  assert.deepEqual(game.snapshot(),before);
});
test('king regeneration scales with elapsed time in prep and combat and clamps to max HP', () => {
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const ctx=vm.createContext({});
  vm.runInContext(['source341','config','skills341','data','engine','combat341','ai'].map(name=>fs.readFileSync(path.join(__dirname,'../js',name+'.js'),'utf8')).join('\n'),ctx);
  const run=code=>vm.runInContext(code,ctx);
  run("newGame('normal'); G.kings[0].hp -= 100; kingUpgrade(G.players[0], 'regen'); simStep(1)");
  assert.equal(run('G.kings[0].hp'),4103);
  run('startCombat(); simStep(2)');
  assert.equal(run('G.kings[0].hp'),4109);
  run('G.kings[0].hp=G.kings[0].max-1; simStep(1)');
  assert.equal(run('G.kings[0].hp'),4200);
  run("G.phase='over'; G.kings[0].hp=4000; simStep(1)");
  assert.equal(run('G.kings[0].hp'),4000);
});
test('server owns economy, rejects malformed commands and isolates rooms', () => {
  const a = createGame(humans), b = createGame(humans);
  assert.equal(a.action(0,{type:'buy',uid:'ent',col:2,row:2}),true);
  assert.equal(a.snapshot().players[0].gold,280);
  assert.equal(b.snapshot().players[0].gold,300);
  for (const action of [
    {type:'buy',uid:'ent',col:2,row:2},
    {type:'buy',uid:'ent',col:NaN,row:1},
    {type:'buy',uid:'ent',col:6,row:0},
    {type:'buy',uid:'__proto__',col:0,row:0},
    {type:'merc',mid:'constructor',target:2},
    {type:'merc',mid:'imp',target:0},
    {type:'pause'}, {type:'speed',speed:10}
  ]) assert.equal(!!a.action(0,action),false);
  assert.equal(!!a.action(1,{type:'king'}),false);
  assert.equal(a.action(2,{type:'buy',uid:'ent',col:2,row:2}),true);
  const s = a.snapshot();
  assert.equal(s.players[0].ai,undefined);
  assert.equal(s.players[2].isHuman,true);
  assert.equal(s.players[2].gold,s.players[0].gold);
  assert.doesNotThrow(() => JSON.stringify(s));
});
test('four routes move toward the middle and leaked monsters turn toward their king', () => {
  const game = createGame([0,1,2,3].map(slot=>({slot,name:'P'+slot})));
  let sawTop=false,sawBottom=false,sawTurn=false,sawKing=false;
  for(let i=0;i<6000;i++) {
    game.step(.05);
    if(i%10) continue;
    const s=game.snapshot();
    for(const p of s.players) for(const e of p.enemies) {
      if(p.direction===1 && e.y>40) sawTop=true;
      if(p.direction===-1 && e.y<760) sawBottom=true;
      assert.ok(Number.isFinite(e.x)&&Number.isFinite(e.y));
    }
    for(const k of s.kings) for(const e of k.leaks) {
      if(e.turning) sawTurn=true;
      if(!e.turning && Math.abs(e.x-e.routeX)>10) sawKing=true;
    }
    if(sawTop&&sawBottom&&sawTurn&&sawKing) break;
  }
  assert.ok(sawTop&&sawBottom&&sawTurn&&sawKing);
});
test('upgrades, sales, mercenaries and king upgrades settle on the correct seat', () => {
  const game=createGame(humans);
  assert.equal(game.action(0,{type:'buy',uid:'ent',col:0,row:0}),true);
  assert.equal(game.action(2,{type:'sell',col:0,row:0}),false);
  assert.equal(game.action(0,{type:'upgrade',col:0,row:0}),true);
  assert.equal(game.snapshot().players[0].fighters[0].uid,'guardian');
  assert.equal(game.action(0,{type:'sell',col:0,row:0}),true);
  assert.equal(game.snapshot().players[0].gold,300);
  assert.equal(game.action(0,{type:'merc',mid:'imp',target:2}),true);
  assert.equal(game.snapshot().players[2].mercQueue[0],'imp');
  assert.equal(game.snapshot().players[0].income,7);
  assert.equal(game.action(0,{type:'king'}),true);
  assert.equal(game.snapshot().kings[0].lvl,1);
  assert.equal(game.snapshot().kings[1].lvl,0);
  assert.equal(game.snapshot().players[0].gold,195);
});
test('complete simulation remains serializable and produces a terminal result', () => {
  const game=createGame(humans);
  for(let i=0;i<100000 && game.snapshot().phase!=='over';i++) {
    game.step(.2);
    if(i%100===0) {
      const s=game.snapshot();
      for(const p of s.players) assert.ok(Number.isFinite(p.gold)&&p.gold>=0);
      assert.doesNotThrow(()=>JSON.stringify(s));
    }
  }
  assert.equal(game.snapshot().phase,'over');
  assert.ok([0,1].includes(game.snapshot().result.winner));
  assert.equal(!!game.action(0,{type:'king'}),false);
});
