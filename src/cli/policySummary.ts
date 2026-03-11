/**
 * PR12 — Fleet policy summary CLI
 * PR15 — Optional profile validation
 * Prints fleet policy constraints in a readable format.
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

interface FleetPolicyLike {
  _profile?: string;
  maxSessionSpend?: number;
  maxSessionSpendMinor?: string;
  allowedRails?: string[];
  allowedAssets?: unknown[];
  destinations?: string[];
  expiresAt?: string;
}

function loadProfile(profileName: string): FleetPolicyLike | null {
  const profilesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "profiles");
  const path = join(profilesDir, `${profileName}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as FleetPolicyLike;
  } catch {
    return null;
  }
}

function validateAgainstProfile(policy: FleetPolicyLike, profile: FleetPolicyLike): string[] {
  const errors: string[] = [];
  const policyRails = new Set(policy.allowedRails ?? []);
  const profileRails = new Set(profile.allowedRails ?? []);
  for (const r of policyRails) {
    if (!profileRails.has(r)) {
      errors.push(`allowedRails: policy uses "${r}" but profile does not allow it`);
    }
  }
  if (policy._profile && profile._profile && policy._profile !== profile._profile) {
    errors.push(`_profile: policy declares "${policy._profile}" but validating against "${profile._profile}"`);
  }
  return errors;
}

export function runPolicySummary(filePath: string, options?: { profile?: string }): number {
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

  const profileName = options?.profile;
  let profile: FleetPolicyLike | null = null;
  if (profileName) {
    profile = loadProfile(profileName);
    if (!profile) {
      process.stderr.write(`Error: profile "${profileName}" not found in profiles/\n`);
      return 1;
    }
  }

  process.stdout.write("Fleet Policy Summary\n");
  process.stdout.write("====================\n");
  if (profile) {
    process.stdout.write(`  Profile:            ${profileName} (reference: ${profile._profile ?? profileName})\n`);
  }
  process.stdout.write(`  Max session spend:  ${maxUsd}\n`);
  process.stdout.write(`  Allowed rails:      ${rails}\n`);
  process.stdout.write(`  Allowed assets:     ${assets}\n`);
  process.stdout.write(`  Destinations:       ${destinations}\n`);
  process.stdout.write(`  Expires:            ${expires}\n`);

  if (profile) {
    const errors = validateAgainstProfile(policy, profile);
    if (errors.length > 0) {
      process.stdout.write("\n");
      process.stderr.write("Profile validation failed:\n");
      for (const e of errors) process.stderr.write(`  - ${e}\n`);
      return 1;
    }
    process.stdout.write(`  Profile match:      ok\n`);
  }

  process.stdout.write("\n");
  return 0;
}
