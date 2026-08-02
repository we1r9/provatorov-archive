# Деплой и инфраструктура

## Продакшн

Сайт хостится через GitHub Pages, подключен собственный домен. DNS указывает на GitHub Pages, привязка настроена через `CNAME` в корне репозитория. Публикация идет через `pages-build-deployment` по каждому пушу в `main`.

Оригиналы фото раздаются через [Yandex Object Storage](https://yandex.cloud/en/services/storage) (S3-совместимое) и CDN. `thumb`-версии (для карточек) и `web`-версии (для страницы просмотра) хранятся в репозитории.

## CI

На каждый push и pull request в `main` запускается `.github/workflows/ci.yml`:

```bash
npm ci
npm audit --audit-level=high
npm run lint
```

## Зависимости

`.github/dependabot.yml` раз в неделю проверяет npm зависимости и версии GitHub Actions и сам открывает PR на апдейт. `npm audit` в CI блокирует пайплайн при уязвимости высокой критичности.

## Мониторинг

Раз в день в 12:00 по МСК запускается `.github/workflows/uptime.yml`, который делает curl на `provatorov.ru`, проверяет статус HTTP и маркер в HTML.

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

`Dockerfile` собран на базе `nginx:alpine`, файлы сайта копируются в образ без отдельного шага сборки. `docker-compose.yml` пробрасывает порт наружу через переменную `PORT` в `.env`.

## Релизы

`.github/workflows/release.yml` по пушу тега `v*` собирает Docker образ и публикует в GitHub Container Registry: `ghcr.io/we1r9/provatorov-archive`.

```bash
git tag vM.M.P
git push origin vM.M.P
```

Готовый образ можно забрать и запустить без клонирования репозитория:

```bash
docker pull ghcr.io/we1r9/provatorov-archive:latest
docker run -p 8080:80 ghcr.io/we1r9/provatorov-archive:latest
```

## Данные

`data/photos.json` хранит все данные о фото. GitHub Pages не исполняет серверный код, поэтому база данных потребовала бы отдельного бэкенда.

## Секреты

Сейчас в проекте нет секретов. Домен и S3/CDN настроены вне репозитория. Если появятся токены, они пойдут в GitHub Actions secrets.
