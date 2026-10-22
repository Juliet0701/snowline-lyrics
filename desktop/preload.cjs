const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('boardHost',Object.freeze({action:name=>ipcRenderer.invoke('board:action',name)}));
