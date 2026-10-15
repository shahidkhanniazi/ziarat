class CryptoAsset {
  const CryptoAsset({
    required this.code,
    required this.name,
    required this.network,
    required this.networkId,
    required this.decimals,
    required this.balance,
    required this.available,
    required this.native,
    required this.withdrawalsEnabled,
  });

  final String code;
  final String name;
  final String network; // human label, e.g. "Ethereum"
  final String networkId; // CAIP-2, e.g. "eip155:1"
  final int decimals;
  final String balance;
  final String available; // what can be withdrawn right now (after fee reserve)
  final bool native;
  final bool withdrawalsEnabled;

  factory CryptoAsset.fromJson(Map<String, dynamic> json) => CryptoAsset(
        code: (json['code'] ?? json['symbol'] ?? '').toString(),
        name: (json['name'] ?? json['code'] ?? '').toString(),
        network: (json['network'] ?? '').toString(),
        networkId: (json['networkId'] ?? '').toString(),
        decimals: (json['decimals'] as num?)?.toInt() ?? 18,
        balance: (json['balance'] ?? '0').toString(),
        available: (json['available'] ?? json['balance'] ?? '0').toString(),
        native: json['native'] == true,
        withdrawalsEnabled: json['withdrawalsEnabled'] == true,
      );
}
