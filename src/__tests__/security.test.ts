import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  scanForSecrets,
  auditSession,
  enforceRetention,
  formatSecretsScanReport,
  formatAuditReport,
  formatRetentionReport,
} from "../lib/security.js";

const TEST_DIR = path.join(os.tmpdir(), "cct-security-test");

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

function setFileAge(filePath: string, days: number) {
  const mtime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  fs.utimesSync(filePath, mtime, mtime);
}

describe("Security Module", () => {
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

  describe("scanForSecrets", () => {
    it("should detect AWS access keys", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Your key is AKIAIOSFODNN7EXAMPLE" }],
          },
        }],
        "aws.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("aws_key");
      expect(result.findings[0].severity).toBe("critical");
    });

    it("should detect GitHub tokens", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghij" }],
          },
        }],
        "github.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("api_token");
    });

    it("should detect private keys", () => {
      const filePath = createJsonlFile(
        [{
          type: "user",
          message: {
            role: "user",
            content: [{ type: "text", text: "-----BEGIN RSA PRIVATE KEY-----\nMIIEpA..." }],
          },
        }],
        "privkey.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("private_key");
    });

    it("should detect connection strings", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "mongodb://user:pass@host:27017/db" }],
          },
        }],
        "connstr.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("connection_string");
    });

    it("should detect JWT tokens", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U" }],
          },
        }],
        "jwt.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("jwt");
    });

    it("should detect passwords in config", () => {
      const filePath = createJsonlFile(
        [{
          type: "user",
          message: {
            role: "user",
            content: [{ type: "text", text: 'password = "SuperSecret123!"' }],
          },
        }],
        "password.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
      expect(result.findings[0].type).toBe("password");
    });

    it("should detect sk- API keys", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "API key: sk-abcdefghijklmnopqrstuvwx" }],
          },
        }],
        "apikey.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
    });

    it("should return empty for clean files", () => {
      const filePath = createJsonlFile(
        [{
          type: "user",
          message: {
            role: "user",
            content: [{ type: "text", text: "Just normal text, nothing secret" }],
          },
        }],
        "clean.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBe(0);
    });

    it("should mask secret previews", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "AKIAIOSFODNN7EXAMPLE" }],
          },
        }],
        "masked.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.findings[0].maskedPreview).toContain("****");
      expect(result.findings[0].maskedPreview).not.toBe("AKIAIOSFODNN7EXAMPLE");
    });

    it("should scan tool_use inputs for secrets", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "Bash",
              input: { command: "export AWS_SECRET_ACCESS_KEY='wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY'" },
            }],
          },
        }],
        "tool-secret.jsonl"
      );

      const result = scanForSecrets(TEST_DIR, { file: filePath });
      expect(result.totalFindings).toBeGreaterThan(0);
    });

    it("should scan all files when no specific file given", () => {
      createJsonlFile(
        [{
          type: "user",
          message: { role: "user", content: [{ type: "text", text: "AKIAIOSFODNN7EXAMPLE" }] },
        }],
        "proj1", "session.jsonl"
      );
      createJsonlFile(
        [{
          type: "user",
          message: { role: "user", content: [{ type: "text", text: "clean text" }] },
        }],
        "proj2", "session.jsonl"
      );

      const result = scanForSecrets(TEST_DIR);
      expect(result.filesScanned).toBe(2);
      expect(result.totalFindings).toBe(1);
    });
  });

  describe("auditSession", () => {
    it("should extract file reads", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          timestamp: "2026-01-01T10:00:00Z",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "Read",
              input: { file_path: "/src/app.ts" },
            }],
          },
        }],
        "reads.jsonl"
      );

      const audit = auditSession(filePath);
      expect(audit.filesRead).toContain("/src/app.ts");
      expect(audit.actions.length).toBe(1);
      expect(audit.actions[0].type).toBe("file_read");
    });

    it("should extract file writes and edits", () => {
      const filePath = createJsonlFile(
        [
          {
            type: "assistant",
            timestamp: "2026-01-01T10:00:00Z",
            message: {
              role: "assistant",
              content: [{
                type: "tool_use",
                name: "Write",
                input: { file_path: "/src/new.ts", content: "code" },
              }],
            },
          },
          {
            type: "assistant",
            timestamp: "2026-01-01T10:01:00Z",
            message: {
              role: "assistant",
              content: [{
                type: "tool_use",
                name: "Edit",
                input: { file_path: "/src/existing.ts", old_string: "a", new_string: "b" },
              }],
            },
          },
        ],
        "writes.jsonl"
      );

      const audit = auditSession(filePath);
      expect(audit.filesWritten).toContain("/src/new.ts");
      expect(audit.filesWritten).toContain("/src/existing.ts");
    });

    it("should extract bash commands", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          timestamp: "2026-01-01T10:00:00Z",
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

      const audit = auditSession(filePath);
      expect(audit.commandsRun).toContain("npm test");
    });

    it("should extract MCP tool calls", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          timestamp: "2026-01-01T10:00:00Z",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "mcp__github__create_issue",
              input: { title: "test" },
            }],
          },
        }],
        "mcp.jsonl"
      );

      const audit = auditSession(filePath);
      expect(audit.mcpToolsUsed).toContain("mcp__github__create_issue");
    });

    it("should extract web fetch URLs", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          timestamp: "2026-01-01T10:00:00Z",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "WebFetch",
              input: { url: "https://example.com/api" },
            }],
          },
        }],
        "webfetch.jsonl"
      );

      const audit = auditSession(filePath);
      expect(audit.urlsFetched).toContain("https://example.com/api");
    });

    it("should calculate duration from timestamps", () => {
      const filePath = createJsonlFile(
        [
          {
            type: "user",
            timestamp: "2026-01-01T10:00:00Z",
            message: { role: "user", content: [{ type: "text", text: "start" }] },
          },
          {
            type: "assistant",
            timestamp: "2026-01-01T10:30:00Z",
            message: { role: "assistant", content: [{ type: "text", text: "end" }] },
          },
        ],
        "duration.jsonl"
      );

      const audit = auditSession(filePath);
      expect(audit.duration).toBe(30);
    });
  });

  describe("enforceRetention", () => {
    it("should identify old sessions for deletion", () => {
      const f = createJsonlFile(
        [{ type: "user", message: { role: "user", content: [] } }],
        "old-project", "old.jsonl"
      );
      setFileAge(f, 60);

      const result = enforceRetention(TEST_DIR, { days: 30, dryRun: true });
      expect(result.sessionsDeleted).toBe(1);
      expect(result.dryRun).toBe(true);
      expect(fs.existsSync(f)).toBe(true);
    });

    it("should delete old sessions when not dry run", () => {
      const f = createJsonlFile(
        [{ type: "user", message: { role: "user", content: [] } }],
        "old-project", "old.jsonl"
      );
      setFileAge(f, 60);

      const result = enforceRetention(TEST_DIR, { days: 30, dryRun: false });
      expect(result.sessionsDeleted).toBe(1);
      expect(fs.existsSync(f)).toBe(false);
    });

    it("should not delete recent sessions", () => {
      createJsonlFile(
        [{ type: "user", message: { role: "user", content: [] } }],
        "new-project", "new.jsonl"
      );

      const result = enforceRetention(TEST_DIR, { days: 30, dryRun: true });
      expect(result.sessionsDeleted).toBe(0);
    });
  });

  describe("formatSecretsScanReport", () => {
    it("should format clean scan", () => {
      const result: import("../lib/security.js").SecretsScanResult = {
        filesScanned: 5,
        totalFindings: 0,
        findings: [],
        summary: {},
        scannedAt: new Date(),
      };

      const report = formatSecretsScanReport(result);
      expect(report).toContain("SECRETS SCAN");
      expect(report).toContain("No secrets found");
    });

    it("should format scan with findings", () => {
      const result: import("../lib/security.js").SecretsScanResult = {
        filesScanned: 1,
        totalFindings: 1,
        findings: [{
          file: "/tmp/test.jsonl",
          line: 1,
          type: "aws_key",
          pattern: "AWS Access Key ID",
          maskedPreview: "AKIA****",
          severity: "critical",
        }],
        summary: { aws_key: 1 },
        scannedAt: new Date(),
      };

      const report = formatSecretsScanReport(result);
      expect(report).toContain("AWS Access Key ID");
      expect(report).toContain("critical");
    });
  });

  describe("formatAuditReport", () => {
    it("should format an audit report", () => {
      const filePath = createJsonlFile(
        [{
          type: "assistant",
          timestamp: "2026-01-01T10:00:00Z",
          message: {
            role: "assistant",
            content: [{
              type: "tool_use",
              name: "Bash",
              input: { command: "npm test" },
            }],
          },
        }],
        "audit.jsonl"
      );

      const audit = auditSession(filePath);
      const report = formatAuditReport(audit);
      expect(report).toContain("SESSION AUDIT");
      expect(report).toContain("npm test");
    });
  });

  describe("formatRetentionReport", () => {
    it("should format dry run report", () => {
      const result: import("../lib/security.js").RetentionResult = {
        sessionsDeleted: 5,
        sessionsExported: 0,
        spaceFreed: 1024 * 1024,
        errors: [],
        dryRun: true,
      };

      const report = formatRetentionReport(result);
      expect(report).toContain("DRY RUN");
      expect(report).toContain("5");
    });
  });
});
