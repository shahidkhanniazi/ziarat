import 'package:flutter_test/flutter_test.dart';
import 'package:ziarat/models/crypto_asset.dart';
import 'package:ziarat/models/crypto_transaction.dart';
import 'package:ziarat/utils/amounts.dart';

void main() {
  test('parseMinor is exact and strict', () {
    expect(parseMinor('1', 18), BigInt.parse('1000000000000000000'));
    expect(parseMinor('0.000001', 6), BigInt.one);
    expect(parseMinor('0.0000001', 6), isNull);
    expect(parseMinor('1e3', 6), isNull);
    expect(parseMinor('', 6), isNull);
    expect(parseMinor('-1', 6), isNull);
  });

  test('address helpers', () {
    expect(isEvmAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F'), isTrue);
    expect(isEvmAddress('0x123'), isFalse);
    expect(shortAddress('0x71C7656EC7ab88b098defB751B7401B5f6d8976F'), '0x71C765…d8976F');
  });

  test('CryptoAsset parses the v2 API shape', () {
    final a = CryptoAsset.fromJson({
      'code': 'USDT', 'symbol': 'USDT', 'name': 'Tether USD', 'network': 'Ethereum', 'networkId': 'eip155:1',
      'decimals': 6, 'native': false, 'balance': '12.5', 'available': '12.5', 'withdrawalsEnabled': true,
    });
    expect(a.code, 'USDT');
    expect(a.withdrawalsEnabled, isTrue);
    expect(a.decimals, 6);
  });

  test('transactions and withdrawal results parse', () {
    final t = CryptoTransaction.fromJson({
      'id': '1', 'asset': 'ETH', 'network': 'Ethereum', 'type': 'deposit', 'amount': '1', 'status': 'confirmed',
      'txHash': '0xabc', 'createdAt': '2026-10-11T10:00:00.000Z',
    });
    expect(t.isDeposit, isTrue);
    expect(t.createdAt, isNotNull);
    expect(WithdrawalResult.fromJson({'id': 'x', 'status': 'needs_review'}).underReview, isTrue);
  });
}
