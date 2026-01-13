#!/usr/bin/env npx ts-node

/**
 * Test script to validate @vercel/sandbox SDK behavior
 *
 * Prerequisites:
 * 1. Link project: npx vercel link --token=YOUR_TOKEN
 * 2. Pull OIDC token: npx vercel env pull
 *    (Token expires after 12 hours, re-run env pull to refresh)
 *
 * Usage:
 *   source .env.local && npx ts-node scripts/test-vercel-sandbox.ts
 *
 * Alternative (explicit credentials):
 *   VERCEL_TOKEN=x VERCEL_TEAM_ID=y VERCEL_PROJECT_ID=z npx ts-node scripts/test-vercel-sandbox.ts
 */

import { Sandbox, Command, CommandFinished } from '@vercel/sandbox';

interface TimingResult {
  operation: string;
  durationMs: number;
  success: boolean;
  details?: string;
}

const timings: TimingResult[] = [];

async function timeOperation<T>(
  operation: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    timings.push({
      operation,
      durationMs: Math.round(duration),
      success: true,
    });
    console.log(`✓ ${operation}: ${Math.round(duration)}ms`);
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    const message = error instanceof Error ? error.message : String(error);
    timings.push({
      operation,
      durationMs: Math.round(duration),
      success: false,
      details: message,
    });
    console.error(`✗ ${operation}: ${Math.round(duration)}ms - ${message}`);
    throw error;
  }
}

