import 'package:flutter/material.dart';
import '../models/currency_wallet.dart';
import 'crypto_flow.dart';

const emerald = Color(0xFF18E6A4);
const bg = Color(0xFF03100C);
const panel = Color(0xFF0A1D16);
const panel2 = Color(0xFF102A20);
const border = Color(0xFF194B39);

class ZiaratApp extends StatelessWidget {
  const ZiaratApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Ziarat',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: bg,
        colorScheme: const ColorScheme.dark(primary: emerald, secondary: Color(0xFF70F4C5), surface: panel, error: Color(0xFFFF6B78)),
        useMaterial3: true,
        fontFamily: 'Roboto',
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: panel,
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(16),
            borderSide: const BorderSide(color: border),
          ),
        ),
        appBarTheme: const AppBarTheme(backgroundColor: bg, elevation: 0, centerTitle: false, titleTextStyle: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800), iconTheme: IconThemeData(color: Colors.white)),
        navigationBarTheme: NavigationBarThemeData(
          backgroundColor: const Color(0xFF061710),
          indicatorColor: const Color(0xFF0E4B37),
          labelTextStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 10, fontWeight: FontWeight.w700)),
        ),
      ),
      home: const WalletShell(),
    );
  }
}

class WalletShell extends StatefulWidget {
  const WalletShell({super.key});
  @override
  State<WalletShell> createState() => _WalletShellState();
}

class _WalletShellState extends State<WalletShell> {
  int index = 0;

  @override
  Widget build(BuildContext context) {
    final pages = <Widget>[
      HomePage(onAssets: () => setState(() => index = 1)),
      const AssetsPage(),
      const PaymentsPage(),
      const CardsPage(),
      const ProfilePage(),
    ];
    return Scaffold(
      body: SafeArea(child: IndexedStack(index: index, children: pages)),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (value) => setState(() => index = value),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.account_balance_wallet_outlined), selectedIcon: Icon(Icons.account_balance_wallet), label: 'Assets'),
          NavigationDestination(icon: Icon(Icons.grid_view_rounded), selectedIcon: Icon(Icons.grid_view_rounded), label: 'Pay'),
          NavigationDestination(icon: Icon(Icons.credit_card_outlined), selectedIcon: Icon(Icons.credit_card), label: 'Cards'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}

class HomePage extends StatefulWidget {
  const HomePage({super.key, required this.onAssets});
  final VoidCallback onAssets;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  bool _hideBalances = false;

  @override
  Widget build(BuildContext context) {
    final onAssets = widget.onAssets;
    return ListView(
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 28),
      children: [
        Row(children: [
          const CircleAvatar(radius: 21, backgroundColor: Color(0xFF14553F), child: Text('AS', style: TextStyle(fontWeight: FontWeight.w800))),
          const SizedBox(width: 11),
          const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('Welcome back', style: TextStyle(color: Colors.white60, fontSize: 12)), Text('Welcome', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800))])),
          IconButton(onPressed: () => _notice(context, 'Notifications will appear here when connected to the notification service.'), icon: const Icon(Icons.notifications_none_rounded)),
        ]),
        const SizedBox(height: 18),
        _BalanceCard(
          onAssets: onAssets,
          hideBalance: _hideBalances,
          onToggleVisibility: () => setState(() => _hideBalances = !_hideBalances),
        ),
        const SizedBox(height: 18),
        Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
          _QuickButton(icon: Icons.add_rounded, label: 'Add money', onTap: () => _openMoneyFlow(context, 'Add money', 'Choose how you would like to fund your account.', ['Bank transfer', 'Card payment', 'Receive from another user'])),
          _QuickButton(icon: Icons.arrow_upward_rounded, label: 'Send', onTap: () => _openMoneyFlow(context, 'Send money', 'Choose a transfer type to continue.', ['Send to a Ziarat user', 'Bank account', 'International transfer', 'Payment link'])),
          _QuickButton(icon: Icons.arrow_downward_rounded, label: 'Receive', onTap: () => _openMoneyFlow(context, 'Receive money', 'Choose which account details to share.', ['USD account details', 'Local currency account', 'Crypto wallet address', 'Show my QR code'])),
          _QuickButton(icon: Icons.swap_horiz_rounded, label: 'Exchange', onTap: () => _openMoneyFlow(context, 'Exchange', 'Choose a conversion type. Final rates require a connected provider.', ['Fiat currency exchange', 'Crypto swap'])),
        ]),
        const SizedBox(height: 24),
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Your assets', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), TextButton(onPressed: onAssets, child: const Text('View all'))]),
        const SizedBox(height: 8),
        Row(children: [
          Expanded(child: _AssetSummary(icon: Icons.account_balance_rounded, title: 'Fiat', subtitle: 'Currencies', value: _hideBalances ? '••••••' : '\$0.00', onTap: onAssets)),
          const SizedBox(width: 12),
          Expanded(child: _AssetSummary(icon: Icons.currency_bitcoin_rounded, title: 'Crypto', subtitle: 'Digital assets', value: _hideBalances ? '••••••' : '\$0.00', onTap: onAssets)),
        ]),
        const SizedBox(height: 24),
        const Text('Recent activity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        _EmptyActivity(),
      ],
    );
  }
}

