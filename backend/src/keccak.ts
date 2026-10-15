/** Minimal Keccak-256 (the Ethereum variant, NOT NIST SHA3). Used only for EIP-55 address checksums. */
const MASK = (1n << 64n) - 1n;
const rotl = (x: bigint, n: number): bigint => (n === 0 ? x : ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK);

const RC: bigint[] = (() => {
  const out: bigint[] = [];
  let r = 1;
  for (let i = 0; i < 24; i++) {
    let c = 0n;
    for (let j = 0; j < 7; j++) {
      r = ((r << 1) ^ ((r >> 7) * 0x71)) & 0xff;
      if (r & 2) c ^= 1n << BigInt((1 << j) - 1);
    }
    out.push(c);
  }
  return out;
})();

function permute(a: bigint[]): void {
  for (let round = 0; round < 24; round++) {
    const c: bigint[] = [];
    for (let x = 0; x < 5; x++) c[x] = a[x]! ^ a[x + 5]! ^ a[x + 10]! ^ a[x + 15]! ^ a[x + 20]!;
    for (let x = 0; x < 5; x++) {
      const d = c[(x + 4) % 5]! ^ rotl(c[(x + 1) % 5]!, 1);
      for (let y = 0; y < 25; y += 5) a[x + y] = a[x + y]! ^ d;
    }
    let x = 1;
    let y = 0;
    let cur = a[1]!;
    for (let t = 0; t < 24; t++) {
      [x, y] = [y, (2 * x + 3 * y) % 5];
      const tmp = a[x + 5 * y]!;
      a[x + 5 * y] = rotl(cur, (((t + 1) * (t + 2)) / 2) % 64);
      cur = tmp;
    }
    for (let yy = 0; yy < 25; yy += 5) {
      const row = a.slice(yy, yy + 5);
      for (let xx = 0; xx < 5; xx++) a[yy + xx] = row[xx]! ^ (~row[(xx + 1) % 5]! & MASK & row[(xx + 2) % 5]!);
    }
    a[0] = a[0]! ^ RC[round]!;
  }
}

export function keccak256(input: Uint8Array): Uint8Array {
  const rate = 136;
  const padded = new Uint8Array(Math.ceil((input.length + 1) / rate) * rate);
  padded.set(input);
  padded[input.length] = (padded[input.length] ?? 0) ^ 0x01;
  padded[padded.length - 1] = (padded[padded.length - 1] ?? 0) ^ 0x80;
  const state: bigint[] = new Array<bigint>(25).fill(0n);
  for (let off = 0; off < padded.length; off += rate) {
    for (let i = 0; i < rate / 8; i++) {
      let lane = 0n;
      for (let b = 7; b >= 0; b--) lane = (lane << 8n) | BigInt(padded[off + i * 8 + b]!);
      state[i] = state[i]! ^ lane;
    }
    permute(state);
  }
  const out = new Uint8Array(32);
  for (let i = 0; i < 4; i++) for (let b = 0; b < 8; b++) out[i * 8 + b] = Number((state[i]! >> BigInt(8 * b)) & 0xffn);
  return out;
}

export function keccak256Hex(text: string): string {
  return Array.from(keccak256(new TextEncoder().encode(text)), (b) => b.toString(16).padStart(2, '0')).join('');
}
