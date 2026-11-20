const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => {
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  });
  module._compile(outputText, filename);
};
const { approvalAdjustedUsd, projectedUsd, summarizePayouts, usdRangeText, inrRangeText } = require('../src/lib/payout.ts');
const range = projectedUsd(90, 80, 90);
assert.deepEqual(approvalAdjustedUsd(range, 'pending'), { min: 120, max: 135 });
assert.deepEqual(approvalAdjustedUsd(range, 'accepted'), { min: 135, max: 135 });
assert.deepEqual(approvalAdjustedUsd(range, 'rejected'), { min: 120, max: 120 });
assert.equal(usdRangeText(135, 135), '$135.00');
assert.equal(inrRangeText(120 * 94.94, 120 * 94.94), '₹11,393');
assert.equal(usdRangeText(120, 135), '$120.00 – $135.00');
const rows = [
  [15,80,90,'pending'], [30,80,90,'accepted'], [45,60,75,'rejected'],
  [60,100,120,'accepted'], [90,80,90,'pending'], [120,60,75,'accepted'],
  [150,100,120,'rejected'], [75,80,90,'accepted'], [105,60,75,'accepted'],
  [180,100,120,'accepted'], [240,80,90,'accepted'], [60,80,90,'rejected',false],
];
const tasks = rows.map(([timeSpentMinutes,minRate,maxRate,approvalStatus,statusShowOnBoard=true])=>({timeSpentMinutes,minRate,maxRate,approvalStatus,statusShowOnBoard}));
assert.deepEqual(summarizePayouts(tasks), { usdMin:1713.75, usdMax:1731.25, byStatusUsd:1573.75 });
assert.deepEqual(summarizePayouts(tasks.filter(t=>t.approvalStatus==='accepted')), { usdMin:1278.75, usdMax:1278.75, byStatusUsd:1278.75 });
assert.deepEqual(summarizePayouts(tasks.filter(t=>t.approvalStatus==='rejected')), { usdMin:295, usdMax:295, byStatusUsd:295 });
assert.deepEqual(summarizePayouts(tasks.filter(t=>t.approvalStatus==='pending')), { usdMin:140, usdMax:157.5, byStatusUsd:0 });
const partial = {timeSpentMinutes:1,timerRemainderMs:30000,minRate:60,maxRate:120,approvalStatus:'accepted'};
assert.deepEqual(summarizePayouts([partial]), {usdMin:3,usdMax:3,byStatusUsd:3});
assert.deepEqual(summarizePayouts([{...partial, approvalStatus:'rejected'}]), {usdMin:1.5,usdMax:1.5,byStatusUsd:1.5});
assert.deepEqual(summarizePayouts([{...partial, statusShowOnBoard:false}]), {usdMin:0,usdMax:0,byStatusUsd:0});
assert.deepEqual(summarizePayouts([]), {usdMin:0,usdMax:0,byStatusUsd:0});
console.log('Payout checks passed: review outcomes, demo totals, filtered totals, formatting, partial minutes, revoked and empty cases.');

const reviewTask = {taskType:'review',timeSpentMinutes:90,timerRemainderMs:30000,minRate:80,maxRate:120,approvalStatus:'pending',statusKanbanGroup:'completed'};
const fixed = 90.5 / 60 * 80;
for (const approvalStatus of ['pending','accepted','rejected']) {
  assert.deepEqual(summarizePayouts([{...reviewTask,approvalStatus}]),{usdMin:fixed,usdMax:fixed,byStatusUsd:fixed});
}
assert.deepEqual(summarizePayouts([{...reviewTask,statusKanbanGroup:'in_progress'}]),{usdMin:fixed,usdMax:fixed,byStatusUsd:0});
assert.deepEqual(summarizePayouts([{...reviewTask,statusShowOnBoard:false}]),{usdMin:0,usdMax:0,byStatusUsd:0});
console.log('Review fixed-rate checks passed, including partial minutes, approval independence, stage totals and revoked exclusion.');
