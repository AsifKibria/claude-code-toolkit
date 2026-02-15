import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execFileSync } from "child_process";
import { listSessions } from "./session-recovery.js";

const CLAUDE_DIR = path.join(os.homedir(), ".claude");
const PROJECTS_DIR = path.join(CLAUDE_DIR, "projects");

export interface GitInfo {
  branch: string;
  commit: string;
  commitMessage: string;
  commitDate: Date;
  remote?: string;
  isDirty: boolean;
  uncommittedChanges: number;
}

export interface SessionGitLink {
  sessionId: string;
  project: string;
  projectPath: string;
  git?: GitInfo;
  sessionCreated: Date;
  sessionModified: Date;
  hasGit: boolean;
}

export interface GitLinkReport {
  sessionsWithGit: number;
  sessionsWithoutGit: number;
  branches: Map<string, number>;
  commits: Map<string, string[]>;
  links: SessionGitLink[];
}

function execGit(args: string[], cwd: string): string | null {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return null;
  }
}

export function getGitInfo(projectPath: string): GitInfo | null {
  if (!fs.existsSync(projectPath)) return null;

  const isGitRepo = execGit(["rev-parse", "--is-inside-work-tree"], projectPath);
  if (isGitRepo !== "true") return null;

  const branch = execGit(["rev-parse", "--abbrev-ref", "HEAD"], projectPath);
  const commit = execGit(["rev-parse", "--short", "HEAD"], projectPath);
  const commitMessage = execGit(["log", "-1", "--format=%s"], projectPath);
  const commitDateStr = execGit(["log", "-1", "--format=%ci"], projectPath);
  const remote = execGit(["remote", "get-url", "origin"], projectPath);
  const status = execGit(["status", "--porcelain"], projectPath);

  if (!branch || !commit) return null;

  return {
    branch,
    commit,
    commitMessage: commitMessage || "",
    commitDate: commitDateStr ? new Date(commitDateStr) : new Date(),
    remote: remote || undefined,
    isDirty: !!status && status.length > 0,
    uncommittedChanges: status ? status.split("\n").filter(Boolean).length : 0,
  };
}

export function linkSessionsToGit(claudeDir?: string): GitLinkReport {
  const sessions = listSessions(claudeDir);
  const report: GitLinkReport = {
    sessionsWithGit: 0,
    sessionsWithoutGit: 0,
    branches: new Map(),
    commits: new Map(),
    links: [],
  };

  for (const session of sessions) {
    const projectPath = session.projectPath || "";
    const gitInfo = projectPath ? getGitInfo(projectPath) : null;

    const link: SessionGitLink = {
      sessionId: session.id,
      project: session.project,
      projectPath,
      git: gitInfo || undefined,
      sessionCreated: session.created,
      sessionModified: session.modified,
      hasGit: !!gitInfo,
    };

    report.links.push(link);

    if (gitInfo) {
      report.sessionsWithGit++;

      const branchCount = report.branches.get(gitInfo.branch) || 0;
      report.branches.set(gitInfo.branch, branchCount + 1);

      const commitSessions = report.commits.get(gitInfo.commit) || [];
      commitSessions.push(session.id);
      report.commits.set(gitInfo.commit, commitSessions);
    } else {
      report.sessionsWithoutGit++;
    }
  }

  return report;
}

export function formatGitLinkReport(report: GitLinkReport): string {
  const lines: string[] = [];

  lines.push("Git Integration Report");
  lines.push("═".repeat(50));
  lines.push("");

  lines.push("Summary:");
  lines.push(`  Sessions with Git: ${report.sessionsWithGit}`);
  lines.push(`  Sessions without Git: ${report.sessionsWithoutGit}`);
  lines.push(`  Unique branches: ${report.branches.size}`);
  lines.push(`  Unique commits: ${report.commits.size}`);
  lines.push("");

  if (report.branches.size > 0) {
    lines.push("Sessions by Branch:");
    const sortedBranches = [...report.branches.entries()].sort((a, b) => b[1] - a[1]);
    for (const [branch, count] of sortedBranches.slice(0, 10)) {
      lines.push(`  ${branch}: ${count} session(s)`);
    }
    lines.push("");
  }

  const linkedSessions = report.links.filter(l => l.hasGit).slice(0, 15);
  if (linkedSessions.length > 0) {
    lines.push("Recent Git-Linked Sessions:");
    for (const link of linkedSessions) {
      lines.push(`  ${link.sessionId.slice(0, 12)} \x1b[36m${link.project}\x1b[0m`);
      if (link.git) {
        lines.push(`    Branch: ${link.git.branch} @ ${link.git.commit}`);
        const msg = link.git.commitMessage.slice(0, 50);
        lines.push(`    Commit: ${msg}${link.git.commitMessage.length > 50 ? "..." : ""}`);
        if (link.git.isDirty) {
          lines.push(`    \x1b[33m⚠ ${link.git.uncommittedChanges} uncommitted changes\x1b[0m`);
        }
      }
    }
    lines.push("");
  }

  const noGitSessions = report.links.filter(l => !l.hasGit).slice(0, 5);
  if (noGitSessions.length > 0) {
    lines.push("Sessions without Git:");
    for (const link of noGitSessions) {
      lines.push(`  ${link.sessionId.slice(0, 12)} ${link.project}`);
    }
    if (report.sessionsWithoutGit > 5) {
      lines.push(`  ... and ${report.sessionsWithoutGit - 5} more`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
