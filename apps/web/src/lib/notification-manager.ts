/**
 * Browser Notification Manager for real-time health alerts.
 *
 * Handles:
 *  - Web Notifications API (desktop push notifications)
 *  - Web Audio API (configurable alert sounds)
 *  - User preference persistence via localStorage
 *  - Permission management
 *  - Rate limiting to prevent notification spam
 */

export interface NotificationPreferences {
  /** Whether browser notifications are enabled */
  browserNotifications: boolean;
  /** Whether audio alerts are enabled */
  audioAlerts: boolean;
  /** Which severity levels trigger browser notifications */
  browserSeverityFilter: ("info" | "warning" | "critical")[];
  /** Which severity levels trigger audio alerts */
  audioSeverityFilter: ("info" | "warning" | "critical")[];
  /** Audio volume (0.0 to 1.0) */
  audioVolume: number;
  /** Which sound to play for each severity */
  audioSounds: {
    info: SoundType;
    warning: SoundType;
    critical: SoundType;
  };
  /** Minimum ms between notifications (rate limit) */
  cooldownMs: number;
}

export type SoundType = "chime" | "alarm" | "siren" | "ping" | "none";

export type NotificationSeverity = "info" | "warning" | "critical";

const STORAGE_KEY = "sct-notification-prefs";

const DEFAULT_PREFERENCES: NotificationPreferences = {
  browserNotifications: false,
  audioAlerts: false,
  browserSeverityFilter: ["critical"],
  audioSeverityFilter: ["critical", "warning"],
  audioVolume: 0.5,
  audioSounds: {
    info: "ping",
    warning: "chime",
    critical: "alarm",
  },
  cooldownMs: 5000,
};

/**
 * Singleton notification manager.
 */
class NotificationManagerInstance {
  private prefs: NotificationPreferences;
  private lastNotificationTime = 0;
  private audioContext: AudioContext | null = null;
  private permissionState: NotificationPermission = "default";
  private listeners: Array<(prefs: NotificationPreferences) => void> = [];

  constructor() {
    this.prefs = this.loadPreferences();
    this.permissionState =
      typeof Notification !== "undefined" ? Notification.permission : "denied";
  }

  // ── Preferences ──

  getPreferences(): NotificationPreferences {
    return { ...this.prefs };
  }

  updatePreferences(update: Partial<NotificationPreferences>): void {
    this.prefs = { ...this.prefs, ...update };
    this.savePreferences();
    this.listeners.forEach((fn) => fn(this.prefs));
  }

  onPreferencesChange(fn: (prefs: NotificationPreferences) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private loadPreferences(): NotificationPreferences {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_PREFERENCES };
  }

