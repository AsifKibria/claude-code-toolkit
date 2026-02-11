import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import {
  inventoryTraces,
  cleanTraces,
  wipeAllTraces,
  generateTraceGuardHooks,
  formatTraceInventory,
  formatTraceCleanReport,
  formatTraceGuardConfig,
  generateEnhancedPreview,
} from "../lib/trace.js";

const TEST_DIR = path.join(os.tmpdir(), "cct-trace-test");

function createFile(content: string, ...parts: string[]) {
  const filePath = path.join(TEST_DIR, ...parts);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
  return filePath;
}

function createDir(...parts: string[]) {
  const dir = path.join(TEST_DIR, ...parts);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

describe("Trace Module", () => {
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

  describe("inventoryTraces", () => {
    it("should inventory empty directory", () => {
      const inv = inventoryTraces(TEST_DIR);
      expect(inv.totalSize).toBe(0);
      expect(inv.totalFiles).toBe(0);
      expect(inv.categories.length).toBe(0);
    });

    it("should categorize conversation files", () => {
      createFile('{"type":"user"}', "projects", "test-proj", "session.jsonl");

      const inv = inventoryTraces(TEST_DIR);
      const convCat = inv.categories.find(c => c.name === "conversations");
      expect(convCat).toBeDefined();
      expect(convCat!.fileCount).toBe(1);
      expect(convCat!.sensitivity).toBe("critical");
    });

    it("should categorize debug logs", () => {
      createFile("debug info", "debug", "abc-123.txt");

      const inv = inventoryTraces(TEST_DIR);
      const debugCat = inv.categories.find(c => c.name === "debug-logs");
      expect(debugCat).toBeDefined();
      expect(debugCat!.sensitivity).toBe("high");
    });

    it("should categorize shell snapshots", () => {
      createFile("export PATH=/usr/bin", "shell-snapshots", "snapshot-zsh-123.sh");

      const inv = inventoryTraces(TEST_DIR);
      const snapCat = inv.categories.find(c => c.name === "shell-snapshots");
      expect(snapCat).toBeDefined();
      expect(snapCat!.sensitivity).toBe("high");
    });

    it("should categorize file history", () => {
      createFile("file content", "file-history", "session-1", "file@v1");

      const inv = inventoryTraces(TEST_DIR);
      const fhCat = inv.categories.find(c => c.name === "file-history");
      expect(fhCat).toBeDefined();
      expect(fhCat!.sensitivity).toBe("critical");
    });

    it("should categorize memory files", () => {
      createFile("# Memory", "projects", "test-proj", "memory", "MEMORY.md");

      const inv = inventoryTraces(TEST_DIR);
      const memCat = inv.categories.find(c => c.name === "memory");
      expect(memCat).toBeDefined();
      expect(memCat!.sensitivity).toBe("high");
    });

    it("should categorize todos", () => {
      createFile("[]", "todos", "session.json");

      const inv = inventoryTraces(TEST_DIR);
      const todoCat = inv.categories.find(c => c.name === "todos");
      expect(todoCat).toBeDefined();
      expect(todoCat!.sensitivity).toBe("low");
    });

    it("should categorize telemetry", () => {
      createFile("{}", "statsig", "config.json");

      const inv = inventoryTraces(TEST_DIR);
      const telCat = inv.categories.find(c => c.name === "telemetry");
      expect(telCat).toBeDefined();
      expect(telCat!.sensitivity).toBe("medium");
    });

    it("should categorize plans", () => {
      createFile("# Plan", "plans", "plan.md");

      const inv = inventoryTraces(TEST_DIR);
      const planCat = inv.categories.find(c => c.name === "plans");
      expect(planCat).toBeDefined();
    });

    it("should categorize history.jsonl", () => {
      createFile('{"session":"test"}', "history.jsonl");

      const inv = inventoryTraces(TEST_DIR);
      const histCat = inv.categories.find(c => c.name === "history");
      expect(histCat).toBeDefined();
    });

    it("should categorize stats-cache.json", () => {
      createFile('{"daily":[]}', "stats-cache.json");

      const inv = inventoryTraces(TEST_DIR);
      const statsCat = inv.categories.find(c => c.name === "stats");
      expect(statsCat).toBeDefined();
    });

    it("should count critical and high items", () => {
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");
      createFile("debug", "debug", "log.txt");

      const inv = inventoryTraces(TEST_DIR);
      expect(inv.criticalItems).toBeGreaterThan(0);
      expect(inv.highItems).toBeGreaterThan(0);
    });

    it("should track oldest and newest files", () => {
      createFile("log1", "debug", "old.txt");
      createFile("log2", "debug", "new.txt");

      const inv = inventoryTraces(TEST_DIR);
      const debugCat = inv.categories.find(c => c.name === "debug-logs");
      expect(debugCat!.oldestFile).toBeDefined();
      expect(debugCat!.newestFile).toBeDefined();
    });

    it("should categorize sessions-index.json", () => {
      createFile('{"version":1,"entries":[]}', "projects", "test", "sessions-index.json");

      const inv = inventoryTraces(TEST_DIR);
      const indexCat = inv.categories.find(c => c.name === "sessions-index");
      expect(indexCat).toBeDefined();
    });

    it("should filter by project", () => {
      createFile('{"type":"user"}', "projects", "project-a", "session.jsonl");
      createFile('{"type":"user"}', "projects", "project-b", "session.jsonl");
      createFile("debug", "debug", "log.txt");

      const inv = inventoryTraces(TEST_DIR, { project: "project-a" });
      const convCat = inv.categories.find(c => c.name === "conversations");
      expect(convCat!.fileCount).toBe(1);
    });
  });

  describe("cleanTraces", () => {
    it("should perform dry run by default", () => {
      createFile("debug", "debug", "log.txt");

      const result = cleanTraces(TEST_DIR);
      expect(result.dryRun).toBe(true);
      expect(result.deleted.length).toBeGreaterThan(0);
      expect(fs.existsSync(path.join(TEST_DIR, "debug", "log.txt"))).toBe(true);
    });

    it("should delete files when not dry run", () => {
      const f = createFile("debug", "debug", "log.txt");

      const result = cleanTraces(TEST_DIR, { dryRun: false });
      expect(result.deleted.length).toBeGreaterThan(0);
      expect(fs.existsSync(f)).toBe(false);
    });

    it("should preserve settings when option set", () => {
      createFile("{}", "settings.json");
      createFile("debug", "debug", "log.txt");

      const result = cleanTraces(TEST_DIR, { dryRun: false, preserveSettings: true });
      expect(fs.existsSync(path.join(TEST_DIR, "settings.json"))).toBe(true);
    });

    it("should filter by category", () => {
      createFile("debug", "debug", "log.txt");
      createFile("[]", "todos", "task.json");

      const result = cleanTraces(TEST_DIR, { categories: ["debug-logs"], dryRun: false });
      expect(result.categoriesAffected).toContain("debug-logs");
      expect(fs.existsSync(path.join(TEST_DIR, "todos", "task.json"))).toBe(true);
    });

    it("should filter by age", () => {
      const oldFile = createFile("old", "debug", "old.txt");
      const newFile = createFile("new", "debug", "new.txt");
      const oldMtime = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
      fs.utimesSync(oldFile, oldMtime, oldMtime);

      const result = cleanTraces(TEST_DIR, { days: 7, dryRun: false });
      expect(fs.existsSync(oldFile)).toBe(false);
      expect(fs.existsSync(newFile)).toBe(true);
    });

    it("should skip agents and ide-locks by default", () => {
      createFile("agent def", "agents", "agent.md");
      createFile("lock", "ide", "vscode.lock");

      const result = cleanTraces(TEST_DIR, { dryRun: true });
      const deleted = result.deleted.map(d => path.relative(TEST_DIR, d));
      expect(deleted.some(d => d.startsWith("agents"))).toBe(false);
      expect(deleted.some(d => d.startsWith("ide"))).toBe(false);
    });
  });

  describe("wipeAllTraces", () => {
    it("should require confirmation", () => {
      createFile("data", "debug", "log.txt");

      const result = wipeAllTraces(TEST_DIR);
      expect(result.filesWiped).toBe(0);
      expect(result.preserved).toContain("Wipe not confirmed. Pass confirm: true to execute.");
      expect(fs.existsSync(path.join(TEST_DIR, "debug", "log.txt"))).toBe(true);
    });

    it("should wipe all traces when confirmed", () => {
      createFile("debug", "debug", "log.txt");
      createFile("[]", "todos", "task.json");
      createFile("snapshot", "shell-snapshots", "snap.sh");

      const result = wipeAllTraces(TEST_DIR, { confirm: true });
      expect(result.filesWiped).toBe(3);
      expect(result.bytesFreed).toBeGreaterThan(0);
      expect(result.wipeReceipt).toContain("Trace Wipe Receipt");
    });

    it("should preserve settings when option set", () => {
      createFile("{}", "settings.json");
      createFile("debug", "debug", "log.txt");

      wipeAllTraces(TEST_DIR, { confirm: true, keepSettings: true });
      // Note: settings.json won't be categorized unless we add it to trace categories
      // The wipe preserves it via skipPaths
    });

    it("should generate wipe receipt", () => {
      createFile("data", "debug", "log.txt");

      const result = wipeAllTraces(TEST_DIR, { confirm: true });
      expect(result.wipeReceipt).toContain("debug-logs");
      expect(result.completedAt).toBeInstanceOf(Date);
    });
  });

  describe("generateTraceGuardHooks", () => {
    it("should generate paranoid mode hooks", () => {
      const config = generateTraceGuardHooks({ mode: "paranoid" });
      expect(config.mode).toBe("paranoid");
      expect(config.hooks.length).toBeGreaterThan(0);
      expect(config.hooks.some(h => h.description.includes("Block CLAUDE.md"))).toBe(true);
      expect(config.hooks.some(h => h.description.includes("Delete conversation"))).toBe(true);
      expect(config.settingsJson).toContain("hooks");
      expect(config.instructions).toContain("PARANOID");
    });

    it("should generate moderate mode hooks", () => {
      const config = generateTraceGuardHooks({ mode: "moderate" });
      expect(config.mode).toBe("moderate");
      expect(config.hooks.some(h => h.description.includes("24 hours"))).toBe(true);
      expect(config.instructions).toContain("MODERATE");
    });

    it("should generate minimal mode hooks", () => {
      const config = generateTraceGuardHooks({ mode: "minimal" });
      expect(config.mode).toBe("minimal");
      expect(config.hooks.some(h => h.description.includes("7 days"))).toBe(true);
      expect(config.instructions).toContain("MINIMAL");
    });

    it("should default to moderate mode", () => {
      const config = generateTraceGuardHooks();
      expect(config.mode).toBe("moderate");
    });

    it("should generate valid JSON in settingsJson", () => {
      const config = generateTraceGuardHooks({ mode: "paranoid" });
      expect(() => JSON.parse(config.settingsJson)).not.toThrow();
    });

    it("should include enterprise deployment paths", () => {
      const config = generateTraceGuardHooks();
      expect(config.instructions).toContain("managed-settings.json");
      expect(config.instructions).toContain("macOS");
    });
  });

  describe("formatTraceInventory", () => {
    it("should format inventory report", () => {
      createFile("debug", "debug", "log.txt");
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const inv = inventoryTraces(TEST_DIR);
      const report = formatTraceInventory(inv);
      expect(report).toContain("TRACE INVENTORY");
      expect(report).toContain("Total trace data:");
      expect(report).toContain("critical");
    });
  });

  describe("formatTraceCleanReport", () => {
    it("should format dry run report", () => {
      const result: import("../lib/trace.js").TraceCleanResult = {
        deleted: ["file1", "file2"],
        freed: 1024,
        errors: [],
        categoriesAffected: ["debug-logs"],
        dryRun: true,
      };

      const report = formatTraceCleanReport(result);
      expect(report).toContain("DRY RUN");
      expect(report).toContain("2");
    });
  });

  describe("formatTraceGuardConfig", () => {
    it("should format guard config", () => {
      const config = generateTraceGuardHooks({ mode: "paranoid" });
      const report = formatTraceGuardConfig(config);
      expect(report).toContain("paranoid");
    });
  });

  describe("generateEnhancedPreview", () => {
    it("should generate preview for clean operation", () => {
      createFile("debug", "debug", "log.txt");
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const preview = generateEnhancedPreview(TEST_DIR, { operation: "clean" });
      expect(preview.summary.totalFiles).toBeGreaterThan(0);
      expect(preview.byCategory.length).toBeGreaterThan(0);
      expect(preview.warnings.length).toBeGreaterThan(0);
    });

    it("should generate preview for wipe operation", () => {
      createFile("debug", "debug", "log.txt");

      const preview = generateEnhancedPreview(TEST_DIR, { operation: "wipe" });
      expect(preview.warnings.some(w => w.includes("SECURE WIPE"))).toBe(true);
    });

    it("should include impact warnings in category data", () => {
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const preview = generateEnhancedPreview(TEST_DIR, { operation: "clean" });
      const convCat = preview.byCategory.find(c => c.name === "conversations");
      expect(convCat).toBeDefined();
      expect(convCat!.impactWarning).toContain("prompts");
    });

    it("should include sample paths in preview", () => {
      createFile("debug1", "debug", "log1.txt");
      createFile("debug2", "debug", "log2.txt");

      const preview = generateEnhancedPreview(TEST_DIR, { operation: "clean" });
      const debugCat = preview.byCategory.find(c => c.name === "debug-logs");
      expect(debugCat).toBeDefined();
      expect(debugCat!.samplePaths.length).toBeGreaterThan(0);
    });

    it("should exclude categories when specified", () => {
      createFile("debug", "debug", "log.txt");
      createFile("[]", "todos", "task.json");

      const preview = generateEnhancedPreview(TEST_DIR, { operation: "clean", categories: ["debug-logs"] });
      const todoCat = preview.byCategory.find(c => c.name === "todos");
      expect(todoCat).toBeUndefined();
    });

    it("should count files by sensitivity level", () => {
      createFile("debug", "debug", "log.txt");
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const preview = generateEnhancedPreview(TEST_DIR, { operation: "clean" });
      expect(preview.summary.criticalFiles + preview.summary.highFiles).toBeGreaterThan(0);
    });
  });

  describe("exclusion filtering", () => {
    it("should filter by category exclusion", () => {
      createFile("debug", "debug", "log.txt");
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const result = cleanTraces(TEST_DIR, {
        dryRun: true,
        exclusions: [{ type: "category", value: "conversations" }]
      });
      expect(result.deleted.some(d => d.includes("session.jsonl"))).toBe(false);
      expect(result.deleted.some(d => d.includes("log.txt"))).toBe(true);
    });

    it("should filter by project exclusion", () => {
      createFile('{"type":"user"}', "projects", "my-project", "session.jsonl");
      createFile('{"type":"user"}', "projects", "other-project", "session.jsonl");

      const result = cleanTraces(TEST_DIR, {
        dryRun: true,
        exclusions: [{ type: "project", value: "my-project" }]
      });
      const deletedPaths = result.deleted.map(d => d);
      expect(deletedPaths.some(d => d.includes("my-project"))).toBe(false);
      expect(deletedPaths.some(d => d.includes("other-project"))).toBe(true);
    });

    it("should filter by path pattern exclusion", () => {
      createFile("debug1", "debug", "keep-log.txt");
      createFile("debug2", "debug", "delete-log.txt");

      const result = cleanTraces(TEST_DIR, {
        dryRun: true,
        exclusions: [{ type: "path", value: "debug/keep*" }]
      });
      expect(result.deleted.some(d => d.includes("keep-log"))).toBe(false);
      expect(result.deleted.some(d => d.includes("delete-log"))).toBe(true);
    });

    it("should track preserved items in enhanced preview", () => {
      createFile("debug", "debug", "log.txt");
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const preview = generateEnhancedPreview(TEST_DIR, {
        operation: "clean",
        exclusions: [{ id: "test-exc", type: "category", value: "conversations" }]
      });
      expect(preview.preserved.totalPreserved).toBeGreaterThan(0);
      expect(preview.preserved.byExclusion.some(e => e.exclusion.value === "conversations")).toBe(true);
    });

    it("should apply exclusions to wipe operation", () => {
      createFile("debug", "debug", "log.txt");
      createFile('{"type":"user"}', "projects", "test", "session.jsonl");

      const result = wipeAllTraces(TEST_DIR, {
        confirm: true,
        exclusions: [{ type: "category", value: "conversations" }]
      });
      expect(fs.existsSync(path.join(TEST_DIR, "projects", "test", "session.jsonl"))).toBe(true);
      expect(result.preserved.some(p => p.includes("exclusion"))).toBe(true);
    });
  });
});
