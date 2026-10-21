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
  await loadUnitArt();
  readyButtons.forEach(button=>button.disabled=false);
  buildSprites();
  buildShop();
  buildMercs();
  buildAtkTable();
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
  requestAnimationFrame(t => { lastT = t; requestAnimationFrame(frame); });
}

boot();
