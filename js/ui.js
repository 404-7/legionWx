'use strict';
/* ===== UI：商店 / 波次预览 / 选中单位 / 国王 / 雇佣兵 / 日志 / 弹窗 ===== */
const $ = id => document.getElementById(id);
const SHOP_ORDER = Object.keys(RACES);
let shopRace = SHOP_ORDER[0];

function buildShop() {
  const root = $('shop');
  root.innerHTML = '';
  const tabs = document.createElement('div'); tabs.className = 'race-tabs';
  tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','兵种种族');
  for (const id of SHOP_ORDER) {
    const button = document.createElement('button'); button.className='btn race-tab';
    button.textContent=RACES[id].icon+' '+RACES[id].name; button.dataset.race=id;
    button.classList.toggle('active',shopRace===id); button.setAttribute('aria-pressed',String(shopRace===id));
    button.addEventListener('click',()=>{shopRace=id;if(G)selectShop(null);buildShop();if(G)updateUI(true);});tabs.appendChild(button);
  }
  root.appendChild(tabs);
  for (const race of SHOP_ORDER.filter(id=>id===shopRace)) {
    const group = document.createElement('div');
    group.className = 'raceGroup';
    group.style.gridColumn = '1 / -1';
    group.innerHTML = `<div class="race-title" style="color:${RACES[race].color}">${RACES[race].icon} ${RACES[race].name}军团</div><p class="race-desc">${RACES[race].desc}</p><p class="race-tip">${RACES[race].tip}</p>`;
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = '1fr 1fr';
    grid.style.gap = '6px';
    for (const [uid, def] of Object.entries(UNITS)) {
      if (def.race !== race || !isBaseUnit(uid)) continue;
      const card = document.createElement('div');
      card.className = 'ucard';
      card.dataset.uid = uid;
      card.setAttribute('role','button'); card.tabIndex=0;
      card.setAttribute('aria-label',def.name+'，'+def.role+'，'+def.cost+' 金');
      card.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();selectShop(uid);}});
      const portrait = document.createElement('canvas');
      portrait.className = 'portrait';
      portrait.width = 46; portrait.height = 46;
      drawPortrait(portrait, uid, 46);
      const body = document.createElement('div');
      body.className = 'uBody';
      body.innerHTML = `
        <div class="uName"><span>${def.name}</span><span class="cost">${def.cost}</span></div>
        <div class="uRole">${def.role} · T${def.tier}</div><div class="uStats">❤${def.hp} ⚔${def.dmg} ${def.range > 50 ? '远程' : '近战'}</div>
        <div class="uTags">
          <span class="chip atk">${def.atk}</span><span class="chip armor">${def.armor}</span>
          ${abilDesc(def) ? `<span class="chip abil">${abilDesc(def)}</span>` : ''}<span class="upgrade-path">→ ${UNITS[def.up].name} · 升级 ${UNITS[def.up].cost-def.cost} 金</span>
        </div>`;
      card.appendChild(portrait);
      card.appendChild(body);
      card.addEventListener('click', () => selectShop(uid));
      grid.appendChild(card);
    }
    group.appendChild(grid);
    root.appendChild(group);
  }
}

function isBaseUnit(uid) {
  // 商店只卖基础兵种：没有任何单位的升级目标指向它
  return !Object.values(UNITS).some(d => d.up === uid);
}

