
/**
 * AI Summarizer Module
 * Tier 1: Rule-based Heuristics (Works everywhere)
 * Tier 2: Chrome Built-in AI (Future / Gemini Nano)
 */
const DiaryAI = {

    // Main entry point
    summarizeDay: async (entries) => {
        // 1. Try Native AI (Future Proofing)
        // if (window.ai && await window.ai.canCreateTextSession() === 'readily') { ... }

        // 2. Fallback to Heuristic Engine
        return DiaryAI.heuristicSummary(entries);
    },

    heuristicSummary: (entries) => {
        if (!entries || entries.length === 0) return "No events to summarize.";

        // Gather Stats
        const places = entries.filter(e => e.type === 'stationary');
        const moves = entries.filter(e => e.type === 'moving');

        let totalDist = 0;
        const modes = new Set();
        moves.forEach(m => {
            if (m.distance) totalDist += m.distance;
            if (m.activity) modes.add(m.activity.split(' ')[0]); // Remove emojis for text
        });

        // Generate Narrative
        const verbs = ["visited", "stopped at", "checked into", "explored"];
        const placeNames = places.map(p => {
            if (p.location && typeof p.location === 'object' && p.location.name) return p.location.name;
            if (typeof p.location === 'string') return p.location;
            return "Unknown Location";
        });

        let summary = "";

        // Introduction
        if (places.length > 5) {
            summary += `What a busy day! You made ${places.length} stops. `;
        } else if (places.length === 0 && moves.length > 0) {
            summary += `A day spent entirely on the move. `;
        } else if (places.length > 0) {
            summary += `You visited ${places.length} places today. `;
        }

        // Middle (The Journey)
        if (totalDist > 0) {
            summary += `Covering a total of ${totalDist.toFixed(1)} km`;
            if (modes.size > 0) {
                // Formatting modes (e.g., "by car and walking")
                const modeList = Array.from(modes).join(', ').toLowerCase();
                summary += ` mostly by ${modeList}. `;
            } else {
                summary += `. `;
            }
        }

        // Highlights
        if (placeNames.length > 0) {
            const uniquePlaces = [...new Set(placeNames)].slice(0, 3); // Top 3 unique
            summary += `Highlights included ${uniquePlaces.join(', ')}`;
            if (placeNames.length > 3) summary += `, among others.`;
            else summary += `.`;
        }

        return summary;
    }
};

window.DiaryAI = DiaryAI;
