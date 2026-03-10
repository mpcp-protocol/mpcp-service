/**
 * Format a verification report for CLI output.
 * Display order: intent hash (if present), payment auth, budget auth, policy grant.
 */

import type { VerificationReport, VerificationStep } from "../verify/types.js";

const CHECK = "✔";
const CROSS = "✗";

/** Reverse execution order for chain display: leaf (intent) → root (grant) */
const CHAIN_ORDER = [
  "intent hash valid",
  "payment authorization valid",
  "budget authorization valid",
  "policy grant valid",
];

function orderSteps(steps: VerificationStep[]): VerificationStep[] {
  const ordered: VerificationStep[] = [];
  for (const name of CHAIN_ORDER) {
    const step = steps.find((s) => s.name === name);
    if (step) ordered.push(step);
  }
  return ordered;
}

export function formatVerificationReport(report: VerificationReport): string {
  const lines: string[] = [];
  const ordered = orderSteps(report.steps);

  for (const step of ordered) {
    const icon = step.ok ? CHECK : CROSS;
    const msg = step.ok ? step.name : `${step.name}: ${step.reason ?? "failed"}`;
    lines.push(`${icon} ${msg}`);
  }

  if (ordered.length > 0) lines.push("");

  if (report.result.valid) {
    lines.push("MPCP verification PASSED");
  } else {
    lines.push(`MPCP verification FAILED: ${report.result.reason}`);
  }

  return lines.join("\n");
}
