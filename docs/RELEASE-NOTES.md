# Snowline Lyrics 0.1.0 — Preview

第一版纯歌词板。通过 Windows 系统媒体会话读取歌曲与进度，自动查找 LRCLIB 同步歌词。

- 可拖动、调整大小、置顶的独立歌词板。
- 托盘设置、播放器选择、版本确认、时间偏移和本地 LRC 导入。
- 独立数据目录，无需浏览器扩展、DeepSeek Harness、Node 或 API Key。

Windows x64 便携测试版。完整解压后运行 `SnowlineLyrics.exe`。× 隐藏歌词板；双击托盘恢复，右键托盘退出。

已在 Windows 11 验证系统媒体读取及 YouTube Music Chrome PWA。其他播放器需要提供有效系统媒体进度；Windows 10 和其他客户端尚待验证。没有音频识曲，不保证每首歌都有可匹配的同步歌词。首次查歌词需要联网。

本版未签名，没有自动更新。自动查询会将歌名、歌手和时长发送给 LRCLIB；无录音和遥测。代码采用 MIT；歌词与第三方组件另有各自权利，详见仓库说明。
