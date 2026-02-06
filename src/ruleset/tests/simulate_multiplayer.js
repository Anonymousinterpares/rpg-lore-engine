import { SignalingServer } from '../combat/SignalingServer';
import { MultiplayerHost } from '../combat/MultiplayerHost';
import { MultiplayerClient } from '../combat/MultiplayerClient';
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function verifyMultiplayer() {
    console.log("--- Starting Multiplayer System Verification ---");
    const PORT_SIGNALING = 4001;
    const PORT_HOST = 3001;
    // 1. Start Signaling Server
    const sigServer = new SignalingServer(PORT_SIGNALING);
    sigServer.start();
    // 2. Mock initial state
    const initialState = {
        saveId: "mp-test-1",
        saveVersion: 1,
        createdAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        playTimeSeconds: 0,
        character: {
            name: "HostPlayer",
            level: 1,
            race: "Human",
            class: "Fighter",
            conditions: [],
            stats: { STR: 16, DEX: 12, CON: 14, INT: 10, WIS: 12, CHA: 10 },
            savingThrowProficiencies: ["STR", "CON"],
            skillProficiencies: ["Athletics"],
            hp: { current: 12, max: 12, temp: 0 },
            deathSaves: { successes: 0, failures: 0 },
            hitDice: { current: 1, max: 1, dieType: "1d10" },
            spellSlots: {},
            cantripsKnown: [],
            knownSpells: [],
            preparedSpells: [],
            spellbook: [],
            unseenSpells: [],
            ac: 16,
            inventory: { gold: { cp: 0, sp: 0, ep: 0, gp: 10, pp: 0 }, items: [] },
            equipmentSlots: {},
            biography: { traits: [], ideals: [], bonds: [], flaws: [], chronicles: [] },
            xp: 0,
            inspiration: false,
            attunedItems: [],
            featureUsages: {},
            knownEntities: {
                monsters: [],
                items: []
            }
        },
        companions: [],
        mode: "EXPLORATION",
        location: { hexId: "0,0", coordinates: [0, 0], droppedItems: [] },
        worldTime: { hour: 10, day: 1, month: 1, year: 1492, totalTurns: 1 },
        worldMap: { grid_id: "main", hexes: {} },
        subLocations: [],
        worldNpcs: [],
        activeQuests: [],
        factions: [],
        storySummary: "",
        lastNarrative: "",
        conversationHistory: [],
        triggeredEvents: [],
        settings: {
            permadeath: false,
            variantEncumbrance: false,
            milestoneLeveling: true,
            criticalFumbleEffects: false,
            difficultyModifier: 1.0,
            inspirationEnabled: true,
            multiclassingAllowed: true,
            maxConversationHistoryTurns: 50
        },
        codexEntries: [],
        notifications: []
    };
    // 3. Start Multiplayer Host
    const host = new MultiplayerHost(initialState, "The Host", PORT_HOST);
    host.start();
    // 4. Register Session with Signaling Server
    const sessionInfo = {
        sessionId: "session-1",
        hostName: "The Dungeon Master",
        hostEndpoint: `http://localhost:${PORT_HOST}`,
        currentPlayers: 1,
        maxPlayers: 4,
        createdAt: new Date().toISOString(),
        lastPing: new Date().toISOString()
    };
    await fetch(`http://localhost:${PORT_SIGNALING}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionInfo)
    });
    console.log("Session registered with lobby.");
    // 5. Client Discovery & Join
    console.log("Client discovering sessions...");
    const res = await fetch(`http://localhost:${PORT_SIGNALING}/sessions`);
    const sessions = await res.json();
    console.log(`Found ${sessions.length} sessions.`);
    if (sessions.length > 0) {
        const client = new MultiplayerClient(sessions[0].hostEndpoint);
        console.log("Joining session as 'Adventurer'...");
        const playerId = await client.join("Adventurer", "Adventurer-Char");
        console.log(`Joined with ID: ${playerId}`);
        // 6. Test Chat
        console.log("Sending chat message...");
        await client.sendChat("Hello from the client!");
        await sleep(500); // Wait for processing
        const state = await client.getState();
        console.log(`Chat history length: ${state.chatHistory.length}`);
        const lastMsg = state.chatHistory[state.chatHistory.length - 1];
        console.log(`Last message: [${lastMsg.playerName}] ${lastMsg.content}`);
        if (lastMsg.content === "Hello from the client!") {
            console.log("✅ Chat verification successful.");
        }
        else {
            console.error("❌ Chat verification failed.");
        }
        // 7. Test Turn Sync
        console.log(`Current player: ${state.currentPlayerId}`);
        console.log(`Wait, it's host's turn. Host should END_TURN.`);
        // Host (which is us in the same process) usually has its own client logic
        // But for simulation, we can just call the internal host method if we had access
        // Or better, use another client as the host player
        const hostClient = new MultiplayerClient(`http://localhost:${PORT_HOST}`);
        await hostClient.join("The Host", "The Host-Char"); // This just links the ID
        const hostPlayerId = 'host-player'; // From MultiplayerHost.ts constructor
        console.log("Host ending turn...");
        await hostClient.submitAction({ actionType: 'END_TURN' });
        await sleep(500);
        const stateAfter = await client.getState();
        console.log(`Current player after advance: ${stateAfter.currentPlayerId}`);
        if (stateAfter.currentPlayerId === playerId) {
            console.log("✅ Turn synchronization successful.");
        }
        else {
            console.error("❌ Turn synchronization failed.");
        }
    }
    console.log("--- Verification Complete ---");
    process.exit(0);
}
verifyMultiplayer().catch(err => {
    console.error(err);
    process.exit(1);
});
