# Conceptual Design Document: Spatial-Enhanced Text-Based Combat System for Turn-Based RPG

# Introduction
This document outlines a sophisticated yet purely text-based combat system for a turn-based RPG. The core innovation lies in introducing an invisible spatial layer to combat encounters, enabling tactical depth through positioning, distances, obstacles, and environmental interactions—all without any visual representation. Combat remains driven by descriptive text narratives, player choices, and action buttons, preserving the classic text RPG feel while elevating strategic decision-making.
The system builds on a foundation of choice-based branching interactions, where the game engine internally simulates a battlefield grid. This simulation informs valid actions, hit probabilities, enemy behaviors, and narrative descriptions. Dynamic, context-aware descriptions enhance immersion, making each fight feel unique and responsive to spatial dynamics.

# Goals
The primary objectives of this combat system are:

- Enhance Tactical Depth: Move beyond pure statistical exchanges by incorporating positioning, movement, cover, flanking, and line-of-sight mechanics, rewarding thoughtful decisions.
- Maintain Text Purity and Accessibility: Keep all player-facing elements as text descriptions, choices, and buttons—no graphics, grids, or maps—to ensure lightweight performance, broad device compatibility, and strong accessibility.
- Increase Immersion and Narrative Richness: Use vivid, context-specific descriptions to convey spatial relationships and environmental details, helping players visualize the scene in their mind.
- Boost Replayability: Procedural generation of battlefields ensures varied encounters, while spatial awareness creates emergent situations.
- Support Scalable Enemy Intelligence: Allow enemies of different levels to exhibit increasingly sophisticated tactics based on the same spatial information.
- Preserve Player Agency and Pacing: Offer meaningful choices each turn without overwhelming complexity, while dynamically limiting invalid options to prevent frustration.

# Core Concepts

## Invisible Battlefield Simulation
At the heart of the system is an internal simulation of a battlefield as an abstract grid (lenght x width -> 20 units x 20 units). This grid tracks:

- Positions of all entities (player and enemies).
- Procedural obstacles and environmental features (e.g., boulders, bushes, pits, elevations).
- Relative spatial relationships (distances, directions, line-of-sight, flanking angles).

The player never sees the grid; instead, all information is translated into narrative text and choice options.

## Battlefield advantages/disadvantages

- there should be global advantages/disadvantages applied, based on criteria such as:
    * daytime vs nighttime -> if nighttime, perception disadvantage, range of sight, accuracy etc disadvantages -> this MUST BE analysed to siecify each and every modifier which could be affected in current mechanics, IN LINE WITH d&d RULES! HERE, SPELLS LIKE DARKVISION could have actual effect, negating this modifier for given entity. this could be applied for every such spell, skill or ability
    * weather  modifiers: e.g. fog should act similarily to nighttime BUT darkvision would NOT have effect, similar to rain and so on
    * plain hext type : e.g. forest should add negative modifier to ranged attacks

## Hex type-dependent factors

Besides modifiers being effect of given hex type (biome), hex type should also depend on what types of obstacles are used (e.g. volcanic should have lava obstacles which could hurt entity standing in direct viccinity)

## Procedural Battlefield Generation
Each combat begins with the automatic creation of a unique battlefield:

### Random placement of the player and enemies within set areas:

Battlefield should be divided into 3 sections -> player's party starting section (here, all entities belonging to player's party should be placed randomly, with check preventing collisions with each other and with obstacles), enemy's party starting section at the opposite side of the combat area (same conditions as for plauyuer's party) ; main combat area - the biggest area where entities can move and take actions. here there hsould be most of obstacles placed.

### Generation of a variable number of obstacles (within defined min-max ranges) of varying sizes and types.
- Obstacle types include blocking terrain (impassable), cover (defensive bonuses), hazards (risks during movement), or tactical features (high ground for range advantages or low ground for disadvantages).
- Connectivity checks ensure all entities can potentially reach each other, preventing unfair dead-ends.

This procedural approach guarantees fresh layouts and encourages adaptation.

## Spatial Awareness Mechanics
The engine continuously evaluates spatial relationships to influence gameplay:

- Distances and Ranges: Measured in abstract units; actions have range limits (e.g., melee requires adjacency, ranged attacks have diminishing accuracy).
- Line-of-Sight (LOS): Direct paths may be blocked or partially obstructed by obstacles, reducing hit chances or preventing certain actions.
- Cover and Concealment: Entities near obstacles gain defensive bonuses or become harder to target.
- Flanking and Orientation: Attacking from side or rear arcs grants accuracy bonuses; entities may have implicit facing directions.
- Movement Costs: Traversing obstacles or long distances consumes action resources, simulating effort and risk.

