# ScoutApoya · Grupo 4 Chihuahua Norte

Plataforma privada para **causas auténticas de apoyo comunitario**. Los participantes solamente pueden crear y consultar intenciones de apoyo a proyectos del Grupo 4, sujetas a aprobación previa del único administrador.


## Español, English y apariencia

- Español (ES) es el idioma predeterminado. El interruptor **ES / EN** en el encabezado cambia los textos del interfaz; las descripciones escritas por los usuarios conservan su idioma original.
- Otro interruptor en el encabezado cambia entre **tema claro y tema oscuro**. Ambas preferencias se guardan localmente en el navegador del usuario.
- Las causas nuevas permiten configurar **un importe y una meta en MXN** y **otro importe y otra meta en USD**; no usamos tipo de cambio automático.
- Cada intención elige MXN o USD y guarda esa denominación, el importe, un acuse numérico único y un estado de aprobación. Los totales se mantienen **separados por moneda**; rechazar una intención resta solo de la moneda que correspondía.
- Las causas anteriores permanecen en MXN hasta que se creen nuevas causas con montos USD configurados.
- Esta aplicación no cobra dinero, no conecta cuentas bancarias ni genera CFDI. Aunque en el futuro existan una cuenta USD y otra MXN, **deberán verificarse y conectarse expresamente** por el propietario o entidad autorizada. No se ha configurado ninguna cuenta personal ni de la organización.
- El alojamiento en Vercel no determina por sí mismo el país del beneficiario ni el tratamiento fiscal de los fondos.

Migraciones: `supabase/migrations/20261111180000_dual_currency_intentions.sql` y `20261111183000_dual_currency_amount_check.sql`.

## Cupos y aprobación individual de intenciones

Cada causa tiene un **máximo de intenciones**, fijado por el organizador al crearla (1 a 100,000). Una barra de progreso muestra \`registradas / límite\`, tanto en las tarjetas como en los detalles y la administración. Los registros pendientes y los aprobados utilizan cupo; si se rechaza una intención, se libera un espacio y disminuye el total de importes previstos.

Un miembro aprobado puede dirigir su intención al **organizador**, al **administrador** o a **otra cuenta de usuario aprobada**. El sistema guarda únicamente la identidad de la cuenta de ScoutApoya elegida; **no almacena datos bancarios, no transfiere fondos y no confirma dinero recibido**.

Al registrarla se crea inmediatamente un **acuse único con folio** (por ejemplo, \`G4-00010001\`) y estado **Pendiente de aprobación**. Únicamente el administrador único puede marcar cada intención como **Aprobada** o **Rechazada**. Esa aprobación valida el registro administrativo, no un pago. Las intenciones rechazadas conservan su folio en el historial pero dejan de ocupar cupo. Los folios no se reutilizan.

Las operaciones del servidor usan bloqueo de fila \`FOR UPDATE\` para evitar sobreventa de cupo por solicitudes simultáneas; el cliente no puede manipular directamente los estados, contadores o folios. El acceso sigue sujeto a aprobación y la aplicación no tiene pagos, facturas ni CFDI integrados.

Migración: \`supabase/migrations/20261110235500_intention_limits_and_review.sql\`.

## Mejoras para comunidad y organizadores

- **Búsqueda avanzada de causas:** filtros por categoría y disponibilidad; orden por fecha de publicación, proximidad de cierre, progreso y lugares libres. Solo se filtran causas que Supabase ya autorizó a consultar.
- **Enlaces privados:** el botón «Compartir» crea una URL tipo \`?causa=<uuid>\`. Un enlace **no concede acceso**; el receptor debe tener cuenta verificada y permisos sobre esa causa. El enlace abre directamente la causa después de iniciar sesión.
- **Borradores de creación:** el formulario guarda automáticamente título, descripción, importes, metas, categoría, fecha y cupo en \`localStorage\`, con una clave distinta por usuario. Las **fotos no se guardan**; al regresar, deben seleccionarse otra vez. Un control permite descartar el borrador. En computadoras compartidas, estos borradores pueden quedar disponibles localmente hasta descartarlos; no escribas datos sensibles.
- **Consulta de acuses:** en «Mis apoyos» se puede buscar por folio, causa o destinatario, y filtrar por estado. El acuse permite copiar el número además de imprimir o guardar PDF.
- **Prevención de doble clic:** el envío de una intención bloquea reenvíos simultáneos desde el mismo formulario. La base sigue asignando los números únicos y controlando cupos atómicamente; no constituye garantía de deduplicación entre dispositivos o reintentos después de un fallo de red.

No se agregaron cuentas bancarias ni cobros. Todas las intenciones y acuses son registros, no confirmaciones de pago.

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
