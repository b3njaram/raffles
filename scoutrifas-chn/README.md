# ScoutApoya Grupo 4 · Chihuahua Norte

Esta aplicación distingue **causas auténticas de apoyo comunitario** y **sorteos gratuitos**. No modifica su naturaleza ni los denomina de forma engañosa.

## Causas (módulo nuevo)

- Solo cuentas aprobadas pueden explorar causas y registrar intenciones.
- Scouts aprobados pueden proponer causas con título, descripción, categoría, fecha de cierre, monto fijo sugerido y meta de apoyo. Permite **1 a 10 fotografías** por causa, máximo 5 MB cada una.
- El administrador único aprueba, pausa o cancela la publicación.
- Un usuario aprobado puede registrar **tantas intenciones de apoyo como desee** para la misma causa.
- Cada intención obtiene un folio numérico global único, presentado como `G4-00010001`. La operación es transaccional: no se generan duplicados.
- Cada usuario puede consultar su historial e imprimir **acuse de intención**, claramente rotulado **SIN PAGO, NO CFDI, NO DEDUCIBLE**. El folio nunca acredita transferencia recibida ni una compra.
- El acumulado de la causa se calcula sobre importes **previstos** y siempre se identifica como tal, no como dinero recaudado.
- Ninguna intención otorga entradas a sorteos, probabilidades de ganar, ni premios.

## Sorteos gratuitos

Los sorteos se mantienen como un flujo independiente, correctamente identificado en su propia sección, con entrada gratuita y sujeta a la autorización oficial correspondiente. No se implementan boletos pagados ni vínculos entre aportaciones y participaciones.

## Donaciones pagadas y recibos fiscales

Esta versión **no procesa dinero**. Para habilitar la recepción y emitir un recibo real, antes hay que definir la entidad jurídica receptora, habilitar una cuenta oficial y registrar el pago verificado. Los CFDI deducibles solo corresponden cuando los emite el receptor autorizado en las condiciones previstas por el SAT. Un número interno no sustituye un CFDI.

## Seguridad

- RLS en causas e intenciones: solo usuarios aprobados; registros propios o, en funciones administrativas, el único administrador.
- Las fotos se almacenan en el bucket privado existente, con URLs temporales.
- Todas las operaciones de escritura requieren RPC validados por identidad y rol. Los clientes no tienen permisos generales de INSERT/UPDATE sobre causas, ni pueden fabricar acuses.
- El catálogo es cerrado por invitación y aprobación. Eso **protege privacidad**, pero no reemplaza permisos, avisos de privacidad ni obligaciones legales.
- El repositorio actual debe hacerse **privado manualmente en GitHub**; una web Vite no es código fuente completamente oculto, pues el navegador descarga parte del cliente.

Migración: `supabase/migrations/20261110223000_genuine_causes_intent_acknowledgments.sql`.

## Tecnología

GitHub: `b3njaram/raffles/scoutrifas-chn`; Vercel personal: `scoutrifas-chn`; Supabase compartido, tablas CHN aisladas de Study Compass. Build de validación: `npm run check`.

---

## Contexto y tareas previas

# ScoutApoya CHN ⚜️

Apoyo comunitario voluntario y sorteos gratuitos INDEPENDIENTES para la comunidad Scout Chihuahua Norte. React/Vite, Supabase y Vercel, con código en GitHub.

**Importante:** Cambiar el nombre rifa por donación NO elimina permisos de sorteos. ScoutApoya NO otorga entradas por donar, NO multiplica oportunidades al aportar y NO procesa dinero. Los sorteos permanecen bloqueados hasta comprobar el permiso SEGOB que corresponda.

## Grupo beneficiario y acceso limitado

