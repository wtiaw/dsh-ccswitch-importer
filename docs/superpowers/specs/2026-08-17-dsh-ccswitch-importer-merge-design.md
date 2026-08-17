# dsh-ccswitch-importer 合并设计

**日期：** 2026-08-17

## 背景

当前工作区有两个相互独立的方向：

- `dsh-ccswitch-importer` 已有 CCSwitch SQLite 扫描、Codex TOML 解析、provider 映射和凭据/设置导入核心，但 Host/Client 入口尚未完整落地。
- `dsh-model-reasoning-helper` 已有按模型编辑 `reasoningEfforts` 的设置 UI，并通过 Models section shadow 将控件嵌入 DSH 内置「模型」设置页。

用户要求合并为一个可发布插件，最终名称和插件 ID 统一为 `dsh-ccswitch-importer`，同时完成：

1. 从 CCSwitch 导入 provider、API key、endpoint 和模型。
2. 读取 CCSwitch 的 `model_reasoning_effort`，作为推理等级的初始值。
3. 在同一个 DSH「模型」页面设置和选择自定义模型的思考深度。
4. 只发布一个插件，不再发布 `dsh-model-reasoning-helper`。

## 目标

- 合并为一个 Host + Web Client 双半插件。
- 保留原生 DSH Models 页面能力，并在同一页面提供 CCSwitch 导入和推理配置。
- 导入流程只在 Host 读取 CCSwitch 数据和明文凭据；浏览器只接收脱敏摘要。
- 导入后的 provider 使用确定性 key 和 credential reference，重复导入幂等。
- 重复导入不覆盖用户在 DSH 中手工调整过的推理等级、额外模型字段和非导入字段。
- 对已识别的推理等级自动预填，对未知值给出警告并保持安全关闭。
- 发布包只有 `dsh-ccswitch-importer`；旧推理插件目录暂作为迁移来源保留，验证完成后再移除或归档。

## 非目标

- 不写回 CCSwitch 数据库。
- 不导入官方 Codex OAuth 登录态。
- 不导入任意 Authorization header、代理脚本、MCP、skills、prompts 或其它 CCSwitch 功能。
- 不自动修改 `agent-default-model` 或当前会话的默认 provider/model。
- 不修改 DSH 内置 DeepSeek adapter。
- 不把 API key、原始 `settings_config`、原始 TOML 或凭据错误文本发送到 Client、日志或 UI。

## 产品流程

### 模型设置页

插件以 `settings.section` 的 `models` cell 作为唯一内容 owner，通过低优先级 shadow 保留 DSH 内置 Models entry，并在同一个复合组件中渲染：

1. 原生 DSH Models provider/model 编辑器。
2. CCSwitch 导入区：扫描、选择、预览、导入、结果。
3. 模型推理区：按 provider/model 编辑推理开关、等级和 wire value。

导航只保留一个「模型」入口，不增加「模型推理」一级页面。导入完成后刷新 settings/credential/provider 快照，新的模型直接出现在下方推理区。

### CCSwitch 导入区

- 扫描按钮读取默认 CCSwitch 数据库；支持现有扫描器定义的候选来源。
- 每个 profile 显示名称、provider key、脱敏 endpoint、协议、模型 ID、凭据状态、导入状态和警告。
- 官方/默认 profile、缺少 API key、缺少 custom provider 配置或格式错误的 profile 只能展示为 blocked，不能选择。
- 导入只提交选中的 profile ID；Host 再次读取并校验源数据，不信任 Client 传来的 provider 内容。
- 完成后逐条显示 new/update/unchanged/blocked/failed 结果，错误信息经过 secret redaction。

## 推理等级导入规则

CCSwitch 的 `model_reasoning_effort` 表示当前 Codex 配置选中的等级，不等价于完整的能力目录。因此导入时不能把它误当成模型支持所有等级的证明。

支持的规范等级：`off`、`none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max`。

| 来源情况 | 导入行为 |
| --- | --- |
| 已知模型 + 合法非 off 等级 | 使用现有保守模型目录；将来源等级写为 route 默认推理等级 |
| 未知模型 + 合法非 off 等级 | 只生成 `off: null` 和该等级的同名 wire value；将其作为 route 默认值 |
| `off` 或 `none` | 模型 reasoning 默认关闭；不声明虚假的非 off 能力 |
| 缺失等级 | 按模型目录/未知模型安全默认处理，并提示未导入来源等级 |
| 未知或非法等级 | 不写入该来源值，模型保持关闭，并在结果中提示用户手工设置 |

若已有本地 `reasoningEfforts` 或 route-level `reasoning`：

- 不覆盖已有值。
- 若 CCSwitch 值与已有值不同，在导入结果中增加 warning。
- 只有首次导入、对应字段不存在时，才用 CCSwitch 值进行预填。

导入的 reasoning map 仍由用户在 DSH 模型页编辑；保存后 DSH 配置成为该字段的权威来源。

## 数据与所有权

### Host-only profile

解析后的 profile 允许包含明文 API key，但只能存在于 Host 调用链内：

