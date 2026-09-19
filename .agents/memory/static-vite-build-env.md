---
name: Static Vite build environment
description: Static artifact builds may not receive workflow runtime variables.
---

Static Vite artifact builds should use safe defaults for `PORT` and `BASE_PATH`, while managed workflows continue to provide their runtime values.

**Why:** Replit's static production build runs without the workflow's runtime `PORT`, so a Vite config that requires it unconditionally fails before bundling.

**How to apply:** Keep strict validation for invalid values, but fall back to a build-safe port and root base path when those variables are absent.