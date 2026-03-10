/**
 * PR6 — Protocol Conformance Tests
 *
 * Full protocol verification suite. Each area must pass for protocol conformance.
 * - intent hash correctness
 * - policy grant validation
 * - budget authorization limits
 * - SPA verification
 * - settlement verification
 */

import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { computeSettlementIntentHash } from "../../src/hash/index.js";
import type {
  PaymentPolicyDecision,
  SettlementResult,
} from "../../src/policy-core/types.js";
import {
  createSignedSessionBudgetAuthorization,
} from "../../src/protocol/sba.js";
import {
  createSignedPaymentAuthorization,
} from "../../src/protocol/spa.js";
import type { PolicyGrantLike } from "../../src/verify/types.js";
import {
  verifyPolicyGrant,
  verifyBudgetAuthorization,
  verifyPaymentAuthorization,
  verifySettlementIntent,
  verifySettlement,
} from "../../src/verify/index.js";

const SBA_ENV = {
  privateKey: process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SBA_SIGNING_KEY_ID,
};
const SPA_ENV = {
  privateKey: process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_SPA_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = SBA_ENV.privateKey;
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = SBA_ENV.publicKey;
  process.env.MPCP_SBA_SIGNING_KEY_ID = SBA_ENV.keyId;
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = SPA_ENV.privateKey;
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = SPA_ENV.publicKey;
  process.env.MPCP_SPA_SIGNING_KEY_ID = SPA_ENV.keyId;
});

function setupBothKeys() {
  const sbaKeys = crypto.generateKeyPairSync("ed25519");
  const spaKeys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";
}

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
const pastExpiry = new Date(Date.now() - 60_000).toISOString();
const verificationNowIso = new Date(Date.now() - 1000).toISOString();

