import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export interface SessionInfo {
  id: string;
  project: string;
  projectPath: string;
  filePath: string;
  messageCount: number;
  created: Date;
  modified: Date;
  sizeBytes: number;
  status: "healthy" | "corrupted" | "empty" | "orphaned";
  subagentCount: number;
}

export interface SessionIssue {
  line: number;
  type: "truncated" | "invalid_json" | "missing_content" | "corrupted_base64" | "sequence_error";
  message: string;
  recoverable: boolean;
}

export interface SessionDiagnosis {
  sessionId: string;
  filePath: string;
  totalLines: number;
  validLines: number;
  corruptedLines: number;
  truncatedLines: number;
  emptyLines: number;
  issues: SessionIssue[];
  recoverable: boolean;
  estimatedRecovery: number;
}

export interface SessionRepairResult {
  sessionId: string;
  backupPath: string;
  linesRemoved: number;
  linesFixed: number;
  success: boolean;
  error?: string;
}

export interface SessionExtract {
  sessionId: string;
  userMessages: string[];
  assistantMessages: string[];
  fileEdits: { path: string; content: string }[];
  commandsRun: string[];
  exportedAt: Date;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function getSessionIdFromPath(filePath: string): string {
  return path.basename(filePath, ".jsonl");
}

function countSubagents(sessionDir: string): number {
  const subagentsDir = path.join(sessionDir, "subagents");
  try {
    if (!fs.existsSync(subagentsDir)) return 0;
    return fs.readdirSync(subagentsDir).filter(f => f.endsWith(".jsonl")).length;
  } catch {
    return 0;
  }
}

function quickValidateSession(filePath: string): "healthy" | "corrupted" | "empty" {
  try {
    const stat = fs.statSync(filePath);
    if (stat.size === 0) return "empty";

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n").filter(l => l.trim());
    if (lines.length === 0) return "empty";

    let validCount = 0;
    let totalCount = 0;
    for (const line of lines) {
      totalCount++;
      try {
        JSON.parse(line);
        validCount++;
      } catch {
        // invalid line
      }
    }

    return validCount === totalCount ? "healthy" : "corrupted";
  } catch {
    return "corrupted";
  }
}

export function listSessions(projectsDir = PROJECTS_DIR, options?: { project?: string }): SessionInfo[] {
  const sessions: SessionInfo[] = [];

  try {
    const projectDirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());

    for (const projDir of projectDirs) {
      const projPath = path.join(projectsDir, projDir.name);

      if (options?.project) {
        const decodedPath = projDir.name.replace(/^-/, "/").replace(/-/g, "/");
        if (!decodedPath.includes(options.project) && projDir.name !== options.project) {
          continue;
        }
      }

      const indexPath = path.join(projPath, "sessions-index.json");
      const indexedIds = new Set<string>();

      try {
        const indexData = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        if (indexData.entries && Array.isArray(indexData.entries)) {
          for (const entry of indexData.entries) {
            indexedIds.add(entry.sessionId);
            const sessionFile = path.join(projPath, `${entry.sessionId}.jsonl`);
            if (!fs.existsSync(sessionFile)) continue;

            const stat = fs.statSync(sessionFile);
            const sessionDir = path.join(projPath, entry.sessionId);
            const status = quickValidateSession(sessionFile);

            sessions.push({
              id: entry.sessionId,
              project: projDir.name,
              projectPath: indexData.originalPath || entry.projectPath || "",
              filePath: sessionFile,
              messageCount: entry.messageCount || 0,
              created: new Date(entry.created || stat.birthtime),
              modified: new Date(entry.modified || stat.mtime),
              sizeBytes: stat.size,
              status,
              subagentCount: countSubagents(sessionDir),
            });
          }
        }
      } catch {
        // no index
      }

      try {
        const files = fs.readdirSync(projPath)
          .filter(f => f.endsWith(".jsonl") && !f.includes(".backup."));
        for (const file of files) {
          const sessionId = getSessionIdFromPath(file);
          if (indexedIds.has(sessionId)) continue;

          const filePath = path.join(projPath, file);
          const stat = fs.statSync(filePath);
          const status = quickValidateSession(filePath);

          sessions.push({
            id: sessionId,
            project: projDir.name,
            projectPath: "",
            filePath,
            messageCount: 0,
            created: new Date(stat.birthtime),
            modified: new Date(stat.mtime),
            sizeBytes: stat.size,
            status: status === "healthy" ? "orphaned" : status,
            subagentCount: 0,
          });
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }

  sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());
  return sessions;
}

export function diagnoseSession(sessionPath: string): SessionDiagnosis {
  const sessionId = getSessionIdFromPath(sessionPath);
  const diagnosis: SessionDiagnosis = {
    sessionId,
    filePath: sessionPath,
    totalLines: 0,
    validLines: 0,
    corruptedLines: 0,
    truncatedLines: 0,
    emptyLines: 0,
    issues: [],
    recoverable: true,
    estimatedRecovery: 100,
  };

  let content: string;
  try {
    content = fs.readFileSync(sessionPath, "utf-8");
  } catch (e) {
    diagnosis.issues.push({
      line: 0,
      type: "invalid_json",
      message: `Cannot read file: ${e}`,
      recoverable: false,
    });
    diagnosis.recoverable = false;
    diagnosis.estimatedRecovery = 0;
    return diagnosis;
  }

  const lines = content.split("\n");
  let lastRole = "";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      diagnosis.emptyLines++;
      continue;
    }

    diagnosis.totalLines++;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line);
    } catch {
      const isTruncated = !line.endsWith("}") && !line.endsWith("]");
      if (isTruncated) {
        diagnosis.truncatedLines++;
        diagnosis.issues.push({
          line: i + 1,
          type: "truncated",
          message: "Line appears truncated (incomplete JSON)",
          recoverable: false,
        });
      } else {
        diagnosis.corruptedLines++;
        diagnosis.issues.push({
          line: i + 1,
          type: "invalid_json",
          message: "Invalid JSON",
          recoverable: false,
        });
      }
      continue;
    }

    diagnosis.validLines++;

    const message = parsed.message as Record<string, unknown> | undefined;
    if (parsed.type === "user" || parsed.type === "assistant") {
      if (!message || !message.content) {
        diagnosis.issues.push({
          line: i + 1,
          type: "missing_content",
          message: `${parsed.type} message missing content`,
          recoverable: true,
        });
      }

      const role = message?.role as string || parsed.type as string;
      if (role === lastRole && (role === "user" || role === "assistant")) {
        diagnosis.issues.push({
          line: i + 1,
          type: "sequence_error",
          message: `Consecutive ${role} messages (expected alternation)`,
          recoverable: true,
        });
      }
      lastRole = role;
    }

    if (message && message.content && Array.isArray(message.content)) {
      for (const block of message.content as Record<string, unknown>[]) {
        if (block.type === "image" || block.type === "document") {
          const source = block.source as Record<string, unknown> | undefined;
          if (source?.data && typeof source.data === "string") {
            const data = source.data as string;
            if (data.length > 1000 && !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 100))) {
              diagnosis.issues.push({
                line: i + 1,
                type: "corrupted_base64",
                message: `Corrupted base64 in ${block.type} content`,
                recoverable: true,
              });
            }
          }
        }
      }
    }
  }

  if (diagnosis.totalLines > 0) {
    diagnosis.estimatedRecovery = Math.round((diagnosis.validLines / diagnosis.totalLines) * 100);
  }
  diagnosis.recoverable = diagnosis.estimatedRecovery > 50;

  return diagnosis;
}

