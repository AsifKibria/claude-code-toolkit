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

export type ExportFormat = "markdown" | "json";

export interface ExportOptions {
  format: ExportFormat;
  includeToolResults?: boolean;
  includeTimestamps?: boolean;
  stripImages?: boolean;
}

export interface ExportedMessage {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: string;
  toolUse?: { name: string; input: unknown }[];
  toolResults?: { name: string; result: string }[];
}

export interface ExportResult {
  file: string;
  format: ExportFormat;
  messageCount: number;
  content: string;
  exportedAt: Date;
}

function extractTextFromContent(content: unknown[]): string {
  const parts: string[] = [];

  for (const item of content) {
    if (typeof item !== "object" || item === null) continue;
    const itemObj = item as Record<string, unknown>;

    if (itemObj.type === "text") {
      parts.push(itemObj.text as string);
    } else if (itemObj.type === "image") {
      parts.push("[Image]");
    } else if (itemObj.type === "document") {
      const source = itemObj.source as Record<string, unknown> | undefined;
      const mediaType = source?.media_type as string | undefined;
      if (mediaType?.includes("pdf")) {
        parts.push("[PDF Document]");
      } else {
        parts.push("[Document]");
      }
    } else if (itemObj.type === "tool_use") {
      const name = itemObj.name as string;
      parts.push(`[Tool: ${name}]`);
    } else if (itemObj.type === "tool_result") {
      const innerContent = itemObj.content;
      if (Array.isArray(innerContent)) {
        parts.push(extractTextFromContent(innerContent));
      } else if (typeof innerContent === "string") {
        parts.push(innerContent);
      }
    }
  }

  return parts.join("\n");
}

function parseConversation(filePath: string): ExportedMessage[] {
  const messages: ExportedMessage[] = [];

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return messages;
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

    const message = data.message as Record<string, unknown> | undefined;
    if (!message) continue;

    const role = message.role as "user" | "assistant" | "system";
    const messageContent = message.content;

    let textContent = "";
    const toolUses: { name: string; input: unknown }[] = [];

    if (typeof messageContent === "string") {
      textContent = messageContent;
    } else if (Array.isArray(messageContent)) {
      const textParts: string[] = [];

      for (const item of messageContent) {
        if (typeof item !== "object" || item === null) continue;
        const itemObj = item as Record<string, unknown>;

        if (itemObj.type === "text") {
          textParts.push(itemObj.text as string);
        } else if (itemObj.type === "image") {
          textParts.push("[Image]");
        } else if (itemObj.type === "document") {
          const source = itemObj.source as Record<string, unknown> | undefined;
          const mediaType = source?.media_type as string | undefined;
          if (mediaType?.includes("pdf")) {
            textParts.push("[PDF Document]");
          } else {
            textParts.push("[Document]");
          }
        } else if (itemObj.type === "tool_use") {
          toolUses.push({
            name: itemObj.name as string,
            input: itemObj.input,
          });
        }
      }

      textContent = textParts.join("\n");
    }

    const exportedMessage: ExportedMessage = {
      role,
      content: textContent,
    };

    if (toolUses.length > 0) {
      exportedMessage.toolUse = toolUses;
    }

    if (data.toolUseResult) {
      const toolResult = data.toolUseResult as Record<string, unknown>;
      const resultContent = toolResult.content;
      let resultText = "";

      if (typeof resultContent === "string") {
        resultText = resultContent;
      } else if (Array.isArray(resultContent)) {
        resultText = extractTextFromContent(resultContent);
      }

      exportedMessage.toolResults = [{
        name: toolResult.name as string || "unknown",
        result: resultText.slice(0, 500) + (resultText.length > 500 ? "..." : ""),
      }];
    }

    if (data.timestamp) {
      exportedMessage.timestamp = data.timestamp as string;
    }

    messages.push(exportedMessage);
  }

  return messages;
}