These factors are calculated before each turn to determine valid options and probabilities.

## Choice-Based Player Interaction
Player turns combine familiar action buttons with dynamically generated movement choices:

- Core action buttons (Melee Attack, Cast Spell, Use Skill, Dash, Defend, Disengage) remain always visible but are enabled/disabled based on spatial validity, with tooltips showing estimated success rates.
- A separate list of contextual movement options (typically 4–7) is presented as numbered or labeled choices. These describe flavorful maneuvers derived from valid paths on the invisible grid (e.g., "Sidestep to flank the goblin," "Cautious advance through the bushes toward the orc," "Retreat to high ground").
Selecting a movement option repositions the player, potentially altering distances, cover, or flanking opportunities.

This hybrid approach preserves quick access to standard actions while offering rich positional choices.

## Enemy Artificial Intelligence
Enemies operate on programmed behaviors scaled by level (already implemented --> CHECK IS REQUIRED!), all informed by the same spatial simulation:

Low-Level Enemies: Simple aggressive patterns (charge the nearest threat, prioritize melee).
Mid-Level Enemies: Tactical awareness (seek cover when injured, maintain optimal range, avoid hazards).
High-Level Enemies: Advanced strategies (coordinate with allies, bait the player into obstacles, perform feints, or execute multi-turn plans such as pinning while another flanks).

All enemy decisions consider current distances, LOS, cover availability, and player positioning, leading to believable and challenging opposition.
-> NECESSARY ADJUSTMENT OF NPC AI TO TAKE THESE INTO ACCOUNT!

## Narrative Description Layer
A descriptive engine translates raw spatial and action data into flavorful text:

- Situation Summaries: Each turn begins with a vivid 1–2 sentence overview of the battlefield, highlighting key positional relationships, obstacles, and threats.
- Action Resolutions: Enemy and player actions are narrated with context-aware details (e.g., "The orc barrels through the underbrush to close the gap before swinging its axe" vs. "The orc hurls a javelin from behind the boulder, the shot partially deflected").
- Movement Flavor: Chosen movement options are described immersively, reinforcing consequences (e.g., "You weave between the rocks, emerging at the goblin's side for a perfect flank").

This layer ensures the invisible battlefield feels alive and tangible.

## Detailed Functionalities
(IMPORTANT: combat orchestration needs to be adjusted -> each output of combat LLM narrator to be considered as a separate phase & next steo should await until LLM narrative output is finished to be shown gradually -> each input appears gradually and this animation should finish first before next step starts!!!!!)

1. Combat Initiation (Triggered by encounter logic outside combat.)
2) Battlefield is procedurally generated.
3) Initial positions assigned; first situation summary presented.
4) 1st turn begins (Player or other entity, depending on initiative score dice roll results, as currently programmed) 


### Player Turn Structure

It begins with computed valid options and probabilities.
Situation Presentation: Narrative description + concise summary of ranges and key modifiers.
Choice Phase:
Movement options list (contextual maneuvers).
Standard action buttons (dynamically enabled with probability previews).

Resolution: Selected movement or action is validated and applied; results narrated (damage, status effects, new positions).
Turn End: Spatial state updates; enemy phase begins.

### Enemy/NPC Ally Phase

NPC act sequentially in initiative order.
Each enemy evaluates spatial options, selects optimal behavior based on level.
Actions and movements are resolved.
Given NPC turn phase ends with LLM summary of what NPC has chosen to do and what what the outcome, including updated situation summary -> next entity (NPC or player) proceedss.

## Action Dependencies and Modifiers

- Melee Attack: Requires adjacency; enhanced by flanking, reduced by target cover.
- Ranged/Spell Attacks: Affected by distance decay, LOS obstructions, and cover. IMPORTANT -> ranged attack is NOT implemented. There should be a CHECK if player has ranged weapon equipped - if yes, ranged attack should be an available option. If not, button should be inactive.
- Dash: Temporarily increases movement options, NEEDED to adjust by adding the cost of defense.
- Defend: Sacrifices offense for protection, possibly improved by nearby cover.
- Disengage: Safe retreat that increases distance, avoiding opportunity attacks.
All outcomes incorporate pre-calculated probabilities influenced by spatial factors.

## Combat Conclusion

Ends when one side is defeated or flees.
Rewards, experience, and narrative epilogue provided.
Battlefield state discarded; return to exploration/overworld.
