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
    const { rows: [completed] } = await client.query("SELECT id FROM statuses WHERE kanban_group='completed' AND show_on_board=true LIMIT 1");
    const base = { projectId: project.id, statusId: completed.id };
    const annotation = await invoke(create, base, null, 201);
    assert.equal(annotation.name, 'Task 1');
    const review = await invoke(create, { ...base, taskType: 'review' }, null, 201);
    assert.equal(review.name, 'Review 1');
    const review2 = await invoke(create, { ...base, taskType: 'review' }, null, 201);
    assert.equal(review2.name, 'Review 2');
    const named = await invoke(create, { ...base, name: '  Image quality audit  ' }, null, 201);
    assert.equal(named.name, 'Image quality audit');
    const third = await invoke(create, base, null, 201);
    assert.equal(third.name, 'Task 3');
    const edited = await invoke(detail, { name: 'Custom review', taskType: 'review' }, named.id, 200, 'PATCH');
    assert.equal(edited.name, 'Custom review');
    assert.equal(edited.taskType, 'review');
    assert.equal(edited.taskNumber, named.taskNumber);
    const converted = await invoke(detail, { taskType: 'review' }, third.id, 200, 'PATCH');
    assert.equal(converted.name, 'Review 4');
    const reloaded = await invoke(detail, null, named.id, 200, 'GET');
    assert.equal(reloaded.name, 'Custom review');
    await invoke(create, { ...base, taskType: 'invalid' }, null, 400);
    await invoke(detail, { name: 123 }, named.id, 400, 'PATCH');
    const blank = await invoke(detail, { name: ' ' }, review.id, 200, 'PATCH');
    assert.equal(blank.name, 'Review 1');
    assert.equal(review.taskerDecision, null);
    const reviewData = { reviewWorkerEmail: 'worker@example.invalid', reviewJustification: 'Accurate reasoning', taskerFeedback: 'Explain edge cases', taskerDecision: 'fail' };
    const updatedReview = await invoke(detail, reviewData, review.id, 200, 'PATCH');
    for (const [key, value] of Object.entries(reviewData)) assert.equal(updatedReview[key], value);
    const { summarizePayouts } = require(path.join(root, 'src/lib/payout.ts'));
    assert.deepEqual(summarizePayouts([updatedReview]), summarizePayouts([review]));
    const readReview = await invoke(detail, null, review.id, 200, 'GET');
    assert.equal(readReview.taskerFeedback, reviewData.taskerFeedback);
    const cleared = await invoke(detail, { taskerDecision: null }, review.id, 200, 'PATCH');
    assert.equal(cleared.taskerDecision, null);
    await invoke(detail, { taskerDecision: 'accepted' }, review.id, 400, 'PATCH');
    const createdReview = await invoke(create, { ...base, taskType: 'review', ...reviewData }, null, 201);
    assert.equal(createdReview.reviewJustification, reviewData.reviewJustification);
    assert.equal(createdReview.taskerDecision, 'fail');
    const fixedReview = await invoke(create, { ...base, taskType: 'review', minRate: 85, maxRate: 120 }, null, 201);
    assert.equal(fixedReview.minRate, 85); assert.equal(fixedReview.maxRate, 85);
    const changedRate = await invoke(detail, { minRate: 100 }, fixedReview.id, 200, 'PATCH');
    assert.equal(changedRate.minRate, 100); assert.equal(changedRate.maxRate, 100);
    console.log('PASS: review details persist, decisions default to null and can be cleared, compensation unchanged.');
    console.log('PASS: separate default numbering, custom names, trimming, reload persistence, type changes, stable IDs, validation, blank-name fallback.');
  } finally {
    if (pool) await pool.end();
    if (client) await client.end();
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
