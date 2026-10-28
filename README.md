# Road Sense

Local-first road incident intelligence platform. AI extracts structured suggestions from free-text reports; deterministic backend rules own priority, state transitions, permissions, and data integrity.

- Evaluation details: [`evaluation/README.md`](evaluation/README.md)

## Features

- AI-assisted triage with runtime schema validation, retries, timeouts, and audit metadata.
- Human confirmation or rejection of every suggestion.
- Deterministic priority from incident type and persisted risk factors.
- Validated lifecycle transitions with terminal `RESOLVED` and `CANCELLED` states.
- Full incident history with actor, timestamp, and change metadata.
- Knowledge articles with PostgreSQL full-text search.
- Explainable duplicate-candidate detection with human decisions.
- JWT authentication, role-based access, and a local Next.js operations UI.
- Offline mock evaluation plus a separate opt-in real-model evaluation.

## Stack

| Area       | Technology                              |
| ---------- | --------------------------------------- |
| Backend    | Node.js, TypeScript, NestJS, Prisma     |
| Database   | PostgreSQL 16 via Docker Compose        |
| Validation | `class-validator` / `class-transformer` |
| API docs   | Swagger/OpenAPI                         |
| Tests      | Jest, Supertest, Playwright             |
| Frontend   | Next.js 16, React 19, TypeScript        |
| Quality    | ESLint, Prettier, GitHub Actions        |

## Quick start

Requirements: Node.js 20+ (22 recommended), npm, Docker with Compose, and Chromium for Playwright (`npx playwright install chromium` inside `frontend/`).

```bash
cp .env.example .env
# Set a strong JWT_SECRET, for example: openssl rand -hex 32

docker compose up -d db        # use docker-compose with Compose v1
npm install
npm --prefix frontend install

npm run prisma:generate
npm run prisma:deploy

# The seed requires fictional local passwords.
export SEED_ADMIN_PASSWORD="$(openssl rand -base64 24)"
export SEED_OPERATOR_PASSWORD="$(openssl rand -base64 24)"
export SEED_VIEWER_PASSWORD="$(openssl rand -base64 24)"
npm run prisma:seed
```

Start the API and frontend in separate terminals:

```bash
npm run dev
npm run dev:frontend
```

- API: `http://localhost:3000/api/v1`
- Swagger: `http://localhost:3000/docs`
- Frontend: `http://localhost:3001`
- PostgreSQL: `localhost:5433`

The frontend proxies `/api/*` to the backend. Override the backend origin with `ROADSENSE_API_URL`.

## Configuration

Copy `.env.example` and adjust as needed. Main variables:

| Variable               | Purpose                                   | Default            |
| ---------------------- | ----------------------------------------- | ------------------ |
| `APP_PORT`             | API port                                  | `3000`             |
| `DATABASE_URL`         | Prisma connection string                  | see `.env.example` |
| `JWT_SECRET`           | JWT signing secret, minimum 32 characters | required           |
| `JWT_EXPIRES_IN`       | Access-token lifetime                     | `1h`               |
| `RATE_LIMIT_MAX`       | Requests per client per window            | `300`              |
| `RATE_LIMIT_WINDOW_MS` | Rate-limit window                         | `60000`            |
| `LLM_PROVIDER`         | `mock` or `openai`                        | `mock`             |
| `LLM_TIMEOUT_MS`       | Timeout per provider attempt              | `10000`            |
| `LLM_MAX_RETRIES`      | Retries after the first attempt           | `2`                |
| `OPENAI_API_KEY`       | Real-provider key                         | —                  |
| `OPENAI_MODEL`         | Real-provider model                       | `gpt-4o-mini`      |
| `OPENAI_BASE_URL`      | OpenAI-compatible base URL                | OpenAI             |

Real providers are opt-in. The adapter uses `POST /chat/completions` with JSON mode, so any compatible endpoint can be used through `OPENAI_BASE_URL`. Model output is always treated as untrusted and validated before use.

## API overview

All routes use the `/api/v1` prefix.

| Area       | Routes                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------- |
| Health     | `GET /health`, `GET /health/ready`                                                       |
| Auth       | `POST /auth/login`, `POST /auth/register`                                                |
| Incidents  | `GET/POST /incidents`, `GET/PATCH /incidents/:id`, `GET /incidents/:id/events`           |
| Lifecycle  | `GET /incidents/:id/available-transitions`, `POST /incidents/:id/transitions`            |
| Triage     | `POST /triage`, `GET /triage/:id`, `GET /incidents/:id/triage`                           |
| Review     | `POST /incidents/:id/triage/:triageId/confirm`, `.../reject`                             |
| Knowledge  | `POST/GET /knowledge/articles`, `GET /knowledge/search?q=...`                            |
| Duplicates | `GET /incidents/:id/duplicate-candidates`, `POST .../:duplicateId/confirm`, `.../reject` |

Request bodies and model output are validated at runtime. Unexpected errors and oversized payloads are sanitized. Body size is limited to 100 KB and rate limiting is enforced in memory.

## Roles

| Operation                                                                        | ADMIN | OPERATOR | VIEWER |
| -------------------------------------------------------------------------------- | :---: | :------: | :----: |
| Login, health, readiness                                                         |  Yes  |   Yes    |  Yes   |
| Register users                                                                   |  Yes  |    No    |   No   |
| Create/edit incidents, transition status, run triage, confirm/reject suggestions |  Yes  |   Yes    |   No   |
| Confirm/reject duplicates, create articles                                       |  Yes  |   Yes    |   No   |
| Read incidents, history, triage, transitions, and knowledge                      |  Yes  |   Yes    |  Yes   |

Passwords are stored as bcrypt hashes. The backend validates the JWT and reloads the user on every request.

## Tests and quality

```bash
npm test                    # unit tests, no database or API key
npm run test:e2e:api        # isolated roadsense_e2e schema
npm run test:e2e:frontend   # Playwright, backend + frontend on ports 3210/3211
npm run test:evaluation     # evaluation runner tests
npm run eval:mock           # deterministic offline evaluation
npm run eval:real -- --allow-real  # opt-in, requires OPENAI_API_KEY

npm run format:check
npm run lint
npm run typecheck
npm run build
npm run lint:frontend
npm run typecheck:frontend
npm run build:frontend
```

Mock evaluation writes reports to `evaluation/reports/`. Real evaluation requires network access, an API key, and explicit `--allow-real`; the evaluator reads environment variables directly, so export them first or prefix the command. CI runs formatting, lint, type checks, builds, unit tests, mock evaluation, API E2E, and Playwright without a real API key.

## Project layout

```text
src/            NestJS modules: incidents, triage, AI, knowledge, auth, evaluation
prisma/         Schema, migrations, and deterministic seed
test/           Supertest API E2E tests
scripts/        Evaluation and isolated E2E runners
evaluation/     Dataset documentation and generated reports
frontend/       Next.js operations UI and Playwright tests
docs/           Project contract
```

