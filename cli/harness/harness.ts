/**
 * Test Harness — Runs all scenarios headlessly
 *
 * Run: npx tsx cli/harness/harness.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { runScenario, ScenarioResult } from './ScriptRunner';
import { ALL_SCENARIOS } from './TestScripts';

async function main() {
    console.log('╔════════════════════════════════════╗');
    console.log('║     RPG LORE ENGINE TEST HARNESS   ║');
    console.log('╚════════════════════════════════════╝\n');

    const root = await bootstrapCLI();
    const results: ScenarioResult[] = [];

    for (const scenario of ALL_SCENARIOS) {
        process.stdout.write(`  Running: ${scenario.name}...`);
        const result = await runScenario(scenario, root);
        results.push(result);

        const status = result.passed ? 'PASS' : 'FAIL';
        console.log(` [${status}] (${result.durationMs}ms, ${result.passedAssertions}/${result.totalAssertions} assertions)`);

        if (!result.passed) {
            // Show failed assertions
            for (const step of result.stepResults) {
                for (const assertion of step.assertions) {
                    if (!assertion.pass) {
                        console.log(`    FAIL at step "${step.description}": ${assertion.message}`);
                    }
                }
                if (step.error) {
                    console.log(`    ERROR at step "${step.description}": ${step.error}`);
                }
            }
            if (result.error) {
                console.log(`    SCENARIO ERROR: ${result.error}`);
            }
        }
    }

    // Summary
    const totalPassed = results.filter(r => r.passed).length;
    const totalFailed = results.filter(r => !r.passed).length;
    const totalTime = results.reduce((sum, r) => sum + r.durationMs, 0);
    const totalAssertions = results.reduce((sum, r) => sum + r.totalAssertions, 0);
    const passedAssertions = results.reduce((sum, r) => sum + r.passedAssertions, 0);

    console.log('\n════════════════════════════════════');
    console.log(`  SCENARIOS: ${totalPassed}/${results.length} passed${totalFailed > 0 ? `, ${totalFailed} failed` : ''}`);
    console.log(`  ASSERTIONS: ${passedAssertions}/${totalAssertions} passed`);
    console.log(`  TIME: ${(totalTime / 1000).toFixed(1)}s`);
    console.log('════════════════════════════════════');

    if (totalFailed > 0) process.exit(1);
}

main().catch(e => {
    console.error('Harness crashed:', e);
    process.exit(1);
});
