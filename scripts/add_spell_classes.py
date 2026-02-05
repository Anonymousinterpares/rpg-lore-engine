import os
import json

spell_dir = r"d:\coding\rpg_NEW\data\spell"

# Basic heuristics for demonstration/standardization
# In a real scenario, this would be a full SRD mapping.
all_classes = ["Wizard", "Cleric", "Druid", "Paladin", "Bard", "Sorcerer", "Warlock", "Ranger"]

for filename in os.listdir(spell_dir):
    if filename.endswith(".json"):
        path = os.path.join(spell_dir, filename)
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Add classes if missing
        if "classes" not in data:
            # Fallback: Tag most spells with common classes for now to enable the UI
            # We can refine this later.
            data["classes"] = all_classes
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

print(f"Updated {len(os.listdir(spell_dir))} spells with class metadata.")
