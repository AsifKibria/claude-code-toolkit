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
  type IssueType,
} from "./lib/scanner.js";

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
Claude Code Toolkit v1.0.2
Maintain, optimize, and troubleshoot your Claude Code installation.
Fixes oversized images, PDFs, documents, and large text content.

USAGE:
  cct <command> [options]
  claude-code-toolkit <command> [options]

COMMANDS:
  health            Quick health check (start here!)
  stats             Show conversation statistics
  scan              Scan for issues (dry run)
  fix               Fix all detected issues
  backups           List backup files
  restore <path>    Restore from a backup file
  cleanup           Delete old backup files

OPTIONS:
  -f, --file <path>     Target a specific file
  -d, --dry-run         Show what would be done without making changes
  --no-backup           Skip creating backups when fixing (not recommended)
  --days <n>            For cleanup: delete backups older than n days (default: 7)
  --limit <n>           For stats: limit results (default: 10)
  --sort <field>        For stats: sort by size|messages|images|modified
  -h, --help            Show this help message
  -v, --version         Show version

EXAMPLES:
  cct health                        # Quick health check
  cct stats --limit 5 --sort size   # Top 5 largest conversations
  cct scan                          # Scan for issues
  cct fix                           # Fix all issues
  cct fix -f /path/to/file          # Fix specific file
  cct cleanup --days 30 --dry-run   # Preview old backups to delete
  cct cleanup --days 30             # Delete old backups

For more info: https://github.com/asifkibria/claude-code-toolkit
`);
}

function parseArgs(args: string[]): {
  command: string;
  file?: string;
  dryRun: boolean;
  noBackup: boolean;
  days: number;
  limit: number;
  sort: string;
} {
  const result = {
    command: "",
    file: undefined as string | undefined,
    dryRun: false,
    noBackup: false,
    days: 7,
    limit: 10,
    sort: "size",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-h" || arg === "--help") {
      printHelp();
      process.exit(0);
    }

    if (arg === "-v" || arg === "--version") {
      console.log("1.0.2");
      process.exit(0);
    }

    if (arg === "-f" || arg === "--file") {
      result.file = args[++i];
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

    if (!arg.startsWith("-") && !result.command) {
      result.command = arg;
      continue;
    }

    if (!arg.startsWith("-") && result.command === "restore") {
      result.file = arg;
    }
  }

  return result;
}

async function cmdScan(file?: string) {
  if (!fs.existsSync(PROJECTS_DIR)) {
    console.error(`Claude projects directory not found: ${PROJECTS_DIR}`);
    process.exit(1);
  }

  const files = file ? [file] : findAllJsonlFiles(PROJECTS_DIR);
  console.log(`Scanning ${files.length} file(s)...\n`);

  let totalIssues = 0;
  let filesWithIssues = 0;

  for (const f of files) {
    try {
      const result = scanFile(f);
      if (result.issues.length > 0) {
        filesWithIssues++;
        totalIssues += result.issues.length;
        const relPath = path.relative(PROJECTS_DIR, f);
        console.log(`\x1b[33m${relPath}\x1b[0m`);
        for (const issue of result.issues) {
          console.log(`  Line ${issue.line}: ${formatContentType(issue.contentType)} (~${formatBytes(issue.estimatedSize)})`);
        }
      }
    } catch {
      // Skip
    }
  }

  console.log();
  if (totalIssues === 0) {
    console.log("\x1b[32m✓ No oversized content found.\x1b[0m");
  } else {
    console.log(`\x1b[33mFound ${totalIssues} issue(s) in ${filesWithIssues} file(s).\x1b[0m`);
    console.log("Run 'cct fix' to fix them.");
  }
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

  if (!args.command) {
    printHelp();
    process.exit(0);
  }

  switch (args.command) {
    case "scan":
      await cmdScan(args.file);
      break;
    case "fix":
      await cmdFix(args.file, args.noBackup);
      break;
    case "stats":
      await cmdStats(args.limit, args.sort);
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
    default:
      console.error(`Unknown command: ${args.command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
