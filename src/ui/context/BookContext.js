import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback } from 'react';
const BookContext = createContext(undefined);
export const BookProvider = ({ children, initialPage }) => {
    const [pages, setPages] = useState(initialPage ? [initialPage] : []);
    const [activePageId, setActivePageId] = useState(initialPage?.id || null);
    const pushPage = useCallback((newPage) => {
        setPages(prev => {
            // If already in stack, just move to front (reorder)
            const existingIndex = prev.findIndex(p => p.id === newPage.id);
            if (existingIndex !== -1) {
                const updated = [...prev];
                const [removed] = updated.splice(existingIndex, 1);
                return [...updated, { ...removed, ...newPage }]; // Use new content if provided
            }
            return [...prev, newPage];
        });
        setActivePageId(newPage.id);
    }, []);
    const popPage = useCallback(() => {
        setPages(prev => {
            if (prev.length <= 1)
                return prev;
            const updated = prev.slice(0, -1);
            setActivePageId(updated[updated.length - 1].id);
            return updated;
        });
    }, []);
    const goToPage = useCallback((id) => {
        setPages(prev => {
            const index = prev.findIndex(p => p.id === id);
            if (index === -1)
                return prev;
            const updated = [...prev];
            const [page] = updated.splice(index, 1);
            return [...updated, page];
        });
        setActivePageId(id);
    }, []);
    return (_jsx(BookContext.Provider, { value: { pages, pushPage, popPage, goToPage, activePageId }, children: children }));
};
export const useBook = () => {
    const context = useContext(BookContext);
    if (context === undefined) {
        throw new Error('useBook must be used within a BookProvider');
    }
    return context;
};
