const {app,BrowserWindow,Tray,Menu,nativeImage,dialog,ipcMain,screen}=require('electron');
const {fork}=require('node:child_process');
const path=require('node:path');
const fs=require('node:fs');
app.setName('Snowline Lyrics');
app.setPath('userData',process.env.SNOWLINE_LYRICS_TEST_DATA||path.join(app.getPath('appData'),'SnowlineLyrics'));
if(process.env.SNOWLINE_LYRICS_TEST_DEBUG_PORT){app.commandLine.appendSwitch('remote-debugging-address','127.0.0.1');app.commandLine.appendSwitch('remote-debugging-port',process.env.SNOWLINE_LYRICS_TEST_DEBUG_PORT);}
if(!app.requestSingleInstanceLock()){app.quit();}else{
 const root=path.resolve(__dirname,'..'),prefsFile=path.join(app.getPath('userData'),'window.json');
 let board,settings,tray,service,base='',quitting=false,prefs={pinned:true},tail='';
 try{const saved=JSON.parse(fs.readFileSync(prefsFile,'utf8'));prefs.pinned=saved.pinned!==false;prefs.bounds=saved.bounds;}catch{}
 function save(){try{fs.mkdirSync(path.dirname(prefsFile),{recursive:true});fs.writeFileSync(prefsFile,JSON.stringify({pinned:prefs.pinned,bounds:board?.getBounds()}));}catch{}}
 function showBoard(){board.show();board.focus();}
 function showSettings(){settings.show();settings.focus();}
 function menu(){tray.setContextMenu(Menu.buildFromTemplate([{label:'显示歌词板',click:showBoard},{label:'歌词与播放器设置',click:showSettings},{type:'checkbox',label:'歌词板置顶',checked:prefs.pinned,click:()=>{prefs.pinned=!prefs.pinned;board.setAlwaysOnTop(prefs.pinned);save();menu();}},{type:'separator'},{label:'退出',click:quit} ]));}
 function quit(){if(quitting)return;quitting=true;save();if(service?.connected)service.send('shutdown');setTimeout(()=>{service?.kill();app.quit();},1800);}
 function fail(message){if(quitting)return;dialog.showErrorBox('Snowline Lyrics',message);quit();}
 function secure(window){
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(!base||!url.startsWith(base+'/'))event.preventDefault();});
 }
 app.on('second-instance',()=>{if(board)showBoard();});
 app.whenReady().then(()=>{
  const work=screen.getPrimaryDisplay().workArea;
  let bounds={x:Math.round(work.x+(work.width-680)/2),y:work.y+work.height-280,width:680,height:220};
  const b=prefs.bounds;
  if(b&&['x','y','width','height'].every(k=>Number.isFinite(b[k]))&&b.width>=400&&b.width<=1600&&b.height>=160&&b.height<=900&&screen.getAllDisplays().some(d=>b.x+80>d.workArea.x&&b.x<d.workArea.x+d.workArea.width-80&&b.y+40>d.workArea.y&&b.y<d.workArea.y+d.workArea.height-40))bounds=b;
  const webPreferences={nodeIntegration:false,contextIsolation:true,sandbox:true,preload:path.join(__dirname,'preload.cjs')};
  board=new BrowserWindow({...bounds,minWidth:400,minHeight:160,maxWidth:1600,maxHeight:900,frame:false,transparent:true,backgroundColor:'#00000000',resizable:true,show:false,alwaysOnTop:prefs.pinned,title:'Snowline Lyrics',icon:path.join(__dirname,'icon.png'),webPreferences});
  settings=new BrowserWindow({width:960,height:780,minWidth:720,minHeight:550,show:false,autoHideMenuBar:true,backgroundColor:'#101c24',title:'Snowline Lyrics · 设置',icon:path.join(__dirname,'icon.png'),webPreferences});
  for(const win of [board,settings]){secure(win);win.on('close',e=>{if(!quitting){e.preventDefault();win.hide();}});}
  ipcMain.handle('board:action',(event,name)=>{
   if(![board.webContents.id,settings.webContents.id].includes(event.sender.id)||!base||!event.senderFrame?.url.startsWith(base+'/'))throw new Error('Untrusted window');
   if(name==='settings')showSettings();else if(name==='show')showBoard();else if(name==='hide')board.hide();
   else if(name==='pin'){prefs.pinned=!prefs.pinned;board.setAlwaysOnTop(prefs.pinned);save();menu();}
   else if(name!=='state')throw new Error('Unknown board action');
   return {pinned:prefs.pinned};
  });
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')));tray.setToolTip('Snowline Lyrics · 歌词板');tray.on('double-click',showBoard);menu();
  service=fork(path.join(__dirname,'service.mjs'),[],{cwd:root,execPath:process.execPath,execArgv:[],windowsHide:true,silent:true,env:{...process.env,ELECTRON_RUN_AS_NODE:'1',SNOWLINE_LYRICS_DATA:app.getPath('userData')}});
  service.stdout.on('data',()=>{});service.stderr.on('data',d=>{tail=(tail+d).slice(-2500);});
  service.on('message',message=>{if(message.type==='ready'){
   if(!/^http:\/\/127\.0\.0\.1:\d+$/.test(message.base))return fail('本地服务地址无效');
   base=message.base;board.once('ready-to-show',showBoard);void board.loadURL(base+'/board');void settings.loadURL(base+'/settings');
  }});
  service.on('error',e=>fail('本地服务无法启动：'+e.message));service.on('exit',()=>{if(!quitting)fail('本地服务意外退出。请重新打开应用。\n'+tail);});
  setTimeout(()=>{if(!base&&!quitting)fail('启动超时，请完整解压应用后重试。');},20000).unref();
  if(process.env.SNOWLINE_LYRICS_TEST_QUIT_MS)setTimeout(quit,Number(process.env.SNOWLINE_LYRICS_TEST_QUIT_MS));
 });
 app.on('before-quit',event=>{if(!quitting){event.preventDefault();quit();}});app.on('window-all-closed',()=>{});
}
