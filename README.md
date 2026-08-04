# Modular Resume Builder

A full-stack web application for building tailored resumes from a library of reusable content blocks. Features user authentication, cloud persistence, a dashboard for managing multiple resumes, and drag-and-drop block organization.

![React](https://img.shields.io/badge/React-18-blue)
![Vite](https://img.shields.io/badge/Vite-6-purple)
![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-green)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Resume Builder
- **Reusable block library** — Create Experience, Education, Skills, and Summary blocks once, reuse across multiple resumes
- **Drag-and-drop canvas** — Drag blocks from the library into resume sections, reorder freely
- **Job-type tagging** — Tag blocks with job categories and filter by type using an ID-based reference system
- **Template switching** — Choose between Modern and Classic resume templates
- **Live preview** — See changes on the resume page as you build
- **PDF export** — Print-optimized stylesheets produce clean A4 output via `window.print()`
- **Editable resume title** — Rename resumes directly in the builder header
- **Save to cloud** — Persist resumes and blocks to MongoDB with one click

### Dashboard
- **Resume management** — View all your resumes in a card grid layout
- **Create new resumes** — Start with a blank resume template
- **Copy resumes** — Duplicate existing resumes with one click
- **Delete resumes** — Remove resumes with confirmation
- **Block management** — Create, edit, and delete blocks directly from the dashboard
- **Job types management** — Add and remove job type categories that sync across all blocks
- **Refresh data** — Reload all data from the server

### Backend & Authentication
- **User authentication** — Register and login with bcrypt password hashing + JWT tokens
- **MongoDB persistence** — All data stored in MongoDB Atlas (cloud) or local MongoDB
- **Multi-user support** — Each user has their own resumes, blocks, and job types
- **Owner-scoped data** — Resumes and blocks are scoped to the logged-in user's email
- **Vercel serverless ready** — Backend can be deployed to Vercel as serverless functions

### Architecture
- **Job types as user-level dictionary** — Job types are stored once per user and referenced by ID across all blocks
- **ID-based block referencing** — Blocks reference job types by ID, enabling synchronized updates
- **Content flattening** — MongoDB stores blocks with nested content, but the API and frontend use flat fields
- **Route-driven data loading** — Builder fetches resume and blocks from MongoDB based on URL parameters

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite 6 |
| Backend | Express.js (local dev) / Vercel Serverless Functions (prod) |
| Database | MongoDB Atlas (Mongoose ODM) |
| Authentication | bcrypt (password hashing) + JWT (session tokens) |
| Drag & Drop | `@dnd-kit/core`, `@dnd-kit/sortable` |
| Styling | CSS Modules + CSS Custom Properties |
| Build | Vite (HMR in dev, static bundle in prod) |
| Deployment | Vercel (frontend + serverless API) |

## Getting Started

### Prerequisites

- **Node.js** 18+ (required by bcrypt 6.x and other dependencies)
- **npm** 9+
- **MongoDB** — Either local MongoDB or MongoDB Atlas connection string

### Environment Variables

Create a `server/.env` file with:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
```

### Install & Run

```bash
# Install dependencies
npm install

# Start backend server (http://localhost:3001)
npm run server

# Start frontend dev server (http://localhost:5173)
npm run dev

# Seed database with sample data
npm run seed

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
├── api/                              Vercel serverless functions
│   ├── auth/                         Authentication endpoints
│   │   ├── login.js                  POST /api/auth/login
│   │   └── register.js               POST /api/auth/register
│   ├── blocks/                       Block CRUD endpoints
│   │   ├── index.js                  GET/POST/DELETE /api/blocks
│   │   ├── bulk.js                   POST /api/blocks/bulk
│   │   └── [id].js                   DELETE /api/blocks/:id
│   ├── resumes/                      Resume CRUD endpoints
│   │   └── index.js                  GET/POST/DELETE /api/resumes
│   ├── user/                         User-specific endpoints
│   │   └── jobtypes.js               GET/POST/PUT/DELETE /api/user/jobtypes
│   └── lib/                          Shared serverless utilities
│       ├── db.js                     MongoDB connection
│       └── models/                   Mongoose models for serverless
│           ├── Block.js
│           ├── Resume.js
│           └── User.js
├── server/                           Express backend (local dev)
│   ├── index.js                      Express server entry point
│   ├── seed.js                       Database seeding script
│   ├── models/                       Mongoose models
│   │   ├── Block.js
│   │   ├── Resume.js
│   │   └── User.js
│   └── routes/                       Express route handlers
│       ├── blocks.js
│       ├── resumes.js
│       └── jobtypes.js
├── src/                              React frontend
│   ├── App.jsx                       Main builder layout, state management
│   ├── App.module.css                Builder styles
│   ├── main.jsx                      React entry point
│   ├── print.css                     Print-specific styles for PDF export
│   ├── components/
│   │   ├── BlockLibrary/             Left panel — search, filter, draggable blocks
│   │   ├── BlockModal/               Modal for creating/editing blocks
│   │   ├── ResumeCanvas/             Center panel — resume page, sections
│   │   │   └── ResumeBlock.jsx       Individual block card on canvas
│   │   └── PropertiesPanel/          Right panel — template, personal info
│   ├── hooks/
│   │   ├── useLocalStorage.js        localStorage persistence hook
│   │   ├── useExportPdf.js           window.print() wrapper
│   │   └── useJsonExportImport.js    JSON export/import utilities
│   ├── pages/
│   │   ├── Dashboard.jsx             Resume management dashboard
│   │   ├── Dashboard.module.css      Dashboard styles
│   │   ├── Login.jsx                 Login page
│   │   ├── Login.module.css          Login styles
│   │   ├── Register.jsx              Registration page
│   │   └── Register.module.css       Register styles
│   └── utils/
│       ├── id.js                     UUID generator
│       └── constants.js              Block schemas, templates, job types
└── dist/                             Production build output
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user, returns JWT token |
| POST | `/api/auth/login` | Login user, returns JWT token |

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/resumes?owner=<email>` | Get all resumes for user |
| POST | `/api/resumes` | Create or update resume (upsert) |
| DELETE | `/api/resumes?id=<id>` | Delete resume by ID |

### Blocks
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/blocks?owner=<email>` | Get all blocks for user |
| POST | `/api/blocks` | Create or update block (upsert) |
| POST | `/api/blocks/bulk` | Bulk upsert multiple blocks |
| DELETE | `/api/blocks/:id` | Delete block by ID |

### Job Types
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/jobtypes?email=<email>` | Get user's job types dictionary |
| POST | `/api/user/jobtypes` | Add or update job type |
| DELETE | `/api/user/jobtypes?email=<email>&id=<id>` | Delete job type by ID |

## Data Model

### User
```javascript
{
  email: String,           // Unique identifier, also used as owner
  passwordHash: String,    // bcrypt hashed password
  jobTypes: Map,           // { jt1: "Software Development", jt2: "Management", ... }
}
```

### Resume
```javascript
{
  _id: String,             // Unique ID (e.g., "r-1785759620500")
  owner: String,           // User email
  title: String,           // Resume title (editable)
  templateId: String,      // "modern" or "classic"
  personalInfo: {
    name: String,
    email: String,
    phone: String,
    location: String,
  },
  sectionOrder: [String],  // ["Summary", "Experience", "Education", "Skills"]
  sections: {              // Map of section name to block IDs
    "Summary": ["b1"],
    "Experience": ["b2", "b3"],
  },
}
```

### Block
```javascript
{
  _id: String,             // Unique ID (e.g., "b1", "26eaa5ac-...")
  owner: String,           // User email
  type: String,            // "summary", "experience", "education", "skills"
  jobTypeIds: [String],    // References to user's jobTypes dictionary ["jt1", "jt2"]
  content: {               // Type-specific fields (flattened in API responses)
    // Experience: role, company, location, startDate, endDate, description
    // Education: institution, degree, field, startDate, endDate, gpa
    // Skills: category, items
    // Summary: headline, body
  },
}
```

## Key Architectural Decisions

### Job Types as User-Level Dictionary
Job types are stored once per user in the User model as a Map (`{ id: name }`). Blocks reference job types by ID (`jobTypeIds: ["jt1"]`) rather than storing the full names. This enables:
- **Synchronized updates** — Rename a job type once, all blocks update
- **Efficient storage** — IDs are smaller than full names
- **Easy management** — Add/delete job types from dashboard

### Content Flattening
MongoDB stores blocks with a nested `content` object, but the API and frontend expect flat fields. The API handles flattening when returning blocks, and the frontend flattens when loading from MongoDB.

### Route-Driven Data Loading
When navigating to `/builder?resume=<id>`, the builder fetches the specific resume and all blocks from MongoDB. This ensures the builder always has the latest data from the database.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server with HMR at `localhost:5173` |
| `npm run server` | Start Express backend at `localhost:3001` |
| `npm run seed` | Seed database with sample data for `kit@catship.nya` |
| `npm run build` | Bundle for production into `dist/` |
| `npm run preview` | Serve the production build locally |

## Deployment

### Vercel Deployment
The project is configured for Vercel deployment with serverless functions:

```bash
npm run deploy
```

The `api/` directory contains serverless functions that Vercel automatically deploys. The frontend is built with Vite and served as static files.

### Environment Variables for Vercel
Set these in your Vercel project settings:
- `MONGODB_URI` — MongoDB Atlas connection string
- `JWT_SECRET` — Secret key for JWT signing

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
