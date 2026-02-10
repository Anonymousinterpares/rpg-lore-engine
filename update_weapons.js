const fs = require('fs');
const path = require('path');

const itemDir = 'd:\\coding\\rpg_NEW\\data\\item';

const weaponRanges = {
    'Club': { normal: 5 },
    'Dagger': { normal: 20, long: 60 },
    'Greatclub': { normal: 5 },
    'Handaxe': { normal: 20, long: 60 },
    'Javelin': { normal: 30, long: 120 },
    'Light hammer': { normal: 20, long: 60 },
    'Mace': { normal: 5 },
    'Quarterstaff': { normal: 5 },
    'Sickle': { normal: 5 },
    'Spear': { normal: 20, long: 60 },
    'Crossbow, light': { normal: 80, long: 320 },
    'Dart': { normal: 20, long: 60 },
    'Shortbow': { normal: 80, long: 320 },
    'Sling': { normal: 30, long: 120 },
    'Battleaxe': { normal: 5 },
    'Flail': { normal: 5 },
    'Glaive': { normal: 10 },
    'Greataxe': { normal: 5 },
    'Greatsword': { normal: 5 },
    'Halberd': { normal: 10 },
    'Lance': { normal: 10 },
    'Longsword': { normal: 5 },
    'Maul': { normal: 5 },
    'Morningstar': { normal: 5 },
    'Pike': { normal: 10 },
    'Rapier': { normal: 5 },
    'Scimitar': { normal: 5 },
    'Shortsword': { normal: 5 },
    'Trident': { normal: 20, long: 60 },
    'War pick': { normal: 5 },
    'Warhammer': { normal: 5 },
    'Whip': { normal: 10 },
    'Blowgun': { normal: 25, long: 100 },
    'Crossbow, hand': { normal: 30, long: 120 },
    'Crossbow, heavy': { normal: 100, long: 400 },
    'Longbow': { normal: 150, long: 600 },
    'Net': { normal: 5, long: 15 }
};

const files = fs.readdirSync(itemDir);

files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const filePath = path.join(itemDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    try {
        const item = JSON.parse(content);
        if (item.type === 'Weapon') {
            const rangeData = weaponRanges[item.name];
            if (rangeData) {
                item.range = rangeData;
                fs.writeFileSync(filePath, JSON.stringify(item, null, 2));
                console.log(`Updated ${item.name}`);
            } else {
                console.warn(`No range data for weapon: ${item.name}`);
            }
        }
    } catch (e) {
        console.error(`Error processing ${file}: ${e.message}`);
    }
});
