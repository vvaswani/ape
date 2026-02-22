import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const SKIP_DIRS = new Set(["node_modules", ".next", "coverage", ".git"]);
const TYPE_FILE_SUFFIX = `${path.sep}types.ts`;

async function walk(dir, acc) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      await walk(path.join(dir, entry.name), acc);
      continue;
    }

    if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      if (fullPath.endsWith(TYPE_FILE_SUFFIX)) {
        acc.push(fullPath);
      }
    }
  }
}

function stripInlineComment(line) {
  const idx = line.indexOf("//");
  return idx >= 0 ? line.slice(0, idx) : line;
}

function isIgnoredLine(line) {
  const trimmed = line.trim();
  return (
    trimmed.length === 0 ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("*/")
  );
}

function findViolations(content) {
  const lines = content.split(/\r?\n/);
  const violations = [];

  for (let i = 0; i < lines.length; i += 1) {
    const originalLine = lines[i];
    if (isIgnoredLine(originalLine)) {
      continue;
    }

    const line = stripInlineComment(originalLine).trim();
    if (!line.startsWith("export")) {
      continue;
    }

    // Allowed type-only export forms.
    if (/^export\s+type\b/.test(line) || /^export\s+interface\b/.test(line)) {
      continue;
    }

    // Explicit type-only re-exports are allowed.
    if (/^export\s+type\s*\{/.test(line)) {
      continue;
    }

    // Runtime-risk exports in a types.ts file.
    if (
      /^export\s+default\b/.test(line) ||
      /^export\s+(const|let|var|function|async\s+function|class|enum)\b/.test(line) ||
      /^export\s*\{/.test(line)
    ) {
      violations.push({
        line: i + 1,
        snippet: originalLine.trim(),
      });
    }
  }

  return violations;
}

async function main() {
  const files = [];
  await walk(ROOT, files);
  files.sort();

  const allViolations = [];

  for (const file of files) {
    const content = await readFile(file, "utf8");
    const violations = findViolations(content);
    if (violations.length > 0) {
      allViolations.push({
        file: path.relative(ROOT, file),
        violations,
      });
    }
  }

  if (allViolations.length > 0) {
    console.error("types.ts type-only guardrail failed:");
    for (const result of allViolations) {
      console.error(`- ${result.file}`);
      for (const violation of result.violations) {
        console.error(`  line ${violation.line}: ${violation.snippet}`);
      }
    }
    process.exitCode = 1;
    return;
  }

  console.log(`types.ts type-only guardrail passed (${files.length} file(s) checked).`);
}

main().catch((error) => {
  console.error("types.ts type-only guardrail crashed:", error);
  process.exitCode = 1;
});
