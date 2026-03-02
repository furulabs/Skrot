# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

Skrot ("løfte skrot" — Norwegian for lifting iron) is a PWA workout tracker for periodized strength training. It guides users through set-by-set logging across four training phases (P1 Hypertrophy, P2 Strength, P3 Power, DL Deload) with two alternating sessions (A and B). Each session has 4 exercises × 4 sets = 16 total sets.

## Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — TypeScript check + Vite production build
- `npm run lint` — ESLint across the project
- `npm run preview` — Preview production build locally

No test framework is configured.

## Architecture

**Stack:** React 19 + TypeScript + Vite + vite-plugin-pwa. No router — navigation is tab-based state in App.tsx.

**Data layer** uses two storage mechanisms:
- **Dexie (IndexedDB)** for workouts and exercise logs (`src/db/database.ts` — `PeriodDB` class with `workouts` and `exerciseLogs` tables)
- **localStorage** for draft state (in-progress workout), program settings (phase durations, rest timers, rep ranges, bodyweight), and optional Supabase credentials

**Supabase sync** is optional — users can configure URL + anon key in Settings. Sync pushes unsynced local records and pulls remote ones, using a `synced` flag (0/1) on each record.

**Domain model** (`src/types/index.ts`):
- `Phase` (P1/P2/P3/DL) and `Session` (A/B) define the training program structure
- `Workout` → has many `ExerciseLog` entries (linked by `workoutId`)
- `Draft` persists in-progress workout state to survive page refreshes

**Seed data** (`src/db/seed.ts`): Exercise definitions and phase configs are hardcoded constants, not DB records. Exercises have a `legacy` flag for soft-deletion.

**UI structure** — App.tsx renders a bottom tab bar (Home/History/Settings). ActiveWorkout takes over full-screen when a workout is started. Components use `dexie-react-hooks` for reactive DB queries.
