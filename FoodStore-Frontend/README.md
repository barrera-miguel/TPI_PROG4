# FoodStore Frontend

Aplicación React 18 + TypeScript + Vite para la gestión de pedidos de comida.

## Stack

- React 18 + TypeScript
- Vite (build tool)
- Tailwind CSS (estilos)
- TanStack Query (fetching y caché)
- Zustand (estado global: carrito, sesión, WebSocket)
- Recharts (gráficos del dashboard)
- Axios (cliente HTTP con interceptors JWT)

## Instalación

```bash
npm install
```

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Iniciar servidor de desarrollo (localhost:5173) |
| `npm run build` | Compilar para producción |
| `npm test` | Ejecutar tests (164 tests, 0 fallos) |
| `npm run test:watch` | Tests en modo watch |

## Variables de Entorno

Ver `.env.example`. Las variables con prefijo `VITE_` son opcionales en desarrollo local — los valores por defecto en el código fuente cubren `localhost`.

| Variable | Default |
|----------|---------|
| `VITE_API_URL` | `/api/v1` |
| `VITE_WS_URL` | `ws://localhost:5173/api/v1/ws` |

## Estructura

```
src/
├── api/           # Cliente HTTP (Axios)
├── components/    # Componentes reutilizables
├── hooks/         # Custom hooks (WebSocket)
├── pages/         # Páginas por feature
│   ├── admin/     # Dashboard, CRUDs
│   ├── checkout/  # Checkout y pago
│   ├── pedidos/   # Listado y detalle
│   └── direcciones/
├── services/      # Llamadas a la API
├── stores/        # 5 stores Zustand
├── types/         # Tipos TypeScript
└── __tests__/     # 164 tests (13 archivos)
```
