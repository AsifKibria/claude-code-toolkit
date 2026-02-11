import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync, spawn } from "child_process";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");

export interface McpServerConfig {
  name: string;
  type: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  source: string;
}

export interface McpValidationIssue {
  server: string;
  severity: "error" | "warning" | "info";
  message: string;
  fix?: string;
}

export interface McpValidationResult {
  configPath: string;
  servers: McpServerConfig[];
  issues: McpValidationIssue[];
  valid: boolean;
}

export interface McpServerTestResult {
  server: string;
  reachable: boolean;
  startupTime?: number;
  error?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

export interface McpResource {
  uri: string;
  name?: string;
  description?: string;
  mimeType?: string;
}

export interface McpPrompt {
  name: string;
  description?: string;
  arguments?: Array<{ name: string; description?: string; required?: boolean }>;
}

export interface McpServerCapabilities {
  tools: McpTool[];
  resources: McpResource[];
  prompts: McpPrompt[];
  serverInfo?: {
    name?: string;
    version?: string;
  };
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  probeTime: number;
  error?: string;
}

export interface McpDiagnosticReport {
  configs: McpValidationResult[];
  testResults?: McpServerTestResult[];
  duplicateServers: { name: string; locations: string[] }[];
  totalServers: number;
  healthyServers: number;
  recommendations: string[];
  generatedAt: Date;
}

function commandExists(command: string): boolean {
  if (path.isAbsolute(command)) {
    return fs.existsSync(command);
  }
  try {
    execFileSync("which", [command], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function extractServersFromConfig(data: Record<string, unknown>, source: string): McpServerConfig[] {
  const servers: McpServerConfig[] = [];
  const mcpServers = data.mcpServers as Record<string, Record<string, unknown>> | undefined;

  if (mcpServers && typeof mcpServers === "object") {
    for (const [name, config] of Object.entries(mcpServers)) {
      if (!config || typeof config !== "object") continue;
      servers.push({
        name,
        type: (config.type as string) || "",
        command: (config.command as string) || "",
        args: config.args as string[] | undefined,
        env: config.env as Record<string, string> | undefined,
        source,
      });
    }
  }

  return servers;
}

export function findMcpConfigs(options?: { projectDir?: string }): string[] {
  const configs: string[] = [];

  const claudeJson = path.join(os.homedir(), ".claude.json");
  if (fs.existsSync(claudeJson)) {
    configs.push(claudeJson);
  }

  const projectDir = options?.projectDir || process.cwd();
  const projectMcp = path.join(projectDir, ".mcp.json");
  if (fs.existsSync(projectMcp)) {
    configs.push(projectMcp);
  }

  const pluginCache = path.join(CLAUDE_DIR, "plugins", "cache");
  if (fs.existsSync(pluginCache)) {
    try {
      function findMcpInDir(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            findMcpInDir(fullPath);
          } else if (entry.name === ".mcp.json") {
            configs.push(fullPath);
          }
        }
      }
      findMcpInDir(pluginCache);
    } catch {
      // skip
    }
  }

  return configs;
}

export function validateMcpConfig(configPath: string): McpValidationResult {
  const result: McpValidationResult = {
    configPath,
    servers: [],
    issues: [],
    valid: true,
  };

  let data: Record<string, unknown>;
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    data = JSON.parse(content);
  } catch (e) {
    result.issues.push({
      server: "(file)",
      severity: "error",
      message: `Failed to parse ${configPath}: ${e instanceof Error ? e.message : String(e)}`,
    });
    result.valid = false;
    return result;
  }

  let servers: McpServerConfig[] = [];

  if (configPath.endsWith(".claude.json")) {
    servers = extractServersFromConfig(data, configPath);

    const projects = data.projects as Record<string, Record<string, unknown>> | undefined;
    if (projects && typeof projects === "object") {
      for (const [projKey, projConfig] of Object.entries(projects)) {
        if (projConfig && typeof projConfig === "object") {
          const projServers = extractServersFromConfig(projConfig, `${configPath} [project: ${projKey}]`);
          servers.push(...projServers);
        }
      }
    }
  } else {
    servers = extractServersFromConfig(data, configPath);
  }

  result.servers = servers;

  for (const server of servers) {
    if (!server.command) {
      result.issues.push({
        server: server.name,
        severity: "error",
        message: "Missing 'command' field",
        fix: "Add a 'command' field specifying the executable to run",
      });
      result.valid = false;
      continue;
    }

    if (server.command.includes("${")) {
      // Skip binary check for templated commands
    } else if (!commandExists(server.command)) {
      result.issues.push({
        server: server.name,
        severity: "error",
        message: `Command '${server.command}' not found`,
        fix: `Install or provide full path for '${server.command}'`,
      });
      result.valid = false;
    }

    if (server.args) {
      for (const arg of server.args) {
        if (arg.startsWith("/") && !arg.includes("${") && !fs.existsSync(arg)) {
          result.issues.push({
            server: server.name,
            severity: "warning",
            message: `Argument path '${arg}' does not exist`,
          });
        }
      }
    }

    if (!server.type || server.type === "") {
      result.issues.push({
        server: server.name,
        severity: "info",
        message: "No 'type' specified, defaulting to 'stdio'",
      });
    }

    if (server.env) {
      for (const [key, value] of Object.entries(server.env)) {
        if (!value || value === "") {
          result.issues.push({
            server: server.name,
            severity: "warning",
            message: `Environment variable '${key}' is empty`,
          });
        }
      }
    }
  }

  return result;
}

export async function testMcpServer(serverName: string, serverConfig: McpServerConfig): Promise<McpServerTestResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();

