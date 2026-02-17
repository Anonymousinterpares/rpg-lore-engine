import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import styles from './SkillLink.module.css';
import { CODEX_LORE } from '../../../ruleset/data/CodexRegistry';
import { X, Info } from 'lucide-react';

interface Skill {
    name: string;
    ability: string;
    content?: string;
    description?: string;
    examples: string[];
}

interface SkillLinkProps {
    skillName: string;
    className?: string;
    inheritColor?: boolean;
}

const SkillLink: React.FC<SkillLinkProps> = ({ skillName, className, inheritColor }) => {
    const [isOpen, setIsOpen] = useState(false);

    // Find skill data, handling case sensitivity and "Skill: " prefix
    const cleanName = skillName.replace('Skill: ', '');
    const skillsList = Object.values(CODEX_LORE.SKILLS) as Skill[];
    const skill = skillsList.find(s => s.name.toLowerCase() === cleanName.toLowerCase());

    if (!skill) return <span className={className}>{skillName}</span>;

    return (
        <>
            <span
                className={`${styles.link} ${inheritColor ? styles.inheritColor : ''} ${className || ''}`}
                onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(true);
                }}
            >
                {skillName}
            </span>

            {isOpen && ReactDOM.createPortal(
                <div className={styles.overlay} onClick={() => setIsOpen(false)}>
                    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.header}>
                            <div className={styles.titleRow}>
                                <Info className={styles.icon} size={20} />
                                <h3>{skill.name}</h3>
                            </div>
                            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className={styles.content}>
                            <div className={styles.statLine}>
                                <strong>Governing Ability:</strong> {skill.ability}
                            </div>
                            <p className={styles.description}>{skill.content || skill.description}</p>

                            <div className={styles.examplesSection}>
                                <h4>Common Uses:</h4>
                                <ul>
                                    {skill.examples.map((ex, i) => (
                                        <li key={i}>{ex}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default SkillLink;
