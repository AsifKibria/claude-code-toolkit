/**
 * Enhanced Export Module
 * Export conversations to HTML with syntax highlighting
 */

import * as fs from "fs";
import * as path from "path";
import { ExportedMessage } from "./scanner.js";

export type EnhancedExportFormat = "markdown" | "json" | "html";

export interface EnhancedExportOptions {
  format: EnhancedExportFormat;
  includeToolResults?: boolean;
  includeTimestamps?: boolean;
  stripImages?: boolean;
  syntaxHighlighting?: boolean;
  theme?: "light" | "dark";
  title?: string;
}

export interface EnhancedExportResult {
  file: string;
  format: EnhancedExportFormat;
  messageCount: number;
  content: string;
  exportedAt: Date;
  size: number;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function detectLanguage(code: string): string {
  if (code.includes("function") || code.includes("const ") || code.includes("let ") || code.includes("=>")) {
    if (code.includes(": string") || code.includes(": number") || code.includes("interface ")) {
      return "typescript";
    }
    return "javascript";
  }
  if (code.includes("def ") || code.includes("import ") && code.includes(":")) {
    return "python";
  }
  if (code.includes("func ") || code.includes("package ")) {
    return "go";
  }
  if (code.includes("fn ") || code.includes("let mut ")) {
    return "rust";
  }
  if (code.includes("<?php") || code.includes("$_")) {
    return "php";
  }
  if (code.match(/^#!\/bin\/(bash|sh)|^\s*if\s+\[|^\s*for\s+\w+\s+in/m)) {
    return "bash";
  }
  if (code.includes("SELECT ") || code.includes("INSERT ") || code.includes("CREATE TABLE")) {
    return "sql";
  }
  return "plaintext";
}

function highlightCode(code: string, language: string): string {
  const escaped = escapeHtml(code);

  const keywords: Record<string, string[]> = {
    javascript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "extends", "import", "export", "from", "async", "await", "try", "catch", "throw", "new", "this", "super", "null", "undefined", "true", "false"],
    typescript: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "class", "extends", "import", "export", "from", "async", "await", "try", "catch", "throw", "new", "this", "super", "null", "undefined", "true", "false", "interface", "type", "enum", "implements", "private", "public", "protected", "readonly", "as", "is"],
    python: ["def", "class", "if", "elif", "else", "for", "while", "return", "import", "from", "as", "try", "except", "finally", "raise", "with", "lambda", "yield", "pass", "break", "continue", "True", "False", "None", "and", "or", "not", "in", "is", "async", "await"],
    go: ["func", "package", "import", "var", "const", "type", "struct", "interface", "return", "if", "else", "for", "range", "switch", "case", "default", "go", "chan", "select", "defer", "make", "new", "nil", "true", "false"],
    rust: ["fn", "let", "mut", "const", "struct", "enum", "impl", "trait", "pub", "use", "mod", "if", "else", "for", "while", "loop", "match", "return", "self", "Self", "true", "false", "None", "Some", "Ok", "Err", "async", "await"],
    bash: ["if", "then", "else", "elif", "fi", "for", "while", "do", "done", "case", "esac", "function", "return", "exit", "echo", "export", "source", "local"],
    sql: ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TABLE", "INDEX", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER", "ON", "AND", "OR", "NOT", "NULL", "PRIMARY", "KEY", "FOREIGN", "REFERENCES", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET", "AS", "DISTINCT", "COUNT", "SUM", "AVG", "MAX", "MIN"],
  };

  const langKeywords = keywords[language] || [];

  let highlighted = escaped;

