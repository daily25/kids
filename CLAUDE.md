# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kids Task Tracker — a vanilla JavaScript PWA for managing children's daily tasks and pocket money with gamification (points, levels, badges, streaks). Uses Firebase Realtime Database for multi-device sync and LocalStorage for offline-first persistence.

## Tech Stack

- Pure HTML/CSS/JS (no framework, no build system, no bundler)
- Firebase SDK v9.22.0 (compat mode) for real-time sync
- PWA with Service Worker (`sw.js`, cache version v46)
- No package.json, no npm, no tests, no linter

## Architecture

**Two entry points:**
- `index.html` — Parent/admin interface (full CRUD)
- `kids-view.html` — Read-only view for kids (uses `app-readonly.js`)

**JavaScript modules (loaded via `<script>` tags):**
- `js/firebase.js` — Firebase init, cloud sync, real-time listener
- `js/storage.js` — Core business logic: data persistence, task CRUD, completions, points/money calculation, badges, streaks, levels
- `js/components.js` — UI rendering: task cards, dot matrix, dashboard, celebrations
- `js/app.js` — Main app: event handling, modals, navigation, sound playback, service worker registration
- `js/app-readonly.js` — Self-contained read-only version for kids view

Modules use the Revealing Module Pattern (IIFE). Global `appData` object holds all state, mutated directly with manual UI re-renders.

**State shape:**
```
appData.settings — allowances, weekStart, soundsEnabled, taskSounds
appData.kids.{oliver,miles,zander} — name, avatar, tasks[], badges[], bankedMoney, lastWeekEarnings
appData.completions — keyed by "kidId_taskId_YYYY-MM-DD"
appData.badges — keyed by "kidId_badgeType_date"
appData.pointAdjustments — array of {id, kidId, amount, reason, type, date}
```

**Kid IDs are hardcoded:** `oliver`, `miles`, `zander`

## Key Conventions

- **Version number** lives in `index.html` line 33: `<span class="app-version">vX.XX</span>`. Increment by 0.01 for each deployment.
- **Cache busting:** query params on script tags (`?v=7`); service worker cache version in `sw.js` must be bumped manually.
- **Deployment:** increment version → `git add -A` → `git commit` → `git push origin main`
- **Date format:** `YYYY-MM-DD` (local timezone). Week starts Monday.
- **Completion keys:** `"kidId_taskId_YYYY-MM-DD"`
- **Points formula:** earned = completed task points + bonuses − (1 × missed tasks). Weekly money = (earned / possible) × maxAllowance.
- **CSS:** single file `css/styles.css`, dark theme, mobile-first, 500px max-width. No preprocessor.
- **Code style:** semicolons, single quotes, 4-space indentation.
- **App is deployed under `/kids/` path** (service worker scope).
