import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { tmpdir } from "node:os";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { PaymentPolicyDecision, SettlementResult } from "../../src/policy-core/types.js";
import { createSignedSessionBudgetAuthorization } from "../../src/protocol/sba.js";
import { createSignedPaymentAuthorization } from "../../src/protocol/spa.js";
import type { PolicyGrantLike } from "../../src/verify/types.js";
import { runVerify } from "../../src/cli/verify.js";

function setupBothKeys() {
  const sbaKeys = crypto.generateKeyPairSync("ed25519");
  const spaKeys = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM = sbaKeys.privateKey.export({
    type: "pkcs8",
    format: "pem",
  }).toString();
  process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM = sbaKeys.publicKey.export({
    type: "spki",
    format: "pem",
  }).toString();
  process.env.MPCP_SBA_SIGNING_KEY_ID = "mpcp-sba-signing-key-1";
  process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM = spaKeys.privateKey.export({
    type: "pkcs8",
    format: "pem",
  }).toString();
  process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM = spaKeys.publicKey.export({
    type: "spki",
    format: "pem",
  }).toString();
  process.env.MPCP_SPA_SIGNING_KEY_ID = "mpcp-spa-signing-key-1";
}

const futureExpiry = new Date(Date.now() + 60_000).toISOString();
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

afterEach(() => {
  delete process.env.MPCP_SBA_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_SBA_SIGNING_KEY_ID;
  delete process.env.MPCP_SPA_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_SPA_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_SPA_SIGNING_KEY_ID;
});

describe("runVerify", () => {
  it("outputs formatted chain on success (no intent)", () => {
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
    const spa = createSignedPaymentAuthorization(
      "11111111-1111-4111-8111-111111111111",
      baseDecision,
    );
    const ctx = {
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
    };
    const tmpPath = join(tmpdir(), `mpcp-verify-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify(ctx));
    try {
      const { ok, output } = runVerify(tmpPath);
      expect(ok).toBe(true);
      expect(output).toContain("✔ policy grant valid");
      expect(output).toContain("✔ budget authorization valid");
      expect(output).toContain("✔ payment authorization valid");
      expect(output).toContain("MPCP verification PASSED");
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("outputs formatted chain on success with intent", () => {
    setupBothKeys();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
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
    const ctx = {
      policyGrant: baseGrant,
      signedBudgetAuthorization: sba!,
      signedPaymentAuthorization: spa!,
      settlement: baseSettlement,
      paymentPolicyDecision: baseDecision,
      decisionId: "dec-1",
      settlementIntent: intent,
    };
    const tmpPath = join(tmpdir(), `mpcp-verify-intent-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify(ctx));
    try {
      const { ok, output } = runVerify(tmpPath);
      expect(ok).toBe(true);
      expect(output).toContain("✔ intent hash valid");
      expect(output).toContain("✔ payment authorization valid");
      expect(output).toContain("✔ budget authorization valid");
      expect(output).toContain("✔ policy grant valid");
      expect(output).toContain("MPCP verification PASSED");
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("returns error for missing file", () => {
    const { ok, output } = runVerify("/nonexistent/path.json");
    expect(ok).toBe(false);
    expect(output).toContain("Error:");
    expect(output).toContain("cannot read file");
  });

  it("returns error for invalid JSON", () => {
    const tmpPath = join(tmpdir(), `mpcp-verify-bad-${Date.now()}.json`);
    writeFileSync(tmpPath, "not valid json {");
    try {
      const { ok, output } = runVerify(tmpPath);
      expect(ok).toBe(false);
      expect(output).toContain("Error:");
      expect(output).toContain("invalid JSON");
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("accepts settlement bundle format (settlement, intent, spa, sba, policyGrant)", () => {
    setupBothKeys();
    const intent = {
      rail: "xrpl",
      amount: "19440000",
      destination: "rDestination",
      asset: { kind: "IOU", currency: "RLUSD", issuer: "rIssuer" },
    };
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
    const bundle = {
      settlement: baseSettlement,
      intent,
      spa: spa!,
      sba: sba!,
      policyGrant: baseGrant,
    };
    const tmpPath = join(tmpdir(), `mpcp-bundle-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify(bundle));
    try {
      const { ok, output } = runVerify(tmpPath);
      expect(ok).toBe(true);
      expect(output).toContain("✔ intent hash valid");
      expect(output).toContain("✔ payment authorization valid");
      expect(output).toContain("✔ budget authorization valid");
      expect(output).toContain("✔ policy grant valid");
      expect(output).toContain("MPCP verification PASSED");
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });
});