    try {
      const resolvedCommand = serverConfig.command.replace(/\$\{.*?\}/g, "");
      if (!resolvedCommand) {
        resolve({ server: serverName, reachable: false, error: "Command contains unresolved variables" });
        return;
      }

      const child = spawn(resolvedCommand, serverConfig.args || [], {
        env: { ...process.env, ...serverConfig.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      const timeout = setTimeout(() => {
        child.kill();
        resolve({
          server: serverName,
          reachable: true,
          startupTime: Date.now() - startTime,
        });
      }, 5000);

      child.on("error", (err) => {
        clearTimeout(timeout);
        resolve({
          server: serverName,
          reachable: false,
          error: err.message,
        });
      });

      child.on("exit", (code) => {
        clearTimeout(timeout);
        if (Date.now() - startTime < 1000) {
          resolve({
            server: serverName,
            reachable: false,
            startupTime: Date.now() - startTime,
            error: `Process exited immediately with code ${code}`,
          });
        } else {
          resolve({
            server: serverName,
            reachable: true,
            startupTime: Date.now() - startTime,
          });
        }
      });
    } catch (e) {
      resolve({
        server: serverName,
        reachable: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  });
}

export async function probeMcpServer(serverConfig: McpServerConfig, timeout = 10000): Promise<McpServerCapabilities> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const result: McpServerCapabilities = {
      tools: [],
      resources: [],
      prompts: [],
      probeTime: 0,
    };

    try {
      const resolvedCommand = serverConfig.command.replace(/\$\{.*?\}/g, "");
      if (!resolvedCommand) {
        result.error = "Command contains unresolved variables";
        result.probeTime = Date.now() - startTime;
        resolve(result);
        return;
      }

      const child = spawn(resolvedCommand, serverConfig.args || [], {
        env: { ...process.env, ...serverConfig.env },
        stdio: ["pipe", "pipe", "pipe"],
      });

      let buffer = "";
      let requestId = 1;
      let initialized = false;
      let pendingRequests = new Map<number, string>();
      let completedRequests = new Set<string>();

      const timeoutHandle = setTimeout(() => {
        child.kill();
        result.probeTime = Date.now() - startTime;
        if (!result.error) {
          result.error = "Timeout waiting for server responses";
        }
        resolve(result);
      }, timeout);

      const sendRequest = (method: string, params?: Record<string, unknown>) => {
        const id = requestId++;
        pendingRequests.set(id, method);
        const request = {
          jsonrpc: "2.0",
          id,
          method,
          params: params || {},
        };
        child.stdin?.write(JSON.stringify(request) + "\n");
      };

      const checkComplete = () => {
        const needed = ["tools/list", "resources/list", "prompts/list"];
        if (needed.every(m => completedRequests.has(m))) {
          clearTimeout(timeoutHandle);
          child.kill();
          result.probeTime = Date.now() - startTime;
          resolve(result);
        }
      };

      child.stdout?.on("data", (data) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const response = JSON.parse(line);

            if (response.id !== undefined) {
              const method = pendingRequests.get(response.id);
              pendingRequests.delete(response.id);

              if (method === "initialize" && !response.error) {
                initialized = true;
                result.serverInfo = response.result?.serverInfo;
                result.capabilities = response.result?.capabilities;

                child.stdin?.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");

                sendRequest("tools/list");
                sendRequest("resources/list");
                sendRequest("prompts/list");
              } else if (method === "tools/list" && !response.error) {
                result.tools = response.result?.tools || [];
                completedRequests.add("tools/list");
                checkComplete();
              } else if (method === "resources/list" && !response.error) {
                result.resources = response.result?.resources || [];
                completedRequests.add("resources/list");
                checkComplete();
              } else if (method === "prompts/list" && !response.error) {
                result.prompts = response.result?.prompts || [];
                completedRequests.add("prompts/list");
                checkComplete();
              } else if (response.error) {
                if (method) completedRequests.add(method);
                checkComplete();
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      });

      child.on("error", (err) => {
        clearTimeout(timeoutHandle);
        result.error = err.message;
        result.probeTime = Date.now() - startTime;
        resolve(result);
      });

      child.on("exit", (code) => {
        clearTimeout(timeoutHandle);
        if (!initialized && !result.error) {
          result.error = `Server exited with code ${code} before initialization`;
        }
        result.probeTime = Date.now() - startTime;
        resolve(result);
      });

      sendRequest("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "claude-code-toolkit", version: "1.0.0" },
      });

    } catch (e) {
      result.error = e instanceof Error ? e.message : String(e);
      result.probeTime = Date.now() - startTime;
      resolve(result);
    }
  });
}

export async function diagnoseMcpServers(options?: { test?: boolean; projectDir?: string }): Promise<McpDiagnosticReport> {
  const configPaths = findMcpConfigs({ projectDir: options?.projectDir });
  const configs: McpValidationResult[] = [];

  for (const configPath of configPaths) {
    configs.push(validateMcpConfig(configPath));
  }

  const allServers = configs.flatMap(c => c.servers);
  const serversByName = new Map<string, string[]>();
  for (const server of allServers) {
    const existing = serversByName.get(server.name) || [];
    existing.push(server.source);
    serversByName.set(server.name, existing);
  }

  const duplicateServers = Array.from(serversByName.entries())
    .filter(([, locations]) => locations.length > 1)
    .map(([name, locations]) => ({ name, locations }));

  let testResults: McpServerTestResult[] | undefined;
  if (options?.test) {
    testResults = [];
    for (const server of allServers) {
      testResults.push(await testMcpServer(server.name, server));
    }
  }

  const totalServers = allServers.length;
  const totalIssues = configs.reduce((sum, c) => sum + c.issues.filter(i => i.severity === "error").length, 0);
  const healthyServers = totalServers - totalIssues;

  const recommendations: string[] = [];
  if (duplicateServers.length > 0) {
    recommendations.push(`Found ${duplicateServers.length} duplicate server name(s) across configs`);
  }
  if (totalIssues > 0) {
    recommendations.push(`${totalIssues} server(s) have configuration errors`);
  }
  if (totalServers === 0) {
    recommendations.push("No MCP servers configured");
  }

  return {
    configs,
    testResults,
    duplicateServers,
    totalServers,
    healthyServers,
    recommendations,
    generatedAt: new Date(),
  };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatMcpDiagnosticReport(report: McpDiagnosticReport): string {
  let output = "";
  output += "╔══════════════════════════════════════════════╗\n";
  output += "║         MCP SERVER DIAGNOSTICS               ║\n";
  output += "╚══════════════════════════════════════════════╝\n\n";

  output += `Total servers: ${report.totalServers}\n`;
  output += `Healthy: ${report.healthyServers}\n`;
  output += `Config files: ${report.configs.length}\n\n`;

  for (const config of report.configs) {
    output += `Config: ${config.configPath}\n`;
    output += `  Servers: ${config.servers.length}\n`;
    output += `  Valid: ${config.valid ? "✓" : "✗"}\n`;

    for (const server of config.servers) {
      output += `\n  [${server.name}]\n`;
      output += `    Command: ${server.command}\n`;
      if (server.args?.length) output += `    Args: ${server.args.join(" ")}\n`;
    }

    if (config.issues.length > 0) {
      output += "\n  Issues:\n";
      for (const issue of config.issues) {
        const icon = issue.severity === "error" ? "✗" : issue.severity === "warning" ? "⚠" : "ℹ";
        output += `    ${icon} [${issue.server}] ${issue.message}\n`;
        if (issue.fix) output += `      Fix: ${issue.fix}\n`;
      }
    }
    output += "\n";
  }

  if (report.testResults) {
    output += "Server Tests:\n";
    for (const test of report.testResults) {
      const status = test.reachable ? "✓ reachable" : "✗ unreachable";
      output += `  ${test.server}: ${status}`;
      if (test.startupTime) output += ` (${test.startupTime}ms)`;
      if (test.error) output += ` - ${test.error}`;
      output += "\n";
    }
    output += "\n";
  }

  if (report.duplicateServers.length > 0) {
    output += "Duplicate Server Names:\n";
    for (const dup of report.duplicateServers) {
      output += `  ${dup.name}: found in ${dup.locations.length} configs\n`;
      for (const loc of dup.locations) {
        output += `    - ${loc}\n`;
      }
    }
    output += "\n";
  }

  if (report.recommendations.length > 0) {
    output += "Recommendations:\n";
    for (const rec of report.recommendations) {
      output += `  • ${rec}\n`;
    }
  }

  return output;
}
