import React, { useState, useMemo, useCallback } from 'react';
import styles from './SkillTreePage.module.css';
import parchmentStyles from '../../styles/parchment.module.css';
import { useGameState } from '../../hooks/useGameState';
import { SkillEngine } from '../../../ruleset/combat/SkillEngine';
import { MechanicsEngine } from '../../../ruleset/combat/MechanicsEngine';
import { ChevronDown, ChevronRight, Zap, Shield, Star, Lock, RotateCcw, TrendingUp, Check, X } from 'lucide-react';

const TIER_NAMES = ['Untrained', 'Proficient', 'Expert', 'Master', 'Grandmaster'];
const TIER_COLORS = ['#888', '#c8c8c8', '#1eff00', '#0070dd', '#ff8000'];

const ABILITY_GROUPS: { ability: string; label: string; color: string }[] = [
    { ability: 'STR', label: 'Strength', color: '#c0392b' },
    { ability: 'DEX', label: 'Dexterity', color: '#27ae60' },
    { ability: 'INT', label: 'Intelligence', color: '#2980b9' },
    { ability: 'WIS', label: 'Wisdom', color: '#8e44ad' },
    { ability: 'CHA', label: 'Charisma', color: '#e67e22' },
];

// Pending investment: tracks uncommitted changes
interface PendingInvestment {
    skillName: string;
    cost: number;
    fromTier: number;
    toTier: number;
}

