const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');

const JPEG_MARKERS = {
  APP0: 0xE0,
  APP1: 0xE1,
  APP2: 0xE2,
  APP13: 0xED,
  APP14: 0xEE,
  APP15: 0xEF,
  COM: 0xFE,
  SOS: 0xDA,
  EOI: 0xD9,
};

function startsWithAscii(buffer, text) {
  return buffer.length >= text.length && buffer.subarray(0, text.length).equals(Buffer.from(text, 'ascii'));
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function isStandaloneJpegMarker(marker) {
  return marker === 0x01 || marker === 0xD8 || marker === 0xD9 || (marker >= 0xD0 && marker <= 0xD7);
}

function parseIptcDetails(payload) {
  const details = [];
  const fields = {
    '2:5': 'Título',
    '2:25': 'Palabras clave',
    '2:40': 'Instrucciones especiales',
    '2:55': 'Fecha de creación',
    '2:80': 'Autor',
    '2:90': 'Ciudad',
    '2:101': 'País',
    '2:110': 'Crédito',
    '2:115': 'Fuente',
    '2:116': 'Copyright',
    '2:120': 'Descripción',
  };

  for (let i = 0; i + 5 <= payload.length;) {
    if (payload[i] !== 0x1C) {
      i += 1;
      continue;
    }

    const record = payload[i + 1];
    const dataset = payload[i + 2];
    const size = payload.readUInt16BE(i + 3);
    const valueStart = i + 5;
    const valueEnd = valueStart + size;

    if (valueEnd > payload.length) {
      i += 1;
      continue;
    }

    const rawValue = payload.subarray(valueStart, valueEnd);
    const value = rawValue.toString('utf8').replace(/\0/g, '').trim();
    const key = `${record}:${dataset}`;
    const label = fields[key] || `Campo ${key}`;

    if (value) {
      if (value.startsWith('FBMD')) {
        details.push('Identificador de procesamiento de Meta/Facebook (FBMD)');
      } else {
        const shortValue = value.length > 180 ? `${value.slice(0, 177)}...` : value;
        details.push(`IPTC — ${label}: ${shortValue}`);
      }
    } else if (key === '2:116') {
      details.push('IPTC — Campo Copyright vacío');
    }

    i = valueEnd;
  }

  // Algunos archivos guardan FBMD fuera de un registro IPTC bien formado.
  if (payload.toString('latin1').includes('FBMD')) {
    details.push('Identificador de procesamiento de Meta/Facebook (FBMD)');
  }

  return unique(details);
}

function inspectExifTags(jpegBuffer) {
  try {
    // Dependencia ya incluida por el proyecto. Se carga sólo cuando hace falta.
    const piexif = require('piexifjs');
    const exifObj = piexif.load(jpegBuffer.toString('binary'));
    const tags = [];

    for (const ifd in exifObj) {
      if (ifd === 'thumbnail') {
        if (exifObj[ifd]) tags.push('Miniatura EXIF');
        continue;
      }

      const values = exifObj[ifd];
      if (!values || typeof values !== 'object') continue;

      for (const tag in values) {
        const knownTag = piexif.TAGS?.[ifd]?.[tag];
        tags.push(knownTag?.name || `${ifd}-${tag}`);
      }
    }

    return unique(tags);
  } catch (_) {
    return [];
  }
}

function describeJpegMetadata(marker, payload) {
  if (marker === JPEG_MARKERS.APP1) {
    if (startsWithAscii(payload, 'Exif\0\0')) return ['EXIF'];
    if (startsWithAscii(payload, 'http://ns.adobe.com/xap/1.0/\0')) return ['XMP'];
    if (startsWithAscii(payload, 'http://ns.adobe.com/xmp/extension/\0')) return ['XMP extendido'];
    return ['Metadatos APP1'];
  }

  if (marker === JPEG_MARKERS.APP2) {
    return ['Metadatos APP2 no esenciales'];
  }

  if (marker === JPEG_MARKERS.APP13) {
    const details = startsWithAscii(payload, 'Photoshop 3.0\0')
      ? ['Bloque Photoshop/IPTC (APP13)', ...parseIptcDetails(payload)]
      : ['Metadatos APP13'];
    return unique(details);
  }

  if (marker === 0xEB) {
    if (payload.includes(Buffer.from('jumb', 'ascii')) || payload.includes(Buffer.from('c2pa', 'ascii'))) {
      return ['C2PA/JUMBF (procedencia y credenciales de contenido)'];
    }
    return ['Metadatos APP11'];
  }

  if (marker === JPEG_MARKERS.COM) {
    const comment = payload.toString('utf8').replace(/\0/g, '').trim();
    return [comment ? `Comentario JPEG: ${comment.slice(0, 180)}` : 'Comentario JPEG'];
  }

  if (marker >= 0xE0 && marker <= 0xEF) {
    return [`Metadatos APP${marker - 0xE0}`];
  }

  return ['Metadatos JPEG'];
}

function decideJpegSegment(marker, payload) {
  // Conservamos sólo bloques técnicos que pueden afectar compatibilidad o color.
  if (marker === JPEG_MARKERS.APP0) {
    if (startsWithAscii(payload, 'JFIF\0')) {
      // JFIF puede contener una miniatura RGB al final. La quitamos sin eliminar
      // el encabezado técnico para mantener máxima compatibilidad.
      if (payload.length >= 14 && payload[12] > 0 && payload[13] > 0) {
        const cleanPayload = Buffer.from(payload.subarray(0, 14));
        cleanPayload[12] = 0;
        cleanPayload[13] = 0;
        return { action: 'replace', payload: cleanPayload, tags: ['Miniatura JFIF incrustada'] };
      }
      return { action: 'keep', tags: [] };
    }

    // JFXX suele contener miniaturas alternativas.
    return { action: 'remove', tags: startsWithAscii(payload, 'JFXX\0') ? ['Miniatura JFXX'] : ['Metadatos APP0 no esenciales'] };
  }

  if (marker === JPEG_MARKERS.APP2 && startsWithAscii(payload, 'ICC_PROFILE\0')) {
    // Se preserva el perfil ICC para no alterar la apariencia de color.
    return { action: 'keep', tags: [] };
  }

  if (marker === JPEG_MARKERS.APP14 && startsWithAscii(payload, 'Adobe')) {
    // Puede ser necesario para interpretar correctamente JPEG CMYK/YCCK.
    return { action: 'keep', tags: [] };
  }

  if (
    marker === JPEG_MARKERS.APP1 ||
    marker === JPEG_MARKERS.APP2 ||
    (marker >= 0xE3 && marker <= 0xED) ||
    marker === JPEG_MARKERS.APP14 ||
    marker === JPEG_MARKERS.APP15 ||
    marker === JPEG_MARKERS.COM
  ) {
    return { action: 'remove', tags: describeJpegMetadata(marker, payload) };
  }

  return { action: 'keep', tags: [] };
}

function makeJpegSegment(marker, payload) {
  const length = payload.length + 2;
  if (length > 0xFFFF) throw new Error('Bloque JPEG demasiado grande.');
  const header = Buffer.alloc(4);
  header[0] = 0xFF;
  header[1] = marker;
  header.writeUInt16BE(length, 2);
  return Buffer.concat([header, payload]);
}

function findSosOffset(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) return -1;
  let offset = 2;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) return -1;
    const markerStart = offset;
    while (offset < buffer.length && buffer[offset] === 0xFF) offset += 1;
    if (offset >= buffer.length) return -1;

    const marker = buffer[offset++];
    if (marker === JPEG_MARKERS.SOS) return markerStart;
    if (marker === JPEG_MARKERS.EOI) return -1;
    if (isStandaloneJpegMarker(marker)) continue;
    if (offset + 2 > buffer.length) return -1;

    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return -1;
    offset += length;
  }

  return -1;
}

