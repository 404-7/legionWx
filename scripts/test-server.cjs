// Windows may allocate an ephemeral port forbidden by Fetch/Chromium (e.g. 6667).
module.exports=async function listenForTest(server) {
 for(let attempt=0;attempt<12;attempt++){
  const port=32000+Math.floor(Math.random()*12000);
  try{
   await new Promise((resolve,reject)=>{
    const failed=error=>{server.off('listening',ready);reject(error);};
    const ready=()=>{server.off('error',failed);resolve();};
    server.once('error',failed);server.once('listening',ready);server.listen(port,'127.0.0.1');
   });return port;
  }catch(error){if(error.code!=='EADDRINUSE')throw error;}
 }
 throw Error('Could not reserve a safe local test port');
};
