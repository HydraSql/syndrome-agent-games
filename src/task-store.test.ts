import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, stat, readdir, writeFile, chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';

test('process exit leaves durable pending for explicit reconciliation', async () => {
  const directory = await mkdtemp(join(scratch, 'task-store-crash-'));
  try {
    const moduleUrl = new URL('./task-store.ts', import.meta.url).href;
    const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
      `import {TaskStore} from ${JSON.stringify(moduleUrl)};
       await new TaskStore(process.argv[1]).run('crash', Buffer.from('raw'), async () => {process.exit(23);});`,
      directory], {encoding: 'utf8', timeout: 10000});
    assert.equal(child.error, undefined);
    assert.equal(child.status, 23, child.stderr);
    const store = new TaskStore(directory);
    await assert.rejects(store.run('crash', Buffer.from('raw'), async () => {assert.fail('must not execute again');}), /RECONCILIATION_REQUIRED/);
    await store.recover('crash', Buffer.from('raw'), response);
    assert.deepEqual(await store.run('crash', Buffer.from('raw'), async () => {assert.fail('must reuse response');}), response);
    assert.deepEqual(await store.recover('crash', Buffer.from('raw'), {...response, body: 'replacement'}), response);
  } finally {await rm(directory, {recursive: true, force: true});}
});
import {TaskStore} from './task-store.js';

const scratch = process.env.TMPDIR ?? '/home/syndrome/.hermes/cache/scratch';
test('parallel instances execute once and failed tasks require explicit recovery', async () => {
  const directory = await mkdtemp(join(scratch, 'task-store-'));
  try {
    let calls = 0;
    const stores = [new TaskStore(directory), new TaskStore(directory)];
    const results = await Promise.all(Array.from({length: 20}, (_, i) => stores[i % 2].run('parallel', Buffer.from('x'), async () => {
      calls++; await new Promise(resolve => setTimeout(resolve, 10)); return response;
    })));
    assert.equal(calls, 1);
    results.forEach(result => assert.deepEqual(result, response));
    await assert.rejects(stores[0].run('failed', Buffer.from('y'), async () => {throw Error('interrupted');}), /interrupted/);
    const reopened = new TaskStore(directory);
    await assert.rejects(reopened.run('failed', Buffer.from('y'), async () => {calls++; return response;}), /RECONCILIATION_REQUIRED/);
    await assert.rejects(reopened.recover('failed', Buffer.from('changed'), response), /TASK_BODY_CONFLICT/);
    await reopened.recover('failed', Buffer.from('y'), response);
    assert.deepEqual(await reopened.run('failed', Buffer.from('y'), async () => {calls++; return response;}), response);
    assert.equal(calls, 1);
    await assert.rejects(reopened.recover('missing', Buffer.from('x'), response), /TASK_NOT_FOUND/);
    for (const file of await readdir(directory)) {
      assert.match(file, /^[a-f0-9]{64}\.json$/);
      assert.equal((await stat(join(directory, file))).mode & 0o777, 0o600);
    }
  } finally {await rm(directory, {recursive: true, force: true});}
});

test('corrupt records and non-private directories fail closed', async () => {
  const directory = await mkdtemp(join(scratch, 'task-store-'));
  try {
    const store = new TaskStore(directory);
    await store.run('task', Buffer.from('x'), async () => response);
    const [file] = await readdir(directory);
    await writeFile(join(directory, file), '{broken');
    await assert.rejects(store.run('task', Buffer.from('x'), async () => response), /TASK_STORE_CORRUPT/);
    await chmod(directory, 0o755);
    await assert.rejects(store.run('new', Buffer.from('x'), async () => response), /NOT_PRIVATE/);
  } finally {await rm(directory, {recursive: true, force: true});}
});

const response = {statusCode: 200, headers: {'content-type': 'application/json'}, body: '{"ok":true}'};

test('completed response survives reopening and binds ID to exact body bytes', async () => {
  const directory = await mkdtemp(join(scratch, 'task-store-'));
  try {
    let calls = 0;
    const first = new TaskStore(directory);
    assert.deepEqual(await first.run('../task', Buffer.from('{}'), async () => {calls++; return response;}), response);
    const reopened = new TaskStore(directory);
    assert.deepEqual(await reopened.run('../task', Buffer.from('{}'), async () => {calls++; return response;}), response);
    await assert.rejects(reopened.run('../task', Buffer.from('{} '), async () => response), /TASK_BODY_CONFLICT/);
    assert.equal(calls, 1);
    assert.equal((await stat(directory)).mode & 0o777, 0o700);
  } finally {await rm(directory, {recursive: true, force: true});}
});
