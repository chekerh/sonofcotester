import { Logger } from "@nestjs/common";
import type {
  HealthAlert,
  HealthDimension,
  NotificationSeverity,
} from "@sonofcotester/sdk";

/**
 * Configuration for the deduplication engine.
 */
export interface DedupConfig {
  /** Global cooldown in ms — same alert won't re-send within this window (default: 5 min) */
  globalCooldownMs: number;
  /** Per-channel cooldown in ms — per channel+alert fingerprint (default: 10 min) */
  perChannelCooldownMs: number;
  /** Per-severity cooldown overrides */
  severityCooldowns: {
    info: number;
    warning: number;
    critical: number;
  };
  /** Maximum fingerprints to track (LRU eviction) */
  maxFingerprints: number;
  /** Whether dedup is enabled at all */
  enabled: boolean;
}

export const DEFAULT_DEDUP_CONFIG: DedupConfig = {
  globalCooldownMs: 5 * 60 * 1000,      // 5 minutes
  perChannelCooldownMs: 10 * 60 * 1000,  // 10 minutes
  severityCooldowns: {
    info: 15 * 60 * 1000,       // 15 minutes
    warning: 5 * 60 * 1000,     // 5 minutes
    critical: 2 * 60 * 1000,    // 2 minutes (critical alerts get through faster)
  },
  maxFingerprints: 10_000,
  enabled: true,
};

interface FingerprintEntry {
  /** Composite fingerprint: "projectId:dimension:title" */
  fingerprint: string;
  /** First time this fingerprint was seen */
  firstSeenAt: number;
  /** Last time a notification was sent for this fingerprint */
  lastSentAt: number;
  /** Total number of times suppressed (not sent) */
  suppressedCount: number;
  /** Total number of times sent */
  sentCount: number;
  /** Per-channel last-sent timestamps */
  channelLastSent: Map<string, number>;
}

/**
 * Alert deduplication and rate-limiting engine.
 *
 * Generates fingerprints from alert properties (project + dimension + title)
 * and tracks when notifications were last sent. Before dispatching, the
 * notification service checks `shouldAllow()` to determine if enough time
 * has passed since the last send.
 *
 * Features:
 *  - Global cooldown per fingerprint
 *  - Per-channel cooldown per fingerprint
 *  - Per-severity cooldown overrides (critical alerts get shorter cooldowns)
 *  - LRU eviction when max fingerprints is reached
 *  - Stats tracking for the notification dashboard
 */
export class NotificationDeduplicator {
  private readonly logger = new Logger(NotificationDeduplicator.name);

  private config: DedupConfig;
  private readonly entries = new Map<string, FingerprintEntry>();

  constructor(config?: Partial<DedupConfig>) {
    this.config = { ...DEFAULT_DEDUP_CONFIG, ...config };
  }

  // ── Configuration ──

  updateConfig(update: Partial<DedupConfig>): void {
    this.config = { ...this.config, ...update };
    this.logger.log(`[Dedup] Config updated: enabled=${this.config.enabled}, global=${this.config.globalCooldownMs}ms`);
  }

  getConfig(): DedupConfig {
    return { ...this.config };
  }

  // ── Core Dedup Logic ──

  /**
   * Generate a fingerprint for an alert.
   * Same project + dimension + title = same fingerprint.
   */
  fingerprint(alert: HealthAlert): string {
    return `${alert.projectId}:${alert.dimension}:${alert.title}`;
  }

