import { bootstrapCLI } from "../bootstrap";
import { createQuickCharacter } from "../creation";
import { LevelingEngine } from "../../src/ruleset/combat/LevelingEngine";
import { VisibilityEngine } from "../../src/ruleset/combat/VisibilityEngine";
import { CombatFactory } from "../../src/ruleset/combat/CombatFactory";
import { CombatResolutionEngine } from "../../src/ruleset/combat/CombatResolutionEngine";
import { DataManager } from "../../src/ruleset/data/DataManager";

let pass = 0, fail = 0;
function assert(c: boolean, l: string) { if (c) { console.log("  [PASS] " + l); pass++; } else { console.log("  [FAIL] " + l); fail++; } }

async function main() {
    await bootstrapCLI();
    console.log("=== Feat, AoE Cover, Darkvision Test ===\n");

    // --- 1. Feat system ---
    console.log("--- 1. Feat system ---");
    const s = createQuickCharacter({ name: "FeatTest" });
    const pc = s.character;
    pc.xp = 2700; // Level 4 threshold
    while (LevelingEngine.canLevelUp(pc)) LevelingEngine.levelUp(pc);
    assert(pc.level === 4, "Level 4 reached");
    assert(LevelingEngine.hasPendingASI(pc), "ASI pending at level 4");

    // Select Alert feat
    const featResult = LevelingEngine.selectFeat(pc, "Alert");
    console.log("  " + featResult);
    assert(featResult.includes("Alert"), "Alert feat acquired");
    assert(pc.feats?.includes("Alert"), "Alert in feats array");
    assert(!LevelingEngine.hasPendingASI(pc), "ASI consumed by feat");

    // Try duplicate
    pc.xp = 6500; // Level 5 — no ASI
    while (LevelingEngine.canLevelUp(pc)) LevelingEngine.levelUp(pc);
    // No pending ASI at level 5
    assert(!LevelingEngine.hasPendingASI(pc), "No ASI at level 5");

    // Tough feat (retroactive HP)
    pc.xp = 34000; // Level 8 (ASI level)
    while (LevelingEngine.canLevelUp(pc)) LevelingEngine.levelUp(pc);
    assert(pc.level === 8, "Level 8");
    const hpBefore = pc.hp.max;
    const toughResult = LevelingEngine.selectFeat(pc, "Tough");
    console.log("  " + toughResult);
    assert(pc.hp.max === hpBefore + 16, "Tough: +16 HP retroactive (2 * 8 levels), got " + (pc.hp.max - hpBefore));

    // Feat list
    const available = LevelingEngine.getAvailableFeats(pc);
    assert(!available.some((f: any) => f.name === "Alert"), "Alert not in available (already taken)");
    assert(!available.some((f: any) => f.name === "Tough"), "Tough not in available (already taken)");
    assert(available.some((f: any) => f.name === "Lucky"), "Lucky still available");

    // --- 2. Cover save bonus ---
    console.log("\n--- 2. Cover save bonus ---");
    // CombatResolutionEngine.resolveSpell now accepts coverSaveBonus
    // Testing: with +5 cover bonus, saves should succeed more often
    // This is statistical — just verify the parameter is accepted
    const fireball = DataManager.getSpell("Fireball");
    if (fireball) {
        const attacker = CombatFactory.fromPlayer(pc);
        const target = CombatFactory.fromPlayer(createQuickCharacter({ name: "Target" }).character);
        // With 0 cover bonus
        const r1 = CombatResolutionEngine.resolveSpell(attacker, target, fireball, 5, 13, 0);
        assert(r1.type === "SAVE_SUCCESS" || r1.type === "SAVE_FAIL", "Spell resolves without cover");
        // With +5 cover bonus
        const r2 = CombatResolutionEngine.resolveSpell(attacker, target, fireball, 5, 13, 5);
        assert(r2.details?.coverBonus === 5, "Cover bonus passed through: " + r2.details?.coverBonus);
    }

    // --- 3. Darkvision in combat ---
    console.log("\n--- 3. Darkvision in combat ---");
    const elfState = createQuickCharacter({ name: "DarkElf" });
    const elfPc = elfState.character;
    (elfPc as any).darkvision = 60;
    const elfCombatant = CombatFactory.fromPlayer(elfPc);
    assert((elfCombatant as any).darkvision === 60, "Elf combatant has darkvision 60");

    // VisibilityEngine: Elf in darkness
    const elfVis = VisibilityEngine.getVisibilityEffect(elfCombatant as any, "Darkness");
    assert(elfVis.disadvantage === true && elfVis.blinded === false, "Elf in dark: disadvantage only");

    // Human in darkness
    const humanCombatant = CombatFactory.fromPlayer(createQuickCharacter({ name: "BlindGuy" }).character);
    const humanVis = VisibilityEngine.getVisibilityEffect(humanCombatant as any, "Darkness");
    assert(humanVis.blinded === true, "Human in dark: blinded");

    // resolveAttack with lighting
    const r = CombatResolutionEngine.resolveAttack(elfCombatant, humanCombatant, [], "1d8", 3, false, false, "Darkness");
    assert(r.type !== undefined, "Attack resolves with darkness lighting");

    console.log("\n=== Results: " + pass + " passed, " + fail + " failed ===");
    process.exit(fail > 0 ? 1 : 0);
}
main().catch(e => { console.error("Fatal:", e); process.exit(1); });