  private savePreferences(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs));
    } catch {
      // ignore
    }
  }

  // ── Permission ──

  getPermissionState(): NotificationPermission {
    return this.permissionState;
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (typeof Notification === "undefined") {
      return "denied";
    }

    if (Notification.permission === "granted") {
      this.permissionState = "granted";
      return "granted";
    }

    if (Notification.permission === "denied") {
      this.permissionState = "denied";
      return "denied";
    }

    const result = await Notification.requestPermission();
    this.permissionState = result;
    return result;
  }

  // ── Notification Dispatch ──

  /**
   * Send a browser notification for a health event.
   * Respects user preferences, severity filters, and cooldown.
   */
  notify(options: {
    title: string;
    body: string;
    severity: NotificationSeverity;
    dimension?: string;
    tag?: string;
    onClick?: () => void;
  }): void {
    // Check browser notifications enabled
    if (!this.prefs.browserNotifications) return;

    // Check severity filter
    if (!this.prefs.browserSeverityFilter.includes(options.severity)) return;

    // Rate limit
    const now = Date.now();
    if (now - this.lastNotificationTime < this.prefs.cooldownMs) return;
    this.lastNotificationTime = now;

    // Check permission
    if (this.permissionState !== "granted") return;

    const icon = this.getSeverityLabel(options.severity);
    const color = this.getSeverityColor(options.severity);

    try {
      const notification = new Notification(`${icon} ${options.title}`, {
        body: options.body,
        tag: options.tag ?? `sct-health-${options.severity}`,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        silent: true, // We handle our own audio
        requireInteraction: options.severity === "critical",
      });

      notification.onclick = () => {
        window.focus();
        options.onClick?.();
        notification.close();
      };

      // Auto-close after 8 seconds (non-critical) or 15 seconds (critical)
      const autoCloseMs = options.severity === "critical" ? 15_000 : 8_000;
      setTimeout(() => notification.close(), autoCloseMs);
    } catch {
      // Notification failed — ignore
    }
  }

  // ── Audio Alerts ──

  /**
   * Play an audio alert for a health event.
   * Uses Web Audio API to generate tones — no external files needed.
   */
  playAlert(severity: NotificationSeverity): void {
    if (!this.prefs.audioAlerts) return;
    if (!this.prefs.audioSeverityFilter.includes(severity)) return;

    const soundType = this.prefs.audioSounds[severity];
    if (soundType === "none") return;

    try {
      if (!this.audioContext) {
        this.audioContext = new AudioContext();
      }

      // Resume context if suspended (browser autoplay policy)
      if (this.audioContext.state === "suspended") {
        this.audioContext.resume();
      }

      this.playSound(soundType, this.prefs.audioVolume);
    } catch {
      // Audio failed — ignore
    }
  }

  /**
   * Generate and play a sound using Web Audio API oscillators.
   */
  private playSound(type: SoundType, volume: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const now = ctx.currentTime;

    switch (type) {
      case "chime":
        this.playChime(ctx, now, volume);
        break;
      case "alarm":
        this.playAlarm(ctx, now, volume);
        break;
      case "siren":
        this.playSiren(ctx, now, volume);
        break;
      case "ping":
        this.playPing(ctx, now, volume);
        break;
    }
  }

  private playChime(ctx: AudioContext, start: number, vol: number): void {
    // Pleasant two-tone chime
    const freqs = [523.25, 659.25]; // C5, E5
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start + i * 0.15);
      gain.gain.linearRampToValueAtTime(vol * 0.3, start + i * 0.15 + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + i * 0.15 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + i * 0.15);
      osc.stop(start + i * 0.15 + 0.5);
    });
  }

  private playAlarm(ctx: AudioContext, start: number, vol: number): void {
    // Urgent three-beep alarm
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0, start + i * 0.2);
      gain.gain.linearRampToValueAtTime(vol * 0.15, start + i * 0.2 + 0.02);
      gain.gain.setValueAtTime(vol * 0.15, start + i * 0.2 + 0.12);
      gain.gain.linearRampToValueAtTime(0, start + i * 0.2 + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start + i * 0.2);
      osc.stop(start + i * 0.2 + 0.2);
    }
  }

  private playSiren(ctx: AudioContext, start: number, vol: number): void {
    // Rising siren sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, start);
    osc.frequency.linearRampToValueAtTime(1200, start + 0.5);
    osc.frequency.linearRampToValueAtTime(400, start + 1.0);
    gain.gain.setValueAtTime(vol * 0.2, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 1.3);
  }

  private playPing(ctx: AudioContext, start: number, vol: number): void {
    // Simple single ping
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 800;
    gain.gain.setValueAtTime(vol * 0.25, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.35);
  }

  // ── Combined dispatch ──

  /**
   * Process a health event and trigger both browser notification and audio.
   * This is the main entry point called by the HealthDashboard.
   */
  processHealthEvent(event: {
    type: string;
    summary: string;
    dimension?: string;
    severity?: NotificationSeverity;
  }): void {
    const severity = event.severity ?? this.inferSeverity(event.type);

    // Browser notification
    this.notify({
      title: this.getEventTitle(event.type),
      body: event.summary,
      severity,
      dimension: event.dimension,
      tag: `sct-${event.type}-${Date.now()}`,
    });

    // Audio alert
    this.playAlert(severity);
  }

  // ── Helpers ──

  private inferSeverity(type: string): NotificationSeverity {
    if (type.includes("critical") || type.includes("down")) return "critical";
    if (type.includes("warning") || type.includes("degraded")) return "warning";
    return "info";
  }

  private getEventTitle(type: string): string {
    switch (type) {
      case "vulnerability-found": return "Vulnerability Detected";
      case "security-scan-completed": return "Security Scan Complete";
      case "health-score-changed": return "Health Score Changed";
      case "service-status-changed": return "Service Status Changed";
      case "db-alert-triggered": return "Database Alert";
      case "perf-alert-triggered": return "Performance Alert";
      case "ui-score-changed": return "UI/UX Score Changed";
      default: return "Health Event";
    }
  }

  private getSeverityLabel(severity: NotificationSeverity): string {
    switch (severity) {
      case "critical": return "[CRITICAL]";
      case "warning": return "[WARNING]";
      case "info": return "[INFO]";
    }
  }

  private getSeverityColor(severity: NotificationSeverity): string {
    switch (severity) {
      case "critical": return "#dc3545";
      case "warning": return "#ffc107";
      case "info": return "#17a2b8";
    }
  }
}

/** Singleton instance */
export const notificationManager = new NotificationManagerInstance();
