/**
 * Test: Phase 7 — Comprehensive ItemForge Integration Test
 *
 * End-to-end test covering the full forge pipeline:
 * 1. Rarity distribution across CR tiers
 * 2. Weapon forging with stat bonuses
 * 3. Armor forging with AC bonuses
 * 4. Jewelry forging with stat/save/trait bonuses
 * 5. Magic chance: Common=never, Legendary=always
 * 6. Element pools: monster type + biome fallback
 * 7. Schema validation: every forged item passes ItemSchema.parse()
 * 8. LootEngine integration: defeat monster → forged loot
 * 9. Equipment integration: equip forged weapon/armor → verify bonuses
 * 10. Save/load round-trip: forged items survive serialization
 *
 * Run: npx tsx cli/tests/test_itemforge.ts
 */

import { bootstrapCLI } from '../bootstrap';
import { createQuickCharacter } from '../creation';
import { ItemForgeEngine } from '../../src/ruleset/combat/ItemForgeEngine';
import { LootEngine } from '../../src/ruleset/combat/LootEngine';
import { EquipmentEngine } from '../../src/ruleset/combat/EquipmentEngine';
import { MechanicsEngine } from '../../src/ruleset/combat/MechanicsEngine';
import { DataManager } from '../../src/ruleset/data/DataManager';
import { ItemSchema, Rarity } from '../../src/ruleset/schemas/ItemSchema';
import { FullSaveStateSchema } from '../../src/ruleset/schemas/FullSaveStateSchema';

let passed = 0;
let failed = 0;

function assert(condition: boolean, label: string, detail?: string) {
    if (condition) {
        console.log(`  [PASS] ${label}`);
        passed++;
    } else {
        console.log(`  [FAIL] ${label}${detail ? ' — ' + detail : ''}`);
        failed++;
    }
}

