import { describe, expect, it } from "vitest";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPolicySummary } from "../../src/cli/policySummary.js";

describe("runPolicySummary", () => {
  it("prints fleet policy summary", () => {
    const tmpPath = join(tmpdir(), `mpcp-policy-${Date.now()}.json`);
    writeFileSync(
      tmpPath,
      JSON.stringify({
        maxSessionSpend: 30,
        maxSessionSpendMinor: "3000",
        allowedRails: ["xrpl"],
        allowedAssets: [{ kind: "IOU", currency: "RLUSD", issuer: "rIssuer" }],
        destinations: ["rParking", "rCharging", "rToll"],
        expiresAt: "2030-12-31T23:59:59Z",
      }),
    );
    try {
      const exitCode = runPolicySummary(tmpPath);
      expect(exitCode).toBe(0);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("returns 1 for missing file", () => {
    const exitCode = runPolicySummary("/nonexistent/policy.json");
    expect(exitCode).toBe(1);
  });

  it("returns 1 for invalid JSON", () => {
    const tmpPath = join(tmpdir(), `mpcp-policy-bad-${Date.now()}.json`);
    writeFileSync(tmpPath, "not json");
    try {
      const exitCode = runPolicySummary(tmpPath);
      expect(exitCode).toBe(1);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("validates against profile when --profile given", () => {
    const tmpPath = join(tmpdir(), `mpcp-policy-profile-${Date.now()}.json`);
    writeFileSync(
      tmpPath,
      JSON.stringify({
        _profile: "parking",
        maxSessionSpend: 30,
        allowedRails: ["xrpl"],
        destinations: ["rParking"],
        expiresAt: "2030-12-31T23:59:59Z",
      }),
    );
    try {
      const exitCode = runPolicySummary(tmpPath, { profile: "parking" });
      expect(exitCode).toBe(0);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("fails profile validation when rails not allowed", () => {
    const tmpPath = join(tmpdir(), `mpcp-policy-profile-fail-${Date.now()}.json`);
    writeFileSync(
      tmpPath,
      JSON.stringify({
        allowedRails: ["evm"],
        destinations: ["rParking"],
        expiresAt: "2030-12-31T23:59:59Z",
      }),
    );
    try {
      const exitCode = runPolicySummary(tmpPath, { profile: "parking" });
      expect(exitCode).toBe(1);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });

  it("returns 1 for unknown profile", () => {
    const tmpPath = join(tmpdir(), `mpcp-policy-unknown-profile-${Date.now()}.json`);
    writeFileSync(tmpPath, JSON.stringify({ allowedRails: ["xrpl"], destinations: [] }));
    try {
      const exitCode = runPolicySummary(tmpPath, { profile: "nonexistent-profile" });
      expect(exitCode).toBe(1);
    } finally {
      if (existsSync(tmpPath)) unlinkSync(tmpPath);
    }
  });
});
