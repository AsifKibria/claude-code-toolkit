import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFile } from "child_process";
import { generateDashboardHTML } from "./dashboard-ui.js";
import { analyzeClaudeStorage, cleanClaudeDirectory } from "./storage.js";
import { listSessions, diagnoseSession, repairSession, extractSessionContent } from "./session-recovery.js";
import { scanForSecrets, auditSession, enforceRetention, generateComplianceReport } from "./security.js";
import { inventoryTraces, cleanTraces, wipeAllTraces, generateEnhancedPreview, TraceExclusion } from "./trace.js";
import { diagnoseMcpServers, probeMcpServer, McpServerCapabilities, analyzeMcpPerformance } from "./mcp-validator.js";
import { scanForPII, redactPII, redactAllPII } from "./security.js";
import { checkAlerts, checkQuotas } from "./alerts.js";
import { linkSessionsToGit } from "./git.js";
import { searchConversations } from "./search.js";
import { listLogFiles, parseAllLogs, getLogSummary, LogLevel, LogParseOptions } from "./logs.js";
import {
  findAllJsonlFiles,
  findBackupFiles,
  scanFile,
  fixFile,
  getConversationStats,
  estimateContextSize,
  generateUsageAnalytics,
  findDuplicates,
  findArchiveCandidates,
  archiveConversations,
  runMaintenance,
  deleteOldBackups,
  restoreFromBackup,
  exportConversation,
} from "./scanner.js";
import {
  saveStorageSnapshot,
  listStorageSnapshots,
  loadStorageSnapshot,
  compareStorageSnapshots,
  deleteStorageSnapshot, // Missing export in storage.ts? I added it.
} from "./storage.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");
const PID_FILE = path.join(CLAUDE_DIR, "dashboard.pid");

const SECRET_PATTERNS = [
  { name: "AWS Access Key ID", type: "aws_key", regex: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
  { name: "AWS Secret Access Key", type: "aws_secret", regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)['"=:\s]+([A-Za-z0-9/+=]{40})/gi, severity: "critical" },
  { name: "API Token (ghp_, xoxb-, sk-)", type: "api_token", regex: /(?:ghp_[A-Za-z0-9]{36,}|xoxb-[A-Za-z0-9-]+|xoxp-[A-Za-z0-9-]+)/g, severity: "high" },
  { name: "sk- API Key", type: "api_key", regex: /sk-[A-Za-z0-9]{20,}/g, severity: "high" },
  { name: "Private Key", type: "private_key", regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g, severity: "critical" },
  { name: "Connection String", type: "connection_string", regex: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/g, severity: "high" },
  { name: "JWT Token", type: "jwt", regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: "medium" },
  { name: "Password in Config", type: "password", regex: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{4,}["']/gi, severity: "high" },
  { name: "Slack Token", type: "slack_token", regex: /xox[bpras]-[A-Za-z0-9-]+/g, severity: "high" },
  { name: "Generic Secret Assignment", type: "generic_secret", regex: /(?:secret|api_key|apikey|access_token)\s*[=:]\s*["'][A-Za-z0-9+/=]{16,}["']/gi, severity: "medium" },
];

export interface DashboardOptions {
  port?: number;
  open?: boolean;
  daemon?: boolean;
  authToken?: string;
}

type RouteHandler = (params: Record<string, string>) => unknown | Promise<unknown>;
type PostHandler = (body: Record<string, unknown>) => unknown | Promise<unknown>;

function parseUrl(url: string): { pathname: string; params: Record<string, string> } {
  const [pathname, query] = (url || "/").split("?");
  const params: Record<string, string> = {};
  if (query) {
    for (const pair of query.split("&")) {
      const [k, v] = pair.split("=");
      if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || "");
    }
  }
  return { pathname, params };
}

function extractBearerToken(req: http.IncomingMessage, params: Record<string, string>, authToken?: string): boolean {
  if (!authToken) return true;
  const header = req.headers["authorization"];
  if (typeof header === "string" && header.toLowerCase().startsWith("bearer ")) {
    const provided = header.slice(7).trim();
    if (provided === authToken) return true;
  }
  if (params?.token === authToken) {
    return true;
  }
  return false;
}

function rejectUnauthorized(res: http.ServerResponse) {
  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized" }));
}

function matchRoute(pathname: string, pattern: string): Record<string, string> | null {
  const pathParts = pathname.split("/").filter(Boolean);
  const patternParts = pattern.split("/").filter(Boolean);
  if (pathParts.length !== patternParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = pathParts[i];
    } else if (patternParts[i] !== pathParts[i]) {
      return null;
    }
  }
  return params;
}

function readBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: Buffer) => { data += chunk.toString(); });
    req.on("end", () => {
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

// ===== GET handlers =====

function getOverview(): Record<string, unknown> {
  const files = findAllJsonlFiles(PROJECTS_DIR);
  let issueCount = 0;
  let totalIssueSize = 0;
  for (const file of files) {
    try {
      const result = scanFile(file);
      issueCount += result.issues.length;
      for (const issue of result.issues) {
        totalIssueSize += issue.estimatedSize;
      }
    } catch { /* skip */ }
  }
  const backups = findBackupFiles(PROJECTS_DIR);
  let backupSize = 0;
  for (const b of backups) {
    try { backupSize += fs.statSync(b).size; } catch { /* skip */ }
  }
  const candidates = findArchiveCandidates(PROJECTS_DIR, { minDaysInactive: 30 });
  const maintenance = runMaintenance(PROJECTS_DIR, { dryRun: true });
  const storage = analyzeClaudeStorage();
  const sessions = listSessions();
  const healthySessions = sessions.filter(s => s.status === "healthy").length;
  const uniqueProjects = new Set(sessions.map(s => s.project)).size;
  return {
    totalConversations: files.length,
    issueCount,
    totalIssueSize,
    backupCount: backups.length,
    backupSize,
    archiveCandidates: candidates.length,
    maintenanceActions: maintenance.actions.length,
    maintenanceStatus: maintenance.status,
    systemInfo: {
      claudeDir: CLAUDE_DIR,
      projectsDir: PROJECTS_DIR,
      totalStorage: storage.totalSize,
      totalSessions: sessions.length,
      healthySessions,
      uniqueProjects,
      platform: os.platform(),
      nodeVersion: process.version,
    },
  };
}

function getStorage(): Record<string, unknown> {
  const analysis = analyzeClaudeStorage();
  return {
    totalSize: analysis.totalSize,
    categories: analysis.categories.map(c => ({
      name: c.name,
      totalSize: c.totalSize,
      fileCount: c.fileCount,
      cleanableSize: c.cleanableSize,
    })),
    largestFiles: analysis.largestFiles,
    recommendations: analysis.recommendations,
  };
}

function getSessions(): Record<string, unknown>[] {
  const sessions = listSessions();
  return sessions.map(s => ({
    id: s.id,
    project: s.project,
    projectPath: s.projectPath,
    messageCount: s.messageCount,
    sizeBytes: s.sizeBytes,
    status: s.status,
    created: s.created,
    modified: s.modified,
    subagentCount: s.subagentCount,
    filePath: s.filePath,
  }));
}

function getSessionDetail(sessionId: string): Record<string, unknown> | null {
  const sessions = listSessions();
  const match = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));
  if (!match) return null;
  const diag = diagnoseSession(match.filePath);
  return {
    ...diag,
    sessionId: match.id,
    project: match.project,
    status: match.status,
    sizeBytes: match.sizeBytes,
    messageCount: match.messageCount,
    filePath: match.filePath,
  };
}

function getSessionAudit(sessionId: string): Record<string, unknown> | null {
  const sessions = listSessions();
  const match = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));
  if (!match) return null;
  const audit = auditSession(match.filePath);
  return {
    sessionId: match.id,
    project: match.project,
    filesRead: audit.filesRead,
    filesWritten: audit.filesWritten,
    commandsRun: audit.commandsRun,
    mcpToolsUsed: audit.mcpToolsUsed,
    urlsFetched: audit.urlsFetched,
    totalActions: audit.actions.length,
  };
}

