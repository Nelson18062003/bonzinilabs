# Timing note from the lead
`data/timing.json` now holds the REAL voice timing (voice starts, `dur`, `words` relative to each line's speech start, `end`),
written by `serie/retime.py` from the chosen takes (`data/takes.json`). render.mjs injects it as `window.TIMING`; node reads it
too if your score does so. Keep every action derived from `T`/`W`/`DUR` — never hard-code times. Use
`node -e "console.log(JSON.stringify(require('./overlay/scenes/01_score.js').T))"` from the episode folder to see them.
