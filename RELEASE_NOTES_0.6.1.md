# Release 0.6.1

Released: 2026-11-05

## ✨ Features

- **The battery runout mark glides instead of jumping.** When the load changes and the runtime forecast moves, the red line on the spiral now slides along the spiral to its new spot (about 1.2 s) instead of snapping there on every update. No animation on the first render, when switching tabs, or when the system asks for reduced motion.
- The README shows the battery runout mark as an animated GIF.

## 🔄 Update Instructions

1. Update via HACS or manually pull the latest version
2. Restart Home Assistant
3. Refresh the dashboard (clear the browser cache if the card still looks the same)
