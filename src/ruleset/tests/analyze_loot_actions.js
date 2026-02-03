import * as fs from 'fs';
import * as path from 'path';
const MONSTER_DIR = path.join(__dirname, '..', '..', '..', 'data', 'monster');
const ITEM_DIR = path.join(__dirname, '..', '..', '..', 'data', 'item');
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'data', 'mappings');
// Known natural attack patterns (case-insensitive)
const NATURAL_ATTACK_PATTERNS = [
    'Bite', 'Claw', 'Claws', 'Tail', 'Slam', 'Gore', 'Tentacle', 'Tentacles',
    'Sting', 'Stinger', 'Hoof', 'Hooves', 'Beak', 'Talons', 'Talon',
    'Multiattack', 'Constrict', 'Web', 'Breath', 'Fist', 'Fists',
    'Pseudopod', 'Ram', 'Tusk', 'Tusks', 'Wing', 'Wings', 'Horns', 'Horn',
    'Engulf', 'Touch', 'Frightful Presence', 'Frightening Presence',
    'Leadership', 'Rock', 'Rocks', 'Boulder', 'Spit', 'Swallow', 'Stomp',
    'Tongue', 'Eye Ray', 'Eye Rays', 'Death Glare', 'Rotting Gaze',
    'Maddening Touch', 'Life Drain', 'Corrupting Touch', 'Withering Touch',
    'Etherealness', 'Invisibility', 'Teleport', 'Change Shape', 'Shapechanger',
    // Additional patterns from review
    'Antennae', 'Beard', 'Blood Drain', 'Chain', 'Charm', 'Crush', 'Draining Kiss',
    'Dreadful Glare', 'Fey Charm', 'Fling', 'Heart Sight', 'Horrifying Visage',
    'Hurl Flame', 'Illusory Appearance', 'Invisible Passage', 'Lair Actions',
    'Lightning Storm', 'Lightning Strike', 'Luring Song', 'Moan', 'Pincer',
    'Read Thoughts', 'Reel', 'Roar', 'Scare', 'Shock', 'Shriek', 'Smother',
    'Snake Hair', 'Spores', 'Strength Drain', 'Stunning Screech', 'Tendril',
    'Deadly Leap', 'Rake', 'Wall of Ice', 'Whelm', 'Whirlwind', 'Ethereal Stride',
    'Horror Nimbus', 'Possession', 'Haste', 'Slow', 'Phantasms', 'Enlarge',
    'Nightmare Haunting', 'Create Specter', 'Create Whirlwind', 'Animate',
    'Children of the Night', 'Fetid Cloud', 'Ink Cloud', 'Enslave', 'Darkness Aura',
    'Acid Spray', 'Unarmed Strike', 'Shield Bash', 'Variant', 'Spiked Shield'
];
// Custom weapons that should map to standard items
const CUSTOM_WEAPON_MAP = {
    'Fork': 'Trident',
    'Sword': 'Longsword',
    'Flying Sword': 'Longsword',
    'Slaying Longbow': 'Longbow',
    'Harpoon': 'Javelin',
    'Heavy Club': 'Greatclub',
    'Spiked Bone Club': 'Club',
    'Poisoned Dart': 'Dart'
};
const NATURAL_PATTERNS_SET = new Set(NATURAL_ATTACK_PATTERNS.map(p => p.toLowerCase()));
function normalizeForMatch(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '') // Remove punctuation and spaces
        .replace(/crossbowlight/g, 'lightcrossbow')
        .replace(/crossbowheavy/g, 'heavycrossbow')
        .replace(/crossbowhand/g, 'handcrossbow');
}
function loadWeaponNames() {
    // Map: normalized name -> original filename
    const weaponMap = new Map();
    // Known weapon file patterns
    const weaponFiles = [
        'Battleaxe', 'Blowgun', 'Club', 'Crossbow__hand', 'Crossbow__heavy',
        'Crossbow__light', 'Dagger', 'Dart', 'Flail', 'Glaive', 'Greataxe',
        'Greatclub', 'Greatsword', 'Halberd', 'Handaxe', 'Javelin', 'Lance',
        'Light_hammer', 'Longbow', 'Longsword', 'Mace', 'Maul', 'Morningstar',
        'Net', 'Pike', 'Quarterstaff', 'Rapier', 'Scimitar', 'Shortbow',
        'Shortsword', 'Sickle', 'Sling', 'Spear', 'Trident', 'War_pick',
        'Warhammer', 'Whip'
    ];
    for (const wf of weaponFiles) {
        const filePath = path.join(ITEM_DIR, `${wf}.json`);
        if (fs.existsSync(filePath)) {
            const normalized = normalizeForMatch(wf);
            weaponMap.set(normalized, wf);
            // Also add common variant names
            if (wf === 'Crossbow__light') {
                weaponMap.set('lightcrossbow', wf);
                weaponMap.set('crossbowlight', wf);
            }
            if (wf === 'Crossbow__heavy') {
                weaponMap.set('heavycrossbow', wf);
                weaponMap.set('crossbowheavy', wf);
            }
            if (wf === 'Crossbow__hand') {
                weaponMap.set('handcrossbow', wf);
                weaponMap.set('crossbowhand', wf);
            }
            if (wf === 'Light_hammer') {
                weaponMap.set('lighthammer', wf);
            }
            if (wf === 'War_pick') {
                weaponMap.set('warpick', wf);
            }
        }
    }
    console.log(`Loaded ${weaponMap.size} weapon variants from item directory.`);
    return weaponMap;
}
function analyzeMonsters(weaponMap) {
    const result = {
        weaponActionMap: {},
        naturalAttacks: [],
        unknownActions: [],
        monsterActionDetails: {}
    };
    const seenActions = new Set();
    const files = fs.readdirSync(MONSTER_DIR).filter(f => f.endsWith('.json'));
    console.log(`Analyzing ${files.length} monster files...`);
    for (const file of files) {
        const filePath = path.join(MONSTER_DIR, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const monsterName = content.name || file;
        const actions = [];
        if (content.actions && Array.isArray(content.actions)) {
            for (const action of content.actions) {
                const actionName = action.name;
                if (!actionName)
                    continue;
                actions.push(actionName);
                if (seenActions.has(actionName))
                    continue;
                seenActions.add(actionName);
                // Strip parenthetical suffixes like "(Humanoid Form Only)"
                const baseActionName = actionName.replace(/\s*\([^)]*\)\s*/g, '').trim();
                const normalizedAction = normalizeForMatch(baseActionName);
                // Check if it's a weapon (exact or base name)
                if (weaponMap.has(normalizedAction)) {
                    result.weaponActionMap[actionName] = weaponMap.get(normalizedAction);
                }
                // Check if base name (without suffix) is a weapon
                else if (baseActionName !== actionName && weaponMap.has(normalizeForMatch(baseActionName))) {
                    result.weaponActionMap[actionName] = weaponMap.get(normalizeForMatch(baseActionName));
                }
                // Check custom weapon mapping
                else if (CUSTOM_WEAPON_MAP[baseActionName]) {
                    const mappedWeapon = CUSTOM_WEAPON_MAP[baseActionName];
                    if (weaponMap.has(normalizeForMatch(mappedWeapon))) {
                        result.weaponActionMap[actionName] = weaponMap.get(normalizeForMatch(mappedWeapon));
                    }
                }
                // Check if it's a natural attack
                else if (NATURAL_PATTERNS_SET.has(baseActionName.toLowerCase())) {
                    result.naturalAttacks.push(actionName);
                }
                // Check if it matches partial patterns
                else if (NATURAL_ATTACK_PATTERNS.some(p => baseActionName.toLowerCase().includes(p.toLowerCase()))) {
                    result.naturalAttacks.push(actionName);
                }
                // Unknown - needs review
                else {
                    result.unknownActions.push(actionName);
                }
            }
        }
        result.monsterActionDetails[monsterName] = actions;
    }
    // Deduplicate
    result.naturalAttacks = [...new Set(result.naturalAttacks)].sort();
    result.unknownActions = [...new Set(result.unknownActions)].sort();
    return result;
}
function main() {
    console.log('=== Monster Action Analysis ===\n');
    // Ensure output dir exists
    if (!fs.existsSync(OUTPUT_DIR)) {
        fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
    const weaponMap = loadWeaponNames();
    const analysis = analyzeMonsters(weaponMap);
    // Output summary
    console.log('\n=== RESULTS ===');
    console.log(`Weapons Mapped: ${Object.keys(analysis.weaponActionMap).length}`);
    console.log(`Natural Attacks: ${analysis.naturalAttacks.length}`);
    console.log(`Unknown Actions (Need Review): ${analysis.unknownActions.length}`);
    // Write weapon mapping
    const weaponMappingPath = path.join(OUTPUT_DIR, 'weapon_action_mapping.json');
    fs.writeFileSync(weaponMappingPath, JSON.stringify(analysis.weaponActionMap, null, 2));
    console.log(`\nWeapon mapping saved to: ${weaponMappingPath}`);
    // Write natural attacks list
    const naturalPath = path.join(OUTPUT_DIR, 'natural_attacks.json');
    fs.writeFileSync(naturalPath, JSON.stringify(analysis.naturalAttacks, null, 2));
    console.log(`Natural attacks saved to: ${naturalPath}`);
    // Write unknown actions for review
    const unknownPath = path.join(OUTPUT_DIR, 'unknown_actions_review.txt');
    fs.writeFileSync(unknownPath, `=== UNKNOWN ACTIONS - MANUAL REVIEW REQUIRED ===\n` +
        `Total: ${analysis.unknownActions.length}\n\n` +
        analysis.unknownActions.join('\n'));
    console.log(`Unknown actions saved to: ${unknownPath}`);
    // Print unknown for immediate review
    if (analysis.unknownActions.length > 0) {
        console.log('\n=== UNKNOWN ACTIONS (Review These) ===');
        for (const action of analysis.unknownActions) {
            console.log(`  - ${action}`);
        }
    }
    console.log('\n=== Analysis Complete ===');
}
main();
