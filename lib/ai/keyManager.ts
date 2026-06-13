/**
 * KEY MANAGER — centralised per-provider health tracking.
 *
 * Lives as an in-process singleton (one Map per Vercel function instance).
 * Cross-instance state is not shared, but each instance learns independently
 * within its own lifetime — enough to prevent repeated hammering of a dead key.
 *
 * Lifecycle of a provider key:
 *   live   → first failure                          → cooling (exponential back-off)
 *   cooling → cooldown expires (auto-revive)         → live
 *   cooling → too many failures (≥ DEAD_THRESHOLD)   → dead
 *   dead    → stays dead until process restart       (admin can view in Health room)
 *
 * Every call into providers.ts should:
 *   • call getKeyStatus(envKey) — skip cooling/dead providers in the chain
 *   • call markSuccess(envKey, latencyMs) on a 2xx response
 *   • call markFailed(envKey, reason) on any error / non-retryable status
 */

export interface KeyHealthRecord {
  envKey:       string;
  providerLabel: string;
  status:       "live" | "cooling" | "dead";
  cooldownSec:  number;   // seconds remaining in cooldown (0 if live/dead)
  failureCount: number;
  successCount: number;
  lastError:    string;
  avgLatencyMs: number;
  lastUsedAt:   number;   // epoch ms (0 = never used)
}

interface KeyState {
  providerLabel: string;
  status:       "live" | "cooling" | "dead";
  cooldownUntil: number;  // epoch ms
  failureCount:  number;
  successCount:  number;
  lastError:     string;
  lastUsedAt:    number;
  avgLatencyMs:  number;
}

// ─── Constants — tweak here to adjust retry behaviour ─────────────────────────

/** Initial cooldown on first failure (ms) */
const COOLDOWN_BASE_MS = 60_000;         // 1 minute

/** Maximum cooldown cap (ms) */
const COOLDOWN_MAX_MS = 600_000;         // 10 minutes

/** Number of consecutive failures before a key is marked dead */
const DEAD_THRESHOLD = 8;

/** On success, reduce failure count by this much (gradual recovery) */
const RECOVERY_PER_SUCCESS = 1;

// ─── Singleton state ──────────────────────────────────────────────────────────

const _state = new Map<string, KeyState>();

function getOrCreate(envKey: string, providerLabel = envKey): KeyState {
  if (!_state.has(envKey)) {
    _state.set(envKey, {
      providerLabel,
      status:       "live",
      cooldownUntil: 0,
      failureCount: 0,
      successCount: 0,
      lastError:    "",
      lastUsedAt:   0,
      avgLatencyMs: 0,
    });
  }
  return _state.get(envKey)!;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether a provider key is safe to use right now.
 * Auto-revives cooling keys whose cooldown has expired.
 */
export function getKeyStatus(envKey: string, providerLabel?: string): "live" | "cooling" | "dead" {
  const s = getOrCreate(envKey, providerLabel);

  // Auto-revive: cooling → live when the cooldown has elapsed
  if (s.status === "cooling" && Date.now() >= s.cooldownUntil) {
    s.status = "live";
    s.cooldownUntil = 0;
  }

  return s.status;
}

/**
 * Record a successful call. Reduces the failure count gradually so a
 * recovering key that still occasionally fails doesn't immediately go dead.
 */
export function markSuccess(envKey: string, latencyMs: number, providerLabel?: string): void {
  const s = getOrCreate(envKey, providerLabel);

  s.status       = "live";
  s.cooldownUntil = 0;
  s.failureCount = Math.max(0, s.failureCount - RECOVERY_PER_SUCCESS);
  s.successCount += 1;
  s.lastUsedAt   = Date.now();

  // Exponential moving average for latency (80 % old / 20 % new)
  s.avgLatencyMs = s.avgLatencyMs === 0
    ? latencyMs
    : Math.round(s.avgLatencyMs * 0.8 + latencyMs * 0.2);
}

/**
 * Record a failed call and apply exponential back-off cooling.
 */
export function markFailed(envKey: string, reason: string, providerLabel?: string): void {
  const s = getOrCreate(envKey, providerLabel);

  s.failureCount += 1;
  s.lastError    = reason.slice(0, 300);
  s.lastUsedAt   = Date.now();

  if (s.failureCount >= DEAD_THRESHOLD) {
    s.status = "dead";
  } else {
    // Exponential back-off: 1m, 2m, 4m, 8m … capped at COOLDOWN_MAX_MS
    const expFactor = Math.pow(2, Math.min(s.failureCount - 1, 5));
    const cooldownMs = Math.min(COOLDOWN_BASE_MS * expFactor, COOLDOWN_MAX_MS);
    s.status       = "cooling";
    s.cooldownUntil = Date.now() + cooldownMs;
  }
}

/**
 * Snapshot of all tracked keys — used by the admin Health room panel
 * and /api/ai/keys endpoint.
 */
export function getKeyHealthSnapshot(): KeyHealthRecord[] {
  const now = Date.now();
  return Array.from(_state.entries()).map(([envKey, s]) => {
    // Compute effective status (may have auto-revived since last check)
    const effective: "live" | "cooling" | "dead" =
      s.status === "cooling" && now >= s.cooldownUntil ? "live" : s.status;

    return {
      envKey,
      providerLabel: s.providerLabel,
      status:        effective,
      cooldownSec:   effective === "cooling" ? Math.max(0, Math.round((s.cooldownUntil - now) / 1000)) : 0,
      failureCount:  s.failureCount,
      successCount:  s.successCount,
      lastError:     s.lastError,
      avgLatencyMs:  s.avgLatencyMs,
      lastUsedAt:    s.lastUsedAt,
    };
  });
}

/** How many keys are currently live (not cooling, not dead) */
export function liveKeyCount(): number {
  const now = Date.now();
  let count = 0;
  for (const s of _state.values()) {
    const alive = s.status === "live" || (s.status === "cooling" && now >= s.cooldownUntil);
    if (alive) count++;
  }
  return count;
}

/** Reset a dead key back to live (admin action via /api/ai/keys PATCH) */
export function reviveKey(envKey: string): boolean {
  const s = _state.get(envKey);
  if (!s) return false;
  s.status       = "live";
  s.cooldownUntil = 0;
  s.failureCount = 0;
  s.lastError    = "";
  return true;
}
