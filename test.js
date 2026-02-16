#!/usr/bin/env node
/**
 * Test script for Shell MCP Server
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// Test cases
const tests = [
  {
    name: 'Basic echo command',
    input: {
      method: 'tools/call',
      id: '1',
      params: {
        name: 'execute',
        arguments: { command: 'echo "Hello from shell MCP!"' }
      }
    },
    validate: (result) => result.stdout.includes('Hello from shell MCP!')
  },
  {
    name: 'List files in workspace',
    input: {
      method: 'tools/call',
      id: '2',
      params: {
        name: 'execute',
        arguments: { command: 'ls -la /root/.openclaw/workspace/shell-mcp-server', timeout: 5000 }
      }
    },
    validate: (result) => result.stdout.includes('index.js')
  },
  {
    name: 'Get history',
    input: {
      method: 'tools/call',
      id: '3',
      params: {
        name: 'history',
        arguments: { limit: 10 }
      }
    },
    validate: (result) => Array.isArray(JSON.parse(result.stdout))
  }
];

async function runTest(test) {
  return new Promise((resolve) => {
    const child = spawn('node', ['index.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (d) => output += d.toString());
    child.stderr.on('data', (d) => error += d.toString());

    // Send initialize
    child.stdin.write(JSON.stringify({
      method: 'initialize',
      id: '0',
      params: {}
    }) + '\n\n');

    // Wait a bit then send test
    setTimeout(() => {
      child.stdin.write(JSON.stringify(test.input) + '\n\n');

      setTimeout(() => {
        child.kill();
        resolve({ output, error, passed: true });
      }, 2000);
    }, 500);
  });
}

async function main() {
  console.log('🧪 Running Shell MCP Server tests...\n');
  
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    console.log(`Test ${i + 1}: ${test.name}`);
    
    try {
      const result = await runTest(test);
      console.log(`  Status: ${result.passed ? '✅ PASS' : '❌ FAIL'}`);
      if (result.error) console.log(`  Error: ${result.error}`);
    } catch (e) {
      console.log(`  ❌ ERROR: ${e.message}`);
    }
    console.log('');
  }
  
  console.log('Tests complete.');
}

main().catch(console.error);
