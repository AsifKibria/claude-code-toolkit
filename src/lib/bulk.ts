/**
 * Bulk Operations Module
 * Perform bulk operations on multiple sessions
 */

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findAllJsonlFiles, archiveConversations } from "./scanner.js";
import { bulkExport, EnhancedExportOptions } from "./export.js";
import { listSessions, SessionInfo } from "./session-recovery.js";
import { clearSessionTags, getSessionTags } from "./bookmarks.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const ARCHIVE_DIR = path.join(CLAUDE_DIR, "archive");

export interface BulkDeleteOptions {
  sessionIds?: string[];
  olderThanDays?: number;
  projectFilter?: string;
  dryRun?: boolean;
  includeStarred?: boolean;
}

export interface BulkDeleteResult {
  deleted: { sessionId: string; file: string; size: number }[];
  skipped: { sessionId: string; reason: string }[];
  totalFreed: number;
  dryRun: boolean;
  errors: string[];
}

export interface BulkArchiveOptions {
  sessionIds?: string[];
  olderThanDays?: number;
  projectFilter?: string;
  dryRun?: boolean;
  includeStarred?: boolean;
}

export interface BulkArchiveResult {
  archived: { sessionId: string; file: string; archivePath: string }[];
  skipped: { sessionId: string; reason: string }[];
  totalSize: number;
  dryRun: boolean;
  errors: string[];
}

export interface BulkExportOptions extends Partial<EnhancedExportOptions> {
  sessionIds?: string[];
  projectFilter?: string;
  outputDir?: string;
}

export interface BulkOperationSummary {
  operation: "delete" | "archive" | "export";
  sessionsProcessed: number;
  sessionsSkipped: number;
  totalSize: number;
  errors: number;
  dryRun: boolean;
}

