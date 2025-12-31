/**
 * Instruction Generator
 * Generates pure, fact-based instructions for the Go backend
 * 
 * CRITICAL: This module MUST NOT include:
 * - scale values
 * - transform-origin
 * - CSS easing
 * - FFmpeg filters
 * - derived ratios
 * - preview-specific values
 */

/**
 * Generate a zoom instruction from effect data
 * Only includes pure facts: bounding box + time range + frame size
 * 
 * @param {Object} effect - The display effect from instructions
 * @param {Object} frameSize - The video frame dimensions
 * @returns {Object} Pure instruction for backend
 */
export function generateZoomInstruction(effect, frameSize) {
    const instruction = {
        effect: 'zoom',
        startTimeMs: Math.round(effect.start * 1000),
        durationMs: Math.round((effect.end - effect.start) * 1000),
        frame: {
            width: frameSize.width,
            height: frameSize.height
        },
        boundingBox: {
            x: effect.target.bounds.x,
            y: effect.target.bounds.y,
            width: effect.target.bounds.width,
            height: effect.target.bounds.height
        }
    };

    return instruction;
}

/**
 * Generate multiple zoom instructions from an array of effects
 * @param {Array<Object>} effects - Array of display effects
 * @param {Object} frameSize - The video frame dimensions
 * @returns {Array<Object>} Array of pure instructions
 */
export function generateZoomInstructions(effects, frameSize) {
    return effects
        .filter(effect => effect.style?.zoom?.enabled && effect.target?.bounds)
        .map(effect => generateZoomInstruction(effect, frameSize));
}

/**
 * Validate a zoom instruction before sending to backend
 * @param {Object} instruction - The instruction to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateZoomInstruction(instruction) {
    const errors = [];

    // Check required fields exist
    if (!instruction.effect || instruction.effect !== 'zoom') {
        errors.push('Effect must be "zoom"');
    }

    if (typeof instruction.startTimeMs !== 'number' || instruction.startTimeMs < 0) {
        errors.push('startTimeMs must be a non-negative number');
    }

    if (typeof instruction.durationMs !== 'number' || instruction.durationMs <= 0) {
        errors.push('durationMs must be a positive number');
    }

    // Validate frame
    if (!instruction.frame) {
        errors.push('Frame is required');
    } else {
        if (instruction.frame.width <= 0) {
            errors.push('Frame width must be positive');
        }
        if (instruction.frame.height <= 0) {
            errors.push('Frame height must be positive');
        }
    }

    // Validate bounding box
    if (!instruction.boundingBox) {
        errors.push('Bounding box is required');
    } else {
        const bbox = instruction.boundingBox;
        const frame = instruction.frame || { width: 0, height: 0 };

        if (bbox.width <= 0) {
            errors.push('Bounding box width must be positive');
        }
        if (bbox.height <= 0) {
            errors.push('Bounding box height must be positive');
        }

        // Check bounding box is inside frame
        if (bbox.x < 0 || bbox.y < 0) {
            errors.push('Bounding box must have non-negative coordinates');
        }
        if (bbox.x + bbox.width > frame.width) {
            errors.push('Bounding box exceeds frame width');
        }
        if (bbox.y + bbox.height > frame.height) {
            errors.push('Bounding box exceeds frame height');
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Check if instruction contains any forbidden fields
 * @param {Object} instruction - The instruction to check
 * @returns {Object} { clean: boolean, violations: string[] }
 */
export function checkInstructionPurity(instruction) {
    const forbiddenFields = [
        'scale',
        'transformOrigin',
        'transform-origin',
        'cssEasing',
        'easing',
        'ffmpegFilter',
        'anchorX',
        'anchorY',
        'autoScale',
        'effectiveRatio',
        'areaRatio'
    ];

    const violations = [];

    function checkObject(obj, path = '') {
        for (const key of Object.keys(obj)) {
            const fullPath = path ? `${path}.${key}` : key;

            if (forbiddenFields.includes(key)) {
                violations.push(`Forbidden field: ${fullPath}`);
            }

            if (typeof obj[key] === 'object' && obj[key] !== null) {
                checkObject(obj[key], fullPath);
            }
        }
    }

    checkObject(instruction);

    return {
        clean: violations.length === 0,
        violations
    };
}
