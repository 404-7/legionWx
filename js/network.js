'use strict';
const Net = { session: null, stream: null, ended: false, busy: false };
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
  const p = localPlayer(), f = p.fighters.find(f => !f.temporary && f.col === a.col && f.row === a.row);
  switch (a.type) {
    case 'buy': return buyFighter(p,a.uid,a.col,a.row);
    case 'upgrade': return !!f && upgradeFighter(p,f,a.uid);
    case 'sell': return !!f && sellFighter(p,f);
    case 'steroids': return !!f && inject341Steroids(p,f);
    case 'king': return kingUpgrade(p, a.stat);
    case 'mineBuy': return buyMine(p);
    case 'mineUpgrade': return upgradeMine(p, a.id);
    case 'merc': return sendMerc(p,G.players[a.target],a.mid);
  }
}
function connectRoom(session) {
  Net.session = session; Net.ended = false;
  $('btnRestart').textContent = '离开对局';
  sessionStorage.setItem('legion-session',JSON.stringify(session));
  Net.stream?.close();
  $('lobby').hidden = false; $('soloOptions').hidden = true;
  $('onlineOptions').hidden = true;
  document.querySelector('.mode-tabs').hidden = true;
  const query = new URLSearchParams({ room:session.code,token:session.token });
  Net.stream = new EventSource('/api/events?' + query);
  Net.stream.onmessage = event => {
    const { room, state } = JSON.parse(event.data);
    $('roomCode').textContent = room.code;
    $('roomSeats').replaceChildren(...[0,1,2,3].map(slot => {
      const m = room.members.find(m => m.slot === slot), item = document.createElement('div');
      item.className = 'seat ' + (slot < 2 ? 'blue' : 'red');
      item.textContent = (slot < 2 ? '苍岚' : '赤焰') + ' · ' + (m ? m.name + (slot === session.slot ? '（你）' : '') + (m.connected ? ' · 已连接' : ' · 等待重连') : 'AI 补位');
      return item;
    }));
    $('startOnline').disabled = room.host !== session.slot || room.members.length < 2 || room.waiting;
    $('startOnline').textContent = room.host === session.slot ? '开始对战' : '等待房主开始';
    notice(room.waiting ? '玩家掉线 · 对局暂停，60 秒内可重连' : '在线 · 房间 ' + room.code);
    if (!state) return;
    const old = G;
    G = state;
    G.selectedShop = old?.selectedShop || null; G.hover = old?.hover || null;
    G.selectedMine = old?.selectedMine ?? null;
    const selected = old?.selectedFighter;
    G.selectedFighter = selected ? localPlayer().fighters.find(f => f.col === selected.col && f.row === selected.row) : null;
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
      const session = await api(route,{name:$('playerName').value,code:$('joinCode').value.trim().toUpperCase()});
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
