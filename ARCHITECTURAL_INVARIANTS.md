# Architectural Invariants

> [!IMPORTANT]
> This document defines the **STRICT** rules and invariants that must be maintained throughout the codebase. Violating these invariants will cause regression and instability.

## 1. Graphics & Rendering (WebGL)

### 1.1 State Hygiene (The "Invisible Smoke" Rule)
*   **Explicit Unbinding**: Every GPU component (Shader, Simulation, Renderer) MUST end its execution execution by explicitly unbinding its resources.
    *   `gl.bindFramebuffer(gl.FRAMEBUFFER, null)`
    *   `gl.bindVertexArray(null)`
*   **Zero-Leaking Policy**: No GPU-based system is allowed to assume the state it receives is "clean," and it is forbidden from leaving the state "dirty" for the next system.
*   **Context Isolation**: `FluidSimulation.ts` and `GPURenderer.ts` share a global WebGL context. Logic isolation does NOT equal state isolation.

## 2. Core Game Loop Architecture

### 2.1 Separation of Concerns
The `GameLoop` is an **Orchestrator**, not a "God Class". It delegates logic to specialized managers:
*   **TimeManager**: Handling world clock, rest, and weather.
*   **ExplorationManager**: Turn-based movement, map revelation, and discovery.
*   **CombatManager**: Combat rounds, initiative, AI processing, and grid logic.
*   **InventoryManager**: Item manipulation, weight calculations, and equipment.
*   **SpellManager**: Magic casting, slot consumption, and effect application.

### 2.2 Truth vs. Narration
*   **The Code Rules the World**: All mechanical outcomes (damage, movement, inventory changes) are deterministic and calculated by the `src/ruleset` engine.
*   **The AI Describes the World**: LLMs (Narrator) interpret these mechanical results to generate text. They do NOT mutate state directly.

## 3. Data & Schemas

### 3.1 Strict Validation
*   All game entities (Items, Monsters, Spells) must validate against their respective Zod schemas in `src/ruleset/schemas`.
*   JSON data in `data/` is the single source of truth for static content.
