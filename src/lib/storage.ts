import * as fs from "fs";
import * as path from "path";
import * as os from "os";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const SNAPSHOTS_DIR = path.join(CLAUDE_DIR, "storage-snapshots");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export interface StorageCategory {
  name: string;
  path: string;
  totalSize: number;
  fileCount: number;
  cleanableSize: number;
  cleanableCount: number;
}

export interface StorageAnalysis {
  totalSize: number;
  categories: StorageCategory[];
  largestFiles: { path: string; size: number }[];
  recommendations: string[];
  analyzedAt: Date;
}

export interface CleanupTarget {
  category: string;
  files: string[];
  totalSize: number;
  reason: string;
}

export interface CleanupOptions {
  dryRun?: boolean;
  days?: number;
  categories?: string[];
}

export interface CleanupResult {
  deleted: string[];
  freed: number;
  errors: string[];
  dryRun: boolean;
}

export interface StorageSnapshot {
  id: string;
  date: Date;
  label: string;
  analysis: StorageAnalysis;
}

export interface SnapshotComparison {
  added: string[];
  removed: string[];
  sizeDiff: number;
  fileCountDiff: number;
  categoryDiffs: { name: string; sizeDiff: number; fileDiff: number }[];
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function getDirStats(dirPath: string): { totalSize: number; fileCount: number; files: { path: string; size: number; mtime: Date }[] } {
  const result = { totalSize: 0, fileCount: 0, files: [] as { path: string; size: number; mtime: Date }[] };

  function walk(dir: string) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(fullPath);
            result.totalSize += stat.size;
            result.fileCount++;
            result.files.push({ path: fullPath, size: stat.size, mtime: stat.mtime });
          } catch {
            // skip
          }
        }
      }
    } catch {
      // skip
    }
  }

  if (fs.existsSync(dirPath)) {
    walk(dirPath);
  }
  return result;
}

function isOlderThanDays(mtime: Date, days: number): boolean {
  const threshold = Date.now() - days * 24 * 60 * 60 * 1000;
  return mtime.getTime() < threshold;
}

function getActiveSessionIds(projectsDir: string): Set<string> {
  const ids = new Set<string>();
  try {
    const projects = fs.readdirSync(projectsDir, { withFileTypes: true });
    for (const proj of projects) {
      if (!proj.isDirectory()) continue;
      const indexPath = path.join(projectsDir, proj.name, "sessions-index.json");
      try {
        const data = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
        if (data.entries && Array.isArray(data.entries)) {
          for (const entry of data.entries) {
            if (entry.sessionId) ids.add(entry.sessionId);
          }
        }
      } catch {
        // skip
      }
    }
  } catch {
    // skip
  }
  return ids;
}

function isDirEmpty(dirPath: string): boolean {
  try {
    const entries = fs.readdirSync(dirPath);
    return entries.length === 0;
  } catch {
    return false;
  }
}

