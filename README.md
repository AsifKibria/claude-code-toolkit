# Claude Code Toolkit

[![npm version](https://img.shields.io/npm/v/@asifkibria/claude-code-toolkit.svg)](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-70%20passing-brightgreen)](https://github.com/asifkibria/claude-code-toolkit)

A comprehensive MCP server and CLI toolkit for maintaining, optimizing, and troubleshooting your Claude Code installation.

## The Problem This Solves

When you upload an oversized image, PDF, or document to Claude Code, it gets base64-encoded into your conversation history. That corrupted data then gets sent with **every future request**, causing API errors like:

- `API Error: 400 - image dimensions exceed max allowed size`
- `PDF too large. Try reading the file a different way...`
- Various timeout and context errors

**The worst part?** Nothing works anymore. Not your next message. Not `/compact`. Your entire conversation is bricked.

The "official" fix is to clear your conversation and lose everything. This toolkit offers a better solution.

## What It Fixes

| Content Type | Detection Threshold | Replacement Message |
|-------------|---------------------|---------------------|
| Images | >100KB base64 | `[Image removed - exceeded size limit]` |
| PDFs | >100KB base64 | `[PDF removed - exceeded size limit]` |
| Documents | >100KB base64 | `[Document removed - exceeded size limit]` |
| Large Text | >500KB | `[Large text content removed - exceeded size limit]` |

The toolkit surgically removes only the problematic content while preserving your entire conversation history, tool results, and context.

## Quick Start

### Fix Your Broken Session Right Now

```bash
# Scan for issues
npx @asifkibria/claude-code-toolkit scan

# Fix them (creates backups automatically)
npx @asifkibria/claude-code-toolkit fix
```

Restart Claude Code. You're back.

### Install Globally (Recommended)

```bash
npm install -g @asifkibria/claude-code-toolkit

# Use the short alias
cct health
cct scan
cct fix
```

## Installation Options

### Option 1: MCP Server (Let Claude Maintain Itself)

Add to Claude Code so you can literally ask Claude to check and fix its own issues:

```bash
claude mcp add --scope user toolkit -- npx -y @asifkibria/claude-code-toolkit claude-code-toolkit-server
```

Then just ask Claude:
- "Check your health"
- "Are there any issues with your conversation files?"
- "Fix any problems you find"

### Option 2: CLI Tool

```bash
# Global install
npm install -g @asifkibria/claude-code-toolkit

# Or use npx (no install needed)
npx @asifkibria/claude-code-toolkit <command>
```

### Option 3: From Source

```bash
git clone https://github.com/asifkibria/claude-code-toolkit.git
cd claude-code-toolkit
npm install && npm run build && npm test
```

## CLI Commands

### `cct health` - Quick Health Check

Start here. Shows overall status and recommendations.

```bash
$ cct health

Health Check: ⚠ Issues Found

Conversations: 23
Total size: 156.2 MB
Backups: 5
Oversized content: 3

Largest: -Users-me-projects-myapp/abc123.jsonl
  Size: 45.2 MB

Recommendation: Run 'cct fix' to fix 3 issue(s)
```

### `cct scan` - Scan for Issues (Dry Run)

Shows exactly what's wrong without making changes.

```bash
$ cct scan

Scanning 23 file(s)...

-Users-me-projects-myapp/conversation1.jsonl
  Line 142: 🖼️  image (~2.3 MB)
  Line 856: 📄 pdf (~1.1 MB)

-Users-me-projects-another/conversation2.jsonl
  Line 45: 📎 document (~890 KB)

Found 3 issue(s) in 2 file(s).
Run 'cct fix' to fix them.
```

### `cct fix` - Fix All Issues

Removes problematic content and creates backups.

```bash
$ cct fix

Processing 23 file(s)...

✓ -Users-me-projects-myapp/conversation1.jsonl
  Fixed 2 issue(s)
  Backup: conversation1.jsonl.backup.2024-01-15T10-30-00

✓ -Users-me-projects-another/conversation2.jsonl
  Fixed 1 issue(s)
  Backup: conversation2.jsonl.backup.2024-01-15T10-30-01

✓ Fixed 3 issue(s) in 2 file(s).
Restart Claude Code to apply changes.
```

### `cct stats` - Conversation Statistics

See what's using space and resources.

```bash
$ cct stats --limit 5 --sort size

Conversation Statistics

Total: 23 conversations, 156.2 MB
Messages: 12,456, Images: 89, Documents: 23
Problematic content: 3

Top 5 by size:

-Users-me-projects-myapp/abc123.jsonl
  Size: 45.2 MB, Messages: 2,341
  Images: 34, Documents: 12 (2 oversized)
  Modified: 2024-01-15 10:30:00
...
```

### `cct context` - Estimate Context Size

See how much context/tokens your conversations are using.

### `cct analytics` - Usage Analytics Dashboard

Get a comprehensive view of your Claude Code usage with activity trends, top projects, and tool statistics.

```bash
$ cct analytics

╔══════════════════════════════════════════════════════════════╗
║               USAGE ANALYTICS DASHBOARD                      ║
╚══════════════════════════════════════════════════════════════╝

📊 OVERVIEW
──────────────────────────────────────────────────
  Conversations:    23
  Total Messages:   12,456
  Total Tokens:     ~2,345,678
  Total Size:       156.2 MB
  Active Projects:  8
  Avg Msgs/Conv:    542
  Avg Tokens/Conv:  ~102,000

📈 ACTIVITY (Last 7 days)
──────────────────────────────────────────────────
  Mon │█████████████████████████│ 234
  Tue │████████████████░░░░░░░░░│ 156
  Wed │██████████████████░░░░░░░│ 178
  ...

🏆 TOP PROJECTS (by messages)
──────────────────────────────────────────────────
  -Users-me-myapp         │███████████████│ 2,341
  -Users-me-another-proj  │████████░░░░░░░│ 1,234
  ...

🔧 TOP TOOLS
──────────────────────────────────────────────────
  Read                     1,234 (25%)
  Edit                       987 (20%)
  Bash                       654 (13%)
  ...
```

### `cct duplicates` - Find Duplicate Content

Scan for duplicate conversations and content (images, documents) that waste storage and context.

```bash
$ cct duplicates

╔══════════════════════════════════════════════════════════════╗
║               DUPLICATE DETECTION REPORT                     ║
╚══════════════════════════════════════════════════════════════╝

📊 SUMMARY
──────────────────────────────────────────────────
  Duplicate groups:    5
  Duplicate images:    12
  Duplicate documents: 3
  Wasted space:        45.2 MB

📁 DUPLICATE CONVERSATIONS
──────────────────────────────────────────────────
  [2 copies] Wasted: 12.5 MB
    - -Users-me-myapp/conversation1.jsonl
    - -Users-me-myapp-backup/conversation1.jsonl

🖼️  DUPLICATE CONTENT
──────────────────────────────────────────────────
  🖼️ image [3 copies] ~2.1 MB wasted
    - -Users-me-proj1/conv.jsonl:142
    - -Users-me-proj1/conv.jsonl:856
    ... and 1 more locations

💡 RECOMMENDATIONS
──────────────────────────────────────────────────
  - Review duplicate conversations and consider removing copies
  - Same images appear multiple times in your conversations
```

### `cct archive` - Archive Old Conversations

Move inactive conversations to an archive directory to free up space.

```bash
$ cct archive --days 60 --dry-run

╔══════════════════════════════════════════════════════════════╗
║               CONVERSATION ARCHIVE REPORT                    ║
╚══════════════════════════════════════════════════════════════╝

📊 SUMMARY
──────────────────────────────────────────────────
  Eligible conversations: 8
  Total size:            45.2 MB

📁 ARCHIVE CANDIDATES
──────────────────────────────────────────────────
  ...-Users-me-old-project/abc123.jsonl
    65 days inactive, 234 msgs, 12.5 MB
  ...-Users-me-another-old/def456.jsonl
    45 days inactive, 156 msgs, 8.2 MB
  ...

📋 DRY RUN - No changes made
──────────────────────────────────────────────────
  Would archive: 8 conversations
  Would free:    45.2 MB
  Archive to:    ~/.claude/archive
```

### `cct maintenance` - Scheduled Maintenance

Run automated maintenance checks and actions.

```bash
$ cct maintenance

╔══════════════════════════════════════════════════════════════╗
║               MAINTENANCE REPORT                             ║
╚══════════════════════════════════════════════════════════════╝

📊 STATUS
──────────────────────────────────────────────────
  ⚠ Needs Attention

📋 PENDING ACTIONS (dry run)
──────────────────────────────────────────────────
  🔧 Oversized content detected
     3 item(s) (~2.3 MB)
  🗑️ Backups older than 7 days
     5 item(s) (~89.3 MB)
  📦 Conversations inactive for 60+ days
     8 item(s) (~45.2 MB)

💡 RECOMMENDATIONS
──────────────────────────────────────────────────
  - Run 'cct fix' to remove oversized content
  - Run 'cct cleanup --days 7' to remove old backups
  - Run 'cct archive --days 60' to archive inactive conversations

# Show scheduled maintenance setup
$ cct maintenance --schedule

# Run maintenance automatically
$ cct maintenance --auto
```

```bash
# Summary of all conversations by context size
$ cct context

Context Usage Summary

Total conversations: 23
Combined tokens: ~1,234,567

Top 10 by context size:

-Users-me-projects-myapp/abc123.jsonl
  ~125,000 tokens (456 messages)
  ⚠ Context exceeds 100K tokens - consider archiving older messages

-Users-me-projects-another/def456.jsonl
  ~45,000 tokens (234 messages)
...

# Detailed breakdown for a specific file
$ cct context -f ~/.claude/projects/-Users-me-myapp/conversation.jsonl

Context Size Estimate
────────────────────────────────────────
Total: ~125,000 tokens
Messages: 456

Breakdown:
  User messages:      12,500 tokens
  Assistant messages: 85,000 tokens
  Tool calls:         5,000 tokens
  Tool results:       20,000 tokens
  Images:             2,500 tokens

Largest message: Line 342 (assistant)
  ~8,500 tokens

Warnings:
  ⚠ Context exceeds 100K tokens - consider archiving older messages
```

### `cct backups` - List Backups

See all backup files.

```bash
$ cct backups

Backup Files (5 files, 89.3 MB total)

conversation1.jsonl.backup.2024-01-15T10-30-00
  Size: 23.4 MB, Created: 2024-01-15 10:30:00
...
```

### `cct restore <path>` - Restore from Backup

Undo a fix if needed.

```bash
$ cct restore ~/.claude/projects/-Users-me-myapp/conversation.jsonl.backup.2024-01-15T10-30-00

✓ Restored /Users/me/.claude/projects/-Users-me-myapp/conversation.jsonl
Restart Claude Code to apply changes.
```

### `cct cleanup` - Delete Old Backups

Free up disk space.

```bash
# Preview what would be deleted
$ cct cleanup --days 7 --dry-run

Would delete 3 backup(s):
  conversation1.jsonl.backup.2024-01-01T00-00-00
  conversation2.jsonl.backup.2024-01-02T00-00-00
  conversation3.jsonl.backup.2024-01-03T00-00-00

Run without --dry-run to delete.

# Actually delete them
$ cct cleanup --days 7

✓ Deleted 3 backup(s)
```

### `cct export` - Export Conversation

Export a conversation to markdown or JSON for backup, sharing, or archiving.

```bash
# Export to markdown (default)
$ cct export -f ~/.claude/projects/-Users-me-myapp/conversation.jsonl

✓ Exported 156 messages to conversation.md

# Export to JSON
$ cct export -f conversation.jsonl --format json -o backup.json

✓ Exported 156 messages to backup.json

# Include tool results in export
$ cct export -f conversation.jsonl --with-tools

✓ Exported 156 messages to conversation.md
```

**Export formats:**

- **Markdown**: Human-readable format with headers, code blocks, and tool summaries
- **JSON**: Structured format with full message metadata for programmatic use

## CLI Options Reference

| Option | Description |
|--------|-------------|
| `-f, --file <path>` | Target a specific file instead of all conversations |
| `-o, --output <path>` | For export: output file path |
| `--format <type>` | For export: `markdown` or `json` (default: markdown) |
| `--with-tools` | For export: include tool results in output |
| `-d, --dry-run` | Preview changes without making them |
| `--no-backup` | Skip creating backups when fixing (not recommended) |
| `--days <n>` | For cleanup: delete backups older than n days (default: 7) |
| `--limit <n>` | For stats: limit number of results (default: 10) |
| `--sort <field>` | For stats: sort by `size`, `messages`, `images`, or `modified` |
| `-h, --help` | Show help message |
| `-v, --version` | Show version |

## MCP Server Tools

When installed as an MCP server, these tools are available to Claude:

| Tool | Description |
|------|-------------|
| `health_check` | Quick health check with recommendations |
| `get_conversation_stats` | Detailed statistics about conversations |
| `estimate_context_size` | Estimate token/context usage of conversations |
| `usage_analytics` | Usage analytics dashboard with trends and breakdowns |
| `find_duplicates` | Find duplicate conversations and content |
| `archive_conversations` | Archive old/inactive conversations |
| `run_maintenance` | Run maintenance checks and actions |
| `scan_image_issues` | Scan for oversized content (images, PDFs, documents) |
| `fix_image_issues` | Fix detected issues with automatic backups |
| `export_conversation` | Export conversation to markdown or JSON format |
| `list_backups` | List all backup files |
| `restore_backup` | Restore a conversation from backup |
| `cleanup_backups` | Delete old backups to free space |

## How It Works

1. **Locates** your Claude Code data in `~/.claude/projects/`
2. **Scans** conversation files (`.jsonl`) line by line
3. **Detects** oversized content:
   - Images with base64 data >100KB
   - PDFs with base64 data >100KB
   - Documents with base64 data >100KB
   - Text content >500KB
4. **Reports** findings with file paths, line numbers, and sizes
5. **Fixes** by replacing problematic content with placeholder text
6. **Backs up** original files before any modification

## Common Scenarios

### My Claude Code session is completely broken

```bash
cct scan    # See what's wrong
cct fix     # Fix it
# Restart Claude Code
```

### I want to prevent issues before they happen

```bash
cct health  # Quick check
```

### I accidentally uploaded a huge file

```bash
cct fix -f ~/.claude/projects/path/to/conversation.jsonl
```

### I want to undo a fix

```bash
cct backups                    # Find your backup
cct restore /path/to/backup    # Restore it
```

### My disk is filling up

```bash
cct cleanup --days 30 --dry-run  # Preview
cct cleanup --days 30            # Delete
```

### I want to save or share a conversation

```bash
cct export -f ~/.claude/projects/path/to/conversation.jsonl
# Creates conversation.md in current directory
```

### My conversations are getting slow

```bash
cct context  # See which conversations are using the most tokens
```

### I want to see my usage patterns

```bash
cct analytics  # Full usage dashboard with trends and stats
```

### I have duplicate content wasting space

```bash
cct duplicates  # Find duplicate conversations and content
```

### I want to clean up old conversations

```bash
cct archive --days 60 --dry-run  # Preview what would be archived
cct archive --days 60            # Archive conversations inactive for 60+ days
```

### I want automated maintenance

```bash
cct maintenance              # Check what needs attention
cct maintenance --auto       # Automatically fix issues
cct maintenance --schedule   # Get cron/launchd setup instructions
```

## Development

```bash
npm install        # Install dependencies
npm run build      # Build TypeScript
npm test           # Run tests (70 tests)
npm run dev        # Watch mode
npm run test:coverage  # Coverage report
```

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT - see [LICENSE](LICENSE)

## Links

- [npm package](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
- [GitHub repository](https://github.com/asifkibria/claude-code-toolkit)
- [Original issue #2939](https://github.com/anthropics/claude-code/issues/2939)

---

**Made for the Claude Code community**
