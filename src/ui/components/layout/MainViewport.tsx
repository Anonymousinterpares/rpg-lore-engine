import React, { useState, useRef } from 'react';
import styles from './MainViewport.module.css';
import NarrativeBox from '../narrative/NarrativeBox';
import PlayerInputField from '../actions/PlayerInputField';
import InitiativeTracker from '../combat/InitiativeTracker';
import CombatLog from '../combat/CombatLog';
import DiceRoller from '../combat/DiceRoller';
import CombatActionBar from '../combat/CombatActionBar';
import LoadingOverlay from '../common/LoadingOverlay';
import TurnBanner from '../combat/TurnBanner';
import CombatOverlay from '../combat/CombatOverlay';
import CombatantStatusCard from '../combat/CombatantStatusCard';
import GameOverScreen from '../menu/GameOverScreen';
import SaveLoadModal from '../menu/SaveLoadModal';
import RestWaitModal from '../exploration/RestWaitModal';
import ArcaneRecoveryFlyout from '../exploration/ArcaneRecoveryFlyout';
import SpellLearningFlyout from '../exploration/SpellLearningFlyout';
import ExamineOverlay from '../combat/ExamineOverlay';
import LevelUpOverlay from '../combat/LevelUpOverlay';
import { useGameState } from '../../hooks/useGameState';
import { useCallback, useEffect } from 'react';

interface MainViewportProps {
    className?: string;
    onCodex?: (category: string, entryId: string) => void;
    onCharacterSheet?: () => void;
}

