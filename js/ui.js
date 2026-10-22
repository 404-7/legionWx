'use strict';
/* ===== UI：商店 / 波次预览 / 选中单位 / 国王 / 雇佣兵 / 日志 / 弹窗 ===== */
const $ = id => document.getElementById(id);
const MineUI={slot:null,pending:null,error:''};
const KingUI={open:false,pending:null,error:''};
function openKingDialog(){
  if(!G||!['prep','combat'].includes(G.phase))return;
  KingUI.open=true;KingUI.pending=null;KingUI.error='';
  G.selectedFighter=null;selectShop(null);closeCommandPanel();
  drawPortrait($('kingPortrait'),'king_'+localPlayer().team,96);
  updateKingUI(localPlayer());$('kingDialog').showModal();updateUI(true);
}
function updateKingUI(me){
  const active=['prep','combat'].includes(G.phase);
  for(const [team,id] of ['blueKingStatus','redKingStatus'].entries()){
    $(id).disabled=team!==me.team||!active;
    $(id).title=team===me.team?'点击强化己方国王':'敌方国王';
  }
  if(!KingUI.open)return;
  if(!active){$('kingDialog').close();return;}
  const k=G.kings[me.team],pending=KingUI.pending;
  if(pending&&k.upgrades[pending.stat]>=pending.level)KingUI.pending=null;
  $('kingDialogTitle').textContent=(me.team===0?'苍岚':'赤焰')+'国王 · Lv.'+k.lvl;
  const royal=kingAura341(me.team,k);
  $('kingInfo').innerHTML=`<div class="hpbarWrap"><div class="hpbarFill ${k.hp/k.max<.35?'low':''}" style="width:${Math.max(0,k.hp/k.max*100)}%"></div></div><div class="king-live-stats"><b>生命 ${Math.ceil(k.hp)}/${k.max}</b><span>攻击 ${k.min}–${k.maxDamage}${royal.damage?'（+15%）':''} · 恢复 ${k.regen}/秒</span><span>英雄攻击 / 英雄甲 ${k.armorPoints+royal.armor} · 间隔 ${kingInterval341(k).toFixed(2)} 秒</span><span>射程 715 · 法力 ${Math.floor(k.mana)}/${k.manaMax}（+3/秒）</span></div>`;
  document.querySelectorAll('[data-king-stat]').forEach(button=>{
    const stat=button.dataset.kingStat,def=KING_UPGRADES[stat],cost=kingUpgradeCost(k,stat);
    const amount=def.amounts?.[k.upgrades[stat]]??def.amount,maxed=!Number.isFinite(cost);
    const effect=stat==='health'?`生命上限 +${amount}，恢复 ${amount} 生命`:stat==='attack'?`攻击力 +${amount}`:`每秒恢复 +${amount} 生命`;
    button.innerHTML=`<b>强化${def.name}</b><span>Lv.${k.upgrades[stat]} / ${def.limit}</span><strong>${maxed?'已满级':cost+' 金'}</strong><small>${maxed?'已达到原版强化上限':effect}</small>`;
    button.disabled=maxed||!!KingUI.pending||me.gold<cost;
  });
  const skillsMarkup=SOURCE341.king.skills.map(s=>{
    const learned=k.skills.includes(s.id),random=s.wave===4;
    const text=s.id==='A022'?`范围 350，伤害 45，眩晕 1.25 秒；250 法力 / 9 秒冷却。`:
      s.id==='A01T'?'范围 350，每秒对地面敌军造成 12 法术伤害。':
      s.id==='A021'?'直线范围伤害 90；200 法力 / 22 秒冷却。':
      s.id==='A01W'?'范围 1400，友军和自身攻击伤害 +15%。':
      s.id==='A01U'?'范围 1400，友军和自身护甲 +5。':'范围 1400，友军和自身攻速 +10%、移速 +15%。';
    return `<div class="king-skill ${learned?'learned':''}"><b>${s.name}</b><span>${learned?(s.cd?'冷却 '+Math.ceil(k.spellCD[s.id]||0)+' 秒':'已获得'):G.wave>s.wave&&random?'本局未抽中':s.wave+' 波后'+(random?'三选一随机获得':'获得')}</span><p>${text}</p></div>`;
  }).join('');
  if($('kingSkills').innerHTML!==skillsMarkup)$('kingSkills').innerHTML=skillsMarkup;
  $('kingDialogStatus').textContent=KingUI.error||(KingUI.pending?'正在提交，等待对局同步…':`持有 ${Math.floor(me.gold)} 金 · 当前每波收入 ${me.income}`);
}
async function submitKingUpgrade(stat){
  if(!KingUI.open||KingUI.pending||!Object.hasOwn(KING_UPGRADES,stat))return;
  const k=G.kings[localPlayer().team];if(localPlayer().gold<kingUpgradeCost(k,stat))return;
  const pending={stat,level:k.upgrades[stat]+1};KingUI.pending=pending;KingUI.error='';updateKingUI(localPlayer());
  try{if(Net.session)await api('action',{type:'king',stat});else if(!performAction({type:'king',stat}))throw new Error('强化未完成，请检查金币和对局状态');}
  catch(e){if(KingUI.pending===pending){KingUI.pending=null;KingUI.error=e.message;}}
  if(KingUI.open)updateUI(true);
}
const MercUI={mid:null};
function sendMercUI(mid,index){
  if(!G||!['prep','combat'].includes(G.phase))return;
  const target=G.players.filter(p=>p.team!==localPlayer().team)[index];
  if(target)performAction({type:'merc',target:target.id,mid});
  updateUI(true);
}
function openMercDetails(mid){
  const m=MERCS[mid];if(!m||!G||!['prep','combat'].includes(G.phase))return;MercUI.mid=mid;
  $('mercDetailName').textContent=m.name;$('mercDetailEnglish').textContent=m.english;
  drawPortrait($('mercDetailPortrait'),'m_'+mid,128);
  $('mercDetailIntro').textContent=`${m.description} 派往指定敌军防线，随下一波怪物来袭。花费 ${m.cost} 金，永久增加 ${m.income} 点每波收入。`;
  const stats=[['生命',m.hp],['攻击',`${m.min}–${m.max} · ${m.atk}`],['攻击间隔',m.aspd+' 秒'],['攻击距离',m.rawRange],['护甲',m.armor+' · '+m.armorPoints],['移动速度',m.rawSpeed],['生命恢复',m.regenFlat+' / 秒'],['法力 / 回蓝',m.manaMax+' / '+m.manaRegen+' 每秒']];
  $('mercDetailStats').innerHTML=stats.map(([label,value])=>`<div><small>${label}</small><b>${value}</b></div>`).join('');
  $('mercDetailSkills').innerHTML=m.skills.length?m.skills.map(s=>`<article><b>${escape341(s.name)}</b><p>${escape341(s.description)}</p></article>`).join(''):'<p class="merc-no-skill">无主动或光环技能，依靠普通攻击作战。</p>';
  updateMercUI(localPlayer());$('mercDialog').showModal();
}
function updateMercUI(me){
  const active=['prep','combat'].includes(G.phase),targets=G.players.filter(p=>p.team!==me.team);
  for(const row of document.querySelectorAll('[data-merc-id]')){
    const m=MERCS[row.dataset.mercId],locked=G.wave<m.unlockWave;
    row.classList.toggle('merc-locked',locked);
    row.querySelector('.merc-unlock').textContent=locked?`第 ${m.unlockWave} 波解锁`:'点击查看属性与技能';
    row.querySelectorAll('[data-merc-send]').forEach(b=>{b.disabled=!active||locked||me.gold<m.cost||!targets[+b.dataset.mercSend]||targets[+b.dataset.mercSend].mercQueue.length>=40;});
  }
  const m=MERCS[MercUI.mid];if(!m)return;
  if(!active){if($('mercDialog').open)$('mercDialog').close();return;}
  const locked=G.wave<m.unlockWave;
  $('mercDetailStatus').textContent=locked?`第 ${m.unlockWave} 波解锁 · 当前第 ${G.wave} 波`:me.gold<m.cost?`金币不足，还需 ${Math.ceil(m.cost-me.gold)} 金`:`${m.cost} 金 / 次 · 收入 +${m.income} · 当前 ${Math.floor(me.gold)} 金`;
  document.querySelectorAll('[data-merc-detail-send]').forEach(b=>{const target=targets[+b.dataset.mercDetailSend];b.disabled=locked||me.gold<m.cost||!target||target.mercQueue.length>=40;b.textContent=target?`派遣 → ${target.name} (${target.mercQueue.length}/40)`:'无目标';});
}
function mineAtSlot(p,slot){return p.mines.find(m=>(m.slot??m.id)===slot);}
function openMineDialog(slot){
  MineUI.slot=slot;MineUI.pending=null;MineUI.error='';
  G.selectedMine=mineAtSlot(localPlayer(),slot)?.id??null;
  G.selectedFighter=null;selectShop(null);closeCommandPanel();
  updateMines(localPlayer());$('mineDialog').showModal();updateUI(true);
}
async function submitMineAction(){
  if(MineUI.slot===null||MineUI.pending||$('btnMineAction').disabled)return;
  const mine=mineAtSlot(localPlayer(),MineUI.slot);
  const pending={slot:MineUI.slot,level:(mine?.level??0)+1};
  const action=mine?{type:'mineUpgrade',id:mine.id}:{type:'mineBuy',mineSlot:MineUI.slot};
  MineUI.pending=pending;MineUI.error='';updateMines(localPlayer());
  try{
    if(Net.session)await api('action',action);
    else if(!performAction(action))throw new Error('操作未完成，请检查金币和对局状态');
  }catch(e){if(MineUI.pending===pending){MineUI.pending=null;MineUI.error=e.message;}}
  if(MineUI.slot!==null)updateUI(true);
}
const SHOP_ORDER = Object.keys(RACES);
let shopRace = SHOP_ORDER[0], shopCatalog=false;
const escape341 = text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function source341Details(def) {
  const text=(def.abil.sources||[]).map(id=>{const a=ABILITIES341[id];return '<p><b>'+escape341(skillValue(a,'anam',id))+'</b> '+escape341(skillText(a))+(def.abil.pending.includes(id)?' <em>触发效果待移植</em>':'')+'</p>';}).join('');
  return '<details class="source-details"><summary>原版属性与技能</summary><div>'+(def.abil.refund?'当前出售统一按累计投入的 30% 向下取整，覆盖原版退款技能。<br>':'')+escape341(def.english)+' · 原表第 '+(def.sourceRow??'地图')+' 行<br>攻击 '+def.min+'–'+def.max+' / '+def.aspd+' 秒 · 表列 DPS '+Number(def.sourceDps).toFixed(2)+'<br>生命 '+def.hp+' · 护甲值 '+def.armorPoints+' · 原始射程 '+def.rawRange+' · 人口 '+(def.food??'—')+'<br>法力 '+def.manaStart+'/'+def.manaMax+' · 回蓝 '+def.manaRegen+'/秒<br>本级费用 '+(def.purchaseCost??'召唤物')+' · 表列总价 '+def.cost+text+'</div></details>';
}

