# Metadata Eraser Pro v1.1.0

## Cambios

- El limpiador JPEG ya no elimina sólo EXIF: ahora también quita XMP, Photoshop/IPTC (APP13), identificadores FBMD de Meta/Facebook, comentarios JPEG, C2PA/JUMBF y otros bloques APP no esenciales.
- Conserva el flujo comprimido original del JPEG sin recomprimirlo. La imagen mantiene exactamente los mismos píxeles.
- Preserva JFIF, perfiles ICC y bloques Adobe cuando pueden ser necesarios para compatibilidad o color.
- Detecta y muestra campos IPTC relevantes, como autor, copyright, crédito y descripción.
- Escritura atómica: primero genera un archivo temporal y sólo después crea el resultado final.
- Escapado seguro del texto mostrado en la interfaz para evitar que metadatos maliciosos se interpreten como HTML.
- La limpieza de PNG conserva el comportamiento de la versión anterior.

## Actualización sin borrar node_modules

1. Cerrá Metadata Eraser Pro.
2. Hacé una copia de seguridad de la carpeta actual.
3. Copiá el contenido de esta carpeta sobre la carpeta `app` existente y aceptá reemplazar archivos.
4. No borres la carpeta `node_modules` que ya tenés instalada.
5. Abrí nuevamente `Metadata Eraser Pro.bat`.

