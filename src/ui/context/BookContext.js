import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useState, useCallback, useEffect } from 'react';
const BookContext = createContext(undefined);
export const BookProvider = ({ children, initialPages = [], initialActiveId }) => {
    const [pages, setPages] = useState(initialPages);
    const [activePageId, setActivePageId] = useState(initialActiveId || (initialPages.length > 0 ? initialPages[initialPages.length - 1].id : null));
    const [history, setHistory] = useState(initialActiveId ? [initialActiveId] : []);
    useEffect(() => {
        if (initialActiveId) {
            setActivePageId(initialActiveId);
            setHistory(prev => {
                if (prev[prev.length - 1] === initialActiveId)
                    return prev;
                return [...prev, initialActiveId];
            });
            // Also ensure it's top of stack if already exists
            setPages(prev => {
                const index = prev.findIndex(p => p.id === initialActiveId);
                if (index === -1 || index === prev.length - 1)
                    return prev;
                const updated = [...prev];
                const [page] = updated.splice(index, 1);
                return [...updated, page];
            });
        }
    }, [initialActiveId]);
    const pushPage = useCallback((newPage) => {
        setPages(prev => {
            const existingIndex = prev.findIndex(p => p.id === newPage.id);
            if (existingIndex !== -1) {
                const updated = [...prev];
                const [removed] = updated.splice(existingIndex, 1);
                return [...updated, { ...removed, ...newPage }];
            }
            return [...prev, newPage];
        });
        setActivePageId(newPage.id);
        setHistory(prev => [...prev.filter(id => id !== newPage.id), newPage.id]);
    }, []);
    const popPage = useCallback(() => {
        if (history.length <= 1)
            return;
        const newHistory = history.slice(0, -1);
        const prevId = newHistory[newHistory.length - 1];
        const currentId = history[history.length - 1];
        setPages(prev => {
            const currentPage = prev.find(p => p.id === currentId);
            // Only remove if NOT permanent
            if (currentPage && !currentPage.permanent) {
                return prev.filter(p => p.id !== currentId);
            }
            // If permanent, just reorder to make prevId top
            const prevIndex = prev.findIndex(p => p.id === prevId);
            if (prevIndex !== -1) {
                const updated = [...prev];
                const [target] = updated.splice(prevIndex, 1);
                return [...updated, target];
            }
            return prev;
        });
        setActivePageId(prevId);
        setHistory(newHistory);
    }, [history]);
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
        setHistory(prev => {
            if (prev[prev.length - 1] === id)
                return prev;
            return [...prev, id];
        });
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
