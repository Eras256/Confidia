# Confidia: Next.js Institutional Console Frontend

This is the Next.js dashboard frontend providing compliance visualizers, Legal Context logs, smart contract registries, and OIDC claims portal.

---

## 🛠️ Key Modules

### 1. Dashboard View Routing (`src/app/page.tsx`)
*   Manages the primary dashboard layout and coordinates active tab states.
*   Integrates Freighter connection mockups, demo controllers, ZK proof metadata details drawer, and visual vesting charts.

### 2. Localization Dictionary (`src/app/translations.ts`)
*   Supports dynamic runtime English (`en`) / Spanish (`es`) i18n toggles across all fields.

---

## 🚀 Local Run

To start the application server locally:
```bash
pnpm dev
```
The page will be served at `http://localhost:3000`.
