import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDepositEvent, parseWithdrawalEvent } from '../src/deposit-parse.js';

const flat = {
  type: 'wallet.funds_deposited',
  wallet_id: 'w1',
  idempotency_key: 'evt-1',
  caip2: 'eip155:1',
  asset: { type: 'native-token', address: null },
  amount: '1000000000000000000',
  transaction_hash: '0xabc',
  sender: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
  recipient: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
};

test('parses the flat Privy payload and keeps base units', () => {
  const d = parseDepositEvent(flat, 'svix-1');
  assert.ok(d);
  assert.equal(d.eventId, 'evt-1');
  assert.equal(d.amount, 10n ** 18n); // 1 ETH in wei, NOT 1e18 ETH
  assert.equal(d.walletId, 'w1');
  assert.equal(d.assetAddress, null);
});

test('parses the wrapped { event, data } shape', () => {
  const wrapped = { event: 'wallet.funds_deposited', data: { ...flat, type: undefined } };
  const d = parseDepositEvent(wrapped, 'svix-2');
  assert.equal(d?.txHash, '0xabc');
});

test('falls back to the delivery id when idempotency_key is absent', () => {
  const { idempotency_key: _omit, ...rest } = flat;
  assert.equal(parseDepositEvent(rest, 'svix-3')?.eventId, 'svix-3');
});

test('ignores other events and rejects malformed deposits', () => {
  assert.equal(parseDepositEvent({ type: 'wallet.funds_withdrawn' }, 'x'), null);
  assert.equal(parseDepositEvent('nope', 'x'), null);
  assert.throws(() => parseDepositEvent({ ...flat, amount: '1.5' }, 'x'));
  assert.throws(() => parseDepositEvent({ ...flat, wallet_id: undefined }, 'x'));
});

test('parses withdrawal confirmation events', () => {
  const w = parseWithdrawalEvent({ type: 'wallet.funds_withdrawn', wallet_id: 'w1', transaction_hash: '0xdef' }, 'e');
  assert.equal(w?.txHash, '0xdef');
  assert.equal(parseWithdrawalEvent(flat, 'e'), null);
});
