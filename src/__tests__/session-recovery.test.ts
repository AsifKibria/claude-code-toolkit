import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  listSessions,
  diagnoseSession,
  repairSession,
  extractSessionContent,
  formatSessionReport,
  formatSessionDiagnosticReport,
  type SessionInfo,
} from "../lib/session-recovery.js";

const TEST_DIR = path.join(os.tmpdir(), "cct-session-recovery-test");

function createFile(content: string, ...parts: string[]) {
  const filePath = path.join(TEST_DIR, ...parts);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function createJsonlFile(lines: object[], ...parts: string[]) {
  const content = lines.map(l => JSON.stringify(l)).join("\n");
  return createFile(content, ...parts);
}

describe("Session Recovery Module", () => {
  beforeEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
    fs.mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true });
    }
  });

  describe("listSessions", () => {
    it("should list sessions from sessions-index.json", () => {
      const sessionId = "abc-123-def";
      createJsonlFile(
        [
          { type: "user", message: { role: "user", content: [{ type: "text", text: "hello" }] } },
          { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hi" }] } },
        ],
        "test-project", `${sessionId}.jsonl`
      );
      createFile(
        JSON.stringify({
          version: 1,
          entries: [{ sessionId, messageCount: 2, created: "2026-01-01T00:00:00Z", modified: "2026-01-01T01:00:00Z" }],
          originalPath: "/test/project",
        }),
        "test-project", "sessions-index.json"
      );

      const sessions = listSessions(TEST_DIR);
      expect(sessions.length).toBe(1);
      expect(sessions[0].id).toBe(sessionId);
      expect(sessions[0].status).toBe("healthy");
    });

    it("should detect orphaned sessions", () => {
      createJsonlFile(
        [{ type: "user", message: { role: "user", content: [{ type: "text", text: "test" }] } }],
        "test-project", "orphan-session.jsonl"
      );
      createFile(
        JSON.stringify({ version: 1, entries: [] }),
        "test-project", "sessions-index.json"
      );

      const sessions = listSessions(TEST_DIR);
      expect(sessions.length).toBe(1);
      expect(sessions[0].status).toBe("orphaned");
    });

    it("should detect empty sessions", () => {
      createFile("", "test-project", "empty-session.jsonl");
      createFile(
        JSON.stringify({ version: 1, entries: [] }),
        "test-project", "sessions-index.json"
      );

      const sessions = listSessions(TEST_DIR);
      expect(sessions.length).toBe(1);
      expect(sessions[0].status).toBe("empty");
    });

    it("should detect corrupted sessions", () => {
      createFile(
        "valid json\nnot valid {{{",
        "test-project", "corrupt-session.jsonl"
      );

      const sessions = listSessions(TEST_DIR);
      const corrupt = sessions.find(s => s.id === "corrupt-session");
      expect(corrupt).toBeDefined();
      expect(corrupt!.status).toBe("corrupted");
    });

    it("should return empty for non-existent directory", () => {
      const sessions = listSessions(path.join(TEST_DIR, "nonexistent"));
      expect(sessions).toEqual([]);
    });

    it("should count subagents", () => {
      const sessionId = "session-with-agents";
      createJsonlFile(
        [{ type: "user", message: { role: "user", content: [{ type: "text", text: "test" }] } }],
        "test-project", `${sessionId}.jsonl`
      );
      createFile("agent data", "test-project", sessionId, "subagents", "agent-1.jsonl");
      createFile("agent data", "test-project", sessionId, "subagents", "agent-2.jsonl");
      createFile(
        JSON.stringify({
          version: 1,
          entries: [{ sessionId, messageCount: 1 }],
        }),
        "test-project", "sessions-index.json"
      );

      const sessions = listSessions(TEST_DIR);
      expect(sessions[0].subagentCount).toBe(2);
    });
  });

  describe("diagnoseSession", () => {
    it("should diagnose a healthy session", () => {
      const filePath = createJsonlFile(
        [
          { type: "user", message: { role: "user", content: [{ type: "text", text: "hello" }] } },
          { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "hi" }] } },
        ],
        "healthy.jsonl"
      );

      const diag = diagnoseSession(filePath);
      expect(diag.validLines).toBe(2);
      expect(diag.corruptedLines).toBe(0);
      expect(diag.estimatedRecovery).toBe(100);
      expect(diag.issues.length).toBe(0);
    });

    it("should detect truncated lines", () => {
      const filePath = createFile(
        '{"type":"user","message":{"role":"user","content":[{"type":"text","text":"hello"}]}}\n{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"hi',
        "truncated.jsonl"
      );

      const diag = diagnoseSession(filePath);
      expect(diag.truncatedLines).toBe(1);
      expect(diag.issues.some(i => i.type === "truncated")).toBe(true);
    });

    it("should detect invalid JSON", () => {
      const filePath = createFile(
        '{"valid":"json"}\nnot json at all}',
        "invalid.jsonl"
      );

      const diag = diagnoseSession(filePath);
      expect(diag.corruptedLines).toBe(1);
    });

    it("should detect missing content", () => {
      const filePath = createJsonlFile(
        [{ type: "user", message: { role: "user" } }],
        "no-content.jsonl"
      );

      const diag = diagnoseSession(filePath);
      expect(diag.issues.some(i => i.type === "missing_content")).toBe(true);
    });

    it("should detect consecutive same-role messages", () => {
      const filePath = createJsonlFile(
        [
          { type: "user", message: { role: "user", content: [{ type: "text", text: "msg1" }] } },
          { type: "user", message: { role: "user", content: [{ type: "text", text: "msg2" }] } },
        ],
        "sequence.jsonl"
      );

      const diag = diagnoseSession(filePath);
      expect(diag.issues.some(i => i.type === "sequence_error")).toBe(true);
    });

    it("should calculate recovery percentage", () => {
      const filePath = createFile(
        '{"type":"user","message":{"role":"user","content":[]}}\n{"type":"user","message":{"role":"user","content":[]}}\ninvalid\ninvalid',
        "mixed.jsonl"
      );

      const diag = diagnoseSession(filePath);
      expect(diag.estimatedRecovery).toBe(50);
    });

    it("should handle unreadable file", () => {
      const diag = diagnoseSession(path.join(TEST_DIR, "nonexistent.jsonl"));
      expect(diag.recoverable).toBe(false);
      expect(diag.estimatedRecovery).toBe(0);
    });
  });

  describe("repairSession", () => {
    it("should create backup and remove invalid lines", () => {
      const filePath = createFile(
        '{"valid":"line1"}\ninvalid json\n{"valid":"line2"}',
        "repair.jsonl"
      );

      const result = repairSession(filePath);
      expect(result.success).toBe(true);
      expect(result.linesRemoved).toBe(1);
      expect(result.backupPath).toBeTruthy();
      expect(fs.existsSync(result.backupPath)).toBe(true);

      const repaired = fs.readFileSync(filePath, "utf-8");
      expect(repaired.trim().split("\n").length).toBe(2);
    });

    it("should skip backup when option set", () => {
      const filePath = createFile('{"valid":"line"}', "no-backup.jsonl");

      const result = repairSession(filePath, { backup: false });
      expect(result.success).toBe(true);
      expect(result.backupPath).toBe("");
    });

    it("should handle nonexistent file", () => {
      const result = repairSession(path.join(TEST_DIR, "nope.jsonl"));
      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe("extractSessionContent", () => {
    it("should extract user and assistant messages", () => {
      const filePath = createJsonlFile(
        [
          { type: "user", message: { role: "user", content: [{ type: "text", text: "What is 2+2?" }] } },
          { type: "assistant", message: { role: "assistant", content: [{ type: "text", text: "4" }] } },
        ],
        "extract.jsonl"
      );

      const extract = extractSessionContent(filePath);
      expect(extract.userMessages).toContain("What is 2+2?");
      expect(extract.assistantMessages).toContain("4");
    });

    it("should extract file edits", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "Write",
              input: { file_path: "/tmp/test.ts", content: "console.log('hello')" },
            }],
          },
        }],
        "edits.jsonl"
      );

      const extract = extractSessionContent(filePath);
      expect(extract.fileEdits.length).toBe(1);
      expect(extract.fileEdits[0].path).toBe("/tmp/test.ts");
    });

    it("should extract commands", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "Bash",
              input: { command: "npm test" },
            }],
          },
        }],
        "commands.jsonl"
      );

      const extract = extractSessionContent(filePath);
      expect(extract.commandsRun).toContain("npm test");
    });

    it("should handle empty file", () => {
      const filePath = createFile("", "empty.jsonl");
      const extract = extractSessionContent(filePath);
      expect(extract.userMessages).toEqual([]);
    });
  });

  describe("formatSessionReport", () => {
    it("should format a session report", () => {
      const sessions: SessionInfo[] = [{
        id: "test-session-id",
        project: "test-project",
        projectPath: "/test",
        filePath: "/tmp/test.jsonl",
        messageCount: 10,
        created: new Date(),
        modified: new Date(),
        sizeBytes: 1024,
        status: "healthy",
        subagentCount: 0,
      }];

      const report = formatSessionReport(sessions);
      expect(report).toContain("SESSION OVERVIEW");
      expect(report).toContain("Healthy: 1");
    });
  });

  describe("formatSessionDiagnosticReport", () => {
    it("should format a diagnostic report", () => {
      const filePath = createJsonlFile(
        [{ type: "user", message: { role: "user", content: [] } }],
        "diag.jsonl"
      );
      const diag = diagnoseSession(filePath);
      const report = formatSessionDiagnosticReport(diag);
      expect(report).toContain("Session Diagnosis");
      expect(report).toContain("Recovery estimate");
    });
  });
});