function buildMercs() {
  const root = $('mercs');
  root.innerHTML = '';
  for (const [mid, m] of Object.entries(MERCS)) {
    const row = document.createElement('div');
    row.className = 'mrow';
    const portrait = document.createElement('canvas');
    portrait.className = 'mPortrait';
    portrait.width = 36; portrait.height = 36;
    drawPortrait(portrait, 'm_' + mid, 36);
    row.appendChild(portrait);
    const info = document.createElement('div');
    info.className = 'mname';
    info.innerHTML = `<b>${m.name}</b><br><span class="mcost">${m.cost}金</span> <span class="minc">+${m.income}收入</span>`;
    row.appendChild(info);
    const b1 = document.createElement('button');
    b1.className = 'btn'; b1.textContent = '敌军 Ⅰ'; b1.dataset.enemy = '0';
    const b2 = document.createElement('button');
    b2.className = 'btn'; b2.textContent = '敌军 Ⅱ'; b2.dataset.enemy = '1';
    [b1, b2].forEach(btn => {
      btn.addEventListener('click', () => {
        if (!G || G.phase === 'over' || G.phase === 'menu') return;
        const tgt = G.players.filter(p => p.team !== localPlayer().team)[+btn.dataset.enemy];
        performAction({ type:'merc', target:tgt.id, mid });
        updateUI(true);
      });
      row.appendChild(btn);
    });
    root.appendChild(row);
  }
}

function selectShop(uid) {
  if (!G) return;
  G.selectedShop = (G.selectedShop === uid) ? null : uid;
  G.selectedFighter = null;
  document.getElementById('cv').classList.toggle('placing', !!G.selectedShop);
  updateUI(true);
}

function buildAtkTable() {
  let html = '<table><tr><th>攻击 \\ 护甲</th>';
  for (const a of ARMOR_TYPES) html += `<th>${a}</th>`;
  html += '</tr>';
  for (const atk of ATK_TYPES) {
    html += `<tr><td class="rowh">${atk}</td>`;
    for (const ar of ARMOR_TYPES) {
      const v = ATK_ARMOR[atk][ar];
      const cls = v > 1.05 ? 'good' : v < 0.95 ? 'bad' : '';
      html += `<td class="${cls}">${(v * 100).toFixed(0)}%</td>`;
    }
    html += '</tr>';
  }
  $('atkTable').innerHTML = html + '</table>';
  $('traitList').innerHTML = Object.entries(TRAIT_INFO)
    .map(([k, t]) => `<div class="traitItem"><b>${t.n}</b>：${t.d}</div>`).join('');
}

