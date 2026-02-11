import React, { useState, useEffect } from 'react';
import styles from './BookModal.module.css';
import { X, ArrowLeft } from 'lucide-react';
import { BookProvider, useBook, BookPageData } from '../../context/BookContext';
import { useGameState } from '../../hooks/useGameState';
import { Quest, QuestObjective } from '../../../ruleset/schemas/QuestSchema';

interface BookModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialPages: BookPageData[];
    activePageId: string;
}

const TAB_ORDER = ['character', 'equipment', 'codex', 'world', 'world_map', 'quests', 'settings'];

const BookModalContent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
    const { pages, activePageId, popPage, goToPage } = useBook();
    const { state, engine, updateState } = useGameState();
    const [animating, setAnimating] = useState<string | null>(null);

    // Filter to last 4 pages for display stack
    const displayStack = pages.slice(-4);

    const handleBack = () => {
        setAnimating('out');
        setTimeout(() => {
            popPage();
            setAnimating(null);
        }, 400); // Match CSS transition
    };

    const handleTabClick = async (id: string) => {
        if (engine) await engine.trackTutorialEvent(`viewed_page:${id}`);

        if (id === activePageId) return;
        setAnimating('in');
        setTimeout(() => {
            goToPage(id);
            setAnimating(null);
        }, 400);
    };

    // Track initial page
    useEffect(() => {
        const trackPage = async () => {
            if (activePageId && engine) {
                await engine.trackTutorialEvent(`viewed_page:${activePageId}`);
            }
        };
        trackPage();
    }, [activePageId, engine]);

    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const isPageTracked = (id: string) => state?.triggeredEvents?.includes(`viewed_page:${id}`);
    const isTutorialActive = state?.activeQuests?.some(q => q.id === 'tutorial_01' && !q.objectives.find(o => o.id === 'obj_master_booklet')?.isCompleted);

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
                    }).map(page => {
                        const showRedDot = (page.id === 'quests' && page.hasNotification) ||
                            (isTutorialActive && !isPageTracked(page.id));

                        return (
                            <button
                                key={page.id}
                                className={`${styles.tab} ${activePageId === page.id ? styles.active : ''}`}
                                onClick={() => handleTabClick(page.id)}
                            >
                                {page.label}
                                {showRedDot && (
                                    <div className={styles.tabDot} />
                                )}
                            </button>
                        );
                    })}
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

const BookModal: React.FC<BookModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <BookModalContent onClose={onClose} />
    );
};

export default BookModal;