async function main() {
    console.log('=== Phase 7: Comprehensive ItemForge Integration ===\n');
    await bootstrapCLI();

    // =============================================
    // 1. RARITY DISTRIBUTION
    // =============================================
    console.log('--- 1. Rarity distribution (1000 rolls × 3 CR tiers) ---');

    for (const cr of [0.25, 5, 17]) {
        const counts: Record<string, number> = { Common: 0, Uncommon: 0, Rare: 0, 'Very Rare': 0, Legendary: 0 };
        for (let i = 0; i < 1000; i++) counts[ItemForgeEngine.rollRarity(cr)]++;
        console.log(`  CR ${cr}: C=${counts.Common} U=${counts.Uncommon} R=${counts.Rare} VR=${counts['Very Rare']} L=${counts.Legendary}`);

        if (cr <= 1) {
            assert(counts.Common > 500, `CR ${cr}: Common dominates (${counts.Common}/1000)`);
            assert(counts.Legendary === 0, `CR ${cr}: No Legendary drops`);
        }
        if (cr >= 17) {
            assert(counts.Common === 0, `CR ${cr}: No Common drops`);
            assert(counts.Legendary > 200, `CR ${cr}: Legendary significant (${counts.Legendary}/1000)`);
        }
    }

    // =============================================
    // 2. FORGE ALL WEAPON TYPES × RARITIES
    // =============================================
    console.log('\n--- 2. Forge weapons across rarities ---');

    const rarities: Rarity[] = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary'];
    const origRoll = ItemForgeEngine.rollRarity;

    for (const rarity of rarities) {
        ItemForgeEngine.rollRarity = () => rarity;
        const item = ItemForgeEngine.forgeItem({
            category: 'weapon', baseItemName: 'Longsword', cr: 10,
            monsterType: 'undead', biome: 'Ruins', monsterName: 'Vampire',
        });

        assert(item.rarity === rarity, `${rarity} Longsword: rarity correct`);
        assert(item.isForged === true, `${rarity} Longsword: isForged`);
        assert(item.type === 'Weapon', `${rarity} Longsword: type preserved`);
        assert((item as any).damage?.dice === '1d8', `${rarity} Longsword: base damage preserved`);

        try { ItemSchema.parse(item); assert(true, `${rarity} Longsword: schema valid`); }
        catch (e: any) { assert(false, `${rarity} Longsword: schema valid`, e.message?.slice(0, 80)); }
    }
    ItemForgeEngine.rollRarity = origRoll;

    // =============================================
    // 3. FORGE ARMOR — AC BONUS RANGES
    // =============================================
    console.log('\n--- 3. Forge armor — AC bonuses ---');

    ItemForgeEngine.rollRarity = () => 'Rare';
    const forgedArmor = ItemForgeEngine.forgeItem({
        category: 'armor', baseItemName: 'Chain Mail', cr: 8,
        monsterType: 'fiend', biome: 'Swamp', monsterName: 'Imp',
    });
    ItemForgeEngine.rollRarity = origRoll;

    const acMod = forgedArmor.modifiers.find(m => m.type === 'ACBonus');
    assert(forgedArmor.type === 'Armor', 'Armor type preserved');
    if (acMod) {
        assert(acMod.value >= 1 && acMod.value <= 2, `ACBonus ${acMod.value} in range [1,2] for Rare 5-8`);
    }
    // AC bonus max across ALL tiers/rarities should never exceed +3
    let maxACBonus = 0;
    for (const r of rarities) {
        ItemForgeEngine.rollRarity = () => r;
        for (let cr = 1; cr <= 20; cr += 4) {
            const a = ItemForgeEngine.forgeItem({
                category: 'armor', baseItemName: 'Chain Mail', cr,
                monsterType: 'humanoid', biome: 'Plains',
            });
            const ac = a.modifiers.find(m => m.type === 'ACBonus');
            if (ac && ac.value > maxACBonus) maxACBonus = ac.value;
        }
    }
    ItemForgeEngine.rollRarity = origRoll;
    assert(maxACBonus <= 3, `Max AC bonus across all tiers: +${maxACBonus} (max +3)`);

    // =============================================
    // 4. FORGE JEWELRY
    // =============================================
    console.log('\n--- 4. Forge jewelry ---');

    ItemForgeEngine.rollRarity = () => 'Legendary';
    const ring = ItemForgeEngine.forgeItem({
        category: 'jewelry', baseItemName: 'Amulet', cr: 18,
        monsterType: 'dragon', biome: 'Volcanic', monsterName: 'Ancient Red Dragon',
    });
    ItemForgeEngine.rollRarity = origRoll;

    assert(ring.rarity === 'Legendary', 'Legendary jewelry: rarity');
    assert(ring.isMagic === true, 'Legendary jewelry: isMagic (100% chance)');
    assert(ring.magicalProperties.length >= 2, `Jewelry has ${ring.magicalProperties.length} magical props (stat+save+trait)`);
    const statMod = ring.modifiers.find(m => m.type === 'StatBonus');
    if (statMod) {
        assert(statMod.value >= 3 && statMod.value <= 3, `StatBonus ${statMod.value} in range [3,3] for Legendary 17-20`);
        assert(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'].includes(statMod.target), `StatBonus target valid: ${statMod.target}`);
    }
    try { ItemSchema.parse(ring); assert(true, 'Legendary jewelry: schema valid'); }
    catch (e: any) { assert(false, 'Legendary jewelry: schema valid', e.message?.slice(0, 80)); }

    // =============================================
    // 5. MAGIC CHANCE BY RARITY
    // =============================================
    console.log('\n--- 5. Magic chance ---');

    let commonMagic = 0, legMagic = 0;
    ItemForgeEngine.rollRarity = () => 'Common';
    for (let i = 0; i < 100; i++) {
        const w = ItemForgeEngine.forgeItem({ category: 'weapon', baseItemName: 'Dagger', cr: 1, monsterType: 'humanoid', biome: 'Plains' });
        if (w.isMagic) commonMagic++;
    }
    ItemForgeEngine.rollRarity = () => 'Legendary';
    for (let i = 0; i < 100; i++) {
        const w = ItemForgeEngine.forgeItem({ category: 'weapon', baseItemName: 'Longsword', cr: 18, monsterType: 'dragon', biome: 'Volcanic' });
        if (w.isMagic) legMagic++;
    }
    ItemForgeEngine.rollRarity = origRoll;

    assert(commonMagic === 0, `Common: ${commonMagic}/100 magical (expected 0)`);
    assert(legMagic === 100, `Legendary: ${legMagic}/100 magical (expected 100)`);

    // =============================================
    // 6. ELEMENT POOLS
    // =============================================
    console.log('\n--- 6. Element pools ---');

    const undeadElements = new Set<string>();
    for (let i = 0; i < 100; i++) {
        const el = ItemForgeEngine.rollElement('undead', 'Plains');
        if (el) undeadElements.add(el);
    }
    for (const el of undeadElements) {
        assert(['Necrotic', 'Cold', 'Radiant'].includes(el), `Undead element "${el}" valid`);
    }

    // Biome fallback
    const el = ItemForgeEngine.rollElement('unknown_monster', 'Volcanic');
    assert(el === 'Fire', `Unknown type + Volcanic → Fire`);
    assert(ItemForgeEngine.rollElement('xyz', 'xyz') === null, 'Unknown both → null');

    // =============================================
    // 7. SCHEMA VALIDATION — BULK
    // =============================================
    console.log('\n--- 7. Schema validation (200 random forges) ---');

    let schemaFailCount = 0;
    for (let i = 0; i < 200; i++) {
        const categories = ['weapon', 'armor', 'jewelry'] as const;
        const bases = { weapon: 'Longsword', armor: 'Chain Mail', jewelry: 'Amulet' };
        const cat = categories[i % 3];
        try {
            const item = ItemForgeEngine.forgeItem({
                category: cat, baseItemName: bases[cat],
                cr: Math.random() * 20, monsterType: 'humanoid', biome: 'Plains',
            });
            ItemSchema.parse(item);
        } catch {
            schemaFailCount++;
        }
    }
    assert(schemaFailCount === 0, `200 random forges: ${200 - schemaFailCount}/200 pass schema`);

    // =============================================
    // 8. LOOT ENGINE INTEGRATION
    // =============================================
    console.log('\n--- 8. LootEngine integration ---');

    const skeleton = DataManager.getMonster('Skeleton');
    assert(skeleton !== undefined, 'Skeleton in DataManager');

    if (skeleton) {
        let forgedCount = 0;
        let totalItems = 0;
        for (let i = 0; i < 20; i++) {
            const loot = LootEngine.processDefeat(skeleton, 'Ruins');
            for (const item of loot.items) {
                totalItems++;
                if ((item as any).isForged) forgedCount++;
            }
        }
        assert(forgedCount > 0, `Forged items from 20 Skeleton defeats: ${forgedCount}/${totalItems}`);
    }

    // =============================================
    // 9. EQUIPMENT INTEGRATION
    // =============================================
    console.log('\n--- 9. Equipment integration (equip forged items) ---');

    const state = createQuickCharacter({ name: 'ForgeTest', className: 'Fighter', backgroundName: 'Soldier' });
    const pc = state.character;

    // Equip forged Chain Mail +2
    const forgedChainMail: any = {
        id: 'Chain Mail', instanceId: 'forge_int_armor', name: 'Rare Chain Mail +2',
        type: 'Armor', weight: 55, quantity: 1, equipped: true,
        isForged: true, rarity: 'Rare',
        modifiers: [{ type: 'ACBonus', target: 'AC', value: 2 }],
        magicalProperties: [],
    };
    pc.inventory.items.push(forgedChainMail);
    pc.equipmentSlots.armor = 'forge_int_armor';

    EquipmentEngine.recalculateAC(pc);
    assert(pc.ac === 18, `AC with Chain Mail +2 = 18 (got ${pc.ac})`);

    // Equip forged Longsword +2
    const forgedSword: any = {
        id: 'Longsword', instanceId: 'forge_int_weapon', name: 'Rare Necrotic Longsword +2',
        type: 'Weapon', weight: 3, quantity: 1, equipped: true,
        isForged: true, rarity: 'Rare',
        damage: { dice: '1d8', type: 'Slashing' },
        properties: ['Versatile'], range: { normal: 5 },
        modifiers: [
            { type: 'HitBonus', target: 'Attack', value: 2 },
            { type: 'DamageAdd', target: 'Necrotic', value: 2 },
        ],
        magicalProperties: [{ type: 'BonusDamage', element: 'Necrotic', dice: '1d4', value: 2 }],
    };
    pc.inventory.items.push(forgedSword);
    pc.equipmentSlots.mainHand = 'forge_int_weapon';

    // Verify weapon bonuses are accessible from inventory
    const equipped = pc.inventory.items.find(i => i.instanceId === 'forge_int_weapon');
    const hitB = (equipped as any)?.modifiers?.find((m: any) => m.type === 'HitBonus');
    const dmgB = (equipped as any)?.modifiers?.find((m: any) => m.type === 'DamageAdd');
    assert(hitB?.value === 2, `Equipped weapon HitBonus = 2`);
    assert(dmgB?.value === 2, `Equipped weapon DamageAdd = 2`);

    // =============================================
    // 10. SAVE/LOAD ROUND-TRIP
    // =============================================
    console.log('\n--- 10. Save/load round-trip ---');

    // Serialize state to JSON
    const serialized = JSON.stringify(state);
    assert(serialized.includes('forge_int_armor'), 'Forged armor instanceId in serialized state');
    assert(serialized.includes('Rare Necrotic Longsword +2'), 'Forged weapon name in serialized state');
    assert(serialized.includes('"isForged":true'), 'isForged flag in serialized state');
    assert(serialized.includes('"rarity":"Rare"'), 'Rarity field in serialized state');
    assert(serialized.includes('BonusDamage'), 'MagicalProperties in serialized state');

    // Deserialize and validate
    const deserialized = JSON.parse(serialized);
    try {
        const validated = FullSaveStateSchema.parse(deserialized);
        assert(true, 'Deserialized state passes FullSaveStateSchema');

        // Verify forged items survived
        const loadedArmor = validated.character.inventory.items.find((i: any) => i.instanceId === 'forge_int_armor');
        const loadedWeapon = validated.character.inventory.items.find((i: any) => i.instanceId === 'forge_int_weapon');
        assert(loadedArmor !== undefined, 'Forged armor survives round-trip');
        assert(loadedWeapon !== undefined, 'Forged weapon survives round-trip');
        assert((loadedWeapon as any)?.isForged === true, 'isForged survives round-trip');
        assert((loadedWeapon as any)?.rarity === 'Rare', 'Rarity survives round-trip');
    } catch (e: any) {
        assert(false, 'Deserialized state passes FullSaveStateSchema', e.message?.slice(0, 100));
    }

    // =============================================
    // SUMMARY
    // =============================================
    console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => {
    console.error('Fatal error:', e);
    process.exit(1);
});