function buildShop() {
  const root = $('shop');
  const locked=G?.online?localPlayer().race:null,races=locked?[locked]:SHOP_ORDER;
  if(!races.includes(shopRace))shopRace=races[0];
  root.dataset.raceScope=locked||'all';
  root.classList.toggle('catalog-view',shopCatalog);
  root.innerHTML = '';
  if(locked){const info=document.createElement('p');info.className='race-lock';info.textContent=(G.raceMode==='random'?'随机种族':'自选种族')+' · 本局锁定 '+RACES[locked].name+'军团';root.appendChild(info);}
  const tabs = document.createElement('div'); tabs.className = 'race-tabs';
  tabs.setAttribute('role','group'); tabs.setAttribute('aria-label','兵种种族');
  for (const id of races) {
    const button = document.createElement('button'); button.className='btn race-tab';
    button.textContent=RACES[id].icon+' '+RACES[id].name; button.dataset.race=id;
    button.classList.toggle('active',shopRace===id); button.setAttribute('aria-pressed',String(shopRace===id));
    button.addEventListener('click',()=>{shopRace=id;if(G)selectShop(null);buildShop();if(G)updateUI(true);});tabs.appendChild(button);
  }
  root.appendChild(tabs);
  const catalog=document.createElement('button');catalog.className='btn catalog-toggle';
  catalog.textContent=shopCatalog?'← 返回可建造基础兵种':'查看本族完整图鉴 · 含进阶与召唤物';
  catalog.addEventListener('click',()=>{shopCatalog=!shopCatalog;buildShop();if(G)updateUI(true);});root.appendChild(catalog);
  for (const race of SHOP_ORDER.filter(id=>id===shopRace)) {
    const group = document.createElement('div');
    group.className = 'raceGroup';
    group.style.gridColumn = '1 / -1';
    group.innerHTML = `<div class="race-title" style="color:${RACES[race].color}">${RACES[race].icon} ${RACES[race].name}军团</div><p class="race-desc">${RACES[race].desc}</p><p class="race-tip">${RACES[race].tip}</p>`;
    const grid = document.createElement('div');
    grid.className = 'unit-grid';
    for (const [uid, def] of Object.entries(UNITS)) {
      if (def.race !== race || (!shopCatalog && !isBaseUnit(uid)) || !def.sourceRow) continue;
      const card = document.createElement('div');
      card.className = 'ucard';
      card.dataset.uid = uid;
      card.setAttribute('role','button'); card.tabIndex=0;
      card.classList.toggle('catalog-only',!isBaseUnit(uid));
      card.setAttribute('aria-label',def.name+'，'+def.role+'，'+def.cost+' 金');
      card.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(isBaseUnit(uid))selectShop(uid);else card.querySelector('details').open=!card.querySelector('details').open;}});
      const portrait = document.createElement('canvas');
      portrait.className = 'portrait';
      portrait.width = 168; portrait.height = 168;
      drawPortrait(portrait, uid, 168);
      const body = document.createElement('div');
      body.className = 'uBody';
      body.innerHTML = `
        <div class="uName"><span>${def.name}</span><span class="cost">${def.cost}</span></div>
        <div class="uEnglish">${def.english}</div>
        <div class="uRole">${def.role} · T${def.tier}${def.summonOnly?' · 召唤物':def.elite?' · 进阶':''}</div><div class="uStats">❤${def.hp} ⚔${def.min}–${def.max} ${def.range > 50 ? '远程' : '近战'}</div>
        <div class="uTags">
          <span class="chip atk">${def.atk}</span><span class="chip armor">${def.armor}</span>
          ${abilDesc(def) ? `<span class="chip abil">${abilDesc(def)}</span>` : ''}${def.upgrades.map(id=>`<span class="upgrade-path">→ ${UNITS[id].name} · 升级 ${UNITS[id].purchaseCost} 金</span>`).join('')}
        </div>${source341Details(def)}`;
      card.appendChild(portrait);
      card.appendChild(body);
      card.addEventListener('click', event => {if(event.target.closest('details'))return;if(isBaseUnit(uid))selectShop(uid);else card.querySelector('details').open=!card.querySelector('details').open;});
      grid.appendChild(card);
    }
    group.appendChild(grid);
    root.appendChild(group);
  }
  const active=tabs.querySelector('.active');if(active)tabs.scrollLeft=Math.max(0,active.offsetLeft-tabs.clientWidth/2+active.clientWidth/2);
}

