/* Integration tests use a disposable database in the private local cluster. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const { Client } = require('pg');
const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, '.local/database.json'), 'utf8'));
const database = `annotation_focus_test_${process.pid}_${Date.now()}`;
const connection = { host: '127.0.0.1', port: config.port, user: config.user, password: config.password };
const admin = new Client({ ...connection, database: 'postgres' });
let client, pool;
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  if (name.startsWith('@/')) name = path.join(root, 'src', name.slice(2));
  if (name.startsWith('@database/')) name = path.join(root, 'database', name.slice(10));
  return resolve.call(this, name, ...args);
};
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  });
  module._compile(output.outputText, filename);
};
async function invoke(route, body, id, expected = 200, method = 'POST') {
  const response = await route[method](new Request('http://localhost/test', {
    method, ...(method !== 'GET' ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
  }), { params: Promise.resolve({ id }) });
  const result = await response.json();
  assert.equal(response.status, expected, JSON.stringify(result));
  return result;
}
(async () => {
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  try {
    client = new Client({ ...connection, database }); await client.connect();
    for (const entry of JSON.parse(fs.readFileSync(path.join(root, 'database/migrations/meta/_journal.json'))).entries) {
      await client.query(fs.readFileSync(path.join(root, `database/migrations/${entry.tag}.sql`), 'utf8'));
    }
    process.env.DATABASE_URL = `postgresql://${encodeURIComponent(config.user)}:${encodeURIComponent(config.password)}@127.0.0.1:${config.port}/${database}`;
    const create = require(path.join(root, 'src/app/api/tasks/route.ts'));
    const timer = require(path.join(root, 'src/app/api/tasks/[id]/timer/route.ts'));
    const adjust = require(path.join(root, 'src/app/api/tasks/[id]/adjust-minutes/route.ts'));
    const detail = require(path.join(root, 'src/app/api/tasks/[id]/route.ts'));
    pool = require(path.join(root, 'database/client.ts')).pool;
    const { elapsedMilliseconds } = require(path.join(root, 'src/lib/focus-timer.ts'));
    const { rows: [project] } = await client.query("INSERT INTO projects(name,min_rate,max_rate) VALUES ('Focus test',80,90) RETURNING id");
    let task = await invoke(create, { projectId: project.id }, null, 201);
    assert.equal(task.activeFocus, true);
    await invoke(create, { projectId: project.id }, null, 409);
    task = await invoke(timer, { action: 'start' }, task.id);
    const originalStart = task.startAt;
    assert.ok(originalStart); assert.ok(task.timerStartedAt);
    await invoke(timer, { action: 'start' }, task.id, 409);
    await client.query("UPDATE tasks SET timer_started_at = clock_timestamp() - interval '3.5 seconds' WHERE id=$1", [task.id]);
    task = await invoke(timer, { action: 'pause' }, task.id);
    assert.equal(task.timeSpentMinutes, 0); assert.ok(task.timerRemainderMs >= 3500 && task.timerRemainderMs < 5000);
    assert.equal(task.endAt, null); assert.equal(task.startAt, originalStart);
    task = await invoke(adjust, { delta: 30 }, task.id);
    assert.equal(task.timeSpentMinutes, 30);
    task = await invoke(timer, { action: 'save', fields: { notes: 'Persist across breaks', minRate: 80, maxRate: 90, taskNumber: 11, taskType: 'review', reviewWorkerEmail: 'test@example.invalid', taskerDecision: 'pass' } }, task.id);
    assert.equal(task.minRate, 80); assert.equal(task.maxRate, 80);
    const savedMs = elapsedMilliseconds(task, Date.now());
    task = await invoke(detail, null, task.id, 200, 'GET');
    assert.equal(elapsedMilliseconds(task, Date.now() + 3600000), savedMs);
    assert.equal(task.notes, 'Persist across breaks'); assert.equal(task.taskType, 'review');
    assert.equal(task.taskerDecision, 'pass'); assert.equal(task.timerStartedAt, null);
    task = await invoke(timer, { action: 'resume' }, task.id);
    assert.equal(task.startAt, originalStart);
    assert.ok(elapsedMilliseconds(task, Date.now()) >= savedMs);
    await client.query("UPDATE tasks SET timer_started_at = clock_timestamp() - interval '1.5 seconds' WHERE id=$1", [task.id]);
    task = await invoke(timer, { action: 'save' }, task.id);
    assert.ok(task.timerStartedAt); assert.ok(elapsedMilliseconds(task, Date.now()) >= savedMs + 1500);
    task = await invoke(timer, { action: 'pause' }, task.id);
    const beforeAdjust = elapsedMilliseconds(task, Date.now());
    await Promise.all([invoke(adjust, { delta: 1 }, task.id), invoke(adjust, { delta: 2 }, task.id)]);
    task = await invoke(detail, null, task.id, 200, 'GET');
    assert.equal(elapsedMilliseconds(task, Date.now()), beforeAdjust + 180000);
    await invoke(adjust, { delta: 'Infinity' }, task.id, 400);
    task = await invoke(timer, { action: 'complete' }, task.id);
    assert.ok(task.endAt); assert.equal(task.timerStartedAt, null); assert.equal(task.activeFocus, false);
    assert.equal(task.approvalStatus, 'pending'); assert.equal(task.startAt, originalStart);
    await invoke(timer, { action: 'resume' }, task.id, 409);
    await invoke(timer, { action: 'reset' }, task.id, 409);
    const responses = await Promise.all([1, 2].map(async () => {
      const response = await create.POST(new Request('http://localhost/test', { method: 'POST', body: JSON.stringify({ projectId: project.id }), headers: { 'Content-Type': 'application/json' } }));
      return { status: response.status, row: await response.json() };
    }));
    assert.deepEqual(responses.map(response => response.status).sort(), [201, 409]);
    let next = responses.find(response => response.status === 201).row; assert.ok(next.taskNumber > 11);
    next = await invoke(timer, { action: 'start' }, next.id);
    await client.query("UPDATE tasks SET timer_started_at = clock_timestamp() - interval '2 minutes' WHERE id=$1", [next.id]);
    next = await invoke(adjust, { delta: -100 }, next.id);
    assert.equal(next.timeSpentMinutes, 0); assert.equal(next.timerRemainderMs, 0); assert.ok(next.timerStartedAt);
    const nextStart = next.startAt;
    await client.query("UPDATE tasks SET timer_started_at = clock_timestamp() - interval '65 seconds' WHERE id=$1", [next.id]);
    next = await invoke(timer, { action: 'reset' }, next.id);
    assert.equal(elapsedMilliseconds(next, Date.now() + 3600000), 0);
    assert.equal(next.timerStartedAt, null); assert.equal(next.startAt, nextStart);
    assert.equal(next.activeFocus, true); assert.equal(next.endAt, null);
    next = await invoke(adjust, { delta: 5 }, next.id);
    next = await invoke(timer, { action: 'save', fields: { notes: 'Keep on reset' } }, next.id);
    next = await invoke(timer, { action: 'reset' }, next.id);
    next = await invoke(detail, null, next.id, 200, 'GET');
    assert.equal(next.timeSpentMinutes, 0); assert.equal(next.timerRemainderMs, 0);
    assert.equal(next.timerStartedAt, null); assert.equal(next.notes, 'Keep on reset');
    assert.equal(next.minRate, 80); assert.equal(next.maxRate, 90);
    assert.equal(next.startAt, nextStart);
    next = await invoke(timer, { action: 'resume' }, next.id);
    await client.query("UPDATE tasks SET timer_started_at = clock_timestamp() - interval '65 seconds' WHERE id=$1", [next.id]);
    next = await invoke(timer, { action: 'complete' }, next.id);
    assert.equal(next.timeSpentMinutes, 1); assert.ok(next.timerRemainderMs >= 5000); assert.ok(next.endAt);
    console.log('PASS: single-active-task enforcement, concurrent creation/adjustments, precise pause/resume, save/reload, live checkpoints, review fields, task numbering, deduction clamp, paused/running reset persistence, paused/running completion.');
  } finally {
    if (pool) await pool.end();
    if (client) await client.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
