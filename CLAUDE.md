# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NewScreens is a screenshot management application with AI-powered analysis and WordPress integration. Users paste/drop screenshots, which are analyzed by Google Gemini AI for automatic naming, description, and keyword tagging. Screenshots can optionally sync to WordPress media library.

## Commands

```bash
# Development
npm run dev          # Start dev server on port 3010
npm run build        # Production build
npm run start        # Start production server on port 3010
npm run lint         # Run ESLint

# Database
npx prisma generate  # Generate Prisma client (runs automatically on npm install)
npx prisma migrate dev  # Run migrations in development
npx prisma studio    # Open Prisma Studio GUI
```

## Architecture

### Tech Stack
- **Frontend**: Next.js 16 with React 19, TypeScript, Tailwind CSS
- **UI Components**: Radix UI primitives with shadcn/ui styling (in `components/ui/`)
- **Database**: SQLite via Prisma ORM
- **AI**: Google Gemini 2.0 Flash Lite for image analysis
- **WordPress**: Custom plugin integration via REST API

### Key Data Flow

1. **Image Input**: User pastes (Ctrl+V) or drags images into PasteZone or History tab
2. **AI Analysis**: `/api/analyze` sends image to Gemini, returns description, filename, keywords
3. **Storage**: `/api/upload` saves image to `public/screenshots/[folder]/`, `/api/screenshots` saves metadata to SQLite
4. **WordPress Sync**: `/api/wordpress/upload` pushes to WordPress media library (optional)

### Database Models (prisma/schema.prisma)
- `Screenshot`: Core entity with filename, filepath, AI-generated metadata, WordPress sync status
- `LibraryFolder`: Organizes screenshots into folders (maps to filesystem directories)
- `ApiUsage`: Tracks Gemini API token usage and costs
- `Settings`: Key-value store for WordPress credentials and app config

### API Routes (app/api/)
- `/analyze` - Gemini image analysis
- `/upload` - Save image file to disk
- `/screenshots` - CRUD for screenshot metadata
- `/folders` - Library folder management
- `/wordpress/*` - WordPress integration (upload, bulk-upload, test)
- `/ai-search` - Semantic search across screenshots using Gemini
- `/serve/[...path]` - Serve screenshot images

### Main Components (components/)
- `paste-zone.tsx` - Image paste/drop with auto or manual mode
- `screenshot-card.tsx` - Display card with edit, delete, copy URL actions
- `sidebar.tsx` - Navigation and folder selection
- `settings-panel.tsx` - WordPress config and API usage stats

## Environment Variables

Required in `.env`:
```
GEMINI_API_KEY=your_gemini_api_key
DATABASE_URL="file:./prisma/dev.db"
```

WordPress settings stored in database via Settings panel, not env vars.

## Commit Policy

Always commit all changes when making modifications to the codebase.