  highlighted = highlighted.replace(/(["'`])(?:(?!\1|\\).|\\.)*\1/g, '<span class="string">$&</span>');
  highlighted = highlighted.replace(/(\/\/.*|#.*)/g, '<span class="comment">$1</span>');
  highlighted = highlighted.replace(/\/\*[\s\S]*?\*\//g, '<span class="comment">$&</span>');
  highlighted = highlighted.replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="number">$1</span>');

  for (const kw of langKeywords) {
    const regex = new RegExp(`\\b(${kw})\\b`, "g");
    highlighted = highlighted.replace(regex, '<span class="keyword">$1</span>');
  }

  return highlighted;
}

function processCodeBlocks(content: string): string {
  return content.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    const language = lang || detectLanguage(code);
    const highlighted = highlightCode(code.trim(), language);
    return `<pre class="code-block"><code class="language-${language}">${highlighted}</code></pre>`;
  });
}

function processInlineCode(content: string): string {
  return content.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
}

function generateHtmlStyles(theme: "light" | "dark"): string {
  const isDark = theme === "dark";

  return `
    <style>
      :root {
        --bg-color: ${isDark ? "#1e1e1e" : "#ffffff"};
        --text-color: ${isDark ? "#d4d4d4" : "#333333"};
        --border-color: ${isDark ? "#404040" : "#e0e0e0"};
        --user-bg: ${isDark ? "#264f78" : "#e3f2fd"};
        --assistant-bg: ${isDark ? "#2d4a3e" : "#f1f8e9"};
        --system-bg: ${isDark ? "#4a3f35" : "#fff3e0"};
        --code-bg: ${isDark ? "#2d2d2d" : "#f5f5f5"};
        --keyword-color: ${isDark ? "#569cd6" : "#0000ff"};
        --string-color: ${isDark ? "#ce9178" : "#a31515"};
        --comment-color: ${isDark ? "#6a9955" : "#008000"};
        --number-color: ${isDark ? "#b5cea8" : "#098658"};
        --accent-color: ${isDark ? "#4fc3f7" : "#1976d2"};
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
        background: var(--bg-color);
        color: var(--text-color);
        line-height: 1.6;
        padding: 20px;
        max-width: 900px;
        margin: 0 auto;
      }
      header {
        border-bottom: 2px solid var(--border-color);
        padding-bottom: 20px;
        margin-bottom: 30px;
      }
      header h1 {
        font-size: 24px;
        font-weight: 600;
        color: var(--accent-color);
        margin-bottom: 10px;
      }
      .meta {
        font-size: 14px;
        opacity: 0.7;
      }
      .message {
        margin-bottom: 24px;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      }
      .message-header {
        padding: 12px 16px;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .message-content {
        padding: 16px;
        white-space: pre-wrap;
        word-wrap: break-word;
      }
      .user { background: var(--user-bg); }
      .assistant { background: var(--assistant-bg); }
      .system { background: var(--system-bg); }
      .timestamp {
        font-size: 12px;
        opacity: 0.6;
        margin-left: auto;
      }
      .code-block {
        background: var(--code-bg);
        border-radius: 8px;
        padding: 16px;
        overflow-x: auto;
        margin: 12px 0;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.5;
      }
      .inline-code {
        background: var(--code-bg);
        padding: 2px 6px;
        border-radius: 4px;
        font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
        font-size: 90%;
      }
      .keyword { color: var(--keyword-color); font-weight: 600; }
      .string { color: var(--string-color); }
      .comment { color: var(--comment-color); font-style: italic; }
      .number { color: var(--number-color); }
      .tool-use {
        background: var(--code-bg);
        border-left: 3px solid var(--accent-color);
        padding: 8px 12px;
        margin: 8px 0;
        font-size: 14px;
      }
      .tool-name {
        font-weight: 600;
        color: var(--accent-color);
      }
      .icon { font-size: 18px; }
      footer {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid var(--border-color);
        text-align: center;
        font-size: 12px;
        opacity: 0.6;
      }
      @media print {
        body { padding: 0; max-width: none; }
        .message { break-inside: avoid; box-shadow: none; border: 1px solid var(--border-color); }
      }
    </style>
  `;
}

export function formatAsHtml(
  messages: ExportedMessage[],
  options: EnhancedExportOptions
): string {
  const theme = options.theme || "light";
  const title = options.title || "Conversation Export";

  const messageHtml = messages.map((msg) => {
    const roleClass = msg.role;
    const roleIcon = msg.role === "user" ? "👤" : msg.role === "assistant" ? "🤖" : "⚙️";
    const roleLabel = msg.role.charAt(0).toUpperCase() + msg.role.slice(1);

    let contentHtml = escapeHtml(msg.content || "");

    if (options.syntaxHighlighting !== false) {
      contentHtml = processCodeBlocks(msg.content || "");
      contentHtml = processInlineCode(contentHtml);
    }

    let toolHtml = "";
    if (msg.toolUse && msg.toolUse.length > 0) {
      toolHtml = msg.toolUse
        .map((t) => `<div class="tool-use"><span class="tool-name">${escapeHtml(t.name)}</span></div>`)
        .join("");
    }

    if (options.includeToolResults && msg.toolResults && msg.toolResults.length > 0) {
      toolHtml += msg.toolResults
        .map((r) => `<div class="tool-use"><span class="tool-name">${escapeHtml(r.name)}</span>: ${escapeHtml(r.result.slice(0, 200))}${r.result.length > 200 ? "..." : ""}</div>`)
        .join("");
    }

    const timestampHtml = options.includeTimestamps && msg.timestamp
      ? `<span class="timestamp">${escapeHtml(msg.timestamp)}</span>`
      : "";

    return `
      <div class="message ${roleClass}">
        <div class="message-header">
          <span class="icon">${roleIcon}</span>
          <span>${roleLabel}</span>
          ${timestampHtml}
        </div>
        <div class="message-content">${contentHtml}${toolHtml}</div>
      </div>
    `;
  }).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  ${generateHtmlStyles(theme)}
</head>
<body>
  <header>
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      <p>Exported: ${new Date().toISOString()}</p>
      <p>Messages: ${messages.length}</p>
    </div>
  </header>
  <main>
    ${messageHtml}
  </main>
  <footer>
    <p>Generated by Claude Code Toolkit</p>
  </footer>
</body>
</html>`;
}

export function parseConversationForExport(filePath: string): ExportedMessage[] {
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
        resultText = resultContent
          .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
          .map((item) => {
            if (item.type === "text") return item.text as string;
            return "";
          })
          .join("\n");
      }

      exportedMessage.toolResults = [{
        name: (toolResult.name as string) || "unknown",
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

export function exportToHtml(
  filePath: string,
  outputPath: string,
  options?: Partial<EnhancedExportOptions>
): EnhancedExportResult {
  const messages = parseConversationForExport(filePath);

  const fullOptions: EnhancedExportOptions = {
    format: "html",
    includeToolResults: options?.includeToolResults ?? false,
    includeTimestamps: options?.includeTimestamps ?? true,
    syntaxHighlighting: options?.syntaxHighlighting ?? true,
    theme: options?.theme ?? "light",
    title: options?.title ?? path.basename(filePath, ".jsonl"),
  };

  const htmlContent = formatAsHtml(messages, fullOptions);

  fs.writeFileSync(outputPath, htmlContent, "utf-8");

  return {
    file: outputPath,
    format: "html",
    messageCount: messages.length,
    content: htmlContent,
    exportedAt: new Date(),
    size: htmlContent.length,
  };
}

export interface BulkExportResult {
  exported: { file: string; output: string; messages: number }[];
  errors: { file: string; error: string }[];
  totalMessages: number;
  totalSize: number;
}

export function bulkExport(
  files: string[],
  outputDir: string,
  options?: Partial<EnhancedExportOptions>
): BulkExportResult {
  const result: BulkExportResult = {
    exported: [],
    errors: [],
    totalMessages: 0,
    totalSize: 0,
  };

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const format = options?.format || "html";
  const ext = format === "json" ? ".json" : format === "html" ? ".html" : ".md";

  for (const file of files) {
    try {
      const baseName = path.basename(file, ".jsonl");
      const outputPath = path.join(outputDir, `${baseName}${ext}`);

      if (format === "html") {
        const exportResult = exportToHtml(file, outputPath, options);
        result.exported.push({
          file,
          output: outputPath,
          messages: exportResult.messageCount,
        });
        result.totalMessages += exportResult.messageCount;
        result.totalSize += exportResult.size;
      } else {
        const messages = parseConversationForExport(file);
        let content: string;

        if (format === "json") {
          content = JSON.stringify(messages, null, 2);
        } else {
          content = messages
            .map((m) => `## ${m.role === "user" ? "👤 User" : "🤖 Assistant"}\n\n${m.content}\n`)
            .join("\n---\n\n");
        }

        fs.writeFileSync(outputPath, content, "utf-8");
        result.exported.push({
          file,
          output: outputPath,
          messages: messages.length,
        });
        result.totalMessages += messages.length;
        result.totalSize += content.length;
      }
    } catch (e) {
      result.errors.push({
        file,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return result;
}
