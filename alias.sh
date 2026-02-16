#!/bin/bash
# Shell Alias Manager - Convenience wrapper
# Usage: ./alias.sh <command> [args]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
node alias-manager.js "$@"
