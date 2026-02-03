import React, { useState } from 'react';
import styles from './CraftingUI.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { Hammer, Beaker, Scissors, Info, X } from 'lucide-react';

interface Ingredient {
    itemId: string;
    name: string;
    quantity: number;
}

interface Recipe {
    id: string;
    name: string;
    type: 'Blacksmithing' | 'Alchemy' | 'Leatherworking' | 'Cooking';
    description: string;
    ingredients: Ingredient[];
    resultItemId: string;
}

interface CraftingUIProps {
    recipes: Recipe[];
    playerInventory: Record<string, number>; // itemId -> quantity
    onCraft: (recipeId: string) => void;
    onClose: () => void;
    className?: string;
}

const CraftingUI: React.FC<CraftingUIProps> = ({
    recipes,
    playerInventory,
    onCraft,
    onClose,
    className = ''
}) => {
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Blacksmithing': return <Hammer size={20} />;
            case 'Alchemy': return <Beaker size={20} />;
            case 'Leatherworking': return <Scissors size={20} />;
            default: return <Hammer size={20} />;
        }
    };

    const canCraft = (recipe: Recipe) => {
        return recipe.ingredients.every(ing => (playerInventory[ing.itemId] || 0) >= ing.quantity);
    };

    return (
        <div className={`${styles.overlay} ${className}`}>
            <div className={`${styles.modal} ${parchmentStyles.panel}`}>
                <div className={styles.header}>
                    <div className={styles.headerTitle}>
                        <Hammer size={24} className={styles.icon} />
                        <h2 className={parchmentStyles.heading}>Crafting Workshop</h2>
                    </div>
                    <button className={styles.closeButton} onClick={onClose}><X size={20} /></button>
                </div>

                <div className={styles.content}>
                    <div className={styles.recipeList}>
                        <h3 className={styles.sectionTitle}>Recipes</h3>
                        <div className={styles.listContainer}>
                            {recipes.map(recipe => (
                                <div
                                    key={recipe.id}
                                    className={`${styles.recipeItem} ${selectedRecipe?.id === recipe.id ? styles.selected : ''}`}
                                    onClick={() => setSelectedRecipe(recipe)}
                                >
                                    {getTypeIcon(recipe.type)}
                                    <div className={styles.recipeInfo}>
                                        <span className={styles.recipeName}>{recipe.name}</span>
                                        <span className={styles.recipeType}>{recipe.type}</span>
                                    </div>
                                    {!canCraft(recipe) && <div className={styles.missingBadge}>Needs Materials</div>}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className={styles.detailPane}>
                        {selectedRecipe ? (
                            <div className={styles.recipeDetails}>
                                <div className={styles.detailHeader}>
                                    <h3 className={parchmentStyles.heading}>{selectedRecipe.name}</h3>
                                    <p className={styles.detailDesc}>{selectedRecipe.description}</p>
                                </div>

                                <div className={styles.requirements}>
                                    <h4>Required Materials</h4>
                                    <div className={styles.ingredientList}>
                                        {selectedRecipe.ingredients.map(ing => {
                                            const has = playerInventory[ing.itemId] || 0;
                                            const need = ing.quantity;
                                            return (
                                                <div key={ing.itemId} className={`${styles.ingredient} ${has >= need ? styles.hasEnough : styles.hasNotEnough}`}>
                                                    <span className={styles.ingName}>{ing.name}</span>
                                                    <span className={styles.ingCount}>{has} / {need}</span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <button
                                    className={`${styles.craftButton} ${parchmentStyles.button}`}
                                    disabled={!canCraft(selectedRecipe)}
                                    onClick={() => onCraft(selectedRecipe.id)}
                                >
                                    <Hammer size={18} />
                                    Start Crafting
                                </button>
                            </div>
                        ) : (
                            <div className={styles.emptyDetail}>
                                <Info size={48} opacity={0.2} />
                                <p>Select a recipe to view details</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CraftingUI;
