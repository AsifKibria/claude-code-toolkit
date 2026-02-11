# Claude Code Toolkit

[![npm version](https://img.shields.io/npm/v/@asifkibria/claude-code-toolkit.svg)](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Maintain, optimize, secure, and troubleshoot your Claude Code installation. Fix broken sessions, manage storage, detect secrets, and monitor everything through a web dashboard.

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

## Core Features

### 1. Fix Broken Sessions

When you upload an oversized image/PDF, your entire conversation breaks. This fixes it.

```bash
cct scan        # See what's wrong
cct fix         # Fix it (creates backup automatically)
```

### 2. Web Dashboard

Visual management of your entire Claude Code installation.

```bash
cct dashboard
```

14 tabs: Overview, Storage, Sessions, Security, Traces, MCP, Logs, Config, Snapshots, Analytics, Backups, Context, Maintenance, About

### 3. Security Scanning

Find leaked secrets in your conversations.

```bash
cct security-scan     # Scan all conversations
cct audit abc123      # Full audit trail of session
```

### 4. Storage Management

```bash
cct clean             # Remove debug logs, old snapshots
cct archive --days 60 # Archive old conversations
cct trace clean       # Selective trace cleanup
```

---

## Common Problems & Solutions

### 🚨 Out of Memory / API Error

Uploaded a large image or PDF and now Claude won't respond? The conversation file is too big for the API.

```bash
cct scan                    # Identify oversized content
cct fix                     # Remove problematic content (creates backup)
# Restart Claude Code - you're back
```

### 🔐 Leaked Secrets

Accidentally pasted API keys, passwords, or tokens in chat? Find and audit them before they're exposed.

```bash
cct security-scan           # Scan for AWS keys, tokens, passwords
cct audit abc123            # Full audit trail of what was accessed
```

### 🛑 Broken Sessions

Claude crashed mid-conversation and `--resume` doesn't work? Recover and repair corrupted session files.

```bash
cct sessions                # List all sessions with health status
cct recover abc123          # Diagnose the session
cct recover abc123 --repair # Fix corrupted lines
cct recover abc123 --extract # Extract salvageable content
```

### 💾 Disk Space

Months of conversation history eating up GBs? Clean old traces and archive inactive sessions.

```bash
cct stats                   # See what's using space
cct clean --dry-run         # Preview cleanup
cct clean                   # Remove debug logs, old snapshots
cct archive --days 30       # Archive old conversations
```

### 👁 Privacy / Trace Cleanup

Corporate security requires clearing Claude traces? Full inventory of 18 trace categories with secure wipe.

```bash
cct trace                           # Full inventory of stored data
cct trace clean --days 7            # Remove traces older than 7 days
cct trace wipe --confirm            # Secure wipe everything
cct trace guard --mode paranoid     # Auto-delete going forward
```

### 📦 Backup & Restore

Need to undo a fix or restore a conversation? Automatic backups before every change.

```bash
cct backups                 # List available backups
cct restore /path/to/backup # Restore original
cct cleanup --days 30       # Delete old backups
```

### 📷 Storage Snapshots

Track how Claude's storage grows over time. Compare snapshots to see what changed.

```bash
cct dashboard               # Snapshots tab in web UI
# Or via MCP: snapshot, compare, delete-snapshot actions
```

### 📜 Debug Logs

Something went wrong but you don't know what? Search and filter debug logs by level, component, or text.

```bash
cct dashboard               # Logs tab with search and filtering
# Filter by level (DEBUG, INFO, WARN, ERROR)
# Search by component or message text
```

### 🔌 MCP Servers Not Connecting

MCP servers aren't working? Validate configs and test connectivity.

```bash
cct mcp-validate            # Check all MCP configs
cct mcp-validate --test     # Test actual connectivity
cct dashboard               # MCP tab shows tools/resources per server
```

### 📊 Visual Dashboard

Want a visual overview of everything? 14 tabs for complete management.

```bash
cct dashboard               # Opens web UI at localhost:1405
cct dashboard --port 9000   # Custom port
cct dashboard --daemon      # Run in background
```

### 📤 Export Conversations

Need to export a conversation for backup or sharing?

```bash
cct export -f /path/to/conversation.jsonl
cct export -f conversation.jsonl --format json
```

---

## All Commands

| Command | What it does |
|---------|--------------|
| `cct health` | Quick system health check |
| `cct scan` | Find issues without fixing |
| `cct fix` | Fix issues (with backup) |
| `cct dashboard` | Launch web dashboard |
| `cct stats` | Conversation statistics |
| `cct context` | Token/context usage |
| `cct analytics` | Usage trends and patterns |
| `cct duplicates` | Find duplicate content |
| `cct clean` | Clean .claude directory |
| `cct archive` | Archive old conversations |
| `cct maintenance` | Automated maintenance |
| `cct sessions` | List all sessions |
| `cct recover` | Repair crashed sessions |
| `cct security-scan` | Find leaked secrets |
| `cct audit` | Session audit trail |
| `cct retention` | Apply data retention |
| `cct trace` | Trace inventory |
| `cct trace clean` | Selective cleanup |
| `cct trace wipe` | Secure wipe |
| `cct mcp-validate` | Validate MCP configs |
| `cct backups` | List backups |
| `cct restore` | Restore from backup |
| `cct cleanup` | Delete old backups |
| `cct export` | Export conversation |

## Common Options

| Option | Used with | Description |
|--------|-----------|-------------|
| `--dry-run` | Most commands | Preview without changes |
| `--days N` | clean, archive, retention | Age threshold |
| `-f, --file` | scan, fix, export | Target specific file |
| `--port N` | dashboard | Custom port (default: 1405) |
| `--test` | mcp-validate | Test connectivity |
| `--repair` | recover | Attempt repair |
| `--extract` | recover | Extract content |
| `--confirm` | trace wipe | Required for wipe |

---

## MCP Server Tools

When installed as MCP server, Claude can use these tools directly:

- `health_check` - System health
- `scan_image_issues` / `fix_image_issues` - Content fixes
- `security_scan` / `audit_session` - Security
- `clean_claude_directory` / `clean_traces` - Cleanup
- `list_sessions` / `recover_session` - Session management
- `validate_mcp_config` - MCP validation
- `start_dashboard` - Launch dashboard

---

## How It Works

1. Locates Claude Code data in `~/.claude/projects/`
2. Scans `.jsonl` conversation files
3. Detects oversized content (images >100KB, PDFs, large text)
4. Replaces problematic content with placeholders
5. Creates backups before any modification

---

## Links

- [npm](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
- [GitHub](https://github.com/asifkibria/claude-code-toolkit)
- [Website](https://asifkibria.github.io/claude-code-toolkit)

## License

MIT

---

**Made for the Claude Code community**
