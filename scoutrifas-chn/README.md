# ScoutRifas CHN ⚜️

Aplicación React/Vite para administrar rifas por boletos, solicitudes y folios; Supabase compartido con Study Compass y despliegue Vercel.

**ESTADO: PREPARADA, PERO SIN VENTA HABILITADA.** La web no procesa pagos, tarjetas ni transferencias. No emite boletos pagados hasta que exista autorización legal comprobada por el responsable.

## Acceso
- La portada es genérica; los visitantes anónimos no pueden consultar rifas ni participantes.
- Scouts: ID único CHN, cuenta de correo y aprobación por administración.
- Simpatizantes: nombre, correo verificado, referencia opcional, declaración de mayoría de edad y aprobación por administración; no requieren ID CHN.
- Simpatizantes aprobados pueden solicitar boletos cuando la venta esté habilitada, pero no pueden publicar rifas.
- Scouts aprobados y admins pueden crear publicaciones sujetas a moderación.
- Nadie puede autoaprobarse, convertirse en admin ni modificar el estado de autorización de venta.
- Fotos de premio: depósito privado chn-listings y URLs firmadas. Avatares: depósito público chn-avatars.

## Flujo por boletos
1. Un organizador crea una rifa: fotos, descripción, precio fijo, cantidad y cierre.
2. Un admin la revisa. Aprobar una publicación NO habilita ventas.
3. Tras recibir permiso válido y documentación aprobada, el titular de la base puede activar la venta para UNA rifa específica (sales_authorized).
4. Un usuario adulto y aprobado solicita de 1 a 10 boletos. La solicitud dura 24 horas, no cobra dinero y no es un folio.
5. El admin confirma o cancela después de verificar el procedimiento autorizado. Cada boleto confirmado obtiene folio secuencial único, con bloqueo transaccional para evitar duplicados.
6. Tras la celebración de un sorteo supervisado, el admin registra el número ganador y la referencia del acta oficial. La aplicación NO sortea automáticamente.
7. Usuarios ven solicitudes y folios. Administradores ven participantes, métricas, progreso, revisión y CSV.

## Supabase
Proyecto: ciarlxdhhrsrkpdkyqfi (compartido con Study Compass; los datos de Study Compass NO se modificaron).

Tablas: public.chn_profiles, chn_listings, chn_ticket_orders, chn_ticket_numbers, chn_draw_audit.
Las tablas antiguas chn_bids y chn_raffle_entries quedan solo como legado con escritura RPC revocada.

Migraciones aplicadas:
- supabase/migrations/20261108174100_shared_supabase_chn.sql
- supabase/migrations/20261108202000_ticket_raffles_supporters.sql
- supabase/migrations/20261108210000_scout_only_publish.sql

Vercel ya tiene las variables VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY.
NUNCA utilizar la clave secret/service_role en el navegador.

## Primer administrador
No existen cuentas admin predeterminadas. Después de verificar la identidad del titular de un ID CHN, el propietario de Supabase puede ejecutar en SQL Editor:

    update public.chn_profiles set role='admin',verified=true
    where scout_id='CHN-REEMPLAZAR' and member_type='scout';

No uses esta instrucción para promover cuentas cuyo titular no esté verificado.

## Redirects de autenticación
Supabase es compartido. Añade https://scoutrifas-chn.vercel.app/** a Authentication > URL Configuration > Redirect URLs SIN eliminar los redirects de Study Compass. Recomendada confirmación de correo y SMTP de producción.

## Seguridad y ámbito legal
- sales_authorized permanece en FALSE por defecto, solo lo puede cambiar el propietario de la base, no el administrador del frontend.
- El RPC de solicitud exige permiso registrado, URL de bases HTTPS y vigencia futura, además de cuenta aprobada y declaración de mayoría de edad.
- Para habilitar efectivamente, el titular legal del sorteo debe verificar la documentación, el permiso SEGOB, la zona de comercialización, precio, cupo, boletos autorizados, fecha, fiscalidad y bases oficiales; después configurar los datos en la base. Nunca inventar un permiso.
- El reglamento exige acceso gratuito del público al evento de sorteo (salvo excepciones definidas) y publicidad obligatoria de datos del permiso/boletos y resultados. Restringir este catálogo no debe impedir esas obligaciones.
- Si el evento autorizado exige reportes, supervisión o folios adicionales, adapta el procedimiento digital antes de operar.
- No rebautizar boletos como donativos para esquivar permisos; el acceso por invitación tampoco los elimina.
- Antes de recopilar datos personales reales publica un aviso de privacidad, contacto para derechos ARCO y política de retención. Implementa controles de menores, CAPTCHA y límites de abuso.
- Usar marca oficial Scouts/ASMAC requiere autorización de sus titulares.
- No es asesoría jurídica; revisa trámites con un profesional.

