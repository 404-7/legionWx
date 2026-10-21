'use strict';
// Local presentation state never enters the authoritative game snapshot.
const CommandUI={panel:'shop',open:false,mobile:false,selection:null,placement:null,pendingSell:null,scroll:{}};
const COMMAND_TITLES={shop:'种族兵营',economy:'金矿经营',king:'国王强化',attack:'派遣进攻',inspect:'单位详情'};
const MapCamera={mode:null,zoom:1,cx:null,cy:null,player:null,projection:null,suppressClick:false};

function openCommandPanel(panel,{toggle=false,focus=false}={}) {
  if(!Object.hasOwn(COMMAND_TITLES,panel))return;
  if(toggle&&CommandUI.mobile&&CommandUI.panel===panel&&CommandUI.open){closeCommandPanel();return;}
  const changed=CommandUI.panel!==panel;
  if(changed)CommandUI.scroll[CommandUI.panel]=$('commandBody').scrollTop;
  CommandUI.panel=panel;CommandUI.open=true;
  if(panel!=='inspect'&&G)G.selectedFighter=null;
  if(G?.selectedShop)selectShop(null);
  syncCommandPanels();
  if(changed)$('commandBody').scrollTop=CommandUI.scroll[panel]||0;
  if(focus)$('btnPanelClose').focus({preventScroll:true});
}
function closeCommandPanel() {
  const restoreFocus=CommandUI.mobile&&$('side').contains(document.activeElement);
  CommandUI.open=false;syncCommandPanels();
  if(restoreFocus)document.querySelector('[data-command][aria-selected="true"]')?.focus({preventScroll:true});
}
function syncCommandPanels() {
  $('commandTitle').textContent=COMMAND_TITLES[CommandUI.panel];
  $('side').classList.toggle('drawer-open',CommandUI.open);
  $('side').inert=CommandUI.mobile&&!CommandUI.open;
  $('side').setAttribute('aria-hidden',String(CommandUI.mobile&&!CommandUI.open));
  $('btnPanelBack').hidden=CommandUI.panel!=='inspect';
  $('drawerBackdrop').hidden=!CommandUI.mobile||!CommandUI.open;
  document.querySelectorAll('[data-panel]').forEach(panel=>panel.hidden=panel.dataset.panel!==CommandUI.panel);
  document.querySelectorAll('[data-command]').forEach(button=>{
    const selected=button.dataset.command===(CommandUI.panel==='inspect'?'shop':CommandUI.panel);
    button.setAttribute('aria-selected',String(selected));button.classList.toggle('active',selected);
    button.classList.toggle('expanded',selected&&CommandUI.open);button.setAttribute('aria-expanded',String(selected&&CommandUI.open));button.tabIndex=selected?0:-1;
  });
}
function setMapView(mode) {
  MapCamera.mode=mode;MapCamera.zoom=1;MapCamera.cx=MapCamera.cy=null;
  if(G)G.hover=null;
  syncMapButtons();
}
function syncMapButtons() {
  const mode=MapCamera.mode||(CommandUI.mobile?'local':'overview');
  $('btnMapHome').classList.toggle('active',mode==='local');
  $('btnMapOverview').classList.toggle('active',mode==='overview');
  $('btnMapZoomOut').disabled=MapCamera.zoom<=.65;
  $('btnMapZoomIn').disabled=MapCamera.zoom>=4;
}
function zoomMap(factor) {MapCamera.zoom=Math.max(.65,Math.min(4,MapCamera.zoom*factor));syncMapButtons();}

