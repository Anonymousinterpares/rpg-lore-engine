import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export interface BookPageData {
    id: string;
    label: string;
    content: ReactNode;
}

interface BookContextType {
    pages: BookPageData[];
    pushPage: (page: BookPageData) => void;
    popPage: () => void;
    goToPage: (id: string) => void;
    activePageId: string | null;
}

const BookContext = createContext<BookContextType | undefined>(undefined);

export const BookProvider: React.FC<{ children: ReactNode; initialPage?: BookPageData }> = ({ children, initialPage }) => {
    const [pages, setPages] = useState<BookPageData[]>(initialPage ? [initialPage] : []);
    const [activePageId, setActivePageId] = useState<string | null>(initialPage?.id || null);

    const pushPage = useCallback((newPage: BookPageData) => {
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
            if (prev.length <= 1) return prev;
            const updated = prev.slice(0, -1);
            setActivePageId(updated[updated.length - 1].id);
            return updated;
        });
    }, []);

    const goToPage = useCallback((id: string) => {
        setPages(prev => {
            const index = prev.findIndex(p => p.id === id);
            if (index === -1) return prev;

            const updated = [...prev];
            const [page] = updated.splice(index, 1);
            return [...updated, page];
        });
        setActivePageId(id);
    }, []);

    return (
        <BookContext.Provider value={{ pages, pushPage, popPage, goToPage, activePageId }}>
            {children}
        </BookContext.Provider>
    );
};

export const useBook = () => {
    const context = useContext(BookContext);
    if (context === undefined) {
        throw new Error('useBook must be used within a BookProvider');
    }
    return context;
};
