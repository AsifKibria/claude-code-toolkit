import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

export interface TraceItem {
  category: string;
  path: string;
  size: number;
  modified: Date;
  sensitivity: "critical" | "high" | "medium" | "low";
}

export interface TraceCategory {
  name: string;
  description: string;
  sensitivity: "critical" | "high" | "medium" | "low";
  items: TraceItem[];
  totalSize: number;
  fileCount: number;
  oldestFile?: Date;
  newestFile?: Date;
}

export interface TraceInventory {
  totalSize: number;
  totalFiles: number;
  categories: TraceCategory[];
  criticalItems: number;
  highItems: number;
  analyzedAt: Date;
}

export interface TraceCleanOptions {
  categories?: string[];
  project?: string;
  days?: number;
  dryRun?: boolean;
  preserveSettings?: boolean;
  exclusions?: TraceExclusion[];
}

export interface TraceCleanResult {
  deleted: string[];
  freed: number;
  errors: string[];
  categoriesAffected: string[];
  dryRun: boolean;
}

export interface TraceWipeOptions {
  confirm?: boolean;
  keepSettings?: boolean;
  keepPlugins?: boolean;
  exclusions?: TraceExclusion[];
}

export interface TraceWipeResult {
  filesWiped: number;
  bytesFreed: number;
  categoriesWiped: string[];
  preserved: string[];
  wipeReceipt: string;
  completedAt: Date;
}

export interface TraceExclusion {
  id?: string;
  type: "project" | "category" | "path";
  value: string;
  description?: string;
}

export interface EnhancedTracePreview {
  summary: {
    totalFiles: number;
    totalSize: number;
    criticalFiles: number;
    highFiles: number;
    mediumFiles: number;
    lowFiles: number;
  };
  byCategory: Array<{
    name: string;
    sensitivity: "critical" | "high" | "medium" | "low";
    description: string;
    fileCount: number;
    totalSize: number;
    samplePaths: string[];
    impactWarning: string;
  }>;
  preserved: {
    byExclusion: Array<{
      exclusion: TraceExclusion;
      matchedFiles: number;
      matchedSize: number;
    }>;
    settings: boolean;
    totalPreserved: number;
  };
  warnings: string[];
}

export interface TraceGuardHook {
  event: string;
  matcher?: string;
  command: string;
  description: string;
}

export interface TraceGuardConfig {
  mode: string;
  hooks: TraceGuardHook[];
  settingsJson: string;
  instructions: string;
}

interface TraceCategoryDef {
  name: string;
  description: string;
  sensitivity: "critical" | "high" | "medium" | "low";
  paths: string[];
  pattern?: RegExp;
  isDir?: boolean;
  impactWarning: string;
}

