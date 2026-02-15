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

interface PIIPattern {
  name: string;
  type: string;
  regex: RegExp;
  category: "identifier" | "contact" | "financial" | "health" | "location";
  sensitivity: "high" | "medium" | "low";
}

const PII_PATTERNS: PIIPattern[] = [
  {
    name: "Email Address",
    type: "email",
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    category: "contact",
    sensitivity: "medium",
  },
  {
    name: "US Phone Number",
    type: "phone_us",
    regex: /(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    category: "contact",
    sensitivity: "medium",
  },
  {
    name: "International Phone",
    type: "phone_intl",
    regex: /\+(?:[0-9][-.\s]?){6,14}[0-9]/g,
    category: "contact",
    sensitivity: "medium",
  },
  {
    name: "Social Security Number",
    type: "ssn",
    regex: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    category: "identifier",
    sensitivity: "high",
  },
  {
    name: "Credit Card Number",
    type: "credit_card",
    regex: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
    category: "financial",
    sensitivity: "high",
  },
  {
    name: "IP Address",
    type: "ip_address",
    regex: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    category: "identifier",
    sensitivity: "low",
  },
  {
    name: "Date of Birth",
    type: "dob",
    regex: /\b(?:born|dob|birth(?:day|date)?)[:\s]+(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})/gi,
    category: "identifier",
    sensitivity: "medium",
  },
  {
    name: "Street Address",
    type: "address",
    regex: /\b\d+\s+[A-Za-z]+(?:\s+[A-Za-z]+)*\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b/gi,
    category: "location",
    sensitivity: "medium",
  },
  {
    name: "Passport Number",
    type: "passport",
    regex: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
    category: "identifier",
    sensitivity: "high",
  },
  {
    name: "Driver License",
    type: "drivers_license",
    regex: /\b(?:DL|driver'?s?\s+license)[:\s#]*[A-Z0-9]{5,15}\b/gi,
    category: "identifier",
    sensitivity: "high",
  },
  {
    name: "Bank Account",
    type: "bank_account",
    regex: /\b(?:account|acct)[:\s#]*[0-9]{8,17}\b/gi,
    category: "financial",
    sensitivity: "high",
  },
  {
    name: "IBAN",
    type: "iban",
    regex: /\b[A-Z]{2}[0-9]{2}[A-Z0-9]{4}[0-9]{7}(?:[A-Z0-9]?){0,16}\b/g,
    category: "financial",
    sensitivity: "high",
  },
];

export interface PIIFinding {
  file: string;
  line: number;
  type: string;
  pattern: string;
  maskedValue: string;
  fullValue?: string;
  category: string;
  sensitivity: "high" | "medium" | "low";
}

export interface PIIScanResult {
  filesScanned: number;
  totalFindings: number;
  findings: PIIFinding[];
  byCategory: Record<string, number>;
  bySensitivity: { high: number; medium: number; low: number };
  scannedAt: Date;
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

const TEXT_MEDIA_HINTS = ["text/", "application/json", "application/xml", "application/x-yaml", "application/yaml"];

function decodeDocumentBlock(block: Record<string, unknown>): string | null {
  const source = block.source as Record<string, unknown> | undefined;
  if (!source || source.type !== "base64") return null;
  const mediaType = (source.media_type as string | undefined) || "";
  if (!TEXT_MEDIA_HINTS.some((hint) => mediaType.includes(hint))) return null;
  const data = source.data as string | undefined;
  if (!data) return null;
  try {
    const buffer = Buffer.from(data, "base64");
    if (!buffer.length) return null;
    return buffer.toString("utf-8");
  } catch {
    return null;
  }
}

function collectTextFromContent(content: unknown): string[] {
  const texts: string[] = [];
  if (!content) return texts;
  if (typeof content === "string") {
    texts.push(content);
    return texts;
  }

  const blocks = Array.isArray(content) ? content : [content];
  for (const rawBlock of blocks) {
    if (!rawBlock || typeof rawBlock !== "object") continue;
    const block = rawBlock as Record<string, unknown>;
    const type = block.type as string | undefined;
    if (type === "text" && typeof block.text === "string") {
      texts.push(block.text);
      continue;
    }
    if (type === "tool_use") {
      const input = block.input as Record<string, unknown> | undefined;
      if (input) {
        for (const value of Object.values(input)) {
          if (typeof value === "string") {
            texts.push(value);
          }
        }
      }
      continue;
    }
    if (type === "document") {
      const decoded = decodeDocumentBlock(block);
      if (decoded) texts.push(decoded);
      continue;
    }
    if (type === "tool_result") {
      const inner = block.content;
      if (inner) {
        texts.push(...collectTextFromContent(inner));
      }
      continue;
    }
  }

  return texts;
}

function extractTextFromMessage(parsed: Record<string, unknown>): string[] {
  const message = parsed.message as Record<string, unknown> | undefined;
  if (!message || !message.content) return [];
  return collectTextFromContent(message.content);
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
      const toolResult = parsed.toolUseResult as Record<string, unknown> | undefined;
      if (toolResult) {
        if (toolResult.content) {
          texts.push(...collectTextFromContent(toolResult.content));
        }
        if (typeof toolResult.text === "string") {
          texts.push(toolResult.text);
        }
      }
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

export function scanForPII(projectsDir = PROJECTS_DIR, options?: { file?: string; includeFullValues?: boolean }): PIIScanResult {
  const result: PIIScanResult = {
    filesScanned: 0,
    totalFindings: 0,
    findings: [],
    byCategory: {},
    bySensitivity: { high: 0, medium: 0, low: 0 },
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
        for (const pattern of PII_PATTERNS) {
          pattern.regex.lastIndex = 0;
          const matches = text.match(pattern.regex);
          if (matches) {
            for (const match of matches) {
              if (shouldFilterPII(match, pattern.type)) continue;

              result.findings.push({
                file,
                line: i + 1,
                type: pattern.type,
                pattern: pattern.name,
                maskedValue: maskPII(match, pattern.type),
                fullValue: options?.includeFullValues ? match : undefined,
                category: pattern.category,
                sensitivity: pattern.sensitivity,
              });
              result.byCategory[pattern.category] = (result.byCategory[pattern.category] || 0) + 1;
              result.bySensitivity[pattern.sensitivity]++;
              result.totalFindings++;
            }
          }
        }
      }
    }
  }

  return result;
}

function shouldFilterPII(value: string, type: string): boolean {
  if (type === "email") {
    if (value.includes("@example.") || value.includes("@test.") || value.endsWith("@localhost")) {
      return true;
    }
    if (value.includes("noreply@") || value.includes("no-reply@")) {
      return true;
    }
  }
  if (type === "ip_address") {
    if (value.startsWith("127.") || value.startsWith("192.168.") || value.startsWith("10.") || value === "0.0.0.0") {
      return true;
    }
  }
  if (type === "phone_us") {
    if (value.includes("555-") || value.startsWith("1234") || value === "000-000-0000") {
      return true;
    }
  }
  return false;
}

function maskPII(value: string, type: string): string {
  if (type === "email") {
    const [local, domain] = value.split("@");
    return local.slice(0, 2) + "***@" + domain;
  }
  if (type === "ssn" || type === "credit_card" || type === "bank_account" || type === "iban") {
    return value.slice(0, 2) + "*".repeat(value.length - 6) + value.slice(-4);
  }
  if (type === "phone_us" || type === "phone_intl") {
    return value.slice(0, 3) + "***" + value.slice(-4);
  }
  if (value.length <= 6) return "***";
  return value.slice(0, 3) + "***" + value.slice(-3);
}

export function formatPIIScanReport(result: PIIScanResult, showDetails = false): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         PII SCAN REPORT                      ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Files scanned: ${result.filesScanned}\n`;
  output += `Total findings: ${result.totalFindings}\n\n`;

  if (result.totalFindings === 0) {
    output += "No PII found. ✓\n";
    return output;
  }

  output += "By Sensitivity:\n";
  output += `  \x1b[31mHigh:   ${result.bySensitivity.high}\x1b[0m\n`;
  output += `  \x1b[33mMedium: ${result.bySensitivity.medium}\x1b[0m\n`;
  output += `  \x1b[32mLow:    ${result.bySensitivity.low}\x1b[0m\n\n`;

  output += "By Category:\n";
  for (const [category, count] of Object.entries(result.byCategory)) {
    output += `  ${category}: ${count}\n`;
  }
  output += "\n";

  const limit = showDetails ? 50 : 25;
  output += `Details (first ${limit}):\n`;
  for (const finding of result.findings.slice(0, limit)) {
    const icon = finding.sensitivity === "high" ? "🔴" : finding.sensitivity === "medium" ? "🟡" : "🟢";
    output += `  ${icon} ${finding.pattern}\n`;
    output += `    File: ${path.basename(finding.file)} Line: ${finding.line}\n`;
    if (showDetails && finding.fullValue) {
      output += `    Value: \x1b[31m${finding.fullValue}\x1b[0m (unmasked)\n`;
    } else {
      output += `    Value: ${finding.maskedValue}\n`;
    }
  }

  if (result.findings.length > limit) {
    output += `\n  ... and ${result.findings.length - limit} more findings\n`;
  }

  return output;
}

export interface PIIRedactionResult {
  success: boolean;
  error?: string;
  redactedCount?: number;
  backupPath?: string;
  filesModified?: number;
  piiRedacted?: number;
  errors?: string[];
  items?: string[];
}

export function redactPII(file: string, lineNum: number, piiType?: string): PIIRedactionResult {
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
  const patterns = piiType
    ? PII_PATTERNS.filter(p => p.type === piiType || p.name === piiType)
    : PII_PATTERNS;
  for (const pat of patterns) {
    pat.regex.lastIndex = 0;
    const before = redacted;
    redacted = redacted.replace(pat.regex, "[PII_REDACTED]");
    if (redacted !== before) count++;
  }
  if (count === 0) return { success: false, error: "No matching PII found on this line" };
  lines[lineNum - 1] = redacted;
  fs.writeFileSync(file, lines.join("\n"), "utf-8");
  return { success: true, redactedCount: count, backupPath };
}

export function redactAllPII(): PIIRedactionResult {
  const scan = scanForPII(PROJECTS_DIR, { includeFullValues: false });
  if (scan.totalFindings === 0) return { success: true, filesModified: 0, piiRedacted: 0 };
  const fileGroups = new Map<string, { line: number; type: string }[]>();
  for (const f of scan.findings) {
    const existing = fileGroups.get(f.file) || [];
    existing.push({ line: f.line, type: f.type });
    fileGroups.set(f.file, existing);
  }
  let filesModified = 0;
  let piiRedacted = 0;
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
        for (const pat of PII_PATTERNS) {
          pat.regex.lastIndex = 0;
          const before = line;
          line = line.replace(pat.regex, "[PII_REDACTED]");
          if (line !== before) { piiRedacted++; modified = true; }
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
  return { success: true, filesModified, piiRedacted, errors, items: Array.from(fileGroups.keys()).slice(0, 50) };
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
