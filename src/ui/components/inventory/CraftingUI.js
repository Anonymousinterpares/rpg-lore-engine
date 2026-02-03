import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import styles from './CraftingUI.module.css';
import glassStyles from '../../styles/glass.module.css';
import { Hammer, Beaker, Scissors, Info, X } from 'lucide-react';
const CraftingUI = ({ recipes, playerInventory, onCraft, onClose, className = '' }) => {
    const [selectedRecipe, setSelectedRecipe] = useState(null);
    const getTypeIcon = (type) => {
        switch (type) {
            case 'Blacksmithing': return _jsx(Hammer, { size: 20 });
            case 'Alchemy': return _jsx(Beaker, { size: 20 });
            case 'Leatherworking': return _jsx(Scissors, { size: 20 });
            default: return _jsx(Hammer, { size: 20 });
        }
    };
    const canCraft = (recipe) => {
        return recipe.ingredients.every(ing => (playerInventory[ing.itemId] || 0) >= ing.quantity);
    };
    return (_jsx("div", { className: `${styles.overlay} ${className}`, children: _jsxs("div", { className: `${styles.modal} ${glassStyles.glassPanel}`, children: [_jsxs("div", { className: styles.header, children: [_jsxs("div", { className: styles.headerTitle, children: [_jsx(Hammer, { size: 24, className: styles.icon }), _jsx("h2", { children: "Crafting Workshop" })] }), _jsx("button", { className: styles.closeButton, onClick: onClose, children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: styles.content, children: [_jsxs("div", { className: styles.recipeList, children: [_jsx("h3", { className: styles.sectionTitle, children: "Recipes" }), _jsx("div", { className: styles.listContainer, children: recipes.map(recipe => (_jsxs("div", { className: `${styles.recipeItem} ${selectedRecipe?.id === recipe.id ? styles.selected : ''}`, onClick: () => setSelectedRecipe(recipe), children: [getTypeIcon(recipe.type), _jsxs("div", { className: styles.recipeInfo, children: [_jsx("span", { className: styles.recipeName, children: recipe.name }), _jsx("span", { className: styles.recipeType, children: recipe.type })] }), !canCraft(recipe) && _jsx("div", { className: styles.missingBadge, children: "Needs Materials" })] }, recipe.id))) })] }), _jsx("div", { className: styles.detailPane, children: selectedRecipe ? (_jsxs("div", { className: styles.recipeDetails, children: [_jsxs("div", { className: styles.detailHeader, children: [_jsx("h3", { children: selectedRecipe.name }), _jsx("p", { className: styles.detailDesc, children: selectedRecipe.description })] }), _jsxs("div", { className: styles.requirements, children: [_jsx("h4", { children: "Required Materials" }), _jsx("div", { className: styles.ingredientList, children: selectedRecipe.ingredients.map(ing => {
                                                    const has = playerInventory[ing.itemId] || 0;
                                                    const need = ing.quantity;
                                                    return (_jsxs("div", { className: `${styles.ingredient} ${has >= need ? styles.hasEnough : styles.hasNotEnough}`, children: [_jsx("span", { className: styles.ingName, children: ing.name }), _jsxs("span", { className: styles.ingCount, children: [has, " / ", need] })] }, ing.itemId));
                                                }) })] }), _jsxs("button", { className: styles.craftButton, disabled: !canCraft(selectedRecipe), onClick: () => onCraft(selectedRecipe.id), children: [_jsx(Hammer, { size: 18 }), "Start Crafting"] })] })) : (_jsxs("div", { className: styles.emptyDetail, children: [_jsx(Info, { size: 48, opacity: 0.2 }), _jsx("p", { children: "Select a recipe to view details" })] })) })] })] }) }));
};
export default CraftingUI;
