/**
 * Playwright globalTeardown — auto-generates and opens the HTML QA report
 * after every test run, regardless of how playwright was invoked.
 */
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import type { FullConfig } from '@playwright/test';

export default async function globalTeardown(config: FullConfig) {
  const reporters = config.reporter as Array<[string, Record<string, string>]>;
  const jsonReporter = reporters?.find(([name]) => name === 'json');
  if (!jsonReporter?.[1]?.outputFile) return;

  const resultsFile = jsonReporter[1].outputFile;
  if (!existsSync(resultsFile)) {
    console.log(`\n⚠  No results file found at ${resultsFile} — skipping report.`);
    return;
  }

  // Derive output name: test-results-demoapps/results.json → demoapps-qa-report.html
  const match = resultsFile.match(/test-results-([^/\\]+)[/\\]results\.json/);
  const prefix = match ? match[1] : 'qa';
  const htmlOut = `${prefix}-qa-report.html`;

  try {
    execSync(`python3 scripts/generate_html_report.py "${resultsFile}" --output "${htmlOut}"`, {
      stdio: 'inherit',
    });
    try { execSync(`open "${htmlOut}"`, { stdio: 'ignore' }); } catch {}
    console.log(`\n✓  Report: ${htmlOut}`);
  } catch (e: any) {
    console.error(`\n✗  Report generation failed: ${e.message}`);
  }
}
