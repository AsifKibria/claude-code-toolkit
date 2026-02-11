import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  analyzeClaudeStorage,
  findCleanupTargets,
  cleanClaudeDirectory,
  formatStorageReport,
  formatCleanupReport,
} from "../lib/storage.js";

const TEST_DIR = path.join(os.tmpdir(), "cct-storage-test");

function createDir(...parts: string[]) {
  const dir = path.join(TEST_DIR, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function createFile(content: string, ...parts: string[]) {
  const filePath = path.join(TEST_DIR, ...parts);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function setFileAge(filePath: string, days: number) {
  const mtime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  fs.utimesSync(filePath, mtime, mtime);
}

describe("Storage Module", () => {
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

  describe("analyzeClaudeStorage", () => {
    it("should analyze empty directory", () => {
      const result = analyzeClaudeStorage(TEST_DIR);
      expect(result.totalSize).toBe(0);
      expect(result.categories).toBeDefined();
      expect(result.analyzedAt).toBeInstanceOf(Date);
    });

    it("should detect debug files", () => {
      createFile("debug log content", "debug", "abc-123.txt");
      createFile("more debug", "debug", "def-456.txt");

      const result = analyzeClaudeStorage(TEST_DIR);
      const debugCat = result.categories.find(c => c.name === "debug");
      expect(debugCat).toBeDefined();
      expect(debugCat!.fileCount).toBe(2);
      expect(debugCat!.totalSize).toBeGreaterThan(0);
    });

    it("should detect empty todo files as cleanable", () => {
      createFile("[]", "todos", "session1.json");
      createFile("[]", "todos", "session2.json");
      createFile('[{"task":"real"}]', "todos", "session3.json");

      const result = analyzeClaudeStorage(TEST_DIR);
      const todosCat = result.categories.find(c => c.name === "todos");
      expect(todosCat).toBeDefined();
      expect(todosCat!.fileCount).toBe(3);
      expect(todosCat!.cleanableCount).toBe(2);
    });

    it("should detect old debug files as cleanable", () => {
      const f1 = createFile("old debug", "debug", "old.txt");
      createFile("new debug", "debug", "new.txt");
      setFileAge(f1, 10);

      const result = analyzeClaudeStorage(TEST_DIR);
      const debugCat = result.categories.find(c => c.name === "debug");
      expect(debugCat!.cleanableCount).toBe(1);
    });

    it("should track largest files", () => {
      createFile("x".repeat(1000), "debug", "big.txt");
      createFile("x".repeat(100), "debug", "small.txt");

      const result = analyzeClaudeStorage(TEST_DIR);
      expect(result.largestFiles.length).toBeGreaterThan(0);
      expect(result.largestFiles[0].size).toBe(1000);
    });

    it("should detect orphaned file-history sessions", () => {
      createFile("version1", "file-history", "orphan-session", "file1@v1");
      createDir("projects");

      const result = analyzeClaudeStorage(TEST_DIR);
      const fhCat = result.categories.find(c => c.name === "file-history");
      expect(fhCat).toBeDefined();
      expect(fhCat!.cleanableCount).toBeGreaterThan(0);
    });

    it("should not count active file-history sessions as cleanable", () => {
      const sessionId = "abc-123";
      createFile("version1", "file-history", sessionId, "file1@v1");
      const indexData = { version: 1, entries: [{ sessionId }] };
      createFile(JSON.stringify(indexData), "projects", "test-project", "sessions-index.json");

      const result = analyzeClaudeStorage(TEST_DIR);
      const fhCat = result.categories.find(c => c.name === "file-history");
      expect(fhCat!.cleanableCount).toBe(0);
    });

    it("should detect empty session-env directories as cleanable", () => {
      createDir("session-env", "empty-session-1");
      createDir("session-env", "empty-session-2");
      createFile("data", "session-env", "has-data", "env.json");

      const result = analyzeClaudeStorage(TEST_DIR);
      const seCat = result.categories.find(c => c.name === "session-env");
      expect(seCat!.cleanableCount).toBe(2);
    });

    it("should generate recommendations for large directories", () => {
      const result = analyzeClaudeStorage(TEST_DIR);
      expect(result.recommendations).toBeDefined();
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe("findCleanupTargets", () => {
    it("should return empty for clean directory", () => {
      const targets = findCleanupTargets(TEST_DIR);
      expect(targets).toEqual([]);
    });

    it("should find old debug logs", () => {
      const f = createFile("old log", "debug", "old.txt");
      setFileAge(f, 10);

      const targets = findCleanupTargets(TEST_DIR);
      const debugTarget = targets.find(t => t.category === "debug");
      expect(debugTarget).toBeDefined();
      expect(debugTarget!.files.length).toBe(1);
    });

    it("should not find recent debug logs with default age", () => {
      createFile("new log", "debug", "new.txt");

      const targets = findCleanupTargets(TEST_DIR);
      const debugTarget = targets.find(t => t.category === "debug");
      expect(debugTarget).toBeUndefined();
    });

    it("should respect custom days threshold", () => {
      const f = createFile("log", "debug", "test.txt");
      setFileAge(f, 3);

      const defaultTargets = findCleanupTargets(TEST_DIR, { days: 7 });
      expect(defaultTargets.find(t => t.category === "debug")).toBeUndefined();

      const strictTargets = findCleanupTargets(TEST_DIR, { days: 2 });
      expect(strictTargets.find(t => t.category === "debug")).toBeDefined();
    });

    it("should find empty todo files", () => {
      createFile("[]", "todos", "empty.json");
      createFile('[{"content":"task"}]', "todos", "valid.json");

      const targets = findCleanupTargets(TEST_DIR);
      const todoTarget = targets.find(t => t.category === "todos");
      expect(todoTarget).toBeDefined();
      expect(todoTarget!.files.length).toBe(1);
    });

    it("should find old shell snapshots", () => {
      const f = createFile("snapshot", "shell-snapshots", "snapshot-zsh-123.sh");
      setFileAge(f, 10);

      const targets = findCleanupTargets(TEST_DIR);
      const snapTarget = targets.find(t => t.category === "shell-snapshots");
      expect(snapTarget).toBeDefined();
    });

    it("should filter by category", () => {
      const f = createFile("old log", "debug", "old.txt");
      setFileAge(f, 10);
      createFile("[]", "todos", "empty.json");

      const targets = findCleanupTargets(TEST_DIR, { categories: ["debug"] });
      expect(targets.length).toBe(1);
      expect(targets[0].category).toBe("debug");
    });

    it("should find cache files", () => {
      createFile("cached data", "cache", "changelog.md");

      const targets = findCleanupTargets(TEST_DIR);
      const cacheTarget = targets.find(t => t.category === "cache");
      expect(cacheTarget).toBeDefined();
    });

    it("should find orphaned file-history", () => {
      createFile("v1", "file-history", "dead-session", "file@v1");
      createDir("projects");

      const targets = findCleanupTargets(TEST_DIR);
      const fhTarget = targets.find(t => t.category === "file-history");
      expect(fhTarget).toBeDefined();
    });

    it("should find empty session-env dirs", () => {
      createDir("session-env", "empty-1");

      const targets = findCleanupTargets(TEST_DIR);
      const seTarget = targets.find(t => t.category === "session-env");
      expect(seTarget).toBeDefined();
    });
  });

  describe("cleanClaudeDirectory", () => {
    it("should perform dry run by default", () => {
      const f = createFile("old log", "debug", "old.txt");
      setFileAge(f, 10);

      const result = cleanClaudeDirectory(TEST_DIR);
      expect(result.dryRun).toBe(true);
      expect(result.deleted.length).toBeGreaterThan(0);
      expect(fs.existsSync(f)).toBe(true);
    });

    it("should delete files when not dry run", () => {
      const f = createFile("old log", "debug", "old.txt");
      setFileAge(f, 10);

      const result = cleanClaudeDirectory(TEST_DIR, { dryRun: false });
      expect(result.dryRun).toBe(false);
      expect(result.deleted.length).toBe(1);
      expect(fs.existsSync(f)).toBe(false);
    });

    it("should delete empty todo files", () => {
      const empty = createFile("[]", "todos", "empty.json");
      const valid = createFile('[{"task":"real"}]', "todos", "valid.json");

      cleanClaudeDirectory(TEST_DIR, { dryRun: false });
      expect(fs.existsSync(empty)).toBe(false);
      expect(fs.existsSync(valid)).toBe(true);
    });

    it("should remove orphaned file-history directories", () => {
      const orphanDir = createDir("file-history", "dead-session");
      createFile("v1", "file-history", "dead-session", "file@v1");
      createDir("projects");

      cleanClaudeDirectory(TEST_DIR, { dryRun: false });
      expect(fs.existsSync(orphanDir)).toBe(false);
    });

    it("should remove empty session-env dirs", () => {
      const emptyDir = createDir("session-env", "empty-1");

      cleanClaudeDirectory(TEST_DIR, { dryRun: false });
      expect(fs.existsSync(emptyDir)).toBe(false);
    });

    it("should handle errors gracefully", () => {
      const result = cleanClaudeDirectory(path.join(TEST_DIR, "nonexistent"), { dryRun: false });
      expect(result.deleted).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });

  describe("formatStorageReport", () => {
    it("should format a report", () => {
      const analysis = analyzeClaudeStorage(TEST_DIR);
      const report = formatStorageReport(analysis);
      expect(report).toContain("STORAGE ANALYSIS");
      expect(report).toContain("Total Size:");
    });
  });

  describe("formatCleanupReport", () => {
    it("should format dry run report", () => {
      const targets = [{ category: "debug", files: ["a.txt"], totalSize: 1024, reason: "Old" }];
      const report = formatCleanupReport(targets, undefined, true);
      expect(report).toContain("DRY RUN");
      expect(report).toContain("debug");
    });

    it("should format actual cleanup report", () => {
      const targets = [{ category: "debug", files: ["a.txt"], totalSize: 1024, reason: "Old" }];
      const result = { deleted: ["a.txt"], freed: 1024, errors: [], dryRun: false };
      const report = formatCleanupReport(targets, result, false);
      expect(report).toContain("Cleanup Results");
    });
  });
});
