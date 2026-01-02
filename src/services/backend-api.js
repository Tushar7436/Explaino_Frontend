/**
 * Backend API Service for Explaino
 * Handles recording processing, querying, and WebSocket connections
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000';

/**
 * Process a recording through the AI pipeline (Deepgram + LLM + TTS)
 * @param {Object} payload - Processing request payload
 * @returns {Promise<Object>} Processing response
 */
export async function processRecording(payload) {
    const response = await fetch(`${API_BASE_URL}/api/process-recording`, {
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

/**
 * Process a recorded session by sessionId
 * Backend will load files, transcribe with Deepgram, generate narrations
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Processing response with transcript and narrations
 */
export async function processSession(sessionId) {
    const response = await fetch(`${API_BASE_URL}/api/process-session`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    // Backend wraps response in { success: true, data: {...} }
    return result.data || result;
}

/**
 * Generate speech with ElevenLabs TTS (called when user clicks "Generate Speech" button)
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Speech generation response with processedAudioUrl
 */
export async function generateSpeech(sessionId) {
    const response = await fetch(`${API_BASE_URL}/api/generate-speech`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    const result = await response.json();
    // Backend wraps response in { success: true, data: {...} }
    return result.data || result;
}

/**
 * Export video with FFmpeg rendering (called when user clicks export button)
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Export response with processedVideoUrl
 */
export async function exportVideo(sessionId) {
    const response = await fetch(`${API_BASE_URL}/api/export-video`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get complete recording data including narrations, instructions, and effects
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} Complete recording data
 */
export async function getCompleteRecording(sessionId) {
    const response = await fetch(`${API_BASE_URL}/api/recordings/session/${sessionId}/complete`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get recording by ID
 * @param {string} id - Recording ID
 * @returns {Promise<Object>} Recording data
 */
export async function getRecordingById(id) {
    const response = await fetch(`${API_BASE_URL}/api/recordings/${id}`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get narrations for a recording
 * @param {string} id - Recording ID
 * @returns {Promise<Array>} Narrations array
 */
export async function getNarrations(id) {
    const response = await fetch(`${API_BASE_URL}/api/recordings/${id}/narrations`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get instructions for a recording
 * @param {string} id - Recording ID
 * @returns {Promise<Array>} Instructions array
 */
export async function getInstructions(id) {
    const response = await fetch(`${API_BASE_URL}/api/recordings/${id}/instructions`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get display effects for a recording
 * @param {string} id - Recording ID
 * @returns {Promise<Array>} Display effects array
 */
export async function getDisplayEffects(id) {
    const response = await fetch(`${API_BASE_URL}/api/recordings/${id}/effects`);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

/**
 * Get WebSocket URL for a session
 * @param {string} sessionId - Session ID
 * @returns {string} WebSocket URL
 */
export function getWebSocketUrl(sessionId) {
    return `${WS_BASE_URL}/ws/${sessionId}`;
}

/**
 * Check backend health
 * @returns {Promise<Object>} Health status
 */
export async function checkHealth() {
    const response = await fetch(`${API_BASE_URL}/health`);
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }
    return response.json();
}