/* ---------- 周期刷新 ---------- */
function updateUI(force) {
  if (!G) return;
  const me = localPlayer();
  updateMines(me);
  $('stGold').textContent = Math.floor(me.gold);
  $('stIncome').textContent = me.income;
  $('stValue').textContent = playerValue(me);
  $('stWave').textContent = (G.wave > CFG.TOTAL_WAVES ? `加时赛 第${G.wave}波` : `第 ${G.wave} / ${CFG.TOTAL_WAVES} 波`) +
    (G.phase === 'prep' ? ` · 准备 ${Math.ceil(G.timer)}s` : G.phase === 'combat' ? ' · 战斗中' : '');

  // 波次预告
  const wi = $('waveInfo');
  const d = G.waveDef;
  if (d && G.phase !== 'over') {
    const traitTxt = d.trait ? `<span class="chip trait">${TRAIT_INFO[d.trait].n}</span>` : '';
    const incoming = me.mercQueue.length
      ? `<div class="mercWarn">⚠ 敌方已向你雇佣 ${me.mercQueue.length} 个单位（随下一波来袭）</div>` : '';
    wi.innerHTML = `
      <div class="wrow">
        <span class="wnum">${G.wave > CFG.TOTAL_WAVES ? '加时 ' : ''}第 ${G.wave} 波</span>
        <span class="wtime">${G.phase === 'prep' ? Math.ceil(G.timer) + 's 后来袭' : '⚔ 战斗中'}</span>
      </div>
      <div>
        <span class="chip count">×${d.count}</span>
        <span class="chip hp">❤${d.hp}</span>
        <span class="chip dmg">⚔${d.dmg}</span>
        <span class="chip">${d.atk}攻击</span>
        <span class="chip">${d.armor}</span>
        <span class="chip">${d.range > 50 ? '远程' : '近战'}</span>
        ${traitTxt}
      </div>${incoming}`;
  }

  // 商店可用性
  document.querySelectorAll('.ucard').forEach(card => {
    card.classList.toggle('poor', me.gold < UNITS[card.dataset.uid].cost);
    card.classList.toggle('sel', G.selectedShop === card.dataset.uid);
  });

  // 选中单位
  const sb = $('selBox');
  if (G.selectedFighter) {
    const f = G.selectedFighter;
    if (f.hp <= 0 && f.deadT <= 0) { G.selectedFighter = null; sb.style.display = 'none'; delete sb.dataset.signature; }
    else {
      sb.style.display = '';
      const def = f.def;
      const upDef = def.up ? UNITS[def.up] : null;
      const upCost = upDef ? upDef.cost - def.cost : 0;
      const signature = [f.uid,f.col,f.row,f.spent].join('|');
      if (sb.dataset.signature !== signature) {
      sb.dataset.signature = signature;
      $('selInfo').innerHTML = `
        <div class="selHead">
          <canvas id="selPortrait" width="64" height="64"></canvas>
          <div>
            <div class="sName">${def.name} <span style="color:${RACES[def.race].color}">◆${RACES[def.race].name}</span></div>
            <div class="sStats" id="selLiveStats"></div>
            <div>${def.atk}攻击 · ${def.armor}</div>
          </div>
        </div>
        <div class="sStats">${abilDesc(def) || '无特殊能力'}<br>已投入 ${f.spent} 金（卖出全额返还）</div>
        <div class="btnRow">
          <button class="btn" id="btnUp" ${upDef ? '' : 'disabled'}>${upDef ? `升级→${upDef.name} (${upCost}金)` : '无法升级'}</button>
          <button class="btn" id="btnSell">卖出 +${f.spent}金</button>
        </div>`;
      drawPortrait(document.getElementById('selPortrait'), f.uid, 64);
      const bu = $('btnUp');
      if (upDef) {
        bu.disabled = me.gold < upCost;
        bu.addEventListener('click', () => { performAction({ type:'upgrade', col:f.col, row:f.row }); updateUI(true); });
      }
      $('btnSell').addEventListener('click', () => { performAction({ type:'sell', col:f.col, row:f.row }); updateUI(true); });
      }
      $('selLiveStats').textContent = `❤ ${Math.ceil(f.hp)}/${def.hp} · ⚔ ${Math.round(f.effDmg)} · ${def.range > 50 ? '远程' : '近战'}`;
      $('btnUp').disabled = !upDef || me.gold < upCost || G.phase === 'over';
      $('btnSell').disabled = G.phase === 'over';
    }
  } else { sb.style.display = 'none'; delete sb.dataset.signature; }

  // 国王
  const k = G.kings[me.team];
  $('kingBox').querySelector('h3').textContent = me.team === 0 ? '♛ 苍岚国王' : '♛ 赤焰国王';
  const kPort = document.getElementById('kingPortrait');
  if (kPort) drawPortrait(kPort, 'king_' + me.team, 52);
  $('kingInfo').innerHTML = `
    <div class="hpbarWrap"><div class="hpbarFill ${k.hp / k.max < 0.35 ? 'low' : ''}" style="width:${Math.max(0, k.hp / k.max * 100)}%"></div></div>
    HP ${Math.ceil(k.hp)}/${k.max} · 攻击 ${k.dmg} · 恢复 ${k.regen}/秒<br>
    三项独立升级，队友共享；每次强化个人收入 +2`;
  document.querySelectorAll('[data-king-stat]').forEach(button => {
    const stat = button.dataset.kingStat, def = KING_UPGRADES[stat];
    const cost = kingUpgradeCost(k, stat);
    button.innerHTML = `${def.name} Lv.${k.upgrades[stat]} → ${k.upgrades[stat] + 1} · ${cost} 金<small>${def.effect}</small>`;
    button.title = def.effect + '；个人收入 +2';
    button.disabled = me.gold < cost || G.phase === 'over';
  });

  // 雇佣兵可用性
  document.querySelectorAll('.mrow').forEach(row => {
    const name = row.querySelector('.mcost').textContent.replace('金', '');
    row.querySelectorAll('button').forEach(b => b.disabled = me.gold < +name || G.phase === 'over');
  });

  // 日志
  const lg = $('log');
  const lines = G.logLines.slice(-5);
  if (lg.dataset.sig !== lines.map(l => l.txt).join('|')) {
    lg.dataset.sig = lines.map(l => l.txt).join('|');
    lg.innerHTML = lines.map(l => `<div class="${l.cls}">${l.txt}</div>`).join('');
  }
}

