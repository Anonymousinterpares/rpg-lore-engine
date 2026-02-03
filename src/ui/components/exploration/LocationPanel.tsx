import React from 'react';
import styles from './LocationPanel.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { MapPin, Info, Trees, Mountain, Waves, Landmark } from 'lucide-react';

interface Poi {
    id: string;
    name: string;
    type: string;
}

interface LocationPanelProps {
    name: string;
    biome: string;
    description: string;
    interestPoints: Poi[];
    className?: string;
}

const LocationPanel: React.FC<LocationPanelProps> = ({ name, biome, description, interestPoints, className = '' }) => {
    const getBiomeIcon = (biome: string) => {
        switch (biome.toLowerCase()) {
            case 'forest': return <Trees size={16} />;
            case 'mountains': return <Mountain size={16} />;
            case 'ocean':
            case 'coast': return <Waves size={16} />;
            case 'plains': return <Trees size={16} />; // Use trees for now
            default: return <MapPin size={16} />;
        }
    };

    return (
        <div className={`${parchmentStyles.panel} ${styles.panel} ${className}`}>
            <div className={styles.header}>
                <div className={styles.biomeBadge}>
                    {getBiomeIcon(biome)}
                    <span>{biome}</span>
                </div>
                <h3 className={styles.title}>{name}</h3>
            </div>

            <div className={styles.content}>
                <p className={styles.description}>{description}</p>

                {interestPoints.length > 0 && (
                    <div className={styles.poiSection}>
                        <div className={styles.sectionTitle}>
                            <Landmark size={14} />
                            <span>Points of Interest</span>
                        </div>
                        <div className={styles.poiList}>
                            {interestPoints.map(poi => (
                                <div key={poi.id} className={styles.poiItem}>
                                    <Info size={12} />
                                    <span>{poi.name} ({poi.type})</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default LocationPanel;
