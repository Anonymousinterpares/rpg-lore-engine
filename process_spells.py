import os
import json
import re

SPELL_DIR = r'd:\coding\rpg_NEW\data\spell'

def parse_duration(duration_str):
    duration_str = duration_str.lower()
    if 'instantaneous' in duration_str:
        return None
    
    match = re.search(r'(\d+)\s+(round|minute|hour|day)', duration_str)
    if match:
        val = int(match.group(1))
        unit = match.group(2).upper()
        return {"value": val, "unit": unit}
    
    match = re.search(r'up to\s+(\d+)\s+(round|minute|hour|day)', duration_str)
    if match:
        val = int(match.group(1))
        unit = match.group(2).upper()
        return {"value": val, "unit": unit}

    if 'permanent' in duration_str or 'until dispelled' in duration_str:
        return {"value": 1, "unit": "PERMANENT"}
        
    return None

def determine_category(name, desc, time, duration):
    desc_l = desc.lower()
    name_l = name.lower()
    
    if 'reaction' in time.lower():
        return 'REACTION'
    if any(x in name_l for x in ['summon', 'conjure', 'animate', 'find', 'guardian', 'spiritual weapon']):
        return 'SUMMON'
    if 'regain' in desc_l and 'hit point' in desc_l:
        return 'HEAL'
    if 'damage' in desc_l or 'attack' in desc_l or 'hit' in desc_l:
        if 'bonus' not in desc_l or 'damage' in desc_l:
             return 'DAMAGE'
    if any(x in desc_l for x in ['paralyzed', 'stunned', 'charmed', 'blinded', 'deafened', 'unconscious', 'prone', 'restrained', 'frightened', 'poisoned', 'incapacitated']):
        return 'CONTROL'
    if any(x in desc_l for x in ['bonus', 'advantage', 'add a d', 'extra d', 'resistance']):
        return 'BUFF'
    if any(x in desc_l for x in ['penalty', 'disadvantage', 'subtract a d', 'vulnerability']):
        return 'DEBUFF'
    if 'transform' in desc_l or 'polymorph' in desc_l or 'shape' in desc_l:
        return 'TRANSFORM'
    
    return 'UTILITY'

def determine_shape(desc, range_str):
    desc_l = desc.lower()
    if 'self' in range_str.lower():
        if 'cone' in desc_l: return 'CONE', re.search(r'(\d+)-foot cone', desc_l)
        if 'radius' in desc_l or 'sphere' in desc_l: return 'RADIUS', re.search(r'(\d+)-foot-radius', desc_l) or re.search(r'(\d+)-foot\s+radius', desc_l) or re.search(r'(\d+)-foot\s+sphere', desc_l)
        if 'line' in desc_l: return 'LINE', re.search(r'(\d+)-foot line', desc_l)
        return 'SELF', None
    
    if 'radius' in desc_l or 'sphere' in desc_l:
        match = re.search(r'(\d+)-foot-radius', desc_l) or re.search(r'(\d+)-foot\s+radius', desc_l) or re.search(r'(\d+)-foot\s+sphere', desc_l)
        return 'RADIUS', match
    if 'cone' in desc_l:
        match = re.search(r'(\d+)-foot cone', desc_l)
        return 'CONE', match
    if 'cube' in desc_l:
        match = re.search(r'(\d+)-foot cube', desc_l)
        return 'CUBE', match
    if 'line' in desc_l:
        match = re.search(r'(\d+)-foot line', desc_l)
        return 'LINE', match
        
    return 'SINGLE', None

def parse_summon_options(desc):
    options = []
    lines = desc.split('\n')
    for line in lines:
        line = line.strip().lower()
        if line.startswith('-'):
            count_map = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8}
            count = 1
            found_count = False
            for word, val in count_map.items():
                if word in line:
                    count = val
                    found_count = True
                    break
            
            if not found_count:
                match = re.search(r'(\d+)', line)
                if match: count = int(match.group(1))

            cr = 0
            if '1/2' in line: cr = 0.5
            elif '1/4' in line: cr = 0.25
            elif '1/8' in line: cr = 0.125
            else:
                cr_match = re.search(r'rating\s+(\d+)', line)
                if cr_match: cr = float(cr_match.group(1))
            
            stype = "creature"
            for t in ["beast", "elemental", "fey", "undead", "celestial", "fiend", "monstrosity"]:
                if t in line:
                    stype = t
                    break
            
            options.append({"count": count, "maxCR": cr, "type": stype})
    return options

def process_spells():
    files = [f for f in os.listdir(SPELL_DIR) if f.endswith('.json')]
    print(f"Processing {len(files)} spells...")
    
    for filename in files:
        filepath = os.path.join(SPELL_DIR)
        with open(os.path.join(SPELL_DIR, filename), 'r', encoding='utf-8') as f:
            try:
                data = json.load(f)
            except Exception as e:
                print(f"Error loading {filename}: {e}")
                continue
            
        name = data.get('name', '')
        desc = data.get('description', '')
        time = data.get('time', '')
        duration_str = data.get('duration', '')
        concentration = data.get('concentration', False)
        range_str = data.get('range', '')
        
        category = determine_category(name, desc, time, duration_str)
        timing = 'CONCENTRATION' if concentration else ('DURATION' if duration_str.lower() != 'instantaneous' else 'INSTANT')
        duration_info = parse_duration(duration_str)
        shape, shape_match = determine_shape(desc, range_str)
        
        effect = {
            "category": category,
            "timing": timing
        }
        
        if name == 'Find Familiar':
            effect['timing'] = 'DURATION'
            effect['duration'] = {"value": 1, "unit": "PERMANENT"}
        
        if duration_info and 'duration' not in effect:
            effect["duration"] = duration_info
            
        if shape:
            effect["area"] = {"shape": shape}
            if shape_match:
                try:
                    effect["area"]["size"] = int(shape_match.group(1))
                    effect["area"]["units"] = "feet"
                except:
                    pass
        
        target_type = "CREATURE"
        if category == 'HEAL': target_type = "ALLY"
        elif category in ['DAMAGE', 'DEBUFF', 'CONTROL']: target_type = "ENEMY"
        
        count = 1
        if shape in ['RADIUS', 'CONE', 'LINE', 'CUBE', 'CYLINDER']:
            count = "ALL_IN_AREA"
        elif 'three creatures' in desc.lower() or 'up to three' in desc.lower(): count = 3
        elif 'two creatures' in desc.lower() or 'up to two' in desc.lower(): count = 2
        elif 'ten creatures' in desc.lower(): count = 10
        elif 'twelve creatures' in desc.lower(): count = 12
        
        effect["targets"] = {
            "type": target_type,
            "count": count
        }
        
        data['effect'] = effect
        
        if category == 'SUMMON':
            opts = parse_summon_options(desc)
            if opts:
                data['summon'] = {"options": opts}
            elif name == 'Animate Dead':
                data['summon'] = {"options": [{"count": 1, "maxCR": 0.25, "type": "undead"}]}
        
        for cond in ['paralyzed', 'stunned', 'charmed', 'blinded', 'deafened', 'unconscious', 'prone', 'restrained', 'frightened', 'poisoned', 'incapacitated', 'invisible']:
            if cond in desc.lower():
                data['condition'] = cond
                break
        
        with open(os.path.join(SPELL_DIR, filename), 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

if __name__ == "__main__":
    process_spells()
