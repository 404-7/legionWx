const { test } = require('node:test');
const assert = require('node:assert/strict');
const { server, rooms } = require('../server/index.cjs');
test('two independent clients join, share authoritative purchases, reconnect and forfeit', async t => {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
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
  const a=(await post('create',{name:'Host'})).data;
  assert.equal((await post('start',{},a)).status,400);
  const b=(await post('join',{code:a.code,name:'Guest'})).data;
  const sa=await stream(a),sb=await stream(b);
  assert.equal((await post('start',{},b)).status,403);
  assert.equal((await post('start',{},a)).status,200);
  assert.equal((await post('action',{type:'buy',uid:'golem',col:1,row:1,slot:2,gold:99999},a)).status,200);
  const [va,vb]=await Promise.all([sa.next(v=>v.state?.players[0].fighters.length===1),sb.next(v=>v.state?.players[0].fighters.length===1)]);
  assert.equal(va.state.players[0].gold,111);
  assert.equal(vb.state.players[0].gold,111);
  assert.equal(vb.state.players[2].fighters.length,0);
  assert.equal((await post('action',{type:'king'},{...b,token:'fake'})).status,401);
  sb.controller.abort();
  await sa.next(v=>v.room.waiting);
  const paused=rooms.get(a.code).game.snapshot().timer;
  await new Promise(r=>setTimeout(r,150));
  assert.equal(rooms.get(a.code).game.snapshot().timer,paused);
  const reconnected=await stream(b);
  await reconnected.next(v=>!v.room.waiting);
  assert.equal((await post('action',{type:'king'},b)).status,200);
  assert.equal((await fetch(base+'/server/index.cjs')).status,404);
  assert.equal((await fetch(base+'/healthz')).status,200);
  assert.equal((await post('leave',{},b)).status,200);
  const final=await sa.next(v=>v.state?.phase==='over');
  assert.equal(final.state.result.winner,0);
});
