import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export interface SecretFinding {
  file: string;
  line: number;
  type: string;
  pattern: string;
  maskedPreview: string;
  severity: "critical" | "high" | "medium";
}

export interface SecretsScanResult {
  filesScanned: number;
  totalFindings: number;
  findings: SecretFinding[];
  summary: Record<string, number>;
  scannedAt: Date;
}

export interface SessionAction {
  type: "file_read" | "file_write" | "command" | "mcp_tool" | "web_fetch";
  detail: string;
  timestamp?: string;
}

export interface SessionAudit {
  sessionPath: string;
  actions: SessionAction[];
  filesRead: string[];
  filesWritten: string[];
  commandsRun: string[];
  mcpToolsUsed: string[];
  urlsFetched: string[];
  duration?: number;
}

export interface RetentionResult {
  sessionsDeleted: number;
  sessionsExported: number;
  spaceFreed: number;
  errors: string[];
  dryRun: boolean;
}

export interface ComplianceReport {
  secretsScan: SecretsScanResult;
  sessionCount: number;
  oldestSession?: Date;
  retentionStatus: string;
  generatedAt: Date;
}

interface SecretPattern {
  name: string;
  type: string;
  regex: RegExp;
  severity: "critical" | "high" | "medium";
}

const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key ID",
    type: "aws_key",
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
  },
  {
    name: "AWS Secret Access Key",
    type: "aws_secret",
    regex: /(?:aws_secret_access_key|AWS_SECRET_ACCESS_KEY)['"=:\s]+([A-Za-z0-9/+=]{40})/gi,
    severity: "critical",
  },
  {
    name: "API Token (ghp_, xoxb-, sk-)",
    type: "api_token",
    regex: /(?:ghp_[A-Za-z0-9]{36,}|xoxb-[A-Za-z0-9-]+|xoxp-[A-Za-z0-9-]+)/g,
    severity: "high",
  },
  {
    name: "sk- API Key",
    type: "api_key",
    regex: /sk-[A-Za-z0-9]{20,}/g,
    severity: "high",
  },
  {
    name: "Private Key",
    type: "private_key",
    regex: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/g,
    severity: "critical",
  },
  {
    name: "Connection String",
    type: "connection_string",
    regex: /(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+:[^\s'"]+@[^\s'"]+/g,
    severity: "high",
  },
  {
    name: "JWT Token",
    type: "jwt",
    regex: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
    severity: "medium",
  },
  {
    name: "Password in Config",
    type: "password",
    regex: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{4,}["']/gi,
    severity: "high",
  },
  {
    name: "Slack Token",
    type: "slack_token",
    regex: /xox[bpras]-[A-Za-z0-9-]+/g,
    severity: "high",
  },
  {
    name: "Generic Secret Assignment",
    type: "generic_secret",
    regex: /(?:secret|api_key|apikey|access_token)\s*[=:]\s*["'][A-Za-z0-9+/=]{16,}["']/gi,
    severity: "medium",
  },
];

function maskSecret(value: string): string {
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

function findJsonlFiles(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile() && entry.name.endsWith(".jsonl") && !entry.name.includes(".backup.")) {
          files.push(full);
        }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return files;
}

function extractTextFromMessage(parsed: Record<string, unknown>): string[] {
  const texts: string[] = [];
  const message = parsed.message as Record<string, unknown> | undefined;
  if (!message || !message.content) return texts;

  const content = Array.isArray(message.content) ? message.content : [message.content];
  for (const block of content as Record<string, unknown>[]) {
    if (block.type === "text" && typeof block.text === "string") {
      texts.push(block.text);
    }
    if (block.type === "tool_use") {
      const input = block.input as Record<string, unknown> | undefined;
      if (input) {
        for (const value of Object.values(input)) {
          if (typeof value === "string") {
            texts.push(value);
          }
        }
      }
    }
  }
  return texts;
}

export function scanForSecrets(projectsDir = PROJECTS_DIR, options?: { file?: string }): SecretsScanResult {
  const result: SecretsScanResult = {
    filesScanned: 0,
    totalFindings: 0,
    findings: [],
    summary: {},
    scannedAt: new Date(),
  };

  let files: string[];
  if (options?.file) {
    files = [options.file];
  } else {
    files = findJsonlFiles(projectsDir);
  }

  for (const file of files) {
    result.filesScanned++;
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      const texts = extractTextFromMessage(parsed);
      for (const text of texts) {
        for (const pattern of SECRET_PATTERNS) {
          pattern.regex.lastIndex = 0;
          const matches = text.match(pattern.regex);
          if (matches) {
            for (const match of matches) {
              result.findings.push({
                file,
                line: i + 1,
                type: pattern.type,
                pattern: pattern.name,
                maskedPreview: maskSecret(match),
                severity: pattern.severity,
              });
              result.summary[pattern.type] = (result.summary[pattern.type] || 0) + 1;
              result.totalFindings++;
            }
          }
        }
      }
    }
  }

  return result;
}

export function auditSession(sessionPath: string): SessionAudit {
  const audit: SessionAudit = {
    sessionPath,
    actions: [],
    filesRead: [],
    filesWritten: [],
    commandsRun: [],
    mcpToolsUsed: [],
    urlsFetched: [],
  };

  let content: string;
  try {
    content = fs.readFileSync(sessionPath, "utf-8");
  } catch {
    return audit;
  }

  const lines = content.split("\n");
  let firstTimestamp: Date | null = null;
  let lastTimestamp: Date | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    if (parsed.timestamp) {
      const ts = new Date(parsed.timestamp as string);
      if (!isNaN(ts.getTime())) {
        if (!firstTimestamp) firstTimestamp = ts;
        lastTimestamp = ts;
      }
    }

    const message = parsed.message as Record<string, unknown> | undefined;
    if (!message || !message.content) continue;

    const contentArr = Array.isArray(message.content) ? message.content : [message.content];
    for (const block of contentArr as Record<string, unknown>[]) {
      if (block.type !== "tool_use") continue;

      const name = block.name as string;
      const input = block.input as Record<string, unknown> | undefined;
      if (!input) continue;

      const timestamp = parsed.timestamp as string | undefined;

      if (name === "Read") {
        const filePath = input.file_path as string;
        if (filePath && !audit.filesRead.includes(filePath)) {
          audit.filesRead.push(filePath);
        }
        audit.actions.push({ type: "file_read", detail: filePath || "", timestamp });
      }

      if (name === "Write" || name === "Edit") {
        const filePath = (input.file_path || input.path) as string;
        if (filePath && !audit.filesWritten.includes(filePath)) {
          audit.filesWritten.push(filePath);
        }
        audit.actions.push({ type: "file_write", detail: filePath || "", timestamp });
      }

      if (name === "Bash") {
        const command = input.command as string;
        if (command && !audit.commandsRun.includes(command)) {
          audit.commandsRun.push(command);
        }
        audit.actions.push({ type: "command", detail: command || "", timestamp });
      }

      if (name === "WebFetch") {
        const url = input.url as string;
        if (url && !audit.urlsFetched.includes(url)) {
          audit.urlsFetched.push(url);
        }
        audit.actions.push({ type: "web_fetch", detail: url || "", timestamp });
      }

      if (name.startsWith("mcp__")) {
        if (!audit.mcpToolsUsed.includes(name)) {
          audit.mcpToolsUsed.push(name);
        }
        audit.actions.push({ type: "mcp_tool", detail: name, timestamp });
      }
    }
  }

  if (firstTimestamp && lastTimestamp) {
    audit.duration = Math.round((lastTimestamp.getTime() - firstTimestamp.getTime()) / 60000);
  }

  return audit;
}

export function enforceRetention(projectsDir = PROJECTS_DIR, options?: { days?: number; dryRun?: boolean }): RetentionResult {
  const days = options?.days ?? 30;
  const dryRun = options?.dryRun ?? true;
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;

  const result: RetentionResult = {
    sessionsDeleted: 0,
    sessionsExported: 0,
    spaceFreed: 0,
    errors: [],
    dryRun,
  };

  const files = findJsonlFiles(projectsDir);
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (stat.mtime.getTime() < threshold) {
        result.sessionsDeleted++;
        result.spaceFreed += stat.size;
        if (!dryRun) {
          fs.unlinkSync(file);
        }
      }
    } catch (e) {
      result.errors.push(`${file}: ${e}`);
    }
  }

  return result;
}