async function main() {
  console.log('=== Vercel Sandbox SDK Validation ===\n');

  // Authentication priority:
  // 1. OIDC token (from `vercel env pull` or Vercel runtime) - preferred
  // 2. Explicit credentials (fallback for CI/testing)
  let credentials: { token: string; teamId: string; projectId: string } | undefined;

  if (process.env.VERCEL_OIDC_TOKEN) {
    // SDK will handle OIDC token automatically
    console.log('Auth method: OIDC token (from vercel env pull)\n');
  } else if (process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID) {
    credentials = {
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_TEAM_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
    };
    console.log('Auth method: Explicit credentials\n');
  } else {
    console.error('Missing credentials. Run:');
    console.error('  npx vercel env pull   # Downloads OIDC token to .env.local');
    console.error('  source .env.local && npx ts-node scripts/test-vercel-sandbox.ts');
    console.error('\nOr set VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID');
    process.exit(1);
  }

  let sandbox: Sandbox | null = null;
  let sandboxId: string | null = null;

  try {
    // Test 1: Create sandbox
    console.log('--- Test 1: Sandbox Creation ---');
    sandbox = await timeOperation('Create sandbox (python3.13)', async () => {
      return Sandbox.create({
        runtime: 'python3.13',
        timeout: 5 * 60 * 1000, // 5 minutes
        ...credentials, // Pass explicit credentials if available
      });
    });

    sandboxId = sandbox.sandboxId;
    console.log(`  Sandbox ID: ${sandboxId}`);
    console.log(`  Status: ${sandbox.status}`);
    console.log(`  Timeout: ${sandbox.timeout}ms`);
    console.log(`  Created at: ${sandbox.createdAt}`);

    // Test 2: Write file
    console.log('\n--- Test 2: File Operations ---');
    const pythonCode = `
print("Hello from Vercel Sandbox!")
import sys
print(f"Python version: {sys.version}")
x = 5 + 3
print(f"5 + 3 = {x}")
`.trim();

    await timeOperation('Write Python file', async () => {
      await sandbox!.writeFiles([
        { path: 'test.py', content: Buffer.from(pythonCode) },
      ]);
    });

    // Test 3: Run command
    console.log('\n--- Test 3: Command Execution ---');
    const result = await timeOperation('Execute Python script', async () => {
      return sandbox!.runCommand({
        cmd: 'python3',
        args: ['test.py'],
        cwd: '/vercel/sandbox',
      });
    });

    console.log(`  Exit code: ${result.exitCode}`);
    const stdout = await result.stdout();
    const stderr = await result.stderr();
    console.log(`  Stdout: ${stdout.trim()}`);
    if (stderr) console.log(`  Stderr: ${stderr.trim()}`);

    // Test 4: Reconnection
    console.log('\n--- Test 4: Reconnection ---');
    const reconnected = await timeOperation('Reconnect to sandbox', async () => {
      return Sandbox.get({ sandboxId: sandboxId!, ...credentials });
    });

    console.log(`  Reconnected status: ${reconnected.status}`);

    // Test 5: Run another command after reconnection
    const result2 = await timeOperation('Execute after reconnect', async () => {
      return reconnected.runCommand({
        cmd: 'python3',
        args: ['-c', 'print("Reconnection works!")'],
      });
    });
    console.log(`  Output: ${(await result2.stdout()).trim()}`);

    // Test 6: Test stdin via file
    console.log('\n--- Test 5: Stdin via File ---');
    const stdinCode = `
import sys
data = open('/tmp/stdin.txt').read()
print(f"Read from stdin file: {data}")
`.trim();

    await sandbox.writeFiles([
      { path: 'stdin_test.py', content: Buffer.from(stdinCode) },
      { path: '/tmp/stdin.txt', content: Buffer.from('Hello from stdin!') },
    ]);

    const stdinResult = await timeOperation('Execute with stdin file', async () => {
      return sandbox!.runCommand({
        cmd: 'python3',
        args: ['stdin_test.py'],
        cwd: '/vercel/sandbox',
      });
    });
    console.log(`  Output: ${(await stdinResult.stdout()).trim()}`);

    // Test 7: Error handling
    console.log('\n--- Test 6: Error Handling ---');
    try {
      await timeOperation('Execute non-existent command', async () => {
        return sandbox!.runCommand({
          cmd: 'nonexistent_command_xyz',
          args: [],
        });
      });
    } catch (error) {
      console.log(`  Expected error caught: ${error instanceof Error ? error.constructor.name : 'unknown'}`);
    }

    // Test 8: Timeout behavior (skip actual timeout, just verify extendTimeout exists)
    console.log('\n--- Test 7: Timeout Extension ---');
    await timeOperation('Extend timeout by 1 minute', async () => {
      await sandbox!.extendTimeout(60 * 1000);
    });

    // Test 9: List sandboxes
    console.log('\n--- Test 8: List Sandboxes ---');
    const listResult = await timeOperation('List sandboxes', async () => {
      return Sandbox.list(credentials);
    });
    // SDK returns parsed response, access data property
    const sandboxes = (listResult as unknown as { sandboxes: unknown[] }).sandboxes ?? [];
    console.log(`  Total sandboxes: ${sandboxes.length}`);

  } finally {
    // Cleanup
    if (sandbox) {
      console.log('\n--- Cleanup ---');
      await timeOperation('Stop sandbox', async () => {
        await sandbox!.stop();
      });
    }
  }

  // Summary
  console.log('\n=== Timing Summary ===');
  console.log('Operation                          | Duration | Status');
  console.log('-----------------------------------|----------|--------');
  for (const t of timings) {
    const op = t.operation.padEnd(35);
    const dur = `${t.durationMs}ms`.padStart(8);
    const status = t.success ? '✓' : '✗';
    console.log(`${op} | ${dur} | ${status}`);
    if (!t.success && t.details) {
      console.log(`  └─ ${t.details}`);
    }
  }

  // Key findings for implementation
  console.log('\n=== Key Findings for Implementation ===');
  const createTime = timings.find(t => t.operation.includes('Create'))?.durationMs ?? 0;
  const reconnectTime = timings.find(t => t.operation.includes('Reconnect'))?.durationMs ?? 0;
  const execTime = timings.find(t => t.operation.includes('Execute Python'))?.durationMs ?? 0;

  console.log(`- Sandbox creation: ~${createTime}ms (plan assumed 500ms)`);
  console.log(`- Reconnection: ~${reconnectTime}ms (plan assumed 100-200ms)`);
  console.log(`- Execution: ~${execTime}ms`);
  console.log(`- Plan adjustments needed: ${createTime > 1000 ? 'YES - creation slower than expected' : 'Looks reasonable'}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
