import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const DEBUG_DIR = path.join(CLAUDE_DIR, "debug");

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  component: string;
  message: string;
  file: string;
  line: number;
  raw: string;
}

export interface LogParseOptions {
  search?: string;
  level?: LogLevel | LogLevel[];
  limit?: number;
  startDate?: Date;
  endDate?: Date;
  component?: string;
}

export interface LogFileInfo {
  path: string;
  name: string;
  size: number;
  modified: Date;
  isLatest: boolean;
}

export interface LogSummary {
  totalFiles: number;
  totalSize: number;
  oldestLog: Date | null;
  newestLog: Date | null;
  levelCounts: Record<LogLevel, number>;
  componentCounts: Record<string, number>;
}

const LOG_LINE_REGEX = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)\s+\[(\w+)\]\s*(?:\[([^\]]+)\])?\s*(.*)$/;

export function listLogFiles(claudeDir?: string): LogFileInfo[] {
  const debugDir = claudeDir ? path.join(claudeDir, "debug") : DEBUG_DIR;
  if (!fs.existsSync(debugDir)) return [];

  const files: LogFileInfo[] = [];
  let latestTarget: string | null = null;

  try {
    const entries = fs.readdirSync(debugDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(debugDir, entry.name);

      if (entry.isSymbolicLink() && entry.name === "latest") {
        try {
          latestTarget = fs.readlinkSync(fullPath);
        } catch {
          // ignore
        }
        continue;
      }

      if (!entry.isFile() || !entry.name.endsWith(".txt")) continue;

      try {
        const stat = fs.statSync(fullPath);
        files.push({
          path: fullPath,
          name: entry.name,
          size: stat.size,
          modified: stat.mtime,
          isLatest: false,
        });
      } catch {
        // skip
      }
    }

    if (latestTarget) {
      const latestName = path.basename(latestTarget);
      const match = files.find((f) => f.name === latestName || f.path === latestTarget);
      if (match) match.isLatest = true;
    }
  } catch {
    return [];
  }

  files.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  return files;
}

export function parseLogLine(line: string, file: string, lineNum: number): LogEntry | null {
  const match = line.match(LOG_LINE_REGEX);
  if (!match) return null;

  const [, timestamp, level, component, message] = match;

  return {
    timestamp: new Date(timestamp),
    level: level as LogLevel,
    component: component || "",
    message: message.trim(),
    file,
    line: lineNum,
    raw: line,
  };
}

export function parseLogFile(filePath: string, options?: LogParseOptions): LogEntry[] {
  if (!fs.existsSync(filePath)) return [];

  const entries: LogEntry[] = [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");

  const searchLower = options?.search?.toLowerCase();
  const levels = options?.level
    ? Array.isArray(options.level)
      ? options.level
      : [options.level]
    : null;
  const componentLower = options?.component?.toLowerCase();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const entry = parseLogLine(line, filePath, i + 1);
    if (!entry) continue;

    if (levels && !levels.includes(entry.level)) continue;
    if (options?.startDate && entry.timestamp < options.startDate) continue;
    if (options?.endDate && entry.timestamp > options.endDate) continue;
    if (componentLower && !entry.component.toLowerCase().includes(componentLower)) continue;
    if (searchLower) {
      const matches =
        entry.message.toLowerCase().includes(searchLower) ||
        entry.component.toLowerCase().includes(searchLower);
      if (!matches) continue;
    }

    entries.push(entry);

    if (options?.limit && entries.length >= options.limit) break;
  }

  return entries;
}

export function parseAllLogs(options?: LogParseOptions, claudeDir?: string): LogEntry[] {
  const files = listLogFiles(claudeDir);
  let allEntries: LogEntry[] = [];

  for (const file of files) {
    const entries = parseLogFile(file.path, { ...options, limit: undefined });
    allEntries.push(...entries);

    if (options?.limit && allEntries.length >= options.limit * 2) break;
  }

  allEntries.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (options?.limit) {
    allEntries = allEntries.slice(0, options.limit);
  }

  return allEntries;
}

export function getLogSummary(claudeDir?: string): LogSummary {
  const files = listLogFiles(claudeDir);
  const levelCounts: Record<LogLevel, number> = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
  const componentCounts: Record<string, number> = {};

  let totalSize = 0;
  let oldestLog: Date | null = null;
  let newestLog: Date | null = null;

  for (const file of files) {
    totalSize += file.size;

    const entries = parseLogFile(file.path);
    for (const entry of entries) {
      levelCounts[entry.level]++;

      if (entry.component) {
        componentCounts[entry.component] = (componentCounts[entry.component] || 0) + 1;
      }

      if (!oldestLog || entry.timestamp < oldestLog) {
        oldestLog = entry.timestamp;
      }
      if (!newestLog || entry.timestamp > newestLog) {
        newestLog = entry.timestamp;
      }
    }
  }

  return {
    totalFiles: files.length,
    totalSize,
    oldestLog,
    newestLog,
    levelCounts,
    componentCounts,
  };
}

export function getRecentLogs(
  count = 100,
  options?: Omit<LogParseOptions, "limit">,
  claudeDir?: string
): LogEntry[] {
  return parseAllLogs({ ...options, limit: count }, claudeDir);
}

export function getErrorLogs(count = 100, claudeDir?: string): LogEntry[] {
  return parseAllLogs({ level: ["ERROR", "WARN"], limit: count }, claudeDir);
}

export function searchLogs(query: string, options?: LogParseOptions, claudeDir?: string): LogEntry[] {
  return parseAllLogs({ ...options, search: query }, claudeDir);
}
