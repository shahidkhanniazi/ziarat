import test from 'node:test';
import assert from 'node:assert/strict';
import { fromMinor, parseBaseUnits, toMinor } from '../src/amounts.js';

test('toMinor converts exactly without floating point', () => {
  assert.equal(toMinor('1', 18), 10n ** 18n);
  assert.equal(toMinor('0.000001', 6), 1n);
  assert.equal(toMinor('1234.5', 6), 1234500000n);
  assert.equal(toMinor('0.1', 18), 100000000000000000n);
});

test('toMinor rejects bad input', () => {
  for (const bad of ['', '-1', '1e3', '1.', '.5', 'abc', '1,5', ' 1']) {
    assert.throws(() => toMinor(bad, 6), /Amount|decimal/i, bad);
  }
  assert.throws(() => toMinor('0.0000001', 6), /decimal places/);
});

test('fromMinor round-trips', () => {
  for (const [s, d] of [['0', 6], ['1', 18], ['12.345678', 6], ['0.000001', 6]] as const) {
    assert.equal(fromMinor(toMinor(s, d), d), s);
  }
});

test('parseBaseUnits accepts base-unit integers only', () => {
  assert.equal(parseBaseUnits('1000000000000000000'), 10n ** 18n);
  assert.equal(parseBaseUnits(5), 5n);
  assert.throws(() => parseBaseUnits('1.5'));
  assert.throws(() => parseBaseUnits('-1'));
  assert.throws(() => parseBaseUnits(undefined));
});


test('amount helpers reject invalid decimal precision and negative balances', () => {
  for (const decimals of [-1, 1.5, 79, Number.NaN]) {
    assert.throws(() => toMinor('1', decimals), /precision|decimal/i);
    assert.throws(() => fromMinor('1', decimals), /precision|decimal/i);
  }
  assert.throws(() => fromMinor(-1n, 6), /negative/i);
  assert.throws(() => fromMinor('-1', 6), /negative/i);
});

test('toMinor intentionally accepts zero for configuration values but callers validate transaction positivity', () => {
  assert.equal(toMinor('0', 6), 0n);
});
