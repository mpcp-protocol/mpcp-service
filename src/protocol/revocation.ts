/**
 * Check whether a PolicyGrant has been revoked.
 * Callers (merchants, service providers) SHOULD call this when revocationEndpoint is present.
 * The MPCP verifier pipeline does not call this — it remains stateless and synchronous.
 *
 * Endpoint contract: GET {revocationEndpoint}?grantId={grantId}
 * Response: { revoked: boolean, revokedAt?: string }
 */
export async function checkRevocation(
  endpoint: string,
  grantId: string,
  options?: { timeoutMs?: number },
): Promise<{ revoked: boolean; revokedAt?: string; error?: string }> {
  const url = `${endpoint}?grantId=${encodeURIComponent(grantId)}`;
  try {
    const controller = new AbortController();
    const timeout = options?.timeoutMs ?? 3000;
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return { revoked: false, error: `http_${res.status}` };
    const data = await res.json();
    return {
      revoked: Boolean(data.revoked),
      revokedAt: typeof data.revokedAt === "string" ? data.revokedAt : undefined,
    };
  } catch (err) {
    return { revoked: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