const SkillTreePage: React.FC = () => {
    const { state, updateState } = useGameState();
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
        STR: true, DEX: true, INT: true, WIS: true, CHA: true,
    });
    const [confirmReset, setConfirmReset] = useState(false);
    const [pending, setPending] = useState<PendingInvestment[]>([]);
    const [confirmedSkills, setConfirmedSkills] = useState<Set<string>>(new Set());

    const pc = state?.character;
    if (!pc) return <div className={styles.empty}>No character loaded.</div>;

    const registry = SkillEngine.getRegistry();
    const profBonus = MechanicsEngine.getProficiencyBonus(pc.level);
    const sp = (pc as any).skillPoints || { available: 0, totalEarned: 0 };

    // Calculate effective state with pending changes applied
    const pendingSpUsed = pending.reduce((sum, p) => sum + p.cost, 0);
    const effectiveSpAvailable = sp.available - pendingSpUsed;

    // Get effective tier for a skill (real + pending)
    const getEffectiveTier = (skillName: string): number => {
        const baseTier = SkillEngine.getSkillTier(pc, skillName);
        const pendingForSkill = pending.filter(p => p.skillName === skillName);
        return baseTier + pendingForSkill.length;
    };

    const groupedSkills = useMemo(() => {
        const groups: Record<string, { name: string; def: any }[]> = {};
        for (const [name, def] of Object.entries(registry)) {
            const ability = (def as any).ability;
            if (!groups[ability]) groups[ability] = [];
            groups[ability].push({ name, def });
        }
        for (const g of Object.values(groups)) g.sort((a, b) => a.name.localeCompare(b.name));
        return groups;
    }, [registry]);

    const toggleGroup = (ability: string) => {
        setExpandedGroups(prev => ({ ...prev, [ability]: !prev[ability] }));
    };

    const handlePendingInvest = useCallback((skillName: string) => {
        const effectiveTier = getEffectiveTier(skillName);
        const def = SkillEngine.getSkillDef(skillName);
        if (!def || effectiveTier >= 4) return;

        const cost = def.tierCosts[effectiveTier];
        if (effectiveSpAvailable < cost) return;

        const levelGate = def.levelGates[effectiveTier];
        if (pc.level < levelGate) return;

        setPending(prev => [...prev, {
            skillName,
            cost,
            fromTier: effectiveTier,
            toTier: effectiveTier + 1,
        }]);
    }, [pc, effectiveSpAvailable, pending]);

    const handleConfirm = useCallback(() => {
        const invested = new Set(pending.map(p => p.skillName));
        for (const p of pending) {
            SkillEngine.invest(pc, p.skillName);
        }
        setPending([]);
        setConfirmedSkills(invested);
        updateState();
        // Clear animation after 3s
        setTimeout(() => setConfirmedSkills(new Set()), 3000);
    }, [pc, pending, updateState]);

    const handleRevert = useCallback(() => {
        setPending([]);
    }, []);

    const handleReset = useCallback(() => {
        SkillEngine.resetAll(pc);
        setConfirmReset(false);
        setPending([]);
        updateState();
    }, [pc, updateState]);

    const hasPendingChanges = pending.length > 0;
    const hasInvestedPoints = Object.values((pc as any).skills || {}).some((s: any) => (s.pointsInvested || 0) > 0);

    const renderTierPips = (tier: number, hasPending: boolean) => {
        const pips = [];
        for (let i = 1; i <= 4; i++) {
            const isFilled = i <= tier;
            pips.push(
                <span
                    key={i}
                    className={`${styles.pip} ${isFilled ? styles.pipFilled : styles.pipEmpty} ${isFilled && hasPending ? styles.pipPending : ''}`}
                    style={isFilled ? { backgroundColor: TIER_COLORS[tier] } : undefined}
                    title={TIER_NAMES[i]}
                />
            );
        }
        return <div className={styles.pips}>{pips}</div>;
    };

    const renderSkillCard = (skillName: string, def: any) => {
        const realTier = SkillEngine.getSkillTier(pc, skillName);
        const effectiveTier = getEffectiveTier(skillName);
        const hasPendingForThis = effectiveTier > realTier;
        const justConfirmed = confirmedSkills.has(skillName);
        const tierName = TIER_NAMES[effectiveTier];
        const mult = effectiveTier > 0 ? SkillEngine.getTierMultiplier(skillName, effectiveTier) : 0;
        const abilityScore = (pc.stats as Record<string, number>)[def.ability] || 10;
        const abilityMod = MechanicsEngine.getModifier(abilityScore);
        const totalBonus = abilityMod + (profBonus * mult);
        const isMaxed = effectiveTier >= 4;

        // Can invest to next tier?
        let canInvest = false;
        let investCost: number | null = null;
        let lockReason = '';
        if (!isMaxed) {
            const nextCost = def.tierCosts[effectiveTier];
            const levelGate = def.levelGates[effectiveTier];
            investCost = nextCost;
            if (effectiveSpAvailable < nextCost) {
                lockReason = `${nextCost} SP`;
            } else if (pc.level < levelGate) {
                lockReason = `Lvl ${levelGate}`;
            } else {
                canInvest = true;
            }
        }

        return (
            <div key={skillName} className={`${styles.skillCard} ${isMaxed ? styles.skillMaxed : ''} ${hasPendingForThis ? styles.skillPending : ''} ${justConfirmed ? styles.skillConfirmed : ''}`}>
                <div className={styles.skillHeader}>
                    <div className={styles.skillNameRow}>
                        {renderTierPips(effectiveTier, hasPendingForThis)}
                        <span className={styles.skillName} style={{ color: TIER_COLORS[effectiveTier] }}>
                            {skillName}
                        </span>
                        <span className={styles.tierLabel} style={{ color: TIER_COLORS[effectiveTier] }}>
                            {tierName}
                            {hasPendingForThis && <span className={styles.pendingTag}> (pending)</span>}
                        </span>
                    </div>
                    <div className={styles.skillBonus}>
                        <span className={styles.bonusValue}>
                            {totalBonus >= 0 ? '+' : ''}{totalBonus}
                        </span>
                    </div>
                </div>

                <div className={styles.skillDetails}>
                    <span className={styles.skillDesc}>{def.description}</span>
                </div>

                <div className={styles.skillFooter}>
                    {effectiveTier > 0 && (
                        <span className={styles.profDetail}>
                            {def.ability} {abilityMod >= 0 ? '+' : ''}{abilityMod} + Prof {profBonus}×{mult}
                        </span>
                    )}
                    {effectiveTier === 0 && (
                        <span className={styles.profDetail}>
                            {def.ability} {abilityMod >= 0 ? '+' : ''}{abilityMod} (no proficiency)
                        </span>
                    )}

                    <div className={styles.investArea}>
                        {isMaxed ? (
                            <span className={styles.maxBadge}><Star size={12} /> MAX</span>
                        ) : canInvest ? (
                            <button
                                className={`${parchmentStyles.button} ${styles.investBtn}`}
                                onClick={() => handlePendingInvest(skillName)}
                            >
                                <TrendingUp size={12} /> Invest {investCost} SP
                            </button>
                        ) : investCost !== null ? (
                            <span className={styles.lockedReason} title={lockReason}>
                                <Lock size={12} /> {lockReason}
                            </span>
                        ) : null}
                    </div>
                </div>

                {effectiveTier >= 3 && (
                    <div className={styles.abilityChoice}>
                        <Zap size={12} />
                        <span>Tier {effectiveTier} ability: <em>Coming soon</em></span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className={styles.container}>
            {/* Header */}
            <div className={styles.header}>
                <div className={styles.titleRow}>
                    <h1 className={styles.title}>Skill Mastery</h1>
                    <div className={styles.spCounter}>
                        <Shield size={16} />
                        <span className={styles.spValue}>{effectiveSpAvailable}</span>
                        <span className={styles.spLabel}>SP Available</span>
                        <span className={styles.spTotal}>({sp.totalEarned} earned)</span>
                    </div>
                </div>

                {/* Confirm / Revert bar — shown when pending changes exist */}
                {hasPendingChanges && (
                    <div className={styles.pendingBar}>
                        <span>{pending.length} pending investment{pending.length > 1 ? 's' : ''} ({pendingSpUsed} SP)</span>
                        <button className={`${parchmentStyles.button} ${styles.confirmBtn}`} onClick={handleConfirm}>
                            <Check size={14} /> Confirm
                        </button>
                        <button className={`${parchmentStyles.button} ${styles.revertBtn}`} onClick={handleRevert}>
                            <X size={14} /> Revert
                        </button>
                    </div>
                )}

                <div className={styles.headerActions}>
                    <span className={styles.levelInfo}>Level {pc.level} {pc.class}</span>
                    <span className={styles.profInfo}>Prof Bonus: +{profBonus}</span>
                    {!confirmReset ? (
                        <button
                            className={`${parchmentStyles.button} ${styles.resetBtn}`}
                            onClick={() => setConfirmReset(true)}
                            disabled={!hasInvestedPoints || hasPendingChanges}
                            title={hasPendingChanges ? 'Confirm or revert pending changes first' : ''}
                        >
                            <RotateCcw size={14} /> Reset All
                        </button>
                    ) : (
                        <div className={styles.confirmReset}>
                            <span>Reset all invested SP?</span>
                            <button className={`${parchmentStyles.button} ${styles.confirmYes}`} onClick={handleReset}>Yes</button>
                            <button className={`${parchmentStyles.button} ${styles.confirmNo}`} onClick={() => setConfirmReset(false)}>No</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Skill Groups */}
            <div className={styles.groups}>
                {ABILITY_GROUPS.map(({ ability, label, color }) => {
                    const skills = groupedSkills[ability] || [];
                    if (skills.length === 0) return null;
                    const expanded = expandedGroups[ability];

                    return (
                        <div key={ability} className={styles.group}>
                            <div
                                className={styles.groupHeader}
                                onClick={() => toggleGroup(ability)}
                                style={{ borderLeftColor: color }}
                            >
                                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                <span className={styles.groupLabel} style={{ color }}>
                                    {label}
                                </span>
                                <span className={styles.groupAbility}>({ability})</span>
                                <span className={styles.groupCount}>
                                    {skills.filter(s => getEffectiveTier(s.name) > 0).length}/{skills.length}
                                </span>
                            </div>
                            {expanded && (
                                <div className={styles.groupSkills}>
                                    {skills.map(s => renderSkillCard(s.name, s.def))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default SkillTreePage;
