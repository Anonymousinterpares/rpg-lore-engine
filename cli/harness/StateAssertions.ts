/**
 * StateAssertions — Deep path resolution and assertion evaluation
 */

export interface StateAssertion {
    path: string;          // Dot-separated path: "character.hp.current"
    operator: 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'exists' | 'typeof';
    value?: any;
}

export interface AssertionResult {
    pass: boolean;
    message: string;
    assertion: StateAssertion;
    actual?: any;
}

function resolvePath(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    for (const part of parts) {
        if (current === null || current === undefined) return undefined;
        // Handle array index: "combatants.0.name"
        const idx = parseInt(part);
        if (!isNaN(idx) && Array.isArray(current)) {
            current = current[idx];
        } else {
            current = current[part];
        }
    }
    return current;
}

export function evaluateAssertion(state: any, assertion: StateAssertion): AssertionResult {
    const actual = resolvePath(state, assertion.path);

    switch (assertion.operator) {
        case 'eq':
            return {
                pass: actual === assertion.value,
                message: `${assertion.path} === ${assertion.value} (actual: ${actual})`,
                assertion, actual
            };
        case 'neq':
            return {
                pass: actual !== assertion.value,
                message: `${assertion.path} !== ${assertion.value} (actual: ${actual})`,
                assertion, actual
            };
        case 'gt':
            return {
                pass: actual > assertion.value,
                message: `${assertion.path} > ${assertion.value} (actual: ${actual})`,
                assertion, actual
            };
        case 'lt':
            return {
                pass: actual < assertion.value,
                message: `${assertion.path} < ${assertion.value} (actual: ${actual})`,
                assertion, actual
            };
        case 'gte':
            return {
                pass: actual >= assertion.value,
                message: `${assertion.path} >= ${assertion.value} (actual: ${actual})`,
                assertion, actual
            };
        case 'lte':
            return {
                pass: actual <= assertion.value,
                message: `${assertion.path} <= ${assertion.value} (actual: ${actual})`,
                assertion, actual
            };
        case 'contains':
            return {
                pass: typeof actual === 'string' ? actual.includes(assertion.value) :
                      Array.isArray(actual) ? actual.includes(assertion.value) : false,
                message: `${assertion.path} contains "${assertion.value}" (actual: ${typeof actual === 'string' ? actual.slice(0, 50) : actual})`,
                assertion, actual
            };
        case 'exists':
            return {
                pass: actual !== undefined && actual !== null,
                message: `${assertion.path} exists (actual: ${actual === undefined ? 'undefined' : actual === null ? 'null' : typeof actual})`,
                assertion, actual
            };
        case 'typeof':
            return {
                pass: typeof actual === assertion.value,
                message: `typeof ${assertion.path} === "${assertion.value}" (actual: ${typeof actual})`,
                assertion, actual
            };
        default:
            return {
                pass: false,
                message: `Unknown operator: ${assertion.operator}`,
                assertion, actual
            };
    }
}
