# Claude Code Toolkit

[![npm version](https://badge.fury.io/js/%40asifkibria%2Fclaude-code-toolkit.svg)](https://www.npmjs.com/package/@asifkibria/claude-code-toolkit)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tests](https://img.shields.io/badge/tests-30%20passing-brightgreen)](https://github.com/asifkibria/claude-code-toolkit)

A comprehensive MCP server and CLI toolkit for maintaining, optimizing, and troubleshooting your Claude Code installation.

## Why This Toolkit?

Claude Code stores conversation history, tool results, and context in local files. Over time, these can:

- **Grow large** - Slowing down startup and responses
- **Contain errors** - Corrupted data blocking API calls
- **Accumulate clutter** - Old backups and orphaned files
- **Become opaque** - Hard to understand what's using space

This toolkit gives you visibility and control over your Claude Code data.

## Features

### Health Monitoring
- Quick health checks with actionable recommendations
- Identify problematic files before they cause issues
- Track conversation sizes and growth

### Conversation Analytics
- View detailed statistics (messages, tool uses, images)
- Find your largest conversations
- Sort by size, activity, or modification date

### Troubleshooting Tools
- **Fix oversized images** - Resolve the infamous "image dimensions exceed max" error ([#2939](https://github.com/anthropics/claude-code/issues/2939))
- **Scan for issues** - Detect problems before they break your workflow
- **Restore from backups** - Recover when things go wrong

### Maintenance Utilities
- Automatic backup creation before changes
- Clean up old backup files
- Free up disk space safely

## Installation

### As MCP Server (Recommended)

Add to Claude Code so you can ask Claude to maintain itself:

```bash
# Using npx (no install needed)
claude mcp add --scope user toolkit -- npx -y @asifkibria/claude-code-toolkit claude-code-toolkit-server

# Or install globally first
npm install -g @asifkibria/claude-code-toolkit
claude mcp add --scope user toolkit -- claude-code-toolkit-server
```

### As CLI Tool

```bash
# Using npx
npx @asifkibria/claude-code-toolkit health

# Or install globally
npm install -g @asifkibria/claude-code-toolkit
claude-code-toolkit health

# Short alias
cct health
```

### From Source

```bash
git clone https://github.com/asifkibria/claude-code-toolkit.git
cd claude-code-toolkit
npm install && npm run build && npm test
```

## Usage

### Inside Claude Code (MCP)

Once installed as an MCP server, just ask Claude:

> "Check my Claude Code health"

> "Show me my conversation statistics"

> "Scan for any issues"

> "Fix the problems you found"

> "Clean up old backups older than 30 days"

### Command Line

```bash
# Quick health check - start here!
cct health

# View conversation statistics
cct stats
cct stats --limit 20 --sort messages

# Scan for issues (dry run)
cct scan

# Fix all detected issues
cct fix

# Fix specific file
cct fix -f ~/.claude/projects/myproject/conversation.jsonl

# Manage backups
cct backups
cct restore /path/to/backup.jsonl.backup.2024-01-01T00-00-00
cct cleanup --days 30 --dry-run
cct cleanup --days 30
```

## Tool Reference

### MCP Tools

| Tool                     | Description                                      |
| ------------------------ | ------------------------------------------------ |
| `health_check`           | Quick health check with recommendations          |
| `get_conversation_stats` | Detailed statistics about all conversations      |
| `scan_image_issues`      | Scan for oversized images and other issues       |
| `fix_image_issues`       | Fix detected issues (creates backups)            |
| `list_backups`           | List all backup files with sizes and dates       |
| `restore_backup`         | Restore a conversation from backup               |
| `cleanup_backups`        | Delete old backup files to free space            |

### CLI Commands

| Command          | Description                      |
| ---------------- | -------------------------------- |
| `health`         | Quick health check               |
| `stats`          | Show conversation statistics     |
| `scan`           | Scan for issues (dry run)        |
| `fix`            | Fix all detected issues          |
| `backups`        | List backup files                |
| `restore <path>` | Restore from backup              |
| `cleanup`        | Delete old backups               |

### CLI Options

| Option              | Description                                    |
| ------------------- | ---------------------------------------------- |
| `-f, --file <path>` | Target specific file                           |
| `-d, --dry-run`     | Preview without making changes                 |
| `--no-backup`       | Skip creating backups (not recommended)        |
| `--days <n>`        | For cleanup: delete backups older than n days  |
| `--limit <n>`       | For stats: limit number of results             |
| `--sort <field>`    | For stats: size, messages, images, or modified |
| `-h, --help`        | Show help                                      |
| `-v, --version`     | Show version                                   |

## Common Issues This Solves

### "Image dimensions exceed max allowed size"

This error poisons your conversation context, making all subsequent requests fail - even `/compact`. The toolkit detects and fixes these oversized images automatically.

```bash
cct scan   # See what's wrong
cct fix    # Fix it
```

### "My Claude Code is slow to start"

Large conversation files slow everything down. Use stats to find the culprits:

```bash
cct stats --sort size --limit 5
```

### "I accidentally broke something"

Backups are created automatically before any fix. Restore anytime:

```bash
cct backups                    # Find your backup
cct restore /path/to/backup    # Restore it
```

### "My disk is filling up"

Clean up old backups:

```bash
cct cleanup --days 7 --dry-run  # Preview
cct cleanup --days 7            # Delete
```

## How It Works

1. **Scans** `~/.claude/projects/` for conversation files (`.jsonl`)
2. **Analyzes** each message for issues (oversized images, malformed data)
3. **Reports** findings with actionable recommendations
4. **Fixes** issues by replacing problematic content with placeholders
5. **Backs up** original files before any modifications

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests (30 tests)
npm test

# Watch mode for development
npm run dev

# Test coverage
npm run test:coverage
```

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- How to report issues
- How to suggest features
- How to submit pull requests
- Code style and testing requirements

## Roadmap

Future features under consideration:

- [ ] Conversation export (markdown, JSON)
- [ ] Context size estimation
- [ ] Duplicate detection
- [ ] Conversation archiving
- [ ] Usage analytics dashboard
- [ ] Automatic scheduled maintenance

Have an idea? [Open an issue](https://github.com/asifkibria/claude-code-toolkit/issues)!

## License

MIT - see [LICENSE](LICENSE)

## Related Resources

- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Claude Code GitHub Issues](https://github.com/anthropics/claude-code/issues)

---

**Made with care for the Claude Code community**
