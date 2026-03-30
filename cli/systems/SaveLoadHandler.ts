/**
 * SaveLoadHandler — Save registry display and management
 */

export function renderSaveRegistry(registry: any): string {
    if (!registry?.slots || registry.slots.length === 0) {
        return '  No saved games found.';
    }

    const lines: string[] = ['  === Saved Games ==='];
    lines.push(`  ${'#'.padStart(3)} ${'Name'.padEnd(30)} ${'Level'.padStart(5)} ${'Class'.padEnd(12)} ${'Last Saved'.padEnd(20)}`);
    lines.push(`  ${'-'.repeat(3)} ${'-'.repeat(30)} ${'-'.repeat(5)} ${'-'.repeat(12)} ${'-'.repeat(20)}`);

    registry.slots.forEach((slot: any, i: number) => {
        const name = (slot.slotName || slot.characterName || 'Unknown').slice(0, 30);
        const level = String(slot.characterLevel || '?');
        const cls = (slot.characterClass || '?').slice(0, 12);
        const date = slot.lastSaved ? new Date(slot.lastSaved).toLocaleString() : '?';
        lines.push(`  ${String(i + 1).padStart(3)} ${name.padEnd(30)} ${level.padStart(5)} ${cls.padEnd(12)} ${date.padEnd(20)}`);
    });

    return lines.join('\n');
}
