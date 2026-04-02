import { bootstrapCLI } from "../bootstrap";
import { createQuickCharacter } from "../creation";
import { LevelingEngine } from "../../src/ruleset/combat/LevelingEngine";
async function main() {
    await bootstrapCLI();
    const s = createQuickCharacter({ name: "JumpTest" });
    const pc = s.character;
    pc.xp = 6500;
    console.log("Before: level=" + pc.level + " SP=" + JSON.stringify((pc as any).skillPoints));
    const msgs: string[] = [];
    while (LevelingEngine.canLevelUp(pc)) { msgs.push(LevelingEngine.levelUp(pc)); }
    console.log("After: level=" + pc.level + " SP=" + JSON.stringify((pc as any).skillPoints));
    msgs.forEach(m => console.log("  " + m));
    console.log("ASI pending:", (pc as any)._pendingASI);
}
main();
