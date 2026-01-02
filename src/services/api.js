/**
 * API Service for communicating with Go (Fiber) Backend
 * Handles recording upload, processing, and zoom instruction submission
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * Submit a zoom instruction to the backend for rendering
 * @param {Object} instruction - The zoom instruction (pure facts only)
 * @returns {Promise<Object>} Backend response
 */
export async function submitZoomInstruction(instruction) {
    const response = await fetch(`${API_BASE_URL}/render/zoom`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            "inputVideoPath": "video.webm",
            instruction
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Submit multiple zoom instructions for batch rendering
 * @param {Array<Object>} instructions - Array of zoom instructions
 * @returns {Promise<Object>} Backend response
 */
export async function submitBatchZoomInstructions(instructions) {
    // Backend expects a different format:
    // - Single "frame" at top level (not per instruction)
    // - "effects" array (not "instructions")
    // - Each effect has only: startTimeMs, durationMs, boundingBox

    if (!instructions || instructions.length === 0) {
        throw new Error('No instructions to send');
    }

    // Extract frame from first instruction (all should have same frame)
    const frame = instructions[0].frame;

    // Transform instructions to effects format
    const effects = instructions.map(inst => ({
        startTimeMs: inst.startTimeMs,
        durationMs: inst.durationMs,
        boundingBox: inst.boundingBox
    }));

    const payload = {
        inputVideoPath: "video.webm",
        frame: frame,
        effects: effects
    };

    console.log('[API] Sending to backend:', JSON.stringify(payload, null, 2));

    const response = await fetch(`${API_BASE_URL}/render/zoom/batch`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
}
