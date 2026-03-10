import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { verifyHederaHcsAnchor } from "../../src/anchor/hederaHcsAnchor.js";

describe("verifyHederaHcsAnchor", () => {
  it("returns invalid when topicId missing", async () => {
    const result = await verifyHederaHcsAnchor(
      { sequenceNumber: "1" },
      "a".repeat(64),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("hedera_hcs_anchor_missing");
  });

  it("returns invalid when sequenceNumber missing", async () => {
    const result = await verifyHederaHcsAnchor(
      { topicId: "0.0.123" },
      "a".repeat(64),
    );
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("hedera_hcs_anchor_missing");
  });

  it("returns valid when mirror returns matching intentHash", async () => {
    const intentHash = "a".repeat(64);
    const message = JSON.stringify({ intentHash, version: "1.0" });
    const messageB64 = Buffer.from(message, "utf-8").toString("base64");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: messageB64 }),
      }),
    );

    try {
      const result = await verifyHederaHcsAnchor(
        { topicId: "0.0.123", sequenceNumber: "1" },
        intentHash,
      );
      expect(result.valid).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("returns invalid when mirror returns mismatched intentHash", async () => {
    const message = JSON.stringify({
      intentHash: "b".repeat(64),
      version: "1.0",
    });
    const messageB64 = Buffer.from(message, "utf-8").toString("base64");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ message: messageB64 }),
      }),
    );

    try {
      const result = await verifyHederaHcsAnchor(
        { topicId: "0.0.123", sequenceNumber: "1" },
        "a".repeat(64),
      );
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("intent_hash_mismatch");
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
