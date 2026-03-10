import { describe, expect, it } from "vitest";
import { formatVerificationReport } from "../../src/cli/formatReport.js";
import type { VerificationReport } from "../../src/verify/types.js";

describe("formatVerificationReport", () => {
  it("formats success with full chain in display order", () => {
    const report: VerificationReport = {
      result: { valid: true },
      steps: [
        { name: "policy grant valid", ok: true },
        { name: "budget authorization valid", ok: true },
        { name: "payment authorization valid", ok: true },
        { name: "intent hash valid", ok: true },
      ],
    };
    const out = formatVerificationReport(report);
    expect(out).toContain("✔ intent hash valid");
    expect(out).toContain("✔ payment authorization valid");
    expect(out).toContain("✔ budget authorization valid");
    expect(out).toContain("✔ policy grant valid");
    expect(out).toContain("MPCP verification PASSED");
  });

  it("formats success without intent step", () => {
    const report: VerificationReport = {
      result: { valid: true },
      steps: [
        { name: "policy grant valid", ok: true },
        { name: "budget authorization valid", ok: true },
        { name: "payment authorization valid", ok: true },
      ],
    };
    const out = formatVerificationReport(report);
    expect(out).toContain("✔ policy grant valid");
    expect(out).toContain("✔ budget authorization valid");
    expect(out).toContain("✔ payment authorization valid");
    expect(out).not.toContain("intent hash");
    expect(out).toContain("MPCP verification PASSED");
  });

  it("formats failure with failing step", () => {
    const report: VerificationReport = {
      result: { valid: false, reason: "policy_grant_expired", artifact: "policyGrant" },
      steps: [{ name: "policy grant valid", ok: false, reason: "policy_grant_expired" }],
    };
    const out = formatVerificationReport(report);
    expect(out).toContain("✗ policy grant valid");
    expect(out).toContain("policy_grant_expired");
    expect(out).toContain("MPCP verification FAILED");
  });
});