function getMapProjection() {
  const holder=$('mapViewport'),cv=$('cv');
  let w=Math.max(1,holder.clientWidth),h=Math.max(1,holder.clientHeight);
  if(!CommandUI.mobile){w=Math.min(w,h*CFG.W/CFG.H);h=w*CFG.H/CFG.W;}
  const dpr=Math.min(window.devicePixelRatio||1,2);
  if(cv.width!==Math.round(w*dpr)||cv.height!==Math.round(h*dpr)){
    cv.width=Math.round(w*dpr);cv.height=Math.round(h*dpr);
  }
  cv.style.width=w+'px';cv.style.height=h+'px';
  const me=G?localPlayer():null,mode=MapCamera.mode||(CommandUI.mobile?'local':'overview');
  if(me&&MapCamera.player!==me.id){MapCamera.player=me.id;MapCamera.cx=MapCamera.cy=null;}
  const localScale=w>h*1.6?Math.min(w/276,Math.max(120,h-64)/252):w/276;
  const base=mode==='local'&&me?localScale:Math.min(w/CFG.W,h/CFG.H);
  const scale=base*MapCamera.zoom;
  let cx=MapCamera.cx??(mode==='local'&&me?me.fx+CFG.FIELD_W/2:CFG.W/2);
  let cy=MapCamera.cy??(mode==='local'&&me?me.fy+CFG.FIELD_H/2+(CommandUI.mobile&&w<h?12:0):CFG.H/2);
  const clamp=(value,span,max)=>span>=max?max/2:Math.max(span/2,Math.min(max-span/2,value));
  cx=clamp(cx,w/scale,CFG.W);cy=clamp(cy,h/scale,CFG.H);
  return MapCamera.projection={w,h,dpr,scale,cx,cy,tx:w/2-cx*scale,ty:h/2-cy*scale};
}
function projectCanvasPoint(clientX,clientY) {
  const r=$('cv').getBoundingClientRect(),p=getMapProjection();
  return {x:((clientX-r.left)*p.w/r.width-p.tx)/p.scale,y:((clientY-r.top)*p.h/r.height-p.ty)/p.scale};
}
function consumeMapGesture() {
  const dragged=MapCamera.suppressClick;MapCamera.suppressClick=false;return dragged;
}
function bindMapGestures() {
  const cv=$('cv'),pointers=new Map();let drag=null,pinch=null;
  const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
  cv.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    cv.setPointerCapture(event.pointerId);const p=getMapProjection();
    if(!pointers.size)MapCamera.suppressClick=false;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size===1)drag={x:event.clientX,y:event.clientY,cx:p.cx,cy:p.cy,scale:p.scale};
    else if(pointers.size===2){pinch={distance:distance(),zoom:MapCamera.zoom};MapCamera.suppressClick=true;}
  });
  cv.addEventListener('pointermove',event=>{
    if(!pointers.has(event.pointerId))return;
    pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
    if(pointers.size>=2&&pinch){MapCamera.zoom=Math.max(.65,Math.min(4,pinch.zoom*distance()/Math.max(1,pinch.distance)));syncMapButtons();}
    else if(drag){const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      if(Math.hypot(dx,dy)>7||MapCamera.suppressClick){MapCamera.suppressClick=true;MapCamera.cx=drag.cx-dx/drag.scale;MapCamera.cy=drag.cy-dy/drag.scale;if(G)G.hover=null;}
    }
  });
  const end=event=>{
    pointers.delete(event.pointerId);
    if(!pointers.size){drag=null;pinch=null;}
    else{const a=[...pointers.values()][0],p=getMapProjection();drag={x:a.x,y:a.y,cx:p.cx,cy:p.cy,scale:p.scale};pinch=null;}
  };
  cv.addEventListener('pointerup',end);cv.addEventListener('pointercancel',event=>{MapCamera.suppressClick=true;end(event);});
  cv.addEventListener('wheel',event=>{event.preventDefault();zoomMap(event.deltaY>0?1/1.15:1.15);},{passive:false});
}

