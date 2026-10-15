/// Converts a decimal string to integer minor units. Returns null when the text is not a valid amount
/// or has more decimal places than the asset supports. Never uses double.
BigInt? parseMinor(String text, int decimals) {
  final t = text.trim();
  if (!RegExp(r'^\d+(\.\d+)?$').hasMatch(t)) return null;
  final parts = t.split('.');
  final fraction = parts.length > 1 ? parts[1] : '';
  if (fraction.length > decimals) return null;
  final padded = fraction.padRight(decimals, '0');
  return BigInt.parse(parts[0]) * BigInt.from(10).pow(decimals) + BigInt.parse(padded.isEmpty ? '0' : padded);
}

bool isEvmAddress(String value) => RegExp(r'^0x[0-9a-fA-F]{40}$').hasMatch(value.trim());

String shortAddress(String value) =>
    value.length <= 14 ? value : '${value.substring(0, 8)}…${value.substring(value.length - 6)}';
