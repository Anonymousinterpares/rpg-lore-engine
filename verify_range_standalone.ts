
// Standalone verification for Range Logic

// --- Logic from CombatUtils.ts ---
function parseRange(rangeStr: string): number {
    if (!rangeStr) return 0;
    const lower = rangeStr.toLowerCase();

    if (lower.includes('self')) return 0;
    if (lower.includes('touch')) return 1;

    const match = lower.match(/(\d+)\s*ft/);
    if (match) {
        return Math.ceil(parseInt(match[1]) / 5);
    }

    return 5; // Default fallback for single targets if units missing
}

// --- Logic from CombatGridManager.ts (Approximate Axial Distance) ---
interface Point { q: number; r: number; s: number; }

function getDistance(a: Point, b: Point): number {
    return (Math.abs(a.q - b.q) + Math.abs(a.q + a.r - b.q - b.r) + Math.abs(a.r - b.r)) / 2;
}

// --- Test Execution ---
const testRanges = [
    "120 feet",   // Expected: 24
    "60 ft.",     // Expected: 12
    "Touch",      // Expected: 1
    "Self",       // Expected: 0
    "Range: 150/600", // Expected: 30 (matches 150)
    "30"          // Expected: 5 (Fallback)
];

console.log("--- Range Parsing Results ---");
testRanges.forEach(r => {
    const res = parseRange(r);
    console.log(`Input: "${r}" => Output: ${res} cells (${res * 5} ft)`);
});

// --- Logic Check ---
// Simulation: Caster at 0,0,0. Target at 5,0,-5 (Distance 5)
const casterPos = { q: 0, r: 0, s: 0 };
const targetPos = { q: 5, r: 0, s: -5 }; // 5 cells away
const dist = getDistance(casterPos, targetPos);

console.log(`\n--- Distance Simulation ---`);
console.log(`Caster at (0,0,0), Target at (5,0,-5). Distance: ${dist}`);

const spellRangeStr = "120 feet";
const rangeCells = parseRange(spellRangeStr);

console.log(`Spell Range: "${spellRangeStr}" => ${rangeCells} cells`);

if (dist <= rangeCells) {
    console.log("PASS: Target is within range.");
} else {
    console.log("FAIL: Target is out of range.");
}

// What if parseRange returns 1?
const faultyRange = parseRange("Touch");
if (dist <= faultyRange) {
    console.log(`Touch Check: Pass`);
} else {
    console.log(`Touch Check: Fail (Expected)`);
}
