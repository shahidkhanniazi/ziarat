import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../models/crypto_asset.dart';
import '../models/crypto_transaction.dart';
import '../services/api_client.dart';
import '../services/crypto_service.dart';
import '../utils/amounts.dart';

const _green = Color(0xFF27E0A0);
const _bg = Color(0xFF04110D);
const _panel = Color(0xFF0A2119);
const _border = Color(0xFF174D3B);
const _apiUrl = String.fromEnvironment('ZIARAT_API_URL');

CryptoService _buildService() => CryptoService(ApiClient(baseUrl: _apiUrl));

void _toast(BuildContext context, String message) =>
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));

// ---------------------------------------------------------------------------
// Crypto tab: list of assets with balances
// ---------------------------------------------------------------------------
class CryptoWalletPage extends StatefulWidget {
  const CryptoWalletPage({super.key});

  @override
  State<CryptoWalletPage> createState() => _CryptoWalletPageState();
}

class _CryptoWalletPageState extends State<CryptoWalletPage> {
  late final CryptoService service = _buildService();
  bool loading = true;
  String? error;
  List<CryptoAsset> assets = const [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    if (_apiUrl.isEmpty) {
      setState(() {
        loading = false;
        error = 'Backend not configured. Build with --dart-define=ZIARAT_API_URL=https://your-api.';
      });
      return;
    }
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final result = await service.assets();
      if (!mounted) return;
      setState(() => assets = result);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> _open(Widget page) async {
    final changed = await Navigator.of(context).push<bool>(MaterialPageRoute(builder: (_) => page));
    if (changed == true) _load();
  }

  void _actions(CryptoAsset asset) {
    showModalBottomSheet<void>(
      context: context,
      backgroundColor: _panel,
      showDragHandle: true,
      builder: (sheetContext) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.download_rounded, color: _green),
            title: Text('Deposit ${asset.code}'),
            subtitle: Text('Get your ${asset.network} address'),
            onTap: () {
              Navigator.pop(sheetContext);
              _open(DepositPage(service: service, asset: asset));
            },
          ),
          ListTile(
            enabled: asset.withdrawalsEnabled,
            leading: Icon(Icons.upload_rounded, color: asset.withdrawalsEnabled ? _green : Colors.white24),
            title: Text('Withdraw ${asset.code}'),
            subtitle: Text(asset.withdrawalsEnabled ? 'Send to an external wallet' : 'Temporarily unavailable'),
            onTap: () {
              Navigator.pop(sheetContext);
              _open(WithdrawPage(service: service, asset: asset));
            },
          ),
        ]),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (loading) return const Center(child: CircularProgressIndicator());
    if (error != null) return _ErrorState(message: error!, onRetry: _load);
    return RefreshIndicator(
      onRefresh: _load,
      color: _green,
      backgroundColor: _panel,
      child: ListView(padding: const EdgeInsets.fromLTRB(18, 18, 18, 28), children: [
        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          const Text('Digital assets', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
          TextButton.icon(
            onPressed: () => _open(TransactionsPage(service: service)),
            icon: const Icon(Icons.history_rounded, size: 18),
            label: const Text('History'),
          ),
        ]),
        const SizedBox(height: 8),
        if (assets.isEmpty)
          const _Note('No digital assets are enabled yet.')
        else
          ...assets.map((a) => _AssetTile(asset: a, onTap: () => _actions(a))),
        const SizedBox(height: 14),
        const _Note('Send only the listed asset on the listed network. Transfers on blockchains cannot be reversed.'),
      ]),
    );
  }
}

class _AssetTile extends StatelessWidget {
  const _AssetTile({required this.asset, required this.onTap});
  final CryptoAsset asset;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Card(
        color: _panel,
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: _border)),
        child: ListTile(
          onTap: onTap,
          leading: CircleAvatar(
            backgroundColor: const Color(0xFF0E4433),
            child: Text(asset.code.isEmpty ? '?' : asset.code[0], style: const TextStyle(fontWeight: FontWeight.w800)),
          ),
          title: Text(asset.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Text(asset.network, style: const TextStyle(color: Colors.white54)),
          trailing: Text('${asset.balance} ${asset.code}', style: const TextStyle(fontWeight: FontWeight.w700)),
        ),
      );
}

// ---------------------------------------------------------------------------
// Deposit: address + QR
// ---------------------------------------------------------------------------
class DepositPage extends StatefulWidget {
  const DepositPage({super.key, required this.service, required this.asset});
  final CryptoService service;
  final CryptoAsset asset;

  @override
  State<DepositPage> createState() => _DepositPageState();
}

