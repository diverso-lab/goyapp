# Goyapp

Online poster editor. Log in, pick a template, drag any element freely on a canvas, export to SVG / PNG / JPG / PDF.

## Stack

- **apps/web** — Next.js 15 (App Router), TypeScript, Tailwind, shadcn/ui, Auth.js v5, Prisma, Fabric.js v6
- **apps/pdf-worker** — Fastify + Puppeteer (PDF rendering from Fabric SVG)
- **Postgres 16** — users, templates, projects
- **MinIO** — S3-compatible storage for user-uploaded assets
- **pnpm** workspaces + **Docker Compose**

## Quick start (Docker — recommended)

```bash
cp .env.example .env
docker compose up --build
```

Then open <http://localhost:3000>. On first boot the web container runs Prisma migrate + seed automatically (3 starter templates + a demo user `demo@goyapp.local` / `demo1234`).

MinIO console: <http://localhost:9001> (user/pass from `.env`).

## Local dev (no Docker)

```bash
pnpm install
# Start just the infra
docker compose up db minio pdf-worker -d
cp .env.example .env
pnpm --filter @goyapp/web db:push
pnpm --filter @goyapp/web db:seed
pnpm dev
```

## Project layout

```
apps/
  web/         # Next.js app
  pdf-worker/  # Puppeteer microservice
docker-compose.yml
```

## Scripts

| Command            | What it does                        |
| ------------------ | ----------------------------------- |
| `pnpm dev`         | Next.js dev server                  |
| `pnpm build`       | Build all apps                      |
| `pnpm db:push`     | Push Prisma schema to Postgres      |
| `pnpm db:seed`     | Seed demo user + starter templates  |
| `pnpm docker:up`   | Bring up full stack in Docker       |
| `pnpm docker:down` | Tear down stack + volumes           |

## How export works

- **SVG / PNG / JPG** — rendered client-side directly from the Fabric canvas (`toSVG`, `toDataURL`).
- **PDF** — the web app POSTs the Fabric-exported SVG to `pdf-worker`, which renders it in headless Chromium at the canvas's native size and returns a PDF. Fonts are embedded by Chromium, so what you see is what you get.
