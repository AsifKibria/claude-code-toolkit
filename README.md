# Claude Code Toolkit

[![npm version](https://img.shields.io/npm/v/@asifkibria/claude-code-toolkit.svg)](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
[![npm downloads](https://img.shields.io/npm/dm/@asifkibria/claude-code-toolkit.svg)](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/AsifKibria/claude-code-toolkit?style=social)](https://github.com/AsifKibria/claude-code-toolkit)

**The ultimate maintenance toolkit for Claude Code.** Fix broken sessions, search conversations, detect secrets & PII, manage storage, and monitor everything through a beautiful web dashboard.

> **Love this tool?** Give us a star on GitHub! It helps others discover this project and motivates continued development.
>
> [![Star on GitHub](https://img.shields.io/badge/-Star%20on%20GitHub-yellow?style=for-the-badge&logo=github)](https://github.com/AsifKibria/claude-code-toolkit)

---

## Quick Fix

```bash
# Your session is broken? Fix it in 10 seconds
npx @asifkibria/claude-code-toolkit fix

# Restart Claude Code - you're back
```

## Installation

```bash
# Global install (recommended)
npm install -g @asifkibria/claude-code-toolkit

# Use the short alias everywhere
cct health
cct dashboard
```

### Add as MCP Server

Let Claude maintain itself:

```bash
claude mcp add --scope user toolkit -- npx -y @asifkibria/claude-code-toolkit claude-code-toolkit-server
```

Then ask Claude: "Check your health" or "Fix any issues"

---

## Features Overview

| Category | Features |
|----------|----------|
| **Session Recovery** | Fix broken sessions, repair corrupted files, extract content |
| **Search** | Full-text search across all conversations |
| **Security** | Secret detection, PII scanning, session auditing |
| **Storage** | Analytics, cleanup, archiving, snapshots |
| **Monitoring** | Web dashboard, alerts, quotas, real-time updates |
| **MCP** | Server validation, performance tracking |
| **Git** | Link sessions to branches/commits |
| **Cost** | Token usage and API cost estimation |

---

## Core Features

### 1. Fix Broken Sessions

When you upload an oversized image/PDF, your entire conversation breaks. This fixes it.

```bash
cct scan        # See what's wrong
cct fix         # Fix it (creates backup automatically)
```

### 2. Search All Conversations

Find anything across all your Claude Code conversations - code snippets, discussions, errors, anything.

```bash
cct search "API key"              # Search all conversations
cct search "authentication" --role user    # Only user messages
cct search "error" --limit 100    # More results
```

**Dashboard**: The Search tab provides a visual search interface with filters and highlighted results.

### 3. Web Dashboard

Visual management of your entire Claude Code installation with **15 tabs**:

```bash
cct dashboard
```

- **Overview** - Quick health metrics
- **Search** - Full-text search with filters
- **Storage** - Usage analytics
- **Sessions** - All sessions with health status
- **Security** - Secret & PII scanning
- **Traces** - Data inventory
- **MCP** - Server status & tools
- **Logs** - Debug log viewer
- **Config** - Settings editor
- **Analytics** - Usage trends
- **Backups** - Backup management
- **Context** - Token estimation
- **Maintenance** - Automated cleanup
- **Snapshots** - Storage tracking
- **About** - Version info

### 4. Security Scanning

Find leaked secrets AND personal data (PII) in your conversations.

```bash
cct security-scan     # Scan for secrets (API keys, tokens, passwords)
cct pii-scan          # Scan for PII (emails, phones, SSN, credit cards)
cct pii-scan --details # Show full unmasked values
cct audit abc123      # Full audit trail of session
```

**Dashboard**: Security tab shows secrets and PII with one-click redaction.

### 5. Storage Management

```bash
cct clean             # Remove debug logs, old snapshots
cct archive --days 60 # Archive old conversations
cct trace clean       # Selective trace cleanup
```

### 6. Git Integration

Link your Claude sessions to git branches and commits.

```bash
cct git               # Show sessions linked to git repos
```

### 7. Cost Estimation

Estimate API costs based on token usage.

```bash
cct cost              # Show estimated API costs
```

### 8. Alerts & Quotas

Proactive issue detection and usage monitoring.

```bash
cct alerts            # Check for issues and notifications
cct quotas            # Show usage quotas with visual bars
```

---

## Common Problems & Solutions

### Your session is broken
```bash
cct scan && cct fix
```

### Find something you discussed
```bash
cct search "your query"
```

### Leaked secrets or PII
```bash
cct security-scan
cct pii-scan --details
```

### Disk space issues
```bash
cct stats && cct clean
```

### Session crashed
```bash
cct recover abc123 --repair
```

### MCP not working
```bash
cct mcp-validate --test
```

---

## All Commands

| Command | What it does |
|---------|--------------|
| `cct health` | Quick system health check |
| `cct scan` | Find issues without fixing |
| `cct fix` | Fix issues (with backup) |
| `cct dashboard` | Launch web dashboard |
| `cct search` | **Search all conversations** |
| `cct stats` | Conversation statistics |
| `cct context` | Token/context usage |
| `cct cost` | **API cost estimation** |
| `cct analytics` | Usage trends and patterns |
| `cct duplicates` | Find duplicate content |
| `cct clean` | Clean .claude directory |
| `cct archive` | Archive old conversations |
| `cct maintenance` | Automated maintenance |
| `cct sessions` | List all sessions |
| `cct diff` | **Compare two sessions** |
| `cct recover` | Repair crashed sessions |
| `cct security-scan` | Find leaked secrets |
| `cct pii-scan` | **Find personal data (PII)** |
| `cct audit` | Session audit trail |
| `cct retention` | Apply data retention |
| `cct git` | **Link sessions to git** |
| `cct alerts` | **Check for issues** |
| `cct quotas` | **Show usage quotas** |
| `cct mcp-validate` | Validate MCP configs |
| `cct mcp-perf` | **MCP performance stats** |
| `cct trace` | Trace inventory |
| `cct trace clean` | Selective cleanup |
| `cct trace wipe` | Secure wipe |
| `cct backups` | List backups |
| `cct restore` | Restore from backup |
| `cct cleanup` | Delete old backups |
| `cct export` | Export conversation |

---

## MCP Server Tools

When installed as MCP server, Claude can use these tools directly:

| Tool | Description |
|------|-------------|
| `health_check` | System health |
| `scan_image_issues` / `fix_image_issues` | Content fixes |
| `security_scan` / `scan_pii` | Security scanning |
| `search_conversations` | Full-text search |
| `estimate_cost` | Cost estimation |
| `git_integration` | Git linking |
| `check_alerts` / `check_quotas` | Monitoring |
| `mcp_performance` | MCP stats |
| `audit_session` | Session auditing |
| `clean_claude_directory` / `clean_traces` | Cleanup |
| `list_sessions` / `recover_session` | Session management |
| `validate_mcp_config` | MCP validation |
| `start_dashboard` | Launch dashboard |

---

## How It Works

1. Locates Claude Code data in `~/.claude/projects/`
2. Scans `.jsonl` conversation files
3. Detects oversized content, secrets, PII, and issues
4. Provides fixes with automatic backups
5. Offers visual dashboard for complete management

---

## Support This Project

If Claude Code Toolkit has helped you:

- **Star the repo** - It really helps! [![GitHub stars](https://img.shields.io/github/stars/AsifKibria/claude-code-toolkit?style=social)](https://github.com/AsifKibria/claude-code-toolkit)
- **Share with colleagues** - Help others discover this tool
- **Report bugs** - Open issues on GitHub
- **Contribute** - PRs welcome!

---

## Links

- [npm](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
- [GitHub](https://github.com/AsifKibria/claude-code-toolkit)
- [Issues](https://github.com/AsifKibria/claude-code-toolkit/issues)

## License

MIT

---

**Made for the Claude Code community**
