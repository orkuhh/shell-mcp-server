#!/usr/bin/env node
/**
 * Shell Command MCP Server v1.1
 * 
 * Fixed version with:
 * - Proper MCP stdin parsing
 * - Better timeout handling
 * - Command aliases support
 * - Working directory isolation
 * - Environment variable control
 */

const { spawn, kill } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const config = {
  defaultTimeout: 30000,    // 30 seconds default
  maxTimeout: 120000,      // 2 minutes max
  allowedDirectories: ['/root/.openclaw/workspace'],
  maxOutput: 1024 * 1024,   // 1MB output limit
  aliasesFile: '/root/.openclaw/workspace/.shell-aliases.json',
  historyFile: '/root/.openclaw/workspace/.shell-history.json'
};

// Command history
const commandHistory = [];

// Aliases
const aliases = {};

/**
 * Load aliases from file
 */
function loadAliases() {
  try {
    if (fs.existsSync(config.aliasesFile)) {
      const data = JSON.parse(fs.readFileSync(config.aliasesFile, 'utf8'));
      Object.assign(aliases, data);
    }
  } catch (e) {
    // Ignore alias load errors
  }
}

/**
 * Save aliases to file
 */
function saveAliases() {
  try {
    fs.writeFileSync(config.aliasesFile, JSON.stringify(aliases, null, 2));
  } catch (e) {
    console.error('Failed to save aliases:', e.message);
  }
}

/**
 * Resolve alias or return original command
 */
function resolveCommand(cmd) {
  // Remove leading/trailing whitespace
  const trimmed = cmd.trim();
  
  // Check if it's an alias (starts with alias name followed by space)
  const parts = trimmed.split(/\s+/);
  const potentialAlias = parts[0];
  
  if (aliases[potentialAlias]) {
    const aliasParts = aliases[potentialAlias].split(/\s+/);
    const rest = parts.slice(1);
    return aliasParts.concat(rest).join(' ');
  }
  
  return cmd;
}

/**
 * Execute a shell command safely
 */
