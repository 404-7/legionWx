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
  if(process.argv[3])await page.screenshot({path:path.resolve(process.argv[3]),fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('UI smoke passed: 14 race tabs, 84 base cards, 187 encyclopedia records, branch upgrade; no page errors.');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
