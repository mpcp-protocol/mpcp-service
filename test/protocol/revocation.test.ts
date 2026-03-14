import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkRevocation } from "../../src/protocol/revocation.js";

describe("checkRevocation", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns revoked=false when endpoint says not revoked", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: false }),
    } as Response);

    const result = await checkRevocation("https://wallet.example.com/revoke", "grant-123");
    expect(result).toEqual({ revoked: false });
    expect(fetch).toHaveBeenCalledWith(
      "https://wallet.example.com/revoke?grantId=grant-123",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("returns revoked=true with revokedAt when grant is revoked", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: true, revokedAt: "2026-04-11T14:22:00Z" }),
    } as Response);

    const result = await checkRevocation("https://wallet.example.com/revoke", "grant-123");
    expect(result).toEqual({ revoked: true, revokedAt: "2026-04-11T14:22:00Z" });
  });

  it("encodes special characters in grantId", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: false }),
    } as Response);

    await checkRevocation("https://wallet.example.com/revoke", "grant/with+special=chars");
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("grantId=grant%2Fwith%2Bspecial%3Dchars");
  });

  it("returns error on non-ok HTTP response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response);

    const result = await checkRevocation("https://wallet.example.com/revoke", "grant-123");
    expect(result).toEqual({ revoked: false, error: "http_503" });
  });

  it("returns error on network failure", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("network error"));

    const result = await checkRevocation("https://wallet.example.com/revoke", "grant-123");
    expect(result).toEqual({ revoked: false, error: "network error" });
  });

  it("returns error on timeout (AbortError)", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(
      Object.assign(new Error("The operation was aborted"), { name: "AbortError" }),
    );

    const result = await checkRevocation("https://wallet.example.com/revoke", "grant-123", {
      timeoutMs: 100,
    });
    expect(result.revoked).toBe(false);
    expect(result.error).toContain("aborted");
  });

  it("ignores non-string revokedAt", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: true, revokedAt: 1234567890 }),
    } as Response);

    const result = await checkRevocation("https://wallet.example.com/revoke", "grant-123");
    expect(result).toEqual({ revoked: true });
    expect(result.revokedAt).toBeUndefined();
  });

  it("uses custom timeoutMs", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ revoked: false }),
    } as Response);

    await checkRevocation("https://wallet.example.com/revoke", "grant-123", { timeoutMs: 5000 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