class _DepositPageState extends State<DepositPage> {
  DepositInfo? info;
  String? error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => error = null);
    try {
      final result = await widget.service.depositAddress(widget.asset.code);
      if (mounted) setState(() => info = result);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    }
  }

  @override
  Widget build(BuildContext context) {
    final i = info;
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(title: Text('Deposit ${widget.asset.code}')),
      body: error != null
          ? _ErrorState(message: error!, onRetry: _load)
          : i == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(padding: const EdgeInsets.all(20), children: [
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16)),
                      child: QrImageView(data: i.address, size: 200, backgroundColor: Colors.white),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Center(child: Chip(label: Text('Network: ${i.network}'), backgroundColor: _panel)),
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(14), border: Border.all(color: _border)),
                    child: SelectableText(i.address, textAlign: TextAlign.center, style: const TextStyle(fontSize: 14)),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed: () async {
                      await Clipboard.setData(ClipboardData(text: i.address));
                      if (mounted) _toast(context, 'Address copied');
                    },
                    icon: const Icon(Icons.copy_rounded),
                    label: const Text('Copy address'),
                  ),
                  const SizedBox(height: 16),
                  _Note(i.warning),
                  const SizedBox(height: 8),
                  const _Note('Your balance updates automatically after the network confirms the deposit.'),
                ]),
    );
  }
}

// ---------------------------------------------------------------------------
// Withdraw: form -> review -> submit (idempotent)
// ---------------------------------------------------------------------------
class WithdrawPage extends StatefulWidget {
  const WithdrawPage({super.key, required this.service, required this.asset});
  final CryptoService service;
  final CryptoAsset asset;

  @override
  State<WithdrawPage> createState() => _WithdrawPageState();
}

class _WithdrawPageState extends State<WithdrawPage> {
  final address = TextEditingController();
  final amount = TextEditingController();
  String? formError;
  bool submitting = false;

  /// One key per logical withdrawal. Reused if the result is unknown, so a retry can never pay twice.
  String? _key;

  @override
  void dispose() {
    address.dispose();
    amount.dispose();
    super.dispose();
  }

  String? _validate() {
    final a = widget.asset;
    if (!isEvmAddress(address.text)) return 'Enter a valid wallet address (0x…).';
    final minor = parseMinor(amount.text, a.decimals);
    if (minor == null) return 'Enter a valid amount (up to ${a.decimals} decimals).';
    if (minor <= BigInt.zero) return 'Amount must be greater than zero.';
    final available = parseMinor(a.available, a.decimals) ?? BigInt.zero;
    if (minor > available) return 'More than your available ${a.available} ${a.code}.';
    return null;
  }

  Future<void> _review() async {
    final problem = _validate();
    setState(() => formError = problem);
    if (problem != null) return;
    final a = widget.asset;
    // The fee is always fetched and shown before confirmation; never withdraw with an undisclosed fee.
    final FeeQuote quote;
    try {
      quote = await widget.service.feeQuote(asset: a.code, amount: amount.text.trim());
    } on ApiException catch (e) {
      if (mounted) setState(() => formError = e.message);
      return;
    }
    if (!mounted) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (_) => AlertDialog(
        backgroundColor: _panel,
        title: const Text('Confirm withdrawal'),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('${amount.text.trim()} ${a.code}', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          const SizedBox(height: 10),
          Text('Network: ${a.network}'),
          const SizedBox(height: 6),
          Text('Ziarat fee: ${quote.fee} ${a.code}'),
          Text('Total deducted: ${quote.total} ${a.code}', style: const TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text('To: ${address.text.trim()}', style: const TextStyle(fontSize: 12)),
          const SizedBox(height: 12),
          const Text('Blockchain transfers cannot be reversed. Check the address and network.',
              style: TextStyle(color: Colors.white60, fontSize: 12)),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, true), child: const Text('Withdraw')),
        ],
      ),
    );
    if (confirmed == true) await _submit();
  }

  Future<void> _submit() async {
    setState(() => submitting = true);
    _key ??= CryptoService.newIdempotencyKey();
    try {
      final result = await widget.service.withdraw(
        asset: widget.asset.code,
        address: address.text.trim(),
        amount: amount.text.trim(),
        idempotencyKey: _key!,
      );
      _key = null;
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (_) => AlertDialog(
          backgroundColor: _panel,
          title: Text(result.underReview ? 'Under review' : 'Withdrawal submitted'),
          content: Text(result.underReview
              ? 'We are confirming this transfer with the network. Your funds are held safely. Do not retry; check History for the final status.'
              : 'Your transfer was sent to the network. It will show as confirmed in History.${result.txHash == null ? '' : '\n\nTx: ${shortAddress(result.txHash!)}'}'),
          actions: [FilledButton(onPressed: () => Navigator.pop(context), child: const Text('OK'))],
        ),
      );
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (e.isDefinitive) _key = null; // rejected: a new attempt is a new withdrawal
      if (!mounted) return;
      setState(() => formError = e.isDefinitive
          ? e.message
          : 'We could not confirm the result. Check History before trying again; retrying this exact request is safe.');
    } finally {
      if (mounted) setState(() => submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final a = widget.asset;
    return Scaffold(
      backgroundColor: _bg,
      appBar: AppBar(title: Text('Withdraw ${a.code}')),
      body: ListView(padding: const EdgeInsets.all(20), children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(color: _panel, borderRadius: BorderRadius.circular(14), border: Border.all(color: _border)),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            Text(a.network, style: const TextStyle(color: Colors.white70)),
            Text('Available: ${a.available} ${a.code}', style: const TextStyle(fontWeight: FontWeight.w700)),
          ]),
        ),
        const SizedBox(height: 16),
        TextField(
          controller: address,
          enabled: !submitting,
          autocorrect: false,
          decoration: InputDecoration(
            labelText: 'Recipient address',
            suffixIcon: IconButton(
              icon: const Icon(Icons.paste_rounded),
              onPressed: () async {
                final data = await Clipboard.getData(Clipboard.kTextPlain);
                if (data?.text != null) address.text = data!.text!.trim();
              },
            ),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: amount,
          enabled: !submitting,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          decoration: InputDecoration(
            labelText: 'Amount (${a.code})',
            suffixIcon: TextButton(
              onPressed: () async {
                try {
                  final m = await widget.service.maxSendable(a.code);
                  if (mounted) setState(() => amount.text = m);
                } on ApiException catch (e) {
                  if (mounted) setState(() => formError = e.message);
                }
              },
              child: const Text('Max')),
          ),
        ),
        if (a.native) ...[
          const SizedBox(height: 8),
          const Text('The Ziarat fee is shown before you confirm. A small amount may be kept back for network fees.', style: TextStyle(color: Colors.white54, fontSize: 12)),
        ],
        if (formError != null) ...[
          const SizedBox(height: 12),
          Text(formError!, style: const TextStyle(color: Color(0xFFFF6B78))),
        ],
        const SizedBox(height: 20),
        FilledButton(
          onPressed: submitting ? null : _review,
          child: submitting
              ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Review withdrawal'),
        ),
      ]),
    );
  }
}

