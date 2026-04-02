import { bootstrapCLI } from "../bootstrap";
import { createQuickCharacter } from "../creation";
import { LevelingEngine } from "../../src/ruleset/combat/LevelingEngine";
import { DataManager } from "../../src/ruleset/data/DataManager";
async function main() {
    await bootstrapCLI();
    const s = createQuickCharacter({ name: "WizTest", className: "Wizard" });
    const pc = s.character;
    console.log("Class:", pc.class);
    console.log("SP before:", JSON.stringify((pc as any).skillPoints));
    const cd = DataManager.getClass(pc.class);
    console.log("ClassData:", !!cd, "SPP:", (cd as any)?.skillPointsPerLevel);
    pc.xp = 300;
    const r = LevelingEngine.levelUp(pc);
    console.log("Result:", r);
    console.log("SP after:", JSON.stringify((pc as any).skillPoints));
}
main().catch(console.error);
