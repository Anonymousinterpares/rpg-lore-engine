import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import styles from './BookModal.module.css';
import { X, ArrowLeft } from 'lucide-react';
import { BookProvider, useBook } from '../../context/BookContext';
const TAB_ORDER = ['character', 'equipment', 'codex', 'settings'];
const BookModalContent = ({ onClose }) => {
    const { pages, activePageId, popPage, goToPage } = useBook();
    const [animating, setAnimating] = useState(null);
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
    const handleTabClick = (id) => {
        if (id === activePageId)
            return;
        setAnimating('in');
        setTimeout(() => {
            goToPage(id);
            setAnimating(null);
        }, 400);
    };
    // Close on ESC
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);
    return (_jsx("div", { className: styles.bookOverlay, onClick: onClose, children: _jsxs("div", { className: styles.bookContainer, onClick: e => e.stopPropagation(), children: [_jsx("div", { className: styles.tabBar, children: pages.slice().sort((a, b) => {
                        const idxA = TAB_ORDER.indexOf(a.id);
                        const idxB = TAB_ORDER.indexOf(b.id);
                        if (idxA === -1 && idxB === -1)
                            return 0;
                        if (idxA === -1)
                            return 1;
                        if (idxB === -1)
                            return -1;
                        return idxA - idxB;
                    }).map(page => (_jsx("button", { className: `${styles.tab} ${activePageId === page.id ? styles.active : ''}`, onClick: () => handleTabClick(page.id), children: page.label }, page.id))) }), _jsxs("div", { className: styles.pageStack, children: [displayStack.map((page, index) => {
                            const position = displayStack.length - 1 - index;
                            const isActive = page.id === activePageId;
                            return (_jsx("div", { className: `
                                    ${styles.page} 
                                    ${styles[`page_pos_${position}`]}
                                    ${isActive && animating === 'in' ? styles.turnIn : ''}
                                    ${isActive && animating === 'out' ? styles.turnOut : ''}
                                `, children: _jsxs("div", { className: styles.pageContent, children: [isActive && (_jsx("button", { className: styles.closeBtn, onClick: onClose, children: _jsx(X, { size: 24 }) })), page.content] }) }, page.id));
                        }), pages.length > 1 && (_jsxs("div", { className: styles.turnBackOverlay, onClick: handleBack, children: [_jsx("div", { className: styles.turnBackLabel, children: "Turn Back" }), _jsx(ArrowLeft, { size: 32 })] }))] })] }) }));
};
const BookModal = ({ isOpen, onClose, initialPages, activePageId }) => {
    if (!isOpen)
        return null;
    return (_jsx(BookProvider, { initialPages: initialPages, initialActiveId: activePageId, children: _jsx(BookModalContent, { onClose: onClose }) }));
};
export default BookModal;
