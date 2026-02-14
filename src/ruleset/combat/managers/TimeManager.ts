import { GameState } from '../../schemas/FullSaveStateSchema';
import { WorldClockEngine } from '../WorldClockEngine';
import { WeatherEngine } from '../WeatherEngine';
import { EncounterDirector, Encounter } from '../EncounterDirector';
import { HexMapManager } from '../HexMapManager';
import { RestingEngine } from '../RestingEngine';

/**
 * Manages game world time, weather intervals, resting benefits, and event tracking.
 */
export class TimeManager {
    constructor(
        private state: GameState,
        private hexMapManager: HexMapManager,
        private director: EncounterDirector,
        private emitStateUpdate: () => Promise<void>,
        private initializeCombat: (encounter: Encounter) => Promise<void>
    ) { }

    /**
     * Centralized time advancement that processes intervals (Encounters, Weather)
     */
    public async advanceTimeAndProcess(totalMinutes: number, isResting: boolean = false): Promise<Encounter | null> {
        let remainingMinutes = totalMinutes;
        const INTERVAL = 30; // Check every 30 minutes
        let resultEncounter: Encounter | null = null;

        while (remainingMinutes > 0) {
            const step = Math.min(remainingMinutes, INTERVAL);

            this.state.worldTime = WorldClockEngine.advanceTime(this.state.worldTime, step);
            remainingMinutes -= step;

            if (this.state.weather.durationMinutes > 0) {
                this.state.weather.durationMinutes -= step;
            }
            if (this.state.weather.durationMinutes <= 0) {
                this.state.weather = WeatherEngine.generateWeather(this.state.worldTime);
            }

            await this.emitStateUpdate();

            if (this.state.mode === 'EXPLORATION' && !resultEncounter) {
                const currentHex = this.hexMapManager.getHex(this.state.location.hexId);
                const encounter = this.director.checkEncounter(this.state, currentHex || {}, isResting);
                if (encounter) {
                    resultEncounter = encounter;
                    break;
                }
            }
        }

        return resultEncounter;
    }

    /**
     * Applies the mechanical benefits of resting after time has passed.
     */
    public completeRest(durationMinutes: number): string {
        let restResult;
        if (durationMinutes >= 480) {
            restResult = RestingEngine.longRest(this.state.character);
        } else if (durationMinutes >= 60) {
            restResult = RestingEngine.shortRest(this.state.character);
        } else {
            restResult = RestingEngine.wait(durationMinutes);
        }
        this.emitStateUpdate();
        return restResult.message;
    }

    /**
     * Tracks tutorial-related events and updates quest progress.
     */
    public async trackTutorialEvent(eventId: string) {
        if (!this.state.triggeredEvents) this.state.triggeredEvents = [];
        if (this.state.triggeredEvents.includes(eventId)) return;

        this.state.triggeredEvents.push(eventId);

        const tutorialQuest = this.state.activeQuests?.find(q => q.id === 'tutorial_01');
        if (!tutorialQuest) return;

        if (eventId.startsWith('viewed_page:')) {
            const tutorialPages = ['character', 'world_map', 'quests', 'equipment', 'codex'];
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_master_booklet');
            if (obj && !obj.isCompleted) {
                const viewedTutorialPages = this.state.triggeredEvents.filter(e =>
                    e.startsWith('viewed_page:') && tutorialPages.includes(e.split(':')[1])
                );
                obj.currentProgress = viewedTutorialPages.length;
                if (obj.currentProgress >= obj.maxProgress) {
                    obj.isCompleted = true;
                }
            }
        }

        if (eventId.startsWith('examined_item:')) {
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_study_gear');
            if (obj && !obj.isCompleted) {
                obj.currentProgress = 1;
                obj.isCompleted = true;
            }
        }

        if (eventId === 'moved_hex') {
            const obj = tutorialQuest.objectives.find(o => o.id === 'obj_begin_journey');
            if (obj && !obj.isCompleted) {
                obj.currentProgress = 1;
                obj.isCompleted = true;
            }
        }

        await this.emitStateUpdate();
    }
}
