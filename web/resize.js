const current=window.__TAURI__.window.getCurrentWindow();
for(const handle of document.querySelectorAll('[data-resize]')){
 handle.addEventListener('pointerdown',event=>{
  if(event.button!==0)return;
  event.preventDefault();event.stopPropagation();
  void current.startResizeDragging(handle.dataset.resize).catch(error=>console.warn('Unable to start corner resize',error));
 });
}
