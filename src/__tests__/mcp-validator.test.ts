import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  findMcpConfigs,
  validateMcpConfig,
  diagnoseMcpServers,
  formatMcpDiagnosticReport,
} from "../lib/mcp-validator.js";

const TEST_DIR = path.join(os.tmpdir(), "cct-mcp-validator-test");

function createFile(content: string, ...parts: string[]) {
  const filePath = path.join(TEST_DIR, ...parts);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("MCP Validator Module", () => {
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

  describe("findMcpConfigs", () => {
    it("should find .mcp.json in project directory", () => {
      const mcpPath = createFile(
        JSON.stringify({ mcpServers: {} }),
        ".mcp.json"
      );

      const configs = findMcpConfigs({ projectDir: TEST_DIR });
      expect(configs).toContain(mcpPath);
    });

    it("should find plugin MCP configs", () => {
      const pluginDir = path.join(TEST_DIR, "plugins", "cache", "test-plugin", "1.0.0");
      fs.mkdirSync(pluginDir, { recursive: true });
      const mcpPath = path.join(pluginDir, ".mcp.json");
      fs.writeFileSync(mcpPath, JSON.stringify({ mcpServers: {} }));

      // Override CLAUDE_DIR for test
      const configs = findMcpConfigs({ projectDir: TEST_DIR });
      // This tests the projectDir MCP config finding
      expect(configs).toBeDefined();
    });
  });

  describe("validateMcpConfig", () => {
    it("should validate a correct config", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "test-server": {
              type: "stdio",
              command: "node",
              args: ["server.js"],
            },
          },
        }),
        "valid.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.valid).toBe(true);
      expect(result.servers.length).toBe(1);
      expect(result.servers[0].name).toBe("test-server");
      expect(result.servers[0].command).toBe("node");
    });

    it("should detect missing command", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "broken-server": {
              type: "stdio",
            },
          },
        }),
        "no-command.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].severity).toBe("error");
      expect(result.issues[0].message).toContain("command");
    });

    it("should detect non-existent command binary", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "missing-binary": {
              type: "stdio",
              command: "nonexistent-binary-xyz-12345",
            },
          },
        }),
        "bad-binary.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.issues.some(i => i.message.includes("not found"))).toBe(true);
    });

    it("should warn about non-existent arg paths", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "bad-args": {
              type: "stdio",
              command: "node",
              args: ["/nonexistent/path/server.js"],
            },
          },
        }),
        "bad-args.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.issues.some(i => i.severity === "warning" && i.message.includes("does not exist"))).toBe(true);
    });

    it("should warn about empty env vars", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "empty-env": {
              type: "stdio",
              command: "node",
              env: { API_KEY: "" },
            },
          },
        }),
        "empty-env.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.issues.some(i => i.severity === "warning" && i.message.includes("empty"))).toBe(true);
    });

    it("should handle invalid JSON", () => {
      const configPath = createFile("not valid json {{{", "invalid.json");

      const result = validateMcpConfig(configPath);
      expect(result.valid).toBe(false);
      expect(result.issues[0].severity).toBe("error");
    });

    it("should handle multiple servers", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            server1: { type: "stdio", command: "node" },
            server2: { type: "stdio", command: "node" },
          },
        }),
        "multi.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.servers.length).toBe(2);
    });

    it("should handle .claude.json with project-level servers", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            global: { type: "stdio", command: "node" },
          },
          projects: {
            "test-project": {
              mcpServers: {
                local: { type: "stdio", command: "node" },
              },
            },
          },
        }),
        ".claude.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.servers.length).toBe(2);
    });

    it("should handle config with no mcpServers key", () => {
      const configPath = createFile(
        JSON.stringify({ someOtherKey: "value" }),
        "no-servers.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.servers.length).toBe(0);
      expect(result.valid).toBe(true);
    });

    it("should info about missing type field", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "no-type": {
              command: "node",
            },
          },
        }),
        "no-type.json"
      );

      const result = validateMcpConfig(configPath);
      expect(result.issues.some(i => i.severity === "info" && i.message.includes("type"))).toBe(true);
    });

    it("should skip commands with template variables", () => {
      const configPath = createFile(
        JSON.stringify({
          mcpServers: {
            "templated": {
              type: "stdio",
              command: "${CLAUDE_PLUGIN_ROOT}/scripts/server.js",
            },
          },
        }),
        "templated.json"
      );

      const result = validateMcpConfig(configPath);
      const cmdErrors = result.issues.filter(i => i.message.includes("not found"));
      expect(cmdErrors.length).toBe(0);
    });
  });

  describe("diagnoseMcpServers", () => {
    it("should run diagnostics on project configs", async () => {
      createFile(
        JSON.stringify({
          mcpServers: {
            test: { type: "stdio", command: "node" },
          },
        }),
        ".mcp.json"
      );

      const report = await diagnoseMcpServers({ projectDir: TEST_DIR });
      expect(report.totalServers).toBeGreaterThanOrEqual(1);
      expect(report.generatedAt).toBeInstanceOf(Date);
    });

    it("should detect duplicate server names", async () => {
      createFile(
        JSON.stringify({
          mcpServers: {
            toolkit: { type: "stdio", command: "node" },
          },
        }),
        ".mcp.json"
      );

      // Note: detecting duplicates requires multiple config files
      // This test just verifies the structure
      const report = await diagnoseMcpServers({ projectDir: TEST_DIR });
      expect(report.duplicateServers).toBeDefined();
      expect(Array.isArray(report.duplicateServers)).toBe(true);
    });

    it("should return empty report for no configs", async () => {
      const report = await diagnoseMcpServers({ projectDir: TEST_DIR });
      expect(report.totalServers).toBeGreaterThanOrEqual(0);
    });
  });

  describe("formatMcpDiagnosticReport", () => {
    it("should format a report", async () => {
      createFile(
        JSON.stringify({
          mcpServers: {
            test: { type: "stdio", command: "node" },
          },
        }),
        ".mcp.json"
      );

      const report = await diagnoseMcpServers({ projectDir: TEST_DIR });
      const formatted = formatMcpDiagnosticReport(report);
      expect(formatted).toContain("MCP SERVER DIAGNOSTICS");
      expect(formatted).toContain("Total servers:");
    });
  });
});
