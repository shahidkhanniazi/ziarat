import 'package:flutter/foundation.dart' show kReleaseMode;
import 'package:flutter/material.dart';
import 'package:privy_flutter/privy_flutter.dart';
import 'screens/ziarat_app.dart';
import 'screens/login_page.dart';
import 'services/privy_auth_service.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ZiaratEntry());
}

class ZiaratEntry extends StatelessWidget {
  const ZiaratEntry({super.key});

  static const emerald = Color(0xFF18E6A4);
  static const bg = Color(0xFF03100C);
  static const panel = Color(0xFF0A1D16);
  static const border = Color(0xFF194B39);

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: 'Ziarat',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      brightness: Brightness.dark,
      scaffoldBackgroundColor: bg,
      colorScheme: const ColorScheme.dark(primary: emerald, secondary: Color(0xFF70F4C5), surface: panel, error: Color(0xFFFF6B78)),
      useMaterial3: true,
      fontFamily: 'Roboto',
      appBarTheme: const AppBarTheme(backgroundColor: bg, elevation: 0, centerTitle: false, titleTextStyle: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800), iconTheme: IconThemeData(color: Colors.white)),
      inputDecorationTheme: InputDecorationTheme(
        filled: true, fillColor: panel,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: border)),
        enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: border)),
        focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: emerald, width: 1.5)),
      ),
      navigationBarTheme: const NavigationBarThemeData(backgroundColor: Color(0xFF061710), indicatorColor: Color(0xFF0E4B37), labelTextStyle: WidgetStatePropertyAll(TextStyle(fontSize: 10, fontWeight: FontWeight.w700))),
      filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(backgroundColor: emerald, foregroundColor: const Color(0xFF042016), textStyle: const TextStyle(fontWeight: FontWeight.w800), shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)), minimumSize: const Size(48, 52))),
    ),
    home: const _EntryGate(),
  );
}
class _EntryGate extends StatefulWidget{const _EntryGate();@override State<_EntryGate> createState()=>_EntryGateState();}
class _EntryGateState extends State<_EntryGate>{bool loading=true;bool authenticated=false;final auth=PrivyAuthService.instance;@override void initState(){super.initState();_check();}Future<void> _check()async{if(!auth.configured){setState(()=>loading=false);return;}try{final state=await auth.authState();authenticated=state is Authenticated || state is AuthenticatedUnverified;}catch(_){authenticated=false;}if(mounted)setState(()=>loading=false);}@override Widget build(BuildContext c){if(loading)return const Scaffold(body:Center(child:CircularProgressIndicator()));if(!auth.configured){if(kReleaseMode)return const _ConfigError();return const WalletShell();}return authenticated?const WalletShell():const LoginPage();}}

class _ConfigError extends StatelessWidget{
  const _ConfigError();
  @override Widget build(BuildContext c)=>const Scaffold(body:Center(child:Padding(padding:EdgeInsets.all(24),child:Text('This build is missing its configuration (ZIARAT_PRIVY_APP_ID / ZIARAT_PRIVY_CLIENT_ID). Please install an official release.',textAlign:TextAlign.center))));
}
