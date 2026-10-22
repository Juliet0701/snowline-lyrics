// Snowline: read-only Windows system media session adapter.
// .NET Framework 4.8 is supplied by Windows 10/11. No audio capture or playback controls.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using System.Web.Script.Serialization;
using Windows.Media.Control;

internal static class MediaReader {
  static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = 512 * 1024 };
  static long NowMs() { return (long)(DateTimeOffset.UtcNow - new DateTimeOffset(1970,1,1,0,0,0,TimeSpan.Zero)).TotalMilliseconds; }
  static string Trim(string s) { s=s??"";return s.Length>250?s.Substring(0,250):s; }
  static void Emit(object value) { Console.WriteLine(Json.Serialize(value)); Console.Out.Flush(); }
  static async Task<object> Read(GlobalSystemMediaTransportControlsSession session, string id, bool current) {
    var task = session.TryGetMediaPropertiesAsync().AsTask();
    if(await Task.WhenAny(task,Task.Delay(2500))!=task) throw new TimeoutException("Metadata timed out");
    var properties=await task;
    var info=session.GetPlaybackInfo();var timeline=session.GetTimelineProperties();
    var now=NowMs();var playing=info.PlaybackStatus==GlobalSystemMediaTransportControlsSessionPlaybackStatus.Playing;
    var rate=info.PlaybackRate??1.0;
    var duration=(timeline.EndTime-timeline.StartTime).TotalMilliseconds;
    var position=(timeline.Position-timeline.StartTime).TotalMilliseconds;
    var updated=(long)(timeline.LastUpdatedTime-new DateTimeOffset(1970,1,1,0,0,0,TimeSpan.Zero)).TotalMilliseconds;
    var valid=duration>0 && duration<=86400000 && position>=0 && position<=duration+2000 && updated>0 && updated<=now+5000;
    if(valid && playing) position+=Math.Max(0,now-updated)*rate;
    position=Math.Max(0,Math.Min(position,Math.Max(0,duration)));
    return new { id=id,appId=session.SourceAppUserModelId,isCurrent=current,title=Trim(properties.Title),artist=Trim(properties.Artist),album=Trim(properties.AlbumTitle),
      durationMs=valid?duration:0,positionMs=valid?position:0,paused=!playing,rate=rate,timelineValid=valid,
      timelineUpdatedAt=updated,rawPositionMs=timeline.Position.TotalMilliseconds,playbackStatus=info.PlaybackStatus.ToString(),capturedAt=now };
  }
  static async Task<int> Run(string[] args) {
    bool once=args.Contains("--once");int parent=0;
    int at=Array.IndexOf(args,"--parent");if(at>=0 && at+1<args.Length)int.TryParse(args[at+1],out parent);
    GlobalSystemMediaTransportControlsSessionManager manager;
    try { manager=await GlobalSystemMediaTransportControlsSessionManager.RequestAsync(); }
    catch(Exception e) { Emit(new { status="error",message="Windows 媒体接口不可用："+e.Message,sessions=new object[0],capturedAt=NowMs() });return 2; }
    do {
      if(parent>0) { try { if(Process.GetProcessById(parent).HasExited)return 0; } catch {return 0;} }
      var output=new List<object>();var counts=new Dictionary<string,int>();var errors=new List<string>();
      try {
        var current=manager.GetCurrentSession();
        foreach(var s in manager.GetSessions().Take(12)) {
          var app=s.SourceAppUserModelId;int ordinal=counts.ContainsKey(app)?counts[app]:0;counts[app]=ordinal+1;
          try {output.Add(await Read(s,app+"#"+ordinal,(current!=null && s==current)));}
          catch(Exception e) { errors.Add(Trim(app+": "+e.Message)); }
        }
        Emit(new {status=output.Count>0?"ready":"empty",sessions=output.ToArray(),errors=errors.ToArray(),capturedAt=NowMs()});
      } catch(Exception e) {Emit(new {status="error",message=Trim(e.Message),sessions=new object[0],capturedAt=NowMs()});}
      if(!once)await Task.Delay(750);
    } while(!once);
    return 0;
  }
  [STAThread] static int Main(string[] args) {
    Console.OutputEncoding=new System.Text.UTF8Encoding(false);
    try{return Run(args).GetAwaiter().GetResult();}catch(System.IO.IOException){return 0;}catch(Exception e){Console.Error.WriteLine(e.Message);return 1;}
  }
}
