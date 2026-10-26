'use strict';
/* ===== 入口：初始化、主循环 ===== */
let lastT = 0, uiT = 0, lastFrameAt = 0;

function frame(t, fromInterval) {
  lastFrameAt = t;
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  if (G && (G.phase === 'prep' || G.phase === 'combat') && !G.paused && !Net.session) {
    simStep(dt * G.speed);
  }
  if (G && G.phase !== 'menu') draw(t);
  uiT -= dt;
  if (uiT <= 0) { updateUI(); uiT = 0.15; }
  if (!fromInterval) requestAnimationFrame(frame);
}

/* rAF 在后台标签页/隐藏面板中会被暂停，用定时器兜底驱动主循环 */
setInterval(() => {
  const now = performance.now();
  if (now - lastFrameAt > 400) frame(now, true);
}, 300);

async function boot() {
  setupCanvas();
  const readyButtons=[...document.querySelectorAll('#overlay button')].filter(button=>!button.disabled);
  readyButtons.forEach(button=>button.disabled=true);
  const loading=LoadingUI.begin('正在加载游戏资源…');
  await loadUnitArt((done,total)=>{const label=`正在加载游戏资源 ${done}/${total}`;$('bootStatus').textContent=label;LoadingUI.update(loading,label);});
  buildSprites();
  buildShop();
  buildMercs();
  buildAtkTable();
  bindCommandLayout();
  bindEvents();
  setSpeed(1);

  document.querySelectorAll('#overlay .diff').forEach(btn => {
    btn.addEventListener('click', () => {
      $('overlay').style.display = 'none';
      newGame(btn.dataset.diff);
      updateUI(true);
    });
  });

  bindLobby();
  readyButtons.forEach(button=>button.disabled=false);if(Net.room)renderRoomLobby(Net.room);LoadingUI.enforce();
  $('bootStatus').hidden=true;LoadingUI.end(loading);
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
}

boot().catch(()=>{const hint=$('bootStatus');hint.hidden=false;hint.textContent='游戏加载失败，请刷新页面重试。';$('loadingStatus').hidden=true;});
