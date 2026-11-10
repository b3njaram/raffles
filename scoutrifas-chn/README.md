# ScoutApoya CHN ⚜️

Apoyo comunitario voluntario y sorteos gratuitos INDEPENDIENTES para la comunidad Scout Chihuahua Norte. React/Vite, Supabase y Vercel, con código en GitHub.

**Importante:** Cambiar el nombre rifa por donación NO elimina permisos de sorteos. ScoutApoya NO otorga entradas por donar, NO multiplica oportunidades al aportar y NO procesa dinero. Los sorteos permanecen bloqueados hasta comprobar el permiso SEGOB que corresponda.

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