class _BalanceCard extends StatelessWidget {
  const _BalanceCard({
    required this.onAssets,
    required this.hideBalance,
    required this.onToggleVisibility,
  });
  final VoidCallback onAssets;
  final bool hideBalance;
  final VoidCallback onToggleVisibility;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(20),
    decoration: BoxDecoration(
      borderRadius: BorderRadius.circular(26),
      gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF10533D), Color(0xFF08231B)]),
      border: Border.all(color: const Color(0xFF1B8A62)),
      boxShadow: const [BoxShadow(color: Color(0x33000000), blurRadius: 24, offset: Offset(0, 12))],
    ),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [const Text('Total balance', style: TextStyle(color: Colors.white70)), Row(mainAxisSize: MainAxisSize.min, children: [IconButton(tooltip: hideBalance ? 'Show balances' : 'Hide balances', onPressed: onToggleVisibility, icon: Icon(hideBalance ? Icons.visibility_off_outlined : Icons.visibility_outlined, color: Colors.white70)), TextButton(onPressed: onAssets, child: const Text('Assets'))])]),
      Text(hideBalance ? '••••••' : '\$0.00', style: const TextStyle(fontSize: 38, fontWeight: FontWeight.w900, letterSpacing: -1)),
      const SizedBox(height: 4),
      const Text('Live balances appear here after your account is connected.', style: TextStyle(color: Colors.white60, fontSize: 12)),
    ]),
  );
}

class _QuickButton extends StatelessWidget {
  const _QuickButton({required this.icon, required this.label, required this.onTap});
  final IconData icon; final String label; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(18), child: Column(children: [Container(width: 52, height: 52, decoration: BoxDecoration(color: const Color(0xFF0D392B), borderRadius: BorderRadius.circular(18), border: Border.all(color: border)), child: Icon(icon, color: emerald)), const SizedBox(height: 7), Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600))]));
}

class _AssetSummary extends StatelessWidget {
  const _AssetSummary({required this.icon, required this.title, required this.subtitle, required this.value, required this.onTap});
  final IconData icon; final String title, subtitle, value; final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => InkWell(onTap: onTap, borderRadius: BorderRadius.circular(20), child: Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(20), border: Border.all(color: border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [CircleAvatar(backgroundColor: const Color(0xFF123C2E), child: Icon(icon, color: emerald, size: 20)), const SizedBox(height: 13), Text(title, style: const TextStyle(fontWeight: FontWeight.w800)), Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 11)), const SizedBox(height: 8), Text(value, style: const TextStyle(fontSize: 19, fontWeight: FontWeight.w900))])));
}

class AssetsPage extends StatelessWidget {
  const AssetsPage({super.key});
  @override
  Widget build(BuildContext context) => DefaultTabController(length: 3, child: Scaffold(backgroundColor: bg, appBar: AppBar(title: const Text('Your assets', style: TextStyle(fontWeight: FontWeight.w800)), actions: [IconButton(onPressed: () => _notice(context, 'Add an asset after its provider and network are configured.'), icon: const Icon(Icons.add_rounded))], bottom: const TabBar(tabs: [Tab(text: 'All'), Tab(text: 'Fiat'), Tab(text: 'Crypto')], indicatorColor: emerald, labelColor: emerald, unselectedLabelColor: Colors.white54)), body: const TabBarView(children: [_AllAssets(), _FiatAssets(), CryptoWalletPage()]));
}

class _AllAssets extends StatelessWidget {
  const _AllAssets();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(18), children: [
    _PortfolioHeader(title: 'Total portfolio', value: '\$0.00', subtitle: 'Fiat and crypto are shown separately below.'),
    const SizedBox(height: 18),
    _SectionTitle(title: 'Fiat', action: 'Manage'),
    const SizedBox(height: 8),
    ...supportedWallets.map((w) => _FiatTile(wallet: w)),
    const SizedBox(height: 22),
    _SectionTitle(title: 'Crypto', action: 'Open crypto'),
    const SizedBox(height: 8),
    _CryptoPreview(code: 'ETH', name: 'Ethereum', balance: '0 ETH', network: 'Ethereum'),
    _CryptoPreview(code: 'USDT', name: 'Tether', balance: '0 USDT', network: 'Configured network'),
    _CryptoPreview(code: 'ZIAR', name: 'Ziarat token', balance: '0 ZIAR', network: 'EVM'),
  ]);
}

