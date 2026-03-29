import React, { useEffect } from 'react';
import styles from './EquipmentOverlay.module.css';
import PaperdollScreen from './PaperdollScreen';

interface EquipmentOverlayProps {
    isOpen: boolean;
    onClose: () => void;
}

const EquipmentOverlay: React.FC<EquipmentOverlayProps> = ({ isOpen, onClose }) => {
    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown);
            return () => window.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.container} onClick={e => e.stopPropagation()}>
                <button className={styles.closeButton} onClick={onClose} title="Close (Esc)">
                    &times;
                </button>
                <PaperdollScreen />
            </div>
        </div>
    );
};

export default EquipmentOverlay;
