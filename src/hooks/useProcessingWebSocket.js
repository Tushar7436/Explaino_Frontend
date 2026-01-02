import { useState, useEffect, useRef, useCallback } from 'react';
import { getWebSocketUrl } from '../services/backend-api';

/**
 * Custom hook for WebSocket connection to receive processing progress
 * @param {string} sessionId - Session ID to connect to
 * @returns {Object} WebSocket state and handlers
 */
export function useProcessingWebSocket(sessionId) {
    const [connected, setConnected] = useState(false);
    const [progress, setProgress] = useState(null);
    const [error, setError] = useState(null);
    const [completed, setCompleted] = useState(false);
    const ws = useRef(null);
    const reconnectTimeout = useRef(null);

    const connect = useCallback(() => {
        if (!sessionId || ws.current) return;

        try {
            const wsUrl = getWebSocketUrl(sessionId);
            console.log('[WS] Connecting to:', wsUrl);

            ws.current = new WebSocket(wsUrl);

            ws.current.onopen = () => {
                console.log('[WS] Connected');
                setConnected(true);
                setError(null);
            };

            ws.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[WS] Message received:', message);

                    switch (message.type) {
                        case 'progress':
                            setProgress({
                                stage: message.data.stage,
                                percent: message.data.percent,
                                message: message.data.message
                            });
                            break;

                        case 'complete':
                            console.log('[WS] Processing complete');
                            setProgress({
                                stage: 'complete',
                                percent: 100,
                                message: 'Processing completed successfully'
                            });
                            setCompleted(true);
                            break;

                        case 'error':
                            console.error('[WS] Processing error:', message.data);
                            setError(message.data.message || 'Processing failed');
                            break;

                        case 'video':
                        case 'audio':
                        case 'transcript':
                            // Handle file updates if needed
                            console.log('[WS] File update:', message.type, message.data);
                            break;

                        case 'registered':
                            console.log('[WS] Client registered');
                            break;

                        case 'instructions':
                            console.log('[WS] Instructions update:', message.data?.instructions?.length || 0, 'items');
                            break;

                        default:
                            console.log('[WS] Unknown message type:', message.type);
                    }
                } catch (err) {
                    console.error('[WS] Failed to parse message:', err);
                }
            };

            ws.current.onerror = (err) => {
                console.error('[WS] Error:', err);
                setError('WebSocket connection error');
            };

            ws.current.onclose = () => {
                console.log('[WS] Disconnected');
                setConnected(false);
                ws.current = null;

                // Auto-reconnect if not completed
                if (!completed) {
                    reconnectTimeout.current = setTimeout(() => {
                        console.log('[WS] Attempting to reconnect...');
                        connect();
                    }, 3000);
                }
            };
        } catch (err) {
            console.error('[WS] Connection failed:', err);
            setError('Failed to establish WebSocket connection');
        }
    }, [sessionId, completed]);

    const disconnect = useCallback(() => {
        if (reconnectTimeout.current) {
            clearTimeout(reconnectTimeout.current);
        }
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }
        setConnected(false);
    }, []);

    useEffect(() => {
        if (sessionId) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [sessionId, connect, disconnect]);

    return {
        connected,
        progress,
        error,
        completed,
        reconnect: connect
    };
}
