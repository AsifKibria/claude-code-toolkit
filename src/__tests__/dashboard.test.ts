import { describe, it, expect, afterAll } from "vitest";
import * as http from "http";
import { createDashboardServer } from "../lib/dashboard.js";
import { generateDashboardHTML } from "../lib/dashboard-ui.js";

function request(server: http.Server, path: string): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === "string") return reject(new Error("Server not listening"));
    const req = http.get({ hostname: "127.0.0.1", port: addr.port, path }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => resolve({ status: res.statusCode || 0, body, headers: res.headers }));
    });
    req.on("error", reject);
  });
}

function postRequest(server: http.Server, path: string, data: Record<string, unknown> = {}): Promise<{ status: number; body: string; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    if (!addr || typeof addr === "string") return reject(new Error("Server not listening"));
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: "127.0.0.1",
      port: addr.port,
      path,
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload) },
    }, (res) => {
      let body = "";
      res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
      res.on("end", () => resolve({ status: res.statusCode || 0, body, headers: res.headers }));
    });
    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

describe("Dashboard", () => {
  let server: http.Server;
  let port: number;

  const startServer = (): Promise<void> => {
    server = createDashboardServer();
    return new Promise((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const addr = server.address();
        if (addr && typeof addr !== "string") port = addr.port;
        resolve();
      });
    });
  };

  afterAll(() => {
    if (server) server.close();
  });

  describe("generateDashboardHTML", () => {
    it("should return valid HTML", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("<title>Claude Code Toolkit</title>");
      expect(html).toContain("</html>");
    });

    it("should include all 10 navigation tabs", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('data-tab="overview"');
      expect(html).toContain('data-tab="storage"');
      expect(html).toContain('data-tab="sessions"');
      expect(html).toContain('data-tab="security"');
      expect(html).toContain('data-tab="traces"');
      expect(html).toContain('data-tab="mcp"');
      expect(html).toContain('data-tab="analytics"');
      expect(html).toContain('data-tab="backups"');
      expect(html).toContain('data-tab="context"');
      expect(html).toContain('data-tab="maintenance"');
    });

    it("should include all 10 section containers", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="sec-overview"');
      expect(html).toContain('id="sec-storage"');
      expect(html).toContain('id="sec-sessions"');
      expect(html).toContain('id="sec-security"');
      expect(html).toContain('id="sec-traces"');
      expect(html).toContain('id="sec-mcp"');
      expect(html).toContain('id="sec-analytics"');
      expect(html).toContain('id="sec-backups"');
      expect(html).toContain('id="sec-context"');
      expect(html).toContain('id="sec-maintenance"');
    });

    it("should include dark and light theme support", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("prefers-color-scheme: light");
    });

    it("should include the esc() sanitization function", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function esc(s)");
      expect(html).toContain("&amp;");
      expect(html).toContain("&lt;");
    });

    it("should include auto-refresh toggle", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("auto-refresh");
    });

    it("should include toast notification system", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function toast(");
    });

    it("should include confirmation modal", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function showModal(");
    });

    it("should include all 10 loader functions", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function loadOverview()");
      expect(html).toContain("function loadStorage()");
      expect(html).toContain("function loadSessions()");
      expect(html).toContain("function loadSecurity()");
      expect(html).toContain("function loadTraces()");
      expect(html).toContain("function loadMcp()");
      expect(html).toContain("function loadAnalytics()");
      expect(html).toContain("function loadBackups()");
      expect(html).toContain("function loadContext()");
      expect(html).toContain("function loadMaintenance()");
    });

    it("should include redact action functions", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function doRedact(");
      expect(html).toContain("function doRedactAll()");
      expect(html).toContain("function doPreviewFinding(");
    });

    it("should include audit action function", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function doAudit(");
    });

    it("should include trace wipe action function", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function doWipeTraces()");
    });

    it("should include MCP test action function", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function doTestMcp()");
    });

    it("should include backup action functions", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function doDeleteBackups()");
      expect(html).toContain("function doRestore(");
    });

    it("should include maintenance and archive action functions", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function doMaintenance()");
      expect(html).toContain("function doArchive()");
    });

    it("should include switchTab function", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function switchTab(");
    });

    it("should include fmtK number formatting", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function fmtK(");
    });

    it("should include ago time formatting", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function ago(");
    });

    it("should include modal HTML support", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="mBodyWrap"');
      expect(html).toContain("isHtml");
    });

    it("should include btn-warn CSS class", () => {
      const html = generateDashboardHTML();
      expect(html).toContain(".btn-warn");
    });

    it("should include modal pre style for previews", () => {
      const html = generateDashboardHTML();
      expect(html).toContain(".modal pre");
    });

    it("should include progress bar element", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="progressBar"');
      expect(html).toContain(".progress-bar");
      expect(html).toContain("progressPulse");
    });

    it("should include action overlay element", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="actionOverlay"');
      expect(html).toContain('id="actionLabel"');
      expect(html).toContain(".action-overlay");
      expect(html).toContain(".action-card");
    });

    it("should include progress helper functions", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function showProgress(");
      expect(html).toContain("function hideProgress()");
      expect(html).toContain("function showResult(");
      expect(html).toContain("function reloadCurrent()");
    });

    it("should include result banner CSS", () => {
      const html = generateDashboardHTML();
      expect(html).toContain(".result-banner");
      expect(html).toContain(".result-icon");
      expect(html).toContain(".result-title");
      expect(html).toContain(".result-details");
      expect(html).toContain(".result-close");
    });

    it("should include nav badge styles", () => {
      const html = generateDashboardHTML();
      expect(html).toContain(".nav-badge");
      expect(html).toContain("nav-badge-red");
      expect(html).toContain("nav-badge-yellow");
    });

    it("should include header health dot", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="headerDot"');
      expect(html).toContain(".header-dot");
    });

    it("should include keyboard shortcut handler", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("addEventListener('keydown'");
      expect(html).toContain("tabOrder");
    });

    it("should include sortable session columns", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function sortSessions(");
      expect(html).toContain("function renderSessionTable(");
      expect(html).toContain(".sort-header");
    });

    it("should include sparkline tooltip", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="sparkTip"');
      expect(html).toContain(".spark-tooltip");
    });

    it("should include staggered card animation", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function staggerCards(");
      expect(html).toContain("cardIn");
      expect(html).toContain(".card.stagger");
    });

    it("should include empty state helper", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function emptyState(");
      expect(html).toContain(".empty-state");
      expect(html).toContain(".es-icon");
    });

    it("should include updateNavBadges function", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("function updateNavBadges(");
    });

    it("should include clickable overview cards", () => {
      const html = generateDashboardHTML();
      expect(html).toContain(".clickable-card");
    });

    it("should include modal close button and click-outside-to-close", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("modal-close");
      expect(html).toContain("if(event.target===this)closeModal()");
      expect(html).toContain('id="mCancel"');
    });

    it("should include keyboard help overlay", () => {
      const html = generateDashboardHTML();
      expect(html).toContain('id="kbdHelp"');
      expect(html).toContain("kbd-help-card");
      expect(html).toContain("Keyboard Shortcuts");
      expect(html).toContain("kbd-key");
    });

    it("should include enhanced modal glassmorphism styles", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("saturate(180%)");
      expect(html).toContain("blur(8px)");
    });

    it("should include mobile responsive styles", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("@media (max-width: 768px)");
      expect(html).toContain("@media (max-width: 480px)");
    });

    it("should include button focus-visible styles", () => {
      const html = generateDashboardHTML();
      expect(html).toContain(".btn:focus-visible");
      expect(html).toContain("outline-offset");
    });

    it("should include severity-based pulse animations", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("dotPulseGreen");
      expect(html).toContain("dotPulseYellow");
      expect(html).toContain("dotPulseRed");
    });

    it("should show audit results in modal popup", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("showModal('Session Audit:");
    });

    it("should show extract results in modal popup", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("showModal('Session Extract:");
    });

    it("should handle audit errors gracefully", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("No Activity Recorded");
      expect(html).toContain("Audit Failed");
    });

    it("should handle extract errors gracefully", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("Empty Session");
      expect(html).toContain("Extract Failed");
    });

    it("should include enhanced table row hover styles", () => {
      const html = generateDashboardHTML();
      expect(html).toContain("table tbody tr:hover");
      expect(html).toContain("border-left-color: var(--accent)");
    });
  });

  describe("HTTP Server - GET Endpoints", () => {
    it("should serve HTML at root", async () => {
      await startServer();
      const res = await request(server, "/");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.body).toContain("<!DOCTYPE html>");
    });

    it("should return 404 for unknown paths", async () => {
      const res = await request(server, "/nonexistent");
      expect(res.status).toBe(404);
    });

    it("should serve overview API", async () => {
      const res = await request(server, "/api/overview");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalConversations");
      expect(data).toHaveProperty("issueCount");
      expect(data).toHaveProperty("backupCount");
      expect(data).toHaveProperty("backupSize");
      expect(data).toHaveProperty("archiveCandidates");
      expect(data).toHaveProperty("maintenanceActions");
    }, 15000);

    it("should serve storage API", async () => {
      const res = await request(server, "/api/storage");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalSize");
      expect(data).toHaveProperty("categories");
    });

    it("should serve sessions API", async () => {
      const res = await request(server, "/api/sessions");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(Array.isArray(data)).toBe(true);
    });

    it("should serve security API", async () => {
      const res = await request(server, "/api/security");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("filesScanned");
      expect(data).toHaveProperty("totalFindings");
    });

    it("should serve compliance API", async () => {
      const res = await request(server, "/api/compliance");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("secretsScan");
      expect(data).toHaveProperty("sessionCount");
      expect(data).toHaveProperty("retentionStatus");
      expect(data).toHaveProperty("generatedAt");
    });

    it("should serve traces API", async () => {
      const res = await request(server, "/api/traces");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalSize");
      expect(data).toHaveProperty("totalFiles");
      expect(data).toHaveProperty("categories");
    });

    it("should serve analytics API", async () => {
      const res = await request(server, "/api/analytics");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalSessions");
      expect(data).toHaveProperty("toolUsage");
      expect(data).toHaveProperty("contextTokens");
      expect(data).toHaveProperty("tokenWarnings");
      expect(data).toHaveProperty("avgTokensPerSession");
    });

    it("should serve duplicates API", async () => {
      const res = await request(server, "/api/duplicates");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalDuplicates");
      expect(data).toHaveProperty("totalWastedSize");
      expect(data).toHaveProperty("groups");
    });

    it("should serve context API", async () => {
      const res = await request(server, "/api/context");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalTokens");
      expect(data).toHaveProperty("totalFiles");
      expect(data).toHaveProperty("warnings");
      expect(data).toHaveProperty("estimates");
      expect(Array.isArray(data.estimates)).toBe(true);
    });

    it("should serve backups API", async () => {
      const res = await request(server, "/api/backups");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalBackups");
      expect(data).toHaveProperty("totalSize");
      expect(data).toHaveProperty("backups");
      expect(Array.isArray(data.backups)).toBe(true);
    });

    it("should serve stats API", async () => {
      const res = await request(server, "/api/stats");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalFiles");
      expect(data).toHaveProperty("totalMessages");
      expect(data).toHaveProperty("totalImages");
      expect(data).toHaveProperty("totalSize");
      expect(data).toHaveProperty("stats");
    });

    it("should serve archive candidates API", async () => {
      const res = await request(server, "/api/archive/candidates");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalCandidates");
      expect(data).toHaveProperty("totalSize");
      expect(data).toHaveProperty("candidates");
      expect(Array.isArray(data.candidates)).toBe(true);
    });

    it("should serve maintenance API", async () => {
      const res = await request(server, "/api/maintenance");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("actions");
      expect(data).toHaveProperty("totalActions");
      expect(data).toHaveProperty("estimatedSpace");
    });

    it("should serve scan API", async () => {
      const res = await request(server, "/api/scan");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalFiles");
      expect(data).toHaveProperty("totalIssues");
      expect(data).toHaveProperty("filesWithIssues");
      expect(data).toHaveProperty("results");
    });

    it("should set no-cache header on API responses", async () => {
      const res = await request(server, "/api/overview");
      expect(res.headers["cache-control"]).toBe("no-cache");
    });

    it("should return 404 for unknown API endpoints", async () => {
      const res = await request(server, "/api/nonexistent");
      expect(res.status).toBe(404);
    });

    it("should return 404 for nonexistent session detail", async () => {
      const res = await request(server, "/api/session/nonexistent-id-12345");
      expect(res.status).toBe(404);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("error");
    });

    it("should return 404 for nonexistent session audit", async () => {
      const res = await request(server, "/api/session/nonexistent-id-12345/audit");
      expect(res.status).toBe(404);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("error");
    });

    it("should return 404 for nonexistent security finding", async () => {
      const res = await request(server, "/api/security/finding/nonexistent-file/999");
      expect(res.status).toBe(404);
    });
  });

  describe("POST Action Endpoints", () => {
    it("should handle clean action with dry run", async () => {
      const res = await postRequest(server, "/api/action/clean", { dryRun: true });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data.dryRun).toBe(true);
    });

    it("should handle fix-all action", async () => {
      const res = await postRequest(server, "/api/action/fix-all");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("fixed");
      expect(data).toHaveProperty("total");
    });

    it("should handle fix action with missing file", async () => {
      const res = await postRequest(server, "/api/action/fix", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("file");
    });

    it("should handle repair action with missing sessionId", async () => {
      const res = await postRequest(server, "/api/action/repair", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("sessionId");
    });

    it("should handle extract action with missing sessionId", async () => {
      const res = await postRequest(server, "/api/action/extract", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("sessionId");
    });

    it("should handle retention action with dry run", async () => {
      const res = await postRequest(server, "/api/action/retention", { dryRun: true, days: 30 });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data.dryRun).toBe(true);
    });

    it("should handle clean-traces action with dry run", async () => {
      const res = await postRequest(server, "/api/action/clean-traces", { dryRun: true });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data.dryRun).toBe(true);
    });

    it("should handle redact action with missing file", async () => {
      const res = await postRequest(server, "/api/action/redact", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("file");
    });

    it("should handle redact action with nonexistent file", async () => {
      const res = await postRequest(server, "/api/action/redact", { file: "/tmp/nonexistent-file.jsonl", line: 1 });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
    });

    it("should handle redact-all action", async () => {
      const res = await postRequest(server, "/api/action/redact-all");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("filesModified");
      expect(data).toHaveProperty("secretsRedacted");
    });

    it("should handle archive action with dry run", async () => {
      const res = await postRequest(server, "/api/action/archive", { dryRun: true });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data.dryRun).toBe(true);
    });

    it("should handle maintenance action as dry run by default", async () => {
      const res = await postRequest(server, "/api/action/maintenance", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("actionsPerformed");
      expect(data.auto).toBe(false);
    });

    it("should handle delete-backups action", async () => {
      const res = await postRequest(server, "/api/action/delete-backups", { days: 9999 });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("success");
      expect(data).toHaveProperty("deleted");
    });

    it("should handle restore action with missing backupPath", async () => {
      const res = await postRequest(server, "/api/action/restore", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("backupPath");
    });

    it("should handle export action with missing file", async () => {
      const res = await postRequest(server, "/api/action/export", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("file");
    });

    it("should handle export action with nonexistent file", async () => {
      const res = await postRequest(server, "/api/action/export", { file: "/tmp/nonexistent-file.jsonl" });
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
    });

    it("should handle wipe-traces action without confirmation", async () => {
      const res = await postRequest(server, "/api/action/wipe-traces", {});
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data.success).toBe(false);
      expect(data.error).toContain("confirm");
    });

    it("should handle test-mcp action", async () => {
      const res = await postRequest(server, "/api/action/test-mcp");
      expect(res.status).toBe(200);
      const data = JSON.parse(res.body);
      expect(data).toHaveProperty("totalServers");
      expect(data).toHaveProperty("healthyServers");
    }, 30000);

    it("should return 404 for unknown POST actions", async () => {
      const res = await postRequest(server, "/api/action/nonexistent");
      expect(res.status).toBe(404);
    });
  });
});