function cleanJpegMetadata(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    throw new Error('El archivo no parece ser un JPEG válido.');
  }

  const parts = [buffer.subarray(0, 2)];
  const removedTags = [];
  const exifTags = inspectExifTags(buffer);
  let offset = 2;
  let foundSos = false;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      throw new Error('Estructura JPEG inválida antes de los datos de imagen.');
    }

    const markerStart = offset;
    while (offset < buffer.length && buffer[offset] === 0xFF) offset += 1;
    if (offset >= buffer.length) throw new Error('Marcador JPEG incompleto.');

    const marker = buffer[offset++];

    if (marker === JPEG_MARKERS.SOS) {
      parts.push(buffer.subarray(markerStart));
      foundSos = true;
      break;
    }

    if (marker === JPEG_MARKERS.EOI) {
      parts.push(buffer.subarray(markerStart, offset));
      break;
    }

    if (isStandaloneJpegMarker(marker)) {
      parts.push(buffer.subarray(markerStart, offset));
      continue;
    }

    if (offset + 2 > buffer.length) throw new Error('Longitud JPEG incompleta.');
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) throw new Error('Bloque JPEG dañado o truncado.');

    const segmentEnd = offset + length;
    const payload = buffer.subarray(offset + 2, segmentEnd);
    const decision = decideJpegSegment(marker, payload);

    if (decision.action === 'keep') {
      parts.push(buffer.subarray(markerStart, segmentEnd));
    } else if (decision.action === 'replace') {
      parts.push(makeJpegSegment(marker, decision.payload));
      removedTags.push(...decision.tags);
    } else {
      removedTags.push(...decision.tags);
      if (marker === JPEG_MARKERS.APP1 && startsWithAscii(payload, 'Exif\0\0')) {
        removedTags.push(...exifTags);
      }
    }

    offset = segmentEnd;
  }

  if (!foundSos) {
    throw new Error('No se encontró el inicio de los datos comprimidos del JPEG.');
  }

  const cleanBuffer = Buffer.concat(parts);

  // Garantía lossless: desde SOS hasta el final debe quedar exactamente igual.
  const originalSos = findSosOffset(buffer);
  const cleanSos = findSosOffset(cleanBuffer);
  if (originalSos < 0 || cleanSos < 0 || !buffer.subarray(originalSos).equals(cleanBuffer.subarray(cleanSos))) {
    throw new Error('La verificación lossless falló; no se guardó el resultado.');
  }

  return { cleanBuffer, removedTags: unique(removedTags) };
}

