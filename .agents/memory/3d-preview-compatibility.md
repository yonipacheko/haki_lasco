---
name: 3D preview compatibility
description: Why this prototype must remain usable without a WebGL context
---

The preview capture browser can fail to create a WebGL context even when the app starts correctly. Do not let that failure crash the entire workspace.

**Why:** Verification of this project's first 3D scene exposed a browser-level context failure, not a failed Vite server or missing scene data.

**How to apply:** Keep WebGL as the primary Three.js renderer where available and preserve a genuine interactive scene-rendering fallback where it is unavailable. Check the renderer path before treating a preview capture failure as a geometry or application-state bug.
