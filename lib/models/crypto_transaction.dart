class CryptoTransaction {
  const CryptoTransaction({
    required this.id,
    required this.asset,
    required this.network,
    required this.type,
    required this.amount,
    required this.status,
    this.txHash,
    this.address,
    this.createdAt,
  });

  final String id, asset, network, type, amount, status;
  final String? txHash, address;
  final DateTime? createdAt;

  bool get isDeposit => type == 'deposit';

  factory CryptoTransaction.fromJson(Map<String, dynamic> j) => CryptoTransaction(
        id: j['id'].toString(),
        asset: (j['asset'] ?? j['symbol'] ?? '').toString(),
        network: (j['network'] ?? '').toString(),
        type: (j['type'] ?? '').toString(),
        amount: (j['amount'] ?? '0').toString(),
        status: (j['status'] ?? '').toString(),
        txHash: j['txHash']?.toString(),
        address: j['address']?.toString(),
        createdAt: j['createdAt'] == null ? null : DateTime.tryParse(j['createdAt'].toString()),
      );
}

class TransactionPage {
  const TransactionPage({required this.items, this.nextBefore});
  final List<CryptoTransaction> items;
  final String? nextBefore;
}

class DepositInfo {
  const DepositInfo({required this.asset, required this.network, required this.address, required this.warning});
  final String asset, network, address, warning;

  factory DepositInfo.fromJson(Map<String, dynamic> j) => DepositInfo(
        asset: j['asset'].toString(),
        network: j['network'].toString(),
        address: j['address'].toString(),
        warning: (j['warning'] ?? '').toString(),
      );
}

class WithdrawalResult {
  const WithdrawalResult({required this.id, required this.status, this.txHash});
  final String id, status;
  final String? txHash;

  bool get underReview => status == 'needs_review';

  factory WithdrawalResult.fromJson(Map<String, dynamic> j) =>
      WithdrawalResult(id: j['id'].toString(), status: j['status'].toString(), txHash: j['txHash']?.toString());
}

class FeeQuote {
  const FeeQuote({required this.amount, required this.fee, required this.total});
  final String amount, fee, total;

  factory FeeQuote.fromJson(Map<String, dynamic> j) =>
      FeeQuote(amount: j['amount'].toString(), fee: j['fee'].toString(), total: j['total'].toString());
}
