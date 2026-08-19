import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { buildCatalog } from '../scripts/build-catalog.mjs';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const sourceSchema = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/catalog-source.schema.json'), 'utf8'));
const pageSchema = JSON.parse(readFileSync(join(ROOT, 'test/fixtures/catalog-provider-page.schema.json'), 'utf8'));
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));

function makeAjv() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv;
}

const TEST_ORIGIN = 'https://catalog.example.com';

test('manifest follows the official catalog-source schema', () => {
  const { manifest } = buildCatalog({ origin: TEST_ORIGIN });
  const validate = makeAjv().compile(sourceSchema);
  assert.equal(validate(manifest), true, JSON.stringify(validate.errors ?? [], null, 2));
  assert.equal(manifest.transport.endpoint, TEST_ORIGIN + '/v1/plugins');
  assert.match(manifest.providerId, /^[a-z0-9]+(?:[.-][a-z0-9]+)+$/);
});

test('plugin page follows the official catalog-provider-page schema', () => {
  const { page } = buildCatalog({ origin: TEST_ORIGIN });
  const validate = makeAjv().compile(pageSchema);
  assert.equal(validate(page), true, JSON.stringify(validate.errors ?? [], null, 2));
});

test('catalog entry stays consistent with package metadata', () => {
  const { page } = buildCatalog({ origin: TEST_ORIGIN });
  assert.equal(page.items.length, 1);
  const item = page.items[0];
  assert.equal(item.id, pkg.name);
  assert.equal(item.name, pkg.name);
  assert.equal(item.package.name, pkg.name);
  assert.equal(item.package.registry, 'npm');
  assert.equal(item.latestVersion, pkg.version);
  assert.equal(item.license, pkg.license);
  const repositoryUrl = pkg.repository.url.replace(/^git\+/, '').replace(/\.git$/, '');
  assert.equal(item.repository.url, repositoryUrl);
  assert.equal(item.homepage, repositoryUrl);
  assert.equal(item.publisher.name, repositoryUrl.replace(/^https:\/\/github\.com\//, '').split('/')[0]);
  assert.equal(item.categories.length, 3);
  for (const category of item.categories) assert.match(category, /^[a-z0-9][a-z0-9._:-]*$/);
  assert.equal(page.page.nextCursor, undefined);
});

test('rejects a non-https or path-bearing origin', () => {
  for (const origin of ['http://catalog.example.com', 'https://example.com/base', 'https://example.com/v1/plugins']) {
    assert.throws(() => buildCatalog({ origin }));
  }
});

test('generated manifest and page form a coherent source pair', () => {
  const { manifest, page } = buildCatalog({ origin: TEST_ORIGIN });
  assert.equal(manifest.schemaVersion, undefined);
  assert.equal(page.schemaVersion, '1.0.0');
  assert.equal(manifest.transport.method, 'GET');
  assert.deepEqual(manifest.query.supported, ['q', 'category', 'cursor', 'limit']);
  assert.equal(page.revision, 'v' + pkg.version);
});
