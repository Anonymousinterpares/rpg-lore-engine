# Project Architecture: D&D Lore Engine (VibeCoding)

This document provides context for LLMs and developers on how the project is structured and how to maintain the "VibeCoding" (hallucination-proof) engine.

## 1. Directory Structure

- `/src/ruleset/`: **The Brain.** Contains the deterministic logic and schemas.
  - `schemas/`: Zod schemas defining every game entity (Race, Class, Spell, Item, Monster).
  - `scripts/`: Maintenance scripts (Validation, Ingestion, Markdown Generation).
- `/data/`: **The Source of Truth.** Contains raw game data in JSON format.
  - Subdirectories (e.g., `race/`, `spell/`) map directly to keys in the `RulebookRegistry`.
  - Every file in here is strictly validated against its schema.
- `/docs/`: **The View.** Human-readable Markdown documentation.
  - LLMs should use these for context, but **NEVER** edit them directly unless syncing from `data/`.
- `/refs/`: (Deprecated/Legacy) Original documentation before the modular refactor.

## 2. The Maintenance Workflow (CRITICAL)

To ensure the engine remains error-free, follow these steps when adding new content:

1.  **Creation**: Add a new `.json` file to the appropriate `data/` subdirectory.
2.  **Verification**: Run `npm run validate`. This script will:
    - Load all files in `data/`.
    - Match them to the `RulebookRegistry` (see `src/ruleset/schemas/Registry.ts`).
    - Parse them using Zod's `safeParse`.
3.  **Deployment**: Once validated, the data can be used by the character sheet or combat engine.

## 3. Schema Constraints

- **Dice Rolls**: Must follow the regex `^\d+d\d+(\s*[-+]\s*\d+)?$` (e.g., `1d8+2`).
- **Ability Scores**: Must be one of `STR`, `DEX`, `CON`, `INT`, `WIS`, `CHA`.
- **Items**: Use `z.discriminatedUnion` on the `type` field to distinguish Weapons from Armor, etc.

## 4. Ingestion Engine

Missing content (like the SRD library) is programmatically imported via `src/ruleset/scripts/ingest_srd.ts`. This script maps 5e API/Open-Source JSON structures into our internal, strictly-typed schemas.

---

> [!TIP]
> **Always Validate Before Committing.** A single typo in a damage type (e.g. "Fyre" instead of "Fire") will break the Character Sheet logic. The validation script is your safety net.
