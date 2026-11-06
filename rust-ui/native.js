/* Local commands only: no loopback server, token, Node or remote web content. */
const invoke=window.__TAURI__.core.invoke;
window.boardHost=Object.freeze({action:async name=>({pinned:await invoke('board_action',{name})})});
const assetFetch=window.fetch.bind(window);
window.fetch=async(input,options={})=>{const url=typeof input==='string'?input:input.url;if(url.startsWith('/api/')){try{const path=url.slice(5),data=options.body?JSON.parse(options.body):null;const result=await invoke('api',{path,data});return new Response(JSON.stringify(result),{status:200,headers:{'Content-Type':'application/json'}});}catch(error){return new Response(JSON.stringify({error:String(error)}),{status:400,headers:{'Content-Type':'application/json'}});}}return assetFetch(input,options);};
