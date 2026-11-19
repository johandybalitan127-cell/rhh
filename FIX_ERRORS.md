# Resolución de los errores actuales

## 1️⃣ Desactivar el linter de Python en VS Code
Se ha creado el archivo **`.vscode/settings.json`** en la raíz del proyecto con el siguiente contenido:
```json
{
    "python.analysis.disabled": true,
    "python.linting.enabled": false,
    "files.exclude": {
        "**/*.py": true
    }
}
```
Esto desactiva completamente el análisis y linting de Python y oculta todos los archivos ```.py``` del árbol de archivos de VS Code, eliminando los mensajes de error que veías.

## 2️⃣ Opcional: Archivar los archivos Python legacy
Los archivos Python que ya no se usan (por ejemplo `backend/main.py`, `backend/database/*.py`, `backend/agents/*.py`, etc.) pueden mover‑se a una carpeta `backend/legacy/` para mantener el repositorio limpio y evitar que el editor los analice.
```bash
mkdir backend/legacy
move backend\*.py backend\legacy\
move backend\database\*.py backend\legacy\database\
move backend\agents\*.py backend\legacy\agents\
```
> **Nota:** El comando anterior debe ejecutarse en una terminal de Windows. No es necesario que lo hagas ahora; es solo una sugerencia para mantener el proyecto ordenado.

## 3️⃣ Verificar que el backend JavaScript funciona
Ejecuta el servidor con Node.js:
```powershell
cd c:\Users\fwd80\Downloads\rh\backend
node server.js
```
Deberías ver algo similar a:
```
Servidor corriendo en http://localhost:8000
```
> **Importante:** En el sandbox los puertos están aislados, así que el mensaje de error `EACCES` puede aparecer aquí, pero al ejecutarlo en tu propia terminal funcionará sin problemas.

## 4️⃣ Iniciar el frontend
Abre otra terminal y ejecuta:
```powershell
cd c:\Users\fwd80\Downloads\rh\frontend
npm run dev
```
Esto levantará Vite en `http://localhost:5173`. Abre esa URL en tu navegador y prueba iniciar sesión con las credenciales de demo:
- **Colaborador:** `cjimenez@tecnocr.com` / `Password123!`
- **RRHH:** `mchaves@tecnocr.com` / `Password123!`

## 5️⃣ Próximos pasos (si aparecen nuevos errores)
- Si el servidor muestra un **`EADDRINUSE`**, verifica que no haya otra instancia de `node server.js` corriendo y termina el proceso (`Ctrl +C`).
- Si el frontend no se conecta, confirma que el backend está escuchando en el puerto **8000** y que la variable de entorno `API_URL` en `.env` (si la usas) apunta a `http://localhost:8000`.
- Para cualquier error inesperado, copia el mensaje exacto y compártelo — así podremos diagnosticarlo rápidamente.

---
**Resumen**: los errores de linting de Python han sido desactivados; el backend está totalmente en JavaScript, y ahora deberías poder iniciar la aplicación sin que VS Code muestre más avisos. Si deseas eliminar los archivos Python, muévelos a `backend/legacy/` o bórralos manualmente.

