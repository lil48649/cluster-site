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


## Local Clinical Vault（本机临床数据工作台）

独立入口：`/local-vault/`。

- 与示例网站共用 Supabase 密码与 TOTP 双因素验证
- **不上传任何临床 CSV**：浏览器本机选择文件，Web Worker 内完成解析、查询和统计
- 支持大体积 UTF-8 CSV、动态字段字典、最多8个组合筛选、按需分页、频数图与数值直方图
- 数据只保存在当前浏览器标签页内存，不写入 GitHub、Supabase、localStorage 或 IndexedDB
- 独立网络守卫只放行 Supabase 身份认证接口，阻止临床页面的存储 API、跨站接口和其他数据网络请求
- 不包含任何私人患者记录、原始 CSV、真实字段列表或医疗文件片段
- 关闭页面、刷新或退出登录时，本机内存数据即被释放，CSV 原文件不受影响

**说明**：此网页需要访问公网加载静态代码、验证项目成员身份和 TOTP；以上访问不携带用户选择的临床 CSV。对于真正不允许设备连接任何互联网的场景，请将代码部署到离线终端或内网，替换线上身份验证方式。

此本机工作台与 `/secure-preview/` 的示例 GBD 网站互不影响。临床数据严格禁止提交到任何 GitHub 分支或 Supabase。
