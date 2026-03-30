/**
 * ScriptRunner — Headless game scenario executor
 */

import { GameLoop } from '../../src/ruleset/combat/GameLoop';
import { FileStorageProvider } from '../../src/ruleset/combat/FileStorageProvider';
import { createQuickCharacter } from '../creation';
import { evaluateAssertion, StateAssertion, AssertionResult } from './StateAssertions';
import * as path from 'path';

export interface TestStep {
    input: string;
    assertions?: StateAssertion[];
    description?: string;
    /** If true, allow the step to throw without failing the scenario */
    allowError?: boolean;
}

export interface CharacterSpec {
    name?: string;
    className?: string;
    backgroundName?: string;
    raceName?: string;
    abilities?: Record<string, number>;
}

export interface TestScenario {
    name: string;
    character: CharacterSpec;
    steps: TestStep[];
    /** Mutate state before running steps */
    setup?: (state: any) => void;
}

export interface StepResult {
    stepIndex: number;
    description: string;
    input: string;
    response: string;
    assertions: AssertionResult[];
    error?: string;
}

export interface ScenarioResult {
    name: string;
    passed: boolean;
    stepResults: StepResult[];
    totalAssertions: number;
    passedAssertions: number;
    failedAssertions: number;
    durationMs: number;
    error?: string;
}

export async function runScenario(scenario: TestScenario, projectRoot: string): Promise<ScenarioResult> {
    const start = Date.now();
    const stepResults: StepResult[] = [];
    let totalAssertions = 0;
    let passedAssertions = 0;
    let failedAssertions = 0;

    try {
        // Create character
        const state = createQuickCharacter({
            name: scenario.character.name || 'Test Hero',
            className: scenario.character.className || 'Fighter',
            backgroundName: scenario.character.backgroundName || 'Soldier',
            raceName: scenario.character.raceName || 'Human',
            abilities: scenario.character.abilities,
        });

        // Apply setup mutations
        if (scenario.setup) {
            scenario.setup(state);
        }

        // Initialize GameLoop
        const savesDir = path.join(projectRoot, 'saves', 'harness_temp');
        const storage = new FileStorageProvider();
        const gameLoop = new GameLoop(state, savesDir, storage);
        await gameLoop.initialize();

        // Run steps
        for (let i = 0; i < scenario.steps.length; i++) {
            const step = scenario.steps[i];
            const stepResult: StepResult = {
                stepIndex: i,
                description: step.description || step.input,
                input: step.input,
                response: '',
                assertions: [],
            };

            try {
                stepResult.response = await gameLoop.processTurn(step.input) || '';
            } catch (e) {
                stepResult.error = (e as Error).message;
                if (!step.allowError) {
                    stepResult.response = `ERROR: ${(e as Error).message}`;
                }
            }

            // Evaluate assertions
            if (step.assertions) {
                const currentState = gameLoop.getState();
                for (const assertion of step.assertions) {
                    const result = evaluateAssertion(currentState, assertion);
                    stepResult.assertions.push(result);
                    totalAssertions++;
                    if (result.pass) passedAssertions++;
                    else failedAssertions++;
                }
            }

            stepResults.push(stepResult);

            // Bail early if game is in GAME_OVER
            if (gameLoop.getState().mode === 'GAME_OVER') break;
        }

    } catch (e) {
        return {
            name: scenario.name,
            passed: false,
            stepResults,
            totalAssertions,
            passedAssertions,
            failedAssertions,
            durationMs: Date.now() - start,
            error: (e as Error).message,
        };
    }

    return {
        name: scenario.name,
        passed: failedAssertions === 0,
        stepResults,
        totalAssertions,
        passedAssertions,
        failedAssertions,
        durationMs: Date.now() - start,
    };
}
