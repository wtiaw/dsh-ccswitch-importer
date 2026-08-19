# DSH CCSwitch 导入器

将 CCSwitch 的 Codex provider 配置导入 DeepSeek Harness，并在同一个「设置 -> 模型」页面管理每个模型的推理深度。

[English README](./README.en.md)

## 功能

- 只读扫描 `~/.cc-switch/cc-switch.db`，识别自定义 Codex provider；官方和默认 profile 会跳过。
- 将 endpoint、协议、模型 ID 和 API key 导入 DSH 的 `llm-pi-ai` 设置。
- API key 只在 Host 进程中读取，并通过 DSH credentials 服务保存为 `apiKeyEnv` 引用；扫描和导入响应不包含 key。
- 从 Codex TOML 顶层 `model_reasoning_effort` 预填模型推理配置，同时允许之后在 DSH 中修改。
- `none` 映射为关闭；已知模型使用保守目录；未知模型只生成导入值对应的单个等级；非法值安全关闭并给出警告。
- 重新导入不会覆盖已有的推理等级、route 默认值、headers、容量字段或未出现在 CCSwitch 的额外模型。
- 原生 Models 页面、CCSwitch 导入区和模型推理编辑器共存于同一个 Models 页面。

CCSwitch 是只读导入源。首次导入后，DSH 设置和 credentials 服务成为配置事实来源；不会写回 CCSwitch 数据库。

## 安装

从 GitHub 安装：

```bash
dsh plugin --profile desktop add github:wtiaw/dsh-ccswitch-importer
```

从本地源码安装：

```bash
dsh plugin --profile desktop add ./dsh-ccswitch-importer
```

安装或更新后刷新 DSH Web 页面，打开 **设置 -> 模型**。

## 使用

1. 在 Models 页面打开「CCSwitch 导入」并点击「扫描」。
2. 选择需要导入的 provider，点击「导入选中」。
3. 检查导入结果和 provider 模型列表。
4. 在同页的模型推理区域确认已预填的等级；第三方网关需要自定义 wire value 时直接编辑并保存。
5. 在输入框模型选择器中使用保存后的推理等级。

导入会在设置 revision 冲突时停止并恢复本次写入的 credential；已有 credential 会恢复原值。

## 推理目录

当前保守目录包含：

- GPT-5.6 系列：`off: none`、`low`、`medium`、`high`、`xhigh`、`max`。
- OpenAI o-series（`o1`、`o3`、`o4-mini` 及变体）：`off: null`、`low`、`medium`、`high`。

目录只是默认值，保存后的 DSH 字段由用户控制。

## DSH Community Market 目录

本插件按 [目录适配器指南（路径 A：标准来源）](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/catalog-adapter-guide.zh.md) 提供可接入 DSH Community Market 的标准目录。仓库内包含：

- `scripts/build-catalog.mjs` —— 从 `package.json` 元数据生成 `catalog-source` manifest 与 `/v1/plugins` 条目页；
- `scripts/deploy-catalog.sh` —— 一键部署到 Cloudflare Pages（含 JSON Content-Type 重写规则）；
- `test/catalog.test.mjs` —— 用官方 Schema 校验生成结果并断言元数据一致；
- [docs/catalog.md](./docs/catalog.md) —— 部署方式、Content-Type 要求与来源登记说明。

同时，本插件仓库已添加 GitHub topic `dsh-plugin`，会被 [dshfind](https://dshfind.com) 目录来源按 topic 自动收录。

生成与部署：

```bash
DSH_CATALOG_ORIGIN=https://catalog.example.com npm run build:catalog
```

## 安全边界与限制

- Host 路由只接受 loopback、same-origin 请求；API key 不进入浏览器、日志、摘要或错误文本。
- 读取需要 Node.js 22.19 或更高版本，以支持只读 SQLite API。
- 插件只处理 CCSwitch 的自定义 Codex provider 和当前数据库字段；不会探测第三方 API 的真实推理能力。
- 未知模型和不合法等级默认关闭，避免向网关发送未确认的 reasoning 参数。

## 开发与验证

要求 Node.js 22.19 或更高版本：

```bash
npm install
npm test
npm run pack:check
```

`npm run build` 生成 DSH Host bundle 和带有 `window.__ModuleLoader__.load` 注册的 Client bundle。发布包只包含 `dist`、patch、README 和许可证，不包含源码与测试。
