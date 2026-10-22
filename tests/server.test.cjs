const { test } = require('node:test');
const assert = require('node:assert/strict');
const { server, rooms } = require('../server/index.cjs');
test('two independent clients join, share authoritative purchases, reconnect and forfeit', async t => {
  await require('../scripts/test-server.cjs')(server);
  const base='http://127.0.0.1:'+server.address().port;
  const controllers=[];
  t.after(async()=>{ controllers.forEach(c=>c.abort()); server.closeAllConnections(); await new Promise(r=>server.close(r)); });
  async function post(route,data,seat) {
    const r=await fetch(base+'/api/'+route+(seat?'?room='+seat.code:''),{method:'POST',headers:{'Content-Type':'application/json',...(seat?{Authorization:'Bearer '+seat.token}:{})},body:JSON.stringify(data)});
    return {status:r.status,data:await r.json()};
  }
  async function stream(seat) {
    const controller=new AbortController(); controllers.push(controller);
    const r=await fetch(base+'/api/events?'+new URLSearchParams({room:seat.code,token:seat.token}),{signal:controller.signal});
    assert.equal(r.status,200);
    const reader=r.body.getReader(); let buffer='';
    return {controller, async next(predicate=()=>true) {
      const deadline=Date.now()+4000;
      while(Date.now()<deadline) {
        const {value,done}=await reader.read(); if(done) throw Error('stream ended');
        buffer+=new TextDecoder().decode(value);
        let end;
        while((end=buffer.indexOf('\n\n'))>=0) {
          const line=buffer.slice(0,end);buffer=buffer.slice(end+2);
          if(line.startsWith('data: ')){const data=JSON.parse(line.slice(6)); if(predicate(data))return data;}
        }
      }
      throw Error('snapshot timeout');
    }};
  }
  assert.equal((await post('create',{raceMode:'invalid'})).status,400);
  const a=(await post('create',{name:'Host',raceMode:'select'})).data;
  assert.equal((await post('start',{},a)).status,400);
  assert.equal((await post('race',{race:'__proto__'},a)).status,400);
  const b=(await post('join',{code:a.code,name:'Guest'})).data;
  const sa=await stream(a),sb=await stream(b);
  assert.equal((await post('start',{},a)).status,400);
  assert.equal((await post('race',{race:'nature'},a)).status,200);
  assert.equal((await post('race',{race:'nature'},b)).status,200);
  assert.equal((await post('start',{},b)).status,403);
  assert.equal((await post('start',{},a)).status,200);
  assert.equal((await post('race',{race:'mech'},a)).status,400);
  assert.equal((await post('action',{type:'buy',uid:'infantry',col:0,row:0,race:'mech'},a)).status,400);
  assert.equal((await post('action',{type:'buy',uid:'ent',col:1,row:1,slot:2,gold:99999},a)).status,200);
  const [va,vb]=await Promise.all([sa.next(v=>v.state?.players[0].fighters.length===1),sb.next(v=>v.state?.vision?.team===1)]);
  assert.equal(va.state.players[0].gold,280);
  assert.equal(vb.state.players[0].gold,null);assert.equal(vb.state.players[0].fighters.length,0);
  assert.equal(vb.state.players[2].fighters.length,0);
  assert.equal((await post('action',{type:'mineBuy',slot:2,gold:99999},a)).status,200);
  const [ma,mb]=await Promise.all([sa.next(v=>v.state?.players[0].mines.length===1),sb.next(v=>v.state?.vision?.team===1)]);
  assert.equal(ma.state.players[0].gold,180); assert.equal(mb.state.players[0].gold,null);assert.equal(mb.state.players[0].mines.length,0);
  assert.equal(mb.state.players[2].mines.length,0);
  assert.equal((await post('action',{type:'mineUpgrade',id:0},b)).status,400);
  assert.equal((await post('action',{type:'mineUpgrade',id:99},a)).status,400);
  assert.equal((await post('action',{type:'king'},{...b,token:'fake'})).status,401);
  sb.controller.abort();
  await sa.next(v=>v.room.waiting);
  const paused=rooms.get(a.code).game.snapshot().timer;
  const mineTime=rooms.get(a.code).game.snapshot().players[0].mines[0].elapsed;
  await new Promise(r=>setTimeout(r,150));
  assert.equal(rooms.get(a.code).game.snapshot().timer,paused);
  assert.equal(rooms.get(a.code).game.snapshot().players[0].mines[0].elapsed,mineTime);
  const reconnected=await stream(b);
  await reconnected.next(v=>!v.room.waiting);
  assert.equal((await post('action',{type:'king',stat:'regen'},b)).status,200);
  const upgraded = await sa.next(v=>v.state?.kings[1].upgrades.regen===1);
  assert.equal(upgraded.state.kings[1].regen,3);
  assert.equal(upgraded.state.kings[0].regen,2);
  assert.equal((await post('action',{type:'king',stat:'invalid'},b)).status,400);
  assert.equal((await fetch(base+'/server/index.cjs')).status,404);
  const art=await fetch(base+'/assets/unit-art/classic/human-units-animations-footman.png');
  assert.equal(art.status,200);assert.equal(art.headers.get('content-type'),'image/png');
  assert.equal(Buffer.from(await art.arrayBuffer()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal((await fetch(base+'/assets/unit-art/classic-sources.json')).status,404);
  assert.equal((await fetch(base+'/healthz')).status,200);
  assert.equal((await post('leave',{},b)).status,200);
  const final=await sa.next(v=>v.state?.phase==='over');
  assert.equal(final.state.result.winner,0);
  const randomA=(await post('create',{name:'RandomHost',raceMode:'random'})).data;
  const randomB=(await post('join',{name:'RandomGuest',code:randomA.code,raceMode:'select',race:'nature'})).data;
  const rsa=await stream(randomA),rsb=await stream(randomB);
  const pending=await rsa.next(v=>v.room.members.length===2);
  assert.equal(pending.room.raceMode,'random');assert.equal(pending.room.races,null);
  assert.equal((await post('race',{race:'nature'},randomB)).status,400);
  assert.equal((await post('start',{},randomA)).status,200);
  const [ra,rb]=await Promise.all([rsa.next(v=>!!v.state),rsb.next(v=>!!v.state)]);
  assert.equal(ra.state.raceMode,'random');
  assert.deepEqual(ra.state.players.map(p=>p.race),rb.state.players.map(p=>p.race));
  assert.equal(ra.state.players.every(p=>require('../server/game.cjs').raceKeys.includes(p.race)),true);
  const raceBefore=rb.state.players[2].race;rsb.controller.abort();await rsa.next(v=>v.room.waiting);
  const randomReconnect=await stream(randomB);const recovered=await randomReconnect.next(v=>!!v.state&&!v.room.waiting);
  assert.equal(recovered.state.players[2].race,raceBefore);
});
