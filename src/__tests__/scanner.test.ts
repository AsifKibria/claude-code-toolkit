import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  checkContentForIssues,
  fixContentInMessage,
  scanFile,
  fixFile,
  getConversationStats,
  findAllJsonlFiles,
  findBackupFiles,
  restoreFromBackup,
  deleteOldBackups,
  exportConversation,
  exportConversationToFile,
  estimateContextSize,
  formatContextEstimate,
  generateUsageAnalytics,
  formatUsageAnalytics,
  findDuplicates,
  formatDuplicateReport,
  findArchiveCandidates,
  archiveConversations,
  formatArchiveReport,
  runMaintenance,
  formatMaintenanceReport,
  MIN_PROBLEMATIC_BASE64_SIZE,
  MIN_PROBLEMATIC_TEXT_SIZE,
} from "../lib/scanner.js";

const TEST_DIR = path.join(os.tmpdir(), "mcp-image-fixer-test");

function createLargeBase64(size: number): string {
  return "A".repeat(size);
}

function createTestFile(filename: string, lines: object[]): string {
  const filePath = path.join(TEST_DIR, filename);
  const content = lines.map((l) => JSON.stringify(l)).join("\n");
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

describe("Scanner Module", () => {
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

  describe("checkContentForIssues", () => {
    it("should return false for empty content", () => {
      const result = checkContentForIssues([]);
      expect(result.hasProblems).toBe(false);
      expect(result.indices).toEqual([]);
    });

    it("should return false for non-array content", () => {
      const result = checkContentForIssues("not an array");
      expect(result.hasProblems).toBe(false);
    });

    it("should return false for text-only content", () => {
      const content = [{ type: "text", text: "Hello world" }];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(false);
    });

    it("should return false for small images", () => {
      const content = [
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(1000) },
        },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(false);
    });

    it("should detect oversized images", () => {
      const content = [
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
        },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(true);
      expect(result.indices).toEqual([0]);
    });

    it("should detect multiple oversized images", () => {
      const content = [
        { type: "text", text: "Hello" },
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
        },
        { type: "text", text: "World" },
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
        },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(true);
      expect(result.indices).toEqual([1, 3]);
    });

    it("should detect oversized images in tool_result", () => {
      const content = [
        {
          type: "tool_result",
          tool_use_id: "123",
          content: [
            { type: "text", text: "Result" },
            {
              type: "image",
              source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
            },
          ],
        },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(true);
      expect(result.indices).toEqual([[0, 1]]);
    });

    it("should calculate total size correctly", () => {
      const size1 = 50000;
      const size2 = 60000;
      const content = [
        { type: "image", source: { type: "base64", data: createLargeBase64(size1) } },
        { type: "image", source: { type: "base64", data: createLargeBase64(size2) } },
      ];
      const result = checkContentForIssues(content);
      expect(result.totalSize).toBe(size1 + size2);
    });

    it("should detect oversized PDFs", () => {
      const content = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
        },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(true);
      expect(result.contentType).toBe("pdf");
    });

    it("should detect oversized documents", () => {
      const content = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/octet-stream", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
        },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(true);
      expect(result.contentType).toBe("document");
    });

    it("should detect large text content", () => {
      const content = [
        { type: "text", text: "A".repeat(MIN_PROBLEMATIC_TEXT_SIZE + 1) },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(true);
      expect(result.contentType).toBe("large_text");
    });

    it("should not flag small text content", () => {
      const content = [
        { type: "text", text: "Normal text" },
      ];
      const result = checkContentForIssues(content);
      expect(result.hasProblems).toBe(false);
    });
  });

  describe("fixContentInMessage", () => {
    it("should replace oversized image with text placeholder", () => {
      const content = [
        { type: "text", text: "Before" },
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(200000) },
        },
        { type: "text", text: "After" },
      ];
      const fixed = fixContentInMessage(content, [1], "image");
      expect(fixed[0]).toEqual({ type: "text", text: "Before" });
      expect(fixed[1]).toEqual({ type: "text", text: "[Image removed - exceeded size limit]" });
      expect(fixed[2]).toEqual({ type: "text", text: "After" });
    });

    it("should replace nested image in tool_result", () => {
      const content = [
        {
          type: "tool_result",
          tool_use_id: "123",
          content: [
            { type: "text", text: "Result" },
            {
              type: "image",
              source: { type: "base64", data: createLargeBase64(200000) },
            },
          ],
        },
      ];
      const fixed = fixContentInMessage(content, [[0, 1]], "image") as any[];
      expect(fixed[0].content[0]).toEqual({ type: "text", text: "Result" });
      expect(fixed[0].content[1]).toEqual({
        type: "text",
        text: "[Image removed - exceeded size limit]",
      });
    });

    it("should not mutate original content", () => {
      const original = [
        {
          type: "image",
          source: { type: "base64", data: "original" },
        },
      ];
      const originalCopy = JSON.parse(JSON.stringify(original));
      fixContentInMessage(original, [0]);
      expect(original).toEqual(originalCopy);
    });

    it("should replace PDF with appropriate placeholder", () => {
      const content = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: createLargeBase64(200000) },
        },
      ];
      const fixed = fixContentInMessage(content, [0], "pdf");
      expect(fixed[0]).toEqual({ type: "text", text: "[PDF removed - exceeded size limit]" });
    });

    it("should replace document with appropriate placeholder", () => {
      const content = [
        {
          type: "document",
          source: { type: "base64", data: createLargeBase64(200000) },
        },
      ];
      const fixed = fixContentInMessage(content, [0], "document");
      expect(fixed[0]).toEqual({ type: "text", text: "[Document removed - exceeded size limit]" });
    });

    it("should replace large text with appropriate placeholder", () => {
      const content = [
        { type: "text", text: "A".repeat(600000) },
      ];
      const fixed = fixContentInMessage(content, [0], "large_text");
      expect(fixed[0]).toEqual({ type: "text", text: "[Large text content removed - exceeded size limit]" });
    });
  });

  describe("scanFile", () => {
    it("should scan clean file with no issues", () => {
      const filePath = createTestFile("clean.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Hello" }] } },
        { message: { role: "assistant", content: [{ type: "text", text: "Hi!" }] } },
      ]);

      const result = scanFile(filePath);
      expect(result.issues).toHaveLength(0);
      expect(result.totalLines).toBe(2);
    });

    it("should detect issues in message content", () => {
      const filePath = createTestFile("with-image.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Hello" }] } },
        {
          message: {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const result = scanFile(filePath);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].line).toBe(2);
      expect(result.issues[0].location).toBe("message_content");
      expect(result.issues[0].contentType).toBe("image");
    });

    it("should detect issues in toolUseResult", () => {
      const filePath = createTestFile("tool-result.jsonl", [
        {
          message: { role: "user", content: [] },
          toolUseResult: {
            content: [
              {
                type: "image",
                source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const result = scanFile(filePath);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].location).toBe("toolUseResult");
    });

    it("should handle malformed JSON lines gracefully", () => {
      const filePath = path.join(TEST_DIR, "malformed.jsonl");
      fs.writeFileSync(
        filePath,
        '{"message":{"content":[]}}\nnot valid json\n{"message":{"content":[]}}',
        "utf-8"
      );

      const result = scanFile(filePath);
      expect(result.totalLines).toBe(3);
      expect(result.issues).toHaveLength(0);
    });

    it("should throw error for non-existent file", () => {
      expect(() => scanFile("/nonexistent/file.jsonl")).toThrow();
    });
  });

  describe("fixFile", () => {
    it("should not modify clean files", () => {
      const filePath = createTestFile("clean.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Hello" }] } },
      ]);

      const result = fixFile(filePath);
      expect(result.fixed).toBe(false);
      expect(result.backupPath).toBeUndefined();
    });

    it("should fix files with oversized images", () => {
      const filePath = createTestFile("to-fix.jsonl", [
        {
          message: {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const result = fixFile(filePath);
      expect(result.fixed).toBe(true);
      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);

      const fixedContent = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(fixedContent);
      expect(parsed.message.content[0].type).toBe("text");
      expect(parsed.message.content[0].text).toContain("Image removed");
    });

    it("should create backup before fixing", () => {
      const filePath = createTestFile("backup-test.jsonl", [
        {
          message: {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const originalContent = fs.readFileSync(filePath, "utf-8");
      const result = fixFile(filePath);

      expect(result.backupPath).toBeDefined();
      const backupContent = fs.readFileSync(result.backupPath!, "utf-8");
      expect(backupContent).toBe(originalContent);
    });

    it("should skip backup when createBackup is false", () => {
      const filePath = createTestFile("no-backup.jsonl", [
        {
          message: {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const result = fixFile(filePath, false);
      expect(result.fixed).toBe(true);
      expect(result.backupPath).toBeUndefined();
    });
  });

  describe("getConversationStats", () => {
    it("should count messages correctly", () => {
      const filePath = createTestFile("stats.jsonl", [
        { message: { role: "user", content: [] } },
        { message: { role: "assistant", content: [] } },
        { message: { role: "user", content: [] } },
        { message: { role: "assistant", content: [] } },
      ]);

      const stats = getConversationStats(filePath);
      expect(stats.totalMessages).toBe(4);
      expect(stats.userMessages).toBe(2);
      expect(stats.assistantMessages).toBe(2);
    });

    it("should count tool uses", () => {
      const filePath = createTestFile("tools.jsonl", [
        {
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", id: "1", name: "read" },
              { type: "tool_use", id: "2", name: "write" },
            ],
          },
        },
      ]);

      const stats = getConversationStats(filePath);
      expect(stats.toolUses).toBe(2);
    });

    it("should count images and problematic content", () => {
      const filePath = createTestFile("images.jsonl", [
        {
          message: {
            role: "user",
            content: [
              { type: "image", source: { type: "base64", data: createLargeBase64(1000) } },
              {
                type: "image",
                source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const stats = getConversationStats(filePath);
      expect(stats.imageCount).toBe(2);
      expect(stats.problematicContent).toBe(1);
    });

    it("should count documents", () => {
      const filePath = createTestFile("documents.jsonl", [
        {
          message: {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
              },
            ],
          },
        },
      ]);

      const stats = getConversationStats(filePath);
      expect(stats.documentCount).toBe(1);
      expect(stats.problematicContent).toBe(1);
    });
  });

  describe("findAllJsonlFiles", () => {
    it("should find all jsonl files recursively", () => {
      fs.mkdirSync(path.join(TEST_DIR, "sub1"), { recursive: true });
      fs.mkdirSync(path.join(TEST_DIR, "sub2"), { recursive: true });

      fs.writeFileSync(path.join(TEST_DIR, "file1.jsonl"), "{}");
      fs.writeFileSync(path.join(TEST_DIR, "sub1", "file2.jsonl"), "{}");
      fs.writeFileSync(path.join(TEST_DIR, "sub2", "file3.jsonl"), "{}");
      fs.writeFileSync(path.join(TEST_DIR, "notjsonl.txt"), "{}");

      const files = findAllJsonlFiles(TEST_DIR);
      expect(files).toHaveLength(3);
      expect(files.every((f) => f.endsWith(".jsonl"))).toBe(true);
    });

    it("should exclude backup files", () => {
      fs.writeFileSync(path.join(TEST_DIR, "file.jsonl"), "{}");
      fs.writeFileSync(path.join(TEST_DIR, "file.jsonl.backup.2024-01-01"), "{}");

      const files = findAllJsonlFiles(TEST_DIR);
      expect(files).toHaveLength(1);
      expect(files[0]).not.toContain("backup");
    });
  });

  describe("findBackupFiles", () => {
    it("should find backup files", () => {
      fs.writeFileSync(path.join(TEST_DIR, "file.jsonl"), "{}");
      fs.writeFileSync(path.join(TEST_DIR, "file.jsonl.backup.2024-01-01T00-00-00"), "{}");
      fs.writeFileSync(path.join(TEST_DIR, "file.jsonl.backup.2024-01-02T00-00-00"), "{}");

      const backups = findBackupFiles(TEST_DIR);
      expect(backups).toHaveLength(2);
      expect(backups.every((f) => f.includes("backup"))).toBe(true);
    });
  });

  describe("restoreFromBackup", () => {
    it("should restore file from backup", () => {
      const originalPath = path.join(TEST_DIR, "original.jsonl");
      const backupPath = path.join(TEST_DIR, "original.jsonl.backup.2024-01-01T00-00-00");

      fs.writeFileSync(originalPath, "modified content");
      fs.writeFileSync(backupPath, "original content");

      const result = restoreFromBackup(backupPath);
      expect(result.success).toBe(true);
      expect(result.originalPath).toBe(originalPath);

      const restoredContent = fs.readFileSync(originalPath, "utf-8");
      expect(restoredContent).toBe("original content");
    });

    it("should fail for non-existent backup", () => {
      const result = restoreFromBackup("/nonexistent.backup.2024-01-01T00-00-00");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("should fail for invalid backup name format", () => {
      const invalidPath = path.join(TEST_DIR, "invalid.txt");
      fs.writeFileSync(invalidPath, "content");

      const result = restoreFromBackup(invalidPath);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid backup");
    });
  });

  describe("deleteOldBackups", () => {
    it("should delete backups older than specified days", () => {
      const oldBackup = path.join(TEST_DIR, "old.jsonl.backup.2020-01-01T00-00-00");
      const newBackup = path.join(TEST_DIR, "new.jsonl.backup.2099-01-01T00-00-00");

      fs.writeFileSync(oldBackup, "old");
      fs.writeFileSync(newBackup, "new");

      // Set old backup mtime to past
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      fs.utimesSync(oldBackup, oldDate, oldDate);

      const result = deleteOldBackups(TEST_DIR, 5);
      expect(result.deleted).toHaveLength(1);
      expect(result.deleted[0]).toBe(oldBackup);
      expect(fs.existsSync(oldBackup)).toBe(false);
      expect(fs.existsSync(newBackup)).toBe(true);
    });
  });

  describe("exportConversation", () => {
    it("should export conversation to markdown format", () => {
      const filePath = createTestFile("export-test.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Hello Claude" }] } },
        { message: { role: "assistant", content: [{ type: "text", text: "Hello! How can I help?" }] } },
      ]);

      const result = exportConversation(filePath, { format: "markdown" });
      expect(result.messageCount).toBe(2);
      expect(result.format).toBe("markdown");
      expect(result.content).toContain("Hello Claude");
      expect(result.content).toContain("Hello! How can I help?");
      expect(result.content).toContain("# Conversation Export");
    });

    it("should export conversation to JSON format", () => {
      const filePath = createTestFile("export-json.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Test message" }] } },
      ]);

      const result = exportConversation(filePath, { format: "json" });
      expect(result.format).toBe("json");
      const parsed = JSON.parse(result.content);
      expect(parsed.messageCount).toBe(1);
      expect(parsed.messages[0].content).toBe("Test message");
    });

    it("should handle images as placeholders", () => {
      const filePath = createTestFile("export-image.jsonl", [
        {
          message: {
            role: "user",
            content: [
              { type: "text", text: "Check this:" },
              { type: "image", source: { type: "base64", data: "abc" } },
            ],
          },
        },
      ]);

      const result = exportConversation(filePath, { format: "markdown" });
      expect(result.content).toContain("Check this:");
      expect(result.content).toContain("[Image]");
    });

    it("should include tool results when requested", () => {
      const filePath = createTestFile("export-tools.jsonl", [
        {
          message: { role: "assistant", content: [{ type: "tool_use", name: "read_file", input: {} }] },
          toolUseResult: { name: "read_file", content: "file content here" },
        },
      ]);

      const result = exportConversation(filePath, { format: "markdown", includeToolResults: true });
      expect(result.content).toContain("`read_file`");
      expect(result.content).toContain("file content here");
    });
  });

  describe("exportConversationToFile", () => {
    it("should write export to file", () => {
      const sourcePath = createTestFile("source.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Test" }] } },
      ]);
      const outputPath = path.join(TEST_DIR, "export.md");

      const result = exportConversationToFile(sourcePath, outputPath, { format: "markdown" });
      expect(result.success).toBe(true);
      expect(result.messageCount).toBe(1);
      expect(fs.existsSync(outputPath)).toBe(true);

      const content = fs.readFileSync(outputPath, "utf-8");
      expect(content).toContain("Test");
    });

    it("should handle non-existent source file", () => {
      const result = exportConversationToFile("/nonexistent.jsonl", "/output.md", { format: "markdown" });
      expect(result.success).toBe(false);
      expect(result.messageCount).toBe(0);
    });
  });

  describe("estimateContextSize", () => {
    it("should estimate tokens for text messages", () => {
      const filePath = createTestFile("context-text.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Hello world" }] } },
        { message: { role: "assistant", content: [{ type: "text", text: "Hi there! How can I help you today?" }] } },
      ]);

      const result = estimateContextSize(filePath);
      expect(result.messageCount).toBe(2);
      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.breakdown.userTokens).toBeGreaterThan(0);
      expect(result.breakdown.assistantTokens).toBeGreaterThan(0);
    });

    it("should estimate tokens for images", () => {
      const filePath = createTestFile("context-image.jsonl", [
        {
          message: {
            role: "user",
            content: [
              { type: "text", text: "Check this image:" },
              { type: "image", source: { type: "base64", data: createLargeBase64(50000) } },
            ],
          },
        },
      ]);

      const result = estimateContextSize(filePath);
      expect(result.breakdown.imageTokens).toBeGreaterThan(0);
      expect(result.breakdown.userTokens).toBeGreaterThan(0);
    });

    it("should estimate tokens for tool usage", () => {
      const filePath = createTestFile("context-tools.jsonl", [
        {
          message: {
            role: "assistant",
            content: [{ type: "tool_use", name: "read_file", input: { path: "/test.txt" } }],
          },
          toolUseResult: { name: "read_file", content: "File contents here" },
        },
      ]);

      const result = estimateContextSize(filePath);
      expect(result.breakdown.toolUseTokens).toBeGreaterThan(0);
      expect(result.breakdown.toolResultTokens).toBeGreaterThan(0);
    });

    it("should track largest message", () => {
      const filePath = createTestFile("context-largest.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Short" }] } },
        { message: { role: "assistant", content: [{ type: "text", text: "A".repeat(1000) }] } },
        { message: { role: "user", content: [{ type: "text", text: "Also short" }] } },
      ]);

      const result = estimateContextSize(filePath);
      expect(result.largestMessage).not.toBeNull();
      expect(result.largestMessage!.line).toBe(2);
      expect(result.largestMessage!.role).toBe("assistant");
    });

    it("should add warnings for high context usage", () => {
      const filePath = createTestFile("context-large.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "A".repeat(500000) }] } },
      ]);

      const result = estimateContextSize(filePath);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should handle non-existent file", () => {
      const result = estimateContextSize("/nonexistent.jsonl");
      expect(result.totalTokens).toBe(0);
      expect(result.messageCount).toBe(0);
      expect(result.warnings).toContain("Could not read file");
    });
  });

  describe("formatContextEstimate", () => {
    it("should format estimate as readable text", () => {
      const filePath = createTestFile("format-test.jsonl", [
        { message: { role: "user", content: [{ type: "text", text: "Test message" }] } },
      ]);

      const estimate = estimateContextSize(filePath);
      const formatted = formatContextEstimate(estimate);

      expect(formatted).toContain("Context Size Estimate");
      expect(formatted).toContain("Total:");
      expect(formatted).toContain("tokens");
      expect(formatted).toContain("User messages:");
    });
  });

  describe("generateUsageAnalytics", () => {
    it("should generate analytics for directory with conversations", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-test-proj1"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-test-proj1", "conv1.jsonl");
      const content = [
        { message: { role: "user", content: [{ type: "text", text: "Hello" }] }, timestamp: new Date().toISOString() },
        { message: { role: "assistant", content: [{ type: "text", text: "Hi there!" }] }, timestamp: new Date().toISOString() },
      ];
      fs.writeFileSync(filePath, content.map(l => JSON.stringify(l)).join("\n"), "utf-8");

      const analytics = generateUsageAnalytics(path.join(TEST_DIR, "projects"), 30);

      expect(analytics.overview.totalConversations).toBe(1);
      expect(analytics.overview.totalMessages).toBe(2);
      expect(analytics.overview.totalTokens).toBeGreaterThan(0);
      expect(analytics.topProjects.length).toBeGreaterThan(0);
    });

    it("should track tool usage", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-test-proj2"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-test-proj2", "conv2.jsonl");
      const content = [
        {
          message: {
            role: "assistant",
            content: [
              { type: "tool_use", name: "read_file", input: { path: "/test.txt" } },
              { type: "tool_use", name: "write_file", input: { path: "/out.txt" } },
            ],
          },
          timestamp: new Date().toISOString(),
        },
      ];
      fs.writeFileSync(filePath, content.map(l => JSON.stringify(l)).join("\n"), "utf-8");

      const analytics = generateUsageAnalytics(path.join(TEST_DIR, "projects"), 30);

      expect(analytics.toolUsage.length).toBeGreaterThan(0);
      expect(analytics.toolUsage.some(t => t.name === "read_file")).toBe(true);
      expect(analytics.toolUsage.some(t => t.name === "write_file")).toBe(true);
    });

    it("should handle empty directory", () => {
      fs.mkdirSync(path.join(TEST_DIR, "empty-projects"), { recursive: true });

      const analytics = generateUsageAnalytics(path.join(TEST_DIR, "empty-projects"), 30);

      expect(analytics.overview.totalConversations).toBe(0);
      expect(analytics.overview.totalMessages).toBe(0);
      expect(analytics.topProjects).toHaveLength(0);
    });

    it("should include daily activity for last N days", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-test-proj3"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-test-proj3", "conv3.jsonl");
      fs.writeFileSync(filePath, JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Test" }] } }), "utf-8");

      const analytics = generateUsageAnalytics(path.join(TEST_DIR, "projects"), 7);

      expect(analytics.dailyActivity.length).toBeLessThanOrEqual(7);
    });
  });

  describe("formatUsageAnalytics", () => {
    it("should format analytics as readable dashboard", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-test-fmt"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-test-fmt", "conv.jsonl");
      fs.writeFileSync(filePath, JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Test" }] } }), "utf-8");

      const analytics = generateUsageAnalytics(path.join(TEST_DIR, "projects"), 30);
      const formatted = formatUsageAnalytics(analytics);

      expect(formatted).toContain("USAGE ANALYTICS DASHBOARD");
      expect(formatted).toContain("OVERVIEW");
      expect(formatted).toContain("Conversations:");
      expect(formatted).toContain("ACTIVITY");
    });
  });

  describe("findDuplicates", () => {
    it("should detect duplicate conversations with same content", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-dup-proj1"), { recursive: true });
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-dup-proj2"), { recursive: true });

      const content = JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Same content in both files" }] } });

      fs.writeFileSync(path.join(TEST_DIR, "projects", "-Users-dup-proj1", "conv1.jsonl"), content, "utf-8");
      fs.writeFileSync(path.join(TEST_DIR, "projects", "-Users-dup-proj2", "conv2.jsonl"), content, "utf-8");

      const report = findDuplicates(path.join(TEST_DIR, "projects"));

      expect(report.conversationDuplicates.length).toBeGreaterThan(0);
      expect(report.conversationDuplicates[0].locations.length).toBe(2);
    });

    it("should detect duplicate images across conversations", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-img-dup"), { recursive: true });

      const imageData = "A".repeat(5000);
      const content = [
        { message: { role: "user", content: [{ type: "image", source: { type: "base64", data: imageData } }] } },
        { message: { role: "user", content: [{ type: "image", source: { type: "base64", data: imageData } }] } },
      ];

      fs.writeFileSync(
        path.join(TEST_DIR, "projects", "-Users-img-dup", "conv.jsonl"),
        content.map(l => JSON.stringify(l)).join("\n"),
        "utf-8"
      );

      const report = findDuplicates(path.join(TEST_DIR, "projects"));

      expect(report.contentDuplicates.length).toBeGreaterThan(0);
      expect(report.summary.duplicateImages).toBeGreaterThan(0);
    });

    it("should handle empty directory", () => {
      fs.mkdirSync(path.join(TEST_DIR, "empty-dup"), { recursive: true });

      const report = findDuplicates(path.join(TEST_DIR, "empty-dup"));

      expect(report.totalDuplicateGroups).toBe(0);
      expect(report.totalWastedSize).toBe(0);
    });

    it("should calculate wasted size correctly", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-size-test"), { recursive: true });

      const content = JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Test content" }] } });

      fs.writeFileSync(path.join(TEST_DIR, "projects", "-Users-size-test", "conv1.jsonl"), content, "utf-8");
      fs.writeFileSync(path.join(TEST_DIR, "projects", "-Users-size-test", "conv2.jsonl"), content, "utf-8");
      fs.writeFileSync(path.join(TEST_DIR, "projects", "-Users-size-test", "conv3.jsonl"), content, "utf-8");

      const report = findDuplicates(path.join(TEST_DIR, "projects"));

      const dupGroup = report.conversationDuplicates.find(g => g.locations.length === 3);
      if (dupGroup) {
        const fileSize = fs.statSync(path.join(TEST_DIR, "projects", "-Users-size-test", "conv1.jsonl")).size;
        expect(dupGroup.wastedSize).toBe(fileSize * 2);
      }
    });
  });

  describe("formatDuplicateReport", () => {
    it("should format report as readable text", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-fmt-dup"), { recursive: true });
      fs.writeFileSync(
        path.join(TEST_DIR, "projects", "-Users-fmt-dup", "conv.jsonl"),
        JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Test" }] } }),
        "utf-8"
      );

      const report = findDuplicates(path.join(TEST_DIR, "projects"));
      const formatted = formatDuplicateReport(report);

      expect(formatted).toContain("DUPLICATE DETECTION REPORT");
      expect(formatted).toContain("SUMMARY");
      expect(formatted).toContain("Duplicate groups:");
    });
  });

  describe("findArchiveCandidates", () => {
    it("should find old conversations", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-archive-test"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-archive-test", "old.jsonl");
      fs.writeFileSync(filePath, JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Old" }] } }), "utf-8");

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);
      fs.utimesSync(filePath, oldDate, oldDate);

      const candidates = findArchiveCandidates(path.join(TEST_DIR, "projects"), { minDaysInactive: 30 });

      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].daysSinceActivity).toBeGreaterThanOrEqual(30);
    });

    it("should not include recent conversations", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-archive-recent"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-archive-recent", "recent.jsonl");
      fs.writeFileSync(filePath, JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Recent" }] } }), "utf-8");

      const candidates = findArchiveCandidates(path.join(TEST_DIR, "projects"), { minDaysInactive: 30 });

      const recentCandidate = candidates.find(c => c.file.includes("recent.jsonl"));
      expect(recentCandidate).toBeUndefined();
    });

    it("should handle empty directory", () => {
      fs.mkdirSync(path.join(TEST_DIR, "empty-archive"), { recursive: true });

      const candidates = findArchiveCandidates(path.join(TEST_DIR, "empty-archive"), { minDaysInactive: 30 });

      expect(candidates).toHaveLength(0);
    });
  });

  describe("archiveConversations", () => {
    it("should perform dry run without moving files", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-archive-dry"), { recursive: true });
      const filePath = path.join(TEST_DIR, "projects", "-Users-archive-dry", "conv.jsonl");
      fs.writeFileSync(filePath, JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Test" }] } }), "utf-8");

      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 45);
      fs.utimesSync(filePath, oldDate, oldDate);

      const result = archiveConversations(path.join(TEST_DIR, "projects"), { minDaysInactive: 30, dryRun: true });

      expect(result.archived.length).toBeGreaterThan(0);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  describe("formatArchiveReport", () => {
    it("should format archive report", () => {
      const candidates = [{ file: "/test/conv.jsonl", lastModified: new Date(), messageCount: 10, sizeBytes: 1000, daysSinceActivity: 45 }];
      const formatted = formatArchiveReport(candidates);

      expect(formatted).toContain("CONVERSATION ARCHIVE REPORT");
      expect(formatted).toContain("ARCHIVE CANDIDATES");
    });

    it("should show no candidates message", () => {
      const formatted = formatArchiveReport([]);

      expect(formatted).toContain("No conversations eligible for archiving");
    });
  });

  describe("runMaintenance", () => {
    it("should return healthy status for clean directory", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-maint-clean"), { recursive: true });
      fs.writeFileSync(
        path.join(TEST_DIR, "projects", "-Users-maint-clean", "conv.jsonl"),
        JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Clean" }] } }),
        "utf-8"
      );

      const report = runMaintenance(path.join(TEST_DIR, "projects"), { dryRun: true });

      expect(report.status).toBe("healthy");
    });

    it("should detect issues needing fix", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-maint-issues"), { recursive: true });
      fs.writeFileSync(
        path.join(TEST_DIR, "projects", "-Users-maint-issues", "conv.jsonl"),
        JSON.stringify({
          message: {
            role: "user",
            content: [{ type: "image", source: { type: "base64", data: "A".repeat(MIN_PROBLEMATIC_BASE64_SIZE + 1) } }],
          },
        }),
        "utf-8"
      );

      const report = runMaintenance(path.join(TEST_DIR, "projects"), { dryRun: true });

      expect(report.status).toBe("critical");
      expect(report.actions.some(a => a.type === "fix")).toBe(true);
    });
  });

  describe("formatMaintenanceReport", () => {
    it("should format maintenance report", () => {
      fs.mkdirSync(path.join(TEST_DIR, "projects", "-Users-maint-fmt"), { recursive: true });
      fs.writeFileSync(
        path.join(TEST_DIR, "projects", "-Users-maint-fmt", "conv.jsonl"),
        JSON.stringify({ message: { role: "user", content: [{ type: "text", text: "Test" }] } }),
        "utf-8"
      );

      const report = runMaintenance(path.join(TEST_DIR, "projects"), { dryRun: true });
      const formatted = formatMaintenanceReport(report);

      expect(formatted).toContain("MAINTENANCE REPORT");
      expect(formatted).toContain("STATUS");
    });
  });
});
