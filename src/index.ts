#!/usr/bin/env node
/**
 * MCP Server: Claude Code Toolkit
 * Fixes oversized content (images, PDFs, documents) that poison conversation context.
 * See: https://github.com/anthropics/claude-code/issues/2939
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
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
  exportConversation,
  estimateContextSize,
  generateUsageAnalytics,
  findDuplicates,
  findArchiveCandidates,
  archiveConversations,
  runMaintenance,
  type ScanResult,
  type FixResult,
  type ConversationStats,
  type ExportFormat,
  type ContextEstimate,
  type UsageAnalytics,
  type DuplicateReport,
  type ArchiveCandidate,
  type MaintenanceReport,
} from "./lib/scanner.js";

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

function formatContentType(type: string): string {
  switch (type) {
    case "image": return "🖼️ Image";
    case "pdf": return "📄 PDF";
    case "document": return "📎 Document";
    case "large_text": return "📝 Large text";
    default: return "❓ Unknown";
  }
}

const server = new Server(
  {
    name: "claude-code-toolkit",
    version: "1.0.7",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "scan_image_issues",
        description:
          "Scan all Claude Code conversation files for oversized images that cause API errors. Returns detailed report of issues found without making changes.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Optional: Scan only a specific file or directory. Defaults to all Claude projects.",
            },
          },
        },
      },
      {
        name: "fix_image_issues",
        description:
          "Fix oversized images in Claude Code conversations by replacing them with placeholder text. Creates backups before changes.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Optional: Fix only a specific file. Defaults to all files with issues.",
            },
            no_backup: {
              type: "boolean",
              description: "Skip creating backup files (not recommended). Default: false",
            },
          },
        },
      },
      {
        name: "get_conversation_stats",
        description:
          "Get detailed statistics about Claude Code conversations including message counts, tool usage, image counts, and file sizes.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Optional: Get stats for a specific file. Defaults to summary of all conversations.",
            },
            sort_by: {
              type: "string",
              enum: ["size", "messages", "images", "modified"],
              description: "Sort results by: size, messages, images, or modified date. Default: size",
            },
            limit: {
              type: "number",
              description: "Limit number of results. Default: 10",
            },
          },
        },
      },
      {
        name: "list_backups",
        description: "List all backup files created by the image fixer, with size and date information.",
        inputSchema: {
          type: "object" as const,
          properties: {
            sort_by: {
              type: "string",
              enum: ["date", "size"],
              description: "Sort by: date or size. Default: date",
            },
          },
        },
      },
      {
        name: "restore_backup",
        description: "Restore a conversation file from a backup.",
        inputSchema: {
          type: "object" as const,
          properties: {
            backup_path: {
              type: "string",
              description: "The full path to the backup file to restore",
            },
          },
          required: ["backup_path"],
        },
      },
      {
        name: "cleanup_backups",
        description: "Delete old backup files to free up disk space.",
        inputSchema: {
          type: "object" as const,
          properties: {
            older_than_days: {
              type: "number",
              description: "Delete backups older than this many days. Default: 7",
            },
            dry_run: {
              type: "boolean",
              description: "Show what would be deleted without actually deleting. Default: true",
            },
          },
        },
      },
      {
        name: "health_check",
        description:
          "Quick health check of Claude Code conversations. Reports total issues, largest files, and recommendations.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "export_conversation",
        description:
          "Export a Claude Code conversation to markdown or JSON format for backup or sharing.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "The path to the conversation file to export (required)",
            },
            format: {
              type: "string",
              enum: ["markdown", "json"],
              description: "Export format: markdown or json. Default: markdown",
            },
            include_tool_results: {
              type: "boolean",
              description: "Include tool results in the export. Default: false",
            },
          },
          required: ["path"],
        },
      },
      {
        name: "estimate_context_size",
        description:
          "Estimate the context/token usage of a Claude Code conversation. Shows breakdown by message type, images, documents, and tool usage.",
        inputSchema: {
          type: "object" as const,
          properties: {
            path: {
              type: "string",
              description: "Path to a specific conversation file. If omitted, shows summary of all conversations sorted by context size.",
            },
          },
        },
      },
      {
        name: "usage_analytics",
        description:
          "Generate a usage analytics dashboard showing conversation statistics, activity trends, top projects, tool usage breakdown, and media stats.",
        inputSchema: {
          type: "object" as const,
          properties: {
            days: {
              type: "number",
              description: "Number of days to include in the analysis. Default: 30",
            },
          },
        },
      },
      {
        name: "find_duplicates",
        description:
          "Scan for duplicate content across Claude Code conversations. Finds duplicate conversations, images, and documents that waste storage and context space.",
        inputSchema: {
          type: "object" as const,
          properties: {},
        },
      },
      {
        name: "archive_conversations",
        description:
          "Archive old/inactive conversations to free up space. Moves conversations that haven't been modified in a specified number of days to an archive directory.",
        inputSchema: {
          type: "object" as const,
          properties: {
            days: {
              type: "number",
              description: "Archive conversations inactive for this many days. Default: 30",
            },
            dry_run: {
              type: "boolean",
              description: "Preview what would be archived without making changes. Default: true",
            },
          },
        },
      },
      {
        name: "run_maintenance",
        description:
          "Run maintenance checks on Claude Code installation. Identifies issues, old backups, and archive candidates. Can optionally perform fixes automatically.",
        inputSchema: {
          type: "object" as const,
          properties: {
            auto: {
              type: "boolean",
              description: "Automatically perform maintenance actions. Default: false (dry run)",
            },
          },
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const typedArgs = (args || {}) as Record<string, unknown>;

  try {
    switch (name) {
      case "scan_image_issues": {
        const targetPath = typedArgs.path as string | undefined;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        let files: string[];
        if (targetPath) {
          if (fs.statSync(targetPath).isDirectory()) {
            files = findAllJsonlFiles(targetPath);
          } else {
            files = [targetPath];
          }
        } else {
          files = findAllJsonlFiles(PROJECTS_DIR);
        }

        const results: ScanResult[] = [];
        let totalIssues = 0;

        for (const file of files) {
          try {
            const result = scanFile(file);
            if (result.issues.length > 0) {
              results.push(result);
              totalIssues += result.issues.length;
            }
          } catch (e) {
            // Skip files that can't be read
          }
        }

        if (results.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `✅ Scanned ${files.length} file(s). No oversized content found.`,
              },
            ],
          };
        }

        let output = `🔍 **Scan Results**\n\n`;
        output += `Found **${totalIssues}** issue(s) in **${results.length}** file(s)\n\n`;

        for (const result of results) {
          const relPath = path.relative(PROJECTS_DIR, result.file);
          output += `### ${relPath}\n`;
          for (const issue of result.issues) {
            const sizeStr = formatBytes(issue.estimatedSize);
            const typeStr = formatContentType(issue.contentType);
            output += `- Line ${issue.line}: ${typeStr} (~${sizeStr})\n`;
          }
          output += "\n";
        }

        output += `\n💡 Run \`fix_image_issues\` to fix these issues.`;

        return { content: [{ type: "text", text: output }] };
      }

      case "fix_image_issues": {
        const targetPath = typedArgs.path as string | undefined;
        const noBackup = typedArgs.no_backup as boolean | undefined;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        let files: string[];
        if (targetPath) {
          if (!fs.existsSync(targetPath)) {
            return { content: [{ type: "text", text: `File not found: ${targetPath}` }] };
          }
          files = [targetPath];
        } else {
          files = findAllJsonlFiles(PROJECTS_DIR);
        }

        const results: FixResult[] = [];
        let totalFixed = 0;

        for (const file of files) {
          try {
            const result = fixFile(file, !noBackup);
            if (result.fixed) {
              results.push(result);
              totalFixed += result.issues.length;
            }
          } catch (e) {
            // Skip files that can't be processed
          }
        }

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: `✅ No issues to fix in ${files.length} file(s).` }],
          };
        }

        let output = `🔧 **Fix Results**\n\n`;
        output += `Fixed **${totalFixed}** issue(s) in **${results.length}** file(s)\n\n`;

        for (const result of results) {
          const relPath = path.relative(PROJECTS_DIR, result.file);
          output += `### ${relPath}\n`;
          for (const issue of result.issues) {
            const typeStr = formatContentType(issue.contentType);
            output += `- ${typeStr} removed\n`;
          }
          if (result.backupPath) {
            output += `- Backup: \`${path.basename(result.backupPath)}\`\n`;
          }
          output += "\n";
        }

        output += `\n✅ All issues fixed. Restart Claude Code to apply changes.`;

        return { content: [{ type: "text", text: output }] };
      }

      case "get_conversation_stats": {
        const targetPath = typedArgs.path as string | undefined;
        const sortBy = (typedArgs.sort_by as string) || "size";
        const limit = (typedArgs.limit as number) || 10;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        let files: string[];
        if (targetPath) {
          files = [targetPath];
        } else {
          files = findAllJsonlFiles(PROJECTS_DIR);
        }

        const allStats: ConversationStats[] = [];

        for (const file of files) {
          try {
            const stats = getConversationStats(file);
            allStats.push(stats);
          } catch {
            // Skip
          }
        }

        // Sort
        allStats.sort((a, b) => {
          switch (sortBy) {
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

        const displayed = allStats.slice(0, limit);

        // Summary
        const totalSize = allStats.reduce((sum, s) => sum + s.fileSizeBytes, 0);
        const totalMessages = allStats.reduce((sum, s) => sum + s.totalMessages, 0);
        const totalImages = allStats.reduce((sum, s) => sum + s.imageCount, 0);
        const totalDocs = allStats.reduce((sum, s) => sum + s.documentCount, 0);
        const totalProblematic = allStats.reduce((sum, s) => sum + s.problematicContent, 0);

        let output = `📊 **Conversation Statistics**\n\n`;
        output += `**Summary** (${allStats.length} conversations)\n`;
        output += `- Total size: ${formatBytes(totalSize)}\n`;
        output += `- Total messages: ${totalMessages.toLocaleString()}\n`;
        output += `- Images: ${totalImages}, Documents: ${totalDocs}\n`;
        output += `- Problematic content: ${totalProblematic}\n\n`;

        output += `**Top ${displayed.length} by ${sortBy}:**\n\n`;

        for (const stats of displayed) {
          const relPath = path.relative(PROJECTS_DIR, stats.file);
          const shortPath = relPath.length > 50 ? "..." + relPath.slice(-47) : relPath;
          output += `### ${shortPath}\n`;
          output += `- Size: ${formatBytes(stats.fileSizeBytes)}\n`;
          output += `- Messages: ${stats.totalMessages} (${stats.userMessages} user, ${stats.assistantMessages} assistant)\n`;
          output += `- Tool uses: ${stats.toolUses}\n`;
          output += `- Media: ${stats.imageCount} images, ${stats.documentCount} docs${stats.problematicContent > 0 ? ` (⚠️ ${stats.problematicContent} oversized)` : ""}\n`;
          output += `- Modified: ${formatDate(stats.lastModified)}\n\n`;
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "list_backups": {
        const sortBy = (typedArgs.sort_by as string) || "date";

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        const backups = findBackupFiles(PROJECTS_DIR);

        if (backups.length === 0) {
          return { content: [{ type: "text", text: "No backup files found." }] };
        }

        const backupInfo = backups.map((b) => {
          try {
            const stat = fs.statSync(b);
            return { path: b, size: stat.size, mtime: stat.mtime };
          } catch {
            return { path: b, size: 0, mtime: new Date(0) };
          }
        });

        backupInfo.sort((a, b) => {
          if (sortBy === "size") return b.size - a.size;
          return b.mtime.getTime() - a.mtime.getTime();
        });

        const totalSize = backupInfo.reduce((sum, b) => sum + b.size, 0);

        let output = `📦 **Backup Files**\n\n`;
        output += `Found ${backups.length} backup(s), total size: ${formatBytes(totalSize)}\n\n`;

        for (const backup of backupInfo) {
          const relPath = path.relative(PROJECTS_DIR, backup.path);
          output += `- \`${relPath}\`\n`;
          output += `  Size: ${formatBytes(backup.size)}, Created: ${formatDate(backup.mtime)}\n`;
        }

        output += `\n💡 Use \`restore_backup\` to restore or \`cleanup_backups\` to delete old ones.`;

        return { content: [{ type: "text", text: output }] };
      }

      case "restore_backup": {
        const backupPath = typedArgs.backup_path as string;

        const result = restoreFromBackup(backupPath);

        if (!result.success) {
          return { content: [{ type: "text", text: `❌ Error: ${result.error}` }] };
        }

        return {
          content: [
            {
              type: "text",
              text: `✅ Restored \`${result.originalPath}\` from backup.\n\nRestart Claude Code to apply changes.`,
            },
          ],
        };
      }

      case "cleanup_backups": {
        const olderThanDays = (typedArgs.older_than_days as number) || 7;
        const dryRun = typedArgs.dry_run !== false;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        if (dryRun) {
          const backups = findBackupFiles(PROJECTS_DIR);
          const cutoffDate = new Date();
          cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

          const toDelete: { path: string; size: number }[] = [];

          for (const backup of backups) {
            try {
              const stat = fs.statSync(backup);
              if (stat.mtime < cutoffDate) {
                toDelete.push({ path: backup, size: stat.size });
              }
            } catch {
              // Skip
            }
          }

          if (toDelete.length === 0) {
            return {
              content: [
                { type: "text", text: `No backups older than ${olderThanDays} days found.` },
              ],
            };
          }

          const totalSize = toDelete.reduce((sum, b) => sum + b.size, 0);

          let output = `🔍 **Dry Run - Would delete ${toDelete.length} backup(s)**\n\n`;
          output += `Total space to free: ${formatBytes(totalSize)}\n\n`;

          for (const backup of toDelete) {
            const relPath = path.relative(PROJECTS_DIR, backup.path);
            output += `- \`${relPath}\` (${formatBytes(backup.size)})\n`;
          }

          output += `\n💡 Run with \`dry_run: false\` to actually delete.`;

          return { content: [{ type: "text", text: output }] };
        }

        const result = deleteOldBackups(PROJECTS_DIR, olderThanDays);

        if (result.deleted.length === 0) {
          return {
            content: [{ type: "text", text: `No backups older than ${olderThanDays} days found.` }],
          };
        }

        let output = `🗑️ **Deleted ${result.deleted.length} backup(s)**\n\n`;

        for (const deleted of result.deleted) {
          const relPath = path.relative(PROJECTS_DIR, deleted);
          output += `- \`${relPath}\`\n`;
        }

        if (result.errors.length > 0) {
          output += `\n⚠️ Errors:\n`;
          for (const error of result.errors) {
            output += `- ${error}\n`;
          }
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "health_check": {
        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        const files = findAllJsonlFiles(PROJECTS_DIR);
        const backups = findBackupFiles(PROJECTS_DIR);

        let issueCount = 0;
        let totalSize = 0;
        let largestFile = { path: "", size: 0 };
        const filesWithIssues: string[] = [];
        const issueTypes: Record<string, number> = {};

        for (const file of files) {
          try {
            const stat = fs.statSync(file);
            totalSize += stat.size;
            if (stat.size > largestFile.size) {
              largestFile = { path: file, size: stat.size };
            }

            const scanResult = scanFile(file);
            if (scanResult.issues.length > 0) {
              issueCount += scanResult.issues.length;
              filesWithIssues.push(file);
              for (const issue of scanResult.issues) {
                issueTypes[issue.contentType] = (issueTypes[issue.contentType] || 0) + 1;
              }
            }
          } catch {
            // Skip
          }
        }

        let status = "✅ Healthy";
        const recommendations: string[] = [];

        if (issueCount > 0) {
          status = "⚠️ Issues Found";
          const typeBreakdown = Object.entries(issueTypes)
            .map(([type, count]) => `${count} ${type}`)
            .join(", ");
          recommendations.push(`Run \`fix_image_issues\` to fix ${issueCount} issue(s) (${typeBreakdown})`);
        }

        if (largestFile.size > 50 * 1024 * 1024) {
          recommendations.push(
            `Large conversation file detected (${formatBytes(largestFile.size)}). Consider using /compact`
          );
        }

        if (backups.length > 20) {
          recommendations.push(`${backups.length} backup files found. Run \`cleanup_backups\` to free space`);
        }

        let output = `🏥 **Health Check: ${status}**\n\n`;
        output += `**Overview**\n`;
        output += `- Conversation files: ${files.length}\n`;
        output += `- Total size: ${formatBytes(totalSize)}\n`;
        output += `- Backup files: ${backups.length}\n`;
        output += `- Problematic content: ${issueCount}\n`;
        output += `- Files with issues: ${filesWithIssues.length}\n\n`;

        if (largestFile.path) {
          output += `**Largest conversation**\n`;
          output += `- ${path.relative(PROJECTS_DIR, largestFile.path)}\n`;
          output += `- Size: ${formatBytes(largestFile.size)}\n\n`;
        }

        if (recommendations.length > 0) {
          output += `**Recommendations**\n`;
          for (const rec of recommendations) {
            output += `- ${rec}\n`;
          }
        } else {
          output += `No issues detected. Your Claude Code installation is healthy!`;
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "export_conversation": {
        const targetPath = typedArgs.path as string;
        const format = (typedArgs.format as ExportFormat) || "markdown";
        const includeToolResults = typedArgs.include_tool_results as boolean || false;

        if (!targetPath) {
          return {
            content: [{ type: "text", text: "Error: path is required. Please specify the conversation file to export." }],
            isError: true,
          };
        }

        if (!fs.existsSync(targetPath)) {
          return {
            content: [{ type: "text", text: `Error: File not found: ${targetPath}` }],
            isError: true,
          };
        }

        try {
          const result = exportConversation(targetPath, {
            format,
            includeToolResults,
            includeTimestamps: true,
          });

          let output = `📤 **Conversation Exported**\n\n`;
          output += `- Source: \`${path.relative(PROJECTS_DIR, targetPath)}\`\n`;
          output += `- Format: ${format}\n`;
          output += `- Messages: ${result.messageCount}\n\n`;
          output += `---\n\n`;
          output += result.content;

          return { content: [{ type: "text", text: output }] };
        } catch (e) {
          return {
            content: [{ type: "text", text: `Error exporting conversation: ${e instanceof Error ? e.message : String(e)}` }],
            isError: true,
          };
        }
      }

      case "estimate_context_size": {
        const targetPath = typedArgs.path as string | undefined;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        if (targetPath) {
          if (!fs.existsSync(targetPath)) {
            return {
              content: [{ type: "text", text: `Error: File not found: ${targetPath}` }],
              isError: true,
            };
          }

          const estimate = estimateContextSize(targetPath);
          const b = estimate.breakdown;

          let output = `📏 **Context Size Estimate**\n\n`;
          output += `**File:** \`${path.relative(PROJECTS_DIR, targetPath)}\`\n\n`;
          output += `**Total:** ~${estimate.totalTokens.toLocaleString()} tokens\n`;
          output += `**Messages:** ${estimate.messageCount}\n\n`;

          output += `**Breakdown:**\n`;
          output += `| Category | Tokens |\n`;
          output += `|----------|--------|\n`;
          output += `| User messages | ${b.userTokens.toLocaleString()} |\n`;
          output += `| Assistant messages | ${b.assistantTokens.toLocaleString()} |\n`;
          if (b.systemTokens > 0) {
            output += `| System messages | ${b.systemTokens.toLocaleString()} |\n`;
          }
          output += `| Tool calls | ${b.toolUseTokens.toLocaleString()} |\n`;
          output += `| Tool results | ${b.toolResultTokens.toLocaleString()} |\n`;
          if (b.imageTokens > 0) {
            output += `| Images | ${b.imageTokens.toLocaleString()} |\n`;
          }
          if (b.documentTokens > 0) {
            output += `| Documents | ${b.documentTokens.toLocaleString()} |\n`;
          }

          if (estimate.largestMessage) {
            output += `\n**Largest message:** Line ${estimate.largestMessage.line} (${estimate.largestMessage.role})\n`;
            output += `~${estimate.largestMessage.tokens.toLocaleString()} tokens\n`;
          }

          if (estimate.warnings.length > 0) {
            output += `\n**Warnings:**\n`;
            for (const warning of estimate.warnings) {
              output += `- ⚠️ ${warning}\n`;
            }
          }

          return { content: [{ type: "text", text: output }] };
        }

        // Summary of all conversations
        const files = findAllJsonlFiles(PROJECTS_DIR);
        const estimates: ContextEstimate[] = [];

        for (const file of files) {
          try {
            estimates.push(estimateContextSize(file));
          } catch {
            // Skip
          }
        }

        estimates.sort((a, b) => b.totalTokens - a.totalTokens);

        const totalTokens = estimates.reduce((sum, e) => sum + e.totalTokens, 0);
        const displayed = estimates.slice(0, 10);

        let output = `📏 **Context Usage Summary**\n\n`;
        output += `**Total conversations:** ${estimates.length}\n`;
        output += `**Combined tokens:** ~${totalTokens.toLocaleString()}\n\n`;

        output += `**Top 10 by context size:**\n\n`;

        for (const estimate of displayed) {
          const relPath = path.relative(PROJECTS_DIR, estimate.file);
          const shortPath = relPath.length > 45 ? "..." + relPath.slice(-42) : relPath;
          output += `### ${shortPath}\n`;
          output += `- ~${estimate.totalTokens.toLocaleString()} tokens (${estimate.messageCount} messages)\n`;
          if (estimate.warnings.length > 0) {
            output += `- ⚠️ ${estimate.warnings[0]}\n`;
          }
          output += `\n`;
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "usage_analytics": {
        const days = (typedArgs.days as number) || 30;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        const analytics = generateUsageAnalytics(PROJECTS_DIR, days);
        const o = analytics.overview;

        let output = `📊 **Usage Analytics Dashboard**\n\n`;

        output += `## Overview\n`;
        output += `| Metric | Value |\n`;
        output += `|--------|-------|\n`;
        output += `| Conversations | ${o.totalConversations.toLocaleString()} |\n`;
        output += `| Total Messages | ${o.totalMessages.toLocaleString()} |\n`;
        output += `| Total Tokens | ~${o.totalTokens.toLocaleString()} |\n`;
        output += `| Total Size | ${formatBytes(o.totalSize)} |\n`;
        output += `| Active Projects | ${o.activeProjects} |\n`;
        output += `| Avg Messages/Conv | ${o.avgMessagesPerConversation} |\n`;
        output += `| Avg Tokens/Conv | ~${o.avgTokensPerConversation.toLocaleString()} |\n`;
        output += `\n`;

        // Activity (last 7 days)
        const last7Days = analytics.dailyActivity.slice(-7);
        output += `## Activity (Last 7 days)\n`;
        output += `| Day | Messages |\n`;
        output += `|-----|----------|\n`;
        for (const day of last7Days) {
          const dayName = new Date(day.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
          output += `| ${dayName} | ${day.messages} |\n`;
        }
        output += `\n`;

        // Top projects
        if (analytics.topProjects.length > 0) {
          output += `## Top Projects\n`;
          output += `| Project | Messages | Tokens |\n`;
          output += `|---------|----------|--------|\n`;
          for (const proj of analytics.topProjects.slice(0, 5)) {
            const shortName = proj.project.length > 30 ? "..." + proj.project.slice(-27) : proj.project;
            output += `| ${shortName} | ${proj.messages.toLocaleString()} | ~${proj.tokens.toLocaleString()} |\n`;
          }
          output += `\n`;
        }

        // Top tools
        if (analytics.toolUsage.length > 0) {
          output += `## Top Tools\n`;
          output += `| Tool | Count | % |\n`;
          output += `|------|-------|---|\n`;
          for (const tool of analytics.toolUsage.slice(0, 8)) {
            output += `| ${tool.name} | ${tool.count.toLocaleString()} | ${tool.percentage}% |\n`;
          }
          output += `\n`;
        }

        // Media stats
        const m = analytics.mediaStats;
        output += `## Media\n`;
        output += `- Images: ${m.totalImages}\n`;
        output += `- Documents: ${m.totalDocuments}\n`;
        if (m.problematicContent > 0) {
          output += `- ⚠️ Oversized: ${m.problematicContent}\n`;
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "find_duplicates": {
        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        const report = findDuplicates(PROJECTS_DIR);

        let output = `🔍 **Duplicate Detection Report**\n\n`;

        output += `## Summary\n`;
        output += `| Metric | Value |\n`;
        output += `|--------|-------|\n`;
        output += `| Duplicate groups | ${report.totalDuplicateGroups} |\n`;
        output += `| Duplicate images | ${report.summary.duplicateImages} |\n`;
        output += `| Duplicate documents | ${report.summary.duplicateDocuments} |\n`;
        output += `| Wasted space | ${formatBytes(report.totalWastedSize)} |\n`;
        output += `\n`;

        if (report.conversationDuplicates.length > 0) {
          output += `## Duplicate Conversations\n`;
          for (const group of report.conversationDuplicates.slice(0, 5)) {
            output += `### ${group.locations.length} copies (~${formatBytes(group.wastedSize)} wasted)\n`;
            for (const loc of group.locations.slice(0, 3)) {
              const shortPath = path.relative(PROJECTS_DIR, loc.file);
              output += `- \`${shortPath}\`\n`;
            }
            if (group.locations.length > 3) {
              output += `- ... and ${group.locations.length - 3} more\n`;
            }
            output += `\n`;
          }
        }

        if (report.contentDuplicates.length > 0) {
          output += `## Duplicate Content\n`;
          output += `| Type | Copies | Wasted |\n`;
          output += `|------|--------|--------|\n`;
          for (const group of report.contentDuplicates.slice(0, 10)) {
            const typeIcon = group.contentType === "image" ? "🖼️" : "📄";
            output += `| ${typeIcon} ${group.contentType} | ${group.locations.length} | ${formatBytes(group.wastedSize)} |\n`;
          }
          output += `\n`;
        }

        if (report.totalDuplicateGroups === 0) {
          output += `✓ No duplicates found!\n`;
        } else {
          output += `**Recommendations:**\n`;
          if (report.conversationDuplicates.length > 0) {
            output += `- Review duplicate conversations and consider removing copies\n`;
          }
          if (report.summary.duplicateImages > 0 || report.summary.duplicateDocuments > 0) {
            output += `- Same content appears multiple times across conversations\n`;
          }
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "archive_conversations": {
        const days = (typedArgs.days as number) || 30;
        const dryRun = typedArgs.dry_run !== false;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        const candidates = findArchiveCandidates(PROJECTS_DIR, { minDaysInactive: days });

        if (candidates.length === 0) {
          return {
            content: [{ type: "text", text: `✓ No conversations eligible for archiving (inactive ${days}+ days).` }],
          };
        }

        const result = archiveConversations(PROJECTS_DIR, { minDaysInactive: days, dryRun });
        const totalSize = candidates.reduce((sum, c) => sum + c.sizeBytes, 0);

        let output = `📦 **Archive ${dryRun ? "Preview" : "Complete"}**\n\n`;
        output += `| Metric | Value |\n`;
        output += `|--------|-------|\n`;
        output += `| Conversations | ${candidates.length} |\n`;
        output += `| Total size | ${formatBytes(totalSize)} |\n`;
        output += `| Days inactive | ${days}+ |\n`;
        output += `\n`;

        output += `**Conversations:**\n`;
        for (const c of candidates.slice(0, 10)) {
          const shortPath = path.relative(PROJECTS_DIR, c.file);
          output += `- \`${shortPath}\` (${c.daysSinceActivity} days, ${formatBytes(c.sizeBytes)})\n`;
        }
        if (candidates.length > 10) {
          output += `- ... and ${candidates.length - 10} more\n`;
        }
        output += `\n`;

        if (dryRun) {
          output += `ℹ️ This is a preview. Set \`dry_run: false\` to actually archive.\n`;
        } else {
          output += `✓ Archived to: \`${result.archiveDir}\`\n`;
        }

        return { content: [{ type: "text", text: output }] };
      }

      case "run_maintenance": {
        const auto = typedArgs.auto === true;

        if (!fs.existsSync(PROJECTS_DIR)) {
          return {
            content: [{ type: "text", text: `Claude projects directory not found: ${PROJECTS_DIR}` }],
          };
        }

        const report = runMaintenance(PROJECTS_DIR, { dryRun: !auto });

        const statusIcon = report.status === "healthy" ? "✓" : report.status === "critical" ? "✗" : "⚠️";
        const statusText = report.status === "healthy" ? "Healthy" : report.status === "critical" ? "Critical" : "Needs Attention";

        let output = `🔧 **Maintenance Report**\n\n`;
        output += `**Status:** ${statusIcon} ${statusText}\n\n`;

        if (report.actions.length > 0) {
          output += `## ${auto ? "Actions Taken" : "Pending Actions"}\n`;
          output += `| Type | Description | Count |\n`;
          output += `|------|-------------|-------|\n`;
          for (const action of report.actions) {
            const icon = action.type === "fix" ? "🔧" : action.type === "cleanup" ? "🗑️" : "📦";
            output += `| ${icon} ${action.type} | ${action.description} | ${action.count} |\n`;
          }
          output += `\n`;
        }

        if (report.recommendations.length > 0) {
          output += `## Recommendations\n`;
          for (const rec of report.recommendations) {
            output += `- ${rec}\n`;
          }
          output += `\n`;
        }

        if (report.actions.length === 0 && report.recommendations.length === 0) {
          output += `✓ Everything looks good! No maintenance needed.\n`;
        } else if (!auto) {
          output += `\nℹ️ Set \`auto: true\` to perform maintenance actions automatically.\n`;
        }

        return { content: [{ type: "text", text: output }] };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Claude Code Toolkit MCP Server v1.0.7 running on stdio");
}

main().catch(console.error);
