# ADR-0001: Jewish day flips at tzeit 8.5° (hebcal default)

**Status:** Accepted (gabbai decision, 2026-09-14)
**Context:** times conventions / day boundary

## Context

The Jewish-day boundary — when the header rolls to tomorrow's date, the
event panel switches to tomorrow's lines, and scheduled images activate —
is decided by @hebcal/core's `Zmanim.tzeit()`.

The engineering notes originally said the flip used tzeit **7.083°**
(hebcal's older default for "3 small stars"). The actual live code has
always called `tzeit()` with no argument, which in @hebcal/core 6.x
defaults to **8.5°** — roughly 7 minutes later at Netivot than 7.083°
(e.g. Sep 14 2026: 19:25 vs ~19:18). The mismatch was discovered during
the Sep 2026 code review; header and panel always agreed with each other
because both use the same default call.

## Decision

**Keep 8.5°** — the live behavior since launch. It fits the Or Hahaim
convention the community follows (the day runs late into the evening;
the exit line's 1-hour linger already covers the gap between the
displayed Or Hahaim tzais and the day flip). Both the header and the
event panel must keep using the same `tzeit()` call so the two flip
inseparably.

## Consequences

- The Jewish date in the header rolls ~7 min later than a 7.083° boundary
  would. Nobody has observed this as a problem since launch.
- Exit lines (havdalah / יציאת החג / סיום הצום) live 1 hour past their
  printed time and additionally survive the day flip via the linger
  logic (`LINGER_MS` in `src/lib/events.js`), so the flip instant never
  cuts a line early.
- Any future change of this angle is a **display-affecting change** and
  requires a new ADR superseding this one — it moves every day-flip and
  every linger expiry, and also shifts when scheduled holiday images
  activate.
- The displayed צאת הכוכבים (Or Hahaim: shkiah + 0.25 seasonal hour) and
  the day-flip tzeit (8.5°) are **two different things by design** —
  the column shows the community's tzais, the flip uses the library's
  boundary. Do not "fix" one to match the other.

## Verification

- `scripts/test-events.mjs` linger checks (§15, §16) assert lines
  survive past the 8.5° flip.
- The tzeit() call sites: `src/App.jsx` (computeDisplayData) and
  `src/lib/events.js` (computeEventLines) — keep both argument-less.