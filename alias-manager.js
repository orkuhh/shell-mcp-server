#!/usr/bin/env node
/**
 * Shell Alias Manager CLI
 * Manage command aliases for shell-mcp-server
 * 
 * Usage: node alias-manager.js <command> [args]
 * 
 * Commands:
 *   list                  - List all aliases
 *   add <name> <command>  - Add an alias
 *   remove <name>         - Remove an alias
 *   get <name>            - Get alias value
 *   test <name> [args]    - Test an alias with optional args
 */

const fs = require('fs');
const path = require('path');

const ALIASES_FILE = '/root/.openclaw/workspace/.shell-aliases.json';

function loadAliases() {
  try {
    if (fs.existsSync(ALIASES_FILE)) {
      return JSON.parse(fs.readFileSync(ALIASES_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load aliases:', e.message);
  }
  return {};
}

function saveAliases(aliases) {
  fs.writeFileSync(ALIASES_FILE, JSON.stringify(aliases, null, 2));
  console.log('Aliases saved to', ALIASES_FILE);
}

function listAliases(aliases) {
  if (Object.keys(aliases).length === 0) {
    console.log('No aliases defined.');
    return;
  }
  console.log('Defined aliases:');
  console.log('----------------');
  for (const [name, cmd] of Object.entries(aliases)) {
    console.log(`  ${name.padEnd(15)} -> ${cmd}`);
  }
}

function addAlias(aliases, name, command) {
  if (aliases[name]) {
    console.log(`Overwriting existing alias: ${name}`);
  }
  aliases[name] = command;
  saveAliases(aliases);
  console.log(`Added alias: ${name} -> ${command}`);
}

function removeAlias(aliases, name) {
  if (!aliases[name]) {
    console.log(`Alias not found: ${name}`);
    return false;
  }
  const cmd = aliases[name];
  delete aliases[name];
  saveAliases(aliases);
  console.log(`Removed alias: ${name} -> ${cmd}`);
  return true;
}

function getAlias(aliases, name) {
  if (!aliases[name]) {
    console.log(`Alias not found: ${name}`);
    return false;
  }
  console.log(`${name} -> ${aliases[name]}`);
  return true;
}

function resolveAlias(aliases, name, extraArgs = []) {
  if (!aliases[name]) {
    console.log(`Alias not found: ${name}`);
    return false;
  }
  
  const parts = aliases[name].split(/\s+/);
  const resolved = parts.concat(extraArgs).join(' ');
  console.log(`Resolved: ${name} ${extraArgs.join(' ')}`);
  console.log(`Command:  ${resolved}`);
  return true;
}

// CLI
const args = process.argv.slice(2);
const command = args[0]?.toLowerCase();

const aliases = loadAliases();

switch (command) {
  case 'list':
  case 'ls':
    listAliases(aliases);
    break;

  case 'add':
    if (args.length < 3) {
      console.log('Usage: alias-manager.js add <name> <command>');
      console.log('Example: alias-manager.js add gpull "git pull origin main"');
      process.exit(1);
    }
    addAlias(aliases, args[1], args.slice(2).join(' '));
    break;

  case 'remove':
  case 'rm':
  case 'delete':
    if (args.length < 2) {
      console.log('Usage: alias-manager.js remove <name>');
      process.exit(1);
    }
    removeAlias(aliases, args[1]);
    break;

  case 'get':
    if (args.length < 2) {
      console.log('Usage: alias-manager.js get <name>');
      process.exit(1);
    }
    getAlias(aliases, args[1]);
    break;

  case 'test':
    if (args.length < 2) {
      console.log('Usage: alias-manager.js test <name> [extra args...]');
      process.exit(1);
    }
    resolveAlias(aliases, args[1], args.slice(2));
    break;

  case 'help':
  case '--help':
  case '-h':
    console.log('Shell Alias Manager');
    console.log('===================');
    console.log('');
    console.log('Usage: node alias-manager.js <command> [args]');
    console.log('');
    console.log('Commands:');
    console.log('  list                  List all aliases');
    console.log('  add <name> <command>  Add a new alias');
    console.log('  remove <name>         Remove an alias');
    console.log('  get <name>            Show alias value');
    console.log('  test <name> [args]    Test alias resolution');
    console.log('');
    console.log('Examples:');
    console.log('  alias-manager.js add gpull "git pull origin main"');
    console.log('  alias-manager.js test gpull');
    console.log('  alias-manager.js add deploy "npm run build && ./deploy.sh"');
    console.log('  alias-manager.js remove deploy');
    break;

  default:
    if (command) {
      console.log(`Unknown command: ${command}`);
      console.log('Run "alias-manager.js help" for usage');
    } else {
      console.log('Shell Alias Manager');
      console.log('Run "alias-manager.js help" for usage');
    }
}
