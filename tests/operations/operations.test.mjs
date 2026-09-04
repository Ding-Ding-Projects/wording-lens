import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const operations = await import('../../.operations-build/index.js');

test('previews destructive work and requires two independent confirmation keys', async () => {
  const request = { kind: 'file', input: { action: 'delete', path: join(tmpdir(), 'operations-preview.txt') } };
  const preview = operations.previewOperation(request);
  assert.equal(preview.destructive, 'destructive');
  assert.equal(preview.requiresConfirmation, true);
  const result = await operations.executeOperation(request);
  assert.equal(result.status, 'failed');
  assert.equal(result.error.code, 'not-allowed');
});

test('writes and reads a temporary file, then deletes only with confirmation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wording-lens-operations-'));
  const path = join(root, 'nested', 'value.txt');
  try {
    const write = await operations.executeOperation({ kind: 'file', input: { action: 'write', path, content: 'hello', overwrite: false } });
    assert.equal(write.status, 'succeeded');
    const read = await operations.executeOperation({ kind: 'file', input: { action: 'read', path } });
    assert.equal(read.value, 'hello');
    const remove = await operations.executeOperation({
      kind: 'file',
      input: { action: 'delete', path },
      confirmation: { firstKey: 'first', secondKey: 'second', sliderComplete: true },
    });
    assert.equal(remove.status, 'succeeded');
    await assert.rejects(readFile(path));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('uses only loopback HTTP for Ollama and rejects embedded credentials', async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return new Response(JSON.stringify({ models: [{ name: 'local-model' }] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  try {
    const result = await operations.executeOperation({ kind: 'ollama-http', input: { action: 'tags', baseUrl: 'http://127.0.0.1:11434' } });
    assert.equal(result.status, 'succeeded');
    assert.equal(calls[0].url, 'http://127.0.0.1:11434/api/tags');
    const rejected = await operations.executeOperation({ kind: 'ollama-http', input: { action: 'tags', baseUrl: 'https://user:password@example.invalid' } });
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.error.code, 'unknown');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Home Assistant resolves its credential in memory and sends it only as an Authorization header', async () => {
  const server = createServer((request, response) => {
    if (request.url?.endsWith('/input_boolean.redirect')) {
      response.writeHead(302, { location: '/api/states/input_boolean.example' });
      response.end();
      return;
    }
    assert.equal(request.headers.authorization, 'Bearer in-memory-test-value');
    assert.equal(request.url, '/api/states/input_boolean.example');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ entity_id: 'input_boolean.example', state: 'on' }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    const result = await operations.executeOperation(
      { kind: 'home-assistant-http', input: { action: 'get-state', baseUrl, entityId: 'input_boolean.example' } },
      { resolveHomeAssistantToken: async () => 'in-memory-test-value' },
    );
    assert.equal(result.status, 'succeeded');
    const redirected = await operations.executeOperation(
      { kind: 'home-assistant-http', input: { action: 'get-state', baseUrl, entityId: 'input_boolean.redirect' } },
      { resolveHomeAssistantToken: async () => 'in-memory-test-value' },
    );
    assert.equal(redirected.status, 'failed');
    const missingResolver = await operations.executeOperation({ kind: 'home-assistant-http', input: { action: 'get-state', baseUrl, entityId: 'input_boolean.example' } });
    assert.equal(missingResolver.status, 'failed');
    assert.equal(missingResolver.error.code, 'not-allowed');
  } finally {
    await new Promise((resolve, reject) => server.close((cause) => cause ? reject(cause) : resolve()));
  }
});

test('writes and copies with overwrite enabled are destructive and require explicit confirmation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wording-lens-overwrite-'));
  const source = join(root, 'source.txt');
  const destination = join(root, 'destination.txt');
  try {
    const writePreview = operations.previewOperation({ kind: 'file', input: { action: 'write', path: destination, content: 'replace me' } });
    assert.equal(writePreview.destructive, 'destructive');
    const refusedWrite = await operations.executeOperation({ kind: 'file', input: { action: 'write', path: destination, content: 'replace me' } });
    assert.equal(refusedWrite.error.code, 'not-allowed');
    const firstWrite = await operations.executeOperation({ kind: 'file', input: { action: 'write', path: destination, content: 'original', overwrite: false } });
    assert.equal(firstWrite.status, 'succeeded');
    const overwrite = await operations.executeOperation({ kind: 'file', input: { action: 'write', path: destination, content: 'updated' }, confirmation: { firstKey: 'one', secondKey: 'two', sliderComplete: true } });
    assert.equal(overwrite.status, 'succeeded');
    const copyPreview = operations.previewOperation({ kind: 'file', input: { action: 'copy', source, destination } });
    assert.equal(copyPreview.destructive, 'destructive');
    const refusedCopy = await operations.executeOperation({ kind: 'file', input: { action: 'copy', source, destination } });
    assert.equal(refusedCopy.error.code, 'not-allowed');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('durable queue persists, executes, and recovers a running operation', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wording-lens-queue-'));
  const filePath = join(root, 'queue', 'operations.json');
  try {
    const executor = async (request) => ({ operationId: request.operationId, status: 'succeeded', value: { ok: true }, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString(), attempts: 1 });
    const queue = new operations.DurableOperationQueue({ filePath, executor });
    const queued = await queue.enqueue({ kind: 'file', input: { action: 'read', path: join(root, 'missing.txt') } });
    for (let i = 0; i < 20; i += 1) {
      const state = (await queue.list()).find((item) => item.id === queued.id);
      if (state?.state === 'succeeded') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal((await queue.list()).find((item) => item.id === queued.id)?.state, 'succeeded');
    const raw = JSON.parse(await readFile(filePath, 'utf8'));
    raw.operations.push({ id: 'recovery-id', request: { kind: 'file', input: { action: 'read', path: join(root, 'missing.txt') } }, state: 'running', attempts: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    await import('node:fs/promises').then(({ writeFile }) => writeFile(filePath, JSON.stringify(raw), 'utf8'));
    const recovered = new operations.DurableOperationQueue({ filePath, executor });
    await recovered.recover();
    for (let i = 0; i < 20; i += 1) {
      const state = (await recovered.list()).find((item) => item.id === 'recovery-id');
      if (state?.state === 'succeeded') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert.equal((await recovered.list()).find((item) => item.id === 'recovery-id')?.state, 'succeeded');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('durable queue refuses to persist process environment values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wording-lens-queue-secret-'));
  try {
    const queue = new operations.DurableOperationQueue({ filePath: join(root, 'queue.json'), executor: async () => { throw new Error('not reached'); } });
    await assert.rejects(queue.enqueue({ kind: 'process', input: { action: 'run', executable: 'git', environment: { ACCESS_TOKEN: 'not persisted' } } }), /cannot be durably queued/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('process adapter refuses shell-evaluation flags instead of accepting command text', async () => {
  const result = await operations.executeOperation({ kind: 'process', input: { action: 'run', executable: 'git', args: ['-c', 'status'] } });
  assert.equal(result.status, 'failed');
  assert.match(result.error.message, /Shell evaluation arguments are not allowed/);
});
