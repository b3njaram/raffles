# ⚜ ScoutRifas CHN

Plataforma comunitaria **Scouts Chihuahua Norte** para **rifas gratuitas** y **subastas con pujas registradas**, SIN procesar pagos. Diseño responsivo con buscador, filtros, fotos y perfiles.

> **Estado de entrega:** aplicación + esquema Supabase + lógica de acceso listas para conectar; el **modo demo** guarda datos en `localStorage` y NO es multiusuario ni tiene autenticación real. Para producción hace falta un proyecto Supabase nuevo, aplicar la migración, configurar la autenticación y verificar las políticas de organización. No confundir el modo demo con producción.

## Funcionalidades

- Registro e ingreso por correo/contraseña, confirmación por email (según configuración de Supabase).
- ID Scout requerido que comienza con `CHN` (ej. `CHN-000123`), único; cuenta pendiente de verificación manual.
- Foto de perfil y descripción editable; perfil público y publicaciones de cada miembro.
- Publicación con hasta 4 fotos (JPG/PNG/WebP, máximo 5 MB), categorías, cupos/fecha y aprobación antes de mostrarse.
- Rifas: participaciones **gratuitas** limitadas por usuario y cupos, asignación de ganador al cerrar por admin.
- Subastas: pujas informativas en MXN, sin cobro online; incremento mínimo validado de manera atómica en PostgreSQL.
- Panel admin: verificar/revocar miembros, aprobar/pausar/cancelar publicaciones, finalizar vencidas y registrar resultado.
- RLS, roles no editables por usuarios, RPCs transaccionales, límites de fotos, ninguna clave de servicio en frontend.
- Modo demo navegable cuando no hay variables Supabase, con aviso fijo de que los datos son locales.

## Instalar y probar

Requiere Node 22+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sin configurar Supabase la app ejecuta **modo demo**, y sus cambios son solo del navegador actual. Pruebas:

```bash
npm run check
```

## Conectar Supabase (NO usar la base de datos de Study Compass)

1. Crea **un proyecto Supabase nuevo** para ScoutRifas. En SQL Editor ejecuta `supabase/migrations/20261108120000_initial.sql` en ese proyecto vacío. La migración crea tablas, permisos, políticas RLS, Storage bucket y funciones RPC.
2. En Auth > Providers > Email, activa confirmación por email y establece la Site URL correcta y las Redirect URLs de tu dominio de Vercel (o `http://localhost:5173` para desarrollo). Configura SMTP de producción para entrega consistente.
3. En `.env.local` escribe `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` de ese proyecto (clave **publicable** solamente). No uses `service_role`/secret keys en cliente. `VITE_DEMO_MODE` no afecta la detección de backend: la presencia de las dos variables habilita Supabase.
4. En producción configura las mismas variables en Vercel, conecta el proyecto a la subcarpeta del repositorio, y despliega. En Vercel: Framework `Vite`, Build `npm run build`, Output `dist`.
5. Registra tu ID scout desde la UI. **Eleva al primer administrador manualmente** desde SQL Editor del nuevo proyecto: `UPDATE public.profiles SET role='admin', verified=true WHERE scout_id='CHN-000123';` (sustituye por tu ID real). Nunca pongas esta instrucción dentro del frontend. Verifica la identidad de la persona antes de elevarla.
6. Los demás usuarios deben registrarse; el admin revisa su identidad por un canal seguro y marca el ID como verificado. Solo pueden participar o publicar tras la aprobación. Los nuevos anuncios también requieren autorización.

## Seguridad y límites

- La cadena `CHN` **solo es formato**, no prueba pertenencia. La verificación es manual. No solicites fotografías de credenciales oficiales en la web sin un proceso de privacidad y autorización específico.
- Los usuarios no pueden declararse administradores, editar su verificación o escribir participaciones, pujas o ganadores directamente por REST. Las acciones importantes se hacen mediante funciones PostgreSQL autorizadas, con `FOR UPDATE` para evitar carreras de simultaneidad.
- La app no integra dinero, pasarelas, cobros, donaciones, carritos ni checkout. Los montos de puja son propuestas registradas, no contratos ni transferencias; define reglas claras antes de activarlas.
- La rifa muestra al ganador después de que el admin cierra una actividad vencida. La selección se realiza con orden aleatorio mediante `gen_random_uuid()` y guarda el resultado y el número de participaciones en `draw_audit`. Para rifas con premios significativos, conviene utilizar un procedimiento supervisado y auditable adicional.
- RLS protege registros. **Fotos de perfil y premios del bucket son públicas**; recomienda a los miembros no subir información personal sensible, fotos de menores sin permiso, documentos ni direcciones.
- La demo incluye imágenes ilustrativas enlazadas de Unsplash y perfiles simulados. No son rifas reales; retira los ejemplos si vas a usarlos con datos de producción.
- Antes de lanzar, evalúa avisos de privacidad, autorización de marca/insignias, moderación para participantes menores, bases de participación y regulaciones de rifas y sorteos aplicables. **Omitir pagos no garantiza exención legal.**
- Para escalar: añade limitación de tasa de peticiones por IP y usuario con una capa server-side, CAPTCHA en registro, registro de revisiones administrativas, monitoreo y política de retención de datos. No consideres la plataforma auditada para producción sin pruebas completas con cuentas de distintos roles.

## Organización de archivos

```
src/App.tsx                interfaz y vistas
src/backend.ts            integración Supabase / demo local
src/types.ts              modelos y validaciones de cliente
src/types.test.ts         pruebas unitarias
src/style.css             diseño responsive
supabase/migrations/...   esquema PostgreSQL, RLS, RPCs, Storage
```

## Marca

Proyecto comunitario **no oficial**, inspirado en los colores y la filosofía del escultismo. Para usar la marca o logotipo oficial de Scouts de México / ASMAC se necesita autorización. El símbolo decorativo `⚜` no debe interpretarse como aval institucional.

## Despliegue desde GitHub

Si este proyecto está bajo `scoutrifas-chn/` en un monorepo existente, selecciona esa ruta como **Root Directory** en Vercel. No hay credenciales ni datos de usuarios reales versionados.