function formatAsMarkdown(messages: ExportedMessage[], options: ExportOptions): string {
  const lines: string[] = [];

  lines.push("# Conversation Export");
  lines.push("");
  lines.push(`Exported: ${new Date().toISOString()}`);
  lines.push(`Messages: ${messages.length}`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const msg of messages) {
    const roleLabel = msg.role === "user" ? "👤 User" : msg.role === "assistant" ? "🤖 Assistant" : "⚙️ System";

    lines.push(`## ${roleLabel}`);
    if (options.includeTimestamps && msg.timestamp) {
      lines.push(`*${msg.timestamp}*`);
    }
    lines.push("");

    if (msg.content) {
      lines.push(msg.content);
      lines.push("");
    }

    if (msg.toolUse && msg.toolUse.length > 0) {
      lines.push("**Tool calls:**");
      for (const tool of msg.toolUse) {
        lines.push(`- \`${tool.name}\``);
      }
      lines.push("");
    }

    if (options.includeToolResults && msg.toolResults && msg.toolResults.length > 0) {
      lines.push("**Tool results:**");
      for (const result of msg.toolResults) {
        lines.push(`<details>`);
        lines.push(`<summary>${result.name}</summary>`);
        lines.push("");
        lines.push("```");
        lines.push(result.result);
        lines.push("```");
        lines.push("</details>");
      }
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}

function formatAsJson(messages: ExportedMessage[], options: ExportOptions): string {
  const exportData = {
    exportedAt: new Date().toISOString(),
    messageCount: messages.length,
    options: {
      includeToolResults: options.includeToolResults,
      includeTimestamps: options.includeTimestamps,
    },
    messages: messages.map(msg => {
      const result: Record<string, unknown> = {
        role: msg.role,
        content: msg.content,
      };

      if (options.includeTimestamps && msg.timestamp) {
        result.timestamp = msg.timestamp;
      }

      if (msg.toolUse && msg.toolUse.length > 0) {
        result.toolUse = msg.toolUse;
      }

      if (options.includeToolResults && msg.toolResults && msg.toolResults.length > 0) {
        result.toolResults = msg.toolResults;
      }

      return result;
    }),
  };

  return JSON.stringify(exportData, null, 2);
}

export function exportConversation(filePath: string, options: ExportOptions): ExportResult {
  const messages = parseConversation(filePath);

  let content: string;
  if (options.format === "markdown") {
    content = formatAsMarkdown(messages, options);
  } else {
    content = formatAsJson(messages, options);
  }

  return {
    file: filePath,
    format: options.format,
    messageCount: messages.length,
    content,
    exportedAt: new Date(),
  };
}

export function exportConversationToFile(
  sourcePath: string,
  outputPath: string,
  options: ExportOptions
): { success: boolean; outputPath: string; messageCount: number; error?: string } {
  try {
    const result = exportConversation(sourcePath, options);
    fs.writeFileSync(outputPath, result.content, "utf-8");
    return {
      success: true,
      outputPath,
      messageCount: result.messageCount,
    };
  } catch (e) {
    return {
      success: false,
      outputPath,
      messageCount: 0,
      error: `Export failed: ${e}`,
    };
  }
}

// Context size estimation constants
const CHARS_PER_TOKEN = 4; // Approximate for English text
const IMAGE_BASE_TOKENS = 85; // Minimum tokens for any image
const IMAGE_TOKENS_PER_MEGAPIXEL = 1334; // Approximate scaling
const TOOL_OVERHEAD_TOKENS = 50; // Overhead per tool call/result

export interface ContextBreakdown {
  userTokens: number;
  assistantTokens: number;
  systemTokens: number;
  toolUseTokens: number;
  toolResultTokens: number;
  imageTokens: number;
  documentTokens: number;
}

export interface ContextEstimate {
  file: string;
  totalTokens: number;
  breakdown: ContextBreakdown;
  messageCount: number;
  largestMessage: { line: number; tokens: number; role: string } | null;
  warnings: string[];
  estimatedAt: Date;
}

function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateTokensFromBase64Image(base64Length: number): number {
  // Base64 size roughly correlates with pixel count
  // 1 byte of base64 ≈ 0.75 bytes of data
  // For JPEG, roughly 1 byte per pixel after compression
  const estimatedPixels = (base64Length * 0.75);
  const megapixels = estimatedPixels / 1_000_000;
  return Math.max(IMAGE_BASE_TOKENS, Math.ceil(IMAGE_TOKENS_PER_MEGAPIXEL * megapixels));
}

function estimateTokensFromContent(content: unknown): { text: number; image: number; document: number; toolUse: number } {
  const result = { text: 0, image: 0, document: 0, toolUse: 0 };

  if (typeof content === "string") {
    result.text = estimateTokensFromText(content);
    return result;
  }

  if (!Array.isArray(content)) return result;

  for (const item of content) {
    if (typeof item !== "object" || item === null) continue;
    const itemObj = item as Record<string, unknown>;

    if (itemObj.type === "text") {
      result.text += estimateTokensFromText(itemObj.text as string);
    } else if (itemObj.type === "image") {
      const source = itemObj.source as Record<string, unknown> | undefined;
      if (source?.type === "base64") {
        const data = source.data as string | undefined;
        result.image += estimateTokensFromBase64Image(data?.length || 0);
      } else {
        result.image += IMAGE_BASE_TOKENS;
      }
    } else if (itemObj.type === "document") {
      const source = itemObj.source as Record<string, unknown> | undefined;
      if (source?.type === "base64") {
        const data = source.data as string | undefined;
        // Documents are converted to text, estimate based on base64 size
        result.document += Math.ceil((data?.length || 0) * 0.75 / CHARS_PER_TOKEN);
      }
    } else if (itemObj.type === "tool_use") {
      result.toolUse += TOOL_OVERHEAD_TOKENS;
      const input = itemObj.input;
      if (input) {
        result.toolUse += estimateTokensFromText(JSON.stringify(input));
      }
    } else if (itemObj.type === "tool_result") {
      const innerContent = itemObj.content;
      if (Array.isArray(innerContent)) {
        const inner = estimateTokensFromContent(innerContent);
        result.text += inner.text;
        result.image += inner.image;
        result.document += inner.document;
      } else if (typeof innerContent === "string") {
        result.text += estimateTokensFromText(innerContent);
      }
    }
  }

  return result;
}

export function estimateContextSize(filePath: string): ContextEstimate {
  const breakdown: ContextBreakdown = {
    userTokens: 0,
    assistantTokens: 0,
    systemTokens: 0,
    toolUseTokens: 0,
    toolResultTokens: 0,
    imageTokens: 0,
    documentTokens: 0,
  };

  const warnings: string[] = [];
  let messageCount = 0;
  let largestMessage: { line: number; tokens: number; role: string } | null = null;

  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return {
      file: filePath,
      totalTokens: 0,
      breakdown,
      messageCount: 0,
      largestMessage: null,
      warnings: ["Could not read file"],
      estimatedAt: new Date(),
    };
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
    if (!message) continue;

    messageCount++;
    const role = message.role as string;
    const messageContent = message.content;

    const contentTokens = estimateTokensFromContent(messageContent);
    const messageTotal = contentTokens.text + contentTokens.image + contentTokens.document + contentTokens.toolUse;

    if (role === "user") {
      breakdown.userTokens += contentTokens.text;
    } else if (role === "assistant") {
      breakdown.assistantTokens += contentTokens.text;
    } else if (role === "system") {
      breakdown.systemTokens += contentTokens.text;
    }

    breakdown.toolUseTokens += contentTokens.toolUse;
    breakdown.imageTokens += contentTokens.image;
    breakdown.documentTokens += contentTokens.document;

    // Track largest message
    if (!largestMessage || messageTotal > largestMessage.tokens) {
      largestMessage = { line: lineNum + 1, tokens: messageTotal, role };
    }

    // Process tool results
    if (data.toolUseResult) {
      const toolResult = data.toolUseResult as Record<string, unknown>;
      const resultContent = toolResult.content;
      const resultTokens = estimateTokensFromContent(resultContent);

      breakdown.toolResultTokens += resultTokens.text + TOOL_OVERHEAD_TOKENS;
      breakdown.imageTokens += resultTokens.image;
      breakdown.documentTokens += resultTokens.document;

      if (resultTokens.text + resultTokens.image > 10000) {
        warnings.push(`Line ${lineNum + 1}: Large tool result (~${resultTokens.text + resultTokens.image} tokens)`);
      }
    }
  }

  const totalTokens = breakdown.userTokens + breakdown.assistantTokens + breakdown.systemTokens +
    breakdown.toolUseTokens + breakdown.toolResultTokens + breakdown.imageTokens + breakdown.documentTokens;

  // Add warnings for high context usage
  if (totalTokens > 150000) {
    warnings.push("Context exceeds 150K tokens - may hit limits on some models");
  } else if (totalTokens > 100000) {
    warnings.push("Context exceeds 100K tokens - consider archiving older messages");
  }

  if (breakdown.imageTokens > totalTokens * 0.5) {
    warnings.push("Images account for >50% of context - consider removing unused images");
  }

  return {
    file: filePath,
    totalTokens,
    breakdown,
    messageCount,
    largestMessage,
    warnings,
    estimatedAt: new Date(),
  };
}

export function formatContextEstimate(estimate: ContextEstimate): string {
  const lines: string[] = [];
  const b = estimate.breakdown;

  lines.push(`Context Size Estimate`);
  lines.push(`${"─".repeat(40)}`);
  lines.push(`Total: ~${estimate.totalTokens.toLocaleString()} tokens`);
  lines.push(`Messages: ${estimate.messageCount}`);
  lines.push("");
  lines.push("Breakdown:");
  lines.push(`  User messages:      ${b.userTokens.toLocaleString()} tokens`);
  lines.push(`  Assistant messages: ${b.assistantTokens.toLocaleString()} tokens`);
  if (b.systemTokens > 0) {
    lines.push(`  System messages:    ${b.systemTokens.toLocaleString()} tokens`);
  }
  lines.push(`  Tool calls:         ${b.toolUseTokens.toLocaleString()} tokens`);
  lines.push(`  Tool results:       ${b.toolResultTokens.toLocaleString()} tokens`);
  if (b.imageTokens > 0) {
    lines.push(`  Images:             ${b.imageTokens.toLocaleString()} tokens`);
  }
  if (b.documentTokens > 0) {
    lines.push(`  Documents:          ${b.documentTokens.toLocaleString()} tokens`);
  }

  if (estimate.largestMessage) {
    lines.push("");
    lines.push(`Largest message: Line ${estimate.largestMessage.line} (${estimate.largestMessage.role})`);
    lines.push(`  ~${estimate.largestMessage.tokens.toLocaleString()} tokens`);
  }

  if (estimate.warnings.length > 0) {
    lines.push("");
    lines.push("Warnings:");
    for (const warning of estimate.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
  }

  return lines.join("\n");
}

// Usage Analytics Dashboard

export interface DailyActivity {
  date: string;
  messages: number;
  tokens: number;
  conversations: number;
}

export interface ProjectActivity {
  project: string;
  conversations: number;
  messages: number;
  tokens: number;
  lastActive: Date;
}

export interface ToolUsageStats {
  name: string;
  count: number;
  percentage: number;
}

export interface UsageAnalytics {
  overview: {
    totalConversations: number;
    totalMessages: number;
    totalTokens: number;
    totalSize: number;
    activeProjects: number;
    avgMessagesPerConversation: number;
    avgTokensPerConversation: number;
  };
  dailyActivity: DailyActivity[];
  topProjects: ProjectActivity[];
  toolUsage: ToolUsageStats[];
  mediaStats: {
    totalImages: number;
    totalDocuments: number;
    problematicContent: number;
  };
  generatedAt: Date;
}

function getProjectFromPath(filePath: string): string {
  // Extract project name from path like ~/.claude/projects/-Users-me-myproject/conversation.jsonl
  const parts = filePath.split(path.sep);
  const projectsIdx = parts.indexOf("projects");
  if (projectsIdx >= 0 && projectsIdx + 1 < parts.length) {
    return parts[projectsIdx + 1];
  }
  return path.dirname(filePath);
}

function getDateFromTimestamp(timestamp: string | undefined): string | null {
  if (!timestamp) return null;
  try {
    const date = new Date(timestamp);
    return date.toISOString().split("T")[0];
  } catch {
    return null;
  }
}

export function generateUsageAnalytics(projectsDir: string, days = 30): UsageAnalytics {
  const files = findAllJsonlFiles(projectsDir);

  const dailyMap = new Map<string, DailyActivity>();
  const projectMap = new Map<string, ProjectActivity>();
  const toolMap = new Map<string, number>();

  let totalMessages = 0;
  let totalTokens = 0;
  let totalSize = 0;
  let totalImages = 0;
  let totalDocuments = 0;
  let problematicContent = 0;
  let totalToolUses = 0;

  for (const file of files) {
    const project = getProjectFromPath(file);
    const stats = getConversationStats(file);
    const contextEst = estimateContextSize(file);

    totalSize += stats.fileSizeBytes;
    totalMessages += stats.totalMessages;
    totalTokens += contextEst.totalTokens;
    totalImages += stats.imageCount;
    totalDocuments += stats.documentCount;
    problematicContent += stats.problematicContent;

    // Update project stats
    const existing = projectMap.get(project) || {
      project,
      conversations: 0,
      messages: 0,
      tokens: 0,
      lastActive: new Date(0),
    };
    existing.conversations++;
    existing.messages += stats.totalMessages;
    existing.tokens += contextEst.totalTokens;
    if (stats.lastModified > existing.lastActive) {
      existing.lastActive = stats.lastModified;
    }
    projectMap.set(project, existing);

    // Parse file for daily activity and tool usage
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
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

      // Track daily activity
      const timestamp = data.timestamp as string | undefined;
      const dateStr = getDateFromTimestamp(timestamp);
      if (dateStr) {
        const daily = dailyMap.get(dateStr) || { date: dateStr, messages: 0, tokens: 0, conversations: 0 };
        daily.messages++;
        dailyMap.set(dateStr, daily);
      }

      // Track tool usage
      const message = data.message as Record<string, unknown> | undefined;
      if (message?.content && Array.isArray(message.content)) {
        for (const item of message.content) {
          if (typeof item === "object" && item !== null) {
            const itemObj = item as Record<string, unknown>;
            if (itemObj.type === "tool_use") {
              const toolName = itemObj.name as string;
              toolMap.set(toolName, (toolMap.get(toolName) || 0) + 1);
              totalToolUses++;
            }
          }
        }
      }
    }
  }

  // Fill in missing dates for last N days
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    if (!dailyMap.has(dateStr)) {
      dailyMap.set(dateStr, { date: dateStr, messages: 0, tokens: 0, conversations: 0 });
    }
  }

  // Sort daily activity by date
  const dailyActivity = Array.from(dailyMap.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-days);

  // Sort projects by activity (messages)
  const topProjects = Array.from(projectMap.values())
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 10);

  // Sort tools by usage
  const toolUsage: ToolUsageStats[] = Array.from(toolMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({
      name,
      count,
      percentage: totalToolUses > 0 ? Math.round((count / totalToolUses) * 100) : 0,
    }));

  return {
    overview: {
      totalConversations: files.length,
      totalMessages,
      totalTokens,
      totalSize,
      activeProjects: projectMap.size,
      avgMessagesPerConversation: files.length > 0 ? Math.round(totalMessages / files.length) : 0,
      avgTokensPerConversation: files.length > 0 ? Math.round(totalTokens / files.length) : 0,
    },
    dailyActivity,
    topProjects,
    toolUsage,
    mediaStats: {
      totalImages,
      totalDocuments,
      problematicContent,
    },
    generatedAt: new Date(),
  };
}

