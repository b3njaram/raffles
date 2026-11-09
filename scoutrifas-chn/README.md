# ⚜ ScoutRifas CHN

Plataforma comunitaria **Scouts Chihuahua Norte** para **rifas gratuitas** y **subastas con pujas registradas**, SIN procesar pagos. Diseño responsivo con buscador, filtros, fotos y perfiles.

> **Estado:** desplegado en https://scoutrifas-chn.vercel.app con Supabase compartido y tablas CHN aisladas. Los registros, pujas y publicaciones se almacenan en PostgreSQL. Para operar, hay que verificar miembros y promover manualmente la primera cuenta administradora. El modo demo solo está disponible en desarrollo si se activa expresamente.

## Funcionalidades

- Registro e ingreso por correo/contraseña, confirmación por email (según configuración de Supabase).
- ID Scout requerido que comienza con `CHN` (ej. `CHN-000123`), único; cuenta pendiente de verificación manual.
- Foto de perfil y descripción editable; perfil visible a otros miembros autorizados y publicaciones de cada miembro.
- Publicación con hasta 4 fotos (JPG/PNG/WebP, máximo 5 MB), categorías, cupos/fecha y aprobación antes de mostrarse.
- Rifas: participaciones **gratuitas** limitadas por usuario y cupos, asignación de ganador al cerrar por admin.
- Subastas: pujas informativas en MXN, sin cobro online; incremento mínimo validado de manera atómica en PostgreSQL.
- Panel admin: métricas, progreso por publicación, registro de pujas (hasta los últimos 1,000 en interfaz), lista de participantes, exportación CSV, verificación de miembros, aprobación/pausa/cancelación de publicaciones y cierre de sorteos.
- RLS, roles no editables por usuarios, RPCs transaccionales, límites de fotos, ninguna clave de servicio en frontend.
- Portada pública sin catálogo, resultados, fotos ni nombres de rifas. Solo miembros aprobados consultan el catálogo (RLS en Postgres).
- Fotografías de rifas/subastas en bucket **privado**; se muestran mediante enlaces firmados de 10 minutos para miembros aprobados. Avatares son públicos.
- Modo demo local para explorar después de crear una cuenta simulada; NO es un sistema de autorización.

## Instalar y probar

Requiere Node 22+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sin las variables de Supabase la aplicación en producción permanece bloqueada. En desarrollo local puedes activar `VITE_DEMO_MODE=true` para una demostración sin usuarios reales. Pruebas:

```bash
npm run check
```

## Conectar Supabase (Supabase compartido con Study Compass)

1. Se está reutilizando el proyecto Supabase `ciarlxdhhrsrkpdkyqfi`, con tablas `public.chn_*` independientes de Study Compass. El esquema compartido está en `supabase/migrations/20261108174100_shared_supabase_chn.sql` y ya fue aplicado.
2. En Auth > Providers > Email, activa confirmación por email y establece la Site URL correcta y las Redirect URLs de tu dominio de Vercel (o `http://localhost:5173` para desarrollo). Configura SMTP de producción para entrega consistente.
3. Las variables `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` ya están en Vercel. La publishable key es segura para frontend; nunca uses una clave `service_role` en el cliente.
4. El proyecto Vercel está conectado a GitHub (`b3njaram/raffles`), con carpeta raíz `scoutrifas-chn`, framework Vite y comando de verificación `npm run check`.
5. Registra tu cuenta en la web usando tu ID scout y confirma el email. Una vez verificada tu identidad, el propietario puede promoverla en Supabase SQL Editor: `UPDATE public.chn_profiles SET role='admin', verified=true WHERE scout_id='CHN-TUIDREAL';` (reemplaza por tu ID). No hay administrador predeterminado ni contraseña universal.
6. La cuenta administradora verifica a los demás miembros, aprueba las publicaciones, revisa todas las pujas, registra participaciones y cierra rifas vencidas.

## Seguridad y límites

- La cadena `CHN` **solo es formato**, no prueba pertenencia. La verificación es manual. No solicites fotografías de credenciales oficiales en la web sin un proceso de privacidad y autorización específico.
- Los usuarios no pueden declararse administradores, editar su verificación o escribir participaciones, pujas o ganadores directamente por REST. Las acciones importantes se hacen mediante funciones PostgreSQL autorizadas, con `FOR UPDATE` para evitar carreras de simultaneidad.
- La app no integra dinero, pasarelas, cobros, donaciones, carritos ni checkout. Los montos de puja son propuestas registradas, no contratos ni transferencias; define reglas claras antes de activarlas.
- La rifa muestra al ganador después de que el admin cierra una actividad vencida. La selección se realiza con orden aleatorio mediante `gen_random_uuid()` y guarda el resultado y el número de participaciones en `draw_audit`. Para rifas con premios significativos, conviene utilizar un procedimiento supervisado y auditable adicional.
- RLS protege registros. **Fotos de perfil son públicas; las fotos de premios son privadas**; recomienda a los miembros no subir información personal sensible, fotos de menores sin permiso, documentos ni direcciones.
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

## Visibilidad del catálogo y comprobación

El catálogo no se carga antes de `auth.getUser()` y de que `public.chn_profiles` confirme el usuario y su verificación. La portada es genérica; no anuncia el requisito de acceso. PostgreSQL RLS exige autenticación y membresía verificada. Las tablas `chn_listings`, `chn_bids`, `chn_raffle_entries` y `chn_profiles` son independientes.

Las fotos de publicaciones usan el bucket privado `chn-listings` y URLs firmadas de 10 minutos; los avatares usan el bucket público `chn-avatars`. Las firmas se renuevan al refrescar el catálogo.

Study Compass conserva sus propias tablas y consultas. La migración CHN **no** reemplaza ni modifica esas tablas. Ambos proyectos comparten autenticación Supabase, pero los perfiles de ScoutRifas están separados.

## Despliegue activo compartido (2026-11-08)

- Proyecto Supabase: `ciarlxdhhrsrkpdkyqfi` (compartido con Study Compass, **tablas independientes**).
- Tablas `chn_profiles`, `chn_listings`, `chn_raffle_entries`, `chn_bids`, `chn_draw_audit`; funciones `chn_*`; depósitos `chn-avatars` y `chn-listings` (privado).
- Las cuentas ya existentes de Study Compass pueden iniciar sesión y completar el perfil de ScoutRifas mediante la función controlada `chn_register_member`. Esto no cambia su perfil Study Compass.
- Panel admin con historial de pujas, participantes, progreso, gestión de miembros y publicaciones.
- No hay admin predeterminado ni contraseñas de acceso ocultas. El primer admin debe ser autorizado por el propietario del proyecto.
