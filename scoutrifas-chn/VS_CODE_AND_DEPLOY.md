# ScoutApoya CHN — VS Code, IA local y despliegue automático

## 1) Flujo de publicación

Repositorio: `b3njaram/raffles` (rama `main`).

Proyecto de Vercel: `scoutapoya-chn`, conectado al mismo repositorio de GitHub.

**Configuración del proyecto Vercel**:
- Root Directory: `scoutrifas-chn`
- Framework Preset: Vite
- Build Command: `npm run check` (primero TypeScript, después Vitest, después Vite)
- Output Directory: `dist`
- Production Branch: `main`

Con esa integración, cada push a `main` activa un build de producción automáticamente; un push a otra rama puede generar una URL de preview. Si la compilación falla, Vercel no publica esa versión. **No vuelvas a activar un deploy manual salvo para solucionar un error específico.**

## 2) Abrir en VS Code

Desde una terminal con Git y Node.js instalados:

```bash
git clone https://github.com/b3njaram/raffles.git
cd raffles/scoutrifas-chn
npm install
npm run check
code .
```

Para levantar el sitio localmente:

```bash
cp .env.example .env.local
npm run dev
```

En Windows PowerShell: `Copy-Item .env.example .env.local`. Edita `.env.local` directamente con los valores **publicables** de tu proyecto Supabase desde el Dashboard; jamás utilices `service_role` o una `secret key` en Vite. `.env.local` ya está excluido de Git mediante `.gitignore`.

Si la variable `VITE_DEMO_MODE` se activa, trabaja en modo demostración y no contra el backend real.

**Publicar después de probar**:

```bash
npm run check
git status
git add .
git commit -m "feat: describir el cambio"
git push origin main
```

Una vez confirmado el disparador automático, Vercel compila y actualiza `https://scoutapoya-chn.vercel.app`. Los commits a otros directorios de `raffles` no forman parte de esta aplicación.

## 3) IA local para editar archivos

- Instala **Ollama**: https://ollama.com/ y un modelo de programación adecuado a la memoria de tu PC.
- Prueba: `ollama pull qwen2.5-coder:7b`, luego `ollama list`.
- Instala **Continue** en VS Code: https://marketplace.visualstudio.com/items?itemName=Continue.continue
- En Continue, abre **Local Config** y configura un modelo Ollama instalado (o usa autodetección). Elige **Edit / Agent** si el modelo admite las herramientas; inspecciona el diff antes de aceptar cambios.
- Alternativa: la extensión **Ollama** de su propio editor VS Code Chat, https://marketplace.visualstudio.com/items?itemName=ollama.ollama, integra modelos locales al selector de modelos. La calidad de Agent Mode depende del modelo, del contexto y de la RAM/VRAM; no todos los modelos locales saben ejecutar múltiples herramientas.

## 4) Supabase dentro de VS Code

- La extensión **Supabase for Visual Studio Code** se encuentra en https://marketplace.visualstudio.com/items?itemName=Supabase.vscode-supabase-extension. Su explorador de tablas y asistentes de migraciones requieren Supabase CLI **y una instancia local** (Docker compatible).
- Para conectar un asistente a **Supabase hospedado** es más flexible el **MCP oficial**: https://supabase.com/docs/guides/ai-tools/mcp . El archivo `.vscode/mcp.json` de este proyecto agrega el MCP **limitado al proyecto y solo lectura**. En VS Code Chat puede solicitar autorización OAuth de Supabase. Esto no instala el servidor por ti ni concede autorización automáticamente.
- Si quieres usar el asistente como agente de BD, recomendamos que genere **archivos de migración** para revisión y pruebas locales, no que escriba directamente a producción.

Desde `scoutrifas-chn/`, después de instalar Supabase CLI y Docker:

```bash
npx supabase --help
npx supabase login
npx supabase link --project-ref ciarlxdhhrsrkpdkyqfi
npx supabase db pull
npx supabase start
```

Estos comandos pueden requerir ajustes según la versión de CLI, los permisos y el estado local de las migraciones. **No ejecutes `supabase db push` automáticamente**: ScoutApoya comparte el proyecto Supabase con otra aplicación. Toda migración debe revisarse, probarse y aplicarse de forma controlada.

**Git/Vercel solo publican frontend automáticamente; NO aplican cambios SQL a Supabase.** Un cambio que implique migración requiere un paso de actualización de base de datos.

## 5) Seguridad y restricciones

- Nunca incluyas `.env.local`, contraseñas, tokens ni claves secretas en prompts, commits o capturas de pantalla.
- Revisa el diff antes de ejecutar comandos que borren tablas, usuarios o archivos.
- Trabaja en una rama `feature/...` para probar cambios importantes y haz merge a `main` después de verificar las pruebas.
- El repositorio remoto puede seguir siendo público; cambiar su visibilidad solo se hace en GitHub Settings con privilegios del propietario. Una vez privado, verifica que la integración GitHub ↔ Vercel siga autorizada.
- Los MCP/Agentes remotos no funcionan completamente sin internet. Ollama puede generar y editar localmente, pero GitHub, Vercel y Supabase alojado requieren conexión.