class _FiatAssets extends StatelessWidget {
  const _FiatAssets();
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.all(18), children: [
    const _PortfolioHeader(title: 'Total fiat balance', value: '\$0.00', subtitle: 'Traditional currencies only.'),
    const SizedBox(height: 16),
    ...supportedWallets.map((w) => _FiatTile(wallet: w)),
    const SizedBox(height: 12),
    FilledButton.icon(onPressed: () => _notice(context, 'Fiat funding requires the selected banking/payment provider.'), icon: const Icon(Icons.add), label: const Text('Add fiat currency')),
  ]);
}

class _FiatTile extends StatelessWidget {
  const _FiatTile({required this.wallet});
  final CurrencyWallet wallet;
  @override
  Widget build(BuildContext context) => Card(color: panel, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: border)), child: ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), leading: Text(wallet.flag, style: const TextStyle(fontSize: 25)), title: Text(wallet.code, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text(wallet.name, style: const TextStyle(color: Colors.white54, fontSize: 12)), trailing: Text('${wallet.symbol}0.00', style: const TextStyle(fontWeight: FontWeight.w800))));
}

class _CryptoPreview extends StatelessWidget {
  const _CryptoPreview({required this.code, required this.name, required this.balance, required this.network});
  final String code, name, balance, network;
  @override
  Widget build(BuildContext context) => Card(color: panel, elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: border)), child: ListTile(contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4), leading: CircleAvatar(backgroundColor: const Color(0xFF173C30), child: Text(code.substring(0, 1), style: const TextStyle(color: emerald, fontWeight: FontWeight.w900))), title: Text(name, style: const TextStyle(fontWeight: FontWeight.w800)), subtitle: Text('$code • $network', style: const TextStyle(color: Colors.white54, fontSize: 12)), trailing: Text(balance, style: const TextStyle(fontWeight: FontWeight.w800)));
}

class _PortfolioHeader extends StatelessWidget {
  const _PortfolioHeader({required this.title, required this.value, required this.subtitle});
  final String title, value, subtitle;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(19), decoration: BoxDecoration(gradient: const LinearGradient(colors: [Color(0xFF0E4433), Color(0xFF0A2119)]), borderRadius: BorderRadius.circular(22), border: Border.all(color: border)), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text(title, style: const TextStyle(color: Colors.white60)), const SizedBox(height: 5), Text(value, style: const TextStyle(fontSize: 32, fontWeight: FontWeight.w900)), const SizedBox(height: 4), Text(subtitle, style: const TextStyle(color: Colors.white54, fontSize: 12))]));
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.action});
  final String title, action;
  @override
  Widget build(BuildContext context) => Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w800)), Text(action, style: const TextStyle(color: emerald, fontSize: 12, fontWeight: FontWeight.w700))]);
}

class _EmptyActivity extends StatelessWidget {
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(18), border: Border.all(color: border)), child: const Row(children: [CircleAvatar(backgroundColor: Color(0xFF123B2D), child: Icon(Icons.receipt_long_outlined, color: emerald)), SizedBox(width: 12), Expanded(child: Text('No transactions yet. Verified activity will appear here.', style: TextStyle(color: Colors.white60, fontSize: 13)))]));
}

