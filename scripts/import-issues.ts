#!/usr/bin/env tsx

import { readFileSync } from 'fs';
import { execSync } from 'child_process';

interface Issue {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  issue_type: string;
  created_at: string;
  updated_at: string;
  dependencies?: Array<{
    issue_id: string;
    depends_on_id: string;
    type: string;
  }>;
  notes?: string;
}

function parseJsonl(filePath: string): Issue[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const issues: Issue[] = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const issue = JSON.parse(line);
      issues.push(issue);
    } catch (e) {
      console.error(`Failed to parse line: ${line.substring(0, 100)}...`);
    }
  }

  return issues;
}

function escapeBashArg(str: string): string {
  // Escape for bash - use single quotes and escape any single quotes in the string
  return `'${str.replace(/'/g, "'\\''")}'`;
}

function createIssue(issue: Issue): string | null {
  // Skip non-open issues
  if (issue.status !== 'open') {
    console.log(`Skipping ${issue.id} (status: ${issue.status})`);
    return null;
  }

  console.log(`\nCreating issue: ${issue.title} (${issue.id})`);

  const args: string[] = [
    'bd',
    'create',
    escapeBashArg(issue.title),
    '--type', issue.issue_type || 'task',
    '--priority', issue.priority?.toString() || '2',
    '--description', escapeBashArg(issue.description || ''),
    '--json'
  ];

  // Add notes if present
  if (issue.notes) {
    args.push('--notes', escapeBashArg(issue.notes));
  }

  const command = args.join(' ');
  
  try {
    const result = execSync(command, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
    const newIssue = JSON.parse(result);
    console.log(`  ✓ Created as ${newIssue.id}`);
    return newIssue.id;
  } catch (e: any) {
    console.error(`  ✗ Failed to create: ${e.message}`);
    if (e.stderr) {
      console.error(`  stderr: ${e.stderr}`);
    }
    return null;
  }
}

function main() {
  const filePath = process.argv[2] || '/workspaces/issues.jsonl';
  
  console.log(`Reading issues from: ${filePath}`);
  
  const issues = parseJsonl(filePath);
  console.log(`Found ${issues.length} total issues`);

  const openIssues = issues.filter(i => i.status === 'open');
  console.log(`Found ${openIssues.length} open issues to import\n`);

  const oldToNewIdMap = new Map<string, string>();
  
  // First pass: create all issues
  for (const issue of openIssues) {
    const newId = createIssue(issue);
    if (newId) {
      oldToNewIdMap.set(issue.id, newId);
    }
  }

  console.log(`\n\nImport complete!`);
  console.log(`Successfully created ${oldToNewIdMap.size} issues`);
  
  // Print mapping
  if (oldToNewIdMap.size > 0) {
    console.log(`\nOld ID -> New ID mapping:`);
    for (const [oldId, newId] of oldToNewIdMap.entries()) {
      console.log(`  ${oldId} -> ${newId}`);
    }
  }

  // Note about dependencies
  const issuesWithDeps = openIssues.filter(i => i.dependencies && i.dependencies.length > 0);
  if (issuesWithDeps.length > 0) {
    console.log(`\n⚠️  Note: ${issuesWithDeps.length} issues have dependencies that need to be manually recreated:`);
    for (const issue of issuesWithDeps) {
      const newId = oldToNewIdMap.get(issue.id);
      if (newId) {
        console.log(`\n  ${newId} (was ${issue.id}):`);
        for (const dep of issue.dependencies!) {
          const newDepId = oldToNewIdMap.get(dep.depends_on_id);
          if (newDepId) {
            console.log(`    bd dep add ${newId} ${newDepId}  # ${dep.type}`);
          } else {
            console.log(`    # Dependency ${dep.depends_on_id} was not imported (not open)`);
          }
        }
      }
    }
  }
}

main();