function isBaseUnit(uid) {
  return !!UNITS[uid] && !UNITS[uid].elite && !UNITS[uid].summonOnly;
}

function buildMercs() {
  const root = $('mercs');
  root.innerHTML = '<p class="merc-shop-hint">24 类进攻单位 · 点击卡片查看属性和技能<br>派遣增加每波收入，单位随下一波进攻指定敌军</p>';
  const groups=new Map();
  for(const wave of [1,10,15]){
    const section=document.createElement('section');section.className='merc-group';
    section.innerHTML=`<h4>${wave===1?'基础军团':wave===10?'进阶军团':'精锐军团'}<small>第 ${wave} 波开放</small></h4><div class="merc-grid"></div>`;
    root.appendChild(section);groups.set(wave,section.querySelector('.merc-grid'));
  }
  for (const [mid, m] of Object.entries(MERCS)) {
    const row = document.createElement('div');
    row.className = 'mrow merc-card';row.dataset.mercId=mid;
    const detail=document.createElement('button');detail.className='merc-info';detail.setAttribute('aria-label',`查看${m.name}的属性和技能`);detail.setAttribute('aria-haspopup','dialog');
    const portrait = document.createElement('canvas');
    portrait.className = 'mPortrait';
    portrait.width = 96; portrait.height = 96;
    drawPortrait(portrait, 'm_' + mid, 96);
    detail.appendChild(portrait);
    const info = document.createElement('div');
    info.className = 'mname';
    info.innerHTML = `<b>${m.name}</b><span class="merc-prices"><span class="mcost">${m.cost}金</span> <span class="minc">+${m.income}收入</span></span><small>${m.air?'空中':m.rawRange<=180?'近战':'远程'} · ${m.atk} / ${m.armor}</small><small>生命 ${m.hp} · 攻击 ${m.min}–${m.max}</small><span class="merc-unlock"></span>`;
    detail.appendChild(info);detail.addEventListener('click',()=>openMercDetails(mid));row.appendChild(detail);
    const actions=document.createElement('div');actions.className='merc-card-actions';
    const b1 = document.createElement('button');
    b1.className = 'btn'; b1.textContent = '敌军 Ⅰ'; b1.dataset.mercSend = '0';
    const b2 = document.createElement('button');
    b2.className = 'btn'; b2.textContent = '敌军 Ⅱ'; b2.dataset.mercSend = '1';
    [b1, b2].forEach(btn => {
      btn.addEventListener('click', () => {
        sendMercUI(mid,+btn.dataset.mercSend);
      });
      actions.appendChild(btn);
    });
    row.appendChild(actions);groups.get(m.unlockWave).appendChild(row);
  }
}

