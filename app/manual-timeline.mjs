// Only the lyric clock is controlled here. This never sends playback commands.
export class ManualTimeline {
  constructor(now=Date.now){this.now=now;this.anchor=null;}
  clear(){this.anchor=null;}
  valid(p){return !!this.anchor&&p?.trackId===this.anchor.trackId&&p?.source===this.anchor.source&&p.timelineAvailable===false;}
  position(p){
    if(!this.valid(p))return 0;
    const a=this.anchor,until=Math.min(this.now(),p.receivedAt+6000);
    const elapsed=a.paused?0:Math.max(0,until-a.at)*a.rate;
    return Math.min(p.durationMs>0?p.durationMs:86400000,Math.max(0,a.positionMs+elapsed));
  }
  align(p,positionMs){this.anchor={trackId:p.trackId,source:p.source,positionMs,at:this.now(),userPaused:false,paused:p.pauseKnown&&p.paused,rate:p.rate||1};}
  sync(previous,next){
    if(!this.anchor)return;
    if(!this.valid(next)){this.clear();return;}
    const positionMs=this.position(previous);
    this.anchor={...this.anchor,positionMs,at:this.now(),paused:this.anchor.userPaused||(next.pauseKnown&&next.paused),rate:next.rate||1};
  }
  running(p,running){if(!this.valid(p))throw new Error('请先点选当前歌词对齐');const positionMs=this.position(p);this.anchor={...this.anchor,positionMs,at:this.now(),userPaused:!running,paused:!running||(p.pauseKnown&&p.paused)};}
  display(p){return this.valid(p)?{...p,positionMs:this.position(p),receivedAt:this.now(),paused:this.anchor.paused}:null;}
}
