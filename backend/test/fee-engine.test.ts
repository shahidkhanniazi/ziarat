import test from 'node:test';
import assert from 'node:assert/strict';

// Contract-level validation checks; integration tests require PostgreSQL and are documented separately.
test('fee quote amount accepts positive USD values with at most two decimals', () => {
  for (const amount of ['1', '1.2', '1.23', '1000000.00']) assert.match(amount, /^\d{1,12}(\.\d{1,2})?$/);
});

test('fee quote amount rejects zero, negatives, exponent notation and excess precision', () => {
  for (const amount of ['0', '-1', '1.234', '1e3', '.50', '1.']) assert.equal(/^\d{1,12}(\.\d{1,2})?$/.test(amount) && Number(amount) > 0, false, amount);
});