const baseGrant: PolicyGrantLike = {
  grantId: "grant-1",
  policyHash: "a1b2c3",
  expiresAt: futureExpiry,
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

const baseDecision: PaymentPolicyDecision = {
  decisionId: "dec-1",
  policyHash: "a1b2c3",
  action: "ALLOW",
  reasons: ["OK"],
  expiresAtISO: futureExpiry,
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  priceFiat: { amountMinor: "2500", currency: "USD" },
  chosen: { rail: "xrpl", quoteId: "q1" },
  settlementQuotes: [
    {
      quoteId: "q1",
      rail: "xrpl",
      amount: { amount: "19440000", decimals: 6 },
      destination: "rDestination",
      expiresAt: futureExpiry,
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    },
  ],
};

const baseSettlement: SettlementResult = {
  amount: "19440000",
  rail: "xrpl",
  asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
  destination: "rDestination",
  nowISO: verificationNowIso,
};

describe("Protocol Conformance", () => {
  describe("intent hash correctness", () => {
    it("produces deterministic hash from canonical intent", () => {
      const intent = { rail: "xrpl" as const, amount: "19440000", destination: "rDest" };
      const h1 = computeSettlementIntentHash(intent);
      const h2 = computeSettlementIntentHash(intent);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("detects field change via hash mismatch", () => {
      const intent = { rail: "xrpl" as const, amount: "1000" };
      const altered = { rail: "xrpl" as const, amount: "2000" };
      expect(computeSettlementIntentHash(intent)).not.toBe(computeSettlementIntentHash(altered));
    });

    it("ignores intentHash field in intent (verifier recomputes)", () => {
      const intent = { rail: "xrpl", amount: "1000", destination: "rD" };
      const withFake = { ...intent, intentHash: "a".repeat(64) };
      expect(computeSettlementIntentHash(intent)).toBe(computeSettlementIntentHash(withFake));
    });
  });

  describe("policy grant validation", () => {
    it("passes when grant not expired", () => {
      expect(verifyPolicyGrant(baseGrant)).toEqual({ valid: true });
    });

    it("fails when grant expired", () => {
      const expired = { ...baseGrant, expiresAt: pastExpiry };
      expect(verifyPolicyGrant(expired)).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
    });

    it("rejects malformed grant", () => {
      const malformed = { policyHash: "not-hex!", allowedRails: ["xrpl"] };
      const result = verifyPolicyGrant(malformed);
      expect(result.valid).toBe(false);
      expect(result).toMatchObject({ valid: false, artifact: "policyGrant" });
    });
  });

  describe("budget authorization limits", () => {
    it("passes when SBA valid and decision fits budget", () => {
      setupBothKeys();
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
        destinationAllowlist: ["rDestination"],
        expiresAt: futureExpiry,
      });
      expect(sba).not.toBeNull();
      expect(verifyBudgetAuthorization(sba!, baseGrant, baseDecision)).toEqual({ valid: true });
    });

    it("fails when policy hash mismatch", () => {
      setupBothKeys();
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "deadbeef",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [],
        destinationAllowlist: [],
        expiresAt: futureExpiry,
      });
      expect(sba).not.toBeNull();
      expect(verifyBudgetAuthorization(sba!, baseGrant, baseDecision)).toMatchObject({
        valid: false,
        reason: "budget_policy_hash_mismatch",
        artifact: "signedBudgetAuthorization",
      });
    });

    it("fails when budget exceeded", () => {
      setupBothKeys();
      const grantWithStripe: PolicyGrantLike = { ...baseGrant, allowedRails: ["xrpl", "stripe"] };
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "1000",
        allowedRails: ["stripe"],
        allowedAssets: [],
        destinationAllowlist: [],
        expiresAt: futureExpiry,
      });
      const decision: PaymentPolicyDecision = {
        ...baseDecision,
        rail: "stripe",
        priceFiat: { amountMinor: "1200", currency: "USD" },
        chosen: { rail: "stripe", quoteId: "q1" },
        settlementQuotes: [{
          quoteId: "q1",
          rail: "stripe",
          amount: { amount: "1200", decimals: 2 },
          destination: "",
          expiresAt: futureExpiry,
        }],
      };
      expect(sba).not.toBeNull();
      expect(verifyBudgetAuthorization(sba!, grantWithStripe, decision)).toMatchObject({ valid: false, reason: "mismatch" });
    });
  });

  describe("SPA verification", () => {
    it("passes when full chain valid and settlement matches", () => {
      setupBothKeys();
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
        destinationAllowlist: ["rDestination"],
        expiresAt: futureExpiry,
      });
      const spa = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision);
      expect(sba).not.toBeNull();
      expect(spa).not.toBeNull();
      expect(verifyPaymentAuthorization(spa!, sba!, baseGrant, baseDecision, baseSettlement)).toEqual({ valid: true });
    });

    it("fails when session mismatch between SPA and SBA", () => {
      setupBothKeys();
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [],
        destinationAllowlist: [],
        expiresAt: futureExpiry,
      });
      const spa = createSignedPaymentAuthorization("22222222-2222-4222-8222-222222222222", baseDecision);
      expect(sba).not.toBeNull();
      expect(spa).not.toBeNull();
      expect(verifyPaymentAuthorization(spa!, sba!, baseGrant, baseDecision, baseSettlement)).toMatchObject({
        valid: false,
        reason: "payment_auth_session_mismatch",
        artifact: "signedPaymentAuthorization",
      });
    });

    it("verifies intentHash when SPA binds intent", () => {
      setupBothKeys();
      const intent = { rail: "xrpl", amount: "19440000", destination: "rDestination", asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" } };
      const spa = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision, { settlementIntent: intent });
      expect(spa).not.toBeNull();
      expect(spa!.authorization.intentHash).toBeDefined();
      expect(verifySettlementIntent(spa!, intent)).toEqual({ valid: true });
      const wrongIntent = { ...intent, amount: "99999999" };
      expect(verifySettlementIntent(spa!, wrongIntent)).toMatchObject({
        valid: false,
        reason: "intent_hash_mismatch",
        artifact: "settlementIntent",
      });
    });
  });

  describe("settlement verification", () => {
    it("passes full chain without intentHash", () => {
      setupBothKeys();
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
        destinationAllowlist: ["rDestination"],
        expiresAt: futureExpiry,
      });
      const spa = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision);
      expect(sba).not.toBeNull();
      expect(spa).not.toBeNull();
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba!,
        signedPaymentAuthorization: spa!,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
      });
      expect(result).toEqual({ valid: true });
    });

    it("passes full chain with settlementIntent", () => {
      setupBothKeys();
      const intent = { rail: "xrpl", amount: "19440000", destination: "rDestination", asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" } };
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
        destinationAllowlist: ["rDestination"],
        expiresAt: futureExpiry,
      });
      const spa = createSignedPaymentAuthorization(
        "11111111-1111-4111-8111-111111111111",
        baseDecision,
        { settlementIntent: intent },
      );
      expect(sba).not.toBeNull();
      expect(spa).not.toBeNull();
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba!,
        signedPaymentAuthorization: spa!,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
        settlementIntent: intent,
      });
      expect(result).toEqual({ valid: true });
    });

    it("fails when grant expired", () => {
      setupBothKeys();
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [],
        destinationAllowlist: [],
        expiresAt: futureExpiry,
      });
      const spa = createSignedPaymentAuthorization("11111111-1111-4111-8111-111111111111", baseDecision);
      expect(sba).not.toBeNull();
      expect(spa).not.toBeNull();
      const result = verifySettlement({
        policyGrant: { ...baseGrant, expiresAt: pastExpiry },
        signedBudgetAuthorization: sba!,
        signedPaymentAuthorization: spa!,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
        nowMs: Date.now(),
      });
      expect(result).toMatchObject({ valid: false, reason: "policy_grant_expired", artifact: "policyGrant" });
    });

    it("fails when SPA has intentHash but settlementIntent missing", () => {
      setupBothKeys();
      const intent = { rail: "xrpl", amount: "19440000", destination: "rDest" };
      const sba = createSignedSessionBudgetAuthorization({
        sessionId: "11111111-1111-4111-8111-111111111111",
        vehicleId: "1234567",
        policyHash: "a1b2c3",
        currency: "USD",
        maxAmountMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [],
        destinationAllowlist: [],
        expiresAt: futureExpiry,
      });
      const spa = createSignedPaymentAuthorization(
        "11111111-1111-4111-8111-111111111111",
        baseDecision,
        { settlementIntent: intent },
      );
      expect(sba).not.toBeNull();
      expect(spa).not.toBeNull();
      const result = verifySettlement({
        policyGrant: baseGrant,
        signedBudgetAuthorization: sba!,
        signedPaymentAuthorization: spa!,
        settlement: baseSettlement,
        paymentPolicyDecision: baseDecision,
        decisionId: "dec-1",
        // settlementIntent omitted
      });
      expect(result).toMatchObject({ valid: false, reason: "intent_required", artifact: "signedPaymentAuthorization" });
    });
  });
});
