import test from 'node:test';
import assert from 'node:assert/strict';
import { decideDeposit, decideSubmittedWithdrawal, interpretReceipt, isTxHash } from '../src/chain-rules.js';
import { computeFee } from '../src/fee-math.js';

test('receipt interpretation', () => {
  assert.deepEqual(interpretReceipt(null, 100n), { state: 'not_found' });
  assert.deepEqual(interpretReceipt({ status: '0x1', blockNumber: '0x64' }, 110n), { state: 'success', confirmations: 11n });
  assert.deepEqual(interpretReceipt({ status: '0x0', blockNumber: '0x64' }, 100n), { state: 'reverted', confirmations: 1n });
  assert.throws(() => interpretReceipt({ status: 'x' }, 1n));
});

test('deposits are credited only after enough confirmations', () => {
  assert.equal(decideDeposit({ state: 'not_found' }, 3), 'wait');
  assert.equal(decideDeposit({ state: 'success', confirmations: 2n }, 3), 'wait');
  assert.equal(decideDeposit({ state: 'success', confirmations: 3n }, 3), 'credit');
  assert.equal(decideDeposit({ state: 'reverted', confirmations: 5n }, 3), 'fail');
});

test('withdrawals: never refund on shallow revert; unknown tx goes to review, not refund', () => {
  const s = (st: 'success' | 'reverted', c: bigint) => ({ state: st, confirmations: c }) as const;
  assert.equal(decideSubmittedWithdrawal(s('reverted', 1n), 10, 12, 3600), 'wait');
  assert.equal(decideSubmittedWithdrawal(s('reverted', 12n), 10, 12, 3600), 'refund');
  assert.equal(decideSubmittedWithdrawal(s('success', 12n), 10, 12, 3600), 'confirm');
  assert.equal(decideSubmittedWithdrawal({ state: 'not_found' }, 100, 12, 3600), 'wait');
  assert.equal(decideSubmittedWithdrawal({ state: 'not_found' }, 4000, 12, 3600), 'review');
});

test('tx hash format', () => {
  assert.equal(isTxHash('0x' + 'a'.repeat(64)), true);
  assert.equal(isTxHash('0xabc'), false);
});

const rule = { percentageBps: 150n, fixedMinor: 30n, minimumMinor: null, maximumMinor: null, providerCostBps: 50n, providerCostFixedMinor: 10n };
test('fee math rounds up, adds fixed, clamps', () => {
  assert.deepEqual(computeFee(10_000n, rule), { feeMinor: 180n, providerCostMinor: 60n }); // 1.5% of $100 + $0.30
  assert.equal(computeFee(1n, rule).feeMinor, 31n); // ceil(0.015)=1, +30
  assert.equal(computeFee(10_000n, { ...rule, minimumMinor: 500n }).feeMinor, 500n);
  assert.equal(computeFee(10_000n, { ...rule, maximumMinor: 100n }).feeMinor, 100n);
  assert.throws(() => computeFee(0n, rule));
});
