const { test } = require('node:test');
const assert = require('node:assert/strict');
const createGame = require('../server/game.cjs');
const humans = [{ slot:0,name:'蓝方真人' }, { slot:2,name:'红方真人' }];
test('server owns economy, rejects malformed commands and isolates rooms', () => {
  const a = createGame(humans), b = createGame(humans);
  assert.equal(a.action(0,{type:'buy',uid:'golem',col:2,row:2}),true);
  assert.equal(a.snapshot().players[0].gold,111);
  assert.equal(b.snapshot().players[0].gold,156);
  for (const action of [
    {type:'buy',uid:'golem',col:2,row:2},
    {type:'buy',uid:'golem',col:NaN,row:1},
    {type:'buy',uid:'golem',col:6,row:0},
    {type:'buy',uid:'__proto__',col:0,row:0},
    {type:'merc',mid:'constructor',target:2},
    {type:'merc',mid:'imp',target:0},
    {type:'pause'}, {type:'speed',speed:10}
  ]) assert.equal(!!a.action(0,action),false);
  assert.equal(!!a.action(1,{type:'king'}),false);
  assert.equal(a.action(2,{type:'buy',uid:'golem',col:2,row:2}),true);
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
  assert.equal(game.action(0,{type:'buy',uid:'golem',col:0,row:0}),true);
  assert.equal(game.action(2,{type:'sell',col:0,row:0}),false);
  assert.equal(game.action(0,{type:'upgrade',col:0,row:0}),true);
  assert.equal(game.snapshot().players[0].fighters[0].uid,'rock_guard');
  assert.equal(game.action(0,{type:'sell',col:0,row:0}),true);
  assert.equal(game.snapshot().players[0].gold,156);
  assert.equal(game.action(0,{type:'merc',mid:'imp',target:2}),true);
  assert.equal(game.snapshot().players[2].mercQueue[0],'imp');
  assert.equal(game.snapshot().players[0].income,7);
  assert.equal(game.action(0,{type:'king'}),true);
  assert.equal(game.snapshot().kings[0].lvl,1);
  assert.equal(game.snapshot().kings[1].lvl,0);
  assert.equal(game.snapshot().players[0].gold,51);
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
