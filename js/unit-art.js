'use strict';
// Local classic Warcraft unit renders. Gameplay remains independent of asset loading.
const UNIT_ART={images:{},status:'loading',failures:[],frames:CLASSIC_ART_FRAMES};
async function loadUnitArt(onProgress=()=>{}){
 const files=[...new Set(Object.values(UNIT_ART.frames).map(frame=>frame.file).filter(Boolean))];
 let cursor=0,complete=0;const deadline=Date.now()+20000;onProgress(0,files.length);
 await Promise.all(Array.from({length:8},async()=>{
  while(cursor<files.length){const file=files[cursor++];await new Promise(resolve=>{
   const image=new Image();let settled=false;const finish=ok=>{if(settled)return;settled=true;clearTimeout(timer);if(ok)UNIT_ART.images[file]=image;else UNIT_ART.failures.push(file);onProgress(++complete,files.length);resolve();};
   const timer=setTimeout(()=>{finish(false);image.src='';},Math.max(1,Math.min(12000,deadline-Date.now())));image.onload=()=>finish(true);
   image.onerror=()=>finish(false);image.src='assets/unit-art/classic/'+file;
  });}
 }));
 UNIT_ART.status=UNIT_ART.failures.length?'fallback':'ready';
}
function artFrameFor(id){return UNIT_ART.frames[id]||null;}
function specialUnitArt(c,kind,id){
 const cx=80,cy=94;
 c.save();c.fillStyle='rgba(0,0,0,.3)';c.beginPath();c.ellipse(cx,133,47,10,0,0,7);c.fill();
 if(kind==='mine'){
  const level=id==='ultra_land_mine'?3:id==='medium_land_mine'?2:1;
  const shell=c.createRadialGradient(65,69,6,cx,cy,54);shell.addColorStop(0,'#b6a273');shell.addColorStop(.5,'#6d725e');shell.addColorStop(1,'#202b2d');
  c.fillStyle=shell;c.strokeStyle='#111919';c.lineWidth=3;c.beginPath();c.ellipse(cx,cy,46,35,0,0,7);c.fill();c.stroke();
  for(let i=0;i<8;i++){const a=i*Math.PI/4,x=cx+Math.cos(a)*39,y=cy+Math.sin(a)*27;
   c.strokeStyle='#84816d';c.lineWidth=6;c.beginPath();c.moveTo(x,y);c.lineTo(cx+Math.cos(a)*55,cy+Math.sin(a)*40);c.stroke();
  }
  c.fillStyle='#1a2725';c.beginPath();c.ellipse(cx,cy-12,22,12,0,0,7);c.fill();
  for(let i=0;i<level;i++){c.fillStyle=level===3?'#ee6950':'#d8bb6d';c.beginPath();c.arc(cx+(i-(level-1)/2)*11,cy-12,4,0,7);c.fill();}
 }else{
  const shell=c.createRadialGradient(66,65,5,85,95,50);shell.addColorStop(0,'#b5c689');shell.addColorStop(.5,'#6b9366');shell.addColorStop(1,'#274b3d');
  c.fillStyle=shell;c.strokeStyle='#20372e';c.lineWidth=4;c.beginPath();c.ellipse(80,93,37,48,-.1,0,7);c.fill();c.stroke();
  c.strokeStyle='#c4d38a';c.lineWidth=2;for(let i=0;i<5;i++){c.beginPath();c.moveTo(80,57);c.quadraticCurveTo(45+i*15,84,62+i*9,128);c.stroke();}
 }
 c.restore();
}
function applyUnitArt(){
 for(const id of Object.keys(SPR)){
  const frame=artFrameFor(id);if(!frame)continue;
  const cv=mkc(160,160),c=cv.getContext('2d');
  if(frame.kind){specialUnitArt(c,frame.kind,id);SPR[id]=cv;continue;}
  const image=UNIT_ART.images[frame.file];if(!image)continue;
  c.imageSmoothingEnabled=true;c.imageSmoothingQuality='high';
  const scale=Math.min(148/image.naturalWidth,148/image.naturalHeight)*(frame.scale||1),w=image.naturalWidth*scale,h=image.naturalHeight*scale;
  c.drawImage(image,(160-w)/2,154-h,w,h);
  if(frame.tint?.some(value=>value<255)){
   c.globalCompositeOperation='multiply';c.fillStyle=`rgb(${frame.tint.join(',')})`;c.fillRect(0,0,160,160);
   c.globalCompositeOperation='destination-in';c.drawImage(image,(160-w)/2,154-h,w,h);c.globalCompositeOperation='source-over';
  }
  SPR[id]=cv;
 }
}
