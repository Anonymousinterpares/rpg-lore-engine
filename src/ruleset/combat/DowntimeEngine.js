import { RECIPES } from '../data/StaticData';
import { WorldClockEngine } from './WorldClockEngine';
import { MechanicsEngine } from './MechanicsEngine';
export class DowntimeEngine {
    static recipes = RECIPES;
    /**
     * Attempts to craft an item based on a recipe.
     */
    static craft(pc, recipeId) {
        const recipe = this.recipes.find(r => r.id === recipeId);
        if (!recipe)
            return { success: false, message: 'Recipe not found.' };
        // 1. Check Ingredients
        for (const ing of recipe.ingredients) {
            const item = pc.inventory.items.find((i) => i.id === ing.itemId);
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
            const item = pc.inventory.items.find((i) => i.id === ing.itemId);
            item.quantity -= ing.quantity;
        }
        pc.inventory.items = pc.inventory.items.filter((i) => i.quantity > 0);
        // 4. Add Result
        const existing = pc.inventory.items.find((i) => i.id === recipe.resultItemId);
        if (existing) {
            existing.quantity++;
        }
        else {
            pc.inventory.items.push({
                id: recipe.resultItemId,
                name: recipe.name.replace('Recipe: ', ''),
                weight: 1.0,
                quantity: 1,
                equipped: false
            });
        }
        return { success: true, message: `Successfully crafted ${recipe.name}!` };
    }
    /**
     * Performs a downtime activity like training or research.
     */
    static performActivity(state, activity, hours) {
        state.worldTime = WorldClockEngine.advanceTime(state.worldTime, hours);
        return `${state.character.name} spent ${hours} hours on ${activity}.`;
    }
}
