# ScoutApoya · Grupo 4 Chihuahua Norte

Plataforma privada para **causas auténticas de apoyo comunitario**. Los participantes solamente pueden crear y consultar intenciones de apoyo a proyectos del Grupo 4, sujetas a aprobación previa del único administrador.

## Funciones activas

- Solicitud de acceso y aprobación administrativa antes de registrar una cuenta.
- Inicio de sesión, recuperación de contraseña y perfiles con foto e identificador CHN (para scouts).
- Catálogo privado de causas con imágenes, descripción, categoría, monto fijo por intención, meta, fecha de cierre y estado.
- Organizadores scouts aprobados pueden crear causas con **1–10 fotografías** de hasta 5 MB.
- Cada publicación requiere aprobación exclusiva del administrador.
- Los miembros aprobados pueden registrar repetidas intenciones de apoyo a la misma causa.
- Cada registro obtiene un folio numérico único tipo `G4-00010001`, bajo una restricción UNIQUE y secuencia de PostgreSQL.
- Historial personal e impresión de acuses; en el panel, seguimiento y exportación de intenciones.
- La página no cobra dinero, **no registra donaciones pagadas** y no genera CFDI. Un acuse solo acredita una intención.

## Funciones retiradas

Las operaciones de asignación de premios, concursos de azar y entradas vinculadas a sorteos han sido **retiradas del código activo** y su acceso público o autenticado se deshabilitó en PostgreSQL mediante `20261110232000_retire_legacy_operations.sql`. No hay enlaces ni pantallas para esas actividades.

Los registros y las migraciones históricas **se conservan** para integridad, trazabilidad y obligaciones de retención; no se deben alterar o borrar para ocultar operaciones pasadas.

## Seguridad y privacidad

- `public.chn_causes` tiene RLS: solo la comunidad verificada puede ver publicaciones aprobadas; organizadores pueden ver sus borradores; administración ve la cola de aprobación.
- `public.chn_support_pledges` sólo permite leer las intenciones del usuario correspondiente o del administrador.
- Los folios se crean exclusivamente mediante procedimientos validados; no hay INSERT directo desde el frontend.
- No se asignan derechos adicionales a quien registre más intenciones.
- El repositorio GitHub **todavía debe cambiarse a privado desde Settings** si el propietario desea ocultar el código fuente. Privacidad del repositorio no equivale a invisibilidad del JavaScript en el navegador.
- La privacidad por invitación se mantiene para proteger datos de los participantes, no como mecanismo para evadir responsabilidades legales.

## Estructura técnica

- Aplicación React + Vite (src/App.tsx y src/Causes.tsx).
- Supabase de la organización, con tablas CHN separadas de otras aplicaciones.
- Vercel para despliegue con `npm run check` (TypeScript, tests, Vite).
- Repositorio GitHub: b3njaram/raffles (nombre histórico aún no cambiado).
- La carpeta de migraciones SQL incluye el historial original por motivos de auditoría.

## Antes de recibir donativos reales

Confirmar la entidad receptora y su cuenta bancaria, la autorización para usar la identidad del Grupo 4, las obligaciones fiscales y el aviso de privacidad. Un CFDI deducible solo puede emitirse por una entidad autorizada que haya recibido realmente el donativo.
