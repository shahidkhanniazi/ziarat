import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { toMinor } from './amounts.js';
import type { AssetDef } from './assets.js';
import { env } from './config.js';
import { isUniqueViolation, pool, tx } from './db.js';
import { AppError } from './errors.js';
import { credit, debit, lockedBalance } from './ledger.js';
import { treasuryUserId, withdrawalFee } from './crypto-fees.js';
import { refundWithdrawal } from './settlement.js';
import { sendEvmTransaction } from './privy.js';
import { getOrCreateEvmWallet } from './wallets.js';
import { buildTransaction, checkDailyLimit, classifySendError, validateWithdrawal } from './withdrawal-rules.js';

export interface WithdrawalResult {
  id: string;
  status: string;
  txHash: string | null;
}

interface Logger {
  error: (obj: unknown, msg?: string) => void;
}

export function nativeGasReserve(asset: AssetDef): bigint {
  return asset.native && !env.PRIVY_SPONSOR_GAS ? toMinor(env.ZIARAT_NATIVE_GAS_RESERVE, asset.decimals) : 0n;
}

export async function requestWithdrawal(
  userId: string,
  asset: AssetDef,
  input: { address: string; amount: string },
  idempotencyKey: string,
  log: Logger,
): Promise<WithdrawalResult> {
  if (!env.ZIARAT_WITHDRAWALS_ENABLED) {
    throw new AppError(503, 'WITHDRAWALS_DISABLED', 'Withdrawals are temporarily unavailable.');
  }
  if (env.ZIARAT_REQUIRE_KYC) {
    const k = await pool.query('SELECT kyc_status FROM users WHERE id = $1', [userId]);
    if (k.rows[0]?.kyc_status !== 'approved') {
      throw new AppError(403, 'KYC_REQUIRED', 'Complete identity verification to withdraw.');
    }
  }

  const { address, amount } = validateWithdrawal(input, asset);

  const internal = await pool.query('SELECT 1 FROM wallets WHERE lower(address) = lower($1)', [address]);
  if (internal.rowCount) {
    throw new AppError(400, 'INTERNAL_ADDRESS', 'You cannot withdraw to a Ziarat deposit address.');
  }

  const blocked = await pool.query('SELECT 1 FROM blocked_addresses WHERE address = lower($1)', [address]);
  if (blocked.rowCount) {
    throw new AppError(403, 'ADDRESS_BLOCKED', 'Withdrawals to this address are not permitted.');
  }

  const requestHash = createHash('sha256').update(`${asset.code}|${address.toLowerCase()}|${amount}`).digest('hex');
  const wallet = await getOrCreateEvmWallet(userId);

  // Step 1: reserve funds + record intent atomically. Nothing is sent yet.
  let id: string;
  try {
    id = await tx(async (c) => {
      const balance = await lockedBalance(c, userId, asset.code, asset.caip2);
      const fee = await withdrawalFee(c, asset, amount);
      if (balance < amount + fee + nativeGasReserve(asset)) {
        throw new AppError(409, 'INSUFFICIENT_FUNDS', 'Insufficient balance (a small amount is kept for network fees).');
      }
      checkDailyLimit(asset, await withdrawnLast24h(c, userId, asset), amount);
      const ins = await c.query(
        `INSERT INTO crypto_transactions
           (user_id, asset, network, type, amount_minor, fee_minor, status, address, idempotency_key, request_hash)
         VALUES ($1, $2, $3, 'withdrawal', $4, $8, 'pending', $5, $6, $7)
         RETURNING id`,
        [userId, asset.code, asset.caip2, amount.toString(), address, idempotencyKey, requestHash, fee.toString()],
      );
      const newId = ins.rows[0].id as string;
      await debit(c, { userId, asset: asset.code, network: asset.caip2, amount, reason: 'withdrawal', refId: newId });
      if (fee > 0n) {
        // Revenue: the fee leaves the user and lands in the treasury in the SAME database transaction as the withdrawal.
        await debit(c, { userId, asset: asset.code, network: asset.caip2, amount: fee, reason: 'withdrawal_fee', refId: newId });
        await credit(c, { userId: await treasuryUserId(c), asset: asset.code, network: asset.caip2, amount: fee, reason: 'fee_income', refId: newId });
      }
      return newId;
    });
  } catch (error) {
    if (isUniqueViolation(error)) return replay(userId, idempotencyKey, requestHash);
    throw error;
  }

  // Step 2: send exactly once, only by the request that created the row.
  try {
    const { hash } = await sendEvmTransaction(wallet.provider_wallet_id, asset.caip2, buildTransaction(asset, address, amount));
    await recordSubmission(id, hash, log);
    return { id, status: 'submitted', txHash: hash };
  } catch (error) {
    if (classifySendError(error) === 'rejected') {
      await releaseHeldFunds(id, error);
      throw new AppError(422, 'WITHDRAWAL_REJECTED', 'The transfer was rejected. Your balance was not changed.');
    }
    // Outcome unknown: the transaction may already be on-chain. Keep funds held, never auto-refund.
    log.error({ id, error }, 'withdrawal outcome unknown; marked needs_review');
    await pool.query(`UPDATE crypto_transactions SET status = 'needs_review', updated_at = now() WHERE id = $1 AND status = 'pending'`, [id]);
    return { id, status: 'needs_review', txHash: null };
  }
}

async function withdrawnLast24h(c: PoolClient, userId: string, asset: AssetDef): Promise<bigint> {
  const r = await c.query(
    `SELECT COALESCE(SUM(amount_minor), 0) AS total FROM crypto_transactions
      WHERE user_id = $1 AND asset = $2 AND network = $3 AND type = 'withdrawal'
        AND status <> 'failed' AND created_at > now() - interval '24 hours'`,
    [userId, asset.code, asset.caip2],
  );
  return BigInt(r.rows[0].total);
}

async function releaseHeldFunds(id: string, error: unknown): Promise<void> {
  await refundWithdrawal(id, ['pending'], String((error as Error)?.message ?? 'rejected'));
}

async function replay(userId: string, key: string, requestHash: string): Promise<WithdrawalResult> {
  const r = await pool.query(
    `SELECT id, status, tx_hash, request_hash FROM crypto_transactions WHERE user_id = $1 AND idempotency_key = $2`,
    [userId, key],
  );
  const row = r.rows[0];
  if (!row) throw new AppError(409, 'RETRY', 'Please retry.');
  if (row.request_hash !== requestHash) {
    throw new AppError(422, 'IDEMPOTENCY_MISMATCH', 'This Idempotency-Key was already used for a different request.');
  }
  return { id: row.id, status: row.status, txHash: row.tx_hash };
}

/** The transfer is already broadcast, so retry the bookkeeping; if it still fails the hash is in the logs for manual repair. */
async function recordSubmission(id: string, hash: string, log: Logger): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await pool.query(
        `UPDATE crypto_transactions SET status = 'submitted', tx_hash = $2, updated_at = now() WHERE id = $1 AND status IN ('pending','needs_review')`,
        [id, hash],
      );
      return;
    } catch (dbError) {
      if (attempt === 3) log.error({ id, hash, dbError }, 'CRITICAL: transfer sent but status update failed; reconcile manually');
      else await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }
}
