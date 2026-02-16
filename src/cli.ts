#!/usr/bin/env node
/**
 * CLI for Claude Code Toolkit
 * Can be used standalone without MCP integration
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  findAllJsonlFiles,
  findBackupFiles,
  scanFile,
  fixFile,
  getConversationStats,
  restoreFromBackup,
  deleteOldBackups,
  exportConversationToFile,
  estimateContextSize,
  formatContextEstimate,
  generateUsageAnalytics,
  formatUsageAnalytics,
  findDuplicates,
  formatDuplicateReport,
  findArchiveCandidates,
  archiveConversations,
  formatArchiveReport,
  runMaintenance,
  formatMaintenanceReport,
  generateCronSchedule,
  generateLaunchdPlist,
  type IssueType,
  type ExportFormat,
} from "./lib/scanner.js";
import {
  analyzeClaudeStorage,
  cleanClaudeDirectory,
  findCleanupTargets,
  formatStorageReport,
  formatCleanupReport,
} from "./lib/storage.js";
import {
  diagnoseMcpServers,
  formatMcpDiagnosticReport,
  analyzeMcpPerformance,
  formatMcpPerformanceReport,
} from "./lib/mcp-validator.js";
import {
  listSessions,
  diagnoseSession,
  repairSession,
  extractSessionContent,
  formatSessionReport,
  formatSessionDiagnosticReport,
} from "./lib/session-recovery.js";
import {
  scanForSecrets,
  scanForPII,
  auditSession,
  enforceRetention,
  formatSecretsScanReport,
  formatPIIScanReport,
  formatAuditReport,
  formatRetentionReport,
} from "./lib/security.js";
import {
  inventoryTraces,
  cleanTraces,
  wipeAllTraces,
  generateTraceGuardHooks,
  formatTraceInventory,
  formatTraceCleanReport,
  formatTraceGuardConfig,
} from "./lib/trace.js";
import { startDashboard, stopDashboard, isDashboardRunning } from "./lib/dashboard.js";
import { searchConversations, formatSearchReport, SearchOptions, compareSessionsByCID, formatSessionDiff } from "./lib/search.js";
import { linkSessionsToGit, formatGitLinkReport } from "./lib/git.js";
import { checkAlerts, checkQuotas, formatAlertsReport, formatQuotasReport } from "./lib/alerts.js";
import {
  addBookmark,
  removeBookmark,
  getSessionBookmarks,
  getAllBookmarks,
  renameSession,
  starSession,
  tagSession,
  addTagToSession,
  getSessionTags,
  getAllTags,
  getStarredSessions,
  getBookmarksSummary,
  formatBookmarkReport,
} from "./lib/bookmarks.js";
import { exportToHtml, bulkExport } from "./lib/export.js";
import {
  bulkDelete,
  bulkArchiveSessions,
  bulkExportSessions,
  formatBulkOperationReport,
} from "./lib/bulk.js";

function formatContentType(type: IssueType): string {
  switch (type) {
    case "image": return "🖼️  image";
    case "pdf": return "📄 pdf";
    case "document": return "📎 document";
    case "large_text": return "📝 large text";
    default: return "❓ unknown";
  }
}

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function printHelp() {
  console.log(`
Claude Code Toolkit v1.4.0
Maintain, optimize, secure, and troubleshoot your Claude Code installation.

USAGE:
  cct <command> [options]
  claude-code-toolkit <command> [options]

COMMANDS:
  health              Quick health check (start here!)
  search <query>      Full-text search across all conversations
  stats               Show conversation statistics
  context             Estimate context/token usage
  cost                Estimate API costs based on token usage
  analytics           Usage analytics dashboard
  duplicates          Find duplicate content and conversations
  archive             Archive old/inactive conversations
  maintenance         Run maintenance checks and actions
  scan                Scan for issues (dry run)
  fix                 Fix all detected issues
  watch               Monitor sessions for new oversized content
  export              Export conversation to markdown or JSON
  backups             List backup files
  restore <path>      Restore from a backup file
  cleanup             Delete old backup files
  clean               Analyze and clean .claude directory
  mcp-validate        Validate MCP server configurations
  mcp-perf            Track MCP server performance and usage
  sessions            List all sessions with health status
  diff <id1> <id2>    Compare two sessions
  git                 Link sessions to git branches/commits
  recover <id>        Diagnose/repair/extract from a session
  security-scan       Scan conversations for leaked secrets
  pii-scan            Scan conversations for personal data (PII)
                      --details: Show unmasked values (handle with care!)
  audit <id>          Audit a session's actions (files, commands, etc.)
  retention           Enforce data retention policy
  alerts              Check for issues and notifications
  quotas              Show usage quotas and limits
  dashboard           Open web dashboard in browser
  dashboard --daemon   Run dashboard as background process
  dashboard --stop     Stop background dashboard
  trace               Show full trace inventory
  trace clean         Selective trace cleanup
  trace wipe          Secure wipe all traces (requires --confirm)
  trace guard         Generate trace prevention hooks

SESSION MANAGEMENT:
  rename <id> <name>  Rename a session with a custom name
  star <id>           Star/unstar a session (--unstar to remove)
  tag <id> <tags>     Add tags to a session (comma-separated)
  bookmarks           List all bookmarks and starred sessions
  starred             List starred sessions

EXPORT & BULK OPERATIONS:
  export-html <id>    Export session to HTML with syntax highlighting
                      --theme light|dark, --output <path>
  bulk-export         Export multiple sessions
                      --project <filter>, --format html|markdown|json
  bulk-delete         Delete multiple sessions (with backup)
                      --days <n>, --project <filter>
  bulk-archive        Archive multiple sessions
                      --days <n>, --project <filter>

OPTIONS:
  -f, --file <path>     Target a specific file
  -o, --output <path>   Output file path (for export)
  -q, --query <text>    Search query text
  --role <type>         For search: filter by role (user|assistant|all)
  --format <type>       Export format: markdown, json, or html (default: markdown)
  --theme <type>        For HTML export: light or dark (default: light)
  --with-tools          Include tool results in export
  -d, --dry-run         Show what would be done without making changes
  --no-backup           Skip creating backups when fixing (not recommended)
  --days <n>            For cleanup/archive/retention: days threshold (default: 7/30)
  --limit <n>           For stats/search: limit results (default: 10/50)
  --sort <field>        For stats: sort by size|messages|images|modified
  --auto                For maintenance: run automatically without prompts
  --schedule            For maintenance: show cron/launchd setup
  --category <type>     For clean: target specific category
  --test                For mcp-validate: test server connectivity
  --extract             For recover: extract salvageable content
  --repair              For recover: attempt repair
  --confirm             For trace wipe: confirm destructive operation
  --keep-settings       For trace wipe: preserve settings.json
  --mode <mode>         For trace guard: paranoid|moderate|minimal
  --install             For trace guard: auto-install hooks
  --categories <list>   For trace clean: comma-separated categories
  --port <n>            For dashboard: port number (default: 1405)
  --daemon              For dashboard: run as background process
  --stop                For dashboard: stop background process
  --token <value>       Require dashboard auth with bearer token
  --project <path>      Filter by project path
  --json                Output structured JSON (scan/watch)
  --interval <sec>      For watch: polling interval in seconds (default: 15)
  --auto-fix            For watch: automatically fix detected issues
  -h, --help            Show this help message
  -v, --version         Show version

EXAMPLES:
  cct health                        # Quick health check
  cct search "authentication"       # Search all conversations
  cct search "api" --role user      # Search only user messages
  cct cost                          # Estimate API costs
  cct clean --dry-run               # Preview .claude directory cleanup
  cct mcp-validate --test           # Validate and test MCP servers
  cct sessions                      # List all sessions
  cct recover abc-123 --repair      # Repair a corrupted session
  cct security-scan                 # Scan for leaked secrets
  cct audit abc-123                 # Audit session actions
  cct retention --days 60 --dry-run # Preview retention policy
  cct trace                         # Show trace inventory
  cct trace clean --days 7          # Clean old traces
  cct trace wipe --confirm          # Secure wipe all traces
  cct trace guard --mode moderate   # Generate trace prevention hooks

For more info: https://github.com/asifkibria/claude-code-toolkit
`);
}

function parseArgs(args: string[]): {
  command: string;
  subcommand?: string;
  file?: string;
  output?: string;
  query?: string;
  role?: string;
  format: ExportFormat;
  withTools: boolean;
  dryRun: boolean;
  noBackup: boolean;
  days: number;
  limit: number;
  sort: string;
  auto: boolean;
  schedule: boolean;
  category?: string;
  test: boolean;
  extract: boolean;
  repair: boolean;
  confirm: boolean;
  keepSettings: boolean;
  mode: string;
  install: boolean;
  categories?: string;
  project?: string;
  port: number;
  daemon: boolean;
  stop: boolean;
  token?: string;
  json: boolean;
  interval: number;
  autoFix: boolean;
  details: boolean;
  theme: string;
  unstar: boolean;
  name?: string;
  tags?: string;
} {
  const result = {
    command: "",
    subcommand: undefined as string | undefined,
    file: undefined as string | undefined,
    output: undefined as string | undefined,
    query: undefined as string | undefined,
    role: undefined as string | undefined,
    format: "markdown" as ExportFormat,
    withTools: false,
    dryRun: false,
    noBackup: false,
    days: 7,
    limit: 10,
    sort: "size",
    auto: false,
    schedule: false,
    category: undefined as string | undefined,
    test: false,
    extract: false,
    repair: false,
    confirm: false,
    keepSettings: false,
    mode: "moderate",
    install: false,
    categories: undefined as string | undefined,
    project: undefined as string | undefined,
    port: 1405,
    daemon: false,
    stop: false,
    token: undefined as string | undefined,
    json: false,
    interval: 15,
    autoFix: false,
    details: false,
    theme: "light",
    unstar: false,
    name: undefined as string | undefined,
    tags: undefined as string | undefined,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "-v" || arg === "--version") {
      console.log("1.4.0");
      process.exit(0);
    }

    if (arg === "-f" || arg === "--file") {
      result.file = args[++i];
      continue;
    }

    if (arg === "-o" || arg === "--output") {
      result.output = args[++i];
      continue;
    }

    if (arg === "-q" || arg === "--query") {
      result.query = args[++i];
      continue;
    }

    if (arg === "--role") {
      result.role = args[++i];
      continue;
    }

    if (arg === "--format") {
      const fmt = args[++i];
      if (fmt === "json" || fmt === "markdown") {
        result.format = fmt;
      }
      continue;
    }

    if (arg === "--with-tools") {
      result.withTools = true;
      continue;
    }

    if (arg === "-d" || arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (arg === "--no-backup") {
      result.noBackup = true;
      continue;
    }

    if (arg === "--days") {
      result.days = parseInt(args[++i], 10);
      continue;
    }

    if (arg === "--limit") {
      result.limit = parseInt(args[++i], 10);
      continue;
    }

    if (arg === "--sort") {
      result.sort = args[++i];
      continue;
    }

    if (arg === "--auto") {
      result.auto = true;
      continue;
    }

    if (arg === "--schedule") {
      result.schedule = true;
      continue;
    }

    if (arg === "--category") {
      result.category = args[++i];
      continue;
    }

    if (arg === "--test") {
      result.test = true;
      continue;
    }

    if (arg === "--extract") {
      result.extract = true;
      continue;
    }

    if (arg === "--repair") {
      result.repair = true;
      continue;
    }

    if (arg === "--confirm") {
      result.confirm = true;
      continue;
    }

    if (arg === "--keep-settings") {
      result.keepSettings = true;
      continue;
    }

    if (arg === "--mode") {
      result.mode = args[++i];
      continue;
    }

    if (arg === "--install") {
      result.install = true;
      continue;
    }

    if (arg === "--categories") {
      result.categories = args[++i];
      continue;
    }

    if (arg === "--port") {
      result.port = parseInt(args[++i], 10);
      continue;
    }

    if (arg === "--daemon") {
      result.daemon = true;
      continue;
    }

    if (arg === "--stop") {
      result.stop = true;
      continue;
    }

    if (arg === "--project") {
      result.project = args[++i];
      continue;
    }

    if (arg === "--token") {
      result.token = args[++i];
      continue;
    }

    if (arg === "--json") {
      result.json = true;
      continue;
    }

    if (arg === "--interval") {
      result.interval = parseInt(args[++i], 10);
      continue;
    }

    if (arg === "--auto-fix") {
      result.autoFix = true;
      continue;
    }

    if (arg === "--details") {
      result.details = true;
      continue;
    }

    if (arg === "--theme") {
      result.theme = args[++i];
      continue;
    }

    if (arg === "--unstar") {
      result.unstar = true;
      continue;
    }

    if (!arg.startsWith("-") && !result.command) {
      result.command = arg;
      continue;
    }

    if (!arg.startsWith("-") && (result.command === "restore" || result.command === "recover" || result.command === "audit" || result.command === "export-html")) {
      result.file = arg;
      continue;
    }

    if (!arg.startsWith("-") && result.command === "search" && !result.query) {
      result.query = arg;
      continue;
    }

    if (!arg.startsWith("-") && result.command === "diff") {
      if (!result.file) {
        result.file = arg;
      } else if (!result.subcommand) {
        result.subcommand = arg;
      }
      continue;
    }

    if (!arg.startsWith("-") && result.command === "trace" && !result.subcommand) {
      result.subcommand = arg;
      continue;
    }

    if (!arg.startsWith("-") && result.command === "rename") {
      if (!result.file) {
        result.file = arg;
      } else if (!result.name) {
        result.name = arg;
      }
      continue;
    }

    if (!arg.startsWith("-") && result.command === "star") {
      result.file = arg;
      continue;
    }

    if (!arg.startsWith("-") && result.command === "tag") {
      if (!result.file) {
        result.file = arg;
      } else if (!result.tags) {
        result.tags = arg;
      }
      continue;
    }
  }

  return result;
}

interface ScanSummary {
  success: boolean;
  filesScanned: number;
  filesWithIssues: number;
  totalIssues: number;
  files: Array<{
    file: string;
    issues: Array<{
      line: number;
      type: IssueType;
      location: string;
      size: string;
    }>;
  }>;
}

async function cmdScan(file: string | undefined, asJson: boolean): Promise<ScanSummary | void> {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const files = file ? [file] : findAllJsonlFiles(PROJECTS_DIR);
  const summary: ScanSummary = {
    success: true,
    filesScanned: files.length,
    filesWithIssues: 0,
    totalIssues: 0,
    files: [],
  };

  if (!asJson) {
    console.log(`Scanning ${files.length} file(s)...\n`);
  }

  let totalIssues = 0;
  let filesWithIssues = 0;

  for (const f of files) {
    try {
      const result = scanFile(f);
      if (result.issues.length > 0) {
        filesWithIssues++;
        totalIssues += result.issues.length;
        const relPath = path.relative(PROJECTS_DIR, f);
        if (!asJson) {
          console.log(`\x1b[33m${relPath}\x1b[0m`);
          for (const issue of result.issues) {
            console.log(`  Line ${issue.line}: ${formatContentType(issue.contentType)} (~${formatBytes(issue.estimatedSize)})`);
          }
        }
        summary.files.push({
          file: relPath,
          issues: result.issues.map((issue) => ({
            line: issue.line,
            type: issue.contentType,
            location: issue.location,
            size: formatBytes(issue.estimatedSize),
          })),
        });
      }
    } catch {
      // Skip
    }
  }

  console.log();
  summary.totalIssues = totalIssues;
  summary.filesWithIssues = filesWithIssues;

  if (asJson) {
    return summary;
  }

  if (totalIssues === 0) {
    console.log("\x1b[32m✓ No oversized content found.\x1b[0m");
  } else {
    console.log(`\x1b[33mFound ${totalIssues} issue(s) in ${filesWithIssues} file(s).\x1b[0m`);
    console.log("Run 'cct fix' to fix them.");
  }
}

interface WatchEvent {
  timestamp: string;
  file: string;
  issues: number;
  action: "detected" | "fixed" | "error";
  details?: string;
}

async function cmdWatch(asJson: boolean, intervalSeconds: number, autoFix: boolean): Promise<never> {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const effectiveSeconds = Number.isFinite(intervalSeconds) && intervalSeconds > 0 ? intervalSeconds : 15;
  const intervalMs = Math.max(5, effectiveSeconds) * 1000;
  const seen = new Map<string, number>();

  const logEvent = (event: WatchEvent) => {
    if (asJson) {
      console.log(JSON.stringify(event));
    } else {
      const actionText = event.action === "fixed" ? "Fixed" : event.action === "error" ? "Error" : "Detected";
      console.log(`[${event.timestamp}] ${actionText}: ${event.file} (${event.issues} issue(s))${event.details ? ` - ${event.details}` : ""}`);
    }
  };

  const checkFiles = async () => {
    const files = findAllJsonlFiles(PROJECTS_DIR);
    const active = new Set<string>();

    for (const file of files) {
      active.add(file);
      let stat: fs.Stats;
      try {
        stat = fs.statSync(file);
      } catch {
        continue;
      }
      const last = seen.get(file) || 0;
      if (stat.mtimeMs <= last) continue;
      seen.set(file, stat.mtimeMs);

      let result: ReturnType<typeof scanFile>;
      try {
        result = scanFile(file);
      } catch {
        continue;
      }

      if (result.issues.length === 0) continue;
      const relPath = path.relative(PROJECTS_DIR, file);
      const eventBase: WatchEvent = {
        timestamp: new Date().toISOString(),
        file: relPath,
        issues: result.issues.length,
        action: "detected",
      };

      if (autoFix) {
        try {
          const fixResult = fixFile(file);
          if (fixResult.fixed) {
            logEvent({ ...eventBase, action: "fixed" });
          } else {
            logEvent({ ...eventBase, action: "error", details: "No changes applied" });
          }
        } catch (err) {
          logEvent({ ...eventBase, action: "error", details: err instanceof Error ? err.message : String(err) });
        }
      } else {
        logEvent(eventBase);
      }
    }

    for (const entry of Array.from(seen.keys())) {
      if (!active.has(entry)) {
        seen.delete(entry);
      }
    }
  };

  await checkFiles();
  if (!asJson) {
    console.log(`Watching ${PROJECTS_DIR} every ${intervalMs / 1000}s. Press Ctrl+C to stop.`);
    if (autoFix) {
      console.log("Auto-fix is enabled. Backups will be created before changes.\n");
    }
  }

  setInterval(() => {
    checkFiles().catch((err) => {
      if (asJson) {
        console.log(JSON.stringify({ timestamp: new Date().toISOString(), action: "error", details: err.message }));
      } else {
        console.error("Watch error:", err);
      }
    });
  }, intervalMs);

  return new Promise(() => {
    // Keep process alive until Ctrl+C
  });
}

async function cmdFix(file?: string, noBackup = false) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const files = file ? [file] : findAllJsonlFiles(PROJECTS_DIR);
  console.log(`Processing ${files.length} file(s)...\n`);

  let totalFixed = 0;
  let filesFixed = 0;

  for (const f of files) {
    try {
      const result = fixFile(f, !noBackup);
      if (result.fixed) {
        filesFixed++;
        totalFixed += result.issues.length;
        const relPath = path.relative(PROJECTS_DIR, f);
        console.log(`\x1b[32m✓ ${relPath}\x1b[0m`);
        console.log(`  Fixed ${result.issues.length} issue(s)`);
        if (result.backupPath) {
          console.log(`  Backup: ${path.basename(result.backupPath)}`);
        }
      }
    } catch {
      // Skip
    }
  }

  console.log();
  if (totalFixed === 0) {
    console.log("\x1b[32m✓ No issues to fix.\x1b[0m");
  } else {
    console.log(`\x1b[32m✓ Fixed ${totalFixed} issue(s) in ${filesFixed} file(s).\x1b[0m`);
    console.log("Restart Claude Code to apply changes.");
  }
}

async function cmdStats(limit: number, sort: string) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const files = findAllJsonlFiles(PROJECTS_DIR);
  const allStats = files.map((f) => {
    try {
      return getConversationStats(f);
    } catch {
      return null;
    }
  }).filter(Boolean) as ReturnType<typeof getConversationStats>[];

  allStats.sort((a, b) => {
    switch (sort) {
      case "messages":
        return b.totalMessages - a.totalMessages;
      case "images":
        return b.imageCount - a.imageCount;
      case "modified":
        return b.lastModified.getTime() - a.lastModified.getTime();
      default:
        return b.fileSizeBytes - a.fileSizeBytes;
    }
  });

  const totalSize = allStats.reduce((sum, s) => sum + s.fileSizeBytes, 0);
  const totalMessages = allStats.reduce((sum, s) => sum + s.totalMessages, 0);
  const totalImages = allStats.reduce((sum, s) => sum + s.imageCount, 0);
  const totalDocs = allStats.reduce((sum, s) => sum + s.documentCount, 0);
  const totalProblematic = allStats.reduce((sum, s) => sum + s.problematicContent, 0);

  console.log("Conversation Statistics\n");
  console.log(`Total: ${allStats.length} conversations, ${formatBytes(totalSize)}`);
  console.log(`Messages: ${totalMessages.toLocaleString()}, Images: ${totalImages}, Documents: ${totalDocs}`);
  console.log(`Problematic content: ${totalProblematic}\n`);

  console.log(`Top ${Math.min(limit, allStats.length)} by ${sort}:\n`);

  for (const stats of allStats.slice(0, limit)) {
    const relPath = path.relative(PROJECTS_DIR, stats.file);
    const shortPath = relPath.length > 60 ? "..." + relPath.slice(-57) : relPath;
    console.log(`\x1b[36m${shortPath}\x1b[0m`);
    console.log(`  Size: ${formatBytes(stats.fileSizeBytes)}, Messages: ${stats.totalMessages}`);
    console.log(`  Images: ${stats.imageCount}, Documents: ${stats.documentCount}${stats.problematicContent > 0 ? ` (\x1b[33m${stats.problematicContent} oversized\x1b[0m)` : ""}`);
    console.log(`  Modified: ${formatDate(stats.lastModified)}\n`);
  }
}

async function cmdBackups() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const backups = findBackupFiles(PROJECTS_DIR);

  if (backups.length === 0) {
    console.log("No backup files found.");
    return;
  }

  const backupInfo = backups.map((b) => {
    try {
      const stat = fs.statSync(b);
      return { path: b, size: stat.size, mtime: stat.mtime };
    } catch {
      return { path: b, size: 0, mtime: new Date(0) };
    }
  }).sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

  const totalSize = backupInfo.reduce((sum, b) => sum + b.size, 0);

  console.log(`Backup Files (${backups.length} files, ${formatBytes(totalSize)} total)\n`);

  for (const backup of backupInfo) {
    const relPath = path.relative(PROJECTS_DIR, backup.path);
    console.log(`${relPath}`);
    console.log(`  Size: ${formatBytes(backup.size)}, Created: ${formatDate(backup.mtime)}`);
  }
}

async function cmdRestore(backupPath: string) {
  if (!backupPath) {
    console.error("Please specify a backup file path.");
    process.exit(1);
  }

  const result = restoreFromBackup(backupPath);

  if (!result.success) {
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  console.log(`\x1b[32m✓ Restored ${result.originalPath}\x1b[0m`);
  console.log("Restart Claude Code to apply changes.");
}

async function cmdCleanup(days: number, dryRun: boolean) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  if (dryRun) {
    const backups = findBackupFiles(PROJECTS_DIR);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const toDelete = backups.filter((b) => {
      try {
        const stat = fs.statSync(b);
        return stat.mtime < cutoffDate;
      } catch {
        return false;
      }
    });

    if (toDelete.length === 0) {
      console.log(`No backups older than ${days} days found.`);
      return;
    }

    console.log(`Would delete ${toDelete.length} backup(s):\n`);
    for (const b of toDelete) {
      console.log(`  ${path.relative(PROJECTS_DIR, b)}`);
    }
    console.log("\nRun without --dry-run to delete.");
  } else {
    const result = deleteOldBackups(PROJECTS_DIR, days);

    if (result.deleted.length === 0) {
      console.log(`No backups older than ${days} days found.`);
      return;
    }

    console.log(`\x1b[32m✓ Deleted ${result.deleted.length} backup(s)\x1b[0m`);

    if (result.errors.length > 0) {
      console.log("\nErrors:");
      for (const err of result.errors) {
        console.log(`  ${err}`);
      }
    }
  }
}

async function cmdExport(file: string | undefined, output: string | undefined, format: ExportFormat, withTools: boolean) {
  if (!file) {
    console.error("Please specify a conversation file with -f or --file");
    console.error("Example: cct export -f ~/.claude/projects/myproject/conversation.jsonl");
    process.exit(1);
  }

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const ext = format === "json" ? ".json" : ".md";
  const outputPath = output || file.replace(".jsonl", `-export${ext}`);

  console.log(`Exporting conversation...`);
  console.log(`  Source: ${file}`);
  console.log(`  Format: ${format}`);
  console.log(`  Output: ${outputPath}`);
  console.log();

  const result = exportConversationToFile(file, outputPath, {
    format,
    includeToolResults: withTools,
    includeTimestamps: true,
  });

  if (!result.success) {
    console.error(`\x1b[31mError: ${result.error}\x1b[0m`);
    process.exit(1);
  }

  console.log(`\x1b[32m✓ Exported ${result.messageCount} messages to ${outputPath}\x1b[0m`);
}

async function cmdContext(file?: string) {
  if (!file) {
    // If no file specified, show summary for all conversations
    if (!fs.existsSync(PROJECTS_DIR)) {
      console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
      process.exit(1);
    }

    const files = findAllJsonlFiles(PROJECTS_DIR);
    const estimates = files.map((f) => {
      try {
        return estimateContextSize(f);
      } catch {
        return null;
      }
    }).filter(Boolean) as ReturnType<typeof estimateContextSize>[];

    estimates.sort((a, b) => b.totalTokens - a.totalTokens);

    const totalTokens = estimates.reduce((sum, e) => sum + e.totalTokens, 0);

    console.log("Context Usage Summary\n");
    console.log(`Total conversations: ${estimates.length}`);
    console.log(`Combined tokens: ~${totalTokens.toLocaleString()}\n`);

    console.log("Top 10 by context size:\n");

    for (const estimate of estimates.slice(0, 10)) {
      const relPath = path.relative(PROJECTS_DIR, estimate.file);
      const shortPath = relPath.length > 50 ? "..." + relPath.slice(-47) : relPath;
      console.log(`\x1b[36m${shortPath}\x1b[0m`);
      console.log(`  ~${estimate.totalTokens.toLocaleString()} tokens (${estimate.messageCount} messages)`);
      if (estimate.warnings.length > 0) {
        console.log(`  \x1b[33m⚠ ${estimate.warnings[0]}\x1b[0m`);
      }
      console.log();
    }

    return;
  }

  if (!fs.existsSync(file)) {
    console.error(`File not found: ${file}`);
    process.exit(1);
  }

  const estimate = estimateContextSize(file);
  console.log(formatContextEstimate(estimate));
}

async function cmdAnalytics() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  console.log("Generating analytics...\n");
  const analytics = generateUsageAnalytics(PROJECTS_DIR, 30);
  console.log(formatUsageAnalytics(analytics));
}

async function cmdDuplicates() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  console.log("Scanning for duplicates...\n");
  const report = findDuplicates(PROJECTS_DIR);
  console.log(formatDuplicateReport(report));
}

async function cmdArchive(days: number, dryRun: boolean) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const archiveDays = days > 7 ? days : 30;
  console.log(`Finding conversations inactive for ${archiveDays}+ days...\n`);

  const candidates = findArchiveCandidates(PROJECTS_DIR, { minDaysInactive: archiveDays });

  if (candidates.length === 0) {
    console.log("✓ No conversations eligible for archiving.\n");
    return;
  }

  const result = archiveConversations(PROJECTS_DIR, { minDaysInactive: archiveDays, dryRun });
  console.log(formatArchiveReport(candidates, result, dryRun));

  if (dryRun && candidates.length > 0) {
    console.log("\x1b[33mRun without --dry-run to archive these conversations.\x1b[0m\n");
  }
}

async function cmdMaintenance(auto: boolean, schedule: boolean) {
  if (schedule) {
    console.log("Scheduled Maintenance Setup\n");
    console.log("=== For macOS (launchd) ===");
    console.log("Save this to ~/Library/LaunchAgents/com.claude-code-toolkit.maintenance.plist:\n");
    console.log(generateLaunchdPlist());
    console.log("\nThen run: launchctl load ~/Library/LaunchAgents/com.claude-code-toolkit.maintenance.plist\n");
    console.log("=== For Linux/Unix (cron) ===\n");
    console.log(generateCronSchedule());
    return;
  }

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  console.log("Running maintenance checks...\n");
  const report = runMaintenance(PROJECTS_DIR, { dryRun: !auto });
  console.log(formatMaintenanceReport(report, !auto));

  if (!auto && report.actions.length > 0) {
    console.log("\x1b[33mRun with --auto to perform maintenance actions automatically.\x1b[0m\n");
  }
}

async function cmdClean(dryRun: boolean, days: number, category?: string) {
  const analysis = analyzeClaudeStorage();
  console.log(formatStorageReport(analysis));

  const options = { dryRun: dryRun || true, days, categories: category ? [category] : undefined };
  const targets = findCleanupTargets(undefined, options);

  if (targets.length === 0) {
    console.log("\x1b[32m✓ Nothing to clean.\x1b[0m\n");
    return;
  }

  const result = cleanClaudeDirectory(undefined, { ...options, dryRun });
  console.log(formatCleanupReport(targets, result, dryRun));
}

async function cmdMcpValidate(test?: boolean) {
  const report = await diagnoseMcpServers({ test, projectDir: process.cwd() });
  console.log(formatMcpDiagnosticReport(report));
}

async function cmdSessions(project?: string) {
  const sessions = listSessions(undefined, { project });
  if (sessions.length === 0) {
    console.log("No sessions found.\n");
    return;
  }
  console.log(formatSessionReport(sessions));
}

async function cmdRecover(sessionId?: string, extract?: boolean, repair?: boolean) {
  if (!sessionId) {
    console.error("Usage: cct recover <session-id> [--extract] [--repair]");
    process.exit(1);
  }

  const sessions = listSessions();
  const session = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const diag = diagnoseSession(session.filePath);
  console.log(formatSessionDiagnosticReport(diag));

  if (repair) {
    console.log("\nRepairing session...");
    const result = repairSession(session.filePath);
    if (result.success) {
      console.log(`\x1b[32m✓ Repaired. Removed ${result.linesRemoved} invalid lines.\x1b[0m`);
      if (result.backupPath) console.log(`  Backup: ${result.backupPath}`);
    } else {
      console.log(`\x1b[31m✗ Repair failed: ${result.error}\x1b[0m`);
    }
  }

  if (extract) {
    console.log("\nExtracting session content...");
    const content = extractSessionContent(session.filePath);
    console.log(`  User messages: ${content.userMessages.length}`);
    console.log(`  Assistant messages: ${content.assistantMessages.length}`);
    console.log(`  File edits: ${content.fileEdits.length}`);
    console.log(`  Commands run: ${content.commandsRun.length}`);

    if (content.fileEdits.length > 0) {
      console.log("\nFile edits:");
      for (const edit of content.fileEdits.slice(0, 10)) {
        console.log(`  ${edit.path}`);
      }
    }
    if (content.commandsRun.length > 0) {
      console.log("\nCommands:");
      for (const cmd of content.commandsRun.slice(0, 10)) {
        const short = cmd.length > 80 ? cmd.slice(0, 77) + "..." : cmd;
        console.log(`  $ ${short}`);
      }
    }
  }
}

async function cmdSecurityScan(file?: string) {
  console.log("Scanning for secrets in conversation data...\n");
  const result = scanForSecrets(undefined, { file });
  console.log(formatSecretsScanReport(result));
}

async function cmdPIIScan(file?: string, details?: boolean) {
  console.log("Scanning for Personal Identifiable Information (PII)...\n");
  if (details) {
    console.log("\x1b[33m⚠ WARNING: Showing unmasked PII values. Handle with care!\x1b[0m\n");
  }
  const result = scanForPII(undefined, { file, includeFullValues: details });
  console.log(formatPIIScanReport(result, details));
}

async function cmdAudit(sessionId?: string) {
  if (!sessionId) {
    console.error("Usage: cct audit <session-id>");
    process.exit(1);
  }

  const sessions = listSessions();
  const session = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const audit = auditSession(session.filePath);
  console.log(formatAuditReport(audit));
}

async function cmdRetention(days: number, dryRun: boolean) {
  const retentionDays = days > 7 ? days : 30;
  const result = enforceRetention(undefined, { days: retentionDays, dryRun });
  console.log(formatRetentionReport(result));
}

async function cmdTrace(subcommand?: string, options?: {
  dryRun: boolean; days: number; categories?: string; project?: string;
  confirm: boolean; keepSettings: boolean; mode: string; install: boolean;
}) {
  if (!subcommand) {
    const inv = inventoryTraces(undefined, { project: options?.project });
    console.log(formatTraceInventory(inv));
    return;
  }

  if (subcommand === "clean") {
    const cleanOpts = {
      dryRun: options?.dryRun ?? true,
      days: options?.days,
      categories: options?.categories?.split(","),
      project: options?.project,
    };
    const result = cleanTraces(undefined, cleanOpts);
    console.log(formatTraceCleanReport(result));
    return;
  }

  if (subcommand === "wipe") {
    if (!options?.confirm) {
      console.log("\x1b[31m⚠ This will securely wipe ALL Claude Code traces.\x1b[0m");
      console.log("Run with --confirm to execute.\n");
      const inv = inventoryTraces();
      console.log(`Would wipe: ${inv.totalFiles} files (${formatBytes(inv.totalSize)})`);
      return;
    }
    const result = wipeAllTraces(undefined, {
      confirm: true,
      keepSettings: options.keepSettings,
    });
    console.log(result.wipeReceipt);
    return;
  }

  if (subcommand === "guard") {
    const mode = (options?.mode || "moderate") as "paranoid" | "moderate" | "minimal";
    const config = generateTraceGuardHooks({ mode });
    console.log(formatTraceGuardConfig(config));
    return;
  }

  console.error(`Unknown trace subcommand: ${subcommand}`);
  console.error("Usage: cct trace [clean|wipe|guard]");
}

async function cmdSearch(query?: string, options?: { role?: string; limit?: number; project?: string; days?: number }) {
  if (!query || query.length < 2) {
    console.error("Usage: cct search <query> [--role user|assistant|all] [--limit n] [--project name]");
    console.error("Query must be at least 2 characters.");
    process.exit(1);
  }

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  console.log(`Searching for "${query}"...\n`);

  const searchOpts: SearchOptions = {
    query,
    limit: options?.limit || 50,
    role: (options?.role as "user" | "assistant" | "all") || "all",
    project: options?.project,
    daysBack: options?.days,
  };

  const report = searchConversations(searchOpts);
  console.log(formatSearchReport(report));
}

async function cmdCost() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  console.log("Calculating API cost estimates...\n");

  const files = findAllJsonlFiles(PROJECTS_DIR);
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let sessionCount = 0;

  const projectCosts: Map<string, { input: number; output: number; sessions: number }> = new Map();

  for (const file of files) {
    try {
      const estimate = estimateContextSize(file);
      const projectName = path.basename(path.dirname(file));
      const b = estimate.breakdown;

      const inputTokens = b.userTokens + b.systemTokens + b.toolUseTokens;
      const outputTokens = b.assistantTokens + b.toolResultTokens;

      if (!projectCosts.has(projectName)) {
        projectCosts.set(projectName, { input: 0, output: 0, sessions: 0 });
      }

      const project = projectCosts.get(projectName)!;
      project.input += inputTokens;
      project.output += outputTokens;
      project.sessions++;

      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      sessionCount++;
    } catch {
      // Skip
    }
  }

  const inputCostPerMillion = 15;
  const outputCostPerMillion = 75;

  const totalInputCost = (totalInputTokens / 1_000_000) * inputCostPerMillion;
  const totalOutputCost = (totalOutputTokens / 1_000_000) * outputCostPerMillion;
  const totalCost = totalInputCost + totalOutputCost;

  console.log("API Cost Estimate (Claude Sonnet pricing)\n");
  console.log("═".repeat(50));
  console.log(`Sessions analyzed: ${sessionCount}`);
  console.log(`\nToken Usage:`);
  console.log(`  Input tokens:  ${totalInputTokens.toLocaleString()}`);
  console.log(`  Output tokens: ${totalOutputTokens.toLocaleString()}`);
  console.log(`  Total tokens:  ${(totalInputTokens + totalOutputTokens).toLocaleString()}`);
  console.log(`\nEstimated Cost:`);
  console.log(`  Input:  $${totalInputCost.toFixed(2)} ($${inputCostPerMillion}/M tokens)`);
  console.log(`  Output: $${totalOutputCost.toFixed(2)} ($${outputCostPerMillion}/M tokens)`);
  console.log(`  \x1b[36mTotal:  $${totalCost.toFixed(2)}\x1b[0m\n`);

  const sortedProjects = Array.from(projectCosts.entries())
    .sort((a, b) => (b[1].input + b[1].output) - (a[1].input + a[1].output))
    .slice(0, 10);

  if (sortedProjects.length > 0) {
    console.log("Top Projects by Token Usage:\n");
    for (const [name, data] of sortedProjects) {
      const projectTotal = data.input + data.output;
      const projectCost = ((data.input / 1_000_000) * inputCostPerMillion) + ((data.output / 1_000_000) * outputCostPerMillion);
      console.log(`  ${name}`);
      console.log(`    ${projectTotal.toLocaleString()} tokens (~$${projectCost.toFixed(2)}) - ${data.sessions} session(s)`);
    }
  }

  console.log("\n\x1b[33mNote: These are estimates based on stored conversation history.\x1b[0m");
  console.log("\x1b[33mActual costs depend on your API plan and usage patterns.\x1b[0m\n");
}

async function cmdDiff(sessionId1?: string, sessionId2?: string) {
  if (!sessionId1 || !sessionId2) {
    console.error("Usage: cct diff <session-id-1> <session-id-2>");
    console.error("Example: cct diff abc123 def456");
    process.exit(1);
  }

  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const diff = compareSessionsByCID({ sessionId1, sessionId2 });

  if (!diff) {
    console.error("One or both sessions not found.");
    console.error("Use 'cct sessions' to list available sessions.");
    process.exit(1);
  }

  console.log(formatSessionDiff(diff));
}

async function cmdGit() {
  console.log("Linking sessions to git repositories...\n");
  const report = linkSessionsToGit();
  console.log(formatGitLinkReport(report));
}

async function cmdMcpPerf() {
  console.log("Analyzing MCP tool performance...\n");
  const report = analyzeMcpPerformance();
  console.log(formatMcpPerformanceReport(report));
}

async function cmdAlerts() {
  const report = checkAlerts();
  console.log(formatAlertsReport(report));
}

async function cmdQuotas() {
  const quotas = checkQuotas();
  console.log(formatQuotasReport(quotas));
}

async function cmdRename(sessionId?: string, newName?: string) {
  if (!sessionId || !newName) {
    console.error("Usage: cct rename <session-id> <new-name>");
    console.error("Example: cct rename abc123 'API Refactoring Project'");
    process.exit(1);
  }

  const sessions = listSessions();
  const session = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const result = renameSession(session.id, newName);
  console.log(`\x1b[32m✓ Session renamed to: ${newName}\x1b[0m`);
  console.log(`  Session ID: ${session.id.slice(0, 8)}...`);
  console.log(`  Project: ${session.project}`);
}

async function cmdStar(sessionId?: string, unstar?: boolean) {
  if (!sessionId) {
    console.error("Usage: cct star <session-id> [--unstar]");
    console.error("Example: cct star abc123");
    process.exit(1);
  }

  const sessions = listSessions();
  const session = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const result = starSession(session.id, !unstar);
  if (unstar) {
    console.log(`\x1b[33m✗ Session unstarred\x1b[0m`);
  } else {
    console.log(`\x1b[32m⭐ Session starred\x1b[0m`);
  }
  console.log(`  Session ID: ${session.id.slice(0, 8)}...`);
  console.log(`  Project: ${session.project}`);
}

async function cmdTag(sessionId?: string, tagsInput?: string) {
  if (!sessionId || !tagsInput) {
    console.error("Usage: cct tag <session-id> <tags>");
    console.error("Example: cct tag abc123 'important,api,refactor'");
    process.exit(1);
  }

  const sessions = listSessions();
  const session = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const tags = tagsInput.split(",").map(t => t.trim()).filter(Boolean);
  for (const tag of tags) {
    addTagToSession(session.id, tag);
  }

  console.log(`\x1b[32m✓ Tags added: ${tags.map(t => '#' + t).join(', ')}\x1b[0m`);
  console.log(`  Session ID: ${session.id.slice(0, 8)}...`);
  console.log(`  Project: ${session.project}`);
}

async function cmdBookmarks() {
  const summary = getBookmarksSummary();
  console.log(formatBookmarkReport(summary));

  const allTags = getAllTags();
  if (allTags.length > 0) {
    console.log("\nAll Tags:");
    for (const { tag, count } of allTags) {
      console.log(`  #${tag} (${count} session${count === 1 ? '' : 's'})`);
    }
  }
}

async function cmdStarred() {
  const starred = getStarredSessions();

  if (starred.length === 0) {
    console.log("No starred sessions found.");
    console.log("Use 'cct star <session-id>' to star a session.");
    return;
  }

  console.log(`Starred Sessions (${starred.length})\n`);

  const sessions = listSessions();
  for (const tag of starred) {
    const session = sessions.find(s => s.id === tag.sessionId || s.id.startsWith(tag.sessionId));
    const name = tag.name || (session ? session.project : tag.sessionId.slice(0, 8));
    const tags = tag.tags.length > 0 ? ` [${tag.tags.map(t => '#' + t).join(' ')}]` : '';

    console.log(`⭐ ${name}${tags}`);
    console.log(`   ID: ${tag.sessionId.slice(0, 8)}...`);
    if (session) {
      console.log(`   Messages: ${session.messageCount}, Size: ${formatBytes(session.sizeBytes)}`);
    }
    console.log();
  }
}

async function cmdExportHtml(sessionId?: string, output?: string, theme?: string) {
  if (!sessionId) {
    console.error("Usage: cct export-html <session-id> [--output <path>] [--theme light|dark]");
    console.error("Example: cct export-html abc123 --output ./export.html --theme dark");
    process.exit(1);
  }

  const sessions = listSessions();
  const session = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));

  if (!session) {
    console.error(`Session not found: ${sessionId}`);
    process.exit(1);
  }

  const outputPath = output || session.filePath.replace(".jsonl", ".html");

  console.log("Exporting to HTML...");
  console.log(`  Source: ${session.filePath}`);
  console.log(`  Output: ${outputPath}`);
  console.log(`  Theme: ${theme || 'light'}`);
  console.log();

  const result = exportToHtml(session.filePath, outputPath, {
    theme: (theme === "dark" ? "dark" : "light"),
    includeTimestamps: true,
    syntaxHighlighting: true,
  });

  console.log(`\x1b[32m✓ Exported ${result.messageCount} messages\x1b[0m`);
  console.log(`  File: ${result.file}`);
  console.log(`  Size: ${formatBytes(result.size)}`);
}

async function cmdBulkExport(projectFilter?: string, format?: string, outputDir?: string) {
  console.log("Bulk Export\n");

  const result = bulkExportSessions({
    projectFilter,
    format: (format as "html" | "markdown" | "json") || "html",
    outputDir,
  });

  console.log(formatBulkOperationReport("export", result));
}

async function cmdBulkDelete(days: number, projectFilter?: string, dryRun?: boolean) {
  console.log(`Bulk Delete${dryRun ? ' (Dry Run)' : ''}\n`);

  const result = bulkDelete({
    olderThanDays: days > 0 ? days : undefined,
    projectFilter,
    dryRun: dryRun !== false,
    includeStarred: false,
  });

  console.log(formatBulkOperationReport("delete", result));

  if (result.dryRun && result.deleted.length > 0) {
    console.log("\n\x1b[33mRun without --dry-run to delete these sessions.\x1b[0m");
    console.log("\x1b[33mNote: Starred sessions are protected and won't be deleted.\x1b[0m");
  }
}

async function cmdBulkArchive(days: number, projectFilter?: string, dryRun?: boolean) {
  console.log(`Bulk Archive${dryRun ? ' (Dry Run)' : ''}\n`);

  const result = bulkArchiveSessions({
    olderThanDays: days > 0 ? days : undefined,
    projectFilter,
    dryRun: dryRun !== false,
    includeStarred: false,
  });

  console.log(formatBulkOperationReport("archive", result));

  if (result.dryRun && result.archived.length > 0) {
    console.log("\n\x1b[33mRun without --dry-run to archive these sessions.\x1b[0m");
    console.log("\x1b[33mNote: Starred sessions are protected and won't be archived.\x1b[0m");
  }
}

async function cmdHealth() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const files = findAllJsonlFiles(PROJECTS_DIR);
  const backups = findBackupFiles(PROJECTS_DIR);

  let issueCount = 0;
  let totalSize = 0;
  let largestFile = { path: "", size: 0 };

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      totalSize += stat.size;
      if (stat.size > largestFile.size) {
        largestFile = { path: file, size: stat.size };
      }

      const scanResult = scanFile(file);
      issueCount += scanResult.issues.length;
    } catch {
      // Skip
    }
  }

  const status = issueCount === 0 ? "\x1b[32m✓ Healthy\x1b[0m" : "\x1b[33m⚠ Issues Found\x1b[0m";

  console.log(`Health Check: ${status}\n`);
  console.log(`Conversations: ${files.length}`);
  console.log(`Total size: ${formatBytes(totalSize)}`);
  console.log(`Backups: ${backups.length}`);
  console.log(`Oversized content: ${issueCount}`);

  if (largestFile.path) {
    console.log(`\nLargest: ${path.relative(PROJECTS_DIR, largestFile.path)}`);
    console.log(`  Size: ${formatBytes(largestFile.size)}`);
  }

  if (issueCount > 0) {
    console.log(`\n\x1b[33mRecommendation: Run 'cct fix' to fix ${issueCount} issue(s)\x1b[0m`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let commandResult: unknown;

  if (!args.command) {
    printHelp();
    process.exit(0);
  }

  switch (args.command) {
    case "scan":
      commandResult = await cmdScan(args.file, args.json);
      break;
    case "fix":
      await cmdFix(args.file, args.noBackup);
      break;
    case "stats":
      await cmdStats(args.limit, args.sort);
      break;
    case "context":
      await cmdContext(args.file);
      break;
    case "analytics":
      await cmdAnalytics();
      break;
    case "duplicates":
      await cmdDuplicates();
      break;
    case "archive":
      await cmdArchive(args.days, args.dryRun);
      break;
    case "maintenance":
      await cmdMaintenance(args.auto, args.schedule);
      break;
    case "export":
      await cmdExport(args.file, args.output, args.format, args.withTools);
      break;
    case "backups":
      await cmdBackups();
      break;
    case "restore":
      await cmdRestore(args.file!);
      break;
    case "cleanup":
      await cmdCleanup(args.days, args.dryRun);
      break;
    case "health":
      await cmdHealth();
      break;
    case "search":
      await cmdSearch(args.query, { role: args.role, limit: args.limit, project: args.project, days: args.days });
      break;
    case "cost":
      await cmdCost();
      break;
    case "clean":
      await cmdClean(args.dryRun, args.days, args.category);
      break;
    case "mcp-validate":
      await cmdMcpValidate(args.test);
      break;
    case "mcp-perf":
      await cmdMcpPerf();
      break;
    case "sessions":
      await cmdSessions(args.project);
      break;
    case "diff":
      await cmdDiff(args.file, args.subcommand);
      break;
    case "git":
      await cmdGit();
      break;
    case "recover":
      await cmdRecover(args.file, args.extract, args.repair);
      break;
    case "security-scan":
      await cmdSecurityScan(args.file);
      break;
    case "pii-scan":
      await cmdPIIScan(args.file, args.details);
      break;
    case "audit":
      await cmdAudit(args.file);
      break;
    case "retention":
      await cmdRetention(args.days, args.dryRun);
      break;
    case "alerts":
      await cmdAlerts();
      break;
    case "quotas":
      await cmdQuotas();
      break;
    case "trace":
      await cmdTrace(args.subcommand, {
        dryRun: args.dryRun,
        days: args.days,
        categories: args.categories,
        project: args.project,
        confirm: args.confirm,
        keepSettings: args.keepSettings,
        mode: args.mode,
        install: args.install,
      });
      break;
    case "watch":
      await cmdWatch(args.json, args.interval, args.autoFix);
      break;
    case "dashboard":
      if (args.stop) {
        const stopped = stopDashboard();
        if (stopped) {
          console.log("\x1b[32m✓ Dashboard stopped.\x1b[0m");
        } else {
          const status = isDashboardRunning();
          if (!status.running) {
            console.log("No dashboard process found.");
          } else {
            console.error("Failed to stop dashboard.");
          }
        }
      } else {
        await startDashboard({ port: args.port, daemon: args.daemon, authToken: args.token });
      }
      break;
    case "rename":
      await cmdRename(args.file, args.name);
      break;
    case "star":
      await cmdStar(args.file, args.unstar);
      break;
    case "tag":
      await cmdTag(args.file, args.tags);
      break;
    case "bookmarks":
      await cmdBookmarks();
      break;
    case "starred":
      await cmdStarred();
      break;
    case "export-html":
      await cmdExportHtml(args.file, args.output, args.theme);
      break;
    case "bulk-export":
      await cmdBulkExport(args.project, args.format, args.output);
      break;
    case "bulk-delete":
      await cmdBulkDelete(args.days, args.project, args.dryRun);
      break;
    case "bulk-archive":
      await cmdBulkArchive(args.days, args.project, args.dryRun);
      break;
    default:
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      process.exit(1);
  }

  if (args.json && commandResult !== undefined) {
    console.log(JSON.stringify(commandResult, null, 2));
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
