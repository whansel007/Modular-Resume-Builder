# PRD: Resume Builder Web App

## 1. Product Overview

A single-page web application where users build tailored resumes by dragging experience blocks from a pool into a resume view, guided by a keyword checklist. The layout is a three-panel workspace.

## 2. Tech Stack

- **Framework**: React 18 + Vite
- **Drag-and-drop**: `@dnd-kit/core` + `@dnd-kit/sortable`
- **Styling**: CSS Modules (no external UI library -- keeps it lightweight)
- **Persistence**: `localStorage`
- **Language**: JavaScript (no TypeScript, to keep scope tight for MVP)

## 3. Layout

```
+------------------+------------------------+------------------+
|   LEFT PANEL     |    MIDDLE PANEL        |   RIGHT PANEL    |
|   Keywords       |    Resume Canvas       |   Experience     |
|   Checklist      |    (drop zone)         |   Pool           |
|   ~250px         |    (flex-grow)         |   ~300px         |
+------------------+------------------------+------------------+
```

- Fixed-height viewport, no page scroll. Each panel scrolls independently.
- Responsive: on screens below 1024px, panels stack vertically with tab navigation.

## 4. Feature Specification

### 4.1 Left Panel -- Keyword Checklist

**Purpose**: User writes keywords from a job description they want to hit in their resume. Acts as a writing guide.

- Text input at top with "Add" button (or Enter key) to add a keyword.
- Each keyword renders as a checkbox item (unchecked by default).
- User can manually check/uncheck keywords (no auto-detection).
- Delete button (X) on each keyword to remove it.
- Counter at bottom: "X / Y keywords addressed".
- Data stored in `localStorage` under key `resume-builder-keywords`.

### 4.2 Middle Panel -- Resume Canvas

**Purpose**: The actual resume being assembled. Accepts dropped experience blocks.

- Header section at top: editable fields for Name, Email, Phone, LinkedIn (plain text inputs styled to look like a resume header).
- Below header: a vertical drop zone area labeled "Drag experiences here".
- Dropped experiences render as sortable cards in the order they were placed.
- Each card in the canvas shows: job title, company, date range, and bullet points (from the experience block).
- Cards can be reordered within the canvas via drag-and-drop (sortable).
- A small "X" button on each card removes it back to the pool (returns it to the right panel).
- "Export PDF" button at bottom (uses `window.print()` with a print-optimized CSS stylesheet -- no external PDF library needed for MVP).
- Data stored in `localStorage` under key `resume-builder-canvas`.

### 4.3 Right Panel -- Experience Pool

**Purpose**: Library of all the user's experiences. Source for drag operations.

- "Add Experience" button at top opens an inline form (not a modal -- keeps flow simple).
- Form fields:
  - Job Title (text input, required)
  - Company (text input, required)
  - Start Date / End Date (month+year inputs)
  - "Current" checkbox (disables End Date)
  - Bullet Points (textarea, one bullet per line)
  - Tags (comma-separated text input for categorization, e.g., "leadership, python, aws")
- Submitted experiences appear as draggable cards below the form.
- Cards show a condensed view: title, company, date range.
- Search/filter input to filter pool by title, company, or tag.
- Edit button on each card to modify details.
- Delete button on each card to permanently remove.
- Once an experience is dragged to the canvas, it is marked as "used" (greyed out in pool, not draggable again until removed from canvas).
- Data stored in `localStorage` under key `resume-builder-experiences`.

## 5. Drag-and-Drop Behavior

- Drag source: experience cards in the right panel.
- Drop target: the canvas area in the middle panel.
- On drag start: card lifts with slight scale (1.02) and shadow.
- On hover over drop zone: drop zone highlights with a dashed border.
- On drop: experience is added to canvas at the hovered position (or appended at bottom).
- Reordering within canvas: `@dnd-kit/sortable` handles vertical reordering.
- Removing from canvas: clicking "X" on a canvas card returns the experience to the pool (un-greys it).

## 6. Data Model

```js
// Experience
{
  id: string (uuid),
  title: string,
  company: string,
  startDate: string,    // "YYYY-MM"
  endDate: string|null, // null = current
  bullets: string[],
  tags: string[]
}

// Keyword
{
  id: string (uuid),
  text: string,
  checked: boolean
}

// Canvas state
{
  header: { name, email, phone, linkedin },
  experienceIds: string[]  // ordered list of experience IDs
}
```

## 7. File Structure

```
src/
  App.jsx                  -- Main layout, three-panel grid
  App.module.css
  main.jsx                 -- Entry point
  components/
    KeywordPanel/
      KeywordPanel.jsx     -- Left panel
      KeywordPanel.module.css
    ResumeCanvas/
      ResumeCanvas.jsx     -- Middle panel
      ResumeCanvas.module.css
      ExperienceCard.jsx   -- Card rendered in canvas
      ExperienceCard.module.css
    ExperiencePool/
      ExperiencePool.jsx   -- Right panel
      ExperiencePool.module.css
      ExperienceForm.jsx   -- Add/edit form
      ExperienceForm.module.css
      PoolCard.jsx         -- Card in the pool
      PoolCard.module.css
  hooks/
    useLocalStorage.js     -- Custom hook for localStorage read/write
  utils/
    id.js                  -- UUID generator (crypto.randomUUID)
  print.css                -- Print-specific styles for PDF export
index.html
package.json
vite.config.js
```

## 8. Implementation Steps

1. **Scaffold project**: `npm create vite@latest resume-builder -- --template react`, install `@dnd-kit/core`, `@dnd-kit/sortable`.
2. **Create `useLocalStorage` hook**: reusable state sync with localStorage.
3. **Build App.jsx layout**: three-panel CSS grid, full viewport height.
4. **Build KeywordPanel**: input, list, checkboxes, counter.
5. **Build ExperiencePool**: form, card list, search filter, CRUD operations.
6. **Build ResumeCanvas**: header fields, drop zone, sortable card list, PDF export button.
7. **Wire up drag-and-drop**: configure `DndContext`, drag sources in pool, drop target in canvas, sortable within canvas.
8. **Add print.css**: hide left/right panels, style middle panel for clean A4 output.
9. **Test end-to-end**: add experiences, drag to canvas, reorder, remove, export PDF, reload page to verify persistence.