// ---------------------------------------------------------------------------
// History
// ---------------------------------------------------------------------------
class TransactionsPage extends StatefulWidget {
  const TransactionsPage({super.key, required this.service});
  final CryptoService service;

  @override
  State<TransactionsPage> createState() => _TransactionsPageState();
}

class _TransactionsPageState extends State<TransactionsPage> {
  final items = <CryptoTransaction>[];
  String? next;
  String? error;
  bool loading = true;

  @override
  void initState() {
    super.initState();
    _load(reset: true);
  }

  Future<void> _load({bool reset = false}) async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      final page = await widget.service.transactions(before: reset ? null : next);
      if (!mounted) return;
      setState(() {
        if (reset) items.clear();
        items.addAll(page.items);
        next = page.nextBefore;
      });
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'confirmed':
        return _green;
      case 'failed':
        return const Color(0xFFFF6B78);
      case 'needs_review':
        return Colors.amber;
      default:
        return Colors.white54;
    }
  }

  String _statusLabel(String s) => s == 'needs_review' ? 'under review' : s;

  @override
  Widget build(BuildContext context) => Scaffold(
        backgroundColor: _bg,
        appBar: AppBar(title: const Text('History')),
        body: error != null && items.isEmpty
            ? _ErrorState(message: error!, onRetry: () => _load(reset: true))
            : loading && items.isEmpty
                ? const Center(child: CircularProgressIndicator())
                : RefreshIndicator(
                    onRefresh: () => _load(reset: true),
                    child: ListView(padding: const EdgeInsets.all(16), children: [
                      if (items.isEmpty) const _Note('No digital-asset activity yet.'),
                      ...items.map((t) => ListTile(
                            leading: Icon(t.isDeposit ? Icons.south_west_rounded : Icons.north_east_rounded, color: _green),
                            title: Text('${t.isDeposit ? 'Deposit' : 'Withdrawal'} ${t.asset}'),
                            subtitle: Text(
                              [
                                if (t.createdAt != null) t.createdAt!.toLocal().toString().split('.').first,
                                if (t.txHash != null) shortAddress(t.txHash!),
                              ].join(' · '),
                              style: const TextStyle(color: Colors.white54, fontSize: 12),
                            ),
                            trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                              Text('${t.isDeposit ? '+' : '−'}${t.amount}', style: const TextStyle(fontWeight: FontWeight.w700)),
                              Text(_statusLabel(t.status), style: TextStyle(color: _statusColor(t.status), fontSize: 12)),
                            ]),
                          )),
                      if (next != null)
                        TextButton(onPressed: loading ? null : () => _load(), child: Text(loading ? 'Loading…' : 'Load more')),
                    ]),
                  ),
      );
}

// ---------------------------------------------------------------------------
// Small shared widgets
// ---------------------------------------------------------------------------
class _Note extends StatelessWidget {
  const _Note(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: const Color(0xFF0A1D17), borderRadius: BorderRadius.circular(15), border: Border.all(color: _border)),
        child: Text(text, style: const TextStyle(color: Colors.white60, fontSize: 12.5, height: 1.4)),
      );
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(22),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.cloud_off_rounded, color: Colors.white54, size: 40),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
            const SizedBox(height: 14),
            FilledButton(onPressed: onRetry, child: const Text('Try again')),
          ]),
        ),
      );
}
