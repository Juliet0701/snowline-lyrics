# Snowline Lyrics

A floating Windows lyric board built with **Rust + Tauri 2**. The UI uses system WebView2; the application does not bundle Electron, Chromium or Node.js.

独立的 Windows 桌面歌词板：读取系统播放器信息，查找歌词，以可拖动、可置顶的透明窗口显示。

## 下载与运行

1. 在 [Releases](https://github.com/Juliet0701/snowline-lyrics/releases) 下载 `Snowline-Lyrics-0.5.2-win-x64.zip`，完整解压。
2. 先从托盘退出旧版，然后运行 `SnowlineLyrics.exe`。
3. 在音乐软件播放歌曲；设置中可以选择播放器、歌词版本及外观。

要求 Windows 10/11 x64 和 Microsoft Edge WebView2 Runtime（Windows 11 通常已具备）。普通用户不需要 Node.js、Rust、浏览器扩展或音乐账号授权。当前为未签名预览版。

## 歌词与外观

- 播放器提供进度时自动同步播放、暂停和跳转。
- 只有歌名时，选择时间戳歌词并点选当前句，启动独立歌词计时；不会控制音乐播放器。
- 普通歌词可全文滚动阅读；可导入本机 UTF-8 `.lrc` 或 `.txt`。
- 顶部 ↻ 重新查找；置顶、隐藏、托盘恢复；窗口位置保存。
- 设置按外观、播放、歌词源、关于分组。
- 背景颜色／图片／透明度，歌词及标题颜色，黑白遮罩、强度快捷选项、文字阴影；均保存在本机。

默认来源为 LRCLIB。LrcApi 同步备用源及 lyrics.ovh 普通歌词源均需手动开启；备用候选需确认。查找只发送歌名、歌手及必要时的时长。公共服务可能缺歌、限流或不可用，不能保证匹配正确或所有播放器都支持进度。

## 从 Electron 版本升级与回退

首次运行会**只读复制**旧 `%APPDATA%/SnowlineLyrics` 中的歌词缓存、外观及配置到独立的 `%APPDATA%/SnowlineLyricsRust`，不会覆盖旧配置。其后两个版本各自保存设置。若需要回退，退出 Rust 版并重新打开 0.4.2 即可。

Rust 版直接调用 Windows Media.Control，不运行旧 C# 媒体组件或本地 Node HTTP 服务。UI 通过限定的原生 IPC 调用 Rust。隐藏窗口暂停界面刷新；设置窗口按需创建，关闭时释放。保留 HTML/CSS/JavaScript 用于界面渲染。

## 源码开发

需要 Rust 1.99.1 或兼容更新版本、MSVC C++ 构建工具及 Windows SDK、WebView2。Node.js 22+ 仅用于开发检查、打包和桌面自动化脚本。

```powershell
cargo test --manifest-path rust/core/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
cargo run --manifest-path src-tauri/Cargo.toml
cargo build --release --manifest-path src-tauri/Cargo.toml
npm ci
npm run test:desktop -- src-tauri/target/release/snowline-desktop.exe
npm run package:windows
```

## 内容权利与隐私

代码为 MIT 许可；歌词、歌曲、艺人信息和第三方软件有各自权利。软件许可不构成歌词展示授权。本仓库不包含真实歌词、音频或用户缓存；不要提交本机应用数据。

不录音、不读取音乐账号或 Cookies、不采集遥测。本项目与 YouTube、Google、Microsoft、LRCLIB 及其他歌词服务没有隶属或官方背书关系。参阅 [隐私说明](PRIVACY.md)、[第三方说明](THIRD-PARTY-NOTICES.md) 和 [验证记录](docs/VERIFICATION.md)。
