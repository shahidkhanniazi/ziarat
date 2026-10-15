import test from 'node:test';
import assert from 'node:assert/strict';
import { computeAssetFee, maxSendable } from '../src/fee-math.js';

const usdt = { percentageBps: 50n, minFeeMinor: 1_000_000n, maxFeeMinor: 25_000_000n }; // 0.5%, min 1, max 25 (6 dec)

test('asset fee: percentage, floor, cap, rounding up', () => {
  assert.equal(computeAssetFee(100_000_000n, usdt), 1_000_000n); // 100 USDT -> 0.5 -> floor 1
  assert.equal(computeAssetFee(1_000_000_000n, usdt), 5_000_000n); // 1000 USDT -> 5
  assert.equal(computeAssetFee(100_000_000_000n, usdt), 25_000_000n); // capped at 25
  assert.equal(computeAssetFee(3n, { percentageBps: 50n, minFeeMinor: 0n, maxFeeMinor: null }), 1n); // ceil
});

test('maxSendable: amount + fee never exceeds available, and is the largest such amount', () => {
  for (const avail of [0n, 1n, 999_999n, 1_000_000n, 2_000_000n, 500_000_000n, 90_000_000_000n]) {
    const m = maxSendable(avail, usdt);
    if (m > 0n) assert.ok(m + computeAssetFee(m, usdt) <= avail, `fits ${avail}`);
    assert.ok(m + 1n + computeAssetFee(m + 1n, usdt) > avail || avail === 0n, `largest ${avail}`);
  }
  assert.equal(maxSendable(500n, null), 500n);
});