function createAsciiBar(value: number, max: number, width = 20): string {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function formatUsageAnalytics(analytics: UsageAnalytics): string {
  const lines: string[] = [];
  const o = analytics.overview;

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║               USAGE ANALYTICS DASHBOARD                      ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");

  // Overview section
  lines.push("📊 OVERVIEW");
  lines.push("─".repeat(50));
  lines.push(`  Conversations:    ${o.totalConversations.toLocaleString()}`);
  lines.push(`  Total Messages:   ${o.totalMessages.toLocaleString()}`);
  lines.push(`  Total Tokens:     ~${o.totalTokens.toLocaleString()}`);
  lines.push(`  Total Size:       ${formatBytesForAnalytics(o.totalSize)}`);
  lines.push(`  Active Projects:  ${o.activeProjects}`);
  lines.push(`  Avg Msgs/Conv:    ${o.avgMessagesPerConversation}`);
  lines.push(`  Avg Tokens/Conv:  ~${o.avgTokensPerConversation.toLocaleString()}`);
  lines.push("");

  // Activity chart (last 7 days)
  const last7Days = analytics.dailyActivity.slice(-7);
  const maxMessages = Math.max(...last7Days.map(d => d.messages), 1);

  lines.push("📈 ACTIVITY (Last 7 days)");
  lines.push("─".repeat(50));
  for (const day of last7Days) {
    const dayName = new Date(day.date).toLocaleDateString("en-US", { weekday: "short" });
    const bar = createAsciiBar(day.messages, maxMessages, 25);
    lines.push(`  ${dayName} │${bar}│ ${day.messages}`);
  }
  lines.push("");

  // Top projects
  if (analytics.topProjects.length > 0) {
    lines.push("🏆 TOP PROJECTS (by messages)");
    lines.push("─".repeat(50));
    const maxProjMsgs = analytics.topProjects[0]?.messages || 1;
    for (const proj of analytics.topProjects.slice(0, 5)) {
      const shortName = proj.project.length > 25 ? "..." + proj.project.slice(-22) : proj.project;
      const bar = createAsciiBar(proj.messages, maxProjMsgs, 15);
      lines.push(`  ${shortName.padEnd(25)} │${bar}│ ${proj.messages}`);
    }
    lines.push("");
  }

  // Tool usage
  if (analytics.toolUsage.length > 0) {
    lines.push("🔧 TOP TOOLS");
    lines.push("─".repeat(50));
    for (const tool of analytics.toolUsage.slice(0, 8)) {
      const shortName = tool.name.length > 20 ? tool.name.slice(0, 17) + "..." : tool.name;
      lines.push(`  ${shortName.padEnd(20)} ${tool.count.toString().padStart(6)} (${tool.percentage}%)`);
    }
    lines.push("");
  }

  // Media stats
  const m = analytics.mediaStats;
  lines.push("🖼️  MEDIA");
  lines.push("─".repeat(50));
  lines.push(`  Images:           ${m.totalImages}`);
  lines.push(`  Documents:        ${m.totalDocuments}`);
  if (m.problematicContent > 0) {
    lines.push(`  ⚠️  Oversized:     ${m.problematicContent}`);
  }
  lines.push("");

  lines.push(`Generated: ${analytics.generatedAt.toISOString()}`);

  return lines.join("\n");
}

function formatBytesForAnalytics(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

// Duplicate Detection

export type DuplicateType = "conversation" | "content" | "message";

export interface DuplicateLocation {
  file: string;
  line?: number;
  type: "image" | "document" | "text";
  size: number;
}

export interface DuplicateGroup {
  hash: string;
  type: DuplicateType;
  contentType: "image" | "document" | "text" | "conversation";
  locations: DuplicateLocation[];
  totalSize: number;
  wastedSize: number;
}

export interface DuplicateReport {
  totalDuplicateGroups: number;
  totalWastedSize: number;
  conversationDuplicates: DuplicateGroup[];
  contentDuplicates: DuplicateGroup[];
  summary: {
    duplicateImages: number;
    duplicateDocuments: number;
    duplicateTextBlocks: number;
    potentialSavings: number;
  };
  generatedAt: Date;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

function contentFingerprint(content: string, maxLen = 10000): string {
  const normalized = content.slice(0, maxLen);
  return simpleHash(normalized);
}

export function findDuplicates(projectsDir: string): DuplicateReport {
  const files = findAllJsonlFiles(projectsDir);

  const contentHashes = new Map<string, DuplicateLocation[]>();
  const conversationHashes = new Map<string, DuplicateLocation[]>();

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const fileStats = fs.statSync(file);
    const convHash = contentFingerprint(content, 50000);

    const convLocations = conversationHashes.get(convHash) || [];
    convLocations.push({
      file,
      type: "text",
      size: fileStats.size,
    });
    conversationHashes.set(convHash, convLocations);

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

      const processContent = (contentArray: unknown[], location: string) => {
        if (!Array.isArray(contentArray)) return;

        for (const item of contentArray) {
          if (typeof item !== "object" || item === null) continue;
          const itemObj = item as Record<string, unknown>;

          if (itemObj.type === "image" || itemObj.type === "document") {
            const source = itemObj.source as Record<string, unknown> | undefined;
            if (source?.type === "base64") {
              const data = source.data as string | undefined;
              if (data && data.length > 1000) {
                const hash = contentFingerprint(data);
                const contentType = itemObj.type as "image" | "document";
                const size = data.length;

                const locations = contentHashes.get(hash) || [];
                locations.push({
                  file,
                  line: lineNum + 1,
                  type: contentType,
                  size,
                });
                contentHashes.set(hash, locations);
              }
            }
          }

          if (itemObj.type === "tool_result") {
            const innerContent = itemObj.content;
            if (Array.isArray(innerContent)) {
              processContent(innerContent, `${location}->tool_result`);
            }
          }
        }
      };

      const message = data.message as Record<string, unknown> | undefined;
      if (message?.content) {
        processContent(message.content as unknown[], "message");
      }

      const toolUseResult = data.toolUseResult as Record<string, unknown> | undefined;
      if (toolUseResult?.content) {
        processContent(toolUseResult.content as unknown[], "toolUseResult");
      }
    }
  }

  const conversationDuplicates: DuplicateGroup[] = [];
  const contentDuplicates: DuplicateGroup[] = [];

  let duplicateImages = 0;
  let duplicateDocuments = 0;
  let duplicateTextBlocks = 0;
  let totalWastedSize = 0;

  for (const [hash, locations] of conversationHashes) {
    if (locations.length > 1) {
      const totalSize = locations.reduce((sum, loc) => sum + loc.size, 0);
      const wastedSize = totalSize - locations[0].size;

      conversationDuplicates.push({
        hash,
        type: "conversation",
        contentType: "conversation",
        locations,
        totalSize,
        wastedSize,
      });

      totalWastedSize += wastedSize;
    }
  }

  for (const [hash, locations] of contentHashes) {
    if (locations.length > 1) {
      const totalSize = locations.reduce((sum, loc) => sum + loc.size, 0);
      const wastedSize = totalSize - locations[0].size;
      const contentType = locations[0].type;

      contentDuplicates.push({
        hash,
        type: "content",
        contentType,
        locations,
        totalSize,
        wastedSize,
      });

      totalWastedSize += wastedSize;

      if (contentType === "image") {
        duplicateImages += locations.length - 1;
      } else if (contentType === "document") {
        duplicateDocuments += locations.length - 1;
      } else {
        duplicateTextBlocks += locations.length - 1;
      }
    }
  }

  conversationDuplicates.sort((a, b) => b.wastedSize - a.wastedSize);
  contentDuplicates.sort((a, b) => b.wastedSize - a.wastedSize);

  return {
    totalDuplicateGroups: conversationDuplicates.length + contentDuplicates.length,
    totalWastedSize,
    conversationDuplicates,
    contentDuplicates,
    summary: {
      duplicateImages,
      duplicateDocuments,
      duplicateTextBlocks,
      potentialSavings: totalWastedSize,
    },
    generatedAt: new Date(),
  };
}

export function formatDuplicateReport(report: DuplicateReport): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║               DUPLICATE DETECTION REPORT                     ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");

  lines.push("📊 SUMMARY");
  lines.push("─".repeat(50));
  lines.push(`  Duplicate groups:    ${report.totalDuplicateGroups}`);
  lines.push(`  Duplicate images:    ${report.summary.duplicateImages}`);
  lines.push(`  Duplicate documents: ${report.summary.duplicateDocuments}`);
  lines.push(`  Wasted space:        ${formatBytesForAnalytics(report.totalWastedSize)}`);
  lines.push("");

  if (report.conversationDuplicates.length > 0) {
    lines.push("📁 DUPLICATE CONVERSATIONS");
    lines.push("─".repeat(50));
    for (const group of report.conversationDuplicates.slice(0, 5)) {
      lines.push(`  [${group.locations.length} copies] Wasted: ${formatBytesForAnalytics(group.wastedSize)}`);
      for (const loc of group.locations.slice(0, 3)) {
        const shortPath = loc.file.length > 45 ? "..." + loc.file.slice(-42) : loc.file;
        lines.push(`    - ${shortPath}`);
      }
      if (group.locations.length > 3) {
        lines.push(`    ... and ${group.locations.length - 3} more`);
      }
    }
    if (report.conversationDuplicates.length > 5) {
      lines.push(`  ... and ${report.conversationDuplicates.length - 5} more duplicate groups`);
    }
    lines.push("");
  }

  if (report.contentDuplicates.length > 0) {
    lines.push("🖼️  DUPLICATE CONTENT");
    lines.push("─".repeat(50));
    for (const group of report.contentDuplicates.slice(0, 10)) {
      const typeIcon = group.contentType === "image" ? "🖼️" : group.contentType === "document" ? "📄" : "📝";
      lines.push(`  ${typeIcon} ${group.contentType} [${group.locations.length} copies] ~${formatBytesForAnalytics(group.wastedSize)} wasted`);
      for (const loc of group.locations.slice(0, 2)) {
        const shortPath = loc.file.length > 35 ? "..." + loc.file.slice(-32) : loc.file;
        lines.push(`    - ${shortPath}:${loc.line}`);
      }
      if (group.locations.length > 2) {
        lines.push(`    ... and ${group.locations.length - 2} more locations`);
      }
    }
    if (report.contentDuplicates.length > 10) {
      lines.push(`  ... and ${report.contentDuplicates.length - 10} more duplicate content groups`);
    }
    lines.push("");
  }

  if (report.totalDuplicateGroups === 0) {
    lines.push("✓ No duplicates found!");
    lines.push("");
  } else {
    lines.push("💡 RECOMMENDATIONS");
    lines.push("─".repeat(50));
    if (report.conversationDuplicates.length > 0) {
      lines.push("  - Review duplicate conversations and consider removing copies");
    }
    if (report.summary.duplicateImages > 0) {
      lines.push("  - Same images appear multiple times in your conversations");
    }
    if (report.summary.duplicateDocuments > 0) {
      lines.push("  - Same documents appear multiple times in your conversations");
    }
    lines.push("");
  }

  lines.push(`Generated: ${report.generatedAt.toISOString()}`);

  return lines.join("\n");
}

