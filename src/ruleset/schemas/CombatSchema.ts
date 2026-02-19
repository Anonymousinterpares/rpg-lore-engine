import { z } from 'zod';
import { AbilityScoreSchema, SizeSchema, WeatherSchema } from './BaseSchemas';

export const GridPositionSchema = z.object({
    x: z.number().min(0),
    y: z.number().min(0)
});

export type GridPosition = z.infer<typeof GridPositionSchema>;

export const CombatConditionSchema = z.object({
    id: z.string(), // e.g., 'blinded', 'prone'
    name: z.string(),
    description: z.string(),
    duration: z.number().optional(), // rounds remaining, undefined = permanent
    sourceId: z.string().optional()
});

export const StatusEffectSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['BUFF', 'DEBUFF']),
    modifier: z.union([z.number(), z.string()]).optional(), // e.g., 5 or 'd4'
    stat: z.string().optional(), // 'ac', 'STR_SAVE', etc.
    duration: z.number().optional(), // rounds remaining
    sourceId: z.string().optional()
});

export const CombatantTacticalSchema = z.object({
    cover: z.enum(['None', 'Quarter', 'Half', 'Three-Quarters', 'Full']).default('None'),
    reach: z.number().default(5),
    isRanged: z.boolean().default(false),
    range: z.object({
        normal: z.number(),
        long: z.number()
    }).optional(),
    isGrappledBy: z.string().optional(), // ID of grappler
    isGrappling: z.string().optional() // ID of target
});

export const CombatantResourcesSchema = z.object({
    actionSpent: z.boolean().default(false),
    bonusActionSpent: z.boolean().default(false),
    reactionSpent: z.boolean().default(false)
});

export const CombatantSchema = z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(['player', 'companion', 'enemy', 'summon']),
    isPlayer: z.boolean(),

    // Core Attributes
    hp: z.object({
        current: z.number(),
        max: z.number(),
        temp: z.number().default(0)
    }),
    ac: z.number().default(10),
    stats: z.record(AbilityScoreSchema, z.number()).default({}),
    initiative: z.number().default(0),
    dexterityScore: z.number().default(10), // For tie-breaking

    // Recovery & Resources
    spellSlots: z.record(z.string(), z.object({
        current: z.number(),
        max: z.number()
    })).optional(),
    preparedSpells: z.array(z.string()).default([]),

    // Action Economy & Tactics
    resources: CombatantResourcesSchema.default({}),
    tactical: CombatantTacticalSchema.default({}),

    // Status & Concentration
    conditions: z.array(z.string()).default([]),
    statusEffects: z.array(StatusEffectSchema).default([]),
    concentration: z.object({
        spellName: z.string(),
        startTurn: z.number()
    }).optional(),

    // Spatial & Grid Data
    position: GridPositionSchema.default({ x: 0, y: 0 }),
    size: SizeSchema.default('Medium'),
    movementSpeed: z.number().default(6), // 30ft / 5 = 6 cells
    movementRemaining: z.number().default(6),

    // Links/Metadata
    sourceId: z.string().optional(), // ID of the caster who summoned this combatant

    // NPC Realism Tracking
    virtualAmmo: z.number().optional(),
    thrownActionUsed: z.boolean().optional()
});

export type Combatant = z.infer<typeof CombatantSchema>;

export const ModifierSchema = z.object({
    label: z.string(),
    value: z.number(),
    source: z.string().optional()
});

export type Modifier = z.infer<typeof ModifierSchema>;

export const RollDetailsSchema = z.object({
    baseRoll: z.number(),
    modifiers: z.array(ModifierSchema),
    total: z.number(),
    isCrit: z.boolean(),
    isCritFail: z.boolean()
});

export type RollDetails = z.infer<typeof RollDetailsSchema>;

export const CombatLogEntrySchema = z.object({
    id: z.string(),
    type: z.enum(['info', 'warning', 'error', 'success']),
    message: z.string(),
    turn: z.number().optional(),
    details: z.object({
        rollDetails: RollDetailsSchema.optional()
    }).optional()
});
export type CombatLogEntry = z.infer<typeof CombatLogEntrySchema>;

export const CombatEventSchema = z.object({
    id: z.string(),
    type: z.enum(['HIT', 'MISS', 'CRIT', 'HEAL', 'CONDITION']),
    targetId: z.string(),
    value: z.number().optional(),
    text: z.string().optional(),
    timestamp: z.number()
});

export const TerrainTypeSchema = z.enum([
    'OPEN', 'WALL', 'WATER', 'RUBBLE', 'TREE', 'LAVA', 'PIT', 'DIFFICULT'
]);
export type TerrainType = z.infer<typeof TerrainTypeSchema>;

export const HazardSchema = z.object({
    damageType: z.string(),        // 'Fire', 'Cold', 'Acid', etc.
    damageDice: z.string(),        // '1d6', '2d6'
    saveDC: z.number(),            // DC for DEX/CON save
    saveAbility: z.enum(['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA']).default('DEX'),
    description: z.string()        // "The lava scorches you!"
});

export type Hazard = z.infer<typeof HazardSchema>;

export const TerrainFeatureSchema = z.object({
    id: z.string(),
    type: TerrainTypeSchema,
    position: GridPositionSchema,
    blocksMovement: z.boolean().default(false),
    blocksVision: z.boolean().default(false),
    coverBonus: z.enum(['NONE', 'QUARTER', 'HALF', 'THREE_QUARTERS', 'FULL']).default('NONE'),
    isDestructible: z.boolean().default(false),
    hp: z.number().optional(),
    hazard: HazardSchema.optional()
});
export type TerrainFeature = z.infer<typeof TerrainFeatureSchema>;

export const CombatGridSchema = z.object({
    width: z.number().default(20),
    height: z.number().default(20),
    features: z.array(TerrainFeatureSchema).default([]),
    playerStartZone: z.array(GridPositionSchema).default([]),
    enemyStartZone: z.array(GridPositionSchema).default([])
});
export type CombatGrid = z.infer<typeof CombatGridSchema>;

export const CombatStateSchema = z.object({
    round: z.number().default(1),
    currentTurnIndex: z.number().default(0),
    combatants: z.array(CombatantSchema),
    logs: z.array(CombatLogEntrySchema).default([]),
    events: z.array(CombatEventSchema).default([]),
    grid: CombatGridSchema.optional(),
    weather: WeatherSchema.optional(),
    isAmbush: z.boolean().default(false),
    selectedTargetId: z.string().optional(),
    lastRoll: z.union([
        z.number(),
        z.object({
            value: z.number(),
            modifier: z.number(),
            total: z.number(),
            label: z.string().optional(),
            breakdown: z.array(ModifierSchema).optional()
        })
    ]).optional(),
    activeBanner: z.object({
        type: z.enum(['PLAYER', 'ENEMY', 'NAME']),
        text: z.string().optional(),
        visible: z.boolean().default(false)
    }).optional(),
    lastActionMessage: z.string().optional(),
    turnActions: z.array(z.string()).default([])
});

export type CombatState = z.infer<typeof CombatStateSchema>;
