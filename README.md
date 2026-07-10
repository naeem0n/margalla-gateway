# Margalla Gateway — Rental Management System

Three-portal rental management for **Margalla Gateway**: Admin, Resident, and Third Party — available as a **website** (React + Node) and **desktop app** (Electron + SQLite).

## Portals & Routes

| Route | Portal | Access |
|-------|--------|--------|
| `/welcome` | Public marketing site | Open |
| `/` | **Resident Portal** | Home button only (session gate) + login |
| `/admin` | **Admin Portal** | Password login at `/admin/login` |
| `/thirdparty` | **Third Party Portal** | Hidden — admin-issued ID/password only |

## Features

### Admin Portal (`/admin`)
- Secure login (default desktop: `ADMIN-001` / `admin123`)
- Generate ID + password for Residents and Third Party
- Ledger (rent, security, maintenance)
- Reports upload/download
- Account maintenance
- Backup & restore (JSON cloud + `.db` file on desktop)

### Resident Portal (`/`)
- Enter via **HOME** button on the main site header
- Direct URL blocked without Home-button session gate
- Read-only ledger, document downloads, maintenance complaints

### Third Party Portal (`/thirdparty`)
- Not linked in public navigation
- Limited access per admin-defined permissions

## Architecture

```
React UI (Vite + TanStack Router)
        ↓
Node.js API (Express) — server/
        ↓
┌─────────────────┬──────────────────────┐
│ Desktop: SQLite │ Cloud: Postgres/MySQL │
└─────────────────┴──────────────────────┘
        ↓ sync queue (desktop → cloud)
   Live website admin / resident / 3rd party
```

## Quick Start

### Website (development)

```bash
# Install frontend + server dependencies
npm install
npm install --prefix server

# Terminal 1 — API (SQLite by default)
npm run dev:server

# Terminal 2 — React UI
npm run dev
```

Open `http://localhost:5173/welcome` → click **HOME** for resident portal.

### Cloud deployment (Postgres)

Set in `server/.env` or environment:

```env
DB_MODE=postgres
DATABASE_URL=postgresql://user:pass@host:5432/margalla
JWT_SECRET=your-secret
SYNC_API_KEY=shared-sync-key
```

### Desktop app

```bash
npm install
npm install --prefix server
npm run electron:dev    # dev: Vite + Electron + local SQLite
npm run electron:build  # produces NSIS installer in release/
```

Installer wizard: **Next → Next → Finish** with desktop shortcut.

### Sync (desktop → cloud)

In desktop/Electron environment:

```env
IS_DESKTOP=true
SYNC_CLOUD_URL=https://your-live-site.com
SYNC_API_KEY=shared-sync-key
```

Desktop writes enqueue to `sync_queue`; every 30s pending rows push to the cloud API.

### Backup / Restore

- **Admin → Backup**: Download JSON snapshot (web) or `.db` file (desktop)
- **Restore**: Upload `.db` in desktop admin panel

## Default Credentials (desktop SQLite)

| Role | ID | Password |
|------|-----|----------|
| Admin | `ADMIN-001` | `admin123` |

Residents and third-party accounts are created in **Admin → Generate Credentials**.

## Environment Variables

```env
# Frontend (.env)
VITE_API_URL=http://localhost:3847/api
VITE_SYNC_API_KEY=shared-sync-key

# Server (server/.env or process env)
PORT=3847
DB_MODE=sqlite          # or postgres
SQLITE_PATH=./data/margalla.db
DATABASE_URL=postgresql://...
JWT_SECRET=change-me
IS_DESKTOP=true         # Electron only
SYNC_CLOUD_URL=https://your-site.com
SYNC_API_KEY=shared-sync-key
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | React dev server |
| `npm run dev:server` | Node API (SQLite) |
| `npm run electron:dev` | Desktop app (dev) |
| `npm run electron:build` | Windows `.exe` installer |
| `npm run build` | Production web build |
| `npm test` | Unit tests |
