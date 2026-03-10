/**
 * Single internal verification pipeline.
 * Emits bare result, steps (for report), and checks (for detailed report).
 */

import { computeSettlementIntentHash } from "../hash/computeSettlementIntentHash.js";
import { signedBudgetAuthorizationSchema } from "../schema/signedBudgetAuthorization.js";
import { signedPaymentAuthorizationSchema } from "../schema/paymentAuthorization.js";
import { policyGrantForVerificationSchema } from "../schema/verifySchemas.js";
import { settlementIntentForVerificationSchema } from "../schema/verifySchemas.js";
import { verifyBudgetAuthorization } from "./verifyBudgetAuthorization.js";
import { verifyPaymentAuthorization } from "./verifyPaymentAuthorization.js";
import { verifyPolicyGrant } from "./verifyPolicyGrant.js";
import { verifySettlementIntent } from "./verifySettlementIntent.js";
import type {
  SettlementVerificationContext,
  VerificationCheck,
  VerificationResult,
  VerificationStep,
} from "./types.js";

/** Internal pipeline output — single source of truth. */
export interface VerificationPipelineOutput {
  result: VerificationResult;
  steps: VerificationStep[];
  checks: VerificationCheck[];
}

function parseArtifact(
  name: string,
  schema: { safeParse: (v: unknown) => { success: boolean; error?: { errors: unknown[]; message: string } } },
  value: unknown,
): VerificationResult {
  const result = schema.safeParse(value);
  if (result.success) return { valid: true };
  const first = (result as { error: { errors: Array<{ path?: string[]; message?: string }> } }).error.errors[0];
  const path = first?.path?.length ? first.path.join(".") + ": " : "";
  return {
    valid: false,
    reason: `invalid_artifact: ${name} ${path}${first?.message ?? (result as { error: { message: string } }).error.message}`,
    artifact: name,
  };
}

function pushCheck(
  checks: VerificationCheck[],
  artifact: string,
  check: string,
  valid: boolean,
  opts?: { reason?: string; expected?: unknown; actual?: unknown },
): boolean {
  checks.push({
    name: `${artifact}.${check}`,
    artifact,
    check,
    valid,
    reason: opts?.reason,
    expected: opts?.expected,
    actual: opts?.actual,
  });
  return valid;
}

function pushStep(steps: VerificationStep[], name: string, result: VerificationResult): boolean {
  const ok = result.valid;
  steps.push({ name, ok, reason: ok ? undefined : result.reason });
  return ok;
}

/**
 * Single verification pipeline. Runs once, collects result + steps + checks.
 */
