/**
 * Snapshot Difference Engine
 * Compares current active combat/session state against a SQLite checkpoint snapshot.
 */

/**
 * Computes a detailed diff between the current active game state and a saved snapshot.
 * 
 * @param {object} db - SQLite database connection
 * @param {number} snapshotId - Snapshot ID to compare against
 * @param {number} currentRound - Current active combat round
 * @param {number} currentTurnIndex - Current active combat turn index
 * @param {function} getTrackerState - Function returning the active initiative tracker list
 * @param {function} getAllCharacters - Function returning all characters in the campaign
 * @param {function} getSessionState - Function returning session state for a character ID
 * @returns {object} Calculated diff payload
 */
function computeSnapshotDiff(db, snapshotId, currentRound, currentTurnIndex, getTrackerState, getAllCharacters, getSessionState) {
    const snapshot = db.prepare('SELECT * FROM combat_snapshots WHERE id = ?').get(snapshotId);
    if (!snapshot) {
        throw new Error('Snapshot not found');
    }

    const snapshotTracker = JSON.parse(snapshot.tracker_state_json || '[]');
    const snapshotSessionStates = JSON.parse(snapshot.session_states_json || '[]');

    const liveTracker = getTrackerState() || [];
    const allCharacters = getAllCharacters() || [];

    // 1. Chronology Diff
    const chronology = {
        round: {
            current: currentRound,
            snapshot: snapshot.combat_round,
            changed: currentRound !== snapshot.combat_round
        },
        turnIndex: {
            current: currentTurnIndex,
            snapshot: snapshot.combat_turn_index,
            changed: currentTurnIndex !== snapshot.combat_turn_index
        }
    };

    // 2. Initiative Roster Diff
    const roster = {
        added: [],   // Live entities that DO NOT exist in snapshot (will be deleted)
        removed: [], // Snapshot entities that DO NOT exist in live (will be restored)
        changed: []  // Entities existing in both but having HP, AC, Initiative, or Active diffs
    };

    const liveTrackerMap = new Map(liveTracker.map(e => [e.id, e]));
    const snapshotTrackerMap = new Map(snapshotTracker.map(e => [e.id, e]));

    // Check for added and changed
    for (const liveEntity of liveTracker) {
        const snapEntity = snapshotTrackerMap.get(liveEntity.id);
        if (!snapEntity) {
            roster.added.push({
                id: liveEntity.id,
                name: liveEntity.entity_name,
                type: liveEntity.entity_type,
                hp: liveEntity.current_hp,
                maxHp: liveEntity.max_hp
            });
        } else {
            const hpChanged = liveEntity.current_hp !== snapEntity.current_hp;
            const acChanged = liveEntity.ac !== snapEntity.ac;
            const initChanged = liveEntity.initiative !== snapEntity.initiative;
            const activeChanged = liveEntity.is_active !== snapEntity.is_active;

            if (hpChanged || acChanged || initChanged || activeChanged) {
                roster.changed.push({
                    id: liveEntity.id,
                    name: liveEntity.entity_name,
                    type: liveEntity.entity_type,
                    hp: { current: liveEntity.current_hp, snapshot: snapEntity.current_hp, changed: hpChanged },
                    ac: { current: liveEntity.ac, snapshot: snapEntity.ac, changed: acChanged },
                    initiative: { current: liveEntity.initiative, snapshot: snapEntity.initiative, changed: initChanged },
                    isActive: { current: liveEntity.is_active, snapshot: snapEntity.is_active, changed: activeChanged }
                });
            }
        }
    }

    // Check for removed
    for (const snapEntity of snapshotTracker) {
        if (!liveTrackerMap.has(snapEntity.id)) {
            roster.removed.push({
                id: snapEntity.id,
                name: snapEntity.entity_name,
                type: snapEntity.entity_type,
                hp: snapEntity.current_hp,
                maxHp: snapEntity.max_hp
            });
        }
    }

    // 3. Character Session State Diffs (HP, Conditions, Slots)
    const characters = [];
    const liveCharactersMap = new Map(allCharacters.map(c => [c.id, c]));

    for (const snapState of snapshotSessionStates) {
        const charId = snapState.characterId;
        const liveChar = liveCharactersMap.get(charId);
        if (!liveChar) continue;

        const liveState = getSessionState(db, charId);
        if (!liveState) continue;

        // HP check
        const hpChanged = liveState.currentHp !== snapState.currentHp || liveState.tempHp !== snapState.tempHp;

        // Conditions check
        const liveConds = new Set(liveState.activeConditions || []);
        const snapConds = new Set(snapState.activeConditions || []);

        const conditionsAdded = [...liveConds].filter(c => !snapConds.has(c));   // Active now, but rollback removes
        const conditionsRemoved = [...snapConds].filter(c => !liveConds.has(c)); // Active in snap, rollback restores

        const conditionsChanged = conditionsAdded.length > 0 || conditionsRemoved.length > 0;

        // Spell Slots check
        const slotsChanged = [];
        const allLevels = new Set([
            ...Object.keys(liveState.spellSlotsUsed || {}),
            ...Object.keys(snapState.spellSlotsUsed || {})
        ]);

        for (const level of allLevels) {
            const currentUsed = liveState.spellSlotsUsed[level] || 0;
            const snapUsed = snapState.spellSlotsUsed[level] || 0;
            if (currentUsed !== snapUsed) {
                slotsChanged.push({
                    level,
                    currentUsed,
                    snapUsed
                });
            }
        }

        // Active Buffs check
        const liveBuffs = new Set((liveState.activeBuffs || []).map(b => b.name));
        const snapBuffs = new Set((snapState.activeBuffs || []).map(b => b.name));

        const buffsAdded = [...liveBuffs].filter(b => !snapBuffs.has(b));
        const buffsRemoved = [...snapBuffs].filter(b => !liveBuffs.has(b));

        const buffsChanged = buffsAdded.length > 0 || buffsRemoved.length > 0;

        if (hpChanged || conditionsChanged || slotsChanged.length > 0 || buffsChanged) {
            characters.push({
                id: charId,
                name: liveChar.name,
                hp: {
                    current: { hp: liveState.currentHp, temp: liveState.tempHp },
                    snapshot: { hp: snapState.currentHp, temp: snapState.tempHp },
                    changed: hpChanged
                },
                conditions: {
                    added: conditionsAdded,
                    removed: conditionsRemoved,
                    changed: conditionsChanged
                },
                spellSlots: {
                    changed: slotsChanged
                },
                buffs: {
                    added: buffsAdded,
                    removed: buffsRemoved,
                    changed: buffsChanged
                }
            });
        }
    }

    return {
        id: snapshot.id,
        description: snapshot.description,
        timestamp: snapshot.snapshot_time,
        chronology,
        roster,
        characters
    };
}

module.exports = {
    computeSnapshotDiff
};
