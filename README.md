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

## Deploy — Coolify / Contabo (datos propios, sin límites)
1. Nuevo recurso en Coolify → "Dockerfile" (este repo) o Git.
2. Env vars necesarias:
   - `ADMIN_TOKEN=<código largo>` — protege `/api/lead`, `/api/export` y `/api/stats`. **Obligatorio.**
   - `PORT=3000` (opcional, Coolify suele inyectarlo solo).
3. Dominio/subdominio (ej. `streetsmarts.tudominio` o un `.duckdns`). Coolify maneja el cert.
4. Volumen persistente en `/app/data` — si no, se pierden los leads en cada redeploy.

**No deployado todavía** — este repo queda listo (Dockerfile incluido) a la espera de OK explícito para
crear el recurso en Coolify.

## Leads → WhatsApp (fase 2, opcional)
Enganchar el `POST /api/lead` a MAIK (Evolution API) para que cada lead llegue por WhatsApp al instante.