export function analyzeClaudeStorage(claudeDir = CLAUDE_DIR): StorageAnalysis {
  const categories: StorageCategory[] = [];
  const allFiles: { path: string; size: number }[] = [];
  const knownDirs = [
    { name: "projects", label: "projects" },
    { name: "plugins", label: "plugins" },
    { name: "local", label: "local" },
    { name: "shell-snapshots", label: "shell-snapshots" },
    { name: "file-history", label: "file-history" },
    { name: "debug", label: "debug" },
    { name: "todos", label: "todos" },
    { name: "session-env", label: "session-env" },
    { name: "cache", label: "cache" },
    { name: "statsig", label: "statsig" },
    { name: "agents", label: "agents" },
    { name: "plans", label: "plans" },
  ];

  const projectsDir = path.join(claudeDir, "projects");
  const activeSessionIds = getActiveSessionIds(projectsDir);

  for (const dir of knownDirs) {
    const dirPath = path.join(claudeDir, dir.name);
    const stats = getDirStats(dirPath);
    let cleanableSize = 0;
    let cleanableCount = 0;

    for (const file of stats.files) {
      allFiles.push({ path: file.path, size: file.size });

      switch (dir.name) {
        case "debug":
          if (isOlderThanDays(file.mtime, 7)) {
            cleanableSize += file.size;
            cleanableCount++;
          }
          break;
        case "todos":
          if (file.size <= 2) {
            cleanableSize += file.size;
            cleanableCount++;
          }
          break;
        case "shell-snapshots":
          if (isOlderThanDays(file.mtime, 7)) {
            cleanableSize += file.size;
            cleanableCount++;
          }
          break;
        case "cache":
          cleanableSize += file.size;
          cleanableCount++;
          break;
      }
    }

    if (dir.name === "file-history") {
      const fhDir = path.join(claudeDir, "file-history");
      try {
        const sessionDirs = fs.readdirSync(fhDir, { withFileTypes: true });
        for (const sd of sessionDirs) {
          if (sd.isDirectory() && !activeSessionIds.has(sd.name)) {
            const orphanStats = getDirStats(path.join(fhDir, sd.name));
            cleanableSize += orphanStats.totalSize;
            cleanableCount += orphanStats.fileCount;
          }
        }
      } catch {
        // skip
      }
    }

    if (dir.name === "session-env") {
      const seDir = path.join(claudeDir, "session-env");
      try {
        const sessionDirs = fs.readdirSync(seDir, { withFileTypes: true });
        for (const sd of sessionDirs) {
          if (sd.isDirectory() && isDirEmpty(path.join(seDir, sd.name))) {
            cleanableCount++;
          }
        }
      } catch {
        // skip
      }
    }

    categories.push({
      name: dir.label,
      path: dirPath,
      totalSize: stats.totalSize,
      fileCount: stats.fileCount,
      cleanableSize,
      cleanableCount,
    });
  }

  allFiles.sort((a, b) => b.size - a.size);
  const largestFiles = allFiles.slice(0, 10);

  const totalSize = categories.reduce((sum, c) => sum + c.totalSize, 0);
  const totalCleanable = categories.reduce((sum, c) => sum + c.cleanableSize, 0);

  const recommendations: string[] = [];
  if (totalCleanable > 10 * 1024 * 1024) {
    recommendations.push(`Run 'cct clean' to free ${formatBytes(totalCleanable)} of disk space`);
  }
  const debugCat = categories.find(c => c.name === "debug");
  if (debugCat && debugCat.totalSize > 50 * 1024 * 1024) {
    recommendations.push("Debug logs are large - consider cleaning with --category debug");
  }
  const projectsCat = categories.find(c => c.name === "projects");
  if (projectsCat && projectsCat.totalSize > 500 * 1024 * 1024) {
    recommendations.push("Projects directory is large - consider archiving old conversations");
  }

  return {
    totalSize,
    categories,
    largestFiles,
    recommendations,
    analyzedAt: new Date(),
  };
}

