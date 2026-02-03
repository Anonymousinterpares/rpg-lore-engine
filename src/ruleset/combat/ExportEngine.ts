import { FullSaveState } from '../schemas/FullSaveStateSchema';

export class ExportEngine {
    /**
     * Exports the character's chronicle (biography) as a Markdown string.
     */
    public static exportChronicle(state: FullSaveState): string {
        const pc = state.character;
        let md = `# Chronicle of ${pc.name}\n\n`;
        md += `**Race:** ${pc.race} | **Class:** ${pc.class} | **Level:** ${pc.level}\n\n`;
        md += `## Journey History\n\n`;

        if (!pc.biography.chronicles || pc.biography.chronicles.length === 0) {
            md += `*No history recorded yet.*\n`;
        } else {
            pc.biography.chronicles.forEach(entry => {
                md += `### Turn ${entry.turn}\n${entry.event}\n\n`;
            });
        }

        return md;
    }

    /**
     * Exports a classic-style D&D character sheet as a Markdown string.
     */
    public static exportCharacterSheet(state: FullSaveState): string {
        const pc = state.character;
        let md = `# ${pc.name}\n`;
        md += `Level ${pc.level} ${pc.race} ${pc.class}\n\n`;

        md += `## Ability Scores\n`;
        Object.entries(pc.stats).forEach(([stat, val]) => {
            const mod = Math.floor((val - 10) / 2);
            md += `- **${stat}:** ${val} (${mod >= 0 ? '+' : ''}${mod})\n`;
        });
        md += `\n`;

        md += `## Combat Stats\n`;
        md += `- **HP:** ${pc.hp.current}/${pc.hp.max}${pc.hp.temp > 0 ? ` (+${pc.hp.temp} Temp)` : ''}\n`;
        md += `- **AC:** ${pc.ac}\n`;
        md += `- **XP:** ${pc.xp}\n\n`;

        md += `## Proficiencies\n`;
        md += `**Skills:** ${pc.skillProficiencies.join(', ')}\n`;
        md += `**Saving Throws:** ${pc.savingThrowProficiencies.join(', ')}\n\n`;

        md += `## Equipment\n`;
        pc.inventory.items.forEach(item => {
            md += `- ${item.name} (x${item.quantity}) ${item.equipped ? '[Equipped]' : ''}\n`;
        });
        md += `\n**Gold:** ${pc.inventory.gold.gp} gp, ${pc.inventory.gold.sp} sp, ${pc.inventory.gold.cp} cp\n\n`;

        md += `## Active Quests\n`;
        state.activeQuests.forEach(q => {
            md += `### ${q.title}\n${q.description}\n`;
            q.objectives.forEach(obj => {
                md += `- [${obj.isCompleted ? 'x' : ' '}] ${obj.description} (${obj.currentProgress}/${obj.maxProgress})\n`;
            });
            md += `\n`;
        });

        return md;
    }
}
