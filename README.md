# FORTENOW · API

API de inscripciones a **FORTENOW**, un clasificatorio de CrossFit (ficticio). Los atletas
solicitan plaza en un turno y el organizador acepta o rechaza cada solicitud sin pasarse del aforo.

- **Frontend:** [client-proyecto-final](https://github.com/MarioRivVal/client-proyecto-final)
- **Web desplegada:** <https://fortenow.netneo.es>
- **API desplegada:** <https://fortenow.netneo.es/api/v1/health>

## El problema que resuelve

El evento tiene turnos de 45 minutos con **6 plazas** cada uno. Los atletas quieren saber si queda
sitio y en qué punto está su solicitud; el organizador necesita decidir quién entra en cada turno
sin superar el aforo, aunque haya dos personas decidiendo a la vez.

## Tecnologías

| | |
|---|---|
| Servidor | **NestJS 11** (Node.js 22, TypeScript) |
| Base de datos | **PostgreSQL 16** con **TypeORM** (entidades + migraciones) |
| Login | **Passport + JWT** guardado en una cookie `httpOnly` |
| Validación y seguridad | class-validator, helmet, límite de peticiones (`@nestjs/throttler`) |
| Tests | Jest |

> **Adaptación del enunciado** (acordada con el profesor): PostgreSQL en lugar de MongoDB. Por eso
> los "modelos" son entidades de TypeORM y las tablas se crean con una migración antes del seed.

## Arrancar en local

Hace falta **Node.js 22** y **Docker**.

```bash
npm install
cp .env.example .env      # rellenar JWT_SECRET (el propio archivo dice cómo generarlo)
docker compose up -d db   # PostgreSQL en el puerto 5452
npm run migration:run     # crea las tablas
npm run seed              # carga los datos desde los CSV
npm run start:dev         # API en http://localhost:3200/api/v1
```

Para comprobar que funciona: <http://localhost:3200/api/v1/health>.

## Usuarios de prueba

| Rol | Email | Contraseña |
|---|---|---|
| Organizador | `organizacion@example.com` | `organiza2027` |
| Atleta | `marta.gil@example.com` | `atleta2027` |

Todos los atletas del seed tienen la contraseña `atleta2027`.

## Datos iniciales (seed)

Los datos salen de un Excel, [`data/seed.xlsx`](data/seed.xlsx), con una hoja por tabla, exportada a
CSV en [`data/`](data/). Son **428 registros** de cuatro ediciones (2024–2027):

| CSV | Filas | Qué es |
|---|---|---|
| `users.csv` | 121 | 1 organizador y 120 atletas |
| `events.csv` | 4 | Ediciones del evento |
| `slots.csv` | 35 | Turnos de cada edición |
| `registrations.csv` | 268 | Solicitudes con su estado |

`npm run seed` ([`scripts/seed.ts`](scripts/seed.ts)) lee los CSV con el módulo **`fs`**
([`scripts/read-csv.ts`](scripts/read-csv.ts)), **comprueba todas las filas antes de tocar la base**
(si algo falla, dice el archivo y el número de fila) y después vacía las tablas y las rellena.

## Modelo de datos

```
events 1───N slots 1───N registrations N───1 users
```

- **users**: atletas y organizador (`role`: `ATHLETE` o `ADMIN`).
- **events**: cada edición, con su fecha, lugar y plazo de solicitudes.
- **slots**: los turnos de una edición y su aforo.
- **registrations**: la solicitud de un atleta a un turno. Estado `PENDING`, `ACCEPTED`,
  `REJECTED` o `WITHDRAWN`.

Las reglas importantes también están en la base ([migración](src/migrations/)): un atleta solo
puede tener **una solicitud activa por edición** (índice único) y los estados y tallas válidos se
comprueban con `CHECK`.

## Estructura

Cada módulo sigue el esquema de Nest: **module → controller → service → entity**.

```
src/
├── auth/            login, logout y usuario de la sesión (JWT en cookie)
├── users/           entidad de usuario
├── events/          ediciones y turnos, plazas libres
├── registrations/   solicitudes: rutas del atleta y del organizador
├── common/          guard de roles, decoradores @Roles y @CurrentUser, filtro de errores
├── config/          validación de las variables de entorno al arrancar
├── health/          comprobación para el despliegue
└── migrations/      creación de las tablas
scripts/             seed desde los CSV
data/                Excel y CSV
```

## Endpoints

Todas las rutas empiezan por `/api/v1`.

| Ruta | Acceso | Qué hace |
|---|---|---|
| `GET /health` | público | Estado de la API |
| `POST /auth/login` · `POST /auth/logout` · `GET /auth/me` | público / sesión | Entrar, salir y usuario actual |
| `GET /events/current` | público | Edición actual con sus turnos y plazas libres |
| `GET /me/registrations` | atleta | Sus solicitudes |
| `POST /me/registrations` | atleta | Solicitar un turno `{ slotId }` |
| `POST /me/registrations/:id/withdraw` | atleta | Retirar una solicitud pendiente |
| `GET /admin/events` | organizador | Ediciones |
| `GET /admin/events/:slug/registrations` | organizador | Solicitudes de una edición, por turno |
| `POST /admin/registrations/:id/accept` | organizador | Aceptar |
| `POST /admin/registrations/:id/reject` | organizador | Rechazar `{ reason? }` |
| `GET /admin/events/:slug/registrations.csv` | organizador | CSV de aceptados |

Los errores siempre tienen la forma `{ statusCode, code }` (por ejemplo `SLOT_FULL`), y la web los
traduce a un mensaje.

## Login y roles

1. `POST /auth/login` comprueba la contraseña (bcrypt) y guarda un JWT de 8 horas en la cookie
   `session` (`httpOnly`: el JavaScript del navegador no puede leerla).
2. Las rutas protegidas usan `JwtAuthGuard` (hay sesión) y `RolesGuard` con `@Roles('ADMIN')` o
   `@Roles('ATHLETE')` (tiene el rol).

## Reglas de negocio

- Solo ocupan plaza las solicitudes **aceptadas**.
- Solo se puede solicitar dentro del plazo de la edición actual; las anteriores son de consulta.
- **Aceptar bloquea el turno** mientras dura la operación (`pessimistic_write`, en
  [`registrations.service.ts`](src/registrations/registrations.service.ts)): si dos organizadores
  aceptan a la vez el último hueco, el segundo recibe "turno completo".

## Tests

```bash
npm test                    # guard de roles
docker compose up -d db-test
npm run test:integration    # 10 aceptaciones a la vez sobre 1 plaza → solo entra una
```

El test de integración usa una PostgreSQL real (puerto 5453) para probar el bloqueo de verdad.

## Despliegue

`Dockerfile` en dos etapas. Al arrancar, el contenedor aplica las migraciones pendientes y levanta
la API en el puerto 3200. Las variables necesarias están en [`.env.example`](.env.example).
