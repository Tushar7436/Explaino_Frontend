import { useState } from 'react';
import { processRecording, getCompleteRecording, checkHealth } from '../services/backend-api';
import { useProcessingWebSocket } from '../hooks/useProcessingWebSocket';

/**
 * ProcessingPage - Upload and process recordings through the AI pipeline
 * Tests: Video → Deepgram Transcription → LLM → ElevenLabs TTS → Instructions/Effects
 */
export default function ProcessingPage() {
    const [sessionId, setSessionId] = useState(null);
    const [file, setFile] = useState(null);
    const [processing, setProcessing] = useState(false);
    const [results, setResults] = useState(null);
    const [backendStatus, setBackendStatus] = useState(null);
    const [error, setError] = useState(null);

    const { connected, progress, error: wsError, completed } = useProcessingWebSocket(sessionId);

    // Check backend health on mount
    useState(() => {
        checkHealth()
            .then(status => setBackendStatus(status))
            .catch(err => setBackendStatus({ status: 'unhealthy', error: err.message }));
    }, []);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            console.log('[Upload] File selected:', selectedFile.name, selectedFile.type);
            setFile(selectedFile);
            setError(null);
        }
    };

    const handleProcess = async () => {
        if (!file) {
            setError('Please select a video file first');
            return;
        }

        setProcessing(true);
        setError(null);
        setResults(null);

        try {
            // Generate session ID
            const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            setSessionId(newSessionId);

            console.log('[Processing] Starting for session:', newSessionId);

            // Read file as base64 or ArrayBuffer
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const videoData = e.target.result;

                    // Prepare processing request
                    const payload = {
                        sessionId: newSessionId,
                        videoData: videoData.split(',')[1], // Remove data:video/webm;base64, prefix
                        recordingStartTimeMs: Date.now(),
                        videoDurationSec: 0, // Will be calculated by backend
                        domEvents: [], // Empty for direct upload
                        deepgramRaw: null // Backend will transcribe
                    };

                    console.log('[Processing] Sending request...');
                    const response = await processRecording(payload);
                    console.log('[Processing] Response:', response);

                    // Wait for WebSocket to signal completion
                    console.log('[Processing] Waiting for pipeline completion...');

                } catch (err) {
                    console.error('[Processing] Error:', err);
                    setError(err.message);
                    setProcessing(false);
                }
            };

            reader.onerror = () => {
                setError('Failed to read file');
                setProcessing(false);
            };

            reader.readAsDataURL(file);

        } catch (err) {
            console.error('[Processing] Error:', err);
            setError(err.message);
            setProcessing(false);
        }
    };

    // Fetch results when processing completes
    useState(() => {
        if (completed && sessionId) {
            console.log('[Results] Fetching complete data...');
            getCompleteRecording(sessionId)
                .then(data => {
                    console.log('[Results] Complete data:', data);
                    setResults(data);
                    setProcessing(false);
                })
                .catch(err => {
                    console.error('[Results] Fetch error:', err);
                    setError('Failed to fetch results: ' + err.message);
                    setProcessing(false);
                });
        }
    }, [completed, sessionId]);

    return (
        <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
                <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
                    Explaino Processing Pipeline
                </h1>
                <p style={{ color: '#666' }}>
                    Upload a video to test: Deepgram Transcription → LLM Refinement → ElevenLabs TTS → Instructions & Effects
                </p>
            </div>

            {/* Backend Status */}
            {backendStatus && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '2rem',
                    borderRadius: '8px',
                    backgroundColor: backendStatus.status === 'healthy' ? '#d1fae5' : '#fee2e2',
                    border: '1px solid ' + (backendStatus.status === 'healthy' ? '#10b981' : '#ef4444')
                }}>
                    <strong>Backend Status:</strong> {backendStatus.status} 
                    {backendStatus.version && ` (v${backendStatus.version})`}
                    {backendStatus.error && ` - ${backendStatus.error}`}
                </div>
            )}

            {/* File Upload */}
            <div style={{
                padding: '2rem',
                border: '2px dashed #cbd5e0',
                borderRadius: '8px',
                marginBottom: '2rem',
                textAlign: 'center'
            }}>
                <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileChange}
                    style={{ marginBottom: '1rem' }}
                />
                {file && (
                    <p style={{ color: '#666', marginBottom: '1rem' }}>
                        Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                    </p>
                )}
                <button
                    onClick={handleProcess}
                    disabled={!file || processing}
                    style={{
                        padding: '0.75rem 2rem',
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: 'white',
                        backgroundColor: (!file || processing) ? '#9ca3af' : '#3b82f6',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: (!file || processing) ? 'not-allowed' : 'pointer'
                    }}
                >
                    {processing ? 'Processing...' : 'Process Video'}
                </button>
            </div>

            {/* WebSocket Status */}
            {sessionId && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '2rem',
                    borderRadius: '8px',
                    backgroundColor: connected ? '#dbeafe' : '#fef3c7',
                    border: '1px solid ' + (connected ? '#3b82f6' : '#f59e0b')
                }}>
                    <strong>WebSocket:</strong> {connected ? 'Connected' : 'Disconnected'}
                    <span style={{ marginLeft: '1rem', color: '#666' }}>
                        Session: {sessionId}
                    </span>
                </div>
            )}

            {/* Progress */}
            {progress && (
                <div style={{ marginBottom: '2rem' }}>
                    <div style={{
                        padding: '1.5rem',
                        backgroundColor: '#f3f4f6',
                        borderRadius: '8px',
                        border: '1px solid #e5e7eb'
                    }}>
                        <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <strong>{progress.stage}</strong>
                            <span>{progress.percent}%</span>
                        </div>
                        <div style={{
                            width: '100%',
                            height: '24px',
                            backgroundColor: '#e5e7eb',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            marginBottom: '0.5rem'
                        }}>
                            <div style={{
                                width: `${progress.percent}%`,
                                height: '100%',
                                backgroundColor: '#3b82f6',
                                transition: 'width 0.3s ease'
                            }} />
                        </div>
                        <p style={{ color: '#666', margin: 0 }}>{progress.message}</p>
                    </div>
                </div>
            )}

            {/* Error */}
            {(error || wsError) && (
                <div style={{
                    padding: '1rem',
                    marginBottom: '2rem',
                    backgroundColor: '#fee2e2',
                    border: '1px solid #ef4444',
                    borderRadius: '8px',
                    color: '#991b1b'
                }}>
                    <strong>Error:</strong> {error || wsError}
                </div>
            )}

            {/* Results */}
            {results && (
                <div style={{
                    padding: '2rem',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb'
                }}>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                        Processing Results ✅
                    </h2>

                    {/* Narrations */}
                    {results.narrations && results.narrations.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                Narrations ({results.narrations.length})
                            </h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                                {results.narrations.map((narration, idx) => (
                                    <div key={idx} style={{
                                        padding: '0.75rem',
                                        backgroundColor: 'white',
                                        marginBottom: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>
                                            [{narration.start?.toFixed(2)}s - {narration.end?.toFixed(2)}s]
                                        </div>
                                        <div>{narration.text}</div>
                                        {narration.audio_url && (
                                            <audio controls src={narration.audio_url} style={{ marginTop: '0.5rem', width: '100%' }} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Instructions */}
                    {results.instructions && results.instructions.length > 0 && (
                        <div style={{ marginBottom: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                Instructions ({results.instructions.length})
                            </h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                                {results.instructions.map((inst, idx) => (
                                    <div key={idx} style={{
                                        padding: '0.75rem',
                                        backgroundColor: 'white',
                                        marginBottom: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        <strong>{inst.type}</strong>
                                        {inst.timestamp && ` @ ${inst.timestamp.toFixed(2)}s`}
                                        {inst.data && <pre style={{ marginTop: '0.5rem', fontSize: '0.75rem' }}>{JSON.stringify(inst.data, null, 2)}</pre>}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Display Effects */}
                    {results.displayEffects && results.displayEffects.length > 0 && (
                        <div>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                                Display Effects ({results.displayEffects.length})
                            </h3>
                            <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.875rem' }}>
                                {results.displayEffects.map((effect, idx) => (
                                    <div key={idx} style={{
                                        padding: '0.75rem',
                                        backgroundColor: 'white',
                                        marginBottom: '0.5rem',
                                        borderRadius: '4px',
                                        border: '1px solid #e5e7eb'
                                    }}>
                                        <strong>Effect #{idx + 1}</strong>
                                        {' '}[{effect.start?.toFixed(2)}s - {effect.end?.toFixed(2)}s]
                                        {effect.style?.zoom && (
                                            <div style={{ marginTop: '0.25rem', color: '#666' }}>
                                                Zoom: {effect.style.zoom.scale}x
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Raw JSON */}
                    <details style={{ marginTop: '1rem' }}>
                        <summary style={{ cursor: 'pointer', fontWeight: '600' }}>View Raw JSON</summary>
                        <pre style={{
                            marginTop: '0.5rem',
                            padding: '1rem',
                            backgroundColor: '#1f2937',
                            color: '#f3f4f6',
                            borderRadius: '4px',
                            overflow: 'auto',
                            fontSize: '0.75rem'
                        }}>
                            {JSON.stringify(results, null, 2)}
                        </pre>
                    </details>
                </div>
            )}
        </div>
    );
}