export function repairSession(sessionPath: string, options?: { backup?: boolean }): SessionRepairResult {
  const sessionId = getSessionIdFromPath(sessionPath);
  const createBackup = options?.backup ?? true;
  let backupPath = "";

  if (createBackup) {
    backupPath = `${sessionPath}.repair-backup.${Date.now()}`;
    try {
      fs.copyFileSync(sessionPath, backupPath);
    } catch (e) {
      return {
        sessionId,
        backupPath: "",
        linesRemoved: 0,
        linesFixed: 0,
        success: false,
        error: `Failed to create backup: ${e}`,
      };
    }
  }

  let content: string;
  try {
    content = fs.readFileSync(sessionPath, "utf-8");
  } catch (e) {
    return {
      sessionId,
      backupPath,
      linesRemoved: 0,
      linesFixed: 0,
      success: false,
      error: `Cannot read file: ${e}`,
    };
  }

  const lines = content.split("\n");
  const repairedLines: string[] = [];
  let linesRemoved = 0;
  let linesFixed = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      JSON.parse(trimmed);
      repairedLines.push(trimmed);
    } catch {
      linesRemoved++;
    }
  }

  try {
    fs.writeFileSync(sessionPath, repairedLines.join("\n") + "\n", "utf-8");
  } catch (e) {
    return {
      sessionId,
      backupPath,
      linesRemoved,
      linesFixed,
      success: false,
      error: `Failed to write repaired file: ${e}`,
    };
  }

  return {
    sessionId,
    backupPath,
    linesRemoved,
    linesFixed,
    success: true,
  };
}

