import { PlayerCharacter } from '../schemas/PlayerCharacterSchema';
import { GameState } from './GameStateManager';
import { WorldClockEngine } from './WorldClockEngine';
import { Recipe } from '../schemas/RecipeSchema';
import * as fs from 'fs';
import * as path from 'path';
import { MechanicsEngine } from './MechanicsEngine';

export class DowntimeEngine {
    private static recipes: Recipe[] = [];

    private static loadRecipes() {
        if (this.recipes.length > 0) return;
        const dataPath = path.join(process.cwd(), 'data', 'crafting', 'recipes.json');
        this.recipes = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    }

    /**
     * Attempts to craft an item based on a recipe.
     */
    public static craft(pc: PlayerCharacter, recipeId: string): { success: boolean, message: string } {
        this.loadRecipes();
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe) return { success: false, message: 'Recipe not found.' };

        // 1. Check Ingredients
        for (const ing of recipe.ingredients) {
            const item = pc.inventory.items.find(i => i.id === ing.itemId);
            if (!item || item.quantity < ing.quantity) {
                return { success: false, message: `Missing ingredient: ${ing.itemId} (${ing.quantity} required).` };
            }
        }

        // 2. Skill Check
        if (recipe.skillCheck) {
            const result = MechanicsEngine.resolveCheck(pc, 'INT', recipe.skillCheck.skill, recipe.skillCheck.dc);
            if (!result.success) {
                return { success: false, message: `Crafting failed: ${result.message}` };
            }
        }

        // 3. Consume Ingredients
        for (const ing of recipe.ingredients) {
            const item = pc.inventory.items.find(i => i.id === ing.itemId)!;
            item.quantity -= ing.quantity;
        }
        pc.inventory.items = pc.inventory.items.filter(i => i.quantity > 0);

        // 4. Add Result
        const existing = pc.inventory.items.find(i => i.id === recipe.resultItemId);
        if (existing) {
            existing.quantity++;
        } else {
            pc.inventory.items.push({
                id: recipe.resultItemId,
                name: recipe.name.replace('Recipe: ', ''),
                weight: 1.0,
                quantity: 1,
                equipped: false
            } as any);
        }

        return { success: true, message: `Successfully crafted ${recipe.name}!` };
    }

    /**
     * Performs a downtime activity like training or research.
     */
    public static performActivity(state: GameState, activity: string, hours: number): string {
        state.worldTime = WorldClockEngine.advanceTime(state.worldTime, hours);
        return `${state.character.name} spent ${hours} hours on ${activity}.`;
    }
}
