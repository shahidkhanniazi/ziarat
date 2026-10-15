import 'package:flutter/material.dart';
import '../services/privy_auth_service.dart';
import 'ziarat_app.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});
  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final email = TextEditingController();
  final code = TextEditingController();
  bool sent = false;
  bool busy = false;
  String? error;
  final auth = PrivyAuthService.instance;

  Future<void> _send() async {
    if (email.text.trim().isEmpty) {
      setState(() => error = 'Enter your email address.');
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      await auth.sendEmailCode(email.text.trim());
      if (mounted) setState(() => sent = true);
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _login() async {
    if (code.text.trim().isEmpty) {
      setState(() => error = 'Enter the verification code.');
      return;
    }
    setState(() { busy = true; error = null; });
    try {
      await auth.loginEmail(email.text.trim(), code.text.trim());
      if (mounted) Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const WalletShell()));
    } catch (e) {
      if (mounted) setState(() => error = e.toString());
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    email.dispose();
    code.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: bg,
    body: SafeArea(child: Center(child: SingleChildScrollView(padding: const EdgeInsets.all(22), child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 430), child: Column(children: [
      const SizedBox(height: 22),
      Container(width: 82, height: 82, decoration: BoxDecoration(gradient: const LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: [Color(0xFF135C42), Color(0xFF061A12)]), borderRadius: BorderRadius.circular(27), border: Border.all(color: const Color(0xFF27B985)), boxShadow: const [BoxShadow(color: Color(0x3327E0A0), blurRadius: 30, spreadRadius: 1)]), child: const Center(child: Text('Ż', style: TextStyle(color: emerald, fontSize: 48, fontWeight: FontWeight.w900))),
      const SizedBox(height: 18),
      const Text('ZIARAT', style: TextStyle(fontSize: 31, letterSpacing: 3.0, fontWeight: FontWeight.w900)),
      const SizedBox(height: 3),
      Container(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 3), decoration: BoxDecoration(color: emerald, borderRadius: BorderRadius.circular(6)), child: const Text('PRO', style: TextStyle(color: Color(0xFF042016), fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 1.2)),),
      const SizedBox(height: 6),
      const Text('Global payments. One financial home.', textAlign: TextAlign.center, style: TextStyle(color: Colors.white60, fontSize: 13, height: 1.4)),
      const SizedBox(height: 28),
      Container(padding: const EdgeInsets.all(22), decoration: BoxDecoration(color: panel, borderRadius: BorderRadius.circular(26), border: Border.all(color: border)), child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        const Text('Sign in', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
        const SizedBox(height: 6),
        const Text('Use your email to securely access Ziarat.', style: TextStyle(color: Colors.white54, fontSize: 12)),
        const SizedBox(height: 20),
        TextField(controller: email, keyboardType: TextInputType.emailAddress, textInputAction: TextInputAction.done, autocorrect: false, autofillHints: const [AutofillHints.email], enabled: !sent, decoration: const InputDecoration(labelText: 'Email address', hintText: 'you@example.com', prefixIcon: Icon(Icons.alternate_email_rounded))),
        if (sent) ...[
          const SizedBox(height: 12),
          TextField(controller: code, keyboardType: TextInputType.number, textInputAction: TextInputAction.done, autofillHints: const [AutofillHints.oneTimeCode], decoration: const InputDecoration(labelText: 'Verification code', hintText: 'Enter the code from your email', prefixIcon: Icon(Icons.verified_outlined))),
        ],
        if (error != null) ...[const SizedBox(height: 12), Text(error!, style: const TextStyle(color: Colors.redAccent, fontSize: 12))],
        const SizedBox(height: 18),
        FilledButton(onPressed: busy ? null : (sent ? _login : _send), style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16))), child: Text(busy ? 'Please wait…' : (sent ? 'Verify & continue' : 'Continue with email'))),
        if (sent) ...[const SizedBox(height: 8), TextButton(onPressed: busy ? null : () => setState(() { sent = false; error = null; }), child: const Text('Use a different email'))],
      ])),
      const SizedBox(height: 16),
      const Text('Secure access • Privacy-first • Global-ready', style: TextStyle(color: Colors.white38, fontSize: 11)),
    ]))))),
  );
}
