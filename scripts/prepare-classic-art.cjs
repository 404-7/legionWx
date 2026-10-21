// Normalize the classic GIF showcase matte for Canvas sprite composition; keep source GIFs intact.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.argv[2]||'playwright');
const {server}=require('../server/index.cjs');
(async()=>{
 await require('./test-server.cjs')(server);const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage();await page.goto('http://127.0.0.1:'+server.address().port+'/healthz');
  const mapping=JSON.parse(fs.readFileSync('assets/unit-art/mapping.json','utf8'));
  const files=[...new Set(Object.values(mapping.frames).map(r=>r.file).filter(Boolean))];
  for(const file of files){
   const png=await page.evaluate(async file=>{
    const image=new Image();image.src='/assets/unit-art/classic/'+file.replace(/\.png$/,'.gif');await image.decode();
    const cv=document.createElement('canvas');cv.width=image.naturalWidth;cv.height=image.naturalHeight;
    const c=cv.getContext('2d');c.drawImage(image,0,0);const pixels=c.getImageData(0,0,cv.width,cv.height),p=pixels.data,w=cv.width,h=cv.height;
    const background=[p[0],p[1],p[2]],seen=new Uint8Array(w*h),queue=[];
    const enqueue=(x,y)=>{const n=y*w+x;if(x<0||y<0||x>=w||y>=h||seen[n])return;seen[n]=1;const i=n*4;
     if(p[i+3]===0||Math.max(p[i],p[i+1],p[i+2])<30||Math.max(Math.abs(p[i]-background[0]),Math.abs(p[i+1]-background[1]),Math.abs(p[i+2]-background[2]))<28){queue.push(n);p[i+3]=0;}
    };
    for(let x=0;x<w;x++){enqueue(x,0);enqueue(x,h-1);}for(let y=0;y<h;y++){enqueue(0,y);enqueue(w-1,y);}
    for(let n=0;n<queue.length;n++){const i=queue[n],x=i%w,y=Math.floor(i/w);enqueue(x-1,y);enqueue(x+1,y);enqueue(x,y-1);enqueue(x,y+1);}
    c.putImageData(pixels,0,0);let left=w,top=h,right=0,bottom=0;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(p[(y*w+x)*4+3]>32){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
    if(left>right||top>bottom)throw Error('empty sprite '+file);
    const sprite=document.createElement('canvas');sprite.width=right-left+9;sprite.height=bottom-top+9;
    sprite.getContext('2d').drawImage(cv,left,top,right-left+1,bottom-top+1,4,4,right-left+1,bottom-top+1);
    return sprite.toDataURL('image/png').split(',')[1];
   },file);
   fs.writeFileSync(path.join('assets/unit-art/classic',file),Buffer.from(png,'base64'));
  }
  console.log('Prepared',files.length,'transparent local sprite PNGs');
 }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
