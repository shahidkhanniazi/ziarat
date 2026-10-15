import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256Hex } from '../src/keccak.js';
import { isEvmAddress, toChecksumAddress } from '../src/evm.js';

test('keccak256 known vectors', () => {
  assert.equal(keccak256Hex(''), 'c5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.equal(keccak256Hex('abc'), '4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(keccak256Hex('a'.repeat(200)).length, 64); // multi-block input
});

test('EIP-55 reference vectors', () => {
  for (const a of [
    '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    '0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359',
    '0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB',
    '0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb',
  ]) {
    assert.equal(toChecksumAddress(a.toLowerCase()), a);
    assert.equal(isEvmAddress(a), true);
  }
});

test('address validation: lowercase ok, bad checksum rejected, malformed rejected', () => {
  const good = '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed';
  assert.equal(isEvmAddress(good.toLowerCase()), true);
  const typo = good.replace('5aAeb', '5aaeb'); // flip one letter's case
  assert.equal(isEvmAddress(typo), false);
  assert.equal(isEvmAddress('0x123'), false);
  assert.equal(isEvmAddress('5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed'), false);
});
