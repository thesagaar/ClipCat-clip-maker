# ClipCat — AI Video Clipping Studio

> **Long videos. Short attention. Perfect clips.**

ClipCat is a local-first AI video clipping studio that transforms long-form videos into short-form vertical, square, or horizontal clips with Whisper transcription, AI moment scoring, smart framing, and burned-in captions.

This repository contains the complete production-grade React + TypeScript frontend ready to connect to a local Python **FastAPI** backend (`http://127.0.0.1:8000`) and future **Tauri 2** desktop shell.

---

## Features Implemented

- **Dashboard**: Real backend-derived workspace metrics, quick actions, recent projects, active job monitoring, storage overview, and onboarding guide.
- **New Project**:
  - **Upload Video**: Drag-and-drop & file picker with MP4/MOV/MKV/WEBM validation, client-side `<video>` metadata inspection, and XHR upload progress.
  - **Video URL**: URL validation, direct media detection, and honest YouTube restriction notice with local-upload fallback.
  - **Processing Configuration**: Clip count, duration bounds (`15s` / `45s` / `90s`), aspect ratio (`9:16`, `16:9`, `1:1`), video layout (`Smart Face Tracking`, `Center Crop`, `Blurred Background`, `Split Screen`), caption settings, output settings, and **Fully Automatic Processing**.
- **AI Processing Pipeline**: 10-stage vertical pipeline with real polling telemetry, honest indeterminate progress fallback, elapsed/ETA display, live logs, cancellation, retry, and contextual ClipCat mascot guidance.
- **Clip Discovery & Clip Library**: Responsive grids, AI score breakdown (with explicit non-virality guidance notice), sorting, status filtering, and batch selection/export.
- **Clip Preview & Editor**: 3-column studio editor with real HTML5 `<video>` streaming controls (play/pause, seek, volume, speed, fullscreen), trim timing validation, caption/layout overrides, and re-render workflow.
- **Project Library**: Search, status filtering, sorting, Grid/List view toggle, rename dialog, and delete confirmation.
- **Export Manager**: Verified MP4, SRT, VTT, JSON metadata, and thumbnail exports plus Tauri 2 output folder integration.
- **Caption Preset Library**: 6 built-in styles (`Minimal White`, `Bold Yellow`, `Karaoke Highlight`, `Modern Podcast`, `Educational Clean`, `Gaming Bold`) with sample preview, duplication, editing, and factory reset.
- **Workflow Templates**: Ready-to-use templates that pre-populate New Project settings.
- **Settings & System Status**: Whisper model & CPU thread tuning, directory configuration, temporary file cleanup, and live FastAPI/FFmpeg/FFprobe/Python/SQLite health diagnostics.

---

## Tech Stack

- **React 19** + **TypeScript** + **Vite**
- **Tailwind CSS v4**
- **React Router** (`react-router-dom`)
- **TanStack Query** (`@tanstack/react-query`)
- **Zustand** (`zustand`)
- **Lucide React** (`lucide-react`)

---

## Installation & Running Locally

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment** (copy `.env.example` to `.env` if customizing):
   ```env
   VITE_API_BASE_URL=http://127.0.0.1:8000
   VITE_USE_MOCK_API=false
   ```

3. **Start the development server** (port `3000`):
   ```bash
   npm run dev
   ```

4. **Type-check & build for production**:
   ```bash
   npm run lint
   npm run build
   ```

---

## Isolated Mock Adapter (Development Preview Only)

By default (`VITE_USE_MOCK_API=false`), ClipCat communicates exclusively with your local FastAPI backend at `http://127.0.0.1:8000` and honestly reports offline/unavailable states when the backend is not running.

For isolated UI previewing without FastAPI running, set `VITE_USE_MOCK_API=true` (or click **Preview with Mock Sample Data** in the offline banner). An unmistakable top banner indicates whenever the Mock Adapter is active.

---

## Backend Integration

See [`docs/FRONTEND_BACKEND_CONTRACT.md`](./docs/FRONTEND_BACKEND_CONTRACT.md) for the complete FastAPI endpoint specification, JSON schemas, error formats, and video streaming requirements.