function getSecurity(): Record<string, unknown> {
  const result = scanForSecrets();
  return {
    filesScanned: result.filesScanned,
    totalFindings: result.totalFindings,
    findings: result.findings.slice(0, 100),
    summary: result.summary,
  };
}

function getSecurityFindingPreview(filePath: string, lineNum: number): Record<string, unknown> | null {
  try {
    const fullPath = path.join(PROJECTS_DIR, filePath);
    const target = fs.existsSync(fullPath) ? fullPath : filePath;
    if (!fs.existsSync(target)) return null;
    const content = fs.readFileSync(target, "utf-8");
    const lines = content.split("\n");
    if (lineNum < 1 || lineNum > lines.length) return null;
    const line = lines[lineNum - 1];
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(line); } catch { return { lineNum, raw: line.slice(0, 500) }; }
    let text = "";
    const extractText = (obj: unknown): void => {
      if (typeof obj === "string") { text += obj + "\n"; return; }
      if (Array.isArray(obj)) { obj.forEach(extractText); return; }
      if (obj && typeof obj === "object") { Object.values(obj).forEach(extractText); }
    };
    extractText(parsed);
    const preview = text.slice(0, 2000);
    for (const pat of SECRET_PATTERNS) {
      pat.regex.lastIndex = 0;
    }
    const masked = SECRET_PATTERNS.reduce((t, p) => {
      p.regex.lastIndex = 0;
      return t.replace(p.regex, (m: string) => m.slice(0, 4) + "****" + m.slice(-4));
    }, preview);
    return { lineNum, preview: masked, fileSize: content.length, totalLines: lines.length };
  } catch { return null; }
}

function getCompliance(): Record<string, unknown> {
  const report = generateComplianceReport();
  const files = findAllJsonlFiles(PROJECTS_DIR);
  let totalSessionSize = 0;
  let newestSession: Date | null = null;
  const ageBrackets = { week: 0, month: 0, quarter: 0, older: 0 };
  const now = Date.now();
  for (const f of files) {
    try {
      const stat = fs.statSync(f);
      totalSessionSize += stat.size;
      if (!newestSession || stat.mtime > newestSession) newestSession = stat.mtime;
      const days = (now - stat.mtime.getTime()) / (24 * 60 * 60 * 1000);
      if (days <= 7) ageBrackets.week++;
      else if (days <= 30) ageBrackets.month++;
      else if (days <= 90) ageBrackets.quarter++;
      else ageBrackets.older++;
    } catch { /* skip */ }
  }
  const oldestDays = report.oldestSession
    ? Math.round((now - report.oldestSession.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  const newestDays = newestSession
    ? Math.round((now - newestSession.getTime()) / (24 * 60 * 60 * 1000))
    : 0;
  return {
    secretsScan: {
      filesScanned: report.secretsScan.filesScanned,
      totalFindings: report.secretsScan.totalFindings,
      summary: report.secretsScan.summary,
    },
    sessionCount: report.sessionCount,
    oldestSession: report.oldestSession,
    oldestDays,
    newestDays,
    totalSessionSize,
    retentionStatus: report.retentionStatus,
    ageBrackets,
    generatedAt: report.generatedAt,
  };
}

function getTraces(): Record<string, unknown> {
  const inv = inventoryTraces();
  return {
    totalSize: inv.totalSize,
    totalFiles: inv.totalFiles,
    criticalItems: inv.criticalItems,
    highItems: inv.highItems,
    analyzedAt: inv.analyzedAt,
    categories: inv.categories.map(c => ({
      name: c.name,
      sensitivity: c.sensitivity,
      fileCount: c.fileCount,
      totalSize: c.totalSize,
      description: c.description,
      oldestFile: c.oldestFile,
      newestFile: c.newestFile,
      sampleFiles: c.items?.slice(0, 5).map(item => ({
        path: path.basename(item.path),
        fullPath: item.path,
        size: item.size,
        modified: item.modified,
        projectName: extractProjectName(item.path),
      })) || [],
      allFiles: c.items?.map(item => ({
        path: path.basename(item.path),
        fullPath: item.path,
        size: item.size,
        modified: item.modified,
        projectName: extractProjectName(item.path),
      })) || [],
    })),
  };
}

async function getMcp(): Promise<Record<string, unknown>> {
  const report = await diagnoseMcpServers();
  return {
    configs: report.configs.map(c => ({
      configPath: c.configPath,
      servers: c.servers.map(s => ({ name: s.name, command: s.command, type: s.type, args: s.args, env: s.env })),
      issues: c.issues,
      valid: c.valid,
    })),
    totalServers: report.totalServers,
    healthyServers: report.healthyServers,
    duplicateServers: report.duplicateServers,
    recommendations: report.recommendations,
  };
}

async function getMcpServerCapabilities(serverName: string): Promise<Record<string, unknown> | null> {
  const report = await diagnoseMcpServers();
  const allServers = report.configs.flatMap(c => c.servers);
  const server = allServers.find(s => s.name === serverName);
  if (!server) return null;

  const capabilities = await probeMcpServer(server);
  return {
    serverName: server.name,
    command: server.command,
    args: server.args,
    ...capabilities,
  };
}

function getLogs(params: Record<string, string>): Record<string, unknown> {
  const options: LogParseOptions = {
    limit: params.limit ? parseInt(params.limit, 10) : 100,
  };

  if (params.search) options.search = params.search;
  if (params.level) {
    const levels = params.level.split(",").map(l => l.trim().toUpperCase()) as LogLevel[];
    options.level = levels;
  }
  if (params.component) options.component = params.component;
  if (params.startDate) options.startDate = new Date(params.startDate);
  if (params.endDate) options.endDate = new Date(params.endDate);

  const entries = parseAllLogs(options);
  const summary = getLogSummary();
  const files = listLogFiles();

  const sessions = listSessions();
  const sessionToProject = new Map<string, { project: string; projectPath: string }>();
  for (const s of sessions) {
    sessionToProject.set(s.id, { project: extractProjectName(s.filePath), projectPath: s.projectPath || s.project });
  }

  return {
    entries: entries.map(e => ({
      timestamp: e.timestamp,
      level: e.level,
      component: e.component,
      message: e.message,
      file: path.basename(e.file),
      line: e.line,
    })),
    summary: {
      totalFiles: summary.totalFiles,
      totalSize: summary.totalSize,
      oldestLog: summary.oldestLog,
      newestLog: summary.newestLog,
      levelCounts: summary.levelCounts,
      topComponents: Object.entries(summary.componentCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count })),
    },
    files: files.slice(0, 10).map(f => {
      const sessionId = f.name.replace(/\.txt$/, "");
      const projectInfo = sessionToProject.get(sessionId);
      return {
        name: f.name,
        size: f.size,
        modified: f.modified,
        isLatest: f.isLatest,
        sessionId,
        projectName: projectInfo?.project || null,
        projectPath: projectInfo?.projectPath || null,
      };
    }),
  };
}

