import React, { useState, useEffect } from 'react';
import styles from './BookModal.module.css';
import { X, ArrowLeft } from 'lucide-react';
import { BookProvider, useBook, BookPageData } from '../../context/BookContext';

interface BookModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPages: BookPageData[];
    activePageId: string;
}

const TAB_ORDER = ['character', 'equipment', 'codex', 'settings'];

const BookModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { pages, activePageId, popPage, goToPage } = useBook();
    const [animating, setAnimating] = useState<string | null>(null);

    // Filter to last 4 pages for display stack
    const displayStack = pages.slice(-4);
    const activePageIndex = displayStack.findIndex(p => p.id === activePageId);

    const handleBack = () => {
        setAnimating('out');
        setTimeout(() => {
            popPage();
            setAnimating(null);
        }, 400); // Match CSS transition
    };

    const handleTabClick = (id: string) => {
        if (id === activePageId) return;
        setAnimating('in');
        setTimeout(() => {
            goToPage(id);
            setAnimating(null);
        }, 400);
    };

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className={styles.bookOverlay} onClick={onClose}>
            <div className={styles.bookContainer} onClick={e => e.stopPropagation()}>
                {/* Tabs */}
                <div className={styles.tabBar}>
                    {pages.slice().sort((a, b) => {
                        const idxA = TAB_ORDER.indexOf(a.id);
                        const idxB = TAB_ORDER.indexOf(b.id);
                        if (idxA === -1 && idxB === -1) return 0;
                        if (idxA === -1) return 1;
                        if (idxB === -1) return -1;
                        return idxA - idxB;
                    }).map(page => (
                        <button
                            key={page.id}
                            className={`${styles.tab} ${activePageId === page.id ? styles.active : ''}`}
                            onClick={() => handleTabClick(page.id)}
                        >
                            {page.label}
                        </button>
                    ))}
                </div>

                {/* Page Stack */}
                <div className={styles.pageStack}>
                    {displayStack.map((page, index) => {
                        const position = displayStack.length - 1 - index;
                        const isActive = page.id === activePageId;

                        return (
                            <div
                                key={page.id}
                                className={`
                                    ${styles.page} 
                                    ${styles[`page_pos_${position}`]}
                                    ${isActive && animating === 'in' ? styles.turnIn : ''}
                                    ${isActive && animating === 'out' ? styles.turnOut : ''}
                                `}
                            >
                                <div className={styles.pageContent}>
                                    {isActive && (
                                        <button className={styles.closeBtn} onClick={onClose}>
                                            <X size={24} />
                                        </button>
                                    )}
                                    {page.content}
                                </div>
                            </div>
                        );
                    })}

                    {/* Turn Back Arrow Overlay */}
                    {pages.length > 1 && (
                        <div className={styles.turnBackOverlay} onClick={handleBack}>
                            <div className={styles.turnBackLabel}>Turn Back</div>
                            <ArrowLeft size={32} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const BookModal: React.FC<BookModalProps> = ({ isOpen, onClose, initialPages, activePageId }) => {
    if (!isOpen) return null;

    return (
        <BookProvider initialPages={initialPages} initialActiveId={activePageId}>
            <BookModalContent onClose={onClose} />
        </BookProvider>
    );
};

export default BookModal;
