# GBD Research Hub — 科研数据管理系统（网页发布仓库）

该公开仓库只发布静态网站，不含科研 CSV、R 数据分析代码、任何密码或私有密钥。

## 网站入口

临时站点： https://lil48649.github.io/cluster-site/secure-preview/

最终计划恢复的站点： https://lil48649.github.io/cluster/secure-preview/

根目录的 `index.html` 自动跳转到 `secure-preview/`。

## 安全模式

- 个人邮箱与密码通过 Supabase Auth 登录，手机 TOTP 双因素验证
- Supabase Private Storage 中保存真实 CSV 文件
- Supabase Storage RLS 严格校验项目组白名单、有效登录会话与 AAL2 身份认证
- `secure-preview/secure-config.js` 仅包含允许公开的项目 URL 和 publishable key
- `secure-preview/vendor/qrcodegen.min.js` 为 MIT 许可的本地二维码实现

**禁止将 CSV、用户密码、TOTP 种子、Supabase service_role / secret key 加入网页发布仓库。** 已授权的研究成员仍可在本地保存已读取的数据。

## GitHub Pages 发布

在新仓库 Settings → Pages 里选择 `Deploy from a branch`，分支 `main`，目录 `/(root)`。

本仓库使用独立的新 Git 历史，不能合并原 `cluster` 旧历史；旧仓库过去曾经公开过 CSV，其历史须另行处理。