Fuentes: Secretaría de Gobernación (permiso con venta de boletos) https://www.gob.mx/tramites/ficha/permiso-general-de-sorteos-con-venta-de-boletos/SEGOB1204
Reglamento federal: https://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo88470.html

## Desarrollo
Requiere Node 22+. Ejecuta npm install, copia .env.example a .env.local, ejecuta npm run check y npm run dev.
En Vercel: directorio raíz scoutrifas-chn, framework Vite, build npm run check, salida dist.
La compilación automatizada no sustituye pruebas de usuarios reales por rol. En el ambiente actual no hay todavía cuentas CHN ni compras.


## Noviembre 2026: solicitudes aprobadas ANTES de crear cuentas

- Un visitante primero usa **Solicitar acceso** en la página. Esto registra su nombre, correo y categoría (Scout/simpatizante) en `public.chn_access_requests`, sin crear una cuenta en Supabase Auth.
- La pestaña **Administración → Accesos** permite al único administrador aceptar o rechazar la solicitud. Para dar el aviso se incluye el enlace **Avisar por correo**, que abre un correo listo para enviar; no existe un servicio de envío automático configurado.
- Tras recibir aprobación, la persona elige **Crear cuenta aprobada** y se registra con el mismo correo, tipo de participante y, si corresponde, ID CHN. La función trigger `private.chn_handle_new_user` rechaza solicitudes de ScoutRifas sin aprobación. La verificación de correo por Supabase Auth se mantiene.
- Las personas que ya tengan una cuenta en el Supabase compartido (por ejemplo Study Compass) deben iniciar sesión y pulsar **Activar acceso aprobado**; esa función usa el correo confirmado de su cuenta, sin confiar en datos editables enviados desde el navegador.
- ScoutRifas comparte `auth.users` con Study Compass. Una cuenta creada independientemente para Study Compass no obtiene permisos para ScoutRifas sin la aprobación anterior.
- El único administrador se establece en `private.chn_admin_owner` y `private.chn_is_admin()`. Un trigger impide asignar el rol `admin` a otro perfil. La tabla de control privado no es accesible desde el navegador.
- Es aconsejable configurar CAPTCHA y límites por IP antes de anunciar públicamente el formulario: el control actual evita solicitudes duplicadas por correo pero no sustituye medidas antispam.

## Calculadora privada y fotografías

- El editor de nuevas rifas admite **1–10 fotografías** JPG, PNG o WebP, de hasta 5 MB por archivo. Las imágenes se almacenan en el bucket privado de las publicaciones.
- Antes de guardar se puede calcular el **ingreso bruto al vender todos los boletos**, costos del premio, gastos extras, ganancia neta, punto de equilibrio y número aproximado de boletos para alcanzar una meta.
- La comisión del sitio es **una simulación 0/3/5/10 %**, con 0 % predeterminado. No cobra dinero ni cambia la asignación de fondos.
- Los costos y las metas se almacenan en `chn_raffle_financials`, protegidos por RLS para propietario y único administrador. La inserción de rifa y plan se hace en una operación RPC transaccional.
- No son estimaciones de ingresos garantizados: las simulaciones suponen 100 % de boletos vendidos y no incluyen impuestos y permisos no especificados.

## Despliegue y pruebas

- Branch y repositorio: `b3njaram/raffles` → `scoutrifas-chn`.
- Vercel personal, proyecto `scoutrifas-chn`; build `npm run check` (TypeScript, pruebas y Vite).
- El test SQL de integración comprobó solicitud anónima, aprobación administrativa, activación de una cuenta existente, impedimento de segundo administrador y creación de una rifa con 10 fotografías y finanzas privadas. Todos los cambios de prueba se revirtieron mediante `ROLLBACK`.
- No hay pasarela de pagos ni ventas activadas por defecto. Se requiere permiso de SEGOB aplicable antes de vender boletos, además de revisión fiscal y autorización para usar la identidad oficial de Scouts de México.
