import { useCallback, useEffect, useState } from "react";
import {
  notificationManager,
  type NotificationPreferences,
  type SoundType,
  type NotificationSeverity,
} from "../../lib/notification-manager.js";

const SOUND_OPTIONS: { value: SoundType; label: string }[] = [
  { value: "chime", label: "Chime" },
  { value: "alarm", label: "Alarm" },
  { value: "siren", label: "Siren" },
  { value: "ping", label: "Ping" },
  { value: "none", label: "None" },
];

const SEVERITY_OPTIONS: { value: NotificationSeverity; label: string; color: string }[] = [
  { value: "critical", label: "Critical", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "warning", label: "Warning", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "info", label: "Info", color: "bg-blue-100 text-blue-700 border-blue-200" },
];

interface ServerDedupConfig {
  enabled: boolean;
  globalCooldownMs: number;
  perChannelCooldownMs: number;
  severityCooldowns: { info: number; warning: number; critical: number };
  maxFingerprints: number;
}

interface ServerDedupStats {
  totalFingerprints: number;
  totalSuppressed: number;
  totalSent: number;
  enabled: boolean;
  config: ServerDedupConfig;
  topSuppressed: Array<{ fingerprint: string; suppressedCount: number; sentCount: number; lastSentAt: string }>;
}

