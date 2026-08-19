import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PACKAGE_PATH = join(ROOT, "package.json");
const OUT_DIR = join(ROOT, "catalog");

const categoryId = /^[a-z0-9][a-z0-9._:-]*$/;

function assertCategory(value) {
  if (!categoryId.test(value)) throw new Error(`invalid category: ${value}`);
  return value;
}

export function buildCatalog({ origin, now = new Date() }) {
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, "utf8"));
  if (!origin || !/^https:\/\/[^/?#\s]+$/.test(origin)) {
    throw new Error("origin must be an https origin without path (e.g. https://catalog.example.com)");
  }
  const repositoryUrl = (pkg.repository?.url ?? "").replace(/^git\+/, "").replace(/\.git$/, "");
  if (!/^https:\/\/github\.com\//.test(repositoryUrl)) {
    throw new Error(`unsupported repository url: ${repositoryUrl}`);
  }
  const publisherName = repositoryUrl.replace(/^https:\/\/github\.com\//, "").split("/")[0];
  const manifest = {
    manifestVersion: "1.0.0",
    providerId: `com.github.${publisherName}.${pkg.name}`,
    name: `${pkg.name} catalog`,
    description: `Standard DSH Community Market source for ${pkg.name}.`,
    homepage: repositoryUrl,
    attribution: {
      name: publisherName,
      url: repositoryUrl,
    },
    transport: {
      kind: "https-json",
      endpoint: `${origin}/v1/plugins`,
      method: "GET",
    },
    query: {
      supported: ["q", "category", "cursor", "limit"],
      defaultLimit: 50,
      maxLimit: 50,
      sorts: [],
    },
  };
  const page = {
    schemaVersion: "1.0.0",
    generatedAt: now.toISOString(),
    revision: `v${pkg.version}`,
    items: [{
      id: pkg.name,
      name: pkg.name,
      displayName: "DSH CC Switch Importer",
      summary: pkg.description,
      description: [
        "Import CC Switch Codex profiles into DSH as llm-pi-ai providers.",
        "Configure per-model reasoning effort, wire mapping and disabled/enabled modes",
        "directly from the reasoning settings UI.",
      ].join(" "),
      homepage: repositoryUrl,
      latestVersion: pkg.version,
      license: pkg.license,
      categories: [assertCategory("settings"), assertCategory("models"), assertCategory("import")],
      keywords: ["cc-switch", "codex", "reasoning", "import", "settings"],
      repository: { url: repositoryUrl },
      package: { registry: "npm", name: pkg.name },
      publisher: { name: publisherName, url: repositoryUrl },
      updatedAt: now.toISOString(),
    }],
    page: {},
  };
  return { manifest, page };
}

function writeCatalog() {
  const origin = process.env.DSH_CATALOG_ORIGIN?.trim();
  if (!origin) {
    throw new Error("DSH_CATALOG_ORIGIN is required (e.g. https://catalog.wtiaw.dev)");
  }
  const { manifest, page } = buildCatalog({ origin });
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(join(OUT_DIR, "v1"), { recursive: true });
  writeFileSync(join(OUT_DIR, "catalog-source.json"), JSON.stringify(manifest, null, 2) + "\n");
  writeFileSync(join(OUT_DIR, "v1", "plugins.json"), JSON.stringify(page, null, 2) + "\n");
  console.log(`wrote ${join(OUT_DIR, "catalog-source.json")} (endpoint ${manifest.transport.endpoint})`);
  console.log(`wrote ${join(OUT_DIR, "v1", "plugins.json")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeCatalog();
}