# Realtime Collaborative Kanban Board

A full-stack, multi-user Kanban board where task moves and live cursor positions
sync across all connected clients in real time (<200ms), plus a stats dashboard
built with Recharts.

## Architecture

```
┌─────────────────┐        REST (JWT)        ┌──────────────────┐
│   Next.js App    │ ───────────────────────► │   Express API     │
│  (React, App     │                          │  (auth, boards,   │
│   Router)         │ ◄─────────────────────── │   tasks CRUD)     │
└───────┬──────────┘        JSON               └─────────┬────────┘
        │                                                  │
        │        WebSocket (Socket.io)                     │ Prisma ORM
        ▼                                                  ▼
┌──────────────────┐                              ┌──────────────────┐
│  Socket.io server │ ◄───────────────────────────│   PostgreSQL      │
│  (same Node proc) │      reads/writes via API    │   (boards, tasks, │
└──────────────────┘                              │    users)         │
                                                    └──────────────────┘
```

- **Frontend**: Next.js 14 (App Router), drag-and-drop Kanban UI, Recharts for
  a live task-distribution chart, a `socket.io-client` connection per board
  room that broadcasts/receives cursor positions and task-move events.
- **Backend**: Express REST API for auth + CRUD, Socket.io for real-time
  events, Prisma ORM against PostgreSQL.
- **Auth**: Hand-rolled JWT access token (15 min) + refresh token (7 days,
  stored hashed in DB, rotated on use) — deliberately not using an
  auth-as-a-service library so every part of the flow can be explained.
- **Realtime protocol**: clients `join` a `board:<id>` room. `task:move` and
  `cursor:move` events are broadcast to everyone else in the room only
  (not a global broadcast) to keep payload size and latency down.
- **Infra**: Dockerfiles for both services, `docker-compose.yml` wiring
  frontend + backend + Postgres for one-command local dev, and a GitHub
  Actions workflow that lints, type-checks, and builds both apps on push.

## Running locally

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:4000
- Postgres: localhost:5432

First run needs a migration:
```bash
docker compose exec backend npx prisma migrate deploy
```

## Interview talking points (what to be ready to explain)

1. **Why Socket.io over raw WebSocket** — automatic reconnection, room
   abstraction for per-board broadcast, and fallback transport, at the cost
   of a slightly heavier payload than raw `ws`.
2. **Latency**: cursor events are throttled client-side (every ~50ms) before
   emit, so we don't flood the socket on every `mousemove` — this is the
   difference between "syncs in <200ms" and "syncs but drowns the network."
3. **JWT rotation**: refresh tokens are single-use — each refresh issues a
   new refresh token and invalidates the old one (rotation), so a stolen
   refresh token has a short window of usefulness. Access tokens are never
   stored, only kept in memory on the client.
4. **Optimistic UI**: when a user drags a card, the frontend updates local
   state immediately and emits the change; if the API call fails, it rolls
   back. Be ready to show this code path and explain the tradeoff.
5. **DB schema**: `User` → `Board` (owner) → `Column` → `Task`, with a
   `BoardMember` join table for multi-user access control (viewer/editor
   roles) — this is the authorization layer, checked on every mutating route.
6. **Scaling note**: Socket.io on a single Node process works for a demo;
   in production you'd add the Redis adapter (`@socket.io/redis-adapter`) so
   broadcasts work across multiple server instances. Mention this even
   though it's not implemented — shows you know the limitation.
