import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findAllJsonlFiles } from "./scanner.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export type AlertSeverity = "critical" | "warning" | "info";
export type AlertCategory = "disk" | "session" | "security" | "performance" | "retention";

export interface Alert {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  message: string;
  timestamp: Date;
  actionable: boolean;
  action?: string;
}

export interface AlertsReport {
  alerts: Alert[];
  critical: number;
  warning: number;
  info: number;
  generatedAt: Date;
}

export interface UsageQuota {
  name: string;
  current: number;
  limit: number;
  unit: string;
  exceeded: boolean;
  percentage: number;
}

export interface QuotaConfig {
  maxStorageMB?: number;
  maxSessions?: number;
  maxRetentionDays?: number;
  maxSessionSizeMB?: number;
}

const DEFAULT_QUOTAS: QuotaConfig = {
  maxStorageMB: 500,
  maxSessions: 100,
  maxRetentionDays: 90,
  maxSessionSizeMB: 50,
};

function generateAlertId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function checkAlerts(claudeDir?: string, quotaConfig?: QuotaConfig): AlertsReport {
  const projectsDir = path.join(claudeDir || CLAUDE_DIR, "projects");
  const quotas = { ...DEFAULT_QUOTAS, ...quotaConfig };
  const alerts: Alert[] = [];

  if (!fs.existsSync(projectsDir)) {
    return { alerts: [], critical: 0, warning: 0, info: 0, generatedAt: new Date() };
  }

  const files = findAllJsonlFiles(projectsDir);

  let totalSize = 0;
  let largestSession = { path: "", size: 0 };
  let oldestSession: Date | null = null;
  let corruptedSessions = 0;
  let emptySessions = 0;

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      totalSize += stat.size;

      if (stat.size > largestSession.size) {
        largestSession = { path: file, size: stat.size };
      }

      if (!oldestSession || stat.mtime < oldestSession) {
        oldestSession = stat.mtime;
      }

      if (stat.size === 0) {
        emptySessions++;
        continue;
      }

      const content = fs.readFileSync(file, "utf-8");
      const firstLine = content.split("\n")[0];
      try {
        JSON.parse(firstLine);
      } catch {
        corruptedSessions++;
      }
    } catch {
      continue;
    }
  }

  const totalSizeMB = totalSize / (1024 * 1024);
  if (quotas.maxStorageMB && totalSizeMB > quotas.maxStorageMB) {
    alerts.push({
      id: generateAlertId(),
      severity: "critical",
      category: "disk",
      title: "Storage quota exceeded",
      message: `Using ${totalSizeMB.toFixed(1)} MB of ${quotas.maxStorageMB} MB quota.`,
      timestamp: new Date(),
      actionable: true,
      action: "Run 'cct archive' or 'cct retention' to free space.",
    });
  } else if (quotas.maxStorageMB && totalSizeMB > quotas.maxStorageMB * 0.8) {
    alerts.push({
      id: generateAlertId(),
      severity: "warning",
      category: "disk",
      title: "Storage approaching limit",
      message: `Using ${totalSizeMB.toFixed(1)} MB of ${quotas.maxStorageMB} MB (${((totalSizeMB / quotas.maxStorageMB) * 100).toFixed(0)}%).`,
      timestamp: new Date(),
      actionable: true,
      action: "Consider running 'cct archive' to free space.",
    });
  }

  if (quotas.maxSessions && files.length > quotas.maxSessions) {
    alerts.push({
      id: generateAlertId(),
      severity: "warning",
      category: "session",
      title: "Session count exceeds limit",
      message: `${files.length} sessions (limit: ${quotas.maxSessions}).`,
      timestamp: new Date(),
      actionable: true,
      action: "Run 'cct retention' to clean old sessions.",
    });
  }

  const largestMB = largestSession.size / (1024 * 1024);
  if (quotas.maxSessionSizeMB && largestMB > quotas.maxSessionSizeMB) {
    alerts.push({
      id: generateAlertId(),
      severity: "warning",
      category: "performance",
      title: "Oversized session detected",
      message: `${path.basename(largestSession.path)} is ${largestMB.toFixed(1)} MB (limit: ${quotas.maxSessionSizeMB} MB).`,
      timestamp: new Date(),
      actionable: true,
      action: "Run 'cct scan' to check for oversized content.",
    });
  }

  if (oldestSession) {
    const ageInDays = (Date.now() - oldestSession.getTime()) / (24 * 60 * 60 * 1000);
    if (quotas.maxRetentionDays && ageInDays > quotas.maxRetentionDays) {
      alerts.push({
        id: generateAlertId(),
        severity: "info",
        category: "retention",
        title: "Old sessions found",
        message: `Sessions up to ${Math.round(ageInDays)} days old (retention limit: ${quotas.maxRetentionDays} days).`,
        timestamp: new Date(),
        actionable: true,
        action: `Run 'cct retention --days ${quotas.maxRetentionDays}' to enforce policy.`,
      });
    }
  }

  if (corruptedSessions > 0) {
    alerts.push({
      id: generateAlertId(),
      severity: "warning",
      category: "session",
      title: "Corrupted sessions detected",
      message: `${corruptedSessions} session(s) appear corrupted.`,
      timestamp: new Date(),
      actionable: true,
      action: "Run 'cct sessions' to identify, then 'cct recover <id> --repair'.",
    });
  }

  if (emptySessions > 3) {
    alerts.push({
      id: generateAlertId(),
      severity: "info",
      category: "session",
      title: "Empty sessions found",
      message: `${emptySessions} empty session files.`,
      timestamp: new Date(),
      actionable: true,
      action: "Run 'cct clean' to remove empty files.",
    });
  }

  const claudeDirStat = analyzeClaudeDirSize(claudeDir || CLAUDE_DIR);
  if (claudeDirStat.totalMB > 1000) {
    alerts.push({
      id: generateAlertId(),
      severity: "critical",
      category: "disk",
      title: ".claude directory is very large",
      message: `${claudeDirStat.totalMB.toFixed(0)} MB total. Check for debug logs and old snapshots.`,
      timestamp: new Date(),
      actionable: true,
      action: "Run 'cct clean --dry-run' to preview cleanup.",
    });
  }

  return {
    alerts: alerts.sort((a, b) => {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }),
    critical: alerts.filter(a => a.severity === "critical").length,
    warning: alerts.filter(a => a.severity === "warning").length,
    info: alerts.filter(a => a.severity === "info").length,
    generatedAt: new Date(),
  };
}