export function findCleanupTargets(claudeDir = CLAUDE_DIR, options: CleanupOptions = {}): CleanupTarget[] {
  const days = options.days ?? 7;
  const filterCategories = options.categories;
  const targets: CleanupTarget[] = [];

  function shouldProcess(category: string): boolean {
    return !filterCategories || filterCategories.includes(category);
  }

  if (shouldProcess("debug")) {
    const debugDir = path.join(claudeDir, "debug");
    const files: string[] = [];
    let totalSize = 0;
    try {
      const entries = fs.readdirSync(debugDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(debugDir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (isOlderThanDays(stat.mtime, days)) {
            files.push(fullPath);
            totalSize += stat.size;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    if (files.length > 0) {
      targets.push({ category: "debug", files, totalSize, reason: `Debug logs older than ${days} days` });
    }
  }

  if (shouldProcess("todos")) {
    const todosDir = path.join(claudeDir, "todos");
    const files: string[] = [];
    let totalSize = 0;
    try {
      const entries = fs.readdirSync(todosDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(todosDir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.size <= 2) {
            files.push(fullPath);
            totalSize += stat.size;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    if (files.length > 0) {
      targets.push({ category: "todos", files, totalSize, reason: "Empty todo files (0-2 bytes)" });
    }
  }

  if (shouldProcess("shell-snapshots")) {
    const snapDir = path.join(claudeDir, "shell-snapshots");
    const files: string[] = [];
    let totalSize = 0;
    try {
      const entries = fs.readdirSync(snapDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isFile()) continue;
        const fullPath = path.join(snapDir, entry.name);
        try {
          const stat = fs.statSync(fullPath);
          if (isOlderThanDays(stat.mtime, days)) {
            files.push(fullPath);
            totalSize += stat.size;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    if (files.length > 0) {
      targets.push({ category: "shell-snapshots", files, totalSize, reason: `Shell snapshots older than ${days} days` });
    }
  }

  if (shouldProcess("file-history")) {
    const fhDir = path.join(claudeDir, "file-history");
    const projectsDir = path.join(claudeDir, "projects");
    const activeIds = getActiveSessionIds(projectsDir);
    const files: string[] = [];
    let totalSize = 0;
    try {
      const sessionDirs = fs.readdirSync(fhDir, { withFileTypes: true });
      for (const sd of sessionDirs) {
        if (!sd.isDirectory() || activeIds.has(sd.name)) continue;
        const orphanDir = path.join(fhDir, sd.name);
        const stats = getDirStats(orphanDir);
        files.push(orphanDir);
        totalSize += stats.totalSize;
      }
    } catch { /* skip */ }
    if (files.length > 0) {
      targets.push({ category: "file-history", files, totalSize, reason: "Orphaned file history (session no longer exists)" });
    }
  }

  if (shouldProcess("session-env")) {
    const seDir = path.join(claudeDir, "session-env");
    const files: string[] = [];
    try {
      const entries = fs.readdirSync(seDir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const fullPath = path.join(seDir, entry.name);
        if (isDirEmpty(fullPath)) {
          files.push(fullPath);
        }
      }
    } catch { /* skip */ }
    if (files.length > 0) {
      targets.push({ category: "session-env", files, totalSize: 0, reason: "Empty session environment directories" });
    }
  }

  if (shouldProcess("cache")) {
    const cacheDir = path.join(claudeDir, "cache");
    const stats = getDirStats(cacheDir);
    if (stats.fileCount > 0) {
      targets.push({
        category: "cache",
        files: stats.files.map(f => f.path),
        totalSize: stats.totalSize,
        reason: "Rebuildable cache files",
      });
    }
  }

  return targets;
}

export function cleanClaudeDirectory(claudeDir = CLAUDE_DIR, options: CleanupOptions = {}): CleanupResult {
  const dryRun = options.dryRun ?? true;
  const targets = findCleanupTargets(claudeDir, options);

  const result: CleanupResult = {
    deleted: [],
    freed: 0,
    errors: [],
    dryRun,
  };

  if (dryRun) {
    for (const target of targets) {
      result.deleted.push(...target.files);
      result.freed += target.totalSize;
    }
    return result;
  }

  for (const target of targets) {
    for (const file of target.files) {
      try {
        const stat = fs.statSync(file);
        const sizeBeforeDelete = stat.isDirectory() ? getDirStats(file).totalSize : stat.size;
        if (stat.isDirectory()) {
          fs.rmSync(file, { recursive: true, force: true });
        } else {
          fs.unlinkSync(file);
        }
        result.deleted.push(file);
        if (target.category !== "session-env") {
          result.freed += sizeBeforeDelete;
        }
      } catch (e) {
        result.errors.push(`Failed to delete ${file}: ${e}`);
      }
    }
  }

  return result;
}

export function formatStorageReport(analysis: StorageAnalysis): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         CLAUDE STORAGE ANALYSIS              ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Total Size: ${formatBytes(analysis.totalSize)}\n\n`;

  output += "Category              Size        Files   Cleanable\n";
  output += "─────────────────────────────────────────────────────\n";

  for (const cat of analysis.categories) {
    if (cat.totalSize === 0 && cat.fileCount === 0) continue;
    const name = cat.name.padEnd(20);
    const size = formatBytes(cat.totalSize).padStart(10);
    const count = String(cat.fileCount).padStart(7);
    const cleanable = cat.cleanableSize > 0 ? formatBytes(cat.cleanableSize) : "-";
    output += `${name} ${size} ${count}   ${cleanable}\n`;
  }

  if (analysis.largestFiles.length > 0) {
    output += "\nLargest Files:\n";
    for (const file of analysis.largestFiles.slice(0, 5)) {
      const relPath = path.relative(CLAUDE_DIR, file.path);
      const short = relPath.length > 50 ? "..." + relPath.slice(-47) : relPath;
      output += `  ${formatBytes(file.size).padStart(10)}  ${short}\n`;
    }
  }

  if (analysis.recommendations.length > 0) {
    output += "\nRecommendations:\n";
    for (const rec of analysis.recommendations) {
      output += `  • ${rec}\n`;
    }
  }

  return output;
}

export function formatCleanupReport(targets: CleanupTarget[], result?: CleanupResult, dryRun = true): string {
  let output = "";

  if (dryRun) {
    output += "\n[DRY RUN] The following would be cleaned:\n\n";
  } else {
    output += "\nCleanup Results:\n\n";
  }

  const totalFiles = targets.reduce((sum, t) => sum + t.files.length, 0);
  const totalSize = targets.reduce((sum, t) => sum + t.totalSize, 0);

  for (const target of targets) {
    output += `  ${target.category}: ${target.files.length} items (${formatBytes(target.totalSize)})\n`;
    output += `    Reason: ${target.reason}\n`;
  }

  output += `\nTotal: ${totalFiles} items, ${formatBytes(totalSize)}\n`;

  if (result && !dryRun) {
    if (result.errors.length > 0) {
      output += `\nErrors (${result.errors.length}):\n`;
      for (const err of result.errors) {
        output += `  ✗ ${err}\n`;
      }
    }
    output += `\nFreed: ${formatBytes(result.freed)}\n`;
  }

  if (dryRun) {
    output += "\nRun without --dry-run to perform cleanup.\n";
  }

  return output;
}

export function saveStorageSnapshot(analysis: StorageAnalysis, label = "Manual Snapshot"): string {
  if (!fs.existsSync(SNAPSHOTS_DIR)) fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true });
  const id = new Date().toISOString().replace(/[:.]/g, "-");
  const snapshot: StorageSnapshot = { id, date: new Date(), label, analysis };
  const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2));
  return id;
}

export function listStorageSnapshots(): { id: string; date: Date; label: string; size: number }[] {
  if (!fs.existsSync(SNAPSHOTS_DIR)) return [];
  return fs.readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith(".json"))
    .map(f => {
      try {
        const content = fs.readFileSync(path.join(SNAPSHOTS_DIR, f), "utf-8");
        const s = JSON.parse(content);
        return { id: s.id, date: new Date(s.date), label: s.label, size: s.analysis.totalSize };
      } catch { return null; }
    })
    .filter((x): x is { id: string; date: Date; label: string; size: number } => !!x)
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function loadStorageSnapshot(id: string): StorageSnapshot | null {
  const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  const s = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  s.date = new Date(s.date);
  return s;
}

export function compareStorageSnapshots(base: StorageAnalysis, current: StorageAnalysis): SnapshotComparison {
  const baseFiles = new Set(base.largestFiles.map(f => f.path)); // Note: largestFiles is only top 10, strictly we'd need allFiles to be accurate on added/removed. 
  // However, StorageAnalysis only exposes largestFiles. To do full comparisons, we'd need to store allFiles in StorageAnalysis which might be huge.
  // For now, let's compare categories and totals.

  const categoryDiffs = current.categories.map(c => {
    const b = base.categories.find(k => k.name === c.name);
    return {
      name: c.name,
      sizeDiff: c.totalSize - (b?.totalSize || 0),
      fileDiff: c.fileCount - (b?.fileCount || 0)
    };
  });

  return {
    added: [], // Cannot determine from summary
    removed: [], // Cannot determine from summary
    sizeDiff: current.totalSize - base.totalSize,
    fileCountDiff: current.categories.reduce((s, c) => s + c.fileCount, 0) - base.categories.reduce((s, c) => s + c.fileCount, 0),
    categoryDiffs
  };
}

export function deleteStorageSnapshot(id: string): boolean {
  const filePath = path.join(SNAPSHOTS_DIR, `${id}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}
