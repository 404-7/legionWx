module.exports=async function clickKing(page,{mobile=false,enemy=false}={}){
 const press=s=>mobile?page.locator(s).tap():page.locator(s).click();
 if(await page.evaluate(()=>CommandUI.mobile&&CommandUI.open)){await press('#btnPanelClose');await page.locator('#side').waitFor({state:'hidden'});}
 await press('#btnMapOverview');
 const point=await page.evaluate(enemy=>{const k=G.kings[enemy?1-localPlayer().team:localPlayer().team],v=getMapProjection(),r=$('cv').getBoundingClientRect();return {x:r.left+v.tx+k.x*v.scale,y:r.top+v.ty+k.y*v.scale};},enemy);
 if(mobile)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);
 if(!enemy)await page.locator('#kingDialog').waitFor({state:'visible'});
};