function selectShop(uid) {
  if (!G) return;
  if(uid&&!canManageArmy())return;
  if(uid&&G.online&&UNITS[uid]?.race!==localPlayer().race)return;
  G.selectedShop = (G.selectedShop === uid) ? null : uid;
  G.selectedFighter = null;
  if(G.selectedShop&&CommandUI.mobile){closeCommandPanel();setMapView('local');}
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
function updateIncomeBoard(me){
  const board=$('incomeBoard'),publicIncome=G.battleMode==='arena'||visionOpen(G);
  board.classList.toggle('allied-only',!publicIncome);
  const fragment=document.createDocumentFragment();
  for(const team of publicIncome?[me.team,1-me.team]:[me.team]){
    const group=document.createElement('div');group.className='income-team '+(team===me.team?'allied':'opposing');
    const label=document.createElement('small');label.textContent=team===me.team?'我方收入':G.battleMode==='arena'?'敌方收入 · PK公开':'敌方收入';group.append(label);
    for(const p of G.players.filter(p=>p.team===team)){
      const chip=document.createElement('span');chip.className='income-player';chip.dataset.player=String(p.id);
      const name=document.createElement('span');name.className='income-name';name.textContent=p.id===me.id?'你':p.name;name.title=p.name;
      const value=document.createElement('b');value.textContent=incomeVisibleToTeam(G,me.team,p)&&Number.isFinite(p.income)?String(p.income):'未知';
      chip.title=`${p.name} · 每波收入 ${value.textContent}`;chip.append(name,value);group.append(chip);
    }
    fragment.append(group);
  }
  board.replaceChildren(fragment);
}
function updateUI(force) {
  if (!G) return;
  const me = localPlayer();
  if($('shop').dataset.raceScope!==(G.online?me.race:'all'))buildShop();
  updateMines(me);
  $('stGold').textContent = Math.floor(me.gold);
  $('stIncome').textContent = me.income;
  updateIncomeBoard(me);
  $('stValue').textContent = playerValue(me);
  $('stWave').textContent = (G.battleMode==='arena'?`第 ${G.wave} 波后 · 阵营 PK`:G.wave > CFG.TOTAL_WAVES ? `加时赛 第${G.wave}波` : `第 ${G.wave} / ${CFG.TOTAL_WAVES} 波`) +
    (G.phase === 'prep' ? ` · 准备 ${Math.ceil(G.timer)}s` : G.phase === 'combat' ? ' · 战斗中' : '');

  // 波次预告
  const wi = $('waveInfo');
  const d = G.waveDef;
  if (d && G.phase !== 'over') {
    const traitTxt = d.trait ? `<span class="chip trait">${TRAIT_INFO[d.trait].n}</span>` : '';
    const incoming = me.mercQueue.length
      ? `<div class="mercWarn">⚠ 敌方已向你雇佣 ${me.mercQueue.length} 个单位（随下一波来袭）</div>` : '';
    wi.innerHTML = G.battleMode==='arena'?`<div class="wrow"><span class="wnum">阵营 PK</span><span class="wtime">${G.phase==='prep'?Math.ceil(G.timer)+'s 后开门':G.arena.stage==='result'?'已结算 · 即将继续守关':'中央路口已开放'}</span></div><div class="race-tip">${G.phase==='prep'?'可调整阵容，开战后暂时锁定买兵、升级与出售。':'苍岚 '+arenaCountText(G.arena.counts[0])+' 单位 / 赤焰 '+arenaCountText(G.arena.counts[1])+' 单位'}<br>胜方每人 +${G.wave*10} 金 · 平局每人 +${G.wave*5} 金<br>国王不参战，PK 后恢复原阵型继续守关。</div>`:`
      <div class="wrow">
        <span class="wnum">${G.wave > CFG.TOTAL_WAVES ? '加时 ' : ''}第 ${G.wave} 波</span>
        <span class="wtime">${G.phase === 'prep' ? Math.ceil(G.timer) + 's 后来袭' : '⚔ 战斗中'}</span>
      </div>
      <div>
        <span class="chip count">每路 ${d.count} 只</span>
        <span class="chip">每路 ${d.spawnInterval} 秒 / 只</span>
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

  const sb=$('selBox'),f=G.selectedFighter;
  if(f&&me.fighters.includes(f)&&!f.temporary) {
    sb.style.display='';const def=f.def,signature=[f.uid,f.col,f.row,f.spent].join('|');
    if(sb.dataset.signature!==signature){sb.dataset.signature=signature;
      $('selInfo').innerHTML=`<div class="selHead"><canvas id="selPortrait" width="64" height="64"></canvas><div><div class="sName">${def.name}</div><small>${def.english} · ${RACES[def.race].name}</small><div class="sStats" id="selLiveStats"></div><div>${def.atk} · ${def.armor}（${def.armorPoints}）</div></div></div><div class="sStats">${abilDesc(def)||'无特殊能力'}<br>已投入 ${f.spent} 金 · 阵亡后下波复活</div>${source341Details(def)}<div class="upgrade-options">${def.upgrades.map(id=>`<button class="btn" data-upgrade-uid="${id}">升级 → ${UNITS[id].name} · ${UNITS[id].purchaseCost} 金<small>❤${UNITS[id].hp} · ⚔${UNITS[id].min}–${UNITS[id].max}</small></button>`).join('')}${def.stances.map(id=>`<button class="btn" data-upgrade-uid="${id}">切换 → ${UNITS[id].name} · 免费</button>`).join('')}<button class="btn" id="btnSell">卖出 · 3折返还 +${fighterSellValue(f)}金</button></div>`;
      drawPortrait($('selPortrait'),f.uid,64);
      sb.querySelectorAll('[data-upgrade-uid]').forEach(button=>button.addEventListener('click',()=>{performAction({type:'upgrade',col:f.col,row:f.row,uid:button.dataset.upgradeUid});updateUI(true);}));
      $('btnSell').addEventListener('click',()=>{requestUnitSale(f);});
    }
    const behavior={guard:'待命',advance:'前移接敌',chase:'追击',attack:'交战',cast:'施法支援',return:'回阵'};
    $('selLiveStats').textContent=`❤${Math.max(0,Math.ceil(f.hp))}/${def.hp} · 法力 ${Math.floor(f.mana||0)}/${def.manaMax} · ${f.hp>0?behavior[f.brain?.state]||'在场':'等待下波复活'} · 移速 ${Math.round(def.speed*(f.slowF??1))}`;
    sb.querySelectorAll('[data-upgrade-uid]').forEach(button=>{const id=button.dataset.upgradeUid;button.disabled=!canManageArmy()||me.gold<(def.stances.includes(id)?0:UNITS[id].purchaseCost);});
    $('btnSell').disabled=!canManageArmy();
    const refund=fighterSellValue(f);$('btnSell').textContent=`卖出 · 3折返还 +${refund}金`;
    $('btnSell').disabled=!canManageArmy();
    let steroid=$('btnSteroids');
    if(def.abil.steroids&&!steroid){steroid=document.createElement('button');steroid.id='btnSteroids';steroid.className='btn';sb.querySelector('.upgrade-options').prepend(steroid);
      steroid.addEventListener('click',()=>{performAction({type:'steroids',col:f.col,row:f.row});updateUI(true);});}
    if(steroid){steroid.textContent=f.steroids?'下一波强化已准备':'注射强化 · 50金 · 下一波生命+20%、攻击+25%';steroid.disabled=G.phase!=='prep'||f.steroids||me.gold<50;}
  }else{sb.style.display='none';delete sb.dataset.signature;}

  updateKingUI(me);

  // 雇佣兵可用性
  updateMercUI(me);

  // 日志
  const lg = $('log');
  const lines = visibleGameLogs(G,me.team).slice(-5);
  if (lg.dataset.sig !== lines.map(l => l.txt).join('|')) {
    lg.dataset.sig = lines.map(l => l.txt).join('|');
    lg.innerHTML = lines.map(l => `<div class="${l.cls}">${l.txt}</div>`).join('');
  }
  syncCommandUI();
}

function updateMines(me) {
  if(MineUI.slot===null)return;
  if(!['prep','combat'].includes(G.phase)){if($('mineDialog').open)$('mineDialog').close();return;}
  const mine=mineAtSlot(me,MineUI.slot),def=mine?MINE.LEVELS[mine.level-1]:null;
  const next=MINE.LEVELS[mine?.level??0],cost=mine?def.upgrade:MINE.COST;
  if(MineUI.pending&&mine?.level>=MineUI.pending.level)MineUI.pending=null;
  G.selectedMine=mine?.id??null;
  const total=me.mines.reduce((sum,m)=>sum+MINE.LEVELS[m.level-1].gold,0);
  $('mineDialogTitle').textContent=`${MineUI.slot+1} 号${mine?'金矿 · Lv.'+mine.level:'矿位'}`;
  $('mineDialogSummary').textContent=mine?'升级保留产金倒计时，下次结算使用新等级收益。':'在这处空矿位建造金矿，每 5 秒自动获得金币。';
  $('mineDialogStats').innerHTML=`<div><small>当前收益</small><b>${def?.gold??0} 金 / 5 秒</b></div><div><small>${mine?'升级后收益':'建成后收益'}</small><b>${next?next.gold+' 金 / 5 秒':'已达最高等级'}</b></div><div><small>持有金币 / 已建矿井</small><b>${Math.floor(me.gold)} 金 · ${me.mines.length}/${MINE.LIMIT}</b></div><div><small>矿区总收益</small><b>${total} 金 / 5 秒</b></div>`;
  const allowed=['prep','combat'].includes(G.phase),insufficient=cost!==null&&me.gold<cost;
  $('mineDialogStatus').textContent=MineUI.error||(MineUI.pending?'正在提交，等待对局同步…':insufficient?`还需 ${Math.ceil(cost-me.gold)} 金` :mine?`下次产金：${Math.max(0,Math.ceil(MINE.INTERVAL-mine.elapsed))} 秒`:'金矿独立产金，不占用战士格子');
  $('btnMineAction').textContent=MineUI.pending?'正在处理…':!next?'已满级':`${mine?'升级金矿':'建造金矿'} · ${cost} 金`;
  $('btnMineAction').disabled=!!MineUI.pending||!allowed||!next||insufficient||(!mine&&me.mines.length>=MINE.LIMIT);
}

/* ---------- 弹窗 ---------- */
function showOverlay(mode) {
  const ov = $('overlay');
  if (mode === 'menu') {
    ov.style.display = 'flex';
    ov.innerHTML = `<div class="panel" id="menuPanel"></div>`;
  } else if (mode === 'result') {
    const win = G.result.winner === localPlayer().team, tie=G.result.winner===null;
    const k0 = G.kings[0], k1 = G.kings[1];
    ov.style.display = 'flex';
    ov.innerHTML = `
      <div class="panel" style="text-align:center">
        <h1 style="font-size:42px;color:${win ? 'var(--green)' : 'var(--red)'}">${tie?'双方平局':win ? '🏆 胜利！' : '💀 战败'}</h1>
        <p class="tagline">${tie?'双方国王守住了最终波。':win ? '你的军团守住了王城！' : '对方国王赢得了这场对局。'}</p>
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
  return projectCanvasPoint(e.clientX,e.clientY);
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
    if(consumeMapGesture())return;
    if (!G || G.phase === 'over' || G.phase === 'menu') return;
    const me = localPlayer();
    const pos = canvasPos(e);
    const cell = fieldCellAt(me, pos.x, pos.y);
    const radius=Math.max(23,22/getMapProjection().scale);
    const king=G.kings[me.team];
    if(Math.hypot(pos.x-king.x,pos.y-king.y)<=Math.max(45,22/getMapProjection().scale)){openKingDialog();return;}
    const mineSlot=Array.from({length:MINE.LIMIT},(_,i)=>i).find(i=>{const at=minePosition(me,i);return Math.abs(pos.x-at.x)<=Math.min(47,radius)&&Math.abs(pos.y-at.y)<=Math.max(27,radius);});
    if(mineSlot!==undefined){openMineDialog(mineSlot);return;}
    if (G.selectedShop) {
      if (cell && performAction({ type:'buy', uid:G.selectedShop, col:cell.col, row:cell.row })) {
        if (me.gold < UNITS[G.selectedShop].cost) selectShop(null);
      }
      updateUI(true);
      return;
    }
    // 选中己方战士
    const moving=G.phase==='combat';
    if (cell||moving) {
      const f = moving?me.fighters.filter(f=>!f.temporary&&f.deadT<=0&&f.hp>0&&Math.hypot(f.x-pos.x,f.y-pos.y)<=32).sort((a,b)=>Math.hypot(a.x-pos.x,a.y-pos.y)-Math.hypot(b.x-pos.x,b.y-pos.y))[0]:me.fighters.find(f => !f.temporary && f.col === cell.col && f.row === cell.row && f.deadT <= 0);
      G.selectedFighter = f || null;
      if(f)openCommandPanel('inspect');
      updateUI(true);
    }
  });

  cv.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (G && G.selectedShop) selectShop(null);
  });

  $('btnMineClose').addEventListener('click',()=>$('mineDialog').close());
  $('btnKingClose').addEventListener('click',()=>$('kingDialog').close());
  $('kingDialog').addEventListener('close',()=>{KingUI.open=false;KingUI.pending=null;KingUI.error='';});
  for(const [team,id] of ['blueKingStatus','redKingStatus'].entries())$(id).addEventListener('click',()=>{if(G&&localPlayer().team===team)openKingDialog();});
  $('btnMercClose').addEventListener('click',()=>$('mercDialog').close());
  $('mercDialog').addEventListener('close',()=>{MercUI.mid=null;});
  document.querySelectorAll('[data-merc-detail-send]').forEach(b=>b.addEventListener('click',()=>sendMercUI(MercUI.mid,+b.dataset.mercDetailSend)));
  $('btnMineAction').addEventListener('click',submitMineAction);
  $('mineDialog').addEventListener('close',()=>{MineUI.slot=null;MineUI.pending=null;MineUI.error='';if(G)G.selectedMine=null;});

  document.querySelectorAll('[data-king-stat]').forEach(button => {
    button.addEventListener('click',()=>submitKingUpgrade(button.dataset.kingStat));
  });
  $('btnPause').addEventListener('click', togglePause);
  $('btnSpeed').addEventListener('click', cycleSpeed);
  $('btnHelp').addEventListener('click', () => { $('modal').style.display = 'flex'; });
  $('btnRestart').addEventListener('click', () => Net.session ? leaveOnline() : location.reload());

  document.addEventListener('keydown', e => {
    if (!G || document.querySelector('dialog[open]') || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
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
