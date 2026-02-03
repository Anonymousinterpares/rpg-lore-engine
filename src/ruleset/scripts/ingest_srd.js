import * as fs from 'fs';
import * as path from 'path';
const TEMP_DIR = path.resolve(process.cwd(), 'temp_srd');
const DATA_DIR = path.resolve(process.cwd(), 'data');
/**
 * Utility to ensure directory exists
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
/**
 * Normalizes ability score keys
 */
const statMap = {
    strength: 'STR',
    dexterity: 'DEX',
    constitution: 'CON',
    intelligence: 'INT',
    wisdom: 'WIS',
    charisma: 'CHA'
};
/**
 * Ingest Monsters
 */
function ingestMonsters() {
    console.log('Ingesting Monsters...');
    const raw = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'monsters.json'), 'utf-8'));
    ensureDir(path.join(DATA_DIR, 'monster'));
    raw.forEach((m) => {
        const stats = {};
        Object.entries(statMap).forEach(([full, short]) => {
            stats[short] = m[full];
        });
        const monster = {
            name: m.name,
            cr: m.challenge_rating,
            size: m.size,
            type: m.type,
            alignment: m.alignment,
            ac: m.armor_class,
            hp: {
                average: m.hit_points,
                formula: m.hit_dice // 5eapi uses hit_dice for formula
            },
            speed: Object.entries(m.speed || {}).map(([type, val]) => `${type}: ${val}`).join(', '),
            stats: stats,
            traits: (m.special_abilities || []).map((a) => ({
                name: a.name,
                description: a.desc
            })),
            actions: (m.actions || []).map((a) => ({
                name: a.name,
                description: a.desc,
                attackBonus: a.attack_bonus
            })),
            legendaryActions: (m.legendary_actions || []).map((a) => ({
                name: a.name,
                description: a.desc
            }))
        };
        const safeName = m.name.replace(/[^a-z0-9]/gi, '_');
        fs.writeFileSync(path.join(DATA_DIR, 'monster', `${safeName}.json`), JSON.stringify(monster, null, 2));
    });
}
/**
 * Ingest Equipment (Items)
 */
function ingestItems() {
    console.log('Ingesting Equipment...');
    const raw = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'equipment.json'), 'utf-8'));
    ensureDir(path.join(DATA_DIR, 'item'));
    raw.forEach((item) => {
        const cost = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
        if (item.cost) {
            cost[item.cost.unit.toLowerCase()] = item.cost.quantity;
        }
        const mapped = {
            name: item.name,
            type: item.equipment_category === 'Weapon' ? 'Weapon' :
                item.equipment_category === 'Armor' ? 'Armor' :
                    'Adventuring Gear',
            cost: cost,
            weight: item.weight || 0,
            description: item.desc ? item.desc.join('\n') : undefined
        };
        if (mapped.type === 'Weapon' && item.damage) {
            mapped.damage = {
                dice: item.damage.damage_dice,
                type: item.damage.damage_type.name
            };
            mapped.properties = (item.properties || []).map((p) => p.name);
        }
        if (mapped.type === 'Armor') {
            mapped.acCalculated = item.armor_class ? `${item.armor_class.base}` : "10";
            mapped.stealthDisadvantage = item.stealth_disadvantage || false;
        }
        const safeName = item.name.replace(/[^a-z0-9]/gi, '_');
        fs.writeFileSync(path.join(DATA_DIR, 'item', `${safeName}.json`), JSON.stringify(mapped, null, 2));
    });
}
/**
 * Ingest Spells
 */
