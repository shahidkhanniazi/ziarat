import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeErc20Transfer, isEvmAddress, toHexQuantity } from '../src/evm.js';
import { buildRegistry, findByCode } from '../src/assets.js';
import { checkDailyLimit, classifySendError, validateWithdrawal } from '../src/withdrawal-rules.js';

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const reg = buildRegistry({
  chainId: 1,
  enabled: ['ETH', 'USDT'],
  contracts: { USDT },
  decimals: {},
  limits: 'ETH:1:2;USDT:1000:5000',
});
const usdt = findByCode(reg, 'USDT')!;
const eth = findByCode(reg, 'ETH')!;
const RECIPIENT = '0x71C7656EC7ab88b098defB751B7401B5f6d8976F';

test('ERC-20 transfer calldata matches the ABI encoding', () => {
  const data = encodeErc20Transfer(RECIPIENT, 1_000_000n);
  assert.equal(
    data,
    '0xa9059cbb' +
      '00000000000000000000000071c7656ec7ab88b098defb751b7401b5f6d8976f' +
      '00000000000000000000000000000000000000000000000000000000000f4240',
  );
  assert.throws(() => encodeErc20Transfer('0x123', 1n));
  assert.equal(toHexQuantity(255n), '0xff');
});

test('address validation', () => {
  assert.equal(isEvmAddress(RECIPIENT), true);
  assert.equal(isEvmAddress('0x123'), false);
  assert.equal(isEvmAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq'), false);
});

test('withdrawal validation enforces address, precision and per-tx limit', () => {
  const ok = validateWithdrawal({ address: RECIPIENT, amount: '100.5' }, usdt);
  assert.equal(ok.amount, 100_500_000n);
  assert.throws(() => validateWithdrawal({ address: 'abc', amount: '1' }, usdt), /valid EVM/);
  assert.throws(() => validateWithdrawal({ address: RECIPIENT, amount: '0' }, usdt), /greater than zero/);
  assert.throws(() => validateWithdrawal({ address: RECIPIENT, amount: '1000.01' }, usdt), /per-transaction/);
  assert.throws(() => validateWithdrawal({ address: RECIPIENT, amount: '1.0000001' }, usdt), /decimal/);
  assert.equal(validateWithdrawal({ address: RECIPIENT, amount: '1' }, eth).amount, 10n ** 18n);
});

test('daily limit', () => {
  checkDailyLimit(usdt, 4000n * 10n ** 6n, 1000n * 10n ** 6n);
  assert.throws(() => checkDailyLimit(usdt, 4000n * 10n ** 6n, 1000n * 10n ** 6n + 1n), /Daily/);
});

test('only definite provider rejections release held funds', () => {
  assert.equal(classifySendError({ status: 400 }), 'rejected');
  assert.equal(classifySendError({ status: 403 }), 'rejected');
  assert.equal(classifySendError({ status: 500 }), 'unknown');
  assert.equal(classifySendError({ status: 408 }), 'unknown');
  assert.equal(classifySendError({ status: 429 }), 'unknown');
  assert.equal(classifySendError(new Error('ETIMEDOUT')), 'unknown');
  assert.equal(classifySendError(null), 'unknown');
});

test('transaction construction', async () => {
  const { buildTransaction } = await import('../src/withdrawal-rules.js');
  assert.deepEqual(buildTransaction(eth, RECIPIENT, 255n), { to: RECIPIENT, value: '0xff' });
  const t = buildTransaction(usdt, RECIPIENT, 1_000_000n);
  assert.equal(t.to, USDT.toLowerCase());
  assert.equal(t.data?.startsWith('0xa9059cbb'), true);
  assert.equal(t.value, undefined);
});