function analyzeClaudeDirSize(claudeDir: string): { totalMB: number } {
  let totalSize = 0;
  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try {
            totalSize += fs.statSync(full).size;
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }
  walk(claudeDir);
  return { totalMB: totalSize / (1024 * 1024) };
}

export function checkQuotas(quotaConfig?: QuotaConfig, claudeDir?: string): UsageQuota[] {
  const projectsDir = path.join(claudeDir || CLAUDE_DIR, "projects");
  const quotas = { ...DEFAULT_QUOTAS, ...quotaConfig };
  const results: UsageQuota[] = [];

  if (!fs.existsSync(projectsDir)) return results;

  const files = findAllJsonlFiles(projectsDir);
  let totalSize = 0;
  let oldestDate: Date | null = null;

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      totalSize += stat.size;
      if (!oldestDate || stat.mtime < oldestDate) oldestDate = stat.mtime;
    } catch { continue; }
  }

  const totalMB = totalSize / (1024 * 1024);
  if (quotas.maxStorageMB) {
    results.push({
      name: "Storage",
      current: Math.round(totalMB * 10) / 10,
      limit: quotas.maxStorageMB,
      unit: "MB",
      exceeded: totalMB > quotas.maxStorageMB,
      percentage: Math.round((totalMB / quotas.maxStorageMB) * 100),
    });
  }

  if (quotas.maxSessions) {
    results.push({
      name: "Sessions",
      current: files.length,
      limit: quotas.maxSessions,
      unit: "sessions",
      exceeded: files.length > quotas.maxSessions,
      percentage: Math.round((files.length / quotas.maxSessions) * 100),
    });
  }

  if (quotas.maxRetentionDays && oldestDate) {
    const ageInDays = Math.round((Date.now() - oldestDate.getTime()) / (24 * 60 * 60 * 1000));
    results.push({
      name: "Retention",
      current: ageInDays,
      limit: quotas.maxRetentionDays,
      unit: "days",
      exceeded: ageInDays > quotas.maxRetentionDays,
      percentage: Math.round((ageInDays / quotas.maxRetentionDays) * 100),
    });
  }

  return results;
}

export function formatAlertsReport(report: AlertsReport): string {
  const lines: string[] = [];

  lines.push("Alerts & Notifications");
  lines.push("═".repeat(50));
  lines.push("");

  if (report.alerts.length === 0) {
    lines.push("\x1b[32m✓ No alerts. Everything looks good.\x1b[0m\n");
    return lines.join("\n");
  }

  lines.push(`Found ${report.alerts.length} alert(s):`);
  if (report.critical > 0) lines.push(`  \x1b[31m${report.critical} critical\x1b[0m`);
  if (report.warning > 0) lines.push(`  \x1b[33m${report.warning} warning\x1b[0m`);
  if (report.info > 0) lines.push(`  \x1b[36m${report.info} info\x1b[0m`);
  lines.push("");

  for (const alert of report.alerts) {
    const icon = alert.severity === "critical" ? "\x1b[31m✗\x1b[0m" : alert.severity === "warning" ? "\x1b[33m⚠\x1b[0m" : "\x1b[36mℹ\x1b[0m";
    lines.push(`${icon} ${alert.title}`);
    lines.push(`  ${alert.message}`);
    if (alert.action) {
      lines.push(`  → ${alert.action}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function formatQuotasReport(quotas: UsageQuota[]): string {
  const lines: string[] = [];

  lines.push("Usage Quotas");
  lines.push("═".repeat(50));
  lines.push("");

  if (quotas.length === 0) {
    lines.push("No quotas configured.\n");
    return lines.join("\n");
  }

  for (const quota of quotas) {
    const barLen = 20;
    const filled = Math.min(barLen, Math.round((quota.percentage / 100) * barLen));
    const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

    const color = quota.exceeded ? "\x1b[31m" : quota.percentage > 80 ? "\x1b[33m" : "\x1b[32m";
    const status = quota.exceeded ? " EXCEEDED" : "";

    lines.push(`${quota.name}:`);
    lines.push(`  ${color}[${bar}] ${quota.percentage}%${status}\x1b[0m`);
    lines.push(`  ${quota.current} / ${quota.limit} ${quota.unit}`);
    lines.push("");
  }

  return lines.join("\n");
}
