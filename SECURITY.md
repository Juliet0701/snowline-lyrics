# Security

这是尚未进行独立安全审计的早期测试项目。只维护当前版本。

应用窗口不启用 Node integration，启用 context isolation 与 sandbox。窗口操作通过限定 IPC 提供；本机服务只监听 loopback 并校验 Host、Origin 和访问密钥。系统媒体读取不控制播放，不采集音频。

发现漏洞时，请使用仓库的 Security → Report a vulnerability 私密报告渠道（发布仓库后需维护者启用）。如果该渠道尚未启用，请先提交不含利用细节的联系请求，请维护者建立私密沟通方式。请勿公开配对密钥、个人数据或可直接攻击用户的利用细节。

发布维护者应启用 GitHub private vulnerability reporting，关注 Electron 更新并在升级后测试。便携构建会保留 Electron 原有签名信息，但应用本身未单独签名；本项目不提供绕过系统安全保护的脚本。
