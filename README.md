# Reporte de guardia - versión PDF pro + Drive

Esta versión incluye:
- PDF generado con `jsPDF + AutoTable` (no como captura de pantalla).
- Encabezado institucional claro y legible.
- Tablas compactas y bien distribuidas en A4.
- Botón **Guardar en Drive** usando Google Apps Script.
- Registro histórico en Google Sheets.

## Archivos
- `index.html`
- `styles.css`
- `app.js`
- `assets/logo-sbvp.png`
- `apps-script/Code.gs`

## Configuración del frontend
En `app.js` completar:

```js
const APPS_SCRIPT_URL = 'PEGAR_AQUI_URL_WEB_APP';
```

## Configuración del Apps Script
1. Crear un proyecto de Google Apps Script.
2. Pegar el contenido de `apps-script/Code.gs`.
3. Completar:

```js
const FOLDER_ID = 'PEGAR_ID_CARPETA_DRIVE';
const SPREADSHEET_ID = 'PEGAR_ID_GOOGLE_SHEETS';
```

4. Implementar como **Web App**:
   - Ejecutar como: **yo**
   - Acceso: **cualquiera con el enlace**

5. Copiar la URL del Web App y pegarla en `app.js`.

## Google Sheets sugerido
Usar un archivo con estas hojas:
- `Historial`
- `Detalle`

Si no existen, el script las crea y les agrega encabezados.

## Importante sobre CORS
El envío desde GitHub Pages al Web App se hace con `mode: 'no-cors'` para simplificar la conexión desde el navegador.
Eso significa que la app no puede leer la respuesta final del servidor, aunque el envío sí se realiza. La validación se hace revisando Drive y Sheets.

## Publicación
Subir todo el contenido de esta carpeta a GitHub Pages.


## Configuración aplicada en esta versión
- Web App de Apps Script configurada en `app.js`.
- Carpeta Drive configurada en `apps-script/Code.gs`.
- Google Sheets histórico configurado en `apps-script/Code.gs`.
- Logo soportado desde `logo-sbvp.png`, `logo SBVP.png` y `assets/logo-sbvp.png`.

## App Script ya cargado
URL Web App:
`https://script.google.com/macros/s/AKfycbwEw-qxvU1pvSnnp39s4LD8x45iai9YkHpaiqzY5q4DkCKOsFdPMDW0x8oC0MkUhADx/exec`
