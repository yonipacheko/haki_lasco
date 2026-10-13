---
name: Workflow status after merges
description: Managed workflow status is not always proof of actual server liveness after automatic merge reconciliation.
---

A managed workflow marked failed after a merge can coexist with an older, healthy server still bound to the same port. Do not change the configured port or create another workflow to work around that state.

**Why:** Automatic reconciliation once reported a port-in-use failure while an earlier Vite worker continued serving the preview. Trusting status alone would have produced a duplicate service rather than restoring management of the existing one.

**How to apply:** When merge reconciliation reports port-in-use, verify the listener's identity and actual server response before deciding whether the managed service needs restarting.