function executeCommand(args) {
  return new Promise((resolve) => {
    const {
      command,
      cwd = '/root/.openclaw/workspace',
      env = {},
      timeout = config.defaultTimeout,
      maxOutput = config.maxOutput
    } = args;

    // Resolve alias if present
    const resolvedCmd = resolveCommand(command);

    // Security: Validate working directory
    let resolvedCwd = path.resolve(cwd);
    let isAllowed = config.allowedDirectories.some(dir => 
      resolvedCwd.startsWith(dir)
    );
    
    if (!isAllowed) {
      resolvedCwd = '/root/.openclaw/workspace';
    }

    // Build environment
    const shellEnv = { ...process.env, ...env };
    
    // Execute
    const startTime = Date.now();
    let stdout = '';
    let stderr = '';
    let killed = false;
    let timedOut = false;
    let timeoutId = null;

    const child = spawn(resolvedCmd, {
      shell: '/bin/bash',
      cwd: resolvedCwd,
      env: shellEnv,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // Capture output with limit
    const outputHandler = (data, stream) => {
      const chunk = data.toString();
      const totalLen = stdout.length + stderr.length;
      
      if (totalLen > maxOutput) {
        if (!killed && !timedOut) {
          try {
            child.kill('SIGKILL');
          } catch (e) {
            // Process already ended
          }
          killed = true;
        }
        return;
      }
      
      if (stream === 'stdout') stdout += chunk;
      else stderr += chunk;
    };

    child.stdout.on('data', (d) => outputHandler(d, 'stdout'));
    child.stderr.on('data', (d) => outputHandler(d, 'stderr'));

    // Timeout handling
    const doTimeout = () => {
      if (!killed && !timedOut) {
        timedOut = true;
        try {
          child.kill('SIGKILL');
        } catch (e) {
          // Process already ended
        }
        killed = true;
        stderr += `\n[Command timed out after ${Math.floor(timeout / 1000)}s]`;
      }
    };

    timeoutId = setTimeout(doTimeout, Math.min(timeout, config.maxTimeout));

    child.on('close', (code) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      const duration = Date.now() - startTime;
      
      const result = {
        success: code === 0 || timedOut,
        exitCode: code,
        stdout: stdout.slice(-maxOutput),
        stderr: timedOut ? stderr : stderr.slice(-maxOutput),
        duration,
        cwd: resolvedCwd,
        timedOut,
        originalCommand: command,
        resolvedCommand: resolvedCmd
      };

      // Track in history (only non-timeout commands)
      if (!timedOut) {
        commandHistory.push({
          command: resolvedCmd,
          cwd: resolvedCwd,
          success: code === 0,
          exitCode: code,
          duration,
          timestamp: new Date().toISOString()
        });
      }

      if (code === 0 || timedOut) {
        resolve(result);
      } else {
        resolve(result);
      }
    });

    child.on('error', (err) => {
      if (timeoutId) clearTimeout(timeoutId);
      
      resolve({
        success: false,
        error: err.message,
        cwd: resolvedCwd,
        originalCommand: command,
        resolvedCommand: resolvedCmd
      });
    });
  });
}

/**
 * Get command history
 */
function getHistory(limit = 50) {
  return commandHistory.slice(-limit).reverse();
}

/**
 * Clear history
 */
function clearHistory() {
  commandHistory.length = 0;
  return { cleared: true };
}

/**
 * Save history to file
 */
function saveHistory() {
  try {
    fs.writeFileSync(config.historyFile, JSON.stringify(commandHistory.slice(-1000), null, 2));
  } catch (e) {
    console.error('Failed to save history:', e.message);
  }
}

// Load existing history
try {
  if (fs.existsSync(config.historyFile)) {
    const saved = JSON.parse(fs.readFileSync(config.historyFile, 'utf8'));
    commandHistory.push(...saved);
  }
} catch (e) {
  // Ignore history load errors
}

// Load aliases
loadAliases();

// Save periodically
setInterval(saveHistory, 60000);

// MCP Server Protocol
const PROTOCOL_VERSION = '2024-11-05';

function send(obj) {
  console.log(JSON.stringify(obj));
}

function readStdin() {
  let buffer = '';
  let contentLength = 0;
  let readingBody = false;

  const rl = require('readline').createInterface({
    input: process.stdin
  });

  rl.on('line', (line) => {
    if (!readingBody) {
      // Parse Content-Length header
      const match = line.match(/^Content-Length:\s*(\d+)$/i);
      if (match) {
        contentLength = parseInt(match[1], 10);
      } else if (line.trim() === '') {
        // Empty line signals start of body
        if (contentLength > 0) {
          readingBody = true;
          buffer = '';
        }
      }
    } else {
      buffer += line + '\n';
      if (buffer.length >= contentLength) {
        try {
          const msg = JSON.parse(buffer);
          handleMessage(msg);
        } catch (e) {
          send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
        }
        readingBody = false;
        contentLength = 0;
        buffer = '';
      }
    }
  });
}

function handleMessage(msg) {
  const { id, method, params } = msg || {};

  switch (method) {
    case 'initialize':
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {
            tools: {
              execute: {
                description: 'Execute a shell command',
                inputSchema: {
                  type: 'object',
                  properties: {
                    command: { type: 'string', description: 'Command to execute' },
                    cwd: { type: 'string', description: 'Working directory' },
                    timeout: { type: 'number', description: 'Timeout in ms' },
                    env: { type: 'object', description: 'Environment variables' }
                  },
                  required: ['command']
                }
              },
              history: {
                description: 'Get command execution history',
                inputSchema: {
                  type: 'object',
                  properties: {
                    limit: { type: 'number', description: 'Max entries' }
                  }
                }
              },
              clearHistory: {
                description: 'Clear command history',
                inputSchema: { type: 'object', properties: {} }
              },
              aliases: {
                description: 'List command aliases',
                inputSchema: { type: 'object', properties: {} }
              },
              addAlias: {
                description: 'Add a command alias',
                inputSchema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Alias name' },
                    command: { type: 'string', description: 'Command to alias' }
                  },
                  required: ['name', 'command']
                }
              },
              removeAlias: {
                description: 'Remove a command alias',
                inputSchema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'Alias name' }
                  },
                  required: ['name']
                }
              }
            }
          },
          serverInfo: {
            name: 'shell-mcp-server',
            version: '1.1.0'
          }
        }
      });
      break;

    case 'notifications/initialized':
      // Client ready
      break;

    case 'tools/call':
      const toolName = params?.name;
      const toolArgs = params?.arguments || {};

      switch (toolName) {
        case 'execute':
          executeCommand(toolArgs)
            .then(result => send({
              jsonrpc: '2.0',
              id,
              result: { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
            }))
            .catch(result => send({
              jsonrpc: '2.0',
              id,
              error: { code: -32000, message: result?.error || 'Command failed', data: result }
            }));
          break;

        case 'history':
          send({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(getHistory(toolArgs.limit), null, 2) }] }
          });
          break;

        case 'clearHistory':
          clearHistory();
          send({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify({ cleared: true }) }] }
          });
          break;

        case 'aliases':
          send({
            jsonrpc: '2.0',
            id,
            result: { content: [{ type: 'text', text: JSON.stringify(aliases, null, 2) }] }
          });
          break;

        case 'addAlias':
          if (toolArgs.name && toolArgs.command) {
            aliases[toolArgs.name] = toolArgs.command;
            saveAliases();
            send({
              jsonrpc: '2.0',
              id,
              result: { content: [{ type: 'text', text: JSON.stringify({ added: true, name: toolArgs.name }, null, 2) }] }
            });
          } else {
            send({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Missing required fields: name, command' }
            });
          }
          break;

        case 'removeAlias':
          if (toolArgs.name && aliases[toolArgs.name]) {
            delete aliases[toolArgs.name];
            saveAliases();
            send({
              jsonrpc: '2.0',
              id,
              result: { content: [{ type: 'text', text: JSON.stringify({ removed: true, name: toolArgs.name }, null, 2) }] }
            });
          } else {
            send({
              jsonrpc: '2.0',
              id,
              error: { code: -32602, message: 'Alias not found: ' + toolArgs.name }
            });
          }
          break;

        default:
          send({
            jsonrpc: '2.0',
            id,
            error: { code: -32601, message: `Unknown tool: ${toolName}` }
          });
      }
      break;

    default:
      send({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Unknown method' } });
  }
}

console.error('Shell MCP Server v1.1 starting...');
readStdin();
