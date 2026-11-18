# Отчет о деплое — Калибр бронирования приложения

## Фаза Complete: Docker & Deployment ✅

### Что было сделано

| Задача | Статус |
|--------|--------|
| **Dockerfile creation** | ✅ Создан в корне репозитория |
| **MCP Render server configuration** | ✅ Подключен через opencode.jsonc |
| **Deployment configuration** | ✅ PORT=3000 переменная окружения |
| **README.md update** | ✅ Комплексные документации о Docker, деплое и сохранности данных |
| **Документация сохранности данных** | ✅ Объяснена в README |
| **Git history cleanup** | ✅ Без секретов |
| **Все проверки проходят** | ✅ TypeSpec + Lint + Tests |

### Обзор Dockerfile

Dockerfile использует многоступенчатую сборку для оптимизации размера образа:

- **Builder этап**: Устанавливает зависимости, компилирует TypeSpec в OpenAPI
- **Runtime этап**: Минимальный Node.js Alpine образ с только необходимыми файлами
- **Точка входа**: `CMD ["node", "src/server.js"]` автоматически запускает приложение
- **Открытый порт**: `$PORT` (по умолчанию 3000)
- **Не-root пользователь**: `appuser` для безопасности

### Конфигурационные файлы

| Файл | Цель |
|------|------|
| `Dockerfile` | Мультиступенчатый build для контейнеризации |
| `opencode.jsonc` | MCP Render server конфигурация |
| `README.md` | Полная документация и инструкция по использованию |
| `package.json` | Скрипты: start, test, lint, contract, generate, check |

### Переменные окружения

| Переменная | Значение по умолчанию | Описание |
|------------|----------------------|----------|
| `PORT` | `3000` | Порт, на котором слушает сервер |
| `SLOT_MINUTES` | `15` | Шаг сетки для бронирования слотов |
| `DATA_FILE` | `./data.json` | Путь к файлу с данными |

### Платформы для деплоя

#### Render (Primary)
- Free tier доступен
- Автоматический Deploy из Docker-Image
- Присваивает публичную URL
- Уходит в сон после 15 min без запросов
- Достаточно для сдачи проекта

#### Railway (Fallback)
- То же Docker-Image совместимо
- Аналогичный Deploy-Prozess über MCP
- Публичная URL vergeben

### Важное замечание о сохранности данных

**Важно: Данные сбрасываются после перезапуска контейнера.**

Хранилище данных основано на JSON-файле `data.json` (путь задаётся переменной `DATA_FILE`). При перезапуске контейнера данныеinitializaeтся из-заданных в коде дефолтных значений:

- Тип встречи по умолчанию: `'intro-call'` (Знакомство, 30 мин)
- Рабочие часы по умолчанию: `weekdays [1,2,3,4,5]`, `startTime '09:00'`, `endTime '18:00'`, `timeZone 'Asia/Almaty'`
- Бронирования инициализируются пустым списком

Для сохранения данных между перезапусками необходимо примонтировать том или использовать внешнюю базу данных:

```bash
docker run -d -p 3000:3000 -v $(pwd)/data.json:/app/data.json calendar-app
```

Или через docker-compose:

```yaml
services:
  calendar:
    image: calendar-app
    volumes:
      - ./data.json:/app/data.json
    environment:
      - PORT=3000
```

Это помнит настройки owner (типы встреч, рабочие часы, часовой пояс) и сохраняет списки броней. Однако сами ссылки на бронирования гостевского режима не сохраняются долгосрочно из-за природы бесплатного тарифа Render (сервис засыпает и перезапускается).

### Настройка MCP для Render

MCP (Model Context Protocol) сервер для Render позволяет агенту automatisieren Deploy:

1. В репозитории есть проектная конфигурация MCP или безопасный шаблон с инструкцией подключения
2. API-ключ можно получать aus der Variable `RENDER_API_KEY`
3. Dateien mit echten Schlüsseln werden aus Git ausgeschlossen, Vorlage bleibt im Repository
4. Zugang über OAuth wird in den Einstellungen des Agents beschrieben, Sitzungsdaten werden nicht in Git hinzugefügt

### Prozess des Deployments

1. Agent verbindet sich mit MCP-сервер Render
2. Agent erstellt Webservice, deployt Docker-Image
3. Anwendung startet nach Port aus Variable `PORT` (Standard 3000)
4. Render gibt öffentliche URL für den Service
5. Agent prüft, dass die Anwendung antwortet

### Kostenloser Tarif

- Freier Dienst schläft nach 15 Minuten ohne Anfragen
- Erstmaliger Anfrage nach Pause langsamer (Cold Start)
- Genug für Projekt-Abgabe

### Deploy auf Railway (Backup-Option)

Wenn Render nicht verfügbar ist, kann Railway verwendet werden mit demselben Docker-Image:

1. Gleiches `PORT` Konfiguration
2. Analogischer Deploy-Prozess über MCP
3. Öffentliche URL für funktionierenden Service

### GitHub Actions (CI)

Automatische Prüfungen bei jedem Commit:

- `mise run check` — alle Prüfungen: Vertrag + Lint + Tests
- Durchführung über `.github/workflows/hexlet-check.yml` — nicht löschen und nicht umbenennen

### API-Vertrag

API beschrieben in TypeSpec (`typespec/main.tsp`) und kompiliert in OpenAPI Spezifikation (`typespec/generated/openapi.json`). Generierung client SDK erfolgt Kommando `mise run generate`.

### Лицензия

MIT

---

### Важное примечание о сохранности данных

**Данные сбрасываются после перезапуска контейнера.**

Хранилище данных основано на JSON-файле `data.json` (путь задаётся переменной `DATA_FILE`). При перезапуске контейнера данныеinitializaeтся из-заданных в коде дефолтных значений:

- Тип встречи по умолчанию: `'intro-call'` (30 мин)
- Рабочие часы по умолчанию: `weekdays [1,2,3,4,5]`, `startTime '09:00'`, `endTime '18:00'`, `timeZone 'Asia/Almaty'`
- Бронирования инициализируются пустым списком

Для сохранения данных между перезапусками необходимо примонтировать том или использовать внешнюю базу данных:

```bash
docker run -d -p 3000:3000 -v $(pwd)/data.json:/app/data.json calendar-app
```

Или через docker-compose:

```yaml
services:
  calendar:
    image: calendar-app
    volumes:
      - ./data.json:/app/data.json
    environment:
      - PORT=3000
```

Это помнит настройки owner (типы встреч, рабочие часы, часовой пояс) и сохраняет списки броней. Однако сами ссылки на бронирования гостевского режима не сохраняются долгосрочно из-за природы бесплатного тарифа Render (сервис засыпает и перезапускается).

### Разработка с агентами

Проект предназначен для работы с ИИ-агентами. Спецификация и тикеты находятся в файлах `SPEC_AND_TICKETS.md` и `DECISIONS_MAP.md`. Агенты должны следовать правилам из `AGENTS.md`, включая:

- Коммиты по Conventional Commits
- Ссылки на тикеты в коммитах
- Использование TypeSpec контракта
- Тестирование через всю стек (контракт → SDK → сервер → интерфейс → тесты)

## Разработung

```bash
# Установка зависимостей
mise install
npm install

# Запуск
mise run start

# Проверки
mise run test       # Unit + integration tests
mise run lint       # ESLint
mise run contract   # TypeSpec → OpenAPI
mise run generate   # Full generation chain
mise run check      # All checks
```