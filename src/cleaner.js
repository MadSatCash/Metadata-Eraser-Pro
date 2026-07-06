const fs = require('fs/promises');
const path = require('path');
const piexif = require('piexifjs');
const extractChunks = require('png-chunks-extract');
const encodeChunks = require('png-chunks-encode');
const crypto = require('crypto'); // Required for rule 18

async function cleanMetadata(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  
  let cleanBuffer = null;
  const fileName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const timestamp = Date.now();
  const outPath = path.join(dirName, `${fileName}_clean_${timestamp}${ext}`);
  // Using crypto.randomUUID() for temporary safety naming if needed, 
  // but we will just output to a '_clean' suffix.

  try {
    let removedTags = [];

    if (ext === '.jpg' || ext === '.jpeg') {
      // JPEG Lossless Cleaning
      const dataStr = buffer.toString('binary');
      
      // Intentar leer quÃ© metadatos existen antes de borrarlos
      try {
        const exifObj = piexif.load(dataStr);
        for (const ifd in exifObj) {
          if (ifd === 'thumbnail' && exifObj[ifd] !== null) {
            removedTags.push('Thumbnail');
            continue;
          }
          for (const tag in exifObj[ifd]) {
            try {
              if (piexif.TAGS && piexif.TAGS[ifd] && piexif.TAGS[ifd][tag]) {
                removedTags.push(piexif.TAGS[ifd][tag]["name"]);
              } else {
                removedTags.push(`${ifd}-${tag}`);
              }
            } catch(e) {}
          }
        }
      } catch (e) {}

      // piexif.remove throws error if no EXIF is found
      let cleanDataStr;
      try {
        cleanDataStr = piexif.remove(dataStr);
      } catch (e) {
        cleanDataStr = dataStr;
      }
      cleanBuffer = Buffer.from(cleanDataStr, 'binary');
    } 
    else if (ext === '.png') {
      // PNG Lossless Cleaning
      const chunks = extractChunks(buffer);
      // Essential chunks + transparency
      const keepTypes = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS'];

      // Descriptions for known non-essential PNG chunk types
      const chunkDescriptions = {
        'tEXt': 'Texto plano embebido',
        'iTXt': 'Texto internacional (UTF-8)',
        'zTXt': 'Texto comprimido',
        'pHYs': 'Dimensiones fÃ­sicas (DPI)',
        'tIME': 'Fecha de Ãºltima modificaciÃ³n',
        'gAMA': 'CorrecciÃ³n gamma',
        'cHRM': 'Cromaticidad (perfil de color)',
        'sRGB': 'IntenciÃ³n de renderizado sRGB',
        'iCCP': 'Perfil de color ICC embebido',
        'bKGD': 'Color de fondo sugerido',
        'sBIT': 'Bits significativos por canal',
        'hIST': 'Histograma de la imagen',
        'sPLT': 'Paleta sugerida',
        'eXIf': 'Datos EXIF (cÃ¡mara, GPS, etc.)',
        'caBX': 'Firma C2PA â€” Procedencia de contenido (marca de IA)',
        'caAs': 'C2PA â€” Almacenamiento de aserciones',
        'caSt': 'C2PA â€” Almacenamiento de firmas',
      };
      
      const cleanChunks = chunks.filter(chunk => {
        if (!keepTypes.includes(chunk.name)) {
          const desc = chunkDescriptions[chunk.name] || 'Bloque de datos auxiliar';
          const sizeKB = (chunk.data.length / 1024).toFixed(1);
          let detail = `${chunk.name} â€” ${desc} (${sizeKB} KB)`;

          // Extraer texto legible del contenido binario
          if (['tEXt', 'iTXt', 'zTXt'].includes(chunk.name)) {
            try {
              const text = chunk.data.toString('utf8', 0, Math.min(chunk.data.length, 500));
              // tEXt tiene formato: keyword\0value
              const parts = text.split('\0').filter(Boolean);
              if (parts.length >= 2) {
                detail += ` â†’ "${parts[0]}": "${parts.slice(1).join(' ').substring(0, 200)}"`;
              } else if (parts.length === 1) {
                detail += ` â†’ "${parts[0].substring(0, 200)}"`;
              }
            } catch(e) {}
          }

          // Para C2PA (caBX), buscar strings ASCII legibles dentro del binario
          if (chunk.name === 'caBX' || chunk.name === 'caAs' || chunk.name === 'caSt') {
            try {
              const raw = chunk.data;
              // Extraer cadenas ASCII legibles (min 4 chars)
              const strings = [];
              let current = '';
              for (let i = 0; i < Math.min(raw.length, 8192); i++) {
                const byte = raw[i];
                if (byte >= 32 && byte <= 126) {
                  current += String.fromCharCode(byte);
                } else {
                  if (current.length >= 4) strings.push(current);
                  current = '';
                }
              }
              if (current.length >= 4) strings.push(current);
              
              // Filtrar las mÃ¡s relevantes (URLs, nombres, identificadores)
              const interesting = strings.filter(s => 
                s.includes('openai') || s.includes('dall-e') || s.includes('chatgpt') ||
                s.includes('c2pa') || s.includes('http') || s.includes('ai_') ||
                s.includes('claim') || s.includes('assertion') || s.includes('signer') ||
                s.includes('model') || s.includes('generated') || s.includes('author') ||
                s.includes('.com') || s.includes('.org') || s.includes('manifest') ||
                s.length > 10
              ).slice(0, 15);
              
              if (interesting.length > 0) {
                detail += ` â†’ Contenido detectado: [${interesting.join(' | ')}]`;
              }
            } catch(e) {}
          }

          removedTags.push(detail);
          return false;
        }
        return true;
      });
      
      cleanBuffer = Buffer.from(encodeChunks(cleanChunks));
    } 
    else {
      throw new Error('Formato no soportado. Usa JPG o PNG.');
    }

    await fs.writeFile(outPath, cleanBuffer);
    return { resultPath: outPath, removedTags };
  } catch (error) {
    throw new Error(`Error procesando ${fileName}: ${error.message}`);
  }
}

module.exports = { cleanMetadata };
