# Configuración de privacidad · ScoutApoya Grupo 4 CHN

## 1. Cerrar el código fuente (acción del propietario de GitHub)

La cuenta conectada tiene permisos de administrador de `b3njaram/raffles`, pero la integración disponible no permite cambiar la visibilidad mediante API. Hasta que se realicen los pasos siguientes, **el repositorio es público**.

1. Abrir https://github.com/b3njaram/raffles/settings
2. Ir a **General → Danger Zone → Change repository visibility**.
3. Elegir **Private**, revisar las consecuencias y confirmar.
4. Verificar que aparezca el candado en el repositorio.
5. Revisar **Vercel → proyecto scoutrifas-chn → Settings → Git** para confirmar que continúa vinculado; probar un commit de despliegue.

**Advertencias:** los forks públicos o copias previamente descargadas no se vuelven privados; el JavaScript enviado al navegador sigue siendo visible mediante las herramientas del navegador.

## 2. Controlar quién entra

- El formulario de solicitud **no crea cuentas de ScoutApoya**; administración debe aprobar primero.
- El único administrador puede aceptar/rechazar solicitudes y revocar la verificación de las cuentas existentes.
- La política RLS de Supabase evita lecturas públicas de sorteos y registros de apoyo.
- La portada puede permanecer visible para captar posibles simpatizantes. Si se quiere limitar también la portada, el responsable puede implementar autenticación perimetral en un proveedor compatible, conservando una ruta pública separada para solicitudes.

## 3. Destino de los apoyos

**Grupo 4 de Chihuahua Norte** es el beneficiario previsto; la web solo guarda intenciones de aportar y no recibe dinero, por lo que aún no existe un enrutamiento bancario operativo. Para recibir fondos reales, confirmar la entidad receptora, cuentas autorizadas, aviso de privacidad y obligaciones fiscales.

El carácter deducible no se desprende automáticamente de ser Grupo 4 de Scouts. Si otra entidad emite CFDI deducibles y canaliza los fondos, formalizar el acuerdo y comprobar que el proceso fiscal cumple requisitos.

## 4. Sorteos

No reemplazar la identificación de sorteos por términos ambiguos con el propósito de eludir la ley. Mantener permiso/condiciones, folios, registro de participantes y comprobantes cuando aplique. Los sorteos solo se habilitan tras autorizarse la mecánica concreta.

Fuentes:
- GitHub: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/managing-repository-settings/setting-repository-visibility
- SAT: https://www.sat.gob.mx/minisitio/DeduccionesPersonales/donaciones.html
- SEGOB: https://juegosysorteos.segob.gob.mx/es/Juegos_y_Sorteos/Requisitos_para_Sorteos
