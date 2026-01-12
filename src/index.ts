#!/usr/bin/env node
/**
 * MCP Server: Claude Code Image Fixer
 * Fixes the "image dimensions exceed max allowed size" error that poisons conversation context.
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
  type ScanResult,
  type FixResult,
  type ConversationStats,
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

const server = new Server(
  {
    name: "claude-code-toolkit",
    version: "1.0.0",
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
                text: `✅ Scanned ${files.length} file(s). No oversized images found.`,
              },
            ],
          };
        }

        let output = `🔍 **Scan Results**\n\n`;
        output += `Found **${totalIssues}** oversized image(s) in **${results.length}** file(s)\n\n`;

        for (const result of results) {
          const relPath = path.relative(PROJECTS_DIR, result.file);
          output += `### ${relPath}\n`;
          for (const issue of result.issues) {
            const sizeStr = formatBytes(issue.estimatedSize);
            output += `- Line ${issue.line}: ${issue.type} (~${sizeStr})\n`;
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
        output += `Fixed **${totalFixed}** oversized image(s) in **${results.length}** file(s)\n\n`;

        for (const result of results) {
          const relPath = path.relative(PROJECTS_DIR, result.file);
          output += `### ${relPath}\n`;
          output += `- Fixed ${result.issues.length} issue(s)\n`;
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
        const totalProblematic = allStats.reduce((sum, s) => sum + s.problematicImages, 0);

        let output = `📊 **Conversation Statistics**\n\n`;
        output += `**Summary** (${allStats.length} conversations)\n`;
        output += `- Total size: ${formatBytes(totalSize)}\n`;
        output += `- Total messages: ${totalMessages.toLocaleString()}\n`;
        output += `- Total images: ${totalImages}\n`;
        output += `- Problematic images: ${totalProblematic}\n\n`;

        output += `**Top ${displayed.length} by ${sortBy}:**\n\n`;

        for (const stats of displayed) {
          const relPath = path.relative(PROJECTS_DIR, stats.file);
          const shortPath = relPath.length > 50 ? "..." + relPath.slice(-47) : relPath;
          output += `### ${shortPath}\n`;
          output += `- Size: ${formatBytes(stats.fileSizeBytes)}\n`;
          output += `- Messages: ${stats.totalMessages} (${stats.userMessages} user, ${stats.assistantMessages} assistant)\n`;
          output += `- Tool uses: ${stats.toolUses}\n`;
          output += `- Images: ${stats.imageCount}${stats.problematicImages > 0 ? ` (⚠️ ${stats.problematicImages} oversized)` : ""}\n`;
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
            }
          } catch {
            // Skip
          }
        }

        let status = "✅ Healthy";
        const recommendations: string[] = [];

        if (issueCount > 0) {
          status = "⚠️ Issues Found";
          recommendations.push(`Run \`fix_image_issues\` to fix ${issueCount} oversized image(s)`);
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
        output += `- Oversized images: ${issueCount}\n`;
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
  console.error("Claude Code Toolkit MCP Server v1.0.0 running on stdio");
}

main().catch(console.error);