// Conversation Archiving

export interface ArchiveCandidate {
  file: string;
  lastModified: Date;
  messageCount: number;
  sizeBytes: number;
  daysSinceActivity: number;
}

export interface ArchiveResult {
  archived: string[];
  skipped: string[];
  totalSize: number;
  archiveDir: string;
  error?: string;
}

export function findArchiveCandidates(
  projectsDir: string,
  options: { minDaysInactive?: number; minMessages?: number } = {}
): ArchiveCandidate[] {
  const { minDaysInactive = 30, minMessages = 0 } = options;
  const files = findAllJsonlFiles(projectsDir);
  const candidates: ArchiveCandidate[] = [];
  const now = new Date();

  for (const file of files) {
    try {
      const stats = getConversationStats(file);
      const daysSince = Math.floor((now.getTime() - stats.lastModified.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSince >= minDaysInactive && stats.totalMessages >= minMessages) {
        candidates.push({
          file,
          lastModified: stats.lastModified,
          messageCount: stats.totalMessages,
          sizeBytes: stats.fileSizeBytes,
          daysSinceActivity: daysSince,
        });
      }
    } catch {
      continue;
    }
  }

  candidates.sort((a, b) => b.daysSinceActivity - a.daysSinceActivity);
  return candidates;
}

export function archiveConversations(
  projectsDir: string,
  options: { minDaysInactive?: number; dryRun?: boolean } = {}
): ArchiveResult {
  const { minDaysInactive = 30, dryRun = false } = options;
  const archiveDir = path.join(path.dirname(projectsDir), "archive");
  const candidates = findArchiveCandidates(projectsDir, { minDaysInactive });

  const archived: string[] = [];
  const skipped: string[] = [];
  let totalSize = 0;

  if (!dryRun && candidates.length > 0 && !fs.existsSync(archiveDir)) {
    fs.mkdirSync(archiveDir, { recursive: true });
  }

  for (const candidate of candidates) {
    const relativePath = path.relative(projectsDir, candidate.file);
    const archivePath = path.join(archiveDir, relativePath);

    if (dryRun) {
      archived.push(candidate.file);
      totalSize += candidate.sizeBytes;
      continue;
    }

    try {
      const archiveSubDir = path.dirname(archivePath);
      if (!fs.existsSync(archiveSubDir)) {
        fs.mkdirSync(archiveSubDir, { recursive: true });
      }

      fs.renameSync(candidate.file, archivePath);
      archived.push(candidate.file);
      totalSize += candidate.sizeBytes;
    } catch {
      skipped.push(candidate.file);
    }
  }

  return { archived, skipped, totalSize, archiveDir };
}

export function formatArchiveReport(
  candidates: ArchiveCandidate[],
  result?: ArchiveResult,
  dryRun = false
): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║               CONVERSATION ARCHIVE REPORT                    ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");

  if (candidates.length === 0) {
    lines.push("✓ No conversations eligible for archiving.");
    lines.push("");
    return lines.join("\n");
  }

  const totalSize = candidates.reduce((sum, c) => sum + c.sizeBytes, 0);

  lines.push("📊 SUMMARY");
  lines.push("─".repeat(50));
  lines.push(`  Eligible conversations: ${candidates.length}`);
  lines.push(`  Total size:            ${formatBytesForAnalytics(totalSize)}`);
  lines.push("");

  lines.push("📁 ARCHIVE CANDIDATES");
  lines.push("─".repeat(50));
  for (const c of candidates.slice(0, 10)) {
    const shortPath = c.file.length > 45 ? "..." + c.file.slice(-42) : c.file;
    lines.push(`  ${shortPath}`);
    lines.push(`    ${c.daysSinceActivity} days inactive, ${c.messageCount} msgs, ${formatBytesForAnalytics(c.sizeBytes)}`);
  }
  if (candidates.length > 10) {
    lines.push(`  ... and ${candidates.length - 10} more`);
  }
  lines.push("");

  if (result) {
    if (dryRun) {
      lines.push("📋 DRY RUN - No changes made");
      lines.push("─".repeat(50));
      lines.push(`  Would archive: ${result.archived.length} conversations`);
      lines.push(`  Would free:    ${formatBytesForAnalytics(result.totalSize)}`);
      lines.push(`  Archive to:    ${result.archiveDir}`);
    } else {
      lines.push("✓ ARCHIVED");
      lines.push("─".repeat(50));
      lines.push(`  Archived:   ${result.archived.length} conversations`);
      lines.push(`  Freed:      ${formatBytesForAnalytics(result.totalSize)}`);
      lines.push(`  Archive at: ${result.archiveDir}`);
      if (result.skipped.length > 0) {
        lines.push(`  Skipped:    ${result.skipped.length} (errors)`);
      }
    }
    lines.push("");
  }

  return lines.join("\n");
}

