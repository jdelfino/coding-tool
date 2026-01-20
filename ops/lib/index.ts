/**
 * Shared utilities for operational scripts
 */

import * as readline from 'readline';

// ============================================================================
// Types
// ============================================================================

export type Environment = 'local' | 'production';

export interface OpsContext {
  env: Environment;
  dryRun: boolean;
  verbose: boolean;
}

export interface ParsedArgs {
  env?: string;
  dryRun: boolean;
  verbose: boolean;
  seed: boolean;
  help: boolean;
  yes: boolean;
  [key: string]: string | boolean | undefined;
}

// ============================================================================
// Argument Parsing
// ============================================================================

export function parseArgs(argv: string[] = process.argv.slice(2)): ParsedArgs {
  const args: ParsedArgs = {
    dryRun: false,
    verbose: false,
    seed: false,
    help: false,
    yes: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--dry-run') {
      args.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      args.verbose = true;
    } else if (arg === '--seed') {
      args.seed = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--env' || arg === '-e') {
      args.env = argv[++i];
    } else if (arg.startsWith('--env=')) {
      args.env = arg.split('=')[1];
    }
  }

  return args;
}

export function validateEnv(env: string | undefined): Environment {
  if (!env) {
    console.error('Error: --env is required. Use --env local or --env production');
    process.exit(1);
  }

  if (env !== 'local' && env !== 'production') {
    console.error(`Error: Invalid environment "${env}". Must be "local" or "production"`);
    process.exit(1);
  }

  return env;
}

// ============================================================================
// Output Helpers
// ============================================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
};

export function log(message: string): void {
  console.log(message);
}

export function logInfo(message: string): void {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

export function logSuccess(message: string): void {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

export function logWarning(message: string): void {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

export function logError(message: string): void {
  console.error(`${colors.red}✗${colors.reset} ${message}`);
}

export function logStep(step: number, total: number, message: string): void {
  console.log(`${colors.cyan}[${step}/${total}]${colors.reset} ${message}`);
}

export function logDryRun(message: string): void {
  console.log(`${colors.magenta}[DRY RUN]${colors.reset} ${message}`);
}

export function logCommand(command: string): void {
  console.log(`${colors.gray}$ ${command}${colors.reset}`);
}

export function logSection(title: string): void {
  console.log(`\n${colors.bold}${title}${colors.reset}`);
  console.log('─'.repeat(title.length));
}

// ============================================================================
// Confirmation
// ============================================================================

export async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}?${colors.reset} ${message} ${colors.gray}(y/N)${colors.reset} `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
    });
  });
}

export async function confirmDestructive(action: string, target: string): Promise<boolean> {
  console.log('');
  console.log(`${colors.red}${colors.bold}⚠️  DESTRUCTIVE OPERATION${colors.reset}`);
  console.log(`${colors.red}Action:${colors.reset} ${action}`);
  console.log(`${colors.red}Target:${colors.reset} ${target}`);
  console.log('');

  return confirm('Are you sure you want to proceed?');
}

// ============================================================================
// Command Execution
// ============================================================================

export async function exec(
  command: string,
  options: { dryRun?: boolean; verbose?: boolean } = {}
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const { dryRun = false, verbose = false } = options;

  if (verbose || dryRun) {
    logCommand(command);
  }

  if (dryRun) {
    return { stdout: '', stderr: '', exitCode: 0 };
  }

  const { spawn } = await import('child_process');

  return new Promise((resolve) => {
    const proc = spawn('sh', ['-c', command], {
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
      if (verbose) {
        process.stdout.write(data);
      }
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
      if (verbose) {
        process.stderr.write(data);
      }
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });
  });
}

// ============================================================================
// Environment Helpers
// ============================================================================

export function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    logError(`Required environment variable ${name} is not set`);
    process.exit(1);
  }
  return value;
}

export function getOptionalEnvVar(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}