`profileId`、`profileName`、`baseURL`、`api`、`models`、`modelReasoningEffort`、`apiKey`、`warnings`、`blockedReason`。

### Client summary

Client 只能收到：

`profileId`、`profileName`、`providerKey`、`baseURL`、`api`、`modelIds`、`modelCount`、`credential: found|missing|unsupported`、`reasoningEffort`、`status`、`warnings`、`blockedReason`。

禁止返回 API key、原始配置文本、数据库路径和凭据值。

### DSH settings ownership

- CCSwitch：只读导入源。
- DSH settings：导入后 provider/model/reasoning 的运行时权威配置。
- DSH credentials：API key 的唯一持久化位置；settings 只存 `apiKeyEnv` 引用。
- plugin：只拥有确定性 `ccs-*` provider 的导入字段和首次 reasoning seed，不拥有用户后续手工编辑。

## Host 架构

统一插件采用现有 CCSwitch core 作为导入基础，并迁移推理 helper 的纯领域逻辑。

Host entry 负责：

- 注入 `webServer`、`settings`、`credentials`。
- 注册 loopback + same-origin 保护的 `/api/dsh-ccswitch/scan` 和 `/api/dsh-ccswitch/import`。
- scan 时读取 CCSwitch 数据库并分类现有 DSH provider。
- import 时重新 scan、校验选择、写入 credential，再以 revision 写入 `llm-pi-ai`。
- settings 写失败时只回滚本次新建的凭据，不能删除或破坏原有凭据。
- 不把 API key 复制到异常、结果或日志。

导入 mapper 改为基于已有 provider 的非破坏合并：

- matching provider 的 endpoint、protocol、display name 和 source model 进行 upsert。
- matching model 保留现有 reasoning、容量和其它用户字段。
- 新 model 才应用 reasoning seed。
- source 未出现的已有 model 保留，不做删除。
- 非 CCSwitch provider 永远不覆盖。
- provider key 冲突继续使用确定性 variant key，并在摘要中明确警告。

## Client 架构

统一 Client entry 继续使用 DSH `window.__ModuleLoader__.load` bundle，依赖 runtime slots、settings/locale、connection API、remote invalidation 和 React。

复合 Models component 负责：

- 找到并渲染内置 Models entry。
- 创建 CCSwitch importer controller，维护 scan/import 的 transient state。
- 复用 reasoning controller，监听 settings/document-updated、credentials/updated、llm/adapters-updated 和 connection/reset。
- 样式只通过单文件 bundle 注入，不生成额外 CSS artifact。

Client 的 import controller 不保存 secret，也不把 raw response 复制到长期 state；只保存当前脱敏 summary、选择状态和结果。

## 迁移与发布

1. 以 `dsh-ccswitch-importer` 作为唯一 canonical package。
2. 将 reasoning helper 的 domain、controller、Models composite、样式和测试迁移到该包。
3. 补齐该包的 Host entry、Client entry、build、README、双语说明和发布文件清单。
4. 将 package name、plugin ID、Cordis patch ID、loader ID、安装文档统一为 `dsh-ccswitch-importer`。
5. 更新当前 DSH profile：移除旧 `dsh-model-reasoning-helper` 运行项，只保留合并后的插件。
6. 新包验证通过后，旧目录不再作为发布源；是否物理删除由后续清理提交单独处理。

## 测试与验收

### Core/Host tests

- TOML 能解析 `model_reasoning_effort` 及 inline comment。
- 合法、非法、缺失、off/none 等 reasoning 值映射正确。
- 已有 reasoning 配置在重复导入时保持不变，并产生冲突 warning。
- 新模型获得正确 seed，未知模型不虚假扩展能力。
- API key 不出现在 scan/import 返回值、异常和日志中。
- loopback/same-origin fence、body size cap、method guard 保持有效。
- settings conflict 时不删除已有 credentials。
- 导入 new/update/unchanged/blocked/failed 结果稳定、可重复。

### Client/GUI tests

- 「设置 → 模型」只有一个 Models 导航入口。
- 原生 Models provider editor 仍可用。
- CCSwitch 扫描、选择、导入、结果展示可完成。
- 导入后模型出现在同页推理区。
- 推理等级可启用/关闭、修改 wire value、保存并在模型选择器中出现。
- 页面刷新后导入配置和推理配置仍然存在。
- 不显示 API key、原始 TOML 或数据库路径。

### 发布检查

- `npm test`
- `npm run build`
- `npm run pack:check`
- `git diff --check`
- DSH GUI 实际刷新后手动验证导入和模型选择器。

## 设计自审

- **单一 owner：** 新包只有一个 Models section owner；旧推理插件不再加载，避免 duplicate shadow。
- **单一 secret owner：** credentials service 保存 key，Client 和 settings 文件都不接触明文。
- **非破坏导入：** re-import 只 upsert source-owned fields，保留用户 reasoning/model edits。
- **能力语义：** source 的单个 selected effort 不被误当成完整 capability list。
- **回滚边界：** settings 写失败不会删除此前存在的 credential。
- **发布边界：** 只安装和发布 `dsh-ccswitch-importer`。