export function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(notificationManager.getPreferences());
  const [permissionState, setPermissionState] = useState<NotificationPermission>(
    notificationManager.getPermissionState(),
  );
  const [serverDedup, setServerDedup] = useState<ServerDedupConfig | null>(null);
  const [serverDedupStats, setServerDedupStats] = useState<ServerDedupStats | null>(null);

  useEffect(() => {
    return notificationManager.onPreferencesChange(setPrefs);
  }, []);

  // Load server-side dedup config and stats
  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:3101";
    fetch(`${apiUrl}/api/health/notifications/dedup/config`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setServerDedup(data); })
      .catch(() => {});
    fetch(`${apiUrl}/api/health/notifications/dedup/stats`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setServerDedupStats(data); })
      .catch(() => {});
  }, []);

  const update = useCallback((update: Partial<NotificationPreferences>) => {
    notificationManager.updatePreferences(update);
    setPrefs(notificationManager.getPreferences());
  }, []);

  async function requestPermission() {
    const result = await notificationManager.requestPermission();
    setPermissionState(result);
    if (result === "granted") {
      update({ browserNotifications: true });
    }
  }

  function toggleSeverityFilter(
    key: "browserSeverityFilter" | "audioSeverityFilter",
    severity: NotificationSeverity,
  ) {
    const current = prefs[key];
    const next = current.includes(severity)
      ? current.filter((s) => s !== severity)
      : [...current, severity];
    update({ [key]: next });
  }

  function testSound(severity: NotificationSeverity) {
    notificationManager.playAlert(severity);
  }

  function testNotification() {
    notificationManager.notify({
      title: "Test Notification",
      body: "This is a test from Son of CodeTester Health Monitor.",
      severity: "critical",
      tag: "sct-test",
    });
  }

  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-slate-900">Notification Settings</h3>

      <div className="space-y-6">
        {/* Browser Notifications */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Desktop Notifications</p>
              <p className="text-xs text-slate-400">Get browser push notifications for health events</p>
            </div>
            {permissionState === "granted" ? (
              <button
                onClick={() => update({ browserNotifications: !prefs.browserNotifications })}
                className={`relative h-6 w-11 rounded-full transition ${prefs.browserNotifications ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${prefs.browserNotifications ? "left-[22px]" : "left-0.5"}`} />
              </button>
            ) : permissionState === "denied" ? (
              <span className="text-xs text-red-500 font-medium">Blocked by browser</span>
            ) : (
              <button
                onClick={requestPermission}
                className="rounded-full bg-ocean px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-ocean/90"
              >
                Enable
              </button>
            )}
          </div>

          {prefs.browserNotifications && (
            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Trigger on severity:</p>
              <div className="flex gap-2">
                {SEVERITY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => toggleSeverityFilter("browserSeverityFilter", opt.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      prefs.browserSeverityFilter.includes(opt.value)
                        ? opt.color
                        : "border-slate-200 bg-slate-50 text-slate-400"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={testNotification}
                className="mt-2 text-xs text-ocean font-medium hover:underline"
              >
                Send test notification
              </button>
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Audio Alerts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700">Audio Alerts</p>
              <p className="text-xs text-slate-400">Play sounds when health events occur</p>
            </div>
            <button
              onClick={() => update({ audioAlerts: !prefs.audioAlerts })}
              className={`relative h-6 w-11 rounded-full transition ${prefs.audioAlerts ? "bg-emerald-500" : "bg-slate-300"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${prefs.audioAlerts ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>

          {prefs.audioAlerts && (
            <div className="space-y-3">
              {/* Volume */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-500">Volume</p>
                  <span className="text-xs text-slate-400">{Math.round(prefs.audioVolume * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(prefs.audioVolume * 100)}
                  onChange={(e) => update({ audioVolume: parseInt(e.target.value, 10) / 100 })}
                  className="w-full accent-ocean"
                />
              </div>

              {/* Severity filter */}
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Trigger on severity:</p>
                <div className="flex gap-2">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => toggleSeverityFilter("audioSeverityFilter", opt.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        prefs.audioSeverityFilter.includes(opt.value)
                          ? opt.color
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sound selection per severity */}
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Sound per severity:</p>
                <div className="space-y-2">
                  {SEVERITY_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-center gap-3">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${opt.color} min-w-[70px] text-center`}>
                        {opt.label}
                      </span>
                      <select
                        value={prefs.audioSounds[opt.value]}
                        onChange={(e) =>
                          update({
                            audioSounds: {
                              ...prefs.audioSounds,
                              [opt.value]: e.target.value as SoundType,
                            },
                          })
                        }
                        className="rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-ocean"
                      >
                        {SOUND_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => testSound(opt.value)}
                        className="text-xs text-ocean font-medium hover:underline"
                      >
                        Test
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <hr className="border-slate-100" />

        {/* Rate limiting */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <div>
              <p className="text-sm font-medium text-slate-700">Notification Cooldown</p>
              <p className="text-xs text-slate-400">Minimum time between browser notifications</p>
            </div>
            <span className="text-xs font-semibold text-slate-600">
              {prefs.cooldownMs < 1000
                ? `${prefs.cooldownMs}ms`
                : prefs.cooldownMs < 60_000
                  ? `${Math.round(prefs.cooldownMs / 1000)}s`
                  : `${Math.round(prefs.cooldownMs / 60_000)}m`}
            </span>
          </div>
          <input
            type="range"
            min={1000}
            max={60_000}
            step={1000}
            value={prefs.cooldownMs}
            onChange={(e) => update({ cooldownMs: parseInt(e.target.value, 10) })}
            className="w-full accent-ocean"
          />
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>1s</span>
            <span>30s</span>
            <span>60s</span>
          </div>
        </div>

        <hr className="border-slate-100" />

        {/* Server-side dedup */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-slate-700">Server-Side Alert Deduplication</p>
              <p className="text-xs text-slate-400">Prevent the same alert from being re-sent to external channels</p>
            </div>
            {serverDedup && (
              <button
                onClick={() => toggleServerDedup(!serverDedup.enabled, setServerDedup)}
                className={`relative h-6 w-11 rounded-full transition ${serverDedup.enabled ? "bg-emerald-500" : "bg-slate-300"}`}
              >
                <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${serverDedup.enabled ? "left-[22px]" : "left-0.5"}`} />
              </button>
            )}
          </div>

          {serverDedup && (
            <div className="space-y-3">
              {/* Stats */}
              {serverDedupStats && (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900">{serverDedupStats.totalSuppressed}</p>
                    <p className="text-[10px] text-slate-400">Suppressed</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900">{serverDedupStats.totalSent}</p>
                    <p className="text-[10px] text-slate-400">Sent</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 text-center">
                    <p className="text-lg font-bold text-slate-900">{serverDedupStats.totalFingerprints}</p>
                    <p className="text-[10px] text-slate-400">Tracked</p>
                  </div>
                </div>
              )}

              {/* Global cooldown */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-500">Global Cooldown</p>
                  <span className="text-xs text-slate-400">{formatMs(serverDedup.globalCooldownMs)}</span>
                </div>
                <input
                  type="range"
                  min={30_000}
                  max={3_600_000}
                  step={30_000}
                  value={serverDedup.globalCooldownMs}
                  onChange={(e) => updateServerDedup({ globalCooldownMs: parseInt(e.target.value, 10) }, setServerDedup)}
                  className="w-full accent-ocean"
                />
              </div>

              {/* Per-channel cooldown */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-medium text-slate-500">Per-Channel Cooldown</p>
                  <span className="text-xs text-slate-400">{formatMs(serverDedup.perChannelCooldownMs)}</span>
                </div>
                <input
                  type="range"
                  min={60_000}
                  max={7_200_000}
                  step={60_000}
                  value={serverDedup.perChannelCooldownMs}
                  onChange={(e) => updateServerDedup({ perChannelCooldownMs: parseInt(e.target.value, 10) }, setServerDedup)}
                  className="w-full accent-ocean"
                />
              </div>

              {/* Severity cooldowns */}
              <div>
                <p className="mb-2 text-xs font-medium text-slate-500">Per-Severity Cooldown</p>
                {(["critical", "warning", "info"] as const).map((sev) => (
                  <div key={sev} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sev === "critical" ? "bg-red-100 text-red-700" : sev === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{sev}</span>
                      <span className="text-xs text-slate-400">{formatMs(serverDedup.severityCooldowns[sev])}</span>
                    </div>
                    <input
                      type="range"
                      min={30_000}
                      max={1_800_000}
                      step={30_000}
                      value={serverDedup.severityCooldowns[sev]}
                      onChange={(e) => updateServerDedup({ severityCooldowns: { ...serverDedup.severityCooldowns, [sev]: parseInt(e.target.value, 10) } }, setServerDedup)}
                      className="w-full accent-ocean"
                    />
                  </div>
                ))}
              </div>

              {/* Top suppressed alerts */}
              {serverDedupStats && serverDedupStats.topSuppressed.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-slate-500">Most Suppressed Alerts</p>
                  <div className="space-y-1.5">
                    {serverDedupStats.topSuppressed.slice(0, 5).map((item) => (
                      <div key={item.fingerprint} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                        <span className="text-xs text-slate-600 truncate max-w-[200px]" title={item.fingerprint}>{item.fingerprint}</span>
                        <span className="text-[10px] text-slate-400">{item.suppressedCount}x suppressed</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Reset button */}
              <button
                onClick={resetServerDedup}
                className="text-xs text-red-500 font-medium hover:underline"
              >
                Reset all cooldowns
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

const DEDUP_API = () => `${import.meta.env.VITE_API_URL ?? "http://localhost:3101"}/api/health/notifications/dedup`;

async function toggleServerDedup(enabled: boolean, setCfg: React.Dispatch<React.SetStateAction<ServerDedupConfig | null>>) {
  await fetch(`${DEDUP_API()}/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled }) });
  setCfg((prev) => prev ? { ...prev, enabled } : prev);
}

async function updateServerDedup(update: Partial<ServerDedupConfig>, setCfg: React.Dispatch<React.SetStateAction<ServerDedupConfig | null>>) {
  await fetch(`${DEDUP_API()}/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
  setCfg((prev) => prev ? { ...prev, ...update } : prev);
}

async function resetServerDedup() {
  if (!confirm("Reset all dedup cooldowns? Alerts will be re-sent immediately.")) return;
  await fetch(`${DEDUP_API()}/reset`, { method: "POST" });
  window.location.reload();
}
