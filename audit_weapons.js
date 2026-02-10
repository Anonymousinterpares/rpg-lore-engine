const fs = require('fs');
const path = require('path');

const itemDir = 'd:\\coding\\rpg_NEW\\data\\item';
const files = fs.readdirSync(itemDir);

const weapons = [];

console.log("Scanning " + files.length + " item files...");

files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const content = fs.readFileSync(path.join(itemDir, file), 'utf8');
    try {
        const item = JSON.parse(content);
        if (item.type === 'Weapon') {
            // Check for any property that looks like a range description
            const rangeProp = item.properties ? item.properties.find(p => p.toLowerCase().includes('range')) : null;

            weapons.push({
                name: item.name,
                properties: item.properties || [],
                explicitRangeField: item.range || "MISSING",
                rangeProperty: rangeProp || "MISSING",
                isRanged_Guess: (item.properties || []).includes('Ammunition') || (item.properties || []).includes('Range') || (item.properties || []).includes('Thrown')
            });
        }
    } catch (e) {
        console.error(`Error parsing ${file}: ${e.message}`);
    }
});

console.log("Found " + weapons.length + " weapons.");
console.log(JSON.stringify(weapons, null, 2));