export function extractSessionContent(sessionPath: string): SessionExtract {
  const sessionId = getSessionIdFromPath(sessionPath);
  const extract: SessionExtract = {
    sessionId,
    userMessages: [],
    assistantMessages: [],
    fileEdits: [],
    commandsRun: [],
    exportedAt: new Date(),
  };

  let content: string;
  try {
    content = fs.readFileSync(sessionPath, "utf-8");
  } catch {
    return extract;
  }

  const lines = content.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const message = parsed.message as Record<string, unknown> | undefined;
    if (!message || !message.content) continue;

    const role = message.role as string;
    const contentArr = Array.isArray(message.content) ? message.content : [message.content];

    for (const block of contentArr as Record<string, unknown>[]) {
      if (block.type === "text" && block.text) {
        if (role === "user") {
          extract.userMessages.push(block.text as string);
        } else if (role === "assistant") {
          extract.assistantMessages.push(block.text as string);
        }
      }

      if (block.type === "tool_use") {
        const name = block.name as string;
        const input = block.input as Record<string, unknown> | undefined;
        if (!input) continue;

        if (name === "Write" || name === "Edit") {
          const filePath = (input.file_path || input.path) as string;
          const fileContent = (input.content || input.new_string || "") as string;
          if (filePath) {
            extract.fileEdits.push({ path: filePath, content: fileContent });
          }
        }

        if (name === "Bash") {
          const command = input.command as string;
          if (command) {
            extract.commandsRun.push(command);
          }
        }
      }
    }
  }

  return extract;
}

export function formatSessionReport(sessions: SessionInfo[]): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         SESSION OVERVIEW                     ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Total sessions: ${sessions.length}\n`;
  const healthy = sessions.filter(s => s.status === "healthy").length;
  const corrupted = sessions.filter(s => s.status === "corrupted").length;
  const empty = sessions.filter(s => s.status === "empty").length;
  const orphaned = sessions.filter(s => s.status === "orphaned").length;

  output += `Healthy: ${healthy}  Corrupted: ${corrupted}  Empty: ${empty}  Orphaned: ${orphaned}\n\n`;

  output += "ID (short)    Status      Size       Messages   Modified\n";
  output += "──────────────────────────────────────────────────────────\n";

  for (const session of sessions.slice(0, 20)) {
    const shortId = session.id.slice(0, 8) + "...";
    const status = session.status.padEnd(10);
    const size = formatBytes(session.sizeBytes).padStart(10);
    const msgs = String(session.messageCount).padStart(8);
    const mod = formatDate(session.modified);
    output += `${shortId}   ${status} ${size} ${msgs}   ${mod}\n`;
  }

  if (sessions.length > 20) {
    output += `\n... and ${sessions.length - 20} more sessions\n`;
  }

  return output;
}

export function formatSessionDiagnosticReport(diagnosis: SessionDiagnosis): string {
  let output = "";
  output += `Session Diagnosis: ${diagnosis.sessionId}\n`;
  output += `File: ${diagnosis.filePath}\n\n`;

  output += `Total lines: ${diagnosis.totalLines}\n`;
  output += `Valid: ${diagnosis.validLines}  Corrupted: ${diagnosis.corruptedLines}  Truncated: ${diagnosis.truncatedLines}  Empty: ${diagnosis.emptyLines}\n`;
  output += `Recovery estimate: ${diagnosis.estimatedRecovery}%\n`;
  output += `Recoverable: ${diagnosis.recoverable ? "Yes" : "No"}\n\n`;

  if (diagnosis.issues.length > 0) {
    output += `Issues (${diagnosis.issues.length}):\n`;
    for (const issue of diagnosis.issues.slice(0, 20)) {
      const icon = issue.recoverable ? "⚠" : "✗";
      output += `  ${icon} Line ${issue.line}: ${issue.message}\n`;
    }
    if (diagnosis.issues.length > 20) {
      output += `  ... and ${diagnosis.issues.length - 20} more issues\n`;
    }
  } else {
    output += "No issues found.\n";
  }

  return output;
}
