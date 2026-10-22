module.exports=async function clickMine(page,slot,{mobile=false}={}){
 const press=selector=>mobile?page.locator(selector).tap():page.locator(selector).click();
 if(await page.evaluate(()=>CommandUI.mobile&&CommandUI.open)){
  await press('#btnPanelClose');await page.locator('#side').waitFor({state:'hidden'});
 }
 await press('#btnMapMines');
 const point=await page.evaluate(slot=>{
  const v=getMapProjection(),r=$('cv').getBoundingClientRect(),at=minePosition(localPlayer(),slot);
  const x=r.left+v.tx+at.x*v.scale,y=r.top+v.ty+at.y*v.scale;
  return {x,y,hit:document.elementFromPoint(x,y)?.outerHTML.slice(0,160)};
 },slot);
 if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
 try{await page.locator('#mineDialog').waitFor({state:'visible',timeout:4000});}
 catch(e){console.error('Mine hit diagnostic',point,await page.evaluate(()=>({camera:MapCamera,phase:G.phase,slot:MineUI.slot})));throw e;}
};