function syncCommandUI() {
  if(!G)return;
  const me=localPlayer(),f=G.selectedFighter,key=f?`${f.col}:${f.row}:${f.uid}`:null;
  if(key&&key!==CommandUI.selection)openCommandPanel('inspect');
  else if(!key&&CommandUI.panel==='inspect'){CommandUI.panel='shop';if(CommandUI.mobile)CommandUI.open=false;syncCommandPanels();}
  CommandUI.selection=key;
  const uid=G.selectedShop,def=UNITS[uid];$('placementBar').hidden=!def;
  if(uid!==CommandUI.placement){CommandUI.placement=uid;if(def){drawPortrait($('placementPortrait'),uid,96);$('placementName').textContent=def.name+' · '+def.purchaseCost+' 金';}}
  if(def)$('placementHint').textContent=me.gold>=def.purchaseCost?'点击己方空格放置 · 可连续建造':'金币不足，可取消或等待金矿产出';
  $('mapHint').hidden=!!def;
  const focused=(MapCamera.mode||(CommandUI.mobile?'local':'overview'))==='local';
  $('mapHint').textContent=focused?CommandUI.mobile?'你的防区 · 拖动查看战场，双指缩放':'你的防区 · 拖动查看战场，滚轮缩放':'全图视角 · 点击「我的防区」精确布阵';
  $('blueKingStatus').textContent='♛ 苍岚 '+Math.max(0,Math.ceil(G.kings[0].hp))+'/'+G.kings[0].max;
  $('redKingStatus').textContent='♛ 赤焰 '+Math.max(0,Math.ceil(G.kings[1].hp))+'/'+G.kings[1].max;
  $('battleStatus').textContent=G.paused?'已暂停':G.phase==='prep'?`第 ${G.wave} 波 · ${Math.ceil(G.timer)}s 准备`:G.phase==='combat'?`第 ${G.wave} 波 · 交战中`:'对战结束';
  $('latestReport').textContent=G.logLines.at(-1)?.txt||'等待军团集结';
  document.querySelectorAll('[data-delegate]').forEach(button=>{const target=$(button.dataset.delegate);button.textContent=target.textContent;button.disabled=target.disabled;});
}
function requestUnitSale(f) {
  if(!CommandUI.mobile){performAction({type:'sell',col:f.col,row:f.row});updateUI(true);return;}
  CommandUI.pendingSell={uid:f.uid,col:f.col,row:f.row};
  const refund=Math.floor(f.spent*(f.def.abil.refund||1));
  $('sellMessage').textContent=`出售「${f.def.name}」将返还 ${refund} 金。`;
  $('btnConfirmSell').textContent=`确认出售 · +${refund} 金`;$('sellDialog').showModal();
}
function bindCommandLayout() {
  const media=window.matchMedia('(max-width: 900px)');
  const responsive=()=>{CommandUI.mobile=media.matches;CommandUI.open=!media.matches;MapCamera.mode=null;MapCamera.cx=MapCamera.cy=null;MapCamera.zoom=1;syncCommandPanels();syncMapButtons();};
  media.addEventListener('change',responsive);responsive();
  document.querySelectorAll('[data-command]').forEach(button=>{
    button.addEventListener('click',()=>{openCommandPanel(button.dataset.command,{toggle:true});if(G)updateUI(true);});
    button.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();
      const buttons=[...document.querySelectorAll('[data-command]')],index=buttons.indexOf(button);
      const next=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowRight'?1:buttons.length-1))%buttons.length;
      buttons[next].click();buttons[next].focus();
    });
  });
  for(const id of ['btnPanelClose','drawerHandle','drawerBackdrop'])$(id).addEventListener('click',closeCommandPanel);
  $('btnPanelBack').addEventListener('click',()=>{if(G)G.selectedFighter=null;openCommandPanel('shop');if(G)updateUI(true);});
  $('btnCancelPlacement').addEventListener('click',()=>{selectShop(null);});
  // A canvas pan can suppress the browser's next synthesized click on touch devices.
  $('btnCancelPlacement').addEventListener('pointerup',event=>{if(event.pointerType==='touch')selectShop(null);});
  $('btnMapHome').addEventListener('click',()=>setMapView('local'));
  $('btnMapOverview').addEventListener('click',()=>setMapView('overview'));
  $('btnMapZoomOut').addEventListener('click',()=>zoomMap(1/1.25));$('btnMapZoomIn').addEventListener('click',()=>zoomMap(1.25));
  $('btnMore').addEventListener('click',()=>{const open=$('quickMenu').hidden;$('quickMenu').hidden=!open;$('btnMore').setAttribute('aria-expanded',String(open));});
  document.querySelectorAll('[data-delegate]').forEach(button=>button.addEventListener('click',()=>{$('quickMenu').hidden=true;$('btnMore').setAttribute('aria-expanded','false');$(button.dataset.delegate).click();}));
  document.addEventListener('click',event=>{if(!event.target.closest('#quickMenu,#btnMore')){$('quickMenu').hidden=true;$('btnMore').setAttribute('aria-expanded','false');}});
  $('btnKeepUnit').addEventListener('click',()=>{$('sellDialog').close();CommandUI.pendingSell=null;});
  $('btnConfirmSell').addEventListener('click',()=>{
    const pending=CommandUI.pendingSell,f=G&&localPlayer().fighters.find(f=>!f.temporary&&f.uid===pending?.uid&&f.col===pending.col&&f.row===pending.row);
    if(f)performAction({type:'sell',col:f.col,row:f.row});$('sellDialog').close();CommandUI.pendingSell=null;if(G)updateUI(true);
  });
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeCommandPanel();$('quickMenu').hidden=true;}});
  bindMapGestures();
}
