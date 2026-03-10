/**
 * PR12 — Fleet policy summary CLI
 * Prints fleet policy constraints in a readable format.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface FleetPolicyLike {
  maxSessionSpend?: number;
  maxSessionSpendMinor?: string;
  allowedRails?: string[];
  allowedAssets?: unknown[];
  destinations?: string[];
  expiresAt?: string;
}

export function runPolicySummary(filePath: string): number {
  let raw: string;
  try {
    raw = readFileSync(resolve(process.cwd(), filePath), "utf-8");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: cannot read file ${filePath}: ${msg}\n`);
    return 1;
  }

  let policy: FleetPolicyLike;
  try {
    policy = JSON.parse(raw);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: invalid JSON in ${filePath}: ${msg}\n`);
    return 1;
  }

  const maxMinor = policy.maxSessionSpendMinor ?? (policy.maxSessionSpend != null ? String(policy.maxSessionSpend * 100) : undefined);
  const maxUsd = maxMinor != null ? `$${(Number(maxMinor) / 100).toFixed(2)}` : "—";
  const rails = (policy.allowedRails ?? []).join(", ") || "—";
  const assets = (policy.allowedAssets ?? []).map((a: unknown) =>
    typeof a === "object" && a !== null && "currency" in a ? (a as { currency: string }).currency : String(a),
  ).join(", ") || "—";
  const destinations = (policy.destinations ?? []).join(", ") || "—";
  const expires = policy.expiresAt ?? "—";

  process.stdout.write("Fleet Policy Summary\n");
  process.stdout.write("====================\n");
  process.stdout.write(`  Max session spend:  ${maxUsd}\n`);
  process.stdout.write(`  Allowed rails:      ${rails}\n`);
  process.stdout.write(`  Allowed assets:     ${assets}\n`);
  process.stdout.write(`  Destinations:       ${destinations}\n`);
  process.stdout.write(`  Expires:            ${expires}\n`);
  process.stdout.write("\n");
  return 0;
}
