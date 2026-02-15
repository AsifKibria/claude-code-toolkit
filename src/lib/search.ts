import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { findAllJsonlFiles } from "./scanner.js";
import { listSessions } from "./session-recovery.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export interface SearchResult {
  file: string;
  sessionId: string;
  project: string;
  line: number;
  role: "user" | "assistant" | "system" | "unknown";
  preview: string;
  timestamp?: Date;
  matchContext?: string;
}

export interface SearchOptions {
  query: string;
  limit?: number;
  role?: "user" | "assistant" | "all";
  project?: string;
  daysBack?: number;
  caseSensitive?: boolean;
}

export interface SearchReport {
  query: string;
  results: SearchResult[];
  totalMatches: number;
  filesSearched: number;
  truncated: boolean;
}

export function searchConversations(options: SearchOptions, claudeDir?: string): SearchReport {
  const projectsDir = claudeDir ? path.join(claudeDir, "projects") : PROJECTS_DIR;
  const files = findAllJsonlFiles(projectsDir);
  const sessions = listSessions(claudeDir);

  const sessionMap = new Map<string, { project: string; id: string }>();
  for (const s of sessions) {
    sessionMap.set(s.filePath, { project: s.project, id: s.id });
  }

  const results: SearchResult[] = [];
  const maxResults = options.limit || 50;
  let totalMatches = 0;
  let filesSearched = 0;

  const searchTerm = options.caseSensitive ? options.query : options.query.toLowerCase();
  const cutoffDate = options.daysBack
    ? new Date(Date.now() - options.daysBack * 24 * 60 * 60 * 1000)
    : null;

  for (const file of files) {
    if (results.length >= maxResults) break;

    if (options.project) {
      const sessionInfo = sessionMap.get(file);
      if (!sessionInfo || !sessionInfo.project.toLowerCase().includes(options.project.toLowerCase())) {
        continue;
      }
    }

    if (cutoffDate) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtime < cutoffDate) continue;
      } catch {
        continue;
      }
    }

    filesSearched++;

    try {
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      const sessionInfo = sessionMap.get(file) || { project: path.basename(path.dirname(file)), id: path.basename(file, ".jsonl") };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const lineToSearch = options.caseSensitive ? line : line.toLowerCase();
        if (!lineToSearch.includes(searchTerm)) continue;

        totalMatches++;
        if (results.length >= maxResults) continue;

        let preview = line;
        let role: "user" | "assistant" | "system" | "unknown" = "unknown";
        let timestamp: Date | undefined;

        try {
          const data = JSON.parse(line);

          if (data.type === "user" || data.message?.role === "user") {
            role = "user";
          } else if (data.type === "assistant" || data.message?.role === "assistant") {
            role = "assistant";
          } else if (data.type === "system") {
            role = "system";
          }

          if (data.timestamp) {
            timestamp = new Date(data.timestamp);
          }

          if (data.message?.content) {
            if (typeof data.message.content === "string") {
              preview = data.message.content;
            } else if (Array.isArray(data.message.content)) {
              preview = data.message.content
                .map((c: { text?: string; type?: string }) => c.text || "")
                .filter(Boolean)
                .join(" ");
            }
          } else if (data.content) {
            preview = typeof data.content === "string" ? data.content : JSON.stringify(data.content);
          }
        } catch {
          // Keep raw line as preview
        }

        if (options.role && options.role !== "all" && role !== options.role) {
          continue;
        }

        const queryIndex = preview.toLowerCase().indexOf(options.query.toLowerCase());
        let matchContext = preview;
        if (queryIndex !== -1 && preview.length > 150) {
          const start = Math.max(0, queryIndex - 50);
          const end = Math.min(preview.length, queryIndex + options.query.length + 100);
          matchContext = (start > 0 ? "..." : "") + preview.slice(start, end) + (end < preview.length ? "..." : "");
        } else if (preview.length > 200) {
          matchContext = preview.slice(0, 200) + "...";
        }

        results.push({
          file: path.relative(projectsDir, file),
          sessionId: sessionInfo.id,
          project: sessionInfo.project,
          line: i + 1,
          role,
          preview: matchContext,
          timestamp,
        });
      }
    } catch {
      // Skip unreadable files
    }
  }

  return {
    query: options.query,
    results,
    totalMatches,
    filesSearched,
    truncated: totalMatches > maxResults,
  };
}

export interface SessionDiff {
  session1: { id: string; file: string; messageCount: number; modified: Date };
  session2: { id: string; file: string; messageCount: number; modified: Date };
  commonTopics: string[];
  uniqueToSession1: string[];
  uniqueToSession2: string[];
  messagesDelta: number;
  sizeDelta: number;
  toolsUsedBoth: string[];
  toolsOnlyIn1: string[];
  toolsOnlyIn2: string[];
}

export interface SessionDiffOptions {
  sessionId1: string;
  sessionId2: string;
}

function extractKeywords(content: string): Set<string> {
  const words = content.toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 3);
  return new Set(words);
}

function extractToolsUsed(content: string): Set<string> {
  const tools = new Set<string>();
  const lines = content.split("\n");
  for (const line of lines) {
    try {
      const data = JSON.parse(line);
      if (data.message?.content) {
        const contentArr = Array.isArray(data.message.content) ? data.message.content : [data.message.content];
        for (const block of contentArr) {
          if (block.type === "tool_use" && block.name) {
            tools.add(block.name);
          }
        }
      }
    } catch {
      // Skip
    }
  }
  return tools;
}