function ingestSpells() {
    console.log('Ingesting Spells...');
    const raw = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'spells.json'), 'utf-8'));
    ensureDir(path.join(DATA_DIR, 'spell'));
    raw.forEach((s) => {
        const components = {
            v: s.components.includes('V'),
            s: s.components.includes('S'),
            m: s.material || undefined
        };
        const mapped = {
            name: s.name,
            level: s.level,
            school: s.school.name,
            time: s.casting_time,
            range: s.range,
            components: components,
            duration: s.duration,
            concentration: s.concentration,
            description: s.desc.join('\n')
        };
        const safeName = s.name.replace(/[^a-z0-9]/gi, '_');
        fs.writeFileSync(path.join(DATA_DIR, 'spell', `${safeName}.json`), JSON.stringify(mapped, null, 2));
    });
}
/**
 * Ingest Races
 */
function ingestRaces() {
    console.log('Ingesting Races...');
    const rawRaces = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'races.json'), 'utf-8'));
    const rawSubraces = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'subraces.json'), 'utf-8'));
    ensureDir(path.join(DATA_DIR, 'race'));
    rawRaces.forEach((r) => {
        const asi = {};
        (r.ability_bonuses || []).forEach((b) => {
            asi[b.name] = b.bonus;
        });
        const mapped = {
            name: r.name,
            speed: r.speed,
            size: r.size,
            abilityScoreIncreases: asi,
            traits: (r.traits || []).map((t) => ({ name: t.name })),
            languages: (r.languages || []).map((l) => l.name),
            optional: r.name === 'Dragonborn'
        };
        const safeName = r.name.replace(/[^a-z0-9]/gi, '_');
        fs.writeFileSync(path.join(DATA_DIR, 'race', `${safeName}.json`), JSON.stringify(mapped, null, 2));
    });
    // Subraces as separate entities (simpler for now)
    rawSubraces.forEach((sr) => {
        const asi = {};
        (sr.ability_bonuses || []).forEach((b) => {
            asi[b.name] = b.bonus;
        });
        const mapped = {
            name: sr.name,
            speed: 30, // Default for most
            size: 'Medium', // Default
            abilityScoreIncreases: asi,
            traits: (sr.racial_traits || []).map((t) => ({ name: t.name })),
            languages: (sr.languages || []).map((l) => l.name)
        };
        const safeName = sr.name.replace(/[^a-z0-9]/gi, '_');
        fs.writeFileSync(path.join(DATA_DIR, 'race', `${safeName}.json`), JSON.stringify(mapped, null, 2));
    });
}
/**
 * Ingest Classes
 */
function ingestClasses() {
    console.log('Ingesting Classes...');
    const rawClasses = JSON.parse(fs.readFileSync(path.join(TEMP_DIR, 'classes.json'), 'utf-8'));
    ensureDir(path.join(DATA_DIR, 'class'));
    rawClasses.forEach((c) => {
        const mapped = {
            name: c.name,
            hitDie: `1d${c.hit_die}`,
            primaryAbility: [], // 5eapi doesn't give this in classes.json directly
            savingThrowProficiencies: (c.saving_throws || []).map((s) => s.name),
            armorProficiencies: (c.proficiencies || [])
                .filter((p) => p.name.toLowerCase().includes('armor') || p.name.toLowerCase().includes('shield'))
                .map((p) => p.name),
            weaponProficiencies: (c.proficiencies || [])
                .filter((p) => p.name.toLowerCase().includes('weapon') || p.name.toLowerCase().includes('sword') || p.name.toLowerCase().includes('bow'))
                .map((p) => p.name),
            skillChoices: {
                count: c.proficiency_choices ? c.proficiency_choices[0].choose : 0,
                options: c.proficiency_choices ? c.proficiency_choices[0].from.map((f) => f.name) : []
            }
        };
        const safeName = c.name.replace(/[^a-z0-9]/gi, '_');
        fs.writeFileSync(path.join(DATA_DIR, 'class', `${safeName}.json`), JSON.stringify(mapped, null, 2));
    });
}
function runIngest() {
    try {
        ingestMonsters();
        ingestItems();
        ingestSpells();
        ingestRaces();
        ingestClasses();
        console.log('SUCCESS: SRD Ingestion Complete.');
    }
    catch (e) {
        console.error('FAILED: SRD Ingestion Error:', e);
    }
}
runIngest();
