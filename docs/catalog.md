# DSH Community Market 目录接入

本插件按 [DSH Community Market 目录适配器指南（路径 A：标准来源）](https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/catalog-adapter-guide.zh.md) 提供标准目录接入。
只需要在两个公开 HTTPS 资源（同一 origin）上发布：

1. `catalog-source.json` —— [`catalog-source` manifest][source-schema]，供用户在 设置 > 插件 > 来源 中登记。
2. `GET /v1/plugins` —— 返回符合 [`catalog-provider-page` Schema][page-schema] 的 JSON。

[source-schema]: https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/schemas/catalog-source.schema.json
[page-schema]: https://github.com/anywhere-labs/deepseek-harness-desktop/blob/master/dsh-community-market/docs/schemas/catalog-provider-page.schema.json

## 生成目录文件

```bash
DSH_CATALOG_ORIGIN=https://catalog.example.com npm run build:catalog
```

脚本读取 `package.json` 元数据并生成：

- `catalog/catalog-source.json`：manifest，`transport.endpoint` 为 `${DSH_CATALOG_ORIGIN}/v1/plugins`。
- `catalog/v1/plugins.json`：插件条目页，条目同时携带 npm `package` 身份与 `repository` 身份。

生成的目录文件已加入 `.gitignore`：它们包含部署 origin，应在发布时从部署环境生成，而不是把占位 endpoint 提交进仓库。

## 部署要求

Market Host 的受限 HTTP client 会**强制校验响应 `Content-Type` 为 `application/json` 或 `application/*+json`**，并且最多允许 3 次同 origin 重定向。无扩展名的 `/v1/plugins` 文件在 GitHub Pages / raw.githubusercontent.com 上会以 `application/octet-stream` 返回并被拒绝，因此不能直接使用这两种托管。

可选部署方式（任选其一，保证 JSON Content-Type 与 HTTPS 标准端口）：

### Cloudflare Pages

一键部署（需先完成一次 `npx wrangler login` 浏览器授权）：

```bash
DSH_CATALOG_ORIGIN=https://dsh-ccswitch-importer-catalog.pages.dev \
  bash scripts/deploy-catalog.sh
```

脚本会生成目录文件并写入 `_headers` / `_redirects`，把 `/v1/plugins` 重写到 `v1/plugins.json`（保证 JSON Content-Type）。也可以手动放入生成文件并添加以下文件：

```text
# _redirects
/v1/plugins  /v1/plugins.json  200
```

或（直接托管无扩展名文件时）：

```text
# _headers
/v1/plugins
  Content-Type: application/json
```

### Netlify

```toml
# netlify.toml
[[redirects]]
from = "/v1/plugins"
to = "/v1/plugins.json"
status = 200
```

### Nginx（自有服务器）

```nginx
location = /v1/plugins {
  alias /srv/catalog/v1/plugins.json;
  default_type application/json;
}

location = /catalog-source.json {
  alias /srv/catalog/catalog-source.json;
  default_type application/json;
}
```

## 登记来源

在 DSH Desktop 中打开 设置 > 插件 > 插件市场 > 来源，添加 manifest URL（例如 `https://catalog.example.com/catalog-source.json`）。

## 受管安装（可安装列表）

Market 的 **可安装** 列表要求条目同时满足：

- 精确稳定的 npm 版本（`latestVersion`）；
- 官方 npm registry 中可解析、与 `package` 身份一致的包；
- 目标 manifest 中没有 `preinstall` / `install` / `postinstall` / `prepare` 脚本；
- 与内置 DSH rc.7 与 Node.js runtime 兼容。

因此若要让本插件进入 **可安装** 视图，需要先把 `dsh-ccswitch-importer` 发布到 npm registry（当前未发布）。仅用于 **发现** 视图时，`repository` 身份已足够。

## dshfind 收录

[dshfind](https://dshfind.com) 是另一个合作目录来源，它通过 GitHub topic [`dsh-plugin`](https://github.com/topics/dsh-plugin) 自动聚合插件，并按约每日同步（02:17 UTC 或维护者手动触发 `gh workflow run sync-plugins.yml`）。

`wtiaw/dsh-ccswitch-importer` 已添加 topics：`dsh-plugin`、`cc-switch`、`codex`、`import`、`reasoning`、`settings`。`dsh-plugin` 用于被 dshfind 收录；其余 topic 会成为插件标签（生态标记类不会被采用）。新增标签后，出现在 dshfind 的 DSH Market 来源中需等下一次数据刷新。

注意：Market 的 dshfind adapter 目前不提供精确稳定的 npm 版本，因此 dshfind 条目**仅出现在「发现」视图**，不会进入「可安装」列表。

## 校验与测试

- `npm test` 会运行 `test/catalog.test.mjs`：用官方 Schema 校验生成的 manifest 与 page，并断言条目与 `package.json` 元数据一致。
- Schema 副本存放在 `test/fixtures/`，来源为 anywhere-labs/deepseek-harness-desktop（MIT 许可的 dsh-community-market 项目）。