export function compareSessionsByCID(options: SessionDiffOptions, claudeDir?: string): SessionDiff | null {
  const projectsDir = claudeDir ? path.join(claudeDir, "projects") : PROJECTS_DIR;
  const sessions = listSessions(claudeDir);

  const session1 = sessions.find(s => s.id === options.sessionId1 || s.id.startsWith(options.sessionId1));
  const session2 = sessions.find(s => s.id === options.sessionId2 || s.id.startsWith(options.sessionId2));

  if (!session1 || !session2) {
    return null;
  }

  let content1: string, content2: string;
  try {
    content1 = fs.readFileSync(session1.filePath, "utf-8");
    content2 = fs.readFileSync(session2.filePath, "utf-8");
  } catch {
    return null;
  }

  const keywords1 = extractKeywords(content1);
  const keywords2 = extractKeywords(content2);

  const common = [...keywords1].filter(w => keywords2.has(w));
  const only1 = [...keywords1].filter(w => !keywords2.has(w));
  const only2 = [...keywords2].filter(w => !keywords1.has(w));

  const tools1 = extractToolsUsed(content1);
  const tools2 = extractToolsUsed(content2);

  const toolsBoth = [...tools1].filter(t => tools2.has(t));
  const toolsOnly1 = [...tools1].filter(t => !tools2.has(t));
  const toolsOnly2 = [...tools2].filter(t => !tools1.has(t));

  const stat1 = fs.statSync(session1.filePath);
  const stat2 = fs.statSync(session2.filePath);

  return {
    session1: {
      id: session1.id,
      file: session1.filePath,
      messageCount: session1.messageCount,
      modified: stat1.mtime,
    },
    session2: {
      id: session2.id,
      file: session2.filePath,
      messageCount: session2.messageCount,
      modified: stat2.mtime,
    },
    commonTopics: common.slice(0, 20),
    uniqueToSession1: only1.slice(0, 15),
    uniqueToSession2: only2.slice(0, 15),
    messagesDelta: session2.messageCount - session1.messageCount,
    sizeDelta: stat2.size - stat1.size,
    toolsUsedBoth: toolsBoth,
    toolsOnlyIn1: toolsOnly1,
    toolsOnlyIn2: toolsOnly2,
  };
}

export function formatSessionDiff(diff: SessionDiff): string {
  const lines: string[] = [];

  lines.push("Session Comparison");
  lines.push("═".repeat(50));
  lines.push("");

  lines.push(`Session 1: ${diff.session1.id.slice(0, 12)}`);
  lines.push(`  Messages: ${diff.session1.messageCount}`);
  lines.push(`  Modified: ${diff.session1.modified.toISOString().slice(0, 19)}`);
  lines.push("");

  lines.push(`Session 2: ${diff.session2.id.slice(0, 12)}`);
  lines.push(`  Messages: ${diff.session2.messageCount}`);
  lines.push(`  Modified: ${diff.session2.modified.toISOString().slice(0, 19)}`);
  lines.push("");

  const msgSign = diff.messagesDelta >= 0 ? "+" : "";
  const sizeSign = diff.sizeDelta >= 0 ? "+" : "";
  const sizeKB = (diff.sizeDelta / 1024).toFixed(1);

  lines.push("Deltas:");
  lines.push(`  Messages: ${msgSign}${diff.messagesDelta}`);
  lines.push(`  Size: ${sizeSign}${sizeKB} KB`);
  lines.push("");

  if (diff.toolsUsedBoth.length > 0) {
    lines.push(`Common Tools (${diff.toolsUsedBoth.length}):`);
    lines.push(`  ${diff.toolsUsedBoth.join(", ")}`);
    lines.push("");
  }

  if (diff.toolsOnlyIn1.length > 0) {
    lines.push(`Tools only in Session 1:`);
    lines.push(`  ${diff.toolsOnlyIn1.join(", ")}`);
    lines.push("");
  }

  if (diff.toolsOnlyIn2.length > 0) {
    lines.push(`Tools only in Session 2:`);
    lines.push(`  ${diff.toolsOnlyIn2.join(", ")}`);
    lines.push("");
  }

  if (diff.commonTopics.length > 0) {
    lines.push(`Common Topics:`);
    lines.push(`  ${diff.commonTopics.join(", ")}`);
    lines.push("");
  }

  return lines.join("\n");
}

export function formatSearchReport(report: SearchReport): string {
  const lines: string[] = [];

  lines.push(`Search Results for "${report.query}"`);
  lines.push("═".repeat(50));
  lines.push(`Files searched: ${report.filesSearched}`);
  lines.push(`Matches found: ${report.totalMatches}${report.truncated ? ` (showing first ${report.results.length})` : ""}`);
  lines.push("");

  if (report.results.length === 0) {
    lines.push("No matches found.");
    return lines.join("\n");
  }

  const grouped = new Map<string, SearchResult[]>();
  for (const result of report.results) {
    const key = result.project;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(result);
  }

  for (const [project, results] of grouped) {
    lines.push(`\x1b[36m${project}\x1b[0m (${results.length} match${results.length > 1 ? "es" : ""})`);

    for (const r of results) {
      const roleIcon = r.role === "user" ? "👤" : r.role === "assistant" ? "🤖" : "📋";
      const shortId = r.sessionId.slice(0, 8);
      lines.push(`  ${roleIcon} [${shortId}:${r.line}]`);

      const previewLines = r.preview.split("\n").slice(0, 2);
      for (const pl of previewLines) {
        const truncated = pl.length > 100 ? pl.slice(0, 100) + "..." : pl;
        lines.push(`     ${truncated}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}
