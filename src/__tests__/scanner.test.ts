import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  checkContentForImages,
  fixImageInContent,
  scanFile,
  fixFile,
  getConversationStats,
  findAllJsonlFiles,
  findBackupFiles,
  restoreFromBackup,
  deleteOldBackups,
  MIN_PROBLEMATIC_BASE64_SIZE,
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

  describe("checkContentForImages", () => {
    it("should return false for empty content", () => {
      const result = checkContentForImages([]);
      expect(result.hasProblems).toBe(false);
      expect(result.indices).toEqual([]);
    });

    it("should return false for non-array content", () => {
      const result = checkContentForImages("not an array");
      expect(result.hasProblems).toBe(false);
    });

    it("should return false for text-only content", () => {
      const content = [{ type: "text", text: "Hello world" }];
      const result = checkContentForImages(content);
      expect(result.hasProblems).toBe(false);
    });

    it("should return false for small images", () => {
      const content = [
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(1000) },
        },
      ];
      const result = checkContentForImages(content);
      expect(result.hasProblems).toBe(false);
    });

    it("should detect oversized images", () => {
      const content = [
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(MIN_PROBLEMATIC_BASE64_SIZE + 1) },
        },
      ];
      const result = checkContentForImages(content);
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
      const result = checkContentForImages(content);
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
      const result = checkContentForImages(content);
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
      const result = checkContentForImages(content);
      expect(result.totalSize).toBe(size1 + size2);
    });
  });

  describe("fixImageInContent", () => {
    it("should replace oversized image with text placeholder", () => {
      const content = [
        { type: "text", text: "Before" },
        {
          type: "image",
          source: { type: "base64", data: createLargeBase64(200000) },
        },
        { type: "text", text: "After" },
      ];
      const fixed = fixImageInContent(content, [1]);
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
      const fixed = fixImageInContent(content, [[0, 1]]) as any[];
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
      fixImageInContent(original, [0]);
      expect(original).toEqual(originalCopy);
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
      expect(result.issues[0].type).toBe("message_content");
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
      expect(result.issues[0].type).toBe("toolUseResult");
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

    it("should count images and problematic images", () => {
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
      expect(stats.problematicImages).toBe(1);
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
});
