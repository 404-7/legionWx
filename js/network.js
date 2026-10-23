'use strict';
const Net = { session: null, stream: null, ended: false, busy: false,room:null,raceBusy:false,sync:null };
function hydrateBattleState341(state){
  for(const p of state.players){const entities=new Map();for(const key of ['towers','fighters'])p[key]=(p[key]||[]).map(f=>{if(typeof f.def==='string')f.def=UNITS[f.def];if(entities.has(f.entityId))return entities.get(f.entityId);entities.set(f.entityId,f);return f;});}
  return state;
}
function localPlayer() { return G.players[Net.session?.slot ?? 0]; }
function notice(message) {
  if ($('netMessage')) $('netMessage').textContent = message;
  $('connection').textContent = message;
}
async function api(route, data = {}) {
  const session = Net.session;
  const suffix = session ? '?room=' + encodeURIComponent(session.code) : '';
  const response = await fetch('/api/' + route + suffix, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: 'Bearer ' + session.token } : {}) }, body: JSON.stringify(data)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || '连接失败');
  return result;
}
function performAction(a) {
  if (Net.session) {
    api('action', a).catch(e => notice(e.message));
    return false;
  }
  const p = localPlayer(), f = p.towers.find(f => f.col === a.col && f.row === a.row);
  switch (a.type) {
    case 'chooseBuilder': return chooseBuilder341(p,a.race);
    case 'changeBuilder': return changeBuilder341(p);
    case 'rerollProphet': return rerollProphet341(p);
    case 'buy': return buyFighter(p,a.uid,a.col,a.row);
    case 'upgrade': return !!f && upgradeFighter(p,f,a.uid);
    case 'sell': return !!f && sellFighter(p,f);
    case 'steroids': return !!f && inject341Steroids(p,f);
    case 'king': return kingUpgrade(p, a.stat);
    case 'claimKing': return claimKing341(p);
    case 'royalHeal': return royalHeal341(p);
    case 'kingCommand': return kingCommand341(p,a);
    case 'farmUpgrade': return farmUpgrade341(p);
    case 'cancelFarm': return cancelFarm341(p);
    case 'cancelConstruction': return !!f&&cancelConstruction341(p,f);
    case 'worker': return buyWorker341(p);
    case 'lumberResearch': return researchLumber341(p);
    case 'merc': return sendMerc(p,G.players[a.target],a.mid);
  }
}
function renderRoomLobby(room){
  $('roomCode').textContent=room.code;
  $('roomMode').textContent='原版 3.41 · AP / HG / GG / MM / CB / x3';
  const mine=room.members.find(m=>m.slot===Net.session.slot);
  $('lobbyRaceChoice').hidden=room.raceMode!=='select'||room.started;
  $('playerRace').disabled=Net.raceBusy||room.started;
  if(!Net.raceBusy)$('playerRace').value=mine?.race||'';
  $('lobbyRaceHelp').textContent='4v4 八席 · AP 模式进入地图后选择建造者；空席位不刷怪。';
  $('roomSeats').replaceChildren(...[0,1,2,3,4,5,6,7].map(slot=>{
    const m=room.members.find(m=>m.slot===slot),item=document.createElement('div');item.className='seat '+(slot<4?'blue':'red');
    const race=room.races?.[slot]||m?.race;
    const faction=race?RACES[race].name:m?'进入地图选择':'空席位';
    item.textContent=(slot<4?'苍岚':'赤焰')+' · '+(m?m.name+(slot===Net.session.slot?'（你）':'')+(m.connected?' · 已连接':' · 等待重连'):'空席 · 不出怪')+' · '+faction;
    return item;
  }));
  $('startOnline').disabled=room.host!==Net.session.slot||room.members.length<2||room.waiting||!room.raceReady||room.started;
  $('startOnline').textContent=room.host!==Net.session.slot?'等待房主开始':!room.raceReady?'等待玩家选择种族':'开始对战';
}
function connectRoom(session) {
  Net.session = session; Net.ended = false;Net.sync=null;
  $('btnRestart').textContent = '离开对局';
  sessionStorage.setItem('legion-session',JSON.stringify(session));
  Net.stream?.close();
  $('lobby').hidden = false; $('soloOptions').hidden = true;
  $('onlineOptions').hidden = true;
  $('menuPanel').classList.add('in-lobby');
  document.querySelector('.mode-tabs').hidden = true;
  const query = new URLSearchParams({ room:session.code,token:session.token,sync:'1' });
  Net.stream = new EventSource('/api/events?' + query);
  Net.stream.onmessage = event => {
    let payload;
    try{Net.sync=Sync341.decode(Net.sync,JSON.parse(event.data));payload=structuredClone(Net.sync.value);}
    catch{Net.stream.close();notice('同步状态丢失 · 正在重新获取');setTimeout(()=>{if(Net.session===session&&!Net.ended)connectRoom(session);},250);return;}
    const { room, state } = payload;
    Net.room=room;renderRoomLobby(room);
    notice(room.waiting ? '玩家掉线 · 对局暂停，60 秒内可重连' : '在线 · 房间 ' + room.code);
    if (!state) return;
    const old = G;
    G = hydrateBattleState341(state);
    const me=localPlayer(),shop=old?.selectedShop,allowed=!me.race||(me.race==='prophet'?me.prophetDeck.includes(shop):UNITS[shop]?.race===me.race);
    G.selectedShop=allowed?shop:null;G.hover=old?.hover||null;
    G.selectedMine = old?.selectedMine ?? null;
    const selected = old?.selectedFighter;
    G.selectedFighter = selected ? [...localPlayer().fighters,...localPlayer().towers].find(f => f.col === selected.col && f.row === selected.row) : null;
    $('btnPause').disabled = true; $('btnSpeed').disabled = true;
    $('overlay').style.display = 'none';
    updateUI(true);
    if (G.phase === 'over' && !Net.ended) { Net.ended = true; Net.stream.close(); sessionStorage.removeItem('legion-session'); showOverlay('result'); }
    else if (Net.ended) $('overlay').style.display = 'flex';
  };
  Net.stream.onerror = async () => {
    notice('连接中断 · 正在重连，战斗已暂停');
    try {
      const r = await fetch('/healthz');
      if (r.ok) {
        const probe = await fetch('/api/events?' + query, { method: 'HEAD' });
        if (probe.status === 401) {
          Net.stream.close(); sessionStorage.removeItem('legion-session');
          notice('房间已过期，请刷新后重新创建或加入');
        }
      }
    } catch { /* EventSource retries automatically. */ }
  };
}
function bindLobby() {
  for(const [id,race] of Object.entries(RACES)){const option=document.createElement('option');option.value=id;option.textContent=race.icon+' '+race.name;option.title=race.desc;$('playerRace').appendChild(option);}
  $('playerRace').addEventListener('change',async()=>{
    Net.raceBusy=true;$('playerRace').disabled=true;
    try{await api('race',{race:$('playerRace').value});}catch(e){notice(e.message);}
    finally{Net.raceBusy=false;if(Net.room)renderRoomLobby(Net.room);}
  });
  const setMode = online => {
    $('onlineOptions').hidden = !online; $('soloOptions').hidden = online;
    $('modeSolo').classList.toggle('active',!online); $('modeOnline').classList.toggle('active',online);
  };
  $('modeSolo').onclick = () => setMode(false);
  $('modeOnline').onclick = () => setMode(true);
  const enter = async route => {
    if (Net.busy) return;
    if (!/^https?:$/.test(location.protocol)) { notice('在线模式需要通过服务器地址打开；单机可以直接运行。'); return; }
    Net.busy = true;
    try {
      const session = await api(route,{name:$('playerName').value,code:$('joinCode').value.trim().toUpperCase(),...(route==='create'?{raceMode:$('roomRaceMode').value}:{})});
      connectRoom(session);
    } catch(e) { notice(e.message); }
    finally { Net.busy = false; }
  };
  $('createRoom').onclick = () => enter('create');
  $('joinRoom').onclick = () => enter('join');
  $('startOnline').onclick = () => api('start').catch(e => notice(e.message));
  $('leaveRoom').onclick = async () => {
    await leaveOnline();
  };
  $('copyInvite').onclick = async () => {
    const url = new URL(location.href); url.search = ''; url.searchParams.set('room',Net.session.code);
    try { await navigator.clipboard.writeText(url.href); notice('邀请链接已复制'); }
    catch { notice('房间码：' + Net.session.code + ' · 分享当前网址和房间码即可'); }
  };
  const code = new URLSearchParams(location.search).get('room');
  if (code) { $('joinCode').value = code.slice(0,6).toUpperCase(); setMode(true); }
  try { const saved = JSON.parse(sessionStorage.getItem('legion-session')); if (saved) { setMode(true); connectRoom(saved); } } catch { sessionStorage.removeItem('legion-session'); }
}

async function leaveOnline() {
  // Stop incoming snapshots before the leave response can render a result panel.
  Net.stream?.close();
  try { await api('leave'); } catch { /* Rejoining remains possible until the grace period expires. */ }
  sessionStorage.removeItem('legion-session'); location.href = location.pathname;
}