export function bulkDelete(options: BulkDeleteOptions): BulkDeleteResult {
  const result: BulkDeleteResult = {
    deleted: [],
    skipped: [],
    totalFreed: 0,
    dryRun: options.dryRun !== false,
    errors: [],
  };

  const sessions = listSessions();
  const now = Date.now();
  const cutoffMs = options.olderThanDays ? options.olderThanDays * 24 * 60 * 60 * 1000 : 0;

  for (const session of sessions) {
    const match = options.sessionIds
      ? options.sessionIds.some((id) => session.id === id || session.id.startsWith(id))
      : true;

    if (!match) continue;

    if (options.projectFilter && !session.project.includes(options.projectFilter)) {
      continue;
    }

    if (cutoffMs > 0) {
      const age = now - new Date(session.modified).getTime();
      if (age < cutoffMs) {
        result.skipped.push({ sessionId: session.id, reason: "Too recent" });
        continue;
      }
    }

    if (!options.includeStarred) {
      const tags = getSessionTags(session.id);
      if (tags?.starred) {
        result.skipped.push({ sessionId: session.id, reason: "Starred" });
        continue;
      }
    }

    if (options.dryRun) {
      result.deleted.push({
        sessionId: session.id,
        file: session.filePath,
        size: session.sizeBytes,
      });
      result.totalFreed += session.sizeBytes;
    } else {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const backupPath = session.filePath.replace(".jsonl", `.backup.${timestamp}.jsonl`);
        fs.copyFileSync(session.filePath, backupPath);
        fs.unlinkSync(session.filePath);
        clearSessionTags(session.id);

        result.deleted.push({
          sessionId: session.id,
          file: session.filePath,
          size: session.sizeBytes,
        });
        result.totalFreed += session.sizeBytes;
      } catch (e) {
        result.errors.push(`${session.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return result;
}

export function bulkArchiveSessions(options: BulkArchiveOptions): BulkArchiveResult {
  const result: BulkArchiveResult = {
    archived: [],
    skipped: [],
    totalSize: 0,
    dryRun: options.dryRun !== false,
    errors: [],
  };

  const sessions = listSessions();
  const now = Date.now();
  const cutoffMs = options.olderThanDays ? options.olderThanDays * 24 * 60 * 60 * 1000 : 0;

  if (!fs.existsSync(ARCHIVE_DIR) && !options.dryRun) {
    fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
  }

  for (const session of sessions) {
    const match = options.sessionIds
      ? options.sessionIds.some((id) => session.id === id || session.id.startsWith(id))
      : true;

    if (!match) continue;

    if (options.projectFilter && !session.project.includes(options.projectFilter)) {
      continue;
    }

    if (cutoffMs > 0) {
      const age = now - new Date(session.modified).getTime();
      if (age < cutoffMs) {
        result.skipped.push({ sessionId: session.id, reason: "Too recent" });
        continue;
      }
    }

    if (!options.includeStarred) {
      const tags = getSessionTags(session.id);
      if (tags?.starred) {
        result.skipped.push({ sessionId: session.id, reason: "Starred" });
        continue;
      }
    }

    const projectFolder = path.basename(path.dirname(session.filePath));
    const archivePath = path.join(ARCHIVE_DIR, projectFolder, path.basename(session.filePath));

    if (options.dryRun) {
      result.archived.push({
        sessionId: session.id,
        file: session.filePath,
        archivePath,
      });
      result.totalSize += session.sizeBytes;
    } else {
      try {
        const archiveFolder = path.dirname(archivePath);
        if (!fs.existsSync(archiveFolder)) {
          fs.mkdirSync(archiveFolder, { recursive: true });
        }

        fs.copyFileSync(session.filePath, archivePath);
        fs.unlinkSync(session.filePath);

        result.archived.push({
          sessionId: session.id,
          file: session.filePath,
          archivePath,
        });
        result.totalSize += session.sizeBytes;
      } catch (e) {
        result.errors.push(`${session.id}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return result;
}

export function bulkExportSessions(options: BulkExportOptions) {
  const sessions = listSessions();
  const outputDir = options.outputDir || path.join(CLAUDE_DIR, "exports", new Date().toISOString().slice(0, 10));

  let files: string[] = [];

  if (options.sessionIds && options.sessionIds.length > 0) {
    for (const session of sessions) {
      const match = options.sessionIds.some((id) => session.id === id || session.id.startsWith(id));
      if (match) {
        files.push(session.filePath);
      }
    }
  } else if (options.projectFilter) {
    for (const session of sessions) {
      if (session.project.includes(options.projectFilter)) {
        files.push(session.filePath);
      }
    }
  } else {
    files = sessions.map((s) => s.filePath);
  }

  return bulkExport(files, outputDir, {
    format: options.format || "html",
    includeToolResults: options.includeToolResults,
    includeTimestamps: options.includeTimestamps,
    syntaxHighlighting: options.syntaxHighlighting,
    theme: options.theme,
  });
}

export function getSessionsForBulkOperation(options: {
  sessionIds?: string[];
  olderThanDays?: number;
  projectFilter?: string;
  includeStarred?: boolean;
}): { eligible: SessionInfo[]; excluded: { id: string; reason: string }[] } {
  const sessions = listSessions();
  const eligible: SessionInfo[] = [];
  const excluded: { id: string; reason: string }[] = [];

  const now = Date.now();
  const cutoffMs = options.olderThanDays ? options.olderThanDays * 24 * 60 * 60 * 1000 : 0;

  for (const session of sessions) {
    const match = options.sessionIds
      ? options.sessionIds.some((id) => session.id === id || session.id.startsWith(id))
      : true;

    if (!match) continue;

    if (options.projectFilter && !session.project.includes(options.projectFilter)) {
      continue;
    }

    if (cutoffMs > 0) {
      const age = now - new Date(session.modified).getTime();
      if (age < cutoffMs) {
        excluded.push({ id: session.id, reason: "Too recent" });
        continue;
      }
    }

    if (!options.includeStarred) {
      const tags = getSessionTags(session.id);
      if (tags?.starred) {
        excluded.push({ id: session.id, reason: "Starred" });
        continue;
      }
    }

    eligible.push(session);
  }

  return { eligible, excluded };
}

export function formatBulkOperationReport(
  operation: "delete" | "archive" | "export",
  result: BulkDeleteResult | BulkArchiveResult | ReturnType<typeof bulkExportSessions>
): string {
  let output = `Bulk ${operation.charAt(0).toUpperCase() + operation.slice(1)} Report\n`;
  output += "═".repeat(50) + "\n\n";

  if ("deleted" in result) {
    output += `Sessions deleted: ${result.deleted.length}\n`;
    output += `Sessions skipped: ${result.skipped.length}\n`;
    output += `Space freed: ${formatBytes(result.totalFreed)}\n`;
    output += `Dry run: ${result.dryRun ? "Yes" : "No"}\n`;

    if (result.errors.length > 0) {
      output += `\nErrors (${result.errors.length}):\n`;
      for (const err of result.errors.slice(0, 5)) {
        output += `  - ${err}\n`;
      }
    }
  } else if ("archived" in result) {
    output += `Sessions archived: ${result.archived.length}\n`;
    output += `Sessions skipped: ${result.skipped.length}\n`;
    output += `Total size: ${formatBytes(result.totalSize)}\n`;
    output += `Dry run: ${result.dryRun ? "Yes" : "No"}\n`;

    if (result.errors.length > 0) {
      output += `\nErrors (${result.errors.length}):\n`;
      for (const err of result.errors.slice(0, 5)) {
        output += `  - ${err}\n`;
      }
    }
  } else if ("exported" in result) {
    output += `Sessions exported: ${result.exported.length}\n`;
    output += `Export errors: ${result.errors.length}\n`;
    output += `Total messages: ${result.totalMessages}\n`;
    output += `Total size: ${formatBytes(result.totalSize)}\n`;

    if (result.errors.length > 0) {
      output += `\nErrors:\n`;
      for (const err of result.errors.slice(0, 5)) {
        output += `  - ${err.file}: ${err.error}\n`;
      }
    }
  }

  return output;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
