# AGENTS.md

Календарь звонков: бронирование тайм-слотов. Чистый Node.js без runtime-зависимостей, контракт API — TypeSpec (`typespec/main.tsp` → `typespec/generated/openapi.json`).

## Команды (mise)

- `mise run start` — запустить приложение на http://localhost:3000 (или `mise daemons start server` — фоновый dev-сервер, `mise daemons stop server` — остановить)
- `mise run test` — тесты (node --test)
- `mise run lint` — ESLint (`src/`, `test/`, `public/`)
- `mise run contract` — компиляция TypeSpec-контракта в OpenAPI
- `mise run check` — все проверки: контракт + линтер + тесты. Её же запускают CI (`.github/workflows/ci.yml`) и git-хуки hk (pre-commit — eslint, pre-push — check, commit-msg — Conventional Commits)

Версии инструментов зафиксированы в `mise.toml`, npm-пакеты (TypeSpec, eslint) — в `package.json`/`package-lock.json`.

## Правила

- Коммиты — по Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:` и т.д. (`https://www.conventionalcommits.org/ru/`).
- Обновляя REST API, меняйте контракт `typespec/main.tsp` вместе с `src/server.js` и тестами; `mise run check` должен быть зелёным.
- Хранилище — JSON-файл (`data.json`, путь через `DATA_FILE`); данные коммиту не подлежат.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (`ZhTaha/ai-for-developers-project-386`), managed via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default triage vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` at the repo root, decisions in `docs/adr/`. See `docs/agents/domain.md`.
