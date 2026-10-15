import 'package:privy_flutter/privy_flutter.dart';

/// Single Privy instance for the whole app (privy_flutter ^0.11.0).
///
/// Build with:
///   --dart-define=ZIARAT_PRIVY_APP_ID=...    (Dashboard > App Settings > Basics)
///   --dart-define=ZIARAT_PRIVY_CLIENT_ID=... (Dashboard > App Settings > Clients)
class PrivyAuthService {
  PrivyAuthService._();
  static final instance = PrivyAuthService._();

  final String appId = const String.fromEnvironment('ZIARAT_PRIVY_APP_ID');
  final String clientId = const String.fromEnvironment('ZIARAT_PRIVY_CLIENT_ID');
  Privy? _privy;

  bool get configured => appId.isNotEmpty && clientId.isNotEmpty;

  Privy get privy {
    if (!configured) {
      throw StateError('Set ZIARAT_PRIVY_APP_ID and ZIARAT_PRIVY_CLIENT_ID.');
    }
    return _privy ??= Privy(config: PrivyConfig(appId: appId, appClientId: clientId));
  }

  /// Waits until the SDK has finished initialising (state leaves NotReady).
  Future<AuthState> authState() => privy.getAuthState();

  /// Session token sent to the backend as `Authorization: Bearer <token>`.
  /// In 0.11 the token lives on the user and comes back as a Result.
  Future<String?> accessToken() async {
    if (!configured) return null;
    final user = await privy.getUser();
    if (user == null) return null;
    final result = await user.getAccessToken();
    return result.fold(
      onSuccess: (token) => token,
      onFailure: (_) => null,
    );
  }

  Future<String?> userId() async {
    if (!configured) return null;
    final user = await privy.getUser();
    return user?.id;
  }

  Future<void> sendEmailCode(String email) async {
    final r = await privy.email.sendCode(email);
    if (r is Failure) throw StateError(r.toString());
  }

  Future<void> loginEmail(String email, String code) async {
    final r = await privy.email.loginWithCode(code: code, email: email);
    if (r is Failure) throw StateError(r.toString());
  }

  Future<void> logout() async {
    if (configured) await privy.logout();
  }
}
