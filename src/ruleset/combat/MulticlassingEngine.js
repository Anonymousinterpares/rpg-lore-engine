export class MulticlassingEngine {
    static PREREQS = [
        { class: 'Barbarian', ability: 'STR' },
        { class: 'Bard', ability: 'CHA' },
        { class: 'Cleric', ability: 'WIS' },
        { class: 'Druid', ability: 'WIS' },
        { class: 'Fighter', ability: ['STR', 'DEX'] }, // Either STR or DEX
        { class: 'Monk', ability: ['DEX', 'WIS'] }, // Both DEX and WIS
        { class: 'Paladin', ability: ['STR', 'CHA'] }, // Both STR and CHA
        { class: 'Ranger', ability: ['DEX', 'WIS'] }, // Both DEX and WIS
        { class: 'Rogue', ability: 'DEX' },
        { class: 'Sorcerer', ability: 'CHA' },
        { class: 'Warlock', ability: 'CHA' },
        { class: 'Wizard', ability: 'INT' }
    ];
    /**
     * Checks if a character meets the prerequisites to multiclass into a new class.
     * Also checks prerequisites for their CURRENT class (required to leave it).
     */
    static canMulticlass(pc, targetClass) {
        // 1. Check current class requirements
        const currentPrereq = this.PREREQS.find(p => p.class === pc.class);
        if (currentPrereq && !this.checkPrereq(pc, currentPrereq)) {
            return { success: false, message: `You need a score of 13 in ${this.getPrereqLabel(currentPrereq)} to multiclass out of ${pc.class}.` };
        }
        // 2. Check target class requirements
        const targetPrereq = this.PREREQS.find(p => p.class === targetClass);
        if (targetPrereq && !this.checkPrereq(pc, targetPrereq)) {
            return { success: false, message: `You need a score of 13 in ${this.getPrereqLabel(targetPrereq)} to multiclass into ${targetClass}.` };
        }
        return { success: true, message: `You meet the prerequisites for ${targetClass}.` };
    }
    static checkPrereq(pc, prereq) {
        const stats = pc.stats;
        if (Array.isArray(prereq.ability)) {
            if (prereq.class === 'Fighter') {
                return (stats['STR'] || 0) >= 13 || (stats['DEX'] || 0) >= 13; // Fighter is OR
            }
            return prereq.ability.every(a => (stats[a] || 0) >= 13); // Others are AND
        }
        return (stats[prereq.ability] || 0) >= 13;
    }
    static getPrereqLabel(prereq) {
        if (Array.isArray(prereq.ability)) {
            const joiner = prereq.class === 'Fighter' ? ' or ' : ' and ';
            return prereq.ability.join(joiner);
        }
        return prereq.ability;
    }
}
