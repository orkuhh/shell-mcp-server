# Shell MCP Server

MCP (Model Context Protocol) server for safe shell command execution.

## Features

- 🔒 **Security** - Restricted to workspace directory
- ⏱️ **Timeout enforcement** - Prevents hanging commands
- 📝 **Command history** - Track all executed commands
- 📦 **Environment isolation** - Controlled env vars
- 📊 **Output limits** - Prevent memory issues

## Tools

### execute
Execute a shell command with safety controls.

```json
{
  "command": "ls -la",
  "cwd": "/root/.openclaw/workspace",
  "timeout": 30000,
  "env": { "MY_VAR": "value" }
}
```

Parameters:
- `command` (required) - Command to execute
- `cwd` - Working directory (default: /root/.openclaw/workspace)
- `timeout` - Timeout in ms (default: 30000, max: 120000)
- `env` - Environment variables object

### history
Get command execution history.

```json
{
  "limit": 50
}
```

### clearHistory
Clear command history.

```json
{}
```

## Usage

### Direct
```bash
cd /root/.openclaw/workspace/shell-mcp-server
npm start
```

### With MCP config (mcporter)
```json
{
  "type": "stdio",
  "command": "node",
  "args": ["/root/.openclaw/workspace/shell-mcp-server/index.js"]
}
```

### With Claude Code CLI
```bash
claude --mcp-config shell-mcp-server.json
```

## Install

```bash
cd /root/.openclaw/workspace/shell-mcp-server
npm install
```

## Test

```bash
npm test
```

## Security Notes

- Commands are restricted to `/root/.openclaw/workspace` and subdirectories
- Output is limited to 1MB per command
- Maximum timeout is 2 minutes
- History is saved to `.shell-history.json`
