# CSS-Based Video Effect Preview Renderer

## 1. Frontend Responsibility Boundary (Non-Negotiable)

### The frontend:
- ✅ Renders preview only
- ✅ Uses CSS transforms for visual feedback
- ✅ Collects bounding boxes and time ranges
- ✅ Emits fact-based instructions

### The frontend MUST NOT:
- ❌ Export video
- ❌ Compute final zoom scale
- ❌ Contain FFmpeg logic
- ❌ Store CSS values in instructions
- ❌ Assume preview == final output

---

## 2. Frontend Mental Model

```
Video Frame (fixed)
│
├── Video Element (plays demo video)
│
└── Effect Overlay Layer (CSS only)
```

- The video element is never resized
- Zoom preview is achieved by scaling the video layer
- Bounding boxes are interaction guides, not effects

---

## 3. User Interaction Flow

### Step 1 — User Plays Video
- Video plays normally
- Timeline cursor moves

### Step 2 — User Selects an Element
- DOM inspection / heuristic logic identifies a bounding box
- Bounding box is drawn as a rectangle overlay
- Bounding box data: `x, y, width, height`
- Coordinates are always:
  - Relative to the video frame
  - Top-left origin
  - Pixel values

### Step 3 — User Applies "Zoom Effect"
- User chooses: Start time, End time (or duration)
- User does NOT choose scale manually
- Frontend now has: Frame size, Bounding box, Time range

---

## 4. Preview Logic (CSS Only — Not Authoritative)

### 4.1 Deriving Preview Values (Ephemeral)

The frontend MAY derive:
- `anchorX` / `anchorY`
- approximate scale (for preview only)

But these values are:
- NOT stored
- NOT sent to backend
- Only for immediate user feedback

### 4.2 CSS Preview Transform

```css
.video-layer {
  transform-origin: 52% 34%;
  transform: scale(1.6);
  transition: transform 600ms linear;
}
```

This visually simulates zoom, but it is NOT final truth.

---

## 5. The Instruction File (Most Important Output)

### 5.1 What the Frontend MUST Generate

```json
{
  "effect": "zoom",
  "startTimeMs": 16220,
  "durationMs": 1660,
  "frame": {
    "width": 1920,
    "height": 1080
  },
  "boundingBox": {
    "x": 640,
    "y": 320,
    "width": 240,
    "height": 48
  }
}
```

### 5.2 Field Definitions

| Field | Description |
|-------|-------------|
| `effect` | Always "zoom" |
| `startTimeMs` | When zoom begins |
| `durationMs` | How long zoom lasts |
| `frame.width` | Video width at preview time |
| `frame.height` | Video height at preview time |
| `boundingBox` | Area user wants to zoom into |

---

## 6. What the Frontend MUST NOT Send

The instruction file must never include:
- ❌ scale
- ❌ transform-origin
- ❌ CSS easing
- ❌ FFmpeg filters
- ❌ derived ratios
- ❌ preview-specific hacks

**The instruction must remain pure and minimal.**

---

## 7. Communication with Go (Fiber) Backend

### Endpoint
```
POST /render/zoom
Content-Type: application/json
```

### Request Body

```json
{
  "instruction": {
    "effect": "zoom",
    "startTimeMs": 16220,
    "durationMs": 1660,
    "frame": {
      "width": 1920,
      "height": 1080
    },
    "boundingBox": {
      "x": 640,
      "y": 320,
      "width": 240,
      "height": 48
    }
  },
  "output": {
    "format": "mp4",
    "quality": "high"
  }
}
```

---

## 8. Frontend Validation Rules (Required)

Before sending:
- ✅ Bounding box must be inside frame
- ✅ Width & height > 0
- ✅ Duration > 0
- ✅ Frame dimensions known

**Invalid instructions must never reach backend.**

---

## 9. Response Handling

### Backend Response
```json
{
  "status": "success",
  "outputVideoPath": "/videos/output_123.mp4"
}
```

---

## 10. Auto-Scale Algorithm (Preview Only)

### Core Concept
Smaller elements get MORE zoom, larger elements get LESS zoom.

### Formula
```javascript
// Calculate ratios
areaRatio = (bounds.width * bounds.height) / (screenWidth * screenHeight)
widthRatio = bounds.width / screenWidth
heightRatio = bounds.height / screenHeight
dominantRatio = Math.max(widthRatio, heightRatio)
effectiveRatio = Math.max(areaRatio, dominantRatio)

// Apply scaling tiers
if (effectiveRatio < 1%):    autoScale = 1.5x - 2.0x
if (effectiveRatio < 10%):   autoScale = 1.2x - 1.5x
if (effectiveRatio < 50%):   autoScale = 1.0x - 1.2x
if (effectiveRatio > 50%):   autoScale = 1.0x
```

**Note:** These preview values are ephemeral and never sent to backend.

---

## 11. Why This Design Is Correct

- Preview is fast and flexible
- Backend is authoritative
- Instruction file is: stable, replayable, debuggable
- Same instruction works for: CSS preview, FFmpeg export
- No rewrite needed for future effects

---

## 12. Scaling to Other Effects

Once zoom works, same pattern applies:
- **Blur** = same bbox + intensity
- **Highlight** = same bbox + opacity
- **Glow** = same bbox + color
- **Callout** = same bbox + stroke

The instruction philosophy stays unchanged.

---

## 13. Debug Output

### Console Logs
```
[INIT] Normalized effect: 4.08 - 8.685 s
  Center: 512.0 , 360.0
  Anchor: 0.500 , 0.500
  AutoScale: 1.00 (area: 187.30%, dominant: 62.50%, effective: 187.30%)

[ZOOM] Effect: 16.22-17.88s, progress=0.500
  Scale: 1.99x (effective: 0.02%, dominant: 0.01%)
  Anchor: (0.145, 0.152)
```

---

## Usage

```bash
npm run dev
# Open http://localhost:5173
```

---

## Architecture Guarantee

This CSS preview renderer is **instruction-compatible** with the Go backend:
- Same instruction format for preview and export
- Frontend never computes final values
- Backend is single source of truth for FFmpeg rendering
