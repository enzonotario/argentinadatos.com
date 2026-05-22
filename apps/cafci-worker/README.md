# CAFCI worker

Proceso pensado para correr de forma permanente en un VPS y mantener una SQLite con el detalle de fondos CAFCI.

La ruta por defecto es `storage/cafci-worker/db.sqlite`. El flujo esperado es:

1. `cafci-worker` trabaja localmente con SQLite en el VPS.
2. Coolify persiste ese archivo en disco.
3. `cafci-worker` sube periódicamente la SQLite a R2 como backup.
4. GitHub Actions descarga esa SQLite desde R2 y, con ella, genera los JSON estáticos.
5. El backfill histórico se construye aparte, en local, a partir de `datos/v1/finanzas/fci/*`, y se publica como una SQLite seed en R2.
6. En producción, si la SQLite del worker todavía no tiene histórico, importa ese seed desde R2 una sola vez y después sigue operando normalmente.

## Scripts

- `pnpm crawl`: ejecuta un ciclo
- `pnpm start`: corre en loop, reintentando según el intervalo configurado
- `pnpm r2:backup`: sube manualmente la SQLite actual a R2
- `pnpm r2:download`: descarga la SQLite desde R2 al path local configurado
- `pnpm backfill:build`: genera localmente una SQLite seed solo con el histórico derivado de los JSON legacy
- `pnpm backfill:publish`: genera esa SQLite seed y la sube a R2

## Histórico

El worker guarda una evolución diaria por fondo/clase en SQLite:

- backfill seed construido localmente desde los históricos legacy del repo
- snapshots nuevos desde los detalles actuales de CAFCI
- retornos derivados desde `VCP`
- `AUM`/patrimonio cuando haya evidencia suficiente
- flujo neto estimado solo cuando se puede calcular sin inventar datos

Ese histórico luego se replica a la SQLite productiva del worker si todavía está vacía.

## Variables de entorno

- `CAFCI_WORKER_DB_PATH`: ruta de la SQLite local
- `CAFCI_WORKER_BACKFILL_SEED_DB_PATH`: ruta local de la SQLite temporal usada para construir/publicar el seed histórico
- `CAFCI_WORKER_CONCURRENCY`: cantidad de requests concurrentes por ciclo
- `CAFCI_WORKER_MAX_ATTEMPTS`: reintentos máximos por job
- `CAFCI_WORKER_POLL_INTERVAL_MS`: espera entre ciclos en modo daemon
- `CAFCI_WORKER_R2_ACCOUNT_ID`: account id de Cloudflare
- `CAFCI_WORKER_R2_ACCESS_KEY_ID`: access key de R2
- `CAFCI_WORKER_R2_SECRET_ACCESS_KEY`: secret key de R2
- `CAFCI_WORKER_R2_BUCKET`: bucket donde se guarda el backup
- `CAFCI_WORKER_R2_OBJECT_KEY`: key del objeto, por defecto `cafci-worker/db.sqlite`
- `CAFCI_WORKER_R2_BACKFILL_OBJECT_KEY`: key del objeto seed histórico, por defecto `cafci-worker/backfill-seed.sqlite`

## Runtime recomendado

- `Node.js 22`, alineado con los workflows actuales

## Docker / Coolify

El worker está pensado para desplegarse en Coolify usando el `Dockerfile` de esta app.

- **Build context**: raíz del repositorio
- **Dockerfile**: `apps/cafci-worker/Dockerfile`
- **Comando**: usa el `CMD` por defecto (`pnpm start`)
- **Volumen persistente recomendado**: montar `/data`
- **Variable clave**: `CAFCI_WORKER_DB_PATH=/data/db.sqlite`

Variables sugeridas para Coolify:

```env
CAFCI_WORKER_DB_PATH=/data/db.sqlite
CAFCI_WORKER_BACKFILL_SEED_DB_PATH=storage/cafci-worker/backfill-seed.sqlite
CAFCI_WORKER_CONCURRENCY=8
CAFCI_WORKER_MAX_ATTEMPTS=20
CAFCI_WORKER_POLL_INTERVAL_MS=1800000
CAFCI_WORKER_R2_ACCOUNT_ID=
CAFCI_WORKER_R2_ACCESS_KEY_ID=
CAFCI_WORKER_R2_SECRET_ACCESS_KEY=
CAFCI_WORKER_R2_BUCKET=
CAFCI_WORKER_R2_OBJECT_KEY=cafci-worker/db.sqlite
CAFCI_WORKER_R2_BACKFILL_OBJECT_KEY=cafci-worker/backfill-seed.sqlite
```
