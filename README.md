# sensus

Una biblioteca personal de palabras para guardar consultas, descubrir sus matices y volver a ellas después.

## Features

- Onboarding con un `@nickname` único como identificador de la biblioteca.
- Código de recuperación para volver a acceder al perfil.
- Home editorial con modos claro, oscuro y sistema.
- Textura de papel y tipografía serif estilo libro de ciencia ficción.
- Guardado local primero: las palabras se conservan aunque no haya conexión.
- Cola automática y reintento manual cuando vuelve internet.
- Hasta 3 definiciones concisas por palabra, siempre con ejemplo de uso.
- Procesamiento asíncrono con OpenAI `gpt-4o-mini`.
- Biblioteca ordenada por fecha, estados de procesamiento y eliminación.
- Búsqueda textual en palabras, categorías, definiciones y ejemplos.
- Sin autenticación tradicional: access key y código de recuperación asociados al nickname.

## Stack

- Expo SDK 57 + Expo Router
- Expo Web para el cliente desplegado
- NativeWind/Tailwind para la base de estilos
- Convex para base de datos, queries y mutaciones
- Convex Workpool para jobs en segundo plano
- OpenAI `gpt-4o-mini`
- `localStorage` en web; SQLite + SecureStore en iOS

## Requisitos

- Node.js 20+
- npm
- Una cuenta de Convex para un deployment hospedado
- Una API key de OpenAI
- Vercel CLI solo si se quiere desplegar desde terminal

## Instalación local

```bash
npm install
cp .env.example .env.local
```

Configura en `.env.local`:

```bash
EXPO_PUBLIC_CONVEX_URL=https://TU_DEPLOYMENT.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://TU_DEPLOYMENT.convex.site
```

La variable `OPENAI_API_KEY` debe vivir únicamente como variable de entorno del deployment de Convex; nunca en `.env.local` versionado ni en el cliente.

Arranca el backend y el cliente en terminales separadas:

```bash
npx convex dev
npm run web
```

Para generar el sitio estático:

```bash
npm run export:web
```

## Deployment de Convex

```bash
npx convex login
npx convex deploy
npx convex env set OPENAI_API_KEY "tu-api-key"
```

Usa la URL `*.convex.cloud` resultante como `EXPO_PUBLIC_CONVEX_URL`.

## Deployment en Vercel

El proyecto usa `vercel.json` para ejecutar `npm run vercel-build` y publicar `dist/`.

En Vercel configura estas variables para Production, Preview y Development:

```text
EXPO_PUBLIC_CONVEX_URL=https://TU_DEPLOYMENT.convex.cloud
EXPO_PUBLIC_CONVEX_SITE_URL=https://TU_DEPLOYMENT.convex.site
```

Después de guardar las variables, crea un nuevo deployment. Vercel instalará las dependencias con `npm ci`, ejecutará el export web y servirá el resultado estático.

## Checks

```bash
npm run typecheck
npm run check
npx expo-doctor
npm run export:web
```

## Arquitectura resumida

El cliente guarda inmediatamente una entrada local con estado `offline-pending`, `syncing` o `processing`. Convex crea el registro y encola el procesamiento en Workpool; la acción de OpenAI normaliza el resultado y un callback actualiza el estado final. La biblioteca se reconcilia periódicamente y al recuperar conexión.

## Nota de seguridad

Este proyecto es personal y no usa Auth de Convex. El access key funciona como bearer credential y se guarda localmente; no debe exponerse en logs ni reutilizarse para una aplicación pública multiusuario sin añadir sesiones, rate limiting y una revisión de seguridad.
