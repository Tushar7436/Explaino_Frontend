import React, { useRef, useEffect, useState } from 'react';
import {
    normalizeCoordinates,
    calculateZoomTransform,
    computeEffectProgress,
    getActiveEffects,
    buildTransformString,
    resolveZoomEffect
} from '../utils/effectProcessor';
import { generateZoomInstructions, validateZoomInstruction, checkInstructionPurity } from '../utils/instructionGenerator';
import { submitBatchZoomInstructions } from '../services/api';

/**
 * VideoEffectPreview Component
 * Renders video with CSS-based effects driven by instruction file
 * Uses requestAnimationFrame for smooth, timeline-synchronized rendering
 */
const VideoEffectPreview = ({
    videoSrc,
    audioSrc,
    instructions,
    frameWidth = 1280,
    frameHeight = 720
}) => {
    const videoRef = useRef(null);
    const audioRef = useRef(null);
    const videoLayerRef = useRef(null);
    const rafRef = useRef(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [normalizedEffects, setNormalizedEffects] = useState([]);
    const [recordingDimensions, setRecordingDimensions] = useState(null);
    const [exportStatus, setExportStatus] = useState({ loading: false, error: null, success: null });

    // Parse and normalize effects on mount
    useEffect(() => {
        console.log('[INIT] Instructions:', instructions);
        if (!instructions || !instructions.displayEffects) {
            console.warn('[INIT] No instructions or displayEffects found');
            return;
        }

        console.log('[INIT] Found', instructions.displayEffects.length, 'display effects');

        // Get recording dimensions from video metadata or use default
        const video = videoRef.current;
        if (video) {
            const handleMetadata = () => {
                const recordingWidth = video.videoWidth;
                const recordingHeight = video.videoHeight;

                console.log('[INIT] Video metadata loaded:', recordingWidth, 'x', recordingHeight);
                setRecordingDimensions({ recordingWidth, recordingHeight });

                // Normalize all effect coordinates
                const filtered = instructions.displayEffects
                    .filter(effect => effect.target?.bounds && effect.style?.zoom?.enabled);

                console.log('[INIT] Filtered to', filtered.length, 'zoom effects with bounds');

                const normalized = filtered.map(effect => {
                    // CRITICAL: Use actual video dimensions for normalization
                    // NOT the preview frame size (frameWidth/frameHeight)
                    // The bounding boxes are in recording coordinate space
                    const normalizedBounds = normalizeCoordinates(
                        effect.target.bounds,
                        recordingWidth,
                        recordingHeight,
                        recordingWidth,  // Use video width, not frame width
                        recordingHeight  // Use video height, not frame height
                    );
                    console.log('[INIT] Normalized effect:', effect.start, '-', effect.end, 's');
                    console.log('  Bounds (recording space):', effect.target.bounds);
                    console.log('  Center (video space):', normalizedBounds.centerX.toFixed(1), ',', normalizedBounds.centerY.toFixed(1));
                    console.log('  Anchor (0-1 normalized):', normalizedBounds.anchorX.toFixed(3), ',', normalizedBounds.anchorY.toFixed(3));
                    console.log('  AutoScale:', normalizedBounds.autoScale.toFixed(2),
                        '(area:', (normalizedBounds.areaRatio * 100).toFixed(2) + '%,',
                        'dominant:', (normalizedBounds.dominantRatio * 100).toFixed(2) + '%,',
                        'effective:', (normalizedBounds.effectiveRatio * 100).toFixed(2) + '%)');
                    return {
                        ...effect,
                        normalizedBounds
                    };
                });

                console.log('[INIT] Total normalized effects:', normalized.length);
                setNormalizedEffects(normalized);
            };

            video.addEventListener('loadedmetadata', handleMetadata);

            // If metadata already loaded
            if (video.readyState >= 1) {
                console.log('[INIT] Video metadata already loaded, processing immediately');
                handleMetadata();
            }
        }
    }, [instructions, frameWidth, frameHeight]);

    // Rendering loop using requestAnimationFrame
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        console.log('[RAF] Setting up rendering loop, normalizedEffects:', normalizedEffects.length);

        const renderFrame = () => {
            const currentTime = video.currentTime;
            setCurrentTime(currentTime);

            // Get active effects at current time
            const activeEffects = getActiveEffects(normalizedEffects, currentTime);

            console.log(`[RAF] t=${currentTime.toFixed(2)}s, activeEffects=${activeEffects.length}, normalized=${normalizedEffects.length}`);

            if (activeEffects.length > 0 && videoLayerRef.current) {
                // Use deterministic resolver for overlapping effects
                const effect = resolveZoomEffect(activeEffects);

                if (effect) {
                    const { centerX, centerY, anchorX, anchorY, autoScale, effectiveRatio, dominantRatio } = effect.normalizedBounds;
                    // Use auto-calculated scale based on bounding box size
                    // Fallback to manual scale if autoScale not available
                    const targetScale = autoScale || effect.style.zoom.scale;

                    // Compute progress with easing
                    const progress = computeEffectProgress(
                        currentTime,
                        effect.start,
                        effect.end,
                        0.25, // 25% ease-in
                        0.25  // 25% ease-out
                    );

                    console.log(`[ZOOM] Effect: ${effect.start}-${effect.end}s, progress=${progress.toFixed(3)}`);
                    console.log(`  Scale: ${targetScale.toFixed(2)}x (effective: ${(effectiveRatio * 100).toFixed(2)}%, dominant: ${(dominantRatio * 100).toFixed(2)}%)`);
                    console.log(`  Anchor: (${anchorX.toFixed(3)}, ${anchorY.toFixed(3)})`);

                    // Calculate zoom transform
                    const { scale, translateX, translateY } = calculateZoomTransform(
                        progress,
                        centerX,
                        centerY,
                        targetScale
                    );

                    console.log(`[TRANSFORM] scale=${scale.toFixed(3)}, tx=${translateX.toFixed(1)}, ty=${translateY.toFixed(1)}`);

                    // Apply CSS transform
                    const transformString = buildTransformString(translateX, translateY, scale);
                    videoLayerRef.current.style.transform = transformString;
                }
            } else if (videoLayerRef.current) {
                // Reset to identity transform (not 'none') for GPU stability
                videoLayerRef.current.style.transform = 'translate(0px, 0px) scale(1)';
            }

            // Continue loop if playing
            if (!video.paused && !video.ended) {
                rafRef.current = requestAnimationFrame(renderFrame);
            }
        };

        // Event handlers to restart RAF loop
        const handlePlay = () => {
            console.log('[RAF] Video play event - starting RAF loop');
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
            rafRef.current = requestAnimationFrame(renderFrame);
        };

        const handlePause = () => {
            console.log('[RAF] Video pause event - stopping RAF loop');
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);

        // Start rendering loop if video is already playing
        if (!video.paused && !video.ended) {
            console.log('[RAF] Video already playing - starting RAF loop');
            rafRef.current = requestAnimationFrame(renderFrame);
        }

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            if (rafRef.current) {
                cancelAnimationFrame(rafRef.current);
            }
        };
    }, [normalizedEffects]);

    // Sync audio with video
    useEffect(() => {
        const video = videoRef.current;
        const audio = audioRef.current;

        if (!video || !audio) return;

        const syncAudio = () => {
            // Sync audio currentTime with video
            if (Math.abs(audio.currentTime - video.currentTime) > 0.1) {
                audio.currentTime = video.currentTime;
            }
        };

        const handlePlay = () => {
            setIsPlaying(true);
            audio.play().catch(err => console.warn('Audio play failed:', err));
        };

        const handlePause = () => {
            setIsPlaying(false);
            audio.pause();
        };

        const handleSeeking = () => {
            syncAudio();
        };

        const handleLoadedMetadata = () => {
            setDuration(video.duration);
        };

        video.addEventListener('play', handlePlay);
        video.addEventListener('pause', handlePause);
        video.addEventListener('seeking', handleSeeking);
        video.addEventListener('loadedmetadata', handleLoadedMetadata);
        video.addEventListener('timeupdate', syncAudio);

        return () => {
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            video.removeEventListener('seeking', handleSeeking);
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('timeupdate', syncAudio);
        };
    }, []);

    const handlePlayPause = () => {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    };

    const handleSeek = (e) => {
        const video = videoRef.current;
        const audio = audioRef.current;
        if (!video) return;

        const seekTime = parseFloat(e.target.value);
        video.currentTime = seekTime;

        // Sync audio immediately during scrubbing
        if (audio) {
            audio.currentTime = seekTime;
        }
    };

    /**
     * Handle export to backend
     * Generates pure instructions (bounding box + time only) and sends to Go backend
     */
    const handleExport = async () => {
        console.log('[EXPORT] Starting export...');
        console.log('[EXPORT] recordingDimensions:', recordingDimensions);
        console.log('[EXPORT] instructions:', instructions);

        if (!instructions?.displayEffects?.length) {
            setExportStatus({ loading: false, error: 'No effects to export', success: null });
            return;
        }

        if (!recordingDimensions) {
            setExportStatus({ loading: false, error: 'Video not loaded yet - wait for video to load', success: null });
            return;
        }

        if (!recordingDimensions.recordingWidth || !recordingDimensions.recordingHeight) {
            setExportStatus({
                loading: false,
                error: `Invalid video dimensions: ${recordingDimensions.recordingWidth}x${recordingDimensions.recordingHeight}`,
                success: null
            });
            return;
        }

        setExportStatus({ loading: true, error: null, success: null });

        try {
            // Generate pure instructions (NO scale values, NO preview-specific data)
            const frameSize = {
                width: recordingDimensions.recordingWidth,
                height: recordingDimensions.recordingHeight
            };

            const pureInstructions = generateZoomInstructions(instructions.displayEffects, frameSize);

            console.log('[EXPORT] Generated', pureInstructions.length, 'instructions');

            // Validate each instruction
            for (let i = 0; i < pureInstructions.length; i++) {
                const instruction = pureInstructions[i];

                // Validate required fields
                const validation = validateZoomInstruction(instruction);
                if (!validation.valid) {
                    throw new Error(`Instruction ${i + 1} validation failed: ${validation.errors.join(', ')}`);
                }

                // Check purity (no forbidden fields)
                const purity = checkInstructionPurity(instruction);
                if (!purity.clean) {
                    throw new Error(`Instruction ${i + 1} contains forbidden fields: ${purity.violations.join(', ')}`);
                }

                console.log('[EXPORT] Instruction', i + 1, 'validated:', instruction);
            }

            // Submit to backend
            const response = await submitBatchZoomInstructions(pureInstructions);

            console.log('[EXPORT] Backend response:', response);
            setExportStatus({ loading: false, error: null, success: response });

        } catch (error) {
            console.error('[EXPORT] Error:', error);
            setExportStatus({ loading: false, error: error.message, success: null });
        }
    };

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="">
            {/* Wrapper to center the video frame */}
            <div className="video-frame-wrapper">
                {/* Colored background board */}
                <div className="video-board">
                    {/* Video frame on top of the board */}
                    <div className="video-frame">
                        <video
                            ref={(el) => {
                                videoRef.current = el;
                                videoLayerRef.current = el;
                            }}
                            className="video-layer"
                            src={videoSrc}
                            preload="metadata"
                        >
                            <source src={videoSrc} type="video/webm" />
                        </video>
                    </div>
                </div>
            </div>


            {/* Hidden audio element */}
            {audioSrc && (
                <audio ref={audioRef} className="audio-track" preload="metadata">
                    <source src={audioSrc} type="audio/webm" />
                </audio>
            )}

            {/* Playback controls */}
            <div className="video-controls">
                <button onClick={handlePlayPause} className="control-button">
                    {isPlaying ? '⏸ Pause' : '▶ Play'}
                </button>

                <button
                    onClick={handleExport}
                    className="control-button export-button"
                    disabled={exportStatus.loading || !instructions?.displayEffects?.length}
                >
                    {exportStatus.loading ? '⏳ Exporting...' : '📤 Export to Backend'}
                </button>

                <div className="timeline-container">
                    <span className="time-display">{formatTime(currentTime)}</span>
                    <input
                        type="range"
                        min="0"
                        max={duration || 0}
                        step="0.1"
                        value={currentTime}
                        onChange={handleSeek}
                        className="timeline-slider"
                    />
                    <span className="time-display">{formatTime(duration)}</span>
                </div>

                {/* Export Status */}
                {exportStatus.error && (
                    <div className="export-status error">
                        ❌ Error: {exportStatus.error}
                    </div>
                )}
                {exportStatus.success && (
                    <div className="export-status success">
                        ✅ Export successful! Output: {exportStatus.success.outputVideoPath || 'Processing...'}
                    </div>
                )}
            </div>

            {/* Debug info */}
            <div className="debug-info">
                <p><strong>Debug Information:</strong></p>
                <p>Current Time: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s</p>
                <p>Normalized Effects: {normalizedEffects.length}</p>
                <p>Active Effects: {getActiveEffects(normalizedEffects, currentTime).length}</p>
                <p>Recording: {recordingDimensions ? `${recordingDimensions.recordingWidth}x${recordingDimensions.recordingHeight}` : 'Loading...'}</p>
                <p>Frame: {frameWidth}x{frameHeight}</p>
                <p>Video Playing: {isPlaying ? 'Yes' : 'No'}</p>
                <p>Video Element: {videoLayerRef.current ? 'Ready' : 'Not Ready'}</p>
                {normalizedEffects.length > 0 && (
                    <div style={{ marginTop: '10px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '10px' }}>
                        <p><strong>Effect Windows:</strong></p>
                        {normalizedEffects.map((effect, idx) => (
                            <p key={idx} style={{
                                color: currentTime >= effect.start && currentTime <= effect.end ? '#4ade80' : '#888',
                                fontSize: '12px'
                            }}>
                                {idx + 1}. {effect.start.toFixed(2)}s - {effect.end.toFixed(2)}s
                                (auto: {effect.normalizedBounds.autoScale.toFixed(2)}x,
                                area: {(effect.normalizedBounds.areaRatio * 100).toFixed(1)}%)
                                {currentTime >= effect.start && currentTime <= effect.end && ' ← ACTIVE'}
                            </p>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoEffectPreview;
