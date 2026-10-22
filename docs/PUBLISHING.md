# 发布到 GitHub

此项目已准备源码与便携版，尚未代替维护者创建或公开发布仓库。

## 源码放仓库，程序放 Releases

建议仓库名 `snowline-lyrics`，描述可用：

> A floating Windows lyric board with system media session sync, LRCLIB lookup and local LRC support.

建议 topics：`windows`、`lyrics`、`electron`、`lrc`、`desktop`。

公开源码时，使用 `dist/snowline-lyrics-0.1.0-source` 中的干净文件，而不是拖入整个开发工作目录。这份导出由 `node scripts/export-source.mjs` 创建：只包含明确允许的源码、文档、测试、原创预览图和工作流，不包含依赖、exe、配对密钥、个人配置或缓存。

可以用 GitHub Desktop 创建一个新本地仓库，将干净源码目录中的内容（包括 `.github`、`.gitignore` 和 `.gitattributes`）复制到仓库根目录，确认变更列表后提交。选择 Publish repository 时自行选择公开或私有。不要另外生成不同的 LICENSE 覆盖现有文件。

## 发布前确认署名和许可证

当前项目自有代码使用 MIT，署名为 `Snowline Lyrics contributors`。维护者可在首次发布前加入自己希望公开的姓名或 GitHub 用户名，并在后续贡献中保留相应署名。MIT 允许广泛使用、修改和分发，也不提供软件担保；如希望采用不同开放规则，应在首次发布前决定并同步更新 package.json 与说明。

本许可证不授权第三方歌词、音乐、商标或运行时组件。不要上传真实歌曲的歌词缓存、录音、封面或私人截图。便携包应保留 Electron 的 LICENSE、LICENSES.chromium.html 和本项目的第三方说明。

## 验证与发布程序

1. 运行 README 中的测试与源码审查命令。`audit:source` 是有限的模式检查，维护者仍需看一遍准备发布的文件。
2. 推送后查看 GitHub Actions 的验证结果。当前工作流会测试、编译和打包，然后上传构建 artifact；不会创建公开 Release。该工作流在本机准备，尚未在你的 GitHub 仓库执行验证。
3. 在 GitHub Releases 新建草稿，tag 使用 `v0.1.0`，填写 [发布说明](RELEASE-NOTES.md)，测试阶段可勾选 pre-release。
4. 附上 `Snowline-Lyrics-0.1.0-win-x64.zip` 与 `SHA256.txt`。不要把 Electron exe 或整个 dist 作为普通源码提交。
5. 审阅草稿后手动发布。普通用户下载便携 ZIP，而不是 GitHub 自动生成的 Source code 压缩包。

在仓库 Settings / Security 中启用 private vulnerability reporting，以便 SECURITY.md 指向的私密渠道可用。此版本没有证书签名或自动更新，不应描述成已签名正式版。

以后修改版本号、更新 CHANGELOG、重新测试和打包；不要直接复用旧的已测试结论。工作流 action 版本、Electron 和依赖也需要定期维护。

参考：[GitHub licensing guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)、[Electron packaging](https://www.electronjs.org/docs/latest/tutorial/application-distribution)。
