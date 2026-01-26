import * as fs from "fs";
import * as path from "path";

export const MIN_PROBLEMATIC_BASE64_SIZE = 100000; // ~100KB base64 ≈ 75KB file
export const MIN_PROBLEMATIC_TEXT_SIZE = 500000;   // ~500KB for large text content

export type IssueType = "image" | "document" | "pdf" | "large_text" | "unknown";

export interface ContentIssue {
  line: number;
  indices: (number | [number, number])[];
  location: "message_content" | "toolUseResult";
  contentType: IssueType;
  estimatedSize: number;
}

export interface ScanResult {
  file: string;
  issues: ContentIssue[];
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
  documentCount: number;
  problematicContent: number;
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

function detectContentType(item: Record<string, unknown>): IssueType {
  const type = item.type as string | undefined;

  if (type === "image") return "image";
  if (type === "document") {
    const source = item.source as Record<string, unknown> | undefined;
    const mediaType = source?.media_type as string | undefined;
    if (mediaType?.includes("pdf")) return "pdf";
    return "document";
  }
  if (type === "text") {
    const text = item.text as string | undefined;
    if (text && text.length > MIN_PROBLEMATIC_TEXT_SIZE) return "large_text";
  }

  return "unknown";
}

function getContentSize(item: Record<string, unknown>): number {
  const type = item.type as string | undefined;

  if (type === "image" || type === "document") {
    const source = item.source as Record<string, unknown> | undefined;
    if (source?.type === "base64") {
      const data = source.data as string | undefined;
      return data?.length || 0;
    }
  }

  if (type === "text") {
    const text = item.text as string | undefined;
    return text?.length || 0;
  }

  return 0;
}

function isProblematicContent(item: Record<string, unknown>): boolean {
  const type = item.type as string | undefined;

  // Check images
  if (type === "image") {
    const source = item.source as Record<string, unknown> | undefined;
    if (source?.type === "base64") {
      const data = source.data as string | undefined;
      return (data?.length || 0) > MIN_PROBLEMATIC_BASE64_SIZE;
    }
  }

  // Check documents (PDFs, etc.)
  if (type === "document") {
    const source = item.source as Record<string, unknown> | undefined;
    if (source?.type === "base64") {
      const data = source.data as string | undefined;
      return (data?.length || 0) > MIN_PROBLEMATIC_BASE64_SIZE;
    }
  }

  // Check large text content
  if (type === "text") {
    const text = item.text as string | undefined;
    return (text?.length || 0) > MIN_PROBLEMATIC_TEXT_SIZE;
  }

  return false;
}

export function checkContentForIssues(
  content: unknown
): { hasProblems: boolean; indices: (number | [number, number])[]; totalSize: number; contentType: IssueType } {
  if (!Array.isArray(content)) {
    return { hasProblems: false, indices: [], totalSize: 0, contentType: "unknown" };
  }

  const problematicIndices: (number | [number, number])[] = [];
  let totalSize = 0;
  let detectedType: IssueType = "unknown";

  for (let i = 0; i < content.length; i++) {
    const item = content[i];
    if (typeof item !== "object" || item === null) continue;

    const itemObj = item as Record<string, unknown>;
    const size = getContentSize(itemObj);
    totalSize += size;

    if (isProblematicContent(itemObj)) {
      problematicIndices.push(i);
      detectedType = detectContentType(itemObj);
    }

    // Check nested content in tool_result
    if (itemObj.type === "tool_result") {
      const innerContent = itemObj.content;
      if (Array.isArray(innerContent)) {
        for (let j = 0; j < innerContent.length; j++) {
          const innerItem = innerContent[j];
          if (typeof innerItem === "object" && innerItem !== null) {
            const innerObj = innerItem as Record<string, unknown>;
            const innerSize = getContentSize(innerObj);
            totalSize += innerSize;

            if (isProblematicContent(innerObj)) {
              problematicIndices.push([i, j]);
              detectedType = detectContentType(innerObj);
            }
          }
        }
      }
    }
  }

  return {
    hasProblems: problematicIndices.length > 0,
    indices: problematicIndices,
    totalSize,
    contentType: detectedType
  };
}

// Keep old function name for backwards compatibility
export const checkContentForImages = checkContentForIssues;

function getReplacementText(contentType: IssueType): string {
  switch (contentType) {
    case "image":
      return "[Image removed - exceeded size limit]";
    case "pdf":
      return "[PDF removed - exceeded size limit]";
    case "document":
      return "[Document removed - exceeded size limit]";
    case "large_text":
      return "[Large text content removed - exceeded size limit]";
    default:
      return "[Content removed - exceeded size limit]";
  }
}

export function fixContentInMessage(
  content: unknown[],
  indices: (number | [number, number])[],
  contentType: IssueType = "unknown"
): unknown[] {
  const result = JSON.parse(JSON.stringify(content));
  const replacementText = getReplacementText(contentType);

  for (const idx of indices) {
    if (Array.isArray(idx)) {
      const [i, j] = idx;
      const item = result[i] as Record<string, unknown>;
      if (Array.isArray(item.content)) {
        item.content[j] = {
          type: "text",
          text: replacementText,
        };
      }
    } else {
      result[idx] = {
        type: "text",
        text: replacementText,
      };
    }
  }

  return result;
}

// Keep old function name for backwards compatibility
export const fixImageInContent = fixContentInMessage;

export function scanFile(filePath: string): ScanResult {
  const issues: ContentIssue[] = [];

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
      const { hasProblems, indices, totalSize, contentType } = checkContentForIssues(messageContent);
      if (hasProblems) {
        issues.push({
          line: lineNum + 1,
          indices,
          location: "message_content",
          contentType,
          estimatedSize: totalSize,
        });
      }
    }

    if (data.toolUseResult) {
      const toolResult = data.toolUseResult as Record<string, unknown>;
      const resultContent = toolResult.content;
      const { hasProblems, indices, totalSize, contentType } = checkContentForIssues(resultContent);
      if (hasProblems) {
        const existingIssue = issues.find((i) => i.line === lineNum + 1);
        if (!existingIssue) {
          issues.push({
            line: lineNum + 1,
            indices,
            location: "toolUseResult",
            contentType,
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

      if (issue.location === "message_content") {
        const message = data.message as Record<string, unknown>;
        if (message?.content) {
          message.content = fixContentInMessage(
            message.content as unknown[],
            issue.indices,
            issue.contentType
          );
        }
      }

      if (issue.location === "toolUseResult" || data.toolUseResult) {
        const toolResult = data.toolUseResult as Record<string, unknown>;
        if (toolResult?.content) {
          const { indices, contentType } = checkContentForIssues(toolResult.content);
          if (indices.length > 0) {
            toolResult.content = fixContentInMessage(
              toolResult.content as unknown[],
              indices,
              contentType
            );
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
    documentCount: 0,
    problematicContent: 0,
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
              if (isProblematicContent(itemObj)) {
                stats.problematicContent++;
              }
            }
            if (itemObj.type === "document") {
              stats.documentCount++;
              if (isProblematicContent(itemObj)) {
                stats.problematicContent++;
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
              if (isProblematicContent(itemObj)) {
                stats.problematicContent++;
              }
            }
            if (itemObj.type === "document") {
              stats.documentCount++;
              if (isProblematicContent(itemObj)) {
                stats.problematicContent++;
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