  /**
   * Check whether a notification for this alert should be allowed through.
   * Returns true if enough time has passed since the last send.
   */
  shouldAllow(alert: HealthAlert, channelId?: string): boolean {
    if (!this.config.enabled) return true;

    const fp = this.fingerprint(alert);
    const entry = this.entries.get(fp);
    const now = Date.now();

    if (!entry) {
      // First time seeing this fingerprint — allow it
      return true;
    }

    // Get the effective cooldown
    const cooldown = this.getCooldown(alert.severity);

    // Check global cooldown
    if (now - entry.lastSentAt < cooldown) {
      entry.suppressedCount++;
      this.logger.debug(
        `[Dedup] Suppressed (global): "${alert.title}" — ${(cooldown - (now - entry.lastSentAt)) / 1000}s remaining`,
      );
      return false;
    }

    // Check per-channel cooldown if channelId is provided
    if (channelId) {
      const channelLastSent = entry.channelLastSent.get(channelId) ?? 0;
      if (now - channelLastSent < this.config.perChannelCooldownMs) {
        entry.suppressedCount++;
        this.logger.debug(
          `[Dedup] Suppressed (channel ${channelId}): "${alert.title}"`,
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Record that a notification was sent for this alert.
   * Called after successful dispatch.
   */
  recordSend(alert: HealthAlert, channelId?: string): void {
    const fp = this.fingerprint(alert);
    const now = Date.now();

    let entry = this.entries.get(fp);
    if (!entry) {
      entry = {
        fingerprint: fp,
        firstSeenAt: now,
        lastSentAt: now,
        suppressedCount: 0,
        sentCount: 0,
        channelLastSent: new Map(),
      };
      this.entries.set(fp, entry);
    }

    entry.lastSentAt = now;
    entry.sentCount++;

    if (channelId) {
      entry.channelLastSent.set(channelId, now);
    }

    // LRU eviction if we exceed max
    if (this.entries.size > this.config.maxFingerprints) {
      this.evictOldest();
    }
  }

  /**
   * Force-reset cooldown for a specific alert (e.g. after manual acknowledgment).
   */
  resetCooldown(alert: HealthAlert): void {
    const fp = this.fingerprint(alert);
    this.entries.delete(fp);
    this.logger.log(`[Dedup] Reset cooldown for "${alert.title}"`);
  }

  /**
   * Force-reset all cooldowns.
   */
  resetAll(): void {
    this.entries.clear();
    this.logger.log("[Dedup] All cooldowns reset");
  }

  // ── Cooldown Calculation ──

  private getCooldown(severity: string): number {
    switch (severity) {
      case "critical":
      case "high":
        return this.config.severityCooldowns.critical;
      case "medium":
        return this.config.severityCooldowns.warning;
      case "low":
      case "info":
        return this.config.severityCooldowns.info;
      default:
        return this.config.globalCooldownMs;
    }
  }

  // ── LRU Eviction ──

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.entries) {
      if (entry.lastSentAt < oldestTime) {
        oldestTime = entry.lastSentAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.entries.delete(oldestKey);
    }
  }

  // ── Stats ──

  getStats(): {
    totalFingerprints: number;
    totalSuppressed: number;
    totalSent: number;
    enabled: boolean;
    config: DedupConfig;
    topSuppressed: Array<{
      fingerprint: string;
      suppressedCount: number;
      sentCount: number;
      lastSentAt: string;
    }>;
  } {
    let totalSuppressed = 0;
    let totalSent = 0;
    const top: Array<{
      fingerprint: string;
      suppressedCount: number;
      sentCount: number;
      lastSentAt: string;
    }> = [];

    for (const entry of this.entries.values()) {
      totalSuppressed += entry.suppressedCount;
      totalSent += entry.sentCount;
      top.push({
        fingerprint: entry.fingerprint,
        suppressedCount: entry.suppressedCount,
        sentCount: entry.sentCount,
        lastSentAt: new Date(entry.lastSentAt).toISOString(),
      });
    }

    // Sort by suppressed count descending, take top 10
    top.sort((a, b) => b.suppressedCount - a.suppressedCount);

    return {
      totalFingerprints: this.entries.size,
      totalSuppressed,
      totalSent,
      enabled: this.config.enabled,
      config: this.config,
      topSuppressed: top.slice(0, 10),
    };
  }

  /**
   * Get remaining cooldown for a specific alert fingerprint.
   * Returns 0 if the cooldown has expired.
   */
  getRemainingCooldown(alert: HealthAlert): number {
    const fp = this.fingerprint(alert);
    const entry = this.entries.get(fp);
    if (!entry) return 0;

    const cooldown = this.getCooldown(alert.severity);
    const elapsed = Date.now() - entry.lastSentAt;
    return Math.max(0, cooldown - elapsed);
  }
}
