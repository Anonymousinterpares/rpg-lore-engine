const fs = require('fs');
const path = require('path');

const itemDir = 'd:\\coding\\rpg_NEW\\data\\item';
const files = fs.readdirSync(itemDir);

const weapons = [];
let missingRangeCount = 0;

console.log("Verifying " + files.length + " items...");

files.forEach(file => {
    if (!file.endsWith('.json')) return;
    const content = fs.readFileSync(path.join(itemDir, file), 'utf8');
    try {
        const item = JSON.parse(content);
        if (item.type === 'Weapon') {
            const hasRange = item.range && typeof item.range.normal === 'number';
            if (!hasRange) {
                missingRangeCount++;
                console.error(`MISSING RANGE: ${item.name} (${file})`);
            }
            weapons.push({
                name: item.name,
                range: item.range
            });
        }
    } catch (e) {
        console.error(`Error parsing ${file}: ${e.message}`);
    }
});

console.log("\n--- Verification Report ---");
console.log(`Total Weapons Found: ${weapons.length}`);
console.log(`Weapons Missing Range: ${missingRangeCount}`);
if (missingRangeCount === 0) {
    console.log("SUCCESS: All weapons have 100% field coverage.");
} else {
    console.log("FAILURE: Some weapons are still missing range data.");
    process.exit(1);
}
