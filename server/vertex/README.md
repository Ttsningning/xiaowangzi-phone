# 小手机官方 Vertex：酒馆式网页配置

前端现在支持：导入或粘贴 Service Account JSON → 检查格式 → 验证 Google 身份并保存 → 选地区（含 global）和模型 → 测试消息。私钥只在输入期间存在页面内存，保存后由自己的 VPS 后台保管，不进入小手机数据库、备份、仓库或静态发布目录。

网站发布和 VPS 后台部署是两件事：此目录需要在你的 VPS 部署一次，网页才能真正配置和调用官方 Vertex。仓库中的测试使用模拟 Google，不代表你的真实账号已连通。

## 首次部署

1. 准备 Node.js 22+、一个带 HTTPS 的后台域名，以及专用系统用户 `vertex`（不允许交互登录）。
2. 将本目录复制到 `/opt/xiaowangzi-vertex`，执行 `npm ci --omit=dev`。
3. 创建 `/etc/xiaowangzi/vertex.env`，参考 `.env.example`。分别运行两次 `openssl rand -hex 32`，生成两个不同的密钥：
   - `BRIDGE_TOKEN`：日常聊天/读取配置使用，在小手机的「后台访问密钥」填写。
   - `VERTEX_ADMIN_TOKEN`：修改服务账号、地区、允许模型使用，只在网页保存配置时填写，页面不持久保存它。
4. `ALLOWED_ORIGINS` 填小手机来源，默认 `https://xiaowangzi-phone.gtt137233896.chatgpt.site`。环境文件仅管理员与服务用户可读。
5. 不需要先手动安装账号 JSON；`VERTEX_MODELS` 也可留空，稍后在网页配置。已有账号文件可以通过 `GOOGLE_APPLICATION_CREDENTIALS` 指定，作为迁移来源。
6. 安装 `vertex.service` 到 `/etc/systemd/system/xiaowangzi-vertex.service`。确认 Node 路径与 `command -v node` 一致，运行 `systemctl daemon-reload`、`systemctl enable --now xiaowangzi-vertex`。

systemd 的 `StateDirectory=xiaowangzi` 创建服务用户可写的 `/var/lib/xiaowangzi`。配置默认保存到 `/var/lib/xiaowangzi/vertex-config.json`（可用 `VERTEX_CONFIG_FILE` 调整），权限 600。使用其他路径时，需同步调整 systemd 的可写目录策略。

后台默认只监听 `127.0.0.1:8787`。在宝塔/Nginx 的 HTTPS 站点配置：

```nginx
location /v1/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 130s;
    client_max_body_size 2m;
}
```

升级旧版本后台时，必须添加独立的 `VERTEX_ADMIN_TOKEN`，复制新增的 `config-store.mjs`，更新 systemd 服务并重启。网页遇到旧后台会提示升级，不会假报保存成功。

## 在小手机配置

1. 设置 → 主体 AI 接口 → Google Vertex。
2. 首次填写后台地址 `https://你的域名/v1` 和 `BRIDGE_TOKEN`；这是你自己的后台，不是 Google 官方地址。
3. 点击「连接 · 读取已保存配置」。没有账号时会明确显示未配置。
4. 导入 JSON 或粘贴全文。「检查 JSON 格式」只检查格式，既不发送凭据也不调用 Google。
5. 选择地区，支持 `global`、常见区域或手填。下方模型框可手填精确 Gemini 模型 ID。
6. 输入 `VERTEX_ADMIN_TOKEN`，点「验证身份并保存」。凭据只发送到当前填写的 HTTPS 后台。后台通过 Google 官方认证库换取令牌成功后才原子保存；验证或写盘失败时保留旧配置。此步骤不调用模型生成，不能证明项目结算、权限、模型和地区都可用。
7. 保存成功后，页面清空 JSON 与管理密钥，只显示项目、账号和地区。用「拉取模型列表」打开后台允许的模型列表；该列表不是 Google 全量发现，也不保证每个模型可调用。
8. 点击「发送测试消息」实际检查模型、地区和权限，会调用 Google 并可能收费。

已有账号时，读取配置后可以只修改地区/模型，再用管理密钥保存，不必反复上传 JSON。后台保存的地区/账号对使用同一后台的角色共同生效；角色可单独配置后台地址、访问密钥和模型。不同账号可使用不同后台实例。

服务账号应属于已启用 Vertex AI API、关联结算且具备必要 Vertex 调用权限的项目，通常使用 `roles/aiplatform.user`，按项目实际策略配置。JSON 本身可换令牌不等于项目有模型调用权限。请从 Google 控制台确认模型 ID 与地区支持情况。

## 凭据和连接行为

- 私钥无读取/导出接口，GET 配置只返回项目、账号、地区和允许模型。
- 日常访问密钥不能修改账号，配置写入还需要独立管理密钥。
- 上传 JSON 仅接受 `service_account`、有效项目/账号和至少 2048 位 RSA 私钥；丢弃客户端提供的 OAuth URL 等额外字段，只用固定 Google 认证流程。
- 配置落盘前验证 Google 令牌，成功后原子替换，再切换运行中的账号。进行中的请求保留原账号/地区，不会中途串号。
- Google 短期令牌由官方认证库复用与刷新，不返还给网页。服务不会记录聊天或凭据到日志，错误响应不回传 Google 原始错误体。
- 单请求最大 2MB，配置最大 64KB，每实例最多 4 个进行中的生成，超时 120 秒；输出上限 32768 tokens。不自动重试付费生成。

## 缓存和其他渠道

使用 Google 隐式缓存，不创建或续期收费的显式缓存资源。稳定的人设、常驻世界书和较早对话在前，当前时间、订单等动态内容在后。命中由 Google 决定，未承诺固定节省比例。设置和角色页显示真实返回的输入（含缓存）、缓存输入、未缓存输入、输出与思考 token，不重复计数，不硬编码美元估价。

识图无独立地址时跟随主体 Vertex，要求模型支持图片。生图和语音合成继续配置各自独立渠道，此服务不提供通用 `/images/generations`、`/audio/speech` 或任意代理。

## 接口与测试

- `GET /v1/config`：只读配置摘要，需日常访问密钥。
- `POST /v1/config`：验证并保存 JSON/地区/模型，额外需要 `X-Vertex-Admin-Token`。
- `GET /v1/models`：后台允许模型。
- `POST /v1/generate`：只调用固定 Google Vertex 项目与模型，支持原生 SSE。

运行 `npm test` 检查认证、账号保存、文件权限、失败保留、重启恢复、配置隔离、SSE 与 Google 请求转换，使用模拟上游，不消耗 Google 余额。根目录 `npm test` 另有网页交互与旧功能回归。

参考：
- https://cloud.google.com/vertex-ai/generative-ai/docs/start/cloud-environment
- https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview
- https://github.com/googleapis/google-auth-library-nodejs