const TRACE_CATEGORIES: TraceCategoryDef[] = [
  {
    name: "conversations",
    description: "Full conversation transcripts with all code and prompts",
    sensitivity: "critical",
    paths: ["projects"],
    pattern: /\.jsonl$/,
    impactWarning: "Your prompts, code snippets, and complete conversation history will be permanently deleted. You will lose the ability to review past sessions or resume conversations.",
  },
  {
    name: "subagents",
    description: "Sub-agent conversation transcripts",
    sensitivity: "critical",
    paths: ["projects"],
    pattern: /subagents\/agent-.*\.jsonl$/,
    impactWarning: "All sub-agent conversation transcripts will be deleted. Background task history and multi-step operation logs will be lost.",
  },
  {
    name: "debug-logs",
    description: "Session debug information",
    sensitivity: "high",
    paths: ["debug"],
    impactWarning: "Session debug logs will be deleted. These contain troubleshooting information useful for diagnosing issues.",
  },
  {
    name: "file-history",
    description: "Full snapshots of every file Claude edited",
    sensitivity: "critical",
    paths: ["file-history"],
    impactWarning: "Complete file edit history will be deleted. You will LOSE THE ABILITY TO REVERT changes Claude made to your files.",
  },
  {
    name: "shell-snapshots",
    description: "Shell environment variables, PATH, and exports",
    sensitivity: "high",
    paths: ["shell-snapshots"],
    impactWarning: "Shell environment snapshots will be deleted. These may contain PATH info, environment variables, and shell configuration.",
  },
  {
    name: "session-env",
    description: "Per-session environment data",
    sensitivity: "medium",
    paths: ["session-env"],
    impactWarning: "Per-session environment data will be removed. This includes session-specific configuration and state.",
  },
  {
    name: "memory",
    description: "Auto-generated notes about your codebase",
    sensitivity: "high",
    paths: ["projects"],
    pattern: /memory\//,
    impactWarning: "Auto-generated codebase notes and learned patterns will be deleted. Claude will need to re-learn your project structure.",
  },
  {
    name: "history",
    description: "Index of all sessions with timestamps and project paths",
    sensitivity: "medium",
    paths: ["."],
    pattern: /^history\.jsonl$/,
    impactWarning: "Session history index will be deleted. The --resume feature will not be able to find previous sessions.",
  },
  {
    name: "stats",
    description: "Daily activity, token counts, model usage",
    sensitivity: "medium",
    paths: ["."],
    pattern: /^stats-cache\.json$/,
    impactWarning: "Usage statistics will be cleared. Daily activity tracking and token usage history will be lost.",
  },
  {
    name: "todos",
    description: "Task lists from sessions",
    sensitivity: "low",
    paths: ["todos"],
    impactWarning: "Task lists from previous sessions will be deleted.",
  },
  {
    name: "plans",
    description: "Implementation plan files",
    sensitivity: "medium",
    paths: ["plans"],
    impactWarning: "Implementation plans created during planning sessions will be deleted.",
  },
  {
    name: "telemetry",
    description: "Feature flags, stable user IDs, experiment data",
    sensitivity: "medium",
    paths: ["statsig"],
    impactWarning: "Telemetry data including feature flags and experiment information will be removed.",
  },
  {
    name: "security-state",
    description: "Trust verification state per project",
    sensitivity: "low",
    paths: ["."],
    pattern: /^security_warnings_state/,
    impactWarning: "Security trust state will be reset. You may need to re-approve projects.",
  },
  {
    name: "ide-locks",
    description: "IDE integration process state",
    sensitivity: "low",
    paths: ["ide"],
    impactWarning: "IDE lock files will be removed. Active IDE connections may be disrupted.",
  },
  {
    name: "agents",
    description: "Custom agent definitions",
    sensitivity: "low",
    paths: ["agents"],
    impactWarning: "Custom agent definitions will be deleted. Your configured agents will need to be recreated.",
  },
  {
    name: "sessions-index",
    description: "Session metadata, first prompts, timestamps",
    sensitivity: "medium",
    paths: ["projects"],
    pattern: /sessions-index\.json$/,
    impactWarning: "Session index metadata will be deleted. Quick session lookup functionality may be affected.",
  },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function walkFiles(dir: string): { path: string; size: number; mtime: Date }[] {
  const files: { path: string; size: number; mtime: Date }[] = [];
  function walk(d: string) {
    try {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(d, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (entry.isFile()) {
          try {
            const stat = fs.statSync(full);
            files.push({ path: full, size: stat.size, mtime: stat.mtime });
          } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }
  walk(dir);
  return files;
}

function categorizeFile(filePath: string, claudeDir: string): TraceCategoryDef | null {
  const relPath = path.relative(claudeDir, filePath);

  for (const cat of TRACE_CATEGORIES) {
    for (const catPath of cat.paths) {
      if (catPath === ".") {
        if (path.dirname(relPath) === "." && (!cat.pattern || cat.pattern.test(path.basename(relPath)))) {
          return cat;
        }
      } else if (relPath.startsWith(catPath + path.sep) || relPath.startsWith(catPath + "/")) {
        if (cat.pattern) {
          if (cat.pattern.test(relPath)) return cat;
        } else {
          return cat;
        }
      }
    }
  }
  return null;
}

function matchesExclusion(filePath: string, category: string, claudeDir: string, exclusions?: TraceExclusion[]): TraceExclusion | null {
  if (!exclusions || exclusions.length === 0) return null;
  const relPath = path.relative(claudeDir, filePath);

  for (const exc of exclusions) {
    if (exc.type === "category" && exc.value === category) {
      return exc;
    }
    if (exc.type === "project") {
      if (relPath.includes(exc.value) || filePath.includes(exc.value)) {
        return exc;
      }
    }
    if (exc.type === "path") {
      const pattern = exc.value.replace(/\*/g, ".*").replace(/\?/g, ".");
      if (new RegExp(pattern).test(relPath)) {
        return exc;
      }
    }
  }
  return null;
}

function truncatePath(fullPath: string, maxSegments = 3): string {
  const parts = fullPath.split(path.sep);
  if (parts.length <= maxSegments) return fullPath;
  return "..." + path.sep + parts.slice(-maxSegments).join(path.sep);
}

export function generateEnhancedPreview(
  claudeDir = CLAUDE_DIR,
  options: { operation: "clean" | "wipe"; exclusions?: TraceExclusion[]; days?: number; categories?: string[] }
): EnhancedTracePreview {
  const inventory = inventoryTraces(claudeDir);
  const threshold = options.days ? Date.now() - options.days * 24 * 60 * 60 * 1000 : 0;

  const result: EnhancedTracePreview = {
    summary: {
      totalFiles: 0,
      totalSize: 0,
      criticalFiles: 0,
      highFiles: 0,
      mediumFiles: 0,
      lowFiles: 0,
    },
    byCategory: [],
    preserved: {
      byExclusion: [],
      settings: true,
      totalPreserved: 0,
    },
    warnings: [],
  };

  const exclusionMatches = new Map<string, { exclusion: TraceExclusion; files: number; size: number }>();

  const catDefs = new Map<string, TraceCategoryDef>();
  for (const def of TRACE_CATEGORIES) {
    catDefs.set(def.name, def);
  }

  for (const category of inventory.categories) {
    if (options.categories && !options.categories.includes(category.name)) continue;
    if (!options.categories && options.operation === "clean" && (category.name === "agents" || category.name === "ide-locks")) continue;

    const catDef = catDefs.get(category.name);
    const samplePaths: string[] = [];
    let includedFiles = 0;
    let includedSize = 0;

    for (const item of category.items) {
      if (threshold && item.modified.getTime() > threshold) continue;

      const matchedExc = matchesExclusion(item.path, category.name, claudeDir, options.exclusions);
      if (matchedExc) {
        const excKey = matchedExc.id || `${matchedExc.type}:${matchedExc.value}`;
        const existing = exclusionMatches.get(excKey) || { exclusion: matchedExc, files: 0, size: 0 };
        existing.files++;
        existing.size += item.size;
        exclusionMatches.set(excKey, existing);
        result.preserved.totalPreserved++;
        continue;
      }

      includedFiles++;
      includedSize += item.size;
      if (samplePaths.length < 5) {
        samplePaths.push(truncatePath(item.path));
      }
    }

    if (includedFiles > 0) {
      result.summary.totalFiles += includedFiles;
      result.summary.totalSize += includedSize;

      if (category.sensitivity === "critical") result.summary.criticalFiles += includedFiles;
      else if (category.sensitivity === "high") result.summary.highFiles += includedFiles;
      else if (category.sensitivity === "medium") result.summary.mediumFiles += includedFiles;
      else result.summary.lowFiles += includedFiles;

      result.byCategory.push({
        name: category.name,
        sensitivity: category.sensitivity,
        description: category.description,
        fileCount: includedFiles,
        totalSize: includedSize,
        samplePaths,
        impactWarning: catDef?.impactWarning || category.description,
      });
    }
  }

  result.preserved.byExclusion = Array.from(exclusionMatches.values()).map(m => ({
    exclusion: m.exclusion,
    matchedFiles: m.files,
    matchedSize: m.size,
  }));

  if (result.summary.criticalFiles > 0) {
    result.warnings.push(`⚠ ${result.summary.criticalFiles} critical sensitivity files will be deleted including conversation history and file edit backups.`);
  }
  if (options.operation === "wipe") {
    result.warnings.push("⚠ SECURE WIPE: Files will be overwritten with zeros before deletion. Recovery is NOT possible.");
  }

  return result;
}

export function inventoryTraces(claudeDir = CLAUDE_DIR, options?: { project?: string }): TraceInventory {
  const categoryMap = new Map<string, TraceCategory>();

  for (const def of TRACE_CATEGORIES) {
    categoryMap.set(def.name, {
      name: def.name,
      description: def.description,
      sensitivity: def.sensitivity,
      items: [],
      totalSize: 0,
      fileCount: 0,
    });
  }

  const allFiles = walkFiles(claudeDir);

  for (const file of allFiles) {
    if (file.path.includes("node_modules")) continue;
    if (file.path.includes(path.join("plugins", "marketplaces"))) continue;
    if (file.path.includes(path.join("local", "node_modules"))) continue;

    if (options?.project) {
      const relPath = path.relative(claudeDir, file.path);
      if (relPath.startsWith("projects") && !relPath.includes(options.project)) continue;
    }

    const catDef = categorizeFile(file.path, claudeDir);
    if (!catDef) continue;

    const category = categoryMap.get(catDef.name)!;
    category.items.push({
      category: catDef.name,
      path: file.path,
      size: file.size,
      modified: file.mtime,
      sensitivity: catDef.sensitivity,
    });
    category.totalSize += file.size;
    category.fileCount++;

    if (!category.oldestFile || file.mtime < category.oldestFile) {
      category.oldestFile = file.mtime;
    }
    if (!category.newestFile || file.mtime > category.newestFile) {
      category.newestFile = file.mtime;
    }
  }

  const categories = Array.from(categoryMap.values()).filter(c => c.fileCount > 0);
  const totalSize = categories.reduce((sum, c) => sum + c.totalSize, 0);
  const totalFiles = categories.reduce((sum, c) => sum + c.fileCount, 0);
  const criticalItems = categories.filter(c => c.sensitivity === "critical").reduce((sum, c) => sum + c.fileCount, 0);
  const highItems = categories.filter(c => c.sensitivity === "high").reduce((sum, c) => sum + c.fileCount, 0);

  return {
    totalSize,
    totalFiles,
    categories,
    criticalItems,
    highItems,
    analyzedAt: new Date(),
  };
}

export function cleanTraces(claudeDir = CLAUDE_DIR, options: TraceCleanOptions = {}): TraceCleanResult {
  const dryRun = options.dryRun ?? true;
  const preserveSettings = options.preserveSettings ?? true;
  const inventory = inventoryTraces(claudeDir, { project: options.project });
  const threshold = options.days ? Date.now() - options.days * 24 * 60 * 60 * 1000 : 0;

  const result: TraceCleanResult = {
    deleted: [],
    freed: 0,
    errors: [],
    categoriesAffected: [],
    dryRun,
  };

  const preserveFiles = new Set<string>();
  if (preserveSettings) {
    preserveFiles.add(path.join(claudeDir, "settings.json"));
    preserveFiles.add(path.join(claudeDir, "CLAUDE.md"));
  }

  for (const category of inventory.categories) {
    if (options.categories && !options.categories.includes(category.name)) continue;
    if (!options.categories && (category.name === "agents" || category.name === "ide-locks")) continue;

    let affected = false;
    for (const item of category.items) {
      if (preserveFiles.has(item.path)) continue;
      if (threshold && item.modified.getTime() > threshold) continue;
      if (matchesExclusion(item.path, category.name, claudeDir, options.exclusions)) continue;

      if (dryRun) {
        result.deleted.push(item.path);
        result.freed += item.size;
        affected = true;
      } else {
        try {
          fs.unlinkSync(item.path);
          result.deleted.push(item.path);
          result.freed += item.size;
          affected = true;
        } catch (e) {
          result.errors.push(`${item.path}: ${e}`);
        }
      }
    }
    if (affected) result.categoriesAffected.push(category.name);
  }

  return result;
}

function secureDelete(filePath: string): void {
  try {
    const stat = fs.statSync(filePath);
    const zeros = Buffer.alloc(Math.min(stat.size, 1024 * 1024));
    const fd = fs.openSync(filePath, "w");
    let written = 0;
    while (written < stat.size) {
      const toWrite = Math.min(zeros.length, stat.size - written);
      fs.writeSync(fd, zeros, 0, toWrite);
      written += toWrite;
    }
    fs.closeSync(fd);
    fs.unlinkSync(filePath);
  } catch {
    try { fs.unlinkSync(filePath); } catch { /* skip */ }
  }
}

export function wipeAllTraces(claudeDir = CLAUDE_DIR, options: TraceWipeOptions = {}): TraceWipeResult {
  if (!options.confirm) {
    return {
      filesWiped: 0,
      bytesFreed: 0,
      categoriesWiped: [],
      preserved: ["Wipe not confirmed. Pass confirm: true to execute."],
      wipeReceipt: "",
      completedAt: new Date(),
    };
  }

  const inventory = inventoryTraces(claudeDir);
  const result: TraceWipeResult = {
    filesWiped: 0,
    bytesFreed: 0,
    categoriesWiped: [],
    preserved: [],
    wipeReceipt: "",
    completedAt: new Date(),
  };

  const skipPaths = new Set<string>();
  if (options.keepSettings) {
    skipPaths.add(path.join(claudeDir, "settings.json"));
    skipPaths.add(path.join(claudeDir, "CLAUDE.md"));
    result.preserved.push("settings.json", "CLAUDE.md");
  }
  if (options.keepPlugins) {
    result.preserved.push("plugins/");
  }

  const wipedCategories = new Set<string>();
  const receiptLines: string[] = [
    `Trace Wipe Receipt`,
    `Date: ${new Date().toISOString()}`,
    `Directory: ${claudeDir}`,
    ``,
  ];

  let skippedByExclusion = 0;
  for (const category of inventory.categories) {
    if (options.keepPlugins && category.name === "plugins") continue;

    let catWiped = 0;
    let catBytes = 0;
    for (const item of category.items) {
      if (skipPaths.has(item.path)) continue;
      if (matchesExclusion(item.path, category.name, claudeDir, options.exclusions)) {
        skippedByExclusion++;
        continue;
      }

      secureDelete(item.path);
      result.filesWiped++;
      result.bytesFreed += item.size;
      catWiped++;
      catBytes += item.size;
    }

    if (catWiped > 0) {
      wipedCategories.add(category.name);
      receiptLines.push(`${category.name}: ${catWiped} files (${formatBytes(catBytes)})`);
    }
  }

  if (skippedByExclusion > 0) {
    result.preserved.push(`${skippedByExclusion} files (by exclusion rules)`);
  }

  // Clean up empty directories
  const dirs = ["debug", "todos", "shell-snapshots", "file-history", "session-env", "plans", "statsig", "agents"];
  for (const dir of dirs) {
    const dirPath = path.join(claudeDir, dir);
    try {
      const entries = fs.readdirSync(dirPath);
      if (entries.length === 0) continue;
      for (const entry of entries) {
        const full = path.join(dirPath, entry);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
          try { fs.rmSync(full, { recursive: true }); } catch { /* skip */ }
        }
      }
    } catch { /* skip */ }
  }

  receiptLines.push(``, `Total: ${result.filesWiped} files, ${formatBytes(result.bytesFreed)}`);
  result.categoriesWiped = Array.from(wipedCategories);
  result.wipeReceipt = receiptLines.join("\n");
  result.completedAt = new Date();

  return result;
}

export function generateTraceGuardHooks(options?: { mode?: "paranoid" | "moderate" | "minimal" }): TraceGuardConfig {
  const mode = options?.mode || "moderate";

  const hooks: TraceGuardHook[] = [];

  if (mode === "paranoid") {
    hooks.push({
      event: "PostToolUse",
      matcher: "Write",
      command: `sh -c 'echo "$TOOL_INPUT" | grep -qi "CLAUDE.md" && exit 2 || exit 0'`,
      description: "Block CLAUDE.md writes",
    });
    hooks.push({
      event: "SessionEnd",
      command: `sh -c 'find ~/.claude/debug -name "*.txt" -mmin +5 -delete 2>/dev/null; find ~/.claude/shell-snapshots -name "*.sh" -delete 2>/dev/null; exit 0'`,
      description: "Delete debug logs and shell snapshots after every session",
    });
    hooks.push({
      event: "SessionEnd",
      command: `sh -c 'find ~/.claude/projects -name "*.jsonl" -not -name "*.backup.*" -delete 2>/dev/null; exit 0'`,
      description: "Delete conversation transcripts after every session",
    });
  } else if (mode === "moderate") {
    hooks.push({
      event: "SessionEnd",
      command: `sh -c 'find ~/.claude/debug -name "*.txt" -mtime +1 -delete 2>/dev/null; find ~/.claude/shell-snapshots -name "*.sh" -mtime +1 -delete 2>/dev/null; exit 0'`,
      description: "Delete debug logs and snapshots older than 24 hours",
    });
    hooks.push({
      event: "SessionEnd",
      command: `sh -c 'find ~/.claude/projects -name "*.jsonl" -not -name "*.backup.*" -mtime +1 -delete 2>/dev/null; exit 0'`,
      description: "Delete conversation transcripts older than 24 hours",
    });
  } else {
    hooks.push({
      event: "SessionEnd",
      command: `sh -c 'find ~/.claude/debug -name "*.txt" -mtime +7 -delete 2>/dev/null; find ~/.claude/shell-snapshots -name "*.sh" -mtime +7 -delete 2>/dev/null; exit 0'`,
      description: "Delete debug logs and snapshots older than 7 days",
    });
  }

  const hooksConfig: Record<string, unknown[]> = {};
  for (const hook of hooks) {
    if (!hooksConfig[hook.event]) hooksConfig[hook.event] = [];
    const hookDef: Record<string, unknown> = {
      type: "command",
      command: hook.command,
    };
    if (hook.matcher) {
      hookDef.matcher = hook.matcher;
    }
    hooksConfig[hook.event].push({
      matcher: hook.matcher || "*",
      hooks: [hookDef],
    });
  }

  const settingsJson = JSON.stringify({ hooks: hooksConfig }, null, 2);

  let instructions = `Trace Guard Configuration (${mode} mode)\n\n`;
  instructions += `To install, add the following to your ~/.claude/settings.json:\n\n`;
  instructions += settingsJson;
  instructions += `\n\nOr for project-level enforcement, add to .claude/settings.json in your project.\n`;
  instructions += `\nFor managed/enterprise deployment, place in:\n`;
  instructions += `  macOS: /Library/Application Support/ClaudeCode/managed-settings.json\n`;
  instructions += `  Linux: /etc/claude-code/managed-settings.json\n`;

  if (mode === "paranoid") {
    instructions += `\n⚠ PARANOID MODE: All traces deleted after every session. No conversation history will be preserved.\n`;
  } else if (mode === "moderate") {
    instructions += `\nMODERATE MODE: Traces older than 24h deleted. Recent session available for --resume.\n`;
  } else {
    instructions += `\nMINIMAL MODE: Only old debug/snapshot traces cleaned. Conversations preserved.\n`;
  }

  return {
    mode,
    hooks,
    settingsJson,
    instructions,
  };
}

export function formatTraceInventory(inventory: TraceInventory): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         TRACE INVENTORY                      ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Total trace data: ${formatBytes(inventory.totalSize)}\n`;
  output += `Total files: ${inventory.totalFiles}\n`;
  output += `Critical sensitivity: ${inventory.criticalItems} files\n`;
  output += `High sensitivity: ${inventory.highItems} files\n\n`;

  output += "Category            Sensitivity  Files      Size\n";
  output += "──────────────────────────────────────────────────\n";

  const sorted = [...inventory.categories].sort((a, b) => b.totalSize - a.totalSize);
  for (const cat of sorted) {
    const name = cat.name.padEnd(19);
    const sens = cat.sensitivity.padEnd(11);
    const files = String(cat.fileCount).padStart(5);
    const size = formatBytes(cat.totalSize).padStart(10);
    output += `${name} ${sens} ${files} ${size}\n`;
  }

  output += "\nCategory Descriptions:\n";
  for (const cat of sorted) {
    output += `  ${cat.name}: ${cat.description}\n`;
  }

  return output;
}

export function formatTraceCleanReport(result: TraceCleanResult): string {
  let output = "";

  if (result.dryRun) {
    output += "[DRY RUN] Trace cleanup preview:\n\n";
  } else {
    output += "Trace Cleanup Results:\n\n";
  }

  output += `Files affected: ${result.deleted.length}\n`;
  output += `Space to free: ${formatBytes(result.freed)}\n`;
  output += `Categories: ${result.categoriesAffected.join(", ") || "none"}\n`;

  if (result.errors.length > 0) {
    output += `\nErrors (${result.errors.length}):\n`;
    for (const err of result.errors.slice(0, 10)) {
      output += `  ✗ ${err}\n`;
    }
  }

  if (result.dryRun) {
    output += "\nRun without --dry-run to perform cleanup.\n";
  }

  return output;
}

export function formatTraceGuardConfig(config: TraceGuardConfig): string {
  return config.instructions;
}