function getConfig(): Record<string, unknown> {
  const configs: Record<string, unknown> = {};

  const settingsPath = path.join(CLAUDE_DIR, "settings.json");
  if (fs.existsSync(settingsPath)) {
    try {
      const content = fs.readFileSync(settingsPath, "utf-8");
      configs.settings = {
        path: settingsPath,
        content,
        exists: true,
        size: fs.statSync(settingsPath).size,
        modified: fs.statSync(settingsPath).mtime,
      };
    } catch (e) {
      configs.settings = { path: settingsPath, exists: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    configs.settings = { path: settingsPath, exists: false };
  }

  const globalClaudeMd = path.join(CLAUDE_DIR, "CLAUDE.md");
  if (fs.existsSync(globalClaudeMd)) {
    try {
      const content = fs.readFileSync(globalClaudeMd, "utf-8");
      configs.globalClaudeMd = {
        path: globalClaudeMd,
        content,
        exists: true,
        size: fs.statSync(globalClaudeMd).size,
        modified: fs.statSync(globalClaudeMd).mtime,
      };
    } catch (e) {
      configs.globalClaudeMd = { path: globalClaudeMd, exists: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    configs.globalClaudeMd = { path: globalClaudeMd, exists: false };
  }

  const globalMcpConfig = path.join(os.homedir(), ".claude.json");
  if (fs.existsSync(globalMcpConfig)) {
    try {
      const content = fs.readFileSync(globalMcpConfig, "utf-8");
      configs.globalMcp = {
        path: globalMcpConfig,
        content,
        exists: true,
        size: fs.statSync(globalMcpConfig).size,
        modified: fs.statSync(globalMcpConfig).mtime,
      };
    } catch (e) {
      configs.globalMcp = { path: globalMcpConfig, exists: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    configs.globalMcp = { path: globalMcpConfig, exists: false };
  }

  const projectMcp = path.join(process.cwd(), ".mcp.json");
  if (fs.existsSync(projectMcp)) {
    try {
      const content = fs.readFileSync(projectMcp, "utf-8");
      configs.projectMcp = {
        path: projectMcp,
        content,
        exists: true,
        size: fs.statSync(projectMcp).size,
        modified: fs.statSync(projectMcp).mtime,
      };
    } catch (e) {
      configs.projectMcp = { path: projectMcp, exists: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    configs.projectMcp = { path: projectMcp, exists: false };
  }

  const projectClaudeMd = path.join(process.cwd(), "CLAUDE.md");
  if (fs.existsSync(projectClaudeMd)) {
    try {
      const content = fs.readFileSync(projectClaudeMd, "utf-8");
      configs.projectClaudeMd = {
        path: projectClaudeMd,
        content,
        exists: true,
        size: fs.statSync(projectClaudeMd).size,
        modified: fs.statSync(projectClaudeMd).mtime,
      };
    } catch (e) {
      configs.projectClaudeMd = { path: projectClaudeMd, exists: false, error: e instanceof Error ? e.message : String(e) };
    }
  } else {
    configs.projectClaudeMd = { path: projectClaudeMd, exists: false };
  }

  return configs;
}

function actionSaveConfig(body: Record<string, unknown>): Record<string, unknown> {
  const configType = body.type as string;
  const content = body.content as string;

  if (!configType || content === undefined) {
    return { success: false, error: "type and content are required" };
  }

  let configPath: string;
  switch (configType) {
    case "settings":
      configPath = path.join(CLAUDE_DIR, "settings.json");
      break;
    case "globalClaudeMd":
      configPath = path.join(CLAUDE_DIR, "CLAUDE.md");
      break;
    case "globalMcp":
      configPath = path.join(os.homedir(), ".claude.json");
      break;
    case "projectMcp":
      configPath = path.join(process.cwd(), ".mcp.json");
      break;
    case "projectClaudeMd":
      configPath = path.join(process.cwd(), "CLAUDE.md");
      break;
    default:
      return { success: false, error: "Invalid config type" };
  }

  if (configType === "settings" || configType === "globalMcp" || configType === "projectMcp") {
    try {
      JSON.parse(content);
    } catch (e) {
      return { success: false, error: "Invalid JSON: " + (e instanceof Error ? e.message : String(e)) };
    }
  }

  try {
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(configPath)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = configPath + ".backup." + timestamp;
      fs.copyFileSync(configPath, backupPath);
    }

    fs.writeFileSync(configPath, content, "utf-8");
    return { success: true, path: configPath };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function getAnalytics(): Record<string, unknown> {
  const analytics = generateUsageAnalytics(PROJECTS_DIR, 30);
  const files = findAllJsonlFiles(PROJECTS_DIR);
  let totalTokens = 0;
  let tokenWarnings = 0;
  for (const f of files.slice(0, 50)) {
    try {
      const est = estimateContextSize(f);
      totalTokens += est.totalTokens;
      if (est.totalTokens > 100000) tokenWarnings++;
    } catch { /* skip */ }
  }
  return {
    totalSessions: analytics.overview.totalConversations,
    totalMessages: analytics.overview.totalMessages,
    totalTokens: analytics.overview.totalTokens,
    totalSize: analytics.overview.totalSize,
    activeDays: analytics.dailyActivity.length,
    topProjects: analytics.topProjects.map(p => ({
      name: p.project,
      sessions: p.conversations,
      messages: p.messages,
      size: p.tokens,
    })),
    toolUsage: Object.fromEntries(analytics.toolUsage.map(t => [t.name, t.count])),
    dailyActivity: analytics.dailyActivity,
    mediaStats: analytics.mediaStats,
    contextTokens: totalTokens,
    tokenWarnings,
    avgTokensPerSession: files.length > 0 ? Math.round(totalTokens / Math.min(files.length, 50)) : 0,
  };
}

function getDuplicates(): Record<string, unknown> {
  const report = findDuplicates(PROJECTS_DIR);
  const allGroups = [...report.conversationDuplicates, ...report.contentDuplicates];
  return {
    totalDuplicates: report.totalDuplicateGroups,
    totalWastedSize: report.totalWastedSize,
    groups: allGroups.slice(0, 20).map((g) => ({
      type: g.type,
      hash: g.hash?.slice(0, 8),
      count: g.locations.length,
      wastedSize: g.wastedSize,
      locations: g.locations.map((l) => ({
        file: l.file.split("/").pop(),
        path: l.file,
      })),
    })),
  };
}

function extractProjectName(filePath: string): string {
  const rel = path.relative(PROJECTS_DIR, filePath);
  const parts = rel.split(path.sep);
  if (parts.length > 0) {
    const projectFolder = parts[0];
    const projectPath = projectFolder.replace(/^-/, "/").replace(/-/g, "/");
    const pathParts = projectPath.split("/").filter(Boolean);
    if (pathParts.length >= 2) {
      return pathParts.slice(-2).join("/");
    }
    return pathParts[pathParts.length - 1] || projectFolder;
  }
  return path.basename(filePath);
}

function extractFirstPrompt(filePath: string): string | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    for (const line of lines.slice(0, 20)) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.type === "user" || data.message?.role === "user") {
          const msgContent = data.message?.content || data.content;
          if (typeof msgContent === "string") {
            return msgContent.slice(0, 100) + (msgContent.length > 100 ? "..." : "");
          }
          if (Array.isArray(msgContent)) {
            for (const part of msgContent) {
              if (part.type === "text" && part.text) {
                return part.text.slice(0, 100) + (part.text.length > 100 ? "..." : "");
              }
            }
          }
        }
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return null;
}

function getContext(): Record<string, unknown> {
  const files = findAllJsonlFiles(PROJECTS_DIR);
  const estimates: Record<string, unknown>[] = [];
  let totalTokens = 0;
  let warnings = 0;
  for (const f of files) {
    try {
      const est = estimateContextSize(f);
      totalTokens += est.totalTokens;
      if (est.warnings.length > 0) warnings++;
      const projectName = extractProjectName(f);
      const firstPrompt = extractFirstPrompt(f);
      const sessionId = path.basename(f, ".jsonl");
      estimates.push({
        file: path.relative(PROJECTS_DIR, f),
        fullPath: f,
        sessionId,
        projectName,
        firstPrompt,
        tokens: est.totalTokens,
        messages: est.messageCount,
        images: est.breakdown.imageTokens,
        documents: est.breakdown.documentTokens,
        tools: est.breakdown.toolResultTokens,
        warnings: est.warnings,
      });
    } catch { /* skip */ }
  }
  estimates.sort((a, b) => (b as { tokens: number }).tokens - (a as { tokens: number }).tokens);
  return { totalTokens, totalFiles: files.length, warnings, estimates: estimates.slice(0, 50) };
}

function getBackups(): Record<string, unknown> {
  const backups = findBackupFiles(PROJECTS_DIR);
  let totalSize = 0;
  const items = backups.map(b => {
    try {
      const stat = fs.statSync(b);
      totalSize += stat.size;
      return {
        path: b,
        file: path.basename(b),
        dir: path.relative(PROJECTS_DIR, path.dirname(b)),
        size: stat.size,
        created: stat.mtime,
      };
    } catch {
      return { path: b, file: path.basename(b), dir: "", size: 0, created: new Date(0) };
    }
  });
  items.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
  return { totalBackups: backups.length, totalSize, backups: items.slice(0, 100) };
}

function getStats(): Record<string, unknown> {
  const files = findAllJsonlFiles(PROJECTS_DIR);
  const stats: Record<string, unknown>[] = [];
  let totalMessages = 0;
  let totalImages = 0;
  let totalSize = 0;
  for (const f of files) {
    try {
      const s = getConversationStats(f);
      totalMessages += s.totalMessages;
      totalImages += s.imageCount;
      totalSize += s.fileSizeBytes;
      const projectName = extractProjectName(f);
      const firstPrompt = extractFirstPrompt(f);
      const sessionId = path.basename(f, ".jsonl");
      stats.push({
        file: path.relative(PROJECTS_DIR, f),
        fullPath: f,
        projectName,
        firstPrompt,
        sessionId,
        messages: s.totalMessages,
        images: s.imageCount,
        documents: s.documentCount,
        problematic: s.problematicContent,
        size: s.fileSizeBytes,
        modified: s.lastModified,
      });
    } catch { /* skip */ }
  }
  stats.sort((a, b) => (b as { size: number }).size - (a as { size: number }).size);
  return { totalFiles: files.length, totalMessages, totalImages, totalSize, stats: stats.slice(0, 50) };
}

function getArchiveCandidates(): Record<string, unknown> {
  const candidates = findArchiveCandidates(PROJECTS_DIR, { minDaysInactive: 30 });
  let totalSize = 0;
  for (const c of candidates) totalSize += c.sizeBytes;
  return {
    totalCandidates: candidates.length,
    totalSize,
    candidates: candidates.slice(0, 50).map(c => ({
      file: path.relative(PROJECTS_DIR, c.file),
      fullPath: c.file,
      projectName: extractProjectName(c.file),
      firstPrompt: extractFirstPrompt(c.file),
      size: c.sizeBytes,
      lastModified: c.lastModified,
      daysInactive: c.daysSinceActivity,
      messageCount: c.messageCount,
    })),
  };
}

function getMaintenanceCheck(): Record<string, unknown> {
  const report = runMaintenance(PROJECTS_DIR, { dryRun: true });
  return {
    status: report.status,
    actions: report.actions.map(a => ({
      type: a.type,
      description: a.description,
      sizeBytes: a.sizeBytes,
      count: a.count,
    })),
    totalActions: report.actions.length,
    estimatedSpace: report.actions.reduce((s, a) => s + (a.sizeBytes || 0), 0),
  };
}

function getScan(): Record<string, unknown> {
  const config = getConfig();
  let options: any = {};
  try {
    const settings = config.settings as any;
    if (settings && settings.exists && typeof settings.content === 'string') {
      const parsed = JSON.parse(settings.content);
      if (parsed.scanner) options = parsed.scanner;
    }
  } catch { }

  const files = findAllJsonlFiles(PROJECTS_DIR);
  const results: Record<string, unknown>[] = [];
  let totalIssues = 0;
  for (const f of files) {
    try {
      const r = scanFile(f, options);
      if (r.issues.length > 0) {
        totalIssues += r.issues.length;
        results.push({
          file: path.relative(PROJECTS_DIR, f),
          fullPath: f,
          issues: r.issues.map(i => ({
            line: i.line,
            type: i.contentType,
            size: i.estimatedSize,
          })),
        });
      }
    } catch { /* skip */ }
  }
  return { totalFiles: files.length, totalIssues, filesWithIssues: results.length, results };
}

function getSearch(params: Record<string, string>): Record<string, unknown> {
  const query = params.q || params.query;
  if (!query || query.length < 2) return { results: [], count: 0, error: "Query too short" };

  const roleFilter = params.role || '';
  const maxResults = Math.min(parseInt(params.limit) || 50, 500);
  const files = findAllJsonlFiles(PROJECTS_DIR);
  const results: any[] = [];
  let count = 0;

  const lowerQuery = query.toLowerCase();

  for (const file of files) {
    if (count >= maxResults) break;
    try {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes(lowerQuery)) {
          let preview = line;
          let role = 'unknown';
          try {
            const data = JSON.parse(line);
            role = data.message?.role || data.role || (data.type === 'human' ? 'user' : data.type === 'assistant' ? 'assistant' : 'unknown');
            if (data.message?.content) {
              if (typeof data.message.content === 'string') preview = data.message.content;
              else if (Array.isArray(data.message.content)) preview = data.message.content.map((c: any) => c.text || '').join(' ');
            } else if (data.type === 'message' && data.content) {
              preview = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
            }
          } catch { }

          if (roleFilter && role !== roleFilter) continue;

          if (preview.length > 300) preview = preview.slice(0, 300) + '...';

          results.push({
            file,
            line: i + 1,
            preview,
            role,
            match: true
          });
          count++;
          if (count >= maxResults) break;
        }
      }
    } catch { }
  }

  return { results, count, query };
}

// ===== POST action handlers =====

function actionClean(body: Record<string, unknown>): Record<string, unknown> {
  const dryRun = body.dryRun !== false;
  const days = (body.days as number) || 7;
  const category = body.category as string | undefined;
  const result = cleanClaudeDirectory(undefined, {
    dryRun,
    days,
    categories: category ? [category] : undefined,
  });
  return { success: true, deleted: result.deleted.length, freed: result.freed, dryRun, errors: result.errors, items: result.deleted.slice(0, 50) };
}

function actionFix(body: Record<string, unknown>): Record<string, unknown> {
  const filePath = body.file as string;
  if (!filePath) return { success: false, error: "file path required" };
  const result = fixFile(filePath);
  return { success: result.fixed, issues: result.issues.length, backupPath: result.backupPath, error: result.error };
}

function actionFixAll(): Record<string, unknown> {
  const files = findAllJsonlFiles(PROJECTS_DIR);
  let fixed = 0;
  let errors = 0;
  const fixedFiles: string[] = [];
  const errorFiles: string[] = [];
  for (const file of files) {
    try {
      const scan = scanFile(file);
      if (scan.issues.length > 0) {
        const result = fixFile(file);
        if (result.fixed) { fixed++; fixedFiles.push(file); }
        else { errors++; errorFiles.push(file); }
      }
    } catch { errors++; errorFiles.push(file); }
  }
  return { success: true, fixed, errors, total: files.length, fixedFiles: fixedFiles.slice(0, 50), errorFiles: errorFiles.slice(0, 10) };
}

function actionRepair(body: Record<string, unknown>): Record<string, unknown> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return { success: false, error: "sessionId required" };
  const sessions = listSessions();
  const match = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));
  if (!match) return { success: false, error: "Session not found" };
  const result = repairSession(match.filePath);
  return { success: result.success, linesRemoved: result.linesRemoved, linesFixed: result.linesFixed, backupPath: result.backupPath, error: result.error };
}

function actionExtract(body: Record<string, unknown>): Record<string, unknown> {
  const sessionId = body.sessionId as string;
  if (!sessionId) return { success: false, error: "sessionId required" };
  const sessions = listSessions();
  const match = sessions.find(s => s.id === sessionId || s.id.startsWith(sessionId));
  if (!match) return { success: false, error: "Session not found" };
  const content = extractSessionContent(match.filePath);
  return {
    success: true,
    userMessages: content.userMessages.length,
    assistantMessages: content.assistantMessages.length,
    fileEdits: content.fileEdits.length,
    commandsRun: content.commandsRun.length,
    sampleMessages: content.userMessages.slice(0, 5).map(m => m.length > 200 ? m.slice(0, 200) + "..." : m),
    sampleCommands: content.commandsRun.slice(0, 10),
    editedFiles: content.fileEdits.slice(0, 20).map(e => e.path),
  };
}

function actionRetention(body: Record<string, unknown>): Record<string, unknown> {
  const dryRun = body.dryRun !== false;
  const days = (body.days as number) || 30;
  const result = enforceRetention(undefined, { days, dryRun });
  return { success: true, sessionsDeleted: result.sessionsDeleted, spaceFreed: result.spaceFreed, dryRun, errors: result.errors };
}

function actionCleanTraces(body: Record<string, unknown>): Record<string, unknown> {
  const dryRun = body.dryRun !== false;
  const days = body.days as number | undefined;
  const categories = body.categories as string[] | undefined;
  const exclusions = body.exclusions as TraceExclusion[] | undefined;
  const result = cleanTraces(undefined, { dryRun, days, categories, exclusions });
  return { success: true, deleted: result.deleted.length, freed: result.freed, dryRun, categoriesAffected: result.categoriesAffected, errors: result.errors, items: result.deleted.slice(0, 50) };
}

function actionPreviewTraces(body: Record<string, unknown>): Record<string, unknown> {
  const operation = (body.operation as "clean" | "wipe") || "clean";
  const options = body.options as { exclusions?: TraceExclusion[]; days?: number; categories?: string[] } | undefined;
  const preview = generateEnhancedPreview(undefined, {
    operation,
    exclusions: options?.exclusions,
    days: options?.days,
    categories: options?.categories,
  });
  return { success: true, ...preview };
}

function actionRedact(body: Record<string, unknown>): Record<string, unknown> {
  const file = body.file as string;
  const lineNum = body.line as number;
  const patternType = body.pattern as string;
  if (!file || !lineNum) return { success: false, error: "file and line required" };
  if (!fs.existsSync(file)) return { success: false, error: "File not found" };
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = file.replace(".jsonl", `.backup.${timestamp}.jsonl`);
  try { fs.copyFileSync(file, backupPath); } catch { return { success: false, error: "Failed to create backup" }; }
  const content = fs.readFileSync(file, "utf-8");
  const lines = content.split("\n");
  if (lineNum < 1 || lineNum > lines.length) return { success: false, error: "Line out of range" };
  const line = lines[lineNum - 1];
  if (!line.trim()) return { success: false, error: "Empty line" };
  let redacted = line;
  let count = 0;
  const patterns = patternType
    ? SECRET_PATTERNS.filter(p => p.type === patternType || p.name === patternType)
    : SECRET_PATTERNS;
  for (const pat of patterns) {
    pat.regex.lastIndex = 0;
    const before = redacted;
    redacted = redacted.replace(pat.regex, "[REDACTED]");
    if (redacted !== before) count++;
  }
  if (count === 0) return { success: false, error: "No matching secrets found on this line" };
  lines[lineNum - 1] = redacted;
  fs.writeFileSync(file, lines.join("\n"), "utf-8");
  return { success: true, redactedCount: count, backupPath };
}

function actionRedactAll(): Record<string, unknown> {
  const scan = scanForSecrets();
  if (scan.totalFindings === 0) return { success: true, filesModified: 0, secretsRedacted: 0 };
  const fileGroups = new Map<string, { line: number; type: string }[]>();
  for (const f of scan.findings) {
    const existing = fileGroups.get(f.file) || [];
    existing.push({ line: f.line, type: f.type });
    fileGroups.set(f.file, existing);
  }
  let filesModified = 0;
  let secretsRedacted = 0;
  const errors: string[] = [];
  for (const [file, findings] of fileGroups) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupPath = file.replace(".jsonl", `.backup.${timestamp}.jsonl`);
      fs.copyFileSync(file, backupPath);
      const content = fs.readFileSync(file, "utf-8");
      const lines = content.split("\n");
      let modified = false;
      const processedLines = new Set<number>();
      for (const f of findings) {
        if (processedLines.has(f.line)) continue;
        processedLines.add(f.line);
        if (f.line < 1 || f.line > lines.length) continue;
        let line = lines[f.line - 1];
        for (const pat of SECRET_PATTERNS) {
          pat.regex.lastIndex = 0;
          const before = line;
          line = line.replace(pat.regex, "[REDACTED]");
          if (line !== before) { secretsRedacted++; modified = true; }
        }
        lines[f.line - 1] = line;
      }
      if (modified) {
        fs.writeFileSync(file, lines.join("\n"), "utf-8");
        filesModified++;
      }
    } catch (err) {
      errors.push(`${file}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return { success: true, filesModified, secretsRedacted, errors, items: Array.from(fileGroups.keys()).slice(0, 50) };
}

function actionRedactPII(body: Record<string, unknown>): Record<string, unknown> {
  const file = body.file as string;
  const lineNum = body.line as number;
  const piiType = body.type as string | undefined;
  if (!file || !lineNum) return { success: false, error: "file and line required" };
  const result = redactPII(file, lineNum, piiType);
  return { ...result };
}

function actionRedactAllPII(): Record<string, unknown> {
  const result = redactAllPII();
  return { ...result };
}

function actionArchive(body: Record<string, unknown>): Record<string, unknown> {
  const dryRun = body.dryRun !== false;
  const days = (body.days as number) || 30;
  const result = archiveConversations(PROJECTS_DIR, { minDaysInactive: days, dryRun });
  return { success: true, archived: result.archived.length, spaceFreed: result.totalSize, dryRun, error: result.error, items: result.archived.slice(0, 50) };
}

function actionMaintenanceRun(body: Record<string, unknown>): Record<string, unknown> {
  const auto = body.auto === true;
  const report = runMaintenance(PROJECTS_DIR, { dryRun: !auto });
  return {
    success: true,
    status: report.status,
    actionsPerformed: report.actions.length,
    actions: report.actions.map(a => ({ type: a.type, description: a.description, sizeBytes: a.sizeBytes })),
    auto,
  };
}

function actionDeleteBackups(body: Record<string, unknown>): Record<string, unknown> {
  const days = (body.days as number) || 7;
  const result = deleteOldBackups(PROJECTS_DIR, days);
  return { success: true, deleted: result.deleted.length, errors: result.errors, items: result.deleted.slice(0, 50) };
}

function actionRestore(body: Record<string, unknown>): Record<string, unknown> {
  const backupPath = body.backupPath as string;
  if (!backupPath) return { success: false, error: "backupPath required" };
  const result = restoreFromBackup(backupPath);
  return { success: result.success, originalPath: result.originalPath, error: result.error };
}

function actionExport(body: Record<string, unknown>): Record<string, unknown> {
  const filePath = body.file as string;
  const format = (body.format as string) === "json" ? "json" : "markdown";
  if (!filePath) return { success: false, error: "file path required" };
  if (!fs.existsSync(filePath)) return { success: false, error: "File not found" };
  const result = exportConversation(filePath, {
    format: format as "markdown" | "json",
    includeToolResults: body.includeTools === true,
    includeTimestamps: true,
  });
  return { success: true, messageCount: result.messageCount, format };
}

function actionWipeTraces(body: Record<string, unknown>): Record<string, unknown> {
  if (body.confirm !== true) return { success: false, error: "Confirmation required: set confirm=true" };
  const exclusions = body.exclusions as TraceExclusion[] | undefined;
  const result = wipeAllTraces(undefined, {
    confirm: true,
    keepSettings: body.keepSettings === true,
    exclusions,
  });
  return { success: true, filesWiped: result.filesWiped, bytesFreed: result.bytesFreed, categoriesWiped: result.categoriesWiped, preserved: result.preserved };
}

async function actionTestMcp(): Promise<Record<string, unknown>> {
  const report = await diagnoseMcpServers({ test: true });
  return {
    totalServers: report.totalServers,
    healthyServers: report.healthyServers,
    configs: report.configs.map(c => ({
      configPath: c.configPath,
      servers: c.servers.map(s => ({ name: s.name, command: s.command, type: s.type })),
      issues: c.issues,
      valid: c.valid,
    })),
    recommendations: report.recommendations,
  };
}

function actionAddMcpServer(body: Record<string, unknown>): Record<string, unknown> {
  const name = body.name as string;
  const command = body.command as string;
  const args = body.args as string[] | undefined;
  const env = body.env as Record<string, string> | undefined;
  const target = (body.target as string) || "global";

  if (!name || !command) {
    return { success: false, error: "Name and command are required" };
  }

  const configPath = target === "project"
    ? path.join(process.cwd(), ".mcp.json")
    : path.join(os.homedir(), ".claude.json");

  try {
    let config: Record<string, unknown> = {};
    if (fs.existsSync(configPath)) {
      const content = fs.readFileSync(configPath, "utf-8");
      config = JSON.parse(content);
    }

    if (!config.mcpServers) {
      config.mcpServers = {};
    }

    const mcpServers = config.mcpServers as Record<string, unknown>;
    if (mcpServers[name]) {
      return { success: false, error: `Server "${name}" already exists` };
    }

    const serverConfig: Record<string, unknown> = { command };
    if (args && args.length > 0) serverConfig.args = args;
    if (env && Object.keys(env).length > 0) serverConfig.env = env;

    mcpServers[name] = serverConfig;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    return { success: true, configPath, serverName: name };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ===== Route tables =====

const getRoutes: Record<string, RouteHandler> = {
  "/api/overview": () => getOverview(),
  "/api/storage": () => getStorage(),
  "/api/sessions": () => getSessions(),
  "/api/security": () => getSecurity(),
  "/api/compliance": () => getCompliance(),
  "/api/traces": () => getTraces(),
  "/api/mcp": () => getMcp(),
  "/api/logs": (params) => getLogs(params),
  "/api/config": () => getConfig(),
  "/api/analytics": () => getAnalytics(),
  "/api/duplicates": () => getDuplicates(),
  "/api/context": () => getContext(),
  "/api/backups": () => getBackups(),
  "/api/stats": () => getStats(),
  "/api/archive/candidates": () => getArchiveCandidates(),
  "/api/maintenance": () => getMaintenanceCheck(),
  "/api/scan": () => getScan(),
  "/api/search": (params) => getSearch(params),
  "/api/alerts": () => {
    const report = checkAlerts();
    return { alerts: report.alerts, critical: report.critical, warning: report.warning, info: report.info };
  },
  "/api/quotas": () => {
    const quotas = checkQuotas();
    return { quotas };
  },
  "/api/mcp-perf": () => {
    const report = analyzeMcpPerformance();
    return { totalCalls: report.totalCalls, totalErrors: report.totalErrors, errorRate: report.errorRate, toolStats: report.toolStats, serverStats: Object.fromEntries(report.serverStats) };
  },
  "/api/pii": (params) => {
    const limit = parseInt(params?.limit as string) || 50;
    const offset = parseInt(params?.offset as string) || 0;
    const result = scanForPII(undefined, { includeFullValues: true });
    const paginatedFindings = result.findings.slice(offset, offset + limit);
    return {
      filesScanned: result.filesScanned,
      totalFindings: result.totalFindings,
      findings: paginatedFindings,
      byCategory: result.byCategory,
      bySensitivity: result.bySensitivity,
      offset,
      limit,
      hasMore: offset + limit < result.totalFindings
    };
  },
  "/api/git": () => {
    const report = linkSessionsToGit();
    return { sessionsWithGit: report.sessionsWithGit, sessionsWithoutGit: report.sessionsWithoutGit, branches: Object.fromEntries(report.branches), links: report.links.slice(0, 20) };
  },
  "/api/cost": () => {
    const files = findAllJsonlFiles(PROJECTS_DIR);
    let totalInput = 0, totalOutput = 0;
    for (const f of files) {
      try {
        const est = estimateContextSize(f);
        const b = est.breakdown;
        totalInput += b.userTokens + b.systemTokens + b.toolUseTokens;
        totalOutput += b.assistantTokens + b.toolResultTokens;
      } catch { /* skip */ }
    }
    const inputCost = (totalInput / 1_000_000) * 15;
    const outputCost = (totalOutput / 1_000_000) * 75;
    return { inputTokens: totalInput, outputTokens: totalOutput, totalTokens: totalInput + totalOutput, inputCost, outputCost, totalCost: inputCost + outputCost, sessions: files.length };
  },
  "/api/snapshots": () => ({ snapshots: listStorageSnapshots() }),
  "/api/snapshot": (params) => {
    const id = params?.id as string;
    if (!id) return { error: "Snapshot ID required" };
    const s = loadStorageSnapshot(id);
    return s ? { success: true, snapshot: s } : { success: false, error: "Not found" };
  },
  "/api/compare": (params) => {
    const id1 = params?.base as string;
    const id2 = params?.current as string;
    if (!id1 || !id2) return { error: "base and current IDs required" };
    const s1 = loadStorageSnapshot(id1);
    const s2 = loadStorageSnapshot(id2);
    if (!s1 || !s2) return { error: "Snapshots not found" };
    const diff = compareStorageSnapshots(s1.analysis, s2.analysis);
    return { success: true, diff, baseDate: s1.date, currentDate: s2.date };
  }
};

const postRoutes: Record<string, PostHandler> = {
  "/api/action/clean": (b) => actionClean(b),
  "/api/action/fix": (b) => actionFix(b),
  "/api/action/fix-all": () => actionFixAll(),
  "/api/action/repair": (b) => actionRepair(b),
  "/api/action/extract": (b) => actionExtract(b),
  "/api/action/retention": (b) => actionRetention(b),
  "/api/action/preview-traces": (b) => actionPreviewTraces(b),
  "/api/action/clean-traces": (b) => actionCleanTraces(b),
  "/api/action/redact": (b) => actionRedact(b),
  "/api/action/redact-all": () => actionRedactAll(),
  "/api/action/redact-pii": (b) => actionRedactPII(b),
  "/api/action/redact-all-pii": () => actionRedactAllPII(),
  "/api/action/archive": (b) => actionArchive(b),
  "/api/action/maintenance": (b) => actionMaintenanceRun(b),
  "/api/action/delete-backups": (b) => actionDeleteBackups(b),
  "/api/action/restore": (b) => actionRestore(b),
  "/api/action/export": (b) => actionExport(b),
  "/api/action/wipe-traces": (b) => actionWipeTraces(b),
  "/api/action/test-mcp": () => actionTestMcp(),
  "/api/action/add-mcp-server": (b) => actionAddMcpServer(b),
  "/api/action/save-config": (b) => actionSaveConfig(b),
  "/api/action/snapshot": (b) => {
    const label = (b.label as string) || "Manual Snapshot";
    const analysis = analyzeClaudeStorage();
    const id = saveStorageSnapshot(analysis, label);
    return { success: true, id };
  },
  "/api/action/delete-snapshot": (b) => {
    const id = b.id as string;
    if (!id) return { success: false, error: "ID required" };
    return { success: deleteStorageSnapshot(id) };
  }
};

export function createDashboardServer(authToken?: string): http.Server {
  const html = generateDashboardHTML();

  const server = http.createServer(async (req, res) => {
    const { pathname, params } = parseUrl(req.url || "/");

    if (req.method === "GET" && pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && pathname === "/api/events") {
      if (!extractBearerToken(req, params, authToken)) {
        rejectUnauthorized(res);
        return;
      }
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      });

      const sendEvent = (event: string, data: unknown) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      sendEvent("connected", { time: new Date().toISOString() });

      const interval = setInterval(() => {
        try {
          const files = findAllJsonlFiles(PROJECTS_DIR);
          let totalSize = 0;
          for (const f of files) {
            try { totalSize += fs.statSync(f).size; } catch { /* skip */ }
          }
          sendEvent("stats", {
            sessions: files.length,
            totalSize,
            timestamp: new Date().toISOString(),
          });

          const alertReport = checkAlerts();
          if (alertReport.alerts.length > 0) {
            sendEvent("alerts", { count: alertReport.alerts.length, critical: alertReport.critical });
          }
        } catch { /* skip */ }
      }, 10000);

      req.on("close", () => {
        clearInterval(interval);
      });

      return;
    }

    if (req.method === "GET" && pathname.startsWith("/api/")) {
      if (!extractBearerToken(req, params, authToken)) {
        rejectUnauthorized(res);
        return;
      }
      const handler = getRoutes[pathname];
      if (handler) {
        try {
          const data = await handler(params);
          res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
          res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }

      const sessionMatch = matchRoute(pathname, "/api/session/:id");
      if (sessionMatch) {
        try {
          const data = getSessionDetail(sessionMatch.id);
          if (!data) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Session not found" }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
            res.end(JSON.stringify(data));
          }
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }

      const auditMatch = matchRoute(pathname, "/api/session/:id/audit");
      if (auditMatch) {
        try {
          const data = getSessionAudit(auditMatch.id);
          if (!data) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Session not found" }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
            res.end(JSON.stringify(data));
          }
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }

      const findingMatch = matchRoute(pathname, "/api/security/finding/:file/:line");
      if (findingMatch) {
        try {
          const data = getSecurityFindingPreview(decodeURIComponent(findingMatch.file), parseInt(findingMatch.line, 10));
          if (!data) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Finding not found" }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
            res.end(JSON.stringify(data));
          }
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }

      const mcpCapMatch = matchRoute(pathname, "/api/mcp/server/:name/capabilities");
      if (mcpCapMatch) {
        try {
          const data = await getMcpServerCapabilities(decodeURIComponent(mcpCapMatch.name));
          if (!data) {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Server not found" }));
          } else {
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-cache" });
            res.end(JSON.stringify(data));
          }
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }
    }

    if (req.method === "POST" && pathname.startsWith("/api/action/")) {
      if (!extractBearerToken(req, params, authToken)) {
        rejectUnauthorized(res);
        return;
      }
      const handler = postRoutes[pathname];
      if (handler) {
        try {
          const body = await readBody(req);
          const data = await handler(body);
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify(data));
        } catch (err) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
        }
        return;
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not Found");
  });

  return server;
}

export async function startDashboard(options?: DashboardOptions): Promise<http.Server> {
  const port = options?.port || 1405;
  const shouldOpen = options?.open !== false;

  const server = createDashboardServer(options?.authToken);

  return new Promise((resolve, reject) => {
    server.on("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Try a different port with --port.`);
      }
      reject(err);
    });

    server.listen(port, "127.0.0.1", () => {
      const url = `http://localhost:${port}`;
      console.log(`Dashboard running at ${url}`);
      if (options?.authToken) {
        console.log("Authentication required: include the dashboard token in Authorization headers.");
      }

      if (options?.daemon) {
        try {
          fs.writeFileSync(PID_FILE, String(process.pid));
        } catch { /* skip */ }
        console.log(`Running as daemon (PID: ${process.pid})`);
        console.log(`Stop with: cct dashboard --stop`);
      } else {
        console.log("Press Ctrl+C to stop.\n");
      }

      if (shouldOpen) {
        const platform = os.platform();
        if (platform === "win32") {
          execFile("cmd", ["/c", "start", "", url], () => { });
        } else if (platform === "darwin") {
          execFile("open", [url], () => { });
        } else {
          execFile("xdg-open", [url], () => { });
        }
      }

      resolve(server);
    });
  });
}

export function stopDashboard(): boolean {
  try {
    if (!fs.existsSync(PID_FILE)) return false;
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    process.kill(pid, "SIGTERM");
    fs.unlinkSync(PID_FILE);
    return true;
  } catch {
    try { fs.unlinkSync(PID_FILE); } catch { /* skip */ }
    return false;
  }
}

export function isDashboardRunning(): { running: boolean; pid?: number; port?: number } {
  try {
    if (!fs.existsSync(PID_FILE)) return { running: false };
    const pid = parseInt(fs.readFileSync(PID_FILE, "utf-8").trim(), 10);
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    return { running: false };
  }
}