class PaymentsPage extends StatelessWidget {
  const PaymentsPage({super.key});
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(18, 22, 18, 28), children: [const Text('Payments', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)), const SizedBox(height: 6), const Text('Send, receive and manage everyday payments.', style: TextStyle(color: Colors.white60)), const SizedBox(height: 20), GridView.count(shrinkWrap: true, physics: const NeverScrollableScrollPhysics(), crossAxisCount: 3, mainAxisSpacing: 10, crossAxisSpacing: 10, childAspectRatio: .86, children: [
    _Service(icon: Icons.arrow_upward_rounded, label: 'Send money', onTap: () => _openMoneyFlow(context, 'Send money', 'Send to a Ziarat user or an external destination.', ['Ziarat user', 'Bank account', 'International transfer', 'Payment link'])),
    _Service(icon: Icons.qr_code_2_rounded, label: 'QR pay', onTap: () => _openMoneyFlow(context, 'QR pay', 'Scan or display a payment QR code.', ['Scan QR code', 'Show my QR code'])),
    _Service(icon: Icons.link_rounded, label: 'Payment link', onTap: () => _openMoneyFlow(context, 'Payment link', 'Create a request link after your merchant setup is connected.', ['Create payment link'])),
    _Service(icon: Icons.storefront_rounded, label: 'Merchant pay', onTap: () => _openMoneyFlow(context, 'Merchant pay', 'Merchant payments are shown as a demo until a provider is connected.', ['Pay merchant', 'Scan merchant QR'])),
    _Service(icon: Icons.receipt_long_rounded, label: 'Bills', onTap: () => _openMoneyFlow(context, 'Bill payments', 'Select a bill type to preview the payment flow.', ['Electricity', 'Gas', 'Internet', 'Water'])),
    _Service(icon: Icons.phone_android_rounded, label: 'Mobile top-up', onTap: () => _openMoneyFlow(context, 'Mobile top-up', 'Choose a mobile top-up option.', ['Pakistan mobile top-up', 'International top-up'])),
    _Service(icon: Icons.public_rounded, label: 'International', onTap: () => _openMoneyFlow(context, 'International transfer', 'International payments require a licensed payout partner.', ['International bank transfer', 'Recipient wallet'])),
    _Service(icon: Icons.business_rounded, label: 'Business payouts', onTap: () => _openMoneyFlow(context, 'Business payouts', 'Review a business payout flow.', ['Single payout', 'Bulk payouts'])),
    _Service(icon: Icons.request_page_rounded, label: 'Request money', onTap: () => _openMoneyFlow(context, 'Request money', 'Create a payment request preview.', ['Request from a Ziarat user', 'Create payment link'])),
  ]), const SizedBox(height: 20), const _InfoNote(text: 'Payment tiles are product surfaces. Provider, compliance and settlement integrations must be connected before production use.')]);
}

class _Service extends StatelessWidget {
  const _Service({required this.icon, required this.label, required this.onTap});
  final IconData icon;
  final String label;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: panel,
    borderRadius: BorderRadius.circular(17),
    child: InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(17),
      child: Container(
        decoration: BoxDecoration(borderRadius: BorderRadius.circular(17), border: Border.all(color: border)),
        padding: const EdgeInsets.all(8),
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          CircleAvatar(radius: 22, backgroundColor: const Color(0xFF123B2D), child: Icon(icon, color: emerald, size: 20)),
          const SizedBox(height: 8),
          Text(label, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700)),
        ]),
      ),
    ),
  );
}

class CardsPage extends StatelessWidget {
  const CardsPage({super.key});
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(18, 22, 18, 28), children: [const Text('Cards', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)), const SizedBox(height: 18), Container(height: 205, padding: const EdgeInsets.all(22), decoration: BoxDecoration(borderRadius: BorderRadius.circular(24), gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF0B8056), Color(0xFF06251B)]), border: Border.all(color: emerald)), child: const Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('ZIARAT', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900)), Icon(Icons.contactless_rounded)]), Text('••••  ••••  ••••  4582', style: TextStyle(fontSize: 19, letterSpacing: 2)), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text('VIRTUAL CARD'), Text('VISA', style: TextStyle(fontSize: 21, fontStyle: FontStyle.italic, fontWeight: FontWeight.w900))])])), const SizedBox(height: 16), const _InfoNote(text: 'Card preview only. Issuance, card funding and network services require an authorized issuer/program manager.')]);
}

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});
  @override
  Widget build(BuildContext context) => ListView(padding: const EdgeInsets.fromLTRB(18, 22, 18, 28), children: [const Text('Profile', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)), const SizedBox(height: 18), Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(20), border: Border.all(color: border)), child: const Row(children: [CircleAvatar(radius: 27, backgroundColor: Color(0xFF14543B), child: Text('Z', style: TextStyle(fontWeight: FontWeight.w900))), SizedBox(width: 13), Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text('My account', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)), SizedBox(height: 3), Text('Ziarat account', style: TextStyle(color: Colors.white54, fontSize: 12))])])), const SizedBox(height: 14), ...const [['Account settings', Icons.settings_outlined], ['KYC verification', Icons.verified_user_outlined], ['Security & biometrics', Icons.lock_outline], ['Two-factor authentication', Icons.security_outlined], ['Linked accounts', Icons.account_balance_outlined], ['Notifications', Icons.notifications_none_rounded], ['Help & support', Icons.support_agent], ['Privacy & terms', Icons.policy_outlined], ['About Ziarat', Icons.info_outline]].map((e) => Card(color: panel, elevation: 0, child: ListTile(leading: Icon(e[1] as IconData, color: emerald), title: Text(e[0] as String), trailing: const Icon(Icons.chevron_right))))]);
}

