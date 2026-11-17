# 小手机官方 Vertex 服务端

这部分部署到你自己的 VPS，不随静态小手机发布。JSON 服务账号只放在服务器；前端没有上传或保存私钥的入口。网站目前只完成代码接入，部署此服务并填入自己的凭据后才能真实调用 Google。

## 准备

- Node.js 22 或更新版本。
- 已启用 Vertex AI API、已关联结算的 Google Cloud 项目。
- 对该项目有 Vertex 调用权限的服务账号（通常使用 `roles/aiplatform.user`，再按项目实际策略配置），及其 `service_account` JSON 文件。
- 一个指向 VPS、带有效 HTTPS 证书的域名。手机访问的是该域名。
- 从 Google 控制台确认当前项目和区域支持的 Gemini 模型 ID。服务端只允许 `VERTEX_MODELS` 指定的模型；模型列表不是自动发现所有 Google 模型，也不会调用模型推理计费。

不要把真实 JSON、环境文件或转发密钥提交仓库。不要把 Google access token 当成永久密钥填到小手机。

## 安装与配置

1. 将本目录的代码复制到 `/opt/xiaowangzi-vertex`，运行 `npm ci --omit=dev`。
2. 创建专用系统用户 `vertex`（不允许交互登录）。创建 `/etc/xiaowangzi`，仅管理员及该服务用户可访问。
3. 通过你自己的服务器文件管理/SSH，把 JSON 放到 `/etc/xiaowangzi/service-account.json`，所有者设为 `vertex`、文件权限 `600`。不要放进站点目录。
4. 复制 `.env.example` 为 `/etc/xiaowangzi/vertex.env`。填写模型列表；用 `openssl rand -hex 32` 生成转发密钥并填写 `BRIDGE_TOKEN`。环境文件也设置为仅管理员与服务用户可读。
5. `VERTEX_LOCATION` 默认 `global`，不支持 global 的模型请改成其支持的区域。项目默认读取 JSON 的 project_id，也可设置 `GOOGLE_CLOUD_PROJECT` 覆盖。
6. 将 `vertex.service` 安装到 `/etc/systemd/system/xiaowangzi-vertex.service`。确认 `ExecStart` 的 Node 路径与你服务器 `command -v node` 一致，再运行 `systemctl daemon-reload` 和 `systemctl enable --now xiaowangzi-vertex`。

服务默认只监听 127.0.0.1:8787；通过现有宝塔/Nginx 的 HTTPS 站点转发以下路径。保留完整 `/v1/` 路径：

```nginx
location /v1/ {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_read_timeout 130s;
    client_max_body_size 2m;
}
```

所有生成和模型列表都验证转发密钥；浏览器来源仅允许 `ALLOWED_ORIGINS` 中列出的精确来源。CORS 不是认证替代品。该转发服务为你自己的小手机使用，不提供公开免密代理。可额外通过 Nginx 限流。

## 在小手机使用

- 设置 → 主体 AI 接口 → 渠道：`Google Vertex（官方 · 服务端转发）`。
- API 地址：你的 HTTPS 服务地址，以 `/v1` 结尾。
- API 密钥：你自己的 `BRIDGE_TOKEN`，不是 JSON 私钥。
- 拉取模型列表后选模型；测试连接会实际调用 Google，可能收费。
- 角色专属 API 也可选 Vertex；角色专属三项完整时优先使用其配置，否则跟随主体接口。
- 识图未填写独立地址时跟随主体 Vertex（需要所选模型支持图片）；生图与语音仍保留现有独立接口，切换 Vertex 后应单独填写兼容接口。此服务仅提供 Gemini 文本/内嵌图片消息生成与模型列表，不伪装成图片生成、语音合成或通用 OpenAI 服务。

前端支持真实流式响应。服务账号通过 Google 官方认证库换取短期令牌，由库自动复用与刷新；错误响应不回传凭据或 Google 原始错误体。

## 缓存与用量

本版本利用 Google 隐式上下文缓存，不创建、续费或存储显式缓存资源。聊天稳定规则、人设、记忆和既有对话保留在前，变化的时间、订单等当前状态放在后面。模型是否命中由 Google 的模型门槛、前缀一致程度和服务策略决定；不要为凑门槛填充无用文字。

设置和角色页显示 Google 实际返回的输入、缓存输入、未缓存输入、输出和思考 token。输入总数包含缓存数，不重复相加。这里没有硬编码美元估价，也不把“零命中”显示成已节省费用。模型输出和思考仍可收费，Google Cloud 账单为费用依据。

新设定、记忆整理、不同角色/模型和轮转历史都可能降低命中率。长时间闲置不会由本服务持续续期产生显式缓存存储费。缓存不会增加角色记忆。

## 接口与验证

- `GET /v1/models`：返回服务器配置的允许模型。
- `POST /v1/generate`：只转发到固定 Google Vertex 域名、固定项目和区域；支持 `stream: true`。
- 不提供服务账号上传、任意 URL 转发、工具调用或显式缓存创建接口。
- 单请求最大 2MB，单次生成输出上限 32768 tokens，每实例最多 4 个进行中的生成请求，超时 120 秒。中断会取消上游读取；Google 已处理的部分仍可能收费。不自动重试付费生成。

运行 `npm test` 使用模拟上游，验证认证、来源、模型限制、消息、缓存元数据及 SSE；不会调用 Google 或消耗余额。仓库根目录另有浏览器逻辑回归检查。

参考：
- https://cloud.google.com/vertex-ai/generative-ai/docs/start/cloud-environment
- https://cloud.google.com/vertex-ai/generative-ai/docs/context-cache/context-cache-overview
- https://github.com/googleapis/google-auth-library-nodejs
