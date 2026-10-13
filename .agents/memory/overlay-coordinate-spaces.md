---
name: Overlay coordinate spaces
description: Why world-anchored controls can overlap panels despite correct projection and collision checks.
---

Native focus can scroll an overflow-hidden viewport when focused panel content moves outside its visible area. Absolute child coordinates and viewport-relative panel rectangles then differ, even though the world-to-screen projection is correct.

**Why:** Closing the focused Levels panel exposed this behavior: the HUD became clipped, and placement controls were incorrectly judged clear of an action panel.

**How to apply:** Keep projected anchors, selected-object bounds, and UI obstacles in one coordinate space, accounting for ancestor scrolling. Correct focus-induced viewport scrolling within the affected interaction rather than changing camera orientation or unrelated editing flows.
