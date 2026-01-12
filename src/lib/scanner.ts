import * as fs from "fs";
import * as path from "path";

export const MIN_PROBLEMATIC_BASE64_SIZE = 100000;

export interface ImageIssue {
  line: number;
  indices: (number | [number, number])[];
  type: "message_content" | "toolUseResult";
  estimatedSize: number;
}

export interface ScanResult {
  file: string;
  issues: ImageIssue[];
  totalLines: number;
  scannedAt: Date;
}

export interface FixResult extends ScanResult {
  fixed: boolean;
  backupPath?: string;
  error?: string;
}

export interface ConversationStats {
  file: string;
  totalMessages: number;
  userMessages: number;
  assistantMessages: number;
  toolUses: number;
  imageCount: number;
  problematicImages: number;
  fileSizeBytes: number;
  lastModified: Date;
}

export function findAllJsonlFiles(dir: string): string[] {
  const files: string[] = [];

  function walkDir(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.endsWith(".jsonl") &&
          !entry.name.includes(".backup.")
        ) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walkDir(dir);
  return files;
}

export function findBackupFiles(dir: string): string[] {
  const backups: string[] = [];

  function walkDir(currentDir: string) {
    try {
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walkDir(fullPath);
        } else if (entry.isFile() && entry.name.includes(".backup.")) {
          backups.push(fullPath);
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  walkDir(dir);
  return backups;
}

export function checkContentForImages(
  content: unknown
): { hasProblems: boolean; indices: (number | [number, number])[]; totalSize: number } {
  if (!Array.isArray(content)) {
    return { hasProblems: false, indices: [], totalSize: 0 };
  }

  const problematicIndices: (number | [number, number])[] = [];
  let totalSize = 0;

  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    if (typeof item !== "object" || item === null) continue;

    const itemObj = item as Record<string, unknown>;

    if (itemObj.type === "image") {
      const source = itemObj.source as Record<string, unknown> | undefined;
      if (source?.type === "base64") {
        const base64Data = source.data as string | undefined;
        if (base64Data) {
          const size = base64Data.length;
          totalSize += size;
          if (size > MIN_PROBLEMATIC_BASE64_SIZE) {
            problematicIndices.push(i);
          }
        }
      }
    } else if (itemObj.type === "tool_result") {
      const innerContent = itemObj.content;
      if (Array.isArray(innerContent)) {
        for (let j = 0; j < innerContent.length; j++) {
          const innerItem = innerContent[j];
          if (typeof innerItem === "object" && innerItem !== null) {
            const innerObj = innerItem as Record<string, unknown>;
            if (innerObj.type === "image") {
              const source = innerObj.source as Record<string, unknown> | undefined;
              if (source?.type === "base64") {
                const base64Data = source.data as string | undefined;
                if (base64Data) {
                  const size = base64Data.length;
                  totalSize += size;
                  if (size > MIN_PROBLEMATIC_BASE64_SIZE) {
                    problematicIndices.push([i, j]);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return { hasProblems: problematicIndices.length > 0, indices: problematicIndices, totalSize };
}

export function fixImageInContent(
  content: unknown[],
  indices: (number | [number, number])[]
): unknown[] {
  const result = JSON.parse(JSON.stringify(content));

  for (const idx of indices) {
    if (Array.isArray(idx)) {
      const [i, j] = idx;
      const item = result[i] as Record<string, unknown>;
      if (Array.isArray(item.content)) {
        item.content[j] = {
          type: "text",
          text: "[Image removed - exceeded size limit]",
        };
      }
    } else {
      result[idx] = {
        type: "text",
        text: "[Image removed - exceeded size limit]",
      };
    }
  }

  return result;
}

export function scanFile(filePath: string): ScanResult {
  const issues: ImageIssue[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    throw new Error(`Cannot read file: ${e}`);
  }

  const lines = content.split("\n");

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum];
    if (!line.trim()) continue;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }

    const message = data.message as Record<string, unknown> | undefined;
    const messageContent = message?.content;

    if (messageContent) {
      const { hasProblems, indices, totalSize } = checkContentForImages(messageContent);
      if (hasProblems) {
        issues.push({
          line: lineNum + 1,
          indices,
          type: "message_content",
          estimatedSize: totalSize,
        });
      }
    }

    if (data.toolUseResult) {
      const toolResult = data.toolUseResult as Record<string, unknown>;
      const resultContent = toolResult.content;
      const { hasProblems, indices, totalSize } = checkContentForImages(resultContent);
      if (hasProblems) {
        const existingIssue = issues.find((i) => i.line === lineNum + 1);
        if (!existingIssue) {
          issues.push({
            line: lineNum + 1,
            indices,
            type: "toolUseResult",
            estimatedSize: totalSize,
          });
        }
      }
    }
  }

  return {
    file: filePath,
    issues,
    totalLines: lines.length,
    scannedAt: new Date(),
  };
}

export function fixFile(filePath: string, createBackup = true): FixResult {
  const scanResult = scanFile(filePath);

  if (scanResult.issues.length === 0) {
    return { ...scanResult, fixed: false };
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (e) {
    return { ...scanResult, fixed: false, error: `Cannot read file: ${e}` };
  }

  const lines = content.split("\n");
  let backupPath: string | undefined;

  if (createBackup) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    backupPath = `${filePath}.backup.${timestamp}`;
    try {
      fs.writeFileSync(backupPath, content, "utf-8");
    } catch (e) {
      return { ...scanResult, fixed: false, error: `Cannot create backup: ${e}` };
    }
  }

  for (const issue of scanResult.issues) {
    const lineIdx = issue.line - 1;
    const line = lines[lineIdx];
    if (!line) continue;

    try {
      const data = JSON.parse(line) as Record<string, unknown>;

      if (issue.type === "message_content") {
        const message = data.message as Record<string, unknown>;
        if (message?.content) {
          message.content = fixImageInContent(message.content as unknown[], issue.indices);
        }
      }

      if (issue.type === "toolUseResult" || data.toolUseResult) {
        const toolResult = data.toolUseResult as Record<string, unknown>;
        if (toolResult?.content) {
          const { indices } = checkContentForImages(toolResult.content);
          if (indices.length > 0) {
            toolResult.content = fixImageInContent(toolResult.content as unknown[], indices);
          }
        }
      }

      lines[lineIdx] = JSON.stringify(data);
    } catch {
      continue;
    }
  }

  try {
    fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  } catch (e) {
    return { ...scanResult, fixed: false, error: `Cannot write file: ${e}`, backupPath };
  }

  return { ...scanResult, fixed: true, backupPath };
}

export function getConversationStats(filePath: string): ConversationStats {
  const stats: ConversationStats = {
    file: filePath,
    totalMessages: 0,
    userMessages: 0,
    assistantMessages: 0,
    toolUses: 0,
    imageCount: 0,
    problematicImages: 0,
    fileSizeBytes: 0,
    lastModified: new Date(),
  };

  try {
    const fileStat = fs.statSync(filePath);
    stats.fileSizeBytes = fileStat.size;
    stats.lastModified = fileStat.mtime;
  } catch {
    return stats;
  }

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return stats;
  }

  const lines = content.split("\n");

  for (const line of lines) {
    if (!line.trim()) continue;

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }

    stats.totalMessages++;

    const message = data.message as Record<string, unknown> | undefined;
    if (message) {
      const role = message.role as string;
      if (role === "user") stats.userMessages++;
      if (role === "assistant") stats.assistantMessages++;

      const messageContent = message.content;
      if (Array.isArray(messageContent)) {
        for (const item of messageContent) {
          if (typeof item === "object" && item !== null) {
            const itemObj = item as Record<string, unknown>;
            if (itemObj.type === "tool_use") stats.toolUses++;
            if (itemObj.type === "image") {
              stats.imageCount++;
              const source = itemObj.source as Record<string, unknown> | undefined;
              if (source?.type === "base64") {
                const data = source.data as string | undefined;
                if (data && data.length > MIN_PROBLEMATIC_BASE64_SIZE) {
                  stats.problematicImages++;
                }
              }
            }
          }
        }
      }
    }

    if (data.toolUseResult) {
      const toolResult = data.toolUseResult as Record<string, unknown>;
      const resultContent = toolResult.content;
      if (Array.isArray(resultContent)) {
        for (const item of resultContent) {
          if (typeof item === "object" && item !== null) {
            const itemObj = item as Record<string, unknown>;
            if (itemObj.type === "image") {
              stats.imageCount++;
              const source = itemObj.source as Record<string, unknown> | undefined;
              if (source?.type === "base64") {
                const data = source.data as string | undefined;
                if (data && data.length > MIN_PROBLEMATIC_BASE64_SIZE) {
                  stats.problematicImages++;
                }
              }
            }
          }
        }
      }
    }
  }

  return stats;
}

export function restoreFromBackup(backupPath: string): { success: boolean; originalPath: string; error?: string } {
  if (!fs.existsSync(backupPath)) {
    return { success: false, originalPath: "", error: "Backup file not found" };
  }

  const match = backupPath.match(/^(.+)\.backup\.\d{4}-\d{2}-\d{2}T/);
  if (!match) {
    return { success: false, originalPath: "", error: "Invalid backup file name format" };
  }

  const originalPath = match[1];

  try {
    fs.copyFileSync(backupPath, originalPath);
    return { success: true, originalPath };
  } catch (e) {
    return { success: false, originalPath, error: `Failed to restore: ${e}` };
  }
}

export function deleteOldBackups(dir: string, olderThanDays: number): { deleted: string[]; errors: string[] } {
  const backups = findBackupFiles(dir);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const deleted: string[] = [];
  const errors: string[] = [];

  for (const backup of backups) {
    try {
      const stat = fs.statSync(backup);
      if (stat.mtime < cutoffDate) {
        fs.unlinkSync(backup);
        deleted.push(backup);
      }
    } catch (e) {
      errors.push(`${backup}: ${e}`);
    }
  }

  return { deleted, errors };
}
