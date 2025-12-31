/**
 * Effect Processor Utility
 * Handles coordinate normalization, zoom calculations, and easing functions
 * for CSS-based video effect preview rendering
 */

/**
 * Normalize recorded bounds to video coordinate space
 * CRITICAL: All coordinates must be in the ACTUAL VIDEO resolution space
 * NOT the preview frame/container size
 * 
 * @param {Object} bounds - Original bounds {x, y, width, height} in recording resolution
 * @param {number} recordingWidth - Original recording width (e.g., 1920)
 * @param {number} recordingHeight - Original recording height (e.g., 854)
 * @param {number} videoWidth - Video width (should equal recordingWidth)
 * @param {number} videoHeight - Video height (should equal recordingHeight)
 * @returns {Object} Normalized bounds with centerX, centerY, anchorX, anchorY, and autoScale
 */
export function normalizeCoordinates(bounds, recordingWidth, recordingHeight, videoWidth, videoHeight) {
    // Calculate center position in video coordinates
    // Since bounds are already in recording space and video = recording, this is just the center
    const centerX = bounds.x + bounds.width / 2;
    const centerY = bounds.y + bounds.height / 2;

    // CRITICAL: Normalized anchor points for FFmpeg compatibility
    // These are the zoom anchor points in 0-1 range
    // This is what FFmpeg needs: anchorX/anchorY relative to video dimensions
    const anchorX = centerX / recordingWidth;
    const anchorY = centerY / recordingHeight;

    // === AUTO-SCALE CALCULATION ===

    // 1. Area ratio (original approach)
    const boundingBoxArea = bounds.width * bounds.height;
    const screenArea = recordingWidth * recordingHeight;
    const areaRatio = boundingBoxArea / screenArea;

    // 2. CRITICAL FIX: Dominant dimension ratio
    // Handles edge cases like wide-but-short text or tall-but-narrow sidebars
    const widthRatio = bounds.width / recordingWidth;
    const heightRatio = bounds.height / recordingHeight;
    const dominantRatio = Math.max(widthRatio, heightRatio);

    // 3. Effective ratio: use whichever is larger
    // This ensures wide text bars get proper zoom even if area is medium
    const effectiveRatio = Math.max(areaRatio, dominantRatio);

    // Auto-scale formula based on effective ratio
    // Small elements (< 1% effective) -> high zoom (1.5x - 2.0x)
    // Medium elements (1-10% effective) -> medium zoom (1.2x - 1.5x)
    // Large elements (> 10% effective) -> low zoom (1.0x - 1.2x)
    let autoScale;
    if (effectiveRatio < 0.01) {
        // Very small element (< 1% of screen)
        autoScale = 1.5 + (0.01 - effectiveRatio) / 0.01 * 0.5; // 1.5x to 2.0x
    } else if (effectiveRatio < 0.1) {
        // Medium element (1-10% of screen)
        autoScale = 1.2 + (0.1 - effectiveRatio) / 0.09 * 0.3; // 1.2x to 1.5x
    } else if (effectiveRatio < 0.5) {
        // Large element (10-50% of screen)
        autoScale = 1.0 + (0.5 - effectiveRatio) / 0.4 * 0.2; // 1.0x to 1.2x
    } else {
        // Very large element (> 50% of screen) - minimal or no zoom
        autoScale = 1.0;
    }

    // Clamp to reasonable range
    autoScale = Math.max(1.0, Math.min(2.5, autoScale));

    // Time behavior: explicit start and end scales for smooth animation
    const startScale = 1.0;      // Always start from normal size
    const endScale = autoScale;  // End at calculated zoom level

    return {
        ...bounds,
        centerX,
        centerY,
        // Normalized anchor points (0-1 range) for FFmpeg compatibility
        anchorX,
        anchorY,
        // Auto-calculated zoom
        autoScale,
        // Time behavior: explicit start/end for animation
        startScale,
        endScale,
        // Debug info
        areaRatio,
        widthRatio,
        heightRatio,
        dominantRatio,
        effectiveRatio
    };
}

/**
 * Cubic easing function (ease-in-out)
 * @param {number} t - Progress value between 0 and 1
 * @returns {number} Eased value between 0 and 1
 */
export function easeInOutCubic(t) {
    return t < 0.5
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Quadratic easing function (ease-in-out)
 * @param {number} t - Progress value between 0 and 1
 * @returns {number} Eased value between 0 and 1
 */
export function easeInOutQuad(t) {
    return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Compute effect progress with ease-in, hold, and ease-out phases
 * @param {number} currentTime - Current video time
 * @param {number} start - Effect start time
 * @param {number} end - Effect end time
 * @param {number} easeInPercent - Percentage of duration for ease-in (default 0.25)
 * @param {number} easeOutPercent - Percentage of duration for ease-out (default 0.25)
 * @returns {number} Progress value between 0 and 1
 */
export function computeEffectProgress(currentTime, start, end, easeInPercent = 0.25, easeOutPercent = 0.25) {
    const duration = end - start;
    const t = (currentTime - start) / duration;

    // Return 0 at boundaries for clean entry/exit
    if (t <= 0) return 0;
    if (t >= 1) return 0;

    const easeInEnd = easeInPercent;
    const easeOutStart = 1 - easeOutPercent;

    // Ease-in phase
    if (t < easeInEnd) {
        return easeInOutCubic(t / easeInEnd);
    }

    // Ease-out phase
    if (t > easeOutStart) {
        return easeInOutCubic((1 - t) / easeOutPercent);
    }

    // Hold phase
    return 1;
}

/**
 * Calculate zoom transform values
 * @param {number} progress - Effect progress (0 to 1)
 * @param {number} centerX - Normalized center X coordinate
 * @param {number} centerY - Normalized center Y coordinate
 * @param {number} targetScale - Target zoom scale (e.g., 1.08)
 * @returns {Object} Transform values {scale, translateX, translateY}
 */
export function calculateZoomTransform(progress, centerX, centerY, targetScale) {
    // Interpolate scale from 1 to targetScale
    const scale = 1 + (targetScale - 1) * progress;

    // Calculate translation to keep the center point anchored
    const translateX = -centerX * (scale - 1);
    const translateY = -centerY * (scale - 1);

    return {
        scale,
        translateX,
        translateY
    };
}

/**
 * Get active effects at current time
 * @param {Array} effects - Array of effect objects
 * @param {number} currentTime - Current video time
 * @returns {Array} Active effects
 */
export function getActiveEffects(effects, currentTime) {
    return effects.filter(effect =>
        currentTime >= effect.start && currentTime <= effect.end
    );
}

/**
 * Build CSS transform string
 * @param {number} translateX - X translation in pixels
 * @param {number} translateY - Y translation in pixels
 * @param {number} scale - Scale factor
 * @returns {string} CSS transform string
 */
export function buildTransformString(translateX, translateY, scale) {
    return `translate(${translateX}px, ${translateY}px) scale(${scale})`;
}

/**
 * Resolve which zoom effect to apply when multiple effects overlap
 * @param {Array} effects - Array of active effects
 * @returns {Object|null} The effect to apply, or null if none
 */
export function resolveZoomEffect(effects) {
    if (effects.length === 0) return null;

    // Rule: latest-starting effect wins
    return effects.reduce((latest, e) =>
        e.start > latest.start ? e : latest
    );
}