function updateMines(me) {
  const total = me.mines.reduce((sum,m) => sum + MINE.LEVELS[m.level-1].gold,0);
  $('mineInfo').textContent = `已建 ${me.mines.length}/${MINE.LIMIT} · 合计 ${total} 金 / 5 秒`;
  const buy = $('btnMineBuy');
  buy.textContent = me.mines.length >= MINE.LIMIT ? '金矿已达上限（6/6）' : `购买金矿 · ${MINE.COST} 金`;
  buy.disabled = me.gold < MINE.COST || me.mines.length >= MINE.LIMIT || G.phase === 'over';
  const list = $('mineList'), signature = me.mines.map(m=>`${m.id}:${m.level}`).join('|');
  if (list.dataset.signature !== signature) {
    list.dataset.signature = signature;
    list.innerHTML = me.mines.map(m=>{
      const def = MINE.LEVELS[m.level-1], next = MINE.LEVELS[m.level];
      return `<div class="mine-row" data-mine-id="${m.id}"><div><b>◆ ${m.id+1} 号金矿 · Lv.${m.level}</b><small>${def.gold} 金 / 5 秒 <span data-mine-time="${m.id}"></span></small></div><button class="btn" data-mine-upgrade="${m.id}" title="${next ? `升级后 ${next.gold} 金 / 5 秒` : '已达最高等级'}">${next ? `升级 ${def.upgrade} 金` : '已满级'}</button></div>`;
    }).join('');
  }
  list.querySelectorAll('[data-mine-id]').forEach(row=>{
    const mine = me.mines[+row.dataset.mineId], def = MINE.LEVELS[mine.level-1];
    row.classList.toggle('selected',G.selectedMine === mine.id);
    row.querySelector('[data-mine-time]').textContent = `· ${Math.ceil(MINE.INTERVAL-mine.elapsed)}s`;
    row.querySelector('button').disabled = def.upgrade === null || me.gold < def.upgrade || G.phase === 'over';
  });
}

/* ---------- 弹窗 ---------- */
function showOverlay(mode) {
  const ov = $('overlay');
  if (mode === 'menu') {
    ov.style.display = 'flex';
    ov.innerHTML = `<div class="panel" id="menuPanel"></div>`;
  } else if (mode === 'result') {
    const win = G.result.winner === localPlayer().team;
    const k0 = G.kings[0], k1 = G.kings[1];
    ov.style.display = 'flex';
    ov.innerHTML = `
      <div class="panel" style="text-align:center">
        <h1 style="font-size:42px;color:${win ? 'var(--green)' : 'var(--red)'}">${win ? '🏆 胜利！' : '💀 战败'}</h1>
        <p class="tagline">${win ? '你的军团守住了王城！' : '你的国王倒下了……'}</p>
        <div style="font-size:14px;line-height:2;color:#c3d2e8">
          坚守波次：<b>${G.wave}</b><br>
          蓝方国王剩余：<b style="color:var(--blue)">${Math.max(0, Math.ceil(k0.hp))}</b> ·
          红方国王剩余：<b style="color:var(--red)">${Math.max(0, Math.ceil(k1.hp))}</b><br>
          你的战力：<b>${playerValue(localPlayer())}</b> · 收入：<b>${localPlayer().income}</b>
        </div>
        <div class="diffRow">
          <button class="btn" onclick="location.reload()">🔄 再来一局</button>
        </div>
      </div>`;
  }
}

/* ---------- 画布交互 ---------- */
function canvasPos(e) {
  const cv = e.target;
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) * CFG.W / r.width, y: (e.clientY - r.top) * CFG.H / r.height };
}

