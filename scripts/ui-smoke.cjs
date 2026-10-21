// Optional headless application test. Pass the Playwright package directory as argv[2].
const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const {server}=require('../server/index.cjs');
(async()=>{
 await require('./test-server.cjs')(server);
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1560,height:1080}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.locator('.race-tab').first().waitFor();
  assert.equal(await page.evaluate(()=>UNIT_ART.status),'ready');
  assert.equal(await page.evaluate(()=>SOURCE341.units.every(row=>CLASSIC_ART_FRAMES[row.id])),true);
  assert.equal(await page.locator('.race-tab').count(),14);
  await page.locator('.diff[data-diff="normal"]').click();
  await page.locator('#btnPause').click();
  for(const race of await page.evaluate(()=>Object.keys(RACES))){
   await page.locator(`[data-race="${race}"]`).click();
   assert.equal(await page.locator('.ucard').count(),6,race+' base cards');
   await page.locator('.catalog-toggle').click();
   const expected=await page.evaluate(r=>SOURCE341.units.filter(u=>u.race===r).length,race);
   assert.equal(await page.locator('.ucard').count(),expected,race+' encyclopedia');
   await page.locator('.catalog-toggle').click();
  }
  await page.evaluate(()=>{const p=localPlayer();p.gold=2000;buyFighter(p,'infantry',2,2);G.selectedFighter=p.fighters[0];updateUI(true);});
  assert.equal(await page.locator('[data-upgrade-uid]').count(),2);
  await page.locator('[data-upgrade-uid="zeus"]').click();
  assert.equal(await page.evaluate(()=>localPlayer().fighters[0].uid),'zeus');
  await page.locator('[data-race="ghost"]').click();
  await page.locator('.catalog-toggle').click();
  await page.locator('[data-uid="phantom"] summary').click();
  if(process.argv[3]){
   await page.screenshot({path:path.resolve(process.argv[3]),fullPage:true});
   const gallery=await page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=1000;const c=canvas.getContext('2d');
    c.fillStyle='#0e1918';c.fillRect(0,0,1400,1000);c.fillStyle='#dfc581';c.font='bold 32px Microsoft YaHei';c.fillText('军团战争 · 经典兵种外观',36,55);
    const ids=['gnoll_warrior','ogre_pulverizer','harpy','spawn_of_dragon','infantry','neotank','krogoth','ent','ranger','meliai','thunderbird','yggdrasil','bone_warrior','nightcrawler','gateguard','infernal','aqua_spirit','fenix','phantom','soul_of_hero_atk','medicine_man','minotaur','hydra','tuskarr','magnataur','pandaren','orc_warrior','death_dragon'];
    ids.forEach((id,i)=>{const x=24+(i%7)*195,y=88+Math.floor(i/7)*224;
     c.fillStyle='#152623';c.strokeStyle='#3c5144';c.fillRect(x,y,182,208);c.strokeRect(x,y,182,208);
     c.drawImage(SPR[id],x+11,y+5,160,160);c.fillStyle='#e5ddc9';c.font='bold 16px Microsoft YaHei';c.textAlign='center';c.fillText(UNITS[id].name,x+91,y+180);
     c.fillStyle='#94aaa0';c.font='11px Segoe UI';c.fillText(UNITS[id].english,x+91,y+198);
    });return canvas.toDataURL('image/png').split(',')[1];
   });
   require('node:fs').writeFileSync(path.resolve(process.argv[3]).replace(/\.png$/, '-gallery.png'),Buffer.from(gallery,'base64'));
  }
  assert.deepEqual(errors,[]);
  console.log('UI smoke passed: 14 race tabs, 84 base cards, 187 encyclopedia records, branch upgrade; no page errors.');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
