# Snowline Lyrics v0.5.0 · Rust Preview

## 完整迁移至 Rust + Tauri

- 移除 Electron、Node 本地服务及 C# 媒体组件，直接通过 Rust 读取 Windows 媒体会话。
- 保留自动同步、无进度手动对齐、普通歌词全文滚动、本地 LRC/TXT 导入和候选版本确认。
- 保留背景图片、颜色、透明度、黑白遮罩、文字阴影、置顶及托盘。
- 设置窗口按需创建，关闭时释放；隐藏界面暂停刷新。
- 旧配置首次只读复制到独立的 SnowlineLyricsRust 数据目录，保留 0.4.2 配置用于回退。

## 下载与升级

下载 `Snowline-Lyrics-0.5.0-win-x64.zip`，完整解压。先从托盘退出旧版，再运行 `SnowlineLyrics.exe`。

要求 Windows 10/11 x64 和 Microsoft Edge WebView2 Runtime。无需 Node.js、Rust 编译器或浏览器扩展。此版本为未签名预览版；尚未逐一验证所有播放器和 Windows 10。

## 验证

5 项核心测试、7 项后台测试通过；优化程序和便携包完成桌面流程验证，真实 Windows 媒体接口及三个歌词服务连通检查通过。可用性和歌曲匹配仍取决于播放器及公共服务。

应用仍使用 WebView2，下载体积缩小不等于相同比例的内存降低。