function fieldCellAt(p, x, y) {
  const col = Math.floor((x - p.gx) / CFG.CELL), row = Math.floor((y - p.gy) / CFG.CELL);
  if (col < 0 || col >= CFG.COLS || row < 0 || row >= CFG.ROWS) return null;
  return { col, row };
}

function bindEvents() {
  const cv = $('cv');

  cv.addEventListener('mousemove', e => {
    if (!G) return;
    const me = localPlayer();
    const pos = canvasPos(e);
    const cell = fieldCellAt(me, pos.x, pos.y);
    if (!cell) { G.hover = null; return; }
    const def = G.selectedShop ? UNITS[G.selectedShop] : null;
    cell.valid = def ? me.gold >= def.cost && cellFree(me, cell.col, cell.row) : false;
    G.hover = cell;
  });

  cv.addEventListener('mouseleave', () => { if (G) G.hover = null; });

  cv.addEventListener('click', e => {
    if (!G || G.phase === 'over' || G.phase === 'menu') return;
    const me = localPlayer();
    const pos = canvasPos(e);
    const cell = fieldCellAt(me, pos.x, pos.y);
    const mine = me.mines.find(m => { const at = minePosition(me,m.id); return Math.abs(pos.x-at.x)<=23 && Math.abs(pos.y-at.y)<=27; });
    if (mine) {
      G.selectedMine = mine.id; G.selectedShop = null; G.selectedFighter = null;
      cv.classList.remove('placing');
      $('mineBox').scrollIntoView({block:'nearest'}); updateUI(true); return;
    }
    if (G.selectedShop) {
      if (cell && performAction({ type:'buy', uid:G.selectedShop, col:cell.col, row:cell.row })) {
        if (me.gold < UNITS[G.selectedShop].cost) selectShop(null);
      }
      updateUI(true);
      return;
    }
    // 选中己方战士
    if (cell) {
      const f = me.fighters.find(f => f.col === cell.col && f.row === cell.row && f.deadT <= 0);
      G.selectedFighter = f || null;
      updateUI(true);
    }
  });

  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (G && G.selectedShop) selectShop(null);
  });

  $('btnMineBuy').addEventListener('click', () => {
    if (!G || G.phase === 'over') return;
    performAction({type:'mineBuy'}); updateUI(true);
  });
  $('mineList').addEventListener('click', event => {
    if (!G || G.phase === 'over') return;
    const row = event.target.closest('[data-mine-id]');
    if (!row) return;
    G.selectedMine = +row.dataset.mineId;
    if (event.target.closest('[data-mine-upgrade]')) performAction({type:'mineUpgrade',id:G.selectedMine});
    updateUI(true);
  });

  document.querySelectorAll('[data-king-stat]').forEach(button => {
    button.addEventListener('click', () => {
      if (!G || G.phase === 'over') return;
      performAction({ type:'king', stat:button.dataset.kingStat });
      updateUI(true);
    });
  });
  $('btnPause').addEventListener('click', togglePause);
  $('btnSpeed').addEventListener('click', cycleSpeed);
  $('btnHelp').addEventListener('click', () => { $('modal').style.display = 'flex'; });
  $('btnRestart').addEventListener('click', () => Net.session ? leaveOnline() : location.reload());

  document.addEventListener('keydown', e => {
    if (!G || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'Space') { e.preventDefault(); togglePause(); }
    if (e.key === '1') setSpeed(1);
    if (e.key === '2') setSpeed(2);
    if (e.key === '3') setSpeed(3);
    if (e.key === 'Escape') selectShop(null);
  });
}

function togglePause() {
  if (!G || G.phase === 'over' || Net.session) return;
  G.paused = !G.paused;
  $('btnPause').textContent = G.paused ? '▶ 继续' : '⏸ 暂停';
  $('btnPause').classList.toggle('active', G.paused);
}
function cycleSpeed() { if (G) setSpeed(G.speed >= 3 ? 1 : G.speed + 1); }
function setSpeed(s) {
  if (!G || Net.session) return;
  G.speed = s;
  $('btnSpeed').textContent = `▶ ${s}x`;
  $('btnSpeed').classList.toggle('active', s > 1);
}
