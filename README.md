# Chilaquiles Top Backend (Fixed)

Backend reorganizado con arquitectura tipo banking-system:

- `index.js` solo inicializa entorno y servidor.
- `configs/server.js` registra middlewares, rutas y conexión.
- `src/<modulo>` contiene controladores, rutas, servicios y modelos.
- ES Modules (`import/export`) en todo el proyecto.

## Variables de entorno

### MongoDB
- `MONGODB_URI`: se obtiene en MongoDB Atlas > Database > Connect > Drivers.

### Firebase Admin SDK
Desde Firebase Console > Project Settings > Service Accounts > Generate new private key:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

Desde Firebase Console > Project Settings > General > Your apps (Web app):
- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`

Para realtime:
- `FIREBASE_DATABASE_URL`: Firebase Console > Realtime Database > Data > URL.

## Endpoints principales

### Auth
- `POST /api/auth/client`
- `POST /api/auth/staff`
- `GET /api/auth/session`

### Staff approval (admin)
- `GET /api/users/pending-staff`
- `PATCH /api/users/staff/:userId/status`

### Orders
- `POST /api/orders`
- `GET /api/orders`
- `PATCH /api/orders/:orderId/status`
- `GET /api/orders/workflow`

### Inventory
- `GET /api/inventory`
- `POST /api/inventory`
- `POST /api/inventory/preview-consumption`

## Ejemplo de flujo completo

1. Cliente inicia sesión con OTP en Firebase.
2. Front manda token a `POST /api/auth/client`.
3. Backend crea o actualiza usuario `CLIENT` en MongoDB.
4. Front manda pedido a `POST /api/orders`.
5. Backend calcula total con lógica 1=Q50, 2=Q90, 3=Q120.
6. Backend valida stock, descuenta inventario y publica evento realtime en Firebase.
7. Chef consume `/api/orders` y cambia estados.
8. Repartidor consume `/api/orders`, recibe links Maps/Waze y completa entrega.

## Notas

- MongoDB es la persistencia principal.
- Firebase se usa para auth y eventos realtime.
- La fase futura de recetas detalladas queda preparada en `inventory.service.js`.
