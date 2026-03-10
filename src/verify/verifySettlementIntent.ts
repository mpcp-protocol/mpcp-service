import { canonicalJson } from "../canonical/canonicalJson.js";
import { computeSettlementIntentHash } from "../hash/computeSettlementIntentHash.js";
import type { SignedPaymentAuthorization } from "../protocol/spa.js";

/** Minimal intent shape for verification */
interface SettlementIntentLike {
  rail?: string;
  amount?: string;
  destination?: string;
  asset?: unknown;
  [k: string]: unknown;
}

/**
 * Verify a settlement intent matches the SPA's authorized parameters.
 *
 * Checks:
 * - If SPA has intentHash: computed hash of intent must equal SPA.intentHash
 * - Intent rail, amount, destination, asset must match SPA authorization
 *
 * @param envelope - SPA envelope (defines authorized params)
 * @param intent - Settlement intent to verify
 * @returns Deterministic result with clear failure reason
 */
export function verifySettlementIntent(
  envelope: SignedPaymentAuthorization,
  intent: SettlementIntentLike,
): { ok: true } | { ok: false; reason: string } {
  const auth = envelope.authorization;

  if (auth.intentHash) {
    const computedHash = computeSettlementIntentHash(intent);
    if (computedHash !== auth.intentHash) {
      return { ok: false, reason: "intent_hash_mismatch" };
    }
  }

  if (intent.rail !== undefined && intent.rail !== auth.rail) {
    return { ok: false, reason: "intent_rail_mismatch" };
  }
  if (intent.amount !== undefined && intent.amount !== auth.amount) {
    return { ok: false, reason: "intent_amount_mismatch" };
  }
  if (
    intent.destination !== undefined &&
    auth.destination &&
    intent.destination !== auth.destination
  ) {
    return { ok: false, reason: "intent_destination_mismatch" };
  }
  if (intent.asset !== undefined && auth.asset) {
    if (canonicalJson(intent.asset) !== canonicalJson(auth.asset)) {
      return { ok: false, reason: "intent_asset_mismatch" };
    }
  }

  return { ok: true };
}