class _InfoNote extends StatelessWidget {
  const _InfoNote({required this.text});
  final String text;
  @override
  Widget build(BuildContext context) => Container(padding: const EdgeInsets.all(14), decoration: BoxDecoration(color: const Color(0xFF0A1D17), borderRadius: BorderRadius.circular(15), border: Border.all(color: const Color(0xFF173D30))), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [const Icon(Icons.info_outline, size: 19, color: Colors.white54), const SizedBox(width: 10), Expanded(child: Text(text, style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.35)))]));
}


void _openMoneyFlow(BuildContext context, String title, String subtitle, List<String> options) {
  Navigator.of(context).push(MaterialPageRoute<void>(
    builder: (_) => MoneyFlowPage(title: title, subtitle: subtitle, options: options),
  ));
}

class MoneyFlowPage extends StatefulWidget {
  const MoneyFlowPage({super.key, required this.title, required this.subtitle, required this.options});
  final String title;
  final String subtitle;
  final List<String> options;

  @override
  State<MoneyFlowPage> createState() => _MoneyFlowPageState();
}

class _MoneyFlowPageState extends State<MoneyFlowPage> {
  final amountController = TextEditingController();
  final recipientController = TextEditingController();
  String selectedCurrency = 'USD';
  String? selectedOption;
  bool confirmed = false;

  bool get isReceive => widget.title.toLowerCase().contains('receive');
  bool get isSend => widget.title.toLowerCase().contains('send');
  bool get isExchange => widget.title.toLowerCase().contains('exchange') || widget.title.toLowerCase().contains('convert');
  bool get isCrypto => widget.title.toLowerCase().contains('crypto') || widget.title.toLowerCase().contains('swap');