- **Destinatario previsto de los apoyos:** Grupo 4 de Chihuahua Norte. Actualmente se registran solo **intenciones**, sin recibir ni transferir dinero; este cambio no configura cuenta bancaria, pasarela de pago ni emisión de CFDI.
- **El catálogo y las participaciones no son públicos:** Supabase exige cuenta autenticada y aprobada. Los visitantes solo ven la bienvenida y la solicitud de acceso. La única cuenta administrativa determina qué personas aprueba o revoca.
- **Deducibilidad:** el Grupo 4 no puede anunciar donativos deducibles por pertenecer a Scouts sin acreditar que el receptor legal de los fondos sea donataria autorizada y pueda emitir el CFDI correspondiente. Verificarlo con los responsables de la asociación y el asesor fiscal antes de habilitar cobros.
- **Código fuente privado:** el repositorio actual `b3njaram/raffles` se encontró PUBLICO al revisar GitHub. Solo el propietario puede cambiar la visibilidad desde GitHub → Settings → General → Danger Zone → Change repository visibility → Private. La conexión con Vercel debe revisarse después.
- Hacer privado el repositorio no elimina copias o forks públicos existentes, ni impide ver el JavaScript que el navegador descarga. La protección de datos depende de RLS, autenticación y autorizaciones del servidor.
- Un grupo reducido de participantes y un repositorio privado no eliminan requisitos fiscales ni permisos aplicables a sorteos.

## Flujos separados
1. Apoyar proyectos: un miembro aprobado elige un importe sugerido y categoría (Actividades, Transporte, Materiales, Formación, General). El sitio registra una INTENCIÓN, no un pago ni una donación recibida, y no genera entradas.
2. Sorteos sin costo: el miembro elige un sorteo y, si cuenta con autorización legal vigente y cupo, solicita una única participación gratuita por persona, sin donar.
3. Organizadores aprobados proponen sorteos con hasta diez fotografías. Administración aprueba la PUBLICACIÓN, pero esto NO abre inscripciones.
4. Tras validar documentación, el propietario de Supabase registra número de permiso, bases HTTPS, fecha y habilitación del sorteo. Una vez finalizado, administración registra el número ganador determinado mediante sorteo oficial documentado.
5. No existe selección automática de ganador ni proceso de pago.

SEGOB también contempla permisos para sorteos sin venta de boletos. No se debe anunciar lo contrario.

## Permisos y seguridad
- Únicamente hay una cuenta administradora, protegida por trigger y tabla privada.
- Los nuevos usuarios presentan solicitud antes de registrarse; administración aprueba o rechaza.
- El catálogo es privado para miembros aprobados; también pueden entrar simpatizantes externos aprobados.
- Apoyos (tabla chn_support_pledges) solo visibles para cada titular y administrador mediante RLS.
- Entradas gratuitas (chn_free_draw_entries) son únicas por sorteo y usuario y se crean únicamente mediante RPC protegido.
- Resultados (chn_free_draw_results) quedan documentados. El usuario no puede alterar la habilitación.
- La autorización de venta de boletos está permanentemente deshabilitada mediante restricción SQL. Los RPC antiguos de compra tienen ejecución revocada.
- Las intenciones de apoyo jamás afectan inscripciones ni posibilidades de ganar.

## Infraestructura
- Código: https://github.com/b3njaram/raffles/tree/main/scoutrifas-chn
- Web: https://scoutrifas-chn.vercel.app
- Base compartida con Study Compass: proyecto Supabase ciarlxdhhrsrkpdkyqfi; tablas CHN separadas.
- Variables: VITE_SUPABASE_URL y VITE_SUPABASE_PUBLISHABLE_KEY. Nunca incluir service_role en frontend.
- Build: npm run check (TypeScript, tests, Vite).
- Migración: supabase/migrations/20261110210000_independent_support_and_free_draws.sql

## Pendiente antes de usar con dinero real
- Validar permisos de SEGOB incluso para sorteos gratuitos, personalidad legal del organizador y bases oficiales.
- Requerir aviso de privacidad y protección de datos personales, política de retención y canal ARCO.
- Configurar CAPTCHA/límites por IP y correos automáticos de aprobación antes de apertura al público.
- Si se decide recibir donaciones reales, establecer un método a nombre de la entidad responsable con tratamiento fiscal adecuado, independiente de la participación y de los premios.
- La web actual registra solo intenciones: no hay cobros, donaciones recibidas ni comprobantes fiscales.

Fuentes oficiales:
- SEGOB: https://www.gob.mx/tramites/ficha/permiso-para-sorteos-sin-venta-de-boletos/SEGOB1199
- Dirección General de Juegos y Sorteos: https://sitios.segob.gob.mx/es/Juegos_y_Sorteos/Sorteos_sin_venta_de_boletos_
- SAT: https://www.sat.gob.mx/minisitio/DonatariasAutorizadas/documentos/ConsideracionesRelevantesDIT.pdf

No constituye asesoría jurídica ni permiso de celebración de sorteo.