// Automatic Scheduled Maintenance

export interface MaintenanceAction {
  type: "fix" | "cleanup" | "archive";
  description: string;
  count: number;
  sizeBytes?: number;
}

export interface MaintenanceReport {
  status: "healthy" | "needs_attention" | "critical";
  actions: MaintenanceAction[];
  recommendations: string[];
  lastRun?: Date;
  nextRecommendedRun?: Date;
  generatedAt: Date;
}

export interface MaintenanceConfig {
  autoFix: boolean;
  autoCleanupDays: number;
  autoArchiveDays: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: MaintenanceConfig = {
  autoFix: true,
  autoCleanupDays: 7,
  autoArchiveDays: 60,
  enabled: false,
};

export function getMaintenanceConfigPath(): string {
  return path.join(path.dirname(path.dirname(process.env.HOME || "")), ".claude", "maintenance.json");
}

export function loadMaintenanceConfig(configPath?: string): MaintenanceConfig {
  const filePath = configPath || path.join(process.env.HOME || "", ".claude", "maintenance.json");
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
    }
  } catch {
    // Use defaults
  }
  return DEFAULT_CONFIG;
}

export function saveMaintenanceConfig(config: MaintenanceConfig, configPath?: string): void {
  const filePath = configPath || path.join(process.env.HOME || "", ".claude", "maintenance.json");
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export function runMaintenance(
  projectsDir: string,
  options: { dryRun?: boolean; config?: MaintenanceConfig } = {}
): MaintenanceReport {
  const { dryRun = true, config = DEFAULT_CONFIG } = options;
  const actions: MaintenanceAction[] = [];
  const recommendations: string[] = [];

  // Check for issues to fix
  const files = findAllJsonlFiles(projectsDir);
  let issueCount = 0;
  let issueSize = 0;

  for (const file of files) {
    const scanResult = scanFile(file);
    if (scanResult.issues.length > 0) {
      issueCount += scanResult.issues.length;
      for (const issue of scanResult.issues) {
        issueSize += issue.estimatedSize;
      }
    }
  }

  if (issueCount > 0) {
    actions.push({
      type: "fix",
      description: "Oversized content detected",
      count: issueCount,
      sizeBytes: issueSize,
    });

    if (config.autoFix && !dryRun) {
      for (const file of files) {
        fixFile(file, true);
      }
    }
  }

  // Check for old backups
  const backups = findBackupFiles(projectsDir);
  const oldBackups = backups.filter(b => {
    try {
      const stat = fs.statSync(b);
      const daysOld = Math.floor((Date.now() - stat.mtime.getTime()) / (1000 * 60 * 60 * 24));
      return daysOld > config.autoCleanupDays;
    } catch {
      return false;
    }
  });

  if (oldBackups.length > 0) {
    const backupSize = oldBackups.reduce((sum, b) => {
      try {
        return sum + fs.statSync(b).size;
      } catch {
        return sum;
      }
    }, 0);

    actions.push({
      type: "cleanup",
      description: `Backups older than ${config.autoCleanupDays} days`,
      count: oldBackups.length,
      sizeBytes: backupSize,
    });

    if (!dryRun) {
      deleteOldBackups(projectsDir, config.autoCleanupDays);
    }
  }

  // Check for archive candidates
  const archiveCandidates = findArchiveCandidates(projectsDir, {
    minDaysInactive: config.autoArchiveDays,
  });

  if (archiveCandidates.length > 0) {
    const archiveSize = archiveCandidates.reduce((sum, c) => sum + c.sizeBytes, 0);

    actions.push({
      type: "archive",
      description: `Conversations inactive for ${config.autoArchiveDays}+ days`,
      count: archiveCandidates.length,
      sizeBytes: archiveSize,
    });
  }

  // Determine status
  let status: "healthy" | "needs_attention" | "critical" = "healthy";
  if (issueCount > 0) {
    status = "critical";
    recommendations.push("Run 'cct fix' to remove oversized content");
  } else if (oldBackups.length > 5 || archiveCandidates.length > 10) {
    status = "needs_attention";
  }

  if (oldBackups.length > 0) {
    recommendations.push(`Run 'cct cleanup --days ${config.autoCleanupDays}' to remove old backups`);
  }
  if (archiveCandidates.length > 0) {
    recommendations.push(`Run 'cct archive --days ${config.autoArchiveDays}' to archive inactive conversations`);
  }

  const nextRun = new Date();
  nextRun.setDate(nextRun.getDate() + 7);

  return {
    status,
    actions,
    recommendations,
    nextRecommendedRun: nextRun,
    generatedAt: new Date(),
  };
}

export function formatMaintenanceReport(report: MaintenanceReport, dryRun = true): string {
  const lines: string[] = [];

  lines.push("╔══════════════════════════════════════════════════════════════╗");
  lines.push("║               MAINTENANCE REPORT                             ║");
  lines.push("╚══════════════════════════════════════════════════════════════╝");
  lines.push("");

  const statusIcon = report.status === "healthy" ? "✓" : report.status === "critical" ? "✗" : "⚠";
  const statusColor = report.status === "healthy" ? "Healthy" : report.status === "critical" ? "Critical" : "Needs Attention";

  lines.push("📊 STATUS");
  lines.push("─".repeat(50));
  lines.push(`  ${statusIcon} ${statusColor}`);
  lines.push("");

  if (report.actions.length > 0) {
    lines.push(dryRun ? "📋 PENDING ACTIONS (dry run)" : "📋 ACTIONS TAKEN");
    lines.push("─".repeat(50));
    for (const action of report.actions) {
      const icon = action.type === "fix" ? "🔧" : action.type === "cleanup" ? "🗑️" : "📦";
      const sizeStr = action.sizeBytes ? ` (~${formatBytesForAnalytics(action.sizeBytes)})` : "";
      lines.push(`  ${icon} ${action.description}`);
      lines.push(`     ${action.count} item(s)${sizeStr}`);
    }
    lines.push("");
  }

  if (report.recommendations.length > 0) {
    lines.push("💡 RECOMMENDATIONS");
    lines.push("─".repeat(50));
    for (const rec of report.recommendations) {
      lines.push(`  - ${rec}`);
    }
    lines.push("");
  }

  if (report.actions.length === 0 && report.recommendations.length === 0) {
    lines.push("✓ Everything looks good! No maintenance needed.");
    lines.push("");
  }

  lines.push(`Generated: ${report.generatedAt.toISOString()}`);

  return lines.join("\n");
}

export function generateCronSchedule(): string {
  return `# Claude Code Toolkit Maintenance
# Run weekly on Sunday at 3am
0 3 * * 0 npx @asifkibria/claude-code-toolkit maintenance --auto

# Or add to your shell profile to run on terminal start:
# npx @asifkibria/claude-code-toolkit maintenance --check
`;
}

export function generateLaunchdPlist(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claude-code-toolkit.maintenance</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/npx</string>
        <string>@asifkibria/claude-code-toolkit</string>
        <string>maintenance</string>
        <string>--auto</string>
    </array>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>0</integer>
        <key>Hour</key>
        <integer>3</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/tmp/claude-code-toolkit.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/claude-code-toolkit.error.log</string>
</dict>
</plist>
`;
}
