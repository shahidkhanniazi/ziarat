import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRegistry, findByCode, findByDeposit } from '../src/assets.js';

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const base = {
  chainId: 1,
  enabled: ['ETH', 'USDT'],
  contracts: { USDT },
  decimals: {},
  limits: 'ETH:1:2;USDT:1000:5000',
};

test('builds registry with native and token assets', () => {
  const reg = buildRegistry(base);
  assert.equal(reg.length, 2);
  assert.equal(findByCode(reg, 'usdt')?.contract, USDT.toLowerCase());
  assert.equal(findByCode(reg, 'ETH')?.native, true);
  assert.equal(findByCode(reg, 'USDT')?.limits?.perTx, 1000n * 10n ** 6n);
});

test('fails fast on missing contract, BTC and unknown assets', () => {
  assert.throws(() => buildRegistry({ ...base, contracts: {} }), /contract/);
  assert.throws(() => buildRegistry({ ...base, enabled: ['BTC'] }), /BTC/);
  assert.throws(() => buildRegistry({ ...base, enabled: ['DOGE'] }), /Unknown/);
  assert.throws(() => buildRegistry({ ...base, limits: 'USDT:5' }), /Invalid limit/);
});

test('deposits match by contract address, never by symbol', () => {
  const reg = buildRegistry(base);
  assert.equal(findByDeposit(reg, 'eip155:1', 'native-token', null)?.code, 'ETH');
  assert.equal(findByDeposit(reg, 'eip155:1', 'erc20', USDT.toUpperCase().replace('0X', '0x'))?.code, 'USDT');
  // fake token with the same symbol but another contract
  assert.equal(findByDeposit(reg, 'eip155:1', 'erc20', '0x1111111111111111111111111111111111111111'), undefined);
  // right contract, wrong chain
  assert.equal(findByDeposit(reg, 'eip155:137', 'erc20', USDT), undefined);
  assert.equal(findByDeposit(reg, 'eip155:137', 'native-token', null), undefined);
});
