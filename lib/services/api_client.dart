import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  const ApiException({required this.statusCode, required this.code, required this.message});

  final int statusCode; // 0 = could not reach the server
  final String code;
  final String message;

  /// The server definitely rejected the request, so a NEW attempt (with a new Idempotency-Key) is correct.
  bool get isDefinitive => statusCode >= 400 && statusCode < 500 && statusCode != 408 && statusCode != 429;

  @override
  String toString() => message;
}

/// Thin HTTPS client. It never holds provider secrets; it only forwards the user's session token.
class ApiClient {
  ApiClient({required this.baseUrl, http.Client? client}) : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  // Debug builds only: lets you hit a backend that has ALLOW_DEV_AUTH=true. Ignored in release builds.
  static const _devUserId = String.fromEnvironment('ZIARAT_DEV_USER_ID');
  static const _timeout = Duration(seconds: 20);

  Map<String, String> _headers(String? token, {String? idempotencyKey, bool json = false}) => {
        'Accept': 'application/json',
        if (json) 'Content-Type': 'application/json',
        if (idempotencyKey != null) 'Idempotency-Key': idempotencyKey,
        if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
        if (kDebugMode && _devUserId.isNotEmpty) 'X-Ziarat-User-Id': _devUserId,
      };

  Future<Map<String, dynamic>> getJson(String path, {String? token, Map<String, String>? query}) {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: query);
    return _send(() => _client.get(uri, headers: _headers(token)));
  }

  Future<Map<String, dynamic>> postJson(
    String path,
    Map<String, dynamic> body, {
    String? token,
    String? idempotencyKey,
  }) {
    final uri = Uri.parse('$baseUrl$path');
    return _send(() => _client.post(
          uri,
          headers: _headers(token, idempotencyKey: idempotencyKey, json: true),
          body: jsonEncode(body),
        ));
  }

  Future<Map<String, dynamic>> _send(Future<http.Response> Function() call) async {
    final http.Response res;
    try {
      res = await call().timeout(_timeout);
    } catch (_) {
      throw const ApiException(statusCode: 0, code: 'NETWORK', message: 'Could not reach Ziarat. Check your connection.');
    }

    Map<String, dynamic> body = <String, dynamic>{};
    if (res.body.isNotEmpty) {
      try {
        final decoded = jsonDecode(res.body);
        if (decoded is Map<String, dynamic>) body = decoded;
      } on FormatException {
        throw ApiException(statusCode: res.statusCode, code: 'BAD_RESPONSE', message: 'Unexpected response from server.');
      }
    }

    if (res.statusCode >= 200 && res.statusCode < 300) return body;

    final err = body['error'];
    if (err is Map<String, dynamic>) {
      throw ApiException(
        statusCode: res.statusCode,
        code: (err['code'] ?? 'ERROR').toString(),
        message: (err['message'] ?? 'Request failed.').toString(),
      );
    }
    throw ApiException(statusCode: res.statusCode, code: 'ERROR', message: 'Request failed (${res.statusCode}).');
  }
}