const MainViewport: React.FC<MainViewportProps> = ({ className, onCodex, onCharacterSheet }) => {
    const { state, processCommand, isLoading, isProcessing, endGame, engine, startGame, loadGame, loadLastSave, getSaveRegistry } = useGameState();
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [showRestModal, setShowRestModal] = useState(false);
    const [inspectedCombatantId, setInspectedCombatantId] = useState<string | null>(null);
    const [saveSlots, setSaveSlots] = useState<any[]>([]);
    const [pendingCombat, setPendingCombat] = useState<any>(null);
    const [arcaneRecovery, setArcaneRecovery] = useState<{ budget: number } | null>(null);
    const [levelUpStage, setLevelUpStage] = useState<'none' | 'overlay' | 'spells' | 'done'>('none');

    // Examine overlay orchestration
    const [examineOverlay, setExamineOverlay] = useState<any>(null);
    const [narrativePaused, setNarrativePaused] = useState(false);
    const [isTyping, setIsTyping] = useState(false);
    const lastSkillCheckIdRef = useRef<string | null>(null);

    // Level up overlay
    const [levelUpOverlay, setLevelUpOverlay] = useState<{ level: number; className: string; spGained: number; hasASI: boolean } | null>(null);
    const lastLevelRef = useRef<number>(state?.character?.level || 0);

    // Skip-to-end for typewriter
    const [skipFn, setSkipFn] = useState<(() => void) | null>(null);
    const instantNarration = !!(state?.settings as any)?.video?.instantNarration;

    // Detect new skill check from engine state → show dice overlay
    // This does NOT stop any running typewriter — it only gates future narrative text
    useEffect(() => {
        const sc = state?.lastSkillCheck;
        if (sc && sc.id !== lastSkillCheckIdRef.current) {
            lastSkillCheckIdRef.current = sc.id;
            setExamineOverlay(sc);
            setNarrativePaused(true);
        }
    }, [state?.lastSkillCheck]);

    // Detect level up → show overlay (handles multi-level jumps)
    useEffect(() => {
        const currentLevel = state?.character?.level || 0;
        if (currentLevel > lastLevelRef.current && lastLevelRef.current > 0) {
            const levelsGained = currentLevel - lastLevelRef.current;
            const ASI_LEVELS = [4, 8, 12, 16, 19];
            const hasASI = ASI_LEVELS.some(l => l > lastLevelRef.current && l <= currentLevel);
            const spPerLevel = (state?.character as any)?.skillPoints ? 2 : 0; // approximate
            setLevelUpOverlay({
                level: currentLevel,
                className: state?.character?.class || '',
                spGained: levelsGained * spPerLevel,
                hasASI,
            });
            setLevelUpStage('overlay');
        }
        lastLevelRef.current = currentLevel;
    }, [state?.character?.level]);

    // Open character sheet after level-up sequence completes
    useEffect(() => {
        if (levelUpStage === 'done') {
            setLevelUpStage('none');
            if (onCharacterSheet) onCharacterSheet();
        }
    }, [levelUpStage, onCharacterSheet]);

    const handleExamineOverlayComplete = useCallback(() => {
        setExamineOverlay(null);
        setNarrativePaused(false);
        // Narrative will start typewriter when paused becomes false
    }, []);

    // Refresh registry when modal opens
    useEffect(() => {
        const fetchRegistry = async () => {
            if (showLoadModal && engine) {
                const registry = await getSaveRegistry();
                const slots = registry.slots.map((s: any) => ({
                    id: s.id,
                    name: s.slotName || 'Quick Save',
                    charName: s.characterName,
                    level: s.characterLevel,
                    location: s.locationSummary,
                    lastSaved: new Date(s.lastSaved).toLocaleString(),
                    playTime: `${Math.floor(s.playTimeSeconds / 60)}m`
                }));
                setSaveSlots(slots);
            }
        };
        fetchRegistry();
    }, [showLoadModal, engine, getSaveRegistry]);

    const isCombat = state?.mode === 'COMBAT';

    // Dev shortcut: Ctrl+Shift+F12 — instant combat win
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'F12' && engine && state?.mode === 'COMBAT') {
                e.preventDefault();
                engine.devWinCombat();
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [engine, state?.mode]);

    // Fail-safe: Ensure Rest modal closes if combat starts
    useEffect(() => {
        if (isCombat && showRestModal) {
            setShowRestModal(false);
        }
    }, [isCombat, showRestModal]);

    const handleRestCancel = useCallback(() => {
        setShowRestModal(false);
    }, []);

    const handleAmbush = useCallback(async (encounter: any, narration: string) => {
        setPendingCombat(encounter);
        if (engine) {
            await engine.setNarrative(narration);
        }
    }, [engine]);

    const handleTypingStart = useCallback(() => {
        setIsTyping(true);
    }, []);

    const handleTypingComplete = useCallback(async () => {
        setIsTyping(false);
        if (pendingCombat && engine) {
            await engine.initializeCombat(pendingCombat);
            setPendingCombat(null);
        }
    }, [pendingCombat, engine]);

    const handleInspect = (id: string) => {
        setInspectedCombatantId(prev => prev === id ? null : id);
    };

    const isGameOver = state?.mode === 'GAME_OVER';

    const narrativeText = state?.lastNarrative || state?.storySummary ||
        "Welcome to your adventure. Describe your first move...";

    const locationTitle = state ?
        `${isCombat ? '[COMBAT] ' : ''}Coordinates: [${state.location.coordinates.join(', ')}]` :
        "Starting Location";

    const suggestedActions = isCombat ? [
        "Attack",
        "Dodge",
        "Use Item",
        "Exit Combat"
    ] : [
        "Look around",
        "Check gear",
        "Rest"
    ];

    const handlePlayerInput = async (input: string) => {
        if (input.toLowerCase() === 'rest') {
            setShowRestModal(true);
            return;
        }
        await processCommand(input);
    };

    const handleLoadGame = async (saveId: string) => {
        await loadGame(saveId);
        setShowLoadModal(false);
    };

    const handleLoadLastSave = async () => {
        await loadLastSave();
    };

    const handleReturnToMenu = () => {
        endGame();
    };

    const handleOpenLoadModal = () => {
        setShowLoadModal(true);
    };

    const inspectedCombatant = state?.combat?.combatants.find(c => c.id === inspectedCombatantId);
    const playerCombatant = state?.combat?.combatants.find(c => c.isPlayer);

    // Determine processing message for input field
    // isProcessing: command sent, awaiting LLM response
    // examineOverlay: dice overlay is showing
    // isTyping: typewriter is actively producing text
    const inputDisabled = isProcessing || !!examineOverlay || isTyping;
    const processingMessage = isProcessing
        ? 'The narrator contemplates...'
        : examineOverlay
            ? 'The narrator contemplates...'
            : isTyping
                ? 'The narrator is answering...'
                : undefined;

    return (
        <main className={`${styles.viewport} ${className} ${isCombat ? styles.combatMode : ''}`}>
            {/* Loading Overlay */}
            {isLoading && <LoadingOverlay message="Loading..." />}

            {/* Examine Dice Roll Overlay */}
            {examineOverlay && (
                <ExamineOverlay
                    skillCheck={examineOverlay}
                    onComplete={handleExamineOverlayComplete}
                />
            )}

            {/* Level Up Overlay */}
            {levelUpOverlay && (
                <LevelUpOverlay
                    level={levelUpOverlay.level}
                    className={levelUpOverlay.className}
                    spGained={levelUpOverlay.spGained}
                    hasASI={levelUpOverlay.hasASI}
                    onComplete={() => {
                        setLevelUpOverlay(null);
                        // Check if spell learning is pending
                        if ((state?.character as any)?._pendingSpellChoices > 0) {
                            setLevelUpStage('spells');
                        } else {
                            // No spells to learn — go straight to character sheet
                            setLevelUpStage('done');
                        }
                    }}
                />
            )}

            {isGameOver && (
                <GameOverScreen
                    onLoadLastSave={handleLoadLastSave}
                    onReturnToMenu={handleReturnToMenu}
                    onLoadGame={handleOpenLoadModal}
                />
            )}

            {showLoadModal && (
                <SaveLoadModal
                    mode="load"
                    slots={saveSlots}
                    onAction={handleLoadGame}
                    onDelete={() => { }}
                    onClose={() => setShowLoadModal(false)}
                />
            )}

            {showRestModal && (
                <RestWaitModal
                    engine={engine}
                    onCancel={handleRestCancel}
                    onAmbush={handleAmbush}
                    onArcaneRecovery={(budget) => setArcaneRecovery({ budget })}
                />
            )}

            {arcaneRecovery && state?.character?.spellSlots && (
                <ArcaneRecoveryFlyout
                    budget={arcaneRecovery.budget}
                    spellSlots={state.character.spellSlots}
                    onConfirm={async (choices) => {
                        if (engine) await engine.applyArcaneRecovery(choices);
                        setArcaneRecovery(null);
                    }}
                    onSkip={() => setArcaneRecovery(null)}
                />
            )}

            {state?.character && (state.character as any)._pendingSpellChoices > 0 && levelUpStage !== 'overlay' && (
                <SpellLearningFlyout
                    className={state.character.class}
                    maxLevel={Math.min(9, Math.ceil(state.character.level / 2))}
                    count={(state.character as any)._pendingSpellChoices}
                    alreadyKnown={[
                        ...(state.character.cantripsKnown || []),
                        ...(state.character.knownSpells || []),
                        ...(state.character.spellbook || []),
                    ]}
                    onConfirm={async (names) => {
                        if (engine) await engine.learnSpells(names);
                        setLevelUpStage('done');
                    }}
                    onSkip={() => {
                        if (state?.character) (state.character as any)._pendingSpellChoices = 0;
                        setLevelUpStage('done');
                    }}
                />
            )}

            {isCombat && state.combat && (
                <>
                    <TurnBanner />
                    <CombatOverlay events={state.combat.events} />
                    <div className={styles.combatTopBar}>
                        <InitiativeTracker
                            combatants={state.combat.combatants}
                            currentTurnId={state.combat.combatants[state.combat.currentTurnIndex]?.id || ''}
                            selectedTargetId={state.combat.selectedTargetId}
                            onSelectTarget={async (id) => await processCommand(`/target ${id}`)}
                            onInspect={handleInspect}
                        />
                    </div>

                    {inspectedCombatant && playerCombatant && (
                        <div className={styles.inspectorContainer}>
                            <CombatantStatusCard
                                combatant={inspectedCombatant}
                                playerPos={playerCombatant.position}
                                cover="None"
                                lighting="Bright"
                                onClose={() => setInspectedCombatantId(null)}
                            />
                        </div>
                    )}
                </>
            )}

            <div className={styles.centerArea}>
                <div className={styles.narrativeContainer}>
                    <NarrativeBox
                        title={locationTitle}
                        text={narrativeText}
                        paused={narrativePaused}
                        instantMode={instantNarration}
                        onTypingStart={handleTypingStart}
                        onTypingComplete={handleTypingComplete}
                        onSkipAvailable={(fn) => setSkipFn(() => fn)}
                    />
                </div>

                {isCombat && state.combat && (
                    <div className={styles.combatSidePanel}>
                        <CombatLog
                            logs={state.combat.logs}
                            className={styles.combatLog}
                        />
                        <DiceRoller
                            className={styles.combatDice}
                            sides={20}
                            result={state.combat.lastRoll}
                            isRolling={isLoading}
                            onOpenCodex={onCodex}
                        />
                    </div>
                )}
            </div>

            <div className={styles.actionBar}>
                {pendingCombat ? (
                    <div style={{ textAlign: 'center', padding: '12px', opacity: 0.7, fontStyle: 'italic' }}>
                        Ambush...
                    </div>
                ) : isCombat ? (
                    <CombatActionBar />
                ) : (
                    <PlayerInputField
                        suggestedActions={suggestedActions}
                        onSubmit={handlePlayerInput}
                        placeholder={state?.activeDialogueNpcId ? `Say something to ${state.worldNpcs.find(n => n.id === state.activeDialogueNpcId)?.name}...` : "What do you do?"}
                        disabled={inputDisabled}
                        processingMessage={processingMessage}
                        onSkipToEnd={skipFn}
                    />
                )}
            </div>
        </main>
    );
};

export default MainViewport;
