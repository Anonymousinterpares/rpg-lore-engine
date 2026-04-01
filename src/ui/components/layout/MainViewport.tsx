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
import ExamineOverlay from '../combat/ExamineOverlay';
import { useGameState } from '../../hooks/useGameState';
import { useCallback, useEffect } from 'react';

interface MainViewportProps {
    className?: string;
    onCodex?: (category: string, entryId: string) => void;
}

const MainViewport: React.FC<MainViewportProps> = ({ className, onCodex }) => {
    const { state, processCommand, isLoading, isProcessing, endGame, engine, startGame, loadGame, loadLastSave, getSaveRegistry } = useGameState();
    const [showLoadModal, setShowLoadModal] = useState(false);
    const [showRestModal, setShowRestModal] = useState(false);
    const [inspectedCombatantId, setInspectedCombatantId] = useState<string | null>(null);
    const [saveSlots, setSaveSlots] = useState<any[]>([]);
    const [pendingCombat, setPendingCombat] = useState<any>(null);

    // Examine overlay orchestration
    const [examineOverlay, setExamineOverlay] = useState<any>(null);
    const [narrativePaused, setNarrativePaused] = useState(false);
    const [isTyping, setIsTyping] = useState(false); // true while NarrativeBox typewriter is active
    const lastSkillCheckIdRef = useRef<string | null>(null);

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
                        onTypingStart={handleTypingStart}
                        onTypingComplete={handleTypingComplete}
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
                    />
                )}
            </div>
        </main>
    );
};

export default MainViewport;
