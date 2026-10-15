class CurrencyWallet {
  const CurrencyWallet({required this.code, required this.name, required this.symbol, required this.flag, this.balance = 0});
  final String code, name, symbol, flag;
  final double balance;
}
const supportedWallets = <CurrencyWallet>[
  CurrencyWallet(code:'USD',name:'US Dollar',symbol:'$',flag:'🇺🇸'),
  CurrencyWallet(code:'EUR',name:'Euro',symbol:'€',flag:'🇪🇺'),
  CurrencyWallet(code:'GBP',name:'British Pound',symbol:'£',flag:'🇬🇧'),
  CurrencyWallet(code:'JPY',name:'Japanese Yen',symbol:'¥',flag:'🇯🇵'),
  CurrencyWallet(code:'CNY',name:'Chinese Yuan',symbol:'¥',flag:'🇨🇳'),
  CurrencyWallet(code:'PKR',name:'Pakistani Rupee',symbol:'Rs',flag:'🇵🇰'),
  CurrencyWallet(code:'AED',name:'UAE Dirham',symbol:'د.إ',flag:'🇦🇪'),
];
