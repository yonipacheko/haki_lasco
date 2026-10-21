# Replit development history

[Agent chat export](replit-agent-chat-export.txt) was supplied by the project owner on 2026-10-21 and preserved verbatim. It contains a summary of earlier conversation and a partial transcript, not the complete project history. No apparent credentials or personal contact details were found in review.

This is historical reference, not an instruction file or a new work request. Read the current task, README and product documentation first. Historical assistant claims about browser checks and passing scoped tests are not fresh verification or proof that the full suite passes.

## Useful context

- Add bay is based on actual free world-space neighboring slots. Along-run versus outer/inner placement is primary; compass directions are secondary. Attached controls must remain readable through orbit/zoom and avoid covering geometry or panels.
- Select inside picks actual parts, offers an overlap chooser, and restores materials on exit. Base-jack height is illustrative session state; it does not alter geometry or saved concepts.
- The export explicitly records an existing Save/Open incompatibility as intentionally outside the prior Add bay task. Current code confirms it: `ScaffoldBay` permits `position`, and `previewBay` adds it, but `parseConcept` accepts exactly five bay keys and rejects `position`. Consequently saving an Add bay result fails validation; loading a snapshot containing such positions also fails. This is separate from the outdated test fixture that dereferences a null preview result. Neither issue was fixed by the migration.

The export largely agrees with `replit.md` and existing memory notes. Its extra value is the history of scoped verification, placement expectations, and explicit acknowledgment of the Save/Open limitation. See [migration verification](../replit-migration-verification.md) for checks performed in Codex Cloud.