  @override
  void dispose() {
    amountController.dispose();
    recipientController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final heading = isReceive ? 'Receive money' : isSend ? 'Send money' : isExchange ? 'Convert currency' : widget.title;
    return Scaffold(
      appBar: AppBar(title: Text(heading), leading: IconButton(icon: const Icon(Icons.arrow_back_rounded), onPressed: () => Navigator.pop(context))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF10533D), Color(0xFF08231B)]),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: const Color(0xFF1B8A62)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(heading, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              Text(widget.subtitle, style: const TextStyle(color: Colors.white70, height: 1.4)),
              const SizedBox(height: 14),
              const Row(children: [Icon(Icons.shield_outlined, size: 17, color: emerald), SizedBox(width: 7), Expanded(child: Text('Secure flow preview • No money moves in this demo', style: TextStyle(color: Colors.white70, fontSize: 11)))]),
            ]),
          ),
          const SizedBox(height: 24),
          const Text('Choose a method', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          ...widget.options.map((option) => Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: () => setState(() => selectedOption = option),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                decoration: BoxDecoration(
                  color: selectedOption == option ? const Color(0xFF103B2D) : panel,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: selectedOption == option ? emerald : border, width: selectedOption == option ? 1.4 : 1),
                ),
                child: Row(children: [
                  CircleAvatar(backgroundColor: const Color(0xFF123C2E), child: Icon(_flowIcon(option), color: emerald, size: 20)),
                  const SizedBox(width: 12),
                  Expanded(child: Text(option, style: const TextStyle(fontWeight: FontWeight.w700))),
                  Icon(selectedOption == option ? Icons.check_circle : Icons.chevron_right, color: selectedOption == option ? emerald : Colors.white54),
                ]),
              ),
            ),
          )),
          if (!isReceive) ...[
            const SizedBox(height: 12),
            const Text('Amount', style: TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
            const SizedBox(height: 10),
            Row(children: [
              Expanded(child: TextField(
                controller: amountController,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: 'Enter amount', hintText: '0.00', prefixIcon: Icon(Icons.payments_outlined)),
              )),
              const SizedBox(width: 10),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(14), border: Border.all(color: border)),
                child: DropdownButtonHideUnderline(child: DropdownButton<String>(
                  value: selectedCurrency,
                  dropdownColor: panel,
                  items: const ['USD', 'EUR', 'PKR', 'AED', 'GBP', 'USDT', 'ZIAR'].map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (value) => setState(() => selectedCurrency = value ?? 'USD'),
                )),
              ),
            ]),
          ],
          if (isSend) ...[
            const SizedBox(height: 16),
            TextField(controller: recipientController, decoration: const InputDecoration(labelText: 'Recipient', hintText: 'Name, email or username', prefixIcon: Icon(Icons.person_search_outlined))),
          ],
          if (isReceive) ...[
            const SizedBox(height: 12),
            Container(padding: const EdgeInsets.all(18), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(20), border: Border.all(color: border)), child: const Column(children: [
              Icon(Icons.qr_code_2_rounded, size: 88, color: emerald),
              SizedBox(height: 8),
              Text('Your account details will appear here', style: TextStyle(fontWeight: FontWeight.w800), textAlign: TextAlign.center),
              SizedBox(height: 5),
              Text('A real QR code or receiving address must come from your connected account or wallet service.', style: TextStyle(color: Colors.white54, fontSize: 12), textAlign: TextAlign.center),
            ])),
          ],
          const SizedBox(height: 24),
          FilledButton(
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54), backgroundColor: emerald, foregroundColor: const Color(0xFF032116), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))),
            onPressed: () {
              if (selectedOption == null) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please choose a method to continue.')));
                return;
              }
              if (!isReceive && (double.tryParse(amountController.text.trim()) ?? 0) <= 0) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid amount greater than zero.')));
                return;
              }
              if (isSend && recipientController.text.trim().isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a recipient to continue.')));
                return;
              }
              setState(() => confirmed = true);
              showModalBottomSheet<void>(
                context: context,
                backgroundColor: panel,
                showDragHandle: true,
                builder: (sheetContext) => SafeArea(child: Padding(
                  padding: const EdgeInsets.fromLTRB(22, 8, 22, 26),
                  child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Icon(Icons.info_outline_rounded, color: emerald, size: 32),
                    const SizedBox(height: 12),
                    const Text('Demo review', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900)),
                    const SizedBox(height: 8),
                    Text(isReceive ? 'Receiving details are not connected yet.' : '${amountController.text.trim()} $selectedCurrency • $selectedOption'),
                    const SizedBox(height: 8),
                    const Text('This is a UI demonstration only. No transaction was submitted, and no funds were moved.', style: TextStyle(color: Colors.white60, height: 1.4)),
                    const SizedBox(height: 18),
                    SizedBox(width: double.infinity, child: FilledButton(onPressed: () => Navigator.pop(sheetContext), child: const Text('Understood'))),
                  ]),
                )),
              );
            },
            child: Text(isReceive ? 'Show receiving details' : isExchange || isCrypto ? 'Review conversion' : 'Review ${isSend ? 'transfer' : 'request'}', style: const TextStyle(fontWeight: FontWeight.w900)),
          ),
          if (confirmed) const Padding(padding: EdgeInsets.only(top: 12), child: Text('Preview reviewed. No transaction has been sent.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white54, fontSize: 12))),
        ],
      ),
    );
  }
}

IconData _flowIcon(String option) {
  final text = option.toLowerCase();
  if (text.contains('bank')) return Icons.account_balance_outlined;
  if (text.contains('card')) return Icons.credit_card_outlined;
  if (text.contains('crypto') || text.contains('wallet')) return Icons.currency_bitcoin_rounded;
  if (text.contains('qr')) return Icons.qr_code_2_rounded;
  if (text.contains('international')) return Icons.public_rounded;
  if (text.contains('link')) return Icons.link_rounded;
  if (text.contains('user')) return Icons.person_outline_rounded;
  if (text.contains('exchange') || text.contains('swap')) return Icons.swap_horiz_rounded;
  return Icons.arrow_forward_rounded;
}

void _notice(BuildContext context, String message) => showModalBottomSheet(context: context, backgroundColor: panel, showDragHandle: true, builder: (_) => Padding(padding: const EdgeInsets.fromLTRB(22, 4, 22, 28), child: Text(message, style: const TextStyle(fontSize: 15, height: 1.45))));