export function generateComplianceReport(projectsDir = PROJECTS_DIR): ComplianceReport {
  const secretsScan = scanForSecrets(projectsDir);
  const files = findJsonlFiles(projectsDir);

  let oldestSession: Date | undefined;
  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      if (!oldestSession || stat.mtime < oldestSession) {
        oldestSession = stat.mtime;
      }
    } catch { /* skip */ }
  }

  return {
    secretsScan,
    sessionCount: files.length,
    oldestSession,
    retentionStatus: oldestSession
      ? `Oldest session: ${Math.round((Date.now() - oldestSession.getTime()) / (24 * 60 * 60 * 1000))} days old`
      : "No sessions found",
    generatedAt: new Date(),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatSecretsScanReport(result: SecretsScanResult): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         SECRETS SCAN REPORT                  ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Files scanned: ${result.filesScanned}\n`;
  output += `Total findings: ${result.totalFindings}\n\n`;

  if (result.totalFindings === 0) {
    output += "No secrets found. ✓\n";
    return output;
  }

  output += "Findings by type:\n";
  for (const [type, count] of Object.entries(result.summary)) {
    output += `  ${type}: ${count}\n`;
  }
  output += "\nDetails:\n";

  for (const finding of result.findings.slice(0, 25)) {
    const icon = finding.severity === "critical" ? "✗" : finding.severity === "high" ? "⚠" : "ℹ";
    output += `  ${icon} [${finding.severity}] ${finding.pattern}\n`;
    output += `    File: ${path.basename(finding.file)} Line: ${finding.line}\n`;
    output += `    Preview: ${finding.maskedPreview}\n`;
  }

  if (result.findings.length > 25) {
    output += `\n  ... and ${result.findings.length - 25} more findings\n`;
  }

  return output;
}

export function formatAuditReport(audit: SessionAudit): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         SESSION AUDIT REPORT                 ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Session: ${path.basename(audit.sessionPath)}\n`;
  output += `Total actions: ${audit.actions.length}\n`;
  if (audit.duration) output += `Duration: ${audit.duration} minutes\n`;
  output += "\n";

  if (audit.filesRead.length > 0) {
    output += `Files Read (${audit.filesRead.length}):\n`;
    for (const f of audit.filesRead) {
      output += `  ${f}\n`;
    }
    output += "\n";
  }

  if (audit.filesWritten.length > 0) {
    output += `Files Written (${audit.filesWritten.length}):\n`;
    for (const f of audit.filesWritten) {
      output += `  ${f}\n`;
    }
    output += "\n";
  }

  if (audit.commandsRun.length > 0) {
    output += `Commands Run (${audit.commandsRun.length}):\n`;
    for (const cmd of audit.commandsRun) {
      output += `  ${cmd}\n`;
    }
    output += "\n";
  }

  if (audit.mcpToolsUsed.length > 0) {
    output += `MCP Tools Used (${audit.mcpToolsUsed.length}):\n`;
    for (const tool of audit.mcpToolsUsed) {
      output += `  ${tool}\n`;
    }
    output += "\n";
  }

  if (audit.urlsFetched.length > 0) {
    output += `URLs Fetched (${audit.urlsFetched.length}):\n`;
    for (const url of audit.urlsFetched) {
      output += `  ${url}\n`;
    }
    output += "\n";
  }

  return output;
}

export function formatRetentionReport(result: RetentionResult): string {
  let output = "";

  if (result.dryRun) {
    output += "[DRY RUN] Retention policy preview:\n\n";
  } else {
    output += "Retention Policy Enforced:\n\n";
  }

  output += `Sessions to delete: ${result.sessionsDeleted}\n`;
  output += `Space to free: ${formatBytes(result.spaceFreed)}\n`;

  if (result.errors.length > 0) {
    output += `\nErrors:\n`;
    for (const err of result.errors) {
      output += `  ✗ ${err}\n`;
    }
  }

  if (result.dryRun) {
    output += "\nRun without --dry-run to enforce retention.\n";
  }

  return output;
}
