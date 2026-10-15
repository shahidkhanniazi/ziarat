import 'dart:math';

import '../models/crypto_asset.dart';
import '../models/crypto_transaction.dart';
import 'api_client.dart';
import 'privy_auth_service.dart';

class CryptoService {
  CryptoService(this.api, {PrivyAuthService? auth}) : _auth = auth ?? PrivyAuthService.instance;

  final ApiClient api;
  final PrivyAuthService _auth;

  /// 32 hex characters from a secure RNG. Create ONE per withdrawal attempt and reuse it on retries.
  static String newIdempotencyKey() {
    final r = Random.secure();
    return List<int>.generate(16, (_) => r.nextInt(256)).map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  }

  Future<List<CryptoAsset>> assets() async {
    final data = await api.getJson('/v1/crypto/assets', token: await _auth.accessToken());
    return (data['assets'] as List).map((e) => CryptoAsset.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<DepositInfo> depositAddress(String asset) async {
    final data = await api.postJson('/v1/crypto/deposit-address', {'asset': asset}, token: await _auth.accessToken());
    return DepositInfo.fromJson(data);
  }

  Future<WithdrawalResult> withdraw({
    required String asset,
    required String address,
    required String amount,
    required String idempotencyKey,
  }) async {
    final data = await api.postJson(
      '/v1/crypto/withdrawals',
      {'asset': asset, 'address': address, 'amount': amount},
      token: await _auth.accessToken(),
      idempotencyKey: idempotencyKey,
    );
    return WithdrawalResult.fromJson(data);
  }

  Future<FeeQuote> feeQuote({required String asset, required String amount}) async {
    final data = await api.getJson('/v1/crypto/fee-quote', token: await _auth.accessToken(), query: {'asset': asset, 'amount': amount});
    return FeeQuote.fromJson(data);
  }

  Future<String> maxSendable(String asset) async {
    final data = await api.getJson('/v1/crypto/max-sendable', token: await _auth.accessToken(), query: {'asset': asset});
    return data['amount'].toString();
  }

  Future<TransactionPage> transactions({String? before}) async {
    final data = await api.getJson(
      '/v1/crypto/transactions',
      token: await _auth.accessToken(),
      query: {'limit': '30', if (before != null) 'before': before},
    );
    final items = (data['transactions'] as List).map((e) => CryptoTransaction.fromJson(e as Map<String, dynamic>)).toList();
    return TransactionPage(items: items, nextBefore: data['nextBefore']?.toString());
  }
}
