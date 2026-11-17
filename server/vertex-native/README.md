# 内置 Vertex JSON 接入

此版本替代需要用户填写 VPS 地址的旧方案。前端内置认证入口，只要求导入官方 Service Account JSON、选地区和模型。

认证服务是独立的 Worker ESM，部署源位于对应 Sites 源仓库；这里保留实现和测试副本。运行 `npm test` 检查加密凭据、固定 Google OAuth、模型目录分页、原生生成与错误隔离。

运行时只需要服务器密钥 `VERTEX_SEAL_KEY`（随机32字节、base64url，保存在 Sites secret）。不得把它写进源码或浏览器。JSON 中的 project_id、client_email、private_key 由服务验证；自带的 token_uri 等外部地址被忽略。通过 Google 身份验证后，服务返回 AES-GCM 加密的设备凭据；浏览器只保存该加密凭据，普通备份按 API 密钥字段排除。服务不保存共享 Google 账号，不提供账号导出或读取接口。加密凭据也是访问凭证，Google 端仍可撤销原始密钥。

模型拉取使用 Google v1beta1 publisher 模型目录，过滤 Gemini、支持分页。目录不等于所选项目/区域有调用权限；可手填 Gemini ID，再发送测试消息确认。权限或目录请求失败会明确报错，不假称从 Google 拉取成功。

访问范围：主小手机维持原来的公开访问。新认证入口创建时为私有，正式接入公开小手机前需要明确允许该入口公开访问。入口公开不会暴露服务端封装密钥或其他人的 Google 账号；各设备必须提供自己的有效服务账号或加密凭据才能调用。
