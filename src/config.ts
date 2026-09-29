import path from 'path';
import os from 'os';

// Use user's home directory by default, but allow an isolated config root
// for development/educational replicas so they never touch the production config.
export const USER_HOME = os.homedir();
const CONFIG_ROOT = process.env.RELAYFORGE_CONFIG_DIR || process.env.DC_CONFIG_DIR;
const CONFIG_DIR = CONFIG_ROOT
  ? path.resolve(CONFIG_ROOT)
  : path.join(USER_HOME, '.relayforge');

// Paths relative to the config directory
export const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const TOOL_CALL_FILE = path.join(CONFIG_DIR, 'claude_tool_call.log');
export const TOOL_CALL_FILE_MAX_SIZE = 1024 * 1024 * 10; // 10 MB

export const DEFAULT_COMMAND_TIMEOUT = 1000; // milliseconds