function cleanPngMetadata(buffer) {
  // Dependencias ya incluidas por el proyecto; carga diferida para que el
  // limpiador JPEG no dependa de ellas durante las pruebas.
  const extractChunks = require('png-chunks-extract');
  const encodeChunks = require('png-chunks-encode');
  const chunks = extractChunks(buffer);
  const keepTypes = ['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS'];

  const chunkDescriptions = {
    tEXt: 'Texto plano embebido',
    iTXt: 'Texto internacional (UTF-8)',
    zTXt: 'Texto comprimido',
    pHYs: 'Dimensiones físicas (DPI)',
    tIME: 'Fecha de última modificación',
    gAMA: 'Corrección gamma',
    cHRM: 'Cromaticidad (perfil de color)',
    sRGB: 'Intención de renderizado sRGB',
    iCCP: 'Perfil de color ICC embebido',
    bKGD: 'Color de fondo sugerido',
    sBIT: 'Bits significativos por canal',
    hIST: 'Histograma de la imagen',
    sPLT: 'Paleta sugerida',
    eXIf: 'Datos EXIF (cámara, GPS, etc.)',
    caBX: 'Firma C2PA — Procedencia de contenido (marca de IA)',
    caAs: 'C2PA — Almacenamiento de aserciones',
    caSt: 'C2PA — Almacenamiento de firmas',
  };

  const removedTags = [];
  const cleanChunks = chunks.filter((chunk) => {
    if (keepTypes.includes(chunk.name)) return true;

    const desc = chunkDescriptions[chunk.name] || 'Bloque de datos auxiliar';
    const sizeKB = (chunk.data.length / 1024).toFixed(1);
    let detail = `${chunk.name} — ${desc} (${sizeKB} KB)`;

    if (['tEXt', 'iTXt', 'zTXt'].includes(chunk.name)) {
      try {
        const text = chunk.data.toString('utf8', 0, Math.min(chunk.data.length, 500));
        const textParts = text.split('\0').filter(Boolean);
        if (textParts.length >= 2) {
          detail += ` → "${textParts[0]}": "${textParts.slice(1).join(' ').substring(0, 200)}"`;
        } else if (textParts.length === 1) {
          detail += ` → "${textParts[0].substring(0, 200)}"`;
        }
      } catch (_) {}
    }

    if (['caBX', 'caAs', 'caSt'].includes(chunk.name)) {
      try {
        const strings = [];
        let current = '';
        for (let i = 0; i < Math.min(chunk.data.length, 8192); i += 1) {
          const byte = chunk.data[i];
          if (byte >= 32 && byte <= 126) {
            current += String.fromCharCode(byte);
          } else {
            if (current.length >= 4) strings.push(current);
            current = '';
          }
        }
        if (current.length >= 4) strings.push(current);

        const interesting = strings.filter((s) =>
          s.includes('openai') || s.includes('dall-e') || s.includes('chatgpt') ||
          s.includes('c2pa') || s.includes('http') || s.includes('ai_') ||
          s.includes('claim') || s.includes('assertion') || s.includes('signer') ||
          s.includes('model') || s.includes('generated') || s.includes('author') ||
          s.includes('.com') || s.includes('.org') || s.includes('manifest') ||
          s.length > 10
        ).slice(0, 15);

        if (interesting.length > 0) detail += ` → Contenido detectado: [${interesting.join(' | ')}]`;
      } catch (_) {}
    }

    removedTags.push(detail);
    return false;
  });

  return {
    cleanBuffer: Buffer.from(encodeChunks(cleanChunks)),
    removedTags: unique(removedTags),
  };
}

async function writeAtomically(outPath, cleanBuffer) {
  const tempPath = `${outPath}.tmp-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(tempPath, cleanBuffer);
    await fs.rename(tempPath, outPath);
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function cleanMetadata(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = await fs.readFile(filePath);
  const fileName = path.basename(filePath, ext);
  const dirName = path.dirname(filePath);
  const timestamp = Date.now();
  const outPath = path.join(dirName, `${fileName}_clean_${timestamp}${ext}`);

  try {
    let result;
    if (ext === '.jpg' || ext === '.jpeg') {
      result = cleanJpegMetadata(buffer);
    } else if (ext === '.png') {
      result = cleanPngMetadata(buffer);
    } else {
      throw new Error('Formato no soportado. Usa JPG o PNG.');
    }

    await writeAtomically(outPath, result.cleanBuffer);
    return { resultPath: outPath, removedTags: result.removedTags };
  } catch (error) {
    throw new Error(`Error procesando ${fileName}: ${error.message}`);
  }
}

module.exports = {
  cleanMetadata,
  // Exportados para pruebas; no cambian la API que usa Electron.
  cleanJpegMetadata,
  findSosOffset,
};

