import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { createSignedPolicyGrant, verifyPolicyGrantSignature } from "../../src/protocol/policyGrant.js";
import type { PolicyGrantLike } from "../../src/verifier/types.js";
import { verifyPolicyGrant } from "../../src/verifier/verifyPolicyGrant.js";

const ORIGINAL_ENV = {
  privateKey: process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM,
  publicKey: process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM,
  keyId: process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID,
};

afterEach(() => {
  process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM = ORIGINAL_ENV.privateKey;
  process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM = ORIGINAL_ENV.publicKey;
  process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID = ORIGINAL_ENV.keyId;
  delete process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM;
  delete process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM;
  delete process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID;
});

function setupKeys() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
  process.env.MPCP_POLICY_GRANT_SIGNING_PRIVATE_KEY_PEM = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM = publicKey.export({ type: "spki", format: "pem" }).toString();
  process.env.MPCP_POLICY_GRANT_SIGNING_KEY_ID = "mpcp-policy-grant-signing-key-1";
}

const baseGrant: PolicyGrantLike = {
  grantId: "grant-pg-1",
  policyHash: "a1b2c3d4e5f6",
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  allowedRails: ["xrpl"],
  allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
};

describe("createSignedPolicyGrant + verifyPolicyGrantSignature", () => {
  it("returns null when private key env var not set", () => {
    const result = createSignedPolicyGrant(baseGrant);
    expect(result).toBeNull();
  });

  it("creates a signed policy grant and verifies it", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();
    expect(signed!.signature).toBeDefined();
    expect(signed!.issuerKeyId).toBe("mpcp-policy-grant-signing-key-1");
    expect(signed!.grant).toEqual(baseGrant);

    const result = verifyPolicyGrantSignature(signed!);
    expect(result).toEqual({ ok: true });
  });

  it("fails verification with tampered grant payload", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();

    const tampered = { ...signed!, grant: { ...signed!.grant, policyHash: "deadbeefcafe" } };
    const result = verifyPolicyGrantSignature(tampered);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("fails verification with wrong key ID", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();

    const wrongKeyId = { ...signed!, issuerKeyId: "wrong-key-id" };
    const result = verifyPolicyGrantSignature(wrongKeyId);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });

  it("fails verification when public key env var not set", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();
    delete process.env.MPCP_POLICY_GRANT_SIGNING_PUBLIC_KEY_PEM;

    const result = verifyPolicyGrantSignature(signed!);
    expect(result).toEqual({ ok: false, reason: "invalid_signature" });
  });
});

describe("verifyPolicyGrant with signature enforcement", () => {
  it("passes without signature when public key env var not set", () => {
    const result = verifyPolicyGrant(baseGrant);
    expect(result).toEqual({ valid: true });
  });

  it("fails when public key env var set but grant has no signature", () => {
    setupKeys();
    const result = verifyPolicyGrant(baseGrant);
    expect(result).toMatchObject({ valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" });
  });

  it("passes when public key env var set and grant is properly signed", () => {
    setupKeys();
    const signed = createSignedPolicyGrant(baseGrant);
    expect(signed).not.toBeNull();

    const grantWithSig = { ...baseGrant, issuerKeyId: signed!.issuerKeyId, signature: signed!.signature };
    const result = verifyPolicyGrant(grantWithSig);
    expect(result).toEqual({ valid: true });
  });

  it("fails when public key env var set and grant has invalid signature", () => {
    setupKeys();
    const grantWithBadSig = {
      ...baseGrant,
      issuerKeyId: "mpcp-policy-grant-signing-key-1",
      signature: "aW52YWxpZHNpZ25hdHVyZQ==", // invalid base64 signature
    };
    const result = verifyPolicyGrant(grantWithBadSig);
    expect(result).toMatchObject({ valid: false, reason: "invalid_policy_grant_signature", artifact: "policyGrant" });
  });
});
