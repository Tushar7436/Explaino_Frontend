import { useState, useEffect, useRef } from 'react';
import { useProcessingWebSocket } from '../hooks/useProcessingWebSocket';
import { processSession, generateSpeech, getCompleteRecording, exportVideo } from '../services/backend-api';

/**
 * RecordingSessionPage - Redesigned to match Descript-style UI
 * Left: Script with sync points | Right: Video player
 */
export default function RecordingSessionPage({ sessionId }) {
    const [videoUrl, setVideoUrl] = useState(null);
    const [audioUrl, setAudioUrl] = useState(null);
    const [preparing, setPreparing] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [generatingSpeech, setGeneratingSpeech] = useState(false);
    const [results, setResults] = useState(null);
    const [processedAudioUrl, setProcessedAudioUrl] = useState(null);
    const [error, setError] = useState(null);
    const videoRef = useRef(null);
    const originalAudioRef = useRef(null);
    const aiAudioRef = useRef(null);
    const progressBarRef = useRef(null);

    // Custom player state
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [volume, setVolume] = useState(1);
    const [isMuted, setIsMuted] = useState(false);

    const { connected, progress, error: wsError, completed } = useProcessingWebSocket(sessionId);

    // Synchronize video with audio using custom controls
    useEffect(() => {
        const video = videoRef.current;
        const audio = processedAudioUrl ? aiAudioRef.current : originalAudioRef.current;
        
        if (!video || !audio) {
            console.log('[Custom Player] Missing refs - video:', !!video, 'audio:', !!audio);
            return;
        }

        console.log('[Custom Player] Setting up sync. AI Audio:', !!processedAudioUrl);
        console.log('[Custom Player] Audio src:', audio.src);

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime);
            // Keep audio in sync
            const diff = Math.abs(video.currentTime - audio.currentTime);
            if (diff > 0.3) {
                audio.currentTime = video.currentTime;
            }
        };

        const handleVideoLoadedMetadata = () => {
            const newDuration = video.duration;
            console.log('[Custom Player] Video metadata loaded. Duration:', newDuration, 'ReadyState:', video.readyState);
            if (newDuration && !isNaN(newDuration) && isFinite(newDuration)) {
                setDuration(prev => prev || newDuration); // Only set if not already set
            }
        };

        const handleAudioLoadedMetadata = () => {
            const newDuration = audio.duration;
            console.log('[Custom Player] Audio metadata loaded. Duration:', newDuration, 'ReadyState:', audio.readyState);
            if (newDuration && !isNaN(newDuration) && isFinite(newDuration)) {
                setDuration(prev => prev || newDuration); // Only set if not already set
            }
        };

        const handleEnded = () => {
            setIsPlaying(false);
            audio.pause();
            video.pause();
        };

        const handleCanPlay = () => {
            console.log('[Custom Player] Video can play. Duration:', video.duration);
            if (video.duration && !isNaN(video.duration) && isFinite(video.duration)) {
                setDuration(prev => prev || video.duration); // Only set if not already set
            }
        };

        const handleAudioCanPlay = () => {
            console.log('[Custom Player] Audio can play. Duration:', audio.duration);
            if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
                setDuration(prev => prev || audio.duration); // Only set if not already set
            }
        };

        const handleAudioError = (e) => {
            console.error('[Custom Player] Audio load error:', e);
            console.error('[Custom Player] Audio src:', audio.src);
            console.error('[Custom Player] Audio error code:', audio.error?.code, audio.error?.message);
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        video.addEventListener('loadedmetadata', handleVideoLoadedMetadata);
        video.addEventListener('canplay', handleCanPlay);
        video.addEventListener('ended', handleEnded);
        audio.addEventListener('loadedmetadata', handleAudioLoadedMetadata);
        audio.addEventListener('canplay', handleAudioCanPlay);
        audio.addEventListener('error', handleAudioError);

        // Reset playing state when audio changes
        setIsPlaying(false);
        video.pause();
        audio.pause();
        video.currentTime = 0;
        audio.currentTime = 0;
        setCurrentTime(0);

        // Force reload audio after setting up listeners
        console.log('[Custom Player] Loading audio from:', audio.src);
        audio.load();
        video.load();

        // Set initial duration if already loaded
        setTimeout(() => {
            if (video.readyState >= 1) {
                const dur = video.duration;
                if (dur && !isNaN(dur) && isFinite(dur)) {
                    console.log('[Custom Player] Setting initial video duration:', dur);
                    setDuration(dur);
                }
            }
            if (audio.readyState >= 1) {
                const dur = audio.duration;
                if (dur && !isNaN(dur) && isFinite(dur)) {
                    console.log('[Custom Player] Setting initial audio duration:', dur);
                    setDuration(dur);
                }
            }
        }, 100);

        return () => {
            video.removeEventListener('timeupdate', handleTimeUpdate);
            video.removeEventListener('loadedmetadata', handleVideoLoadedMetadata);
            video.removeEventListener('canplay', handleCanPlay);
            video.removeEventListener('ended', handleEnded);
            audio.removeEventListener('loadedmetadata', handleAudioLoadedMetadata);
            audio.removeEventListener('canplay', handleAudioCanPlay);
            audio.removeEventListener('error', handleAudioError);
        };
    }, [processedAudioUrl]);

    // Custom play/pause handler
    const togglePlayPause = () => {
        const video = videoRef.current;
        const audio = processedAudioUrl ? aiAudioRef.current : originalAudioRef.current;
        
        if (!video || !audio) return;

        if (isPlaying) {
            video.pause();
            audio.pause();
            setIsPlaying(false);
            console.log('[Custom Player] Paused');
        } else {
            const playPromises = [
                video.play().catch(err => console.error('[Custom Player] Video play error:', err)),
                audio.play().catch(err => console.error('[Custom Player] Audio play error:', err))
            ];
            Promise.all(playPromises).then(() => {
                setIsPlaying(true);
                console.log('[Custom Player] Playing');
            });
        }
    };

    // Custom seek handler
    const handleSeek = (e) => {
        const video = videoRef.current;
        const audio = processedAudioUrl ? aiAudioRef.current : originalAudioRef.current;
        
        if (!video || !audio || !progressBarRef.current) return;

        const rect = progressBarRef.current.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const newTime = Math.max(0, Math.min(pos * duration, duration));

        video.currentTime = newTime;
        audio.currentTime = newTime;
        setCurrentTime(newTime);
        console.log('[Custom Player] Seeked to:', newTime);
    };

    // Custom volume handler
    const handleVolumeChange = (e) => {
        const newVolume = parseFloat(e.target.value);
        const video = videoRef.current;
        const audio = processedAudioUrl ? aiAudioRef.current : originalAudioRef.current;
        
        setVolume(newVolume);
        setIsMuted(false);
        if (video) video.volume = newVolume;
        if (audio) audio.volume = newVolume;
    };

    // Custom mute handler
    const toggleMute = () => {
        const video = videoRef.current;
        const audio = processedAudioUrl ? aiAudioRef.current : originalAudioRef.current;
        
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (video) video.muted = newMuted;
        if (audio) audio.muted = newMuted;
    };

    // Format time helper
    const formatTime = (time) => {
        if (!time || isNaN(time) || !isFinite(time)) return '0:00';
        const minutes = Math.floor(time / 60);
        const seconds = Math.floor(time % 60);
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    // Auto-start processing when page loads
    useEffect(() => {
        if (!sessionId) return;

        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        setVideoUrl(`${API_BASE}/uploads/video_${sessionId}.webm`);
        setAudioUrl(`${API_BASE}/uploads/audio_${sessionId}.webm`);

        // Auto-start processing
        const startProcessing = async () => {
            try {
                setPreparing(true);
                setProcessing(true);
                console.log('[DEBUG] Starting processing for session:', sessionId);
                const response = await processSession(sessionId);
                console.log('[DEBUG] Processing response:', response);
                console.log('[DEBUG] Narrations:', response.narrations);
                console.log('[DEBUG] Narrations count:', response.narrations?.length || 0);
                
                // Set duration from backend if available (webm files often report Infinity)
                if (response.videoDuration && response.videoDuration > 0) {
                    console.log('[DEBUG] Setting duration from backend:', response.videoDuration);
                    setDuration(response.videoDuration);
                }
                
                setResults(response);
                setPreparing(false);
                setProcessing(false);
            } catch (err) {
                console.error('[Session] Processing error:', err);
                setError(err.message);
                setPreparing(false);
                setProcessing(false);
            }
        };

        startProcessing();
    }, [sessionId]);

    const handleGenerateSpeech = async () => {
        if (!sessionId) {
            setError('No session ID available');
            return;
        }

        setGeneratingSpeech(true);
        setError(null);

        try {
            console.log('[Session] Generating speech with ElevenLabs for:', sessionId);
            const response = await generateSpeech(sessionId);
            console.log('[Session] Speech generation complete!', response);
            
            // Update audio URL - ensure proper path formatting
            const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';
            let audioUrl = response.processedAudioUrl;
            
            if (!audioUrl.startsWith('http')) {
                // Add leading slash if missing
                audioUrl = audioUrl.startsWith('/') ? audioUrl : `/${audioUrl}`;
                audioUrl = `${API_BASE}${audioUrl}`;
            }
            
            console.log('[Audio] Full audio URL:', audioUrl);
            setProcessedAudioUrl(audioUrl);
            setGeneratingSpeech(false);

        } catch (err) {
            console.error('[Session] Speech generation error:', err);
            setError('Speech generation failed: ' + err.message);
            setGeneratingSpeech(false);
        }
    };

    if (!sessionId) {
        return (
            <div style={{ 
                height: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#1e1e2e'
            }}>
                <h1 style={{ color: '#fff', fontSize: '1.5rem' }}>No Session ID</h1>
            </div>
        );
    }

    // Show loading state
    if (preparing) {
        return (
            <div style={{ 
                height: '100vh', 
                display: 'flex', 
                flexDirection: 'column',
                alignItems: 'center', 
                justifyContent: 'center',
                backgroundColor: '#1e1e2e',
                gap: '1.5rem'
            }}>
                <div style={{ 
                    fontSize: '3rem',
                    animation: 'spin 1s linear infinite'
                }}>⚙️</div>
                <h1 style={{ 
                    color: '#fff', 
                    fontSize: '1.5rem',
                    fontWeight: '500'
                }}>Wait preparing script for your video...</h1>
                {progress && (
                    <p style={{ color: '#999', fontSize: '1rem' }}>{progress.message}</p>
                )}
                <style>{`
                    @keyframes spin {
                        from { transform: rotate(0deg); }
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div style={{
            height: '100vh',
            backgroundColor: '#1e1e2e',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* Header */}
            <div style={{
                padding: '1rem 2rem',
                borderBottom: '1px solid #2a2a3e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#252538'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h1 style={{ 
                        color: '#fff', 
                        fontSize: '1.25rem',
                        fontWeight: '600',
                        margin: 0
                    }}>Booking an Airbnb Guide</h1>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#3b3b50',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}>Video</button>
                    <button style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'transparent',
                        color: '#999',
                        border: '1px solid #3b3b50',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}>Article</button>
                </div>
            </div>

            {/* Main Content Area */}
            <div style={{
                flex: 1,
                display: 'flex',
                overflow: 'hidden'
            }}>
                {/* Left Side - Script Panel */}
                <div style={{
                    width: '480px',
                    backgroundColor: '#252538',
                    borderRight: '1px solid #2a2a3e',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                }}>
                    {/* Script Header */}
                    <div style={{
                        padding: '1rem 1.5rem',
                        borderBottom: '1px solid #2a2a3e',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>📝 Script</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={handleGenerateSpeech}
                                disabled={generatingSpeech || processedAudioUrl}
                                style={{
                                    padding: '0.5rem 1rem',
                                    backgroundColor: generatingSpeech ? '#4a4a5e' : (processedAudioUrl ? '#16a34a' : '#6366f1'),
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    cursor: generatingSpeech || processedAudioUrl ? 'not-allowed' : 'pointer',
                                    fontSize: '0.875rem',
                                    fontWeight: '500',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem'
                                }}
                            >
                                {generatingSpeech ? (
                                    <>⏳ Generating...</>
                                ) : processedAudioUrl ? (
                                    <>✅ Speech Generated</>
                                ) : (
                                    <>🎤 Generate Speech</>
                                )}
                            </button>
                            <button style={{
                                padding: '0.5rem 1rem',
                                backgroundColor: '#3b3b50',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                ✨ AI Rewrite
                            </button>
                        </div>
                    </div>

                    {/* Script Content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '1rem 1.5rem'
                    }}>
                        {error && (
                            <div style={{
                                padding: '0.75rem',
                                backgroundColor: '#ef4444',
                                color: '#fff',
                                borderRadius: '6px',
                                marginBottom: '1rem',
                                fontSize: '0.875rem'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Debug: Show results state */}
                        {!results && !error && (
                            <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                                Loading script...
                            </div>
                        )}

                        {results && !results.narrations && (
                            <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                                No narrations generated yet.
                                <pre style={{ fontSize: '0.75rem', marginTop: '1rem', textAlign: 'left', color: '#999' }}>
                                    {JSON.stringify(results, null, 2).substring(0, 500)}
                                </pre>
                            </div>
                        )}

                        {results && results.narrations && results.narrations.length > 0 && results.narrations.map((narration, idx) => (
                            <div key={idx} style={{
                                marginBottom: '1.5rem',
                                position: 'relative'
                            }}>
                                {/* Section Number */}
                                <div style={{
                                    position: 'absolute',
                                    left: '-2rem',
                                    top: '0.25rem',
                                    color: '#666',
                                    fontSize: '0.875rem',
                                    fontWeight: '500'
                                }}>
                                    {idx + 1}
                                </div>

                                {/* Section Header */}
                                <div style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    marginBottom: '0.5rem'
                                }}>
                                    <span style={{
                                        color: '#999',
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>Video</span>
                                    <div style={{
                                        width: '24px',
                                        height: '24px',
                                        borderRadius: '50%',
                                        backgroundColor: '#6366f1',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: '0.75rem'
                                    }}>👤</div>
                                    <span style={{
                                        padding: '0.25rem 0.5rem',
                                        backgroundColor: '#6366f1',
                                        color: '#fff',
                                        borderRadius: '4px',
                                        fontSize: '0.7rem',
                                        fontWeight: '500'
                                    }}>
                                        Sync Point {idx + 1}
                                    </span>
                                </div>

                                {/* Narration Text */}
                                <p style={{
                                    color: '#e5e5e5',
                                    fontSize: '0.9rem',
                                    lineHeight: '1.6',
                                    margin: 0,
                                    paddingLeft: '0.5rem'
                                }}>
                                    {narration.text}
                                </p>
                            </div>
                        ))}

                        {results && results.narrations && results.narrations.length === 0 && (
                            <div style={{ textAlign: 'center', color: '#666', padding: '2rem' }}>
                                No narrations available. Processing may have failed.
                            </div>
                        )}
                    </div>
                </div>

                {/* Right Side - Video Player */}
                <div style={{
                    flex: 1,
                    backgroundColor: '#1e1e2e',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '2rem',
                    position: 'relative'
                }}>
                    {/* Background Selection Info */}
                    <div style={{
                        position: 'absolute',
                        top: '1rem',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '0.5rem 1rem',
                        backgroundColor: '#6366f1',
                        color: '#fff',
                        borderRadius: '20px',
                        fontSize: '0.875rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem'
                    }}>
                        <span>🎬</span>
                        <span>Background</span>
                        <span style={{ 
                            padding: '0.25rem 0.5rem',
                            backgroundColor: 'rgba(255,255,255,0.2)',
                            borderRadius: '4px',
                            fontSize: '0.75rem'
                        }}>16:9</span>
                    </div>

                    {/* Video Container with Border */}
                    <div style={{
                        width: '100%',
                        maxWidth: '900px',
                        position: 'relative'
                    }}>
                        {/* Blur Overlay During Generation */}
                        {generatingSpeech && (
                            <div style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                right: 0,
                                bottom: 0,
                                backgroundColor: 'rgba(30, 30, 46, 0.8)',
                                backdropFilter: 'blur(10px)',
                                zIndex: 20,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                borderRadius: '12px'
                            }}>
                                <div style={{
                                    width: '60px',
                                    height: '60px',
                                    border: '4px solid #6366f1',
                                    borderTopColor: 'transparent',
                                    borderRadius: '50%',
                                    animation: 'spin 1s linear infinite'
                                }}></div>
                                <div style={{
                                    color: '#fff',
                                    fontSize: '1.125rem',
                                    fontWeight: '500',
                                    textAlign: 'center'
                                }}>
                                    🎤 Generating Enhanced Video
                                    <div style={{
                                        fontSize: '0.875rem',
                                        color: '#999',
                                        marginTop: '0.5rem'
                                    }}>
                                        Creating AI voice with ElevenLabs...
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Custom Video Player */}
                        <div style={{
                            aspectRatio: '16/9',
                            border: '3px solid #6366f1',
                            borderRadius: '12px',
                            overflow: 'hidden',
                            backgroundColor: '#000',
                            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
                            position: 'relative'
                        }}>
                            {videoUrl && (
                                <>
                                    <video
                                        ref={videoRef}
                                        style={{ 
                                            width: '100%', 
                                            height: '100%',
                                            display: 'block'
                                        }}
                                    >
                                        <source src={videoUrl} type="video/webm" />
                                    </video>

                                    {/* Custom Controls Overlay */}
                                    <div style={{
                                        position: 'absolute',
                                        bottom: 0,
                                        left: 0,
                                        right: 0,
                                        background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 60%, transparent 100%)',
                                        padding: '20px 16px 12px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '8px'
                                    }}>
                                        {/* Progress Bar */}
                                        <div 
                                            ref={progressBarRef}
                                            onClick={handleSeek}
                                            style={{
                                                width: '100%',
                                                height: '6px',
                                                backgroundColor: 'rgba(255, 255, 255, 0.3)',
                                                borderRadius: '3px',
                                                cursor: 'pointer',
                                                position: 'relative'
                                            }}
                                        >
                                            <div style={{
                                                width: `${(currentTime / duration) * 100}%`,
                                                height: '100%',
                                                backgroundColor: '#6366f1',
                                                borderRadius: '3px',
                                                transition: 'width 0.1s'
                                            }}></div>
                                        </div>

                                        {/* Control Buttons */}
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            color: '#fff'
                                        }}>
                                            {/* Play/Pause Button */}
                                            <button
                                                onClick={togglePlayPause}
                                                style={{
                                                    background: 'transparent',
                                                    border: 'none',
                                                    color: '#fff',
                                                    fontSize: '24px',
                                                    cursor: 'pointer',
                                                    padding: '4px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '50%',
                                                    transition: 'background-color 0.2s'
                                                }}
                                                onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                                                onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                            >
                                                {isPlaying ? '⏸' : '▶'}
                                            </button>

                                            {/* Time Display */}
                                            <div style={{
                                                fontSize: '14px',
                                                fontFamily: 'monospace',
                                                minWidth: '100px'
                                            }}>
                                                {formatTime(currentTime)} / {formatTime(duration)}
                                            </div>

                                            {/* Spacer */}
                                            <div style={{ flex: 1 }}></div>

                                            {/* Volume Control */}
                                            <div style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px'
                                            }}>
                                                <button
                                                    onClick={toggleMute}
                                                    style={{
                                                        background: 'transparent',
                                                        border: 'none',
                                                        color: '#fff',
                                                        fontSize: '20px',
                                                        cursor: 'pointer',
                                                        padding: '4px',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                >
                                                    {isMuted ? '🔇' : volume > 0.5 ? '🔊' : '🔉'}
                                                </button>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={volume}
                                                    onChange={handleVolumeChange}
                                                    style={{
                                                        width: '80px',
                                                        cursor: 'pointer'
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Hidden Audio Elements - Synchronized with video */}
                        {audioUrl && (
                            <audio 
                                ref={originalAudioRef} 
                                style={{ display: 'none' }}
                                preload="auto"
                            >
                                <source src={audioUrl} type="audio/webm" />
                            </audio>
                        )}

                        {processedAudioUrl && (
                            <audio 
                                ref={aiAudioRef} 
                                style={{ display: 'none' }}
                                preload="auto"
                            >
                                <source src={processedAudioUrl} type="audio/mpeg" />
                            </audio>
                        )}
                    </div>

                    {/* Status Indicator */}
                    {processedAudioUrl && (
                        <div style={{
                            marginTop: '1.5rem',
                            padding: '0.75rem 1.5rem',
                            backgroundColor: '#16a34a',
                            color: '#fff',
                            borderRadius: '8px',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}>
                            <span style={{ fontSize: '1.25rem' }}>✅</span>
                            <span>Enhanced Video Ready - AI Voice Active</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