export function runVerificationPipeline(
  ctx: SettlementVerificationContext,
): VerificationPipelineOutput {
  const steps: VerificationStep[] = [];
  const checks: VerificationCheck[] = [];

  // --- Schema validation ---
  const grantCheck = parseArtifact("policyGrant", policyGrantForVerificationSchema, ctx.policyGrant);
  if (!pushCheck(checks, "PolicyGrant", "schema", grantCheck.valid, {
    reason: grantCheck.valid ? undefined : grantCheck.reason,
  })) {
    return { result: grantCheck, steps, checks };
  }

  const sbaCheck = parseArtifact("signedBudgetAuthorization", signedBudgetAuthorizationSchema, ctx.signedBudgetAuthorization);
  if (!pushCheck(checks, "SignedBudgetAuthorization", "schema", sbaCheck.valid, {
    reason: sbaCheck.valid ? undefined : sbaCheck.reason,
  })) {
    return { result: sbaCheck, steps, checks };
  }

  const spaCheck = parseArtifact("signedPaymentAuthorization", signedPaymentAuthorizationSchema, ctx.signedPaymentAuthorization);
  if (!pushCheck(checks, "SignedPaymentAuthorization", "schema", spaCheck.valid, {
    reason: spaCheck.valid ? undefined : spaCheck.reason,
  })) {
    return { result: spaCheck, steps, checks };
  }

  if (ctx.settlementIntent) {
    const intentCheck = parseArtifact("settlementIntent", settlementIntentForVerificationSchema, ctx.settlementIntent);
    if (!pushCheck(checks, "SettlementIntent", "schema", intentCheck.valid, {
      reason: intentCheck.valid ? undefined : intentCheck.reason,
    })) {
      return { result: intentCheck, steps, checks };
    }
  }

  if (ctx.signedPaymentAuthorization.authorization.intentHash && !ctx.settlementIntent) {
    const result: VerificationResult = {
      valid: false,
      reason: "intent_required",
      artifact: "signedPaymentAuthorization",
    };
    pushCheck(checks, "SettlementIntent", "required", false, { reason: "intent_required" });
    return { result, steps, checks };
  }

  // --- Policy grant ---
  const grantResult = verifyPolicyGrant(ctx.policyGrant, { nowMs: ctx.nowMs });
  if (!pushStep(steps, "PolicyGrant.valid", grantResult)) {
    pushCheck(checks, "PolicyGrant", "valid", false, {
      reason: grantResult.valid ? undefined : grantResult.reason,
    });
    return { result: grantResult, steps, checks };
  }
  pushCheck(checks, "PolicyGrant", "valid", true);

  // --- Budget ---
  const budgetResult = verifyBudgetAuthorization(
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    { nowMs: ctx.nowMs },
  );
  if (!pushStep(steps, "SignedBudgetAuthorization.valid", budgetResult)) {
    pushCheck(checks, "SignedBudgetAuthorization", "valid", false, {
      reason: budgetResult.valid ? undefined : budgetResult.reason,
    });
    return { result: budgetResult, steps, checks };
  }
  pushCheck(checks, "SignedBudgetAuthorization", "valid", true);

  // --- Intent hash with expected/actual when SPA binds to intent (for detailed report) ---
  if (ctx.settlementIntent && ctx.signedPaymentAuthorization.authorization.intentHash) {
    const intentParsed = settlementIntentForVerificationSchema.safeParse(ctx.settlementIntent);
    if (intentParsed.success) {
      const auth = ctx.signedPaymentAuthorization.authorization;
      const expectedHash = computeSettlementIntentHash(intentParsed.data);
      const actualHash = auth.intentHash;
      const hashMatch = expectedHash === actualHash;
      pushCheck(checks, "SettlementIntent", "intentHash", hashMatch, hashMatch ? undefined : {
        reason: "mismatch",
        expected: expectedHash,
        actual: actualHash,
      });
      if (!hashMatch) {
        pushStep(steps, "SettlementIntent.intentHash", {
          valid: false,
          reason: "intent_hash_mismatch",
          artifact: "settlementIntent",
        });
        return {
          result: { valid: false, reason: "intent_hash_mismatch", artifact: "settlementIntent" },
          steps,
          checks,
        };
      }
    }
  }

  // --- Payment (SPA signature, settlement match) ---
  const paymentResult = verifyPaymentAuthorization(
    ctx.signedPaymentAuthorization,
    ctx.signedBudgetAuthorization,
    ctx.policyGrant,
    ctx.paymentPolicyDecision,
    ctx.settlement,
    { nowMs: ctx.nowMs, settlementIntent: ctx.settlementIntent },
  );
  if (!pushStep(steps, "SignedPaymentAuthorization.valid", paymentResult)) {
    pushCheck(checks, "SignedPaymentAuthorization", "valid", false, {
      reason: paymentResult.valid ? undefined : paymentResult.reason,
    });
    return { result: paymentResult, steps, checks };
  }
  pushCheck(checks, "SignedPaymentAuthorization", "valid", true);

  // --- Intent verification (hash + field match when intent present) ---
  if (ctx.settlementIntent) {
    const intentResult = verifySettlementIntent(
      ctx.signedPaymentAuthorization,
      ctx.settlementIntent as Record<string, unknown>,
    );
    if (!pushStep(steps, "SettlementIntent.intentHash", intentResult)) {
      if (!checks.some((c) => c.name === "SettlementIntent.intentHash" && !c.valid)) {
        pushCheck(checks, "SettlementIntent", "fields", false, {
          reason: intentResult.valid ? undefined : intentResult.reason,
        });
      }
      return { result: intentResult, steps, checks };
    }
    // Step added above on success
  } else if (ctx.signedPaymentAuthorization.authorization.intentHash) {
    const result: VerificationResult = {
      valid: false,
      reason: "intent_required",
      artifact: "signedPaymentAuthorization",
    };
    return { result, steps, checks };
  }

  return { result: { valid: true }, steps, checks };
}
