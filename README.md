# Street Smarts Funnel — captura de leads del podcast/serie de YouTube

Landing + captura de leads (nombre / email o WhatsApp + preguntas de atribución/nutrición) para reemplazar
al Telegram `t.me/clubdelbot` (acceso perdido). Copiado y adaptado desde `~/projects/ia-mapa-funnel/`
(Node puro, cero dependencias, JSONL + dedup + export CSV) — ese repo NO fue modificado.

## Qué hace
- Sirve la landing (`public/index.html`) en `/` y la página post-envío (`public/gracias.html`) en `/gracias`.
- `POST /api/lead` → guarda en `data/leads.jsonl` (dedup por email/WhatsApp normalizado). Campos: nombre,
  contacto, dónde escucha, cómo llegó, qué opera, hace cuánto opera, qué le está costando (texto libre),
  `src` (de `?src=` en la URL), `referrer`, `user_agent`, `ip`, `ts`.
- `POST /api/view` → guarda en `data/views.jsonl` un page-view (src + referrer), disparado al cargar la
  landing. Es la base para medir conversión (views → leads) por `src`.
- `GET /api/count` → total de leads capturados (prueba social real, opcional).
- `GET /api/lead?token=ADMIN_TOKEN` → JSON de todos los leads.
- `GET /api/export?token=ADMIN_TOKEN` → descarga CSV de leads.
- `GET /api/stats?token=ADMIN_TOKEN` → agregados: total views/leads, conversión global, conversión por
  `src` (para comparar qué episodio/link convierte más), y distribución de respuestas por cada pregunta.

## Tracking de atribución
Cada link de episodio lleva su propio `?src=`, ej. `https://tu-dominio/?src=ep08`. La landing lee ese
parámetro client-side, lo manda en `/api/view` al cargar y en `/api/lead` si el visitante se anota.
`GET /api/stats` cruza views vs leads por `src` → conversión real por episodio/canal.

## Correr local
```bash
PORT=3010 ADMIN_TOKEN=test node server.mjs
# landing:  http://localhost:3010
# gracias:  http://localhost:3010/gracias
# stats:    http://localhost:3010/api/stats?token=test
# export:   http://localhost:3010/api/export?token=test
```

## Deploy — Netlify (LIVE)
**URL de producción: https://street-smarts-funnel.netlify.app**

El nginx del host del VPS de Coolify intercepta el puerto 80 de TODAS las apps
(`*.161.97.158.105.sslip.io` devuelve "Welcome to nginx"), así que el deploy se movió a Netlify:

- `public/` → sitio estático (landing + `/gracias`).
- `netlify/functions/` → Netlify Functions v2 (`lead.js`, `view.js`, `count.js`, `stats.js`, `export.js`),
  cada una con `export const config = { path: '/api/...' }` para exponer la misma ruta que el server
  Node original.
- Persistencia: **Netlify Blobs** (`@netlify/blobs`, `netlify/functions/_lib/blobs.js`), un blob por
  lead keyeado por contacto normalizado (dedup nativo) y un blob por view (UUID). `consistency: 'strong'`
  forzado — el modo eventual (default) rompía el dedup get-then-set en submits rápidos consecutivos.
- `ADMIN_TOKEN` vive como env var en Netlify (contexts production/deploy-preview/branch-deploy), NUNCA
  en el repo. Valor real en Keychain: `security find-generic-password -s street-smarts-funnel-netlify -a maicol -w`.
- Deploy: `netlify deploy --prod` (requiere `NETLIFY_AUTH_TOKEN` en `~/.env`, sitio ya linkeado vía
  `.netlify/state.json`, gitignored).

`server.mjs` + `Dockerfile` quedan en el repo solo como referencia de desarrollo local (`PORT=3010
ADMIN_TOKEN=test node server.mjs`) — no se usan en producción.

## Leads → WhatsApp (fase 2, opcional)
Enganchar el `POST /api/lead` a MAIK (Evolution API) para que cada lead llegue por WhatsApp al instante.
