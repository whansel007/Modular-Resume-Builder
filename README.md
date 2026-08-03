# Modular Resume Builder

A web application for building tailored resumes from a library of reusable content blocks. Drag blocks into a resume canvas, organize them by job type, and export to PDF.

![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

- **Reusable block library** — Create Experience, Education, Skills, and Summary blocks once, reuse across multiple resumes
- **Drag-and-drop canvas** — Drag blocks from the library into resume sections, reorder freely
- **Job-type tagging** — Tag blocks with job categories (e.g., Software Development, Management) and filter by type
- **Template switching** — Choose between Modern and Classic resume templates
- **Live preview** — See changes on the resume page as you build
- **PDF export** — Print-optimized stylesheets produce clean A4 output via `window.print()`
- **Persistent storage** — All data saved to `localStorage`, survives page refreshes

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + Vite 6 |
| Drag & Drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Styling | CSS Modules + CSS Custom Properties |
| Persistence | `localStorage` |
| Build | Vite (HMR in dev, static bundle in prod) |

## Getting Started

### Prerequisites

- **Node.js** 18+ (see `.node-version` for exact version)
- **npm** 9+

### Install & Run

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
src/
├── App.jsx                          Main layout, state management, drag-and-drop wiring
├── App.module.css                   Global styles, CSS variables, layout grid
├── main.jsx                         React entry point
├── print.css                        Print-specific styles for PDF export
├── components/
│   ├── BlockLibrary/                Left panel — search, filter, draggable block cards
│   ├── ResumeCanvas/                Center panel — resume page, sections, drop zones
│   │   └── ResumeBlock.jsx          Individual block card on the canvas
│   ├── PropertiesPanel/             Right panel — template picker, personal info
│   └── BlockModal/                  Modal for creating/editing blocks
├── hooks/
│   ├── useLocalStorage.js           localStorage persistence hook
│   └── useExportPdf.js              window.print() wrapper
└── utils/
    ├── id.js                        UUID generator (crypto.randomUUID)
    └── constants.js                 Block schemas, templates, initial data, job types
```

## Layout

```
┌──────────────────┬────────────────────────┬──────────────────┐
│   Block Library  │    Resume Canvas       │   Properties     │
│   (search,       │    (drag-and-drop      │   (template,     │
│    filter,        │     sections,           │    personal      │
│    blocks)        │     preview)            │    info)         │
│   320px          │    flex-grow            │   280px          │
└──────────────────┴────────────────────────┴──────────────────┘
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR at `localhost:5173` |
| `npm run build` | Bundle for production into `dist/` |
| `npm run preview` | Serve the production build locally |

## Data Model

All application state is stored in `localStorage` under these keys:

| Key | Content |
|-----|---------|
| `resume-builder-blocks` | Array of content blocks (experience, education, skills, summary) |
| `resume-builder-canvas` | Resume structure — title, template ID, ordered sections with block references |
| `resume-builder-personal` | Personal info — name, contact line |
| `resume-builder-jobtypes` | List of job-type tags (defaults + custom) |

## Block Types

| Type | Fields |
|------|--------|
| **Experience** | Company, Role, Location, Start/End Date, Description |
| **Education** | Institution, Degree, Field, Start/End Date, GPA/Honors |
| **Skills** | Category, Skills (comma-separated) |
| **Summary** | Headline, Body text |

## Documentation

- [Product Requirements Document](Resume_Builder_PRD.md) — full PRD with feature specs, user stories, data model, and roadmap

## License

MIT
