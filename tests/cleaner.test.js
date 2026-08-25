const assert = require('assert');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const zlib = require('zlib');

const cleaner = require('../src/cleaner');
const extractChunks = require('png-chunks-extract');
const encodeChunks = require('png-chunks-encode');

function makePngWithText() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(1, 0);
  ihdr.writeUInt32BE(1, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.from(encodeChunks([
    { name: 'IHDR', data: ihdr },
    { name: 'tEXt', data: Buffer.from('Author\0Metadata Eraser test', 'utf8') },
    { name: 'IDAT', data: zlib.deflateSync(Buffer.from([0, 255, 0, 0, 255])) },
    { name: 'IEND', data: Buffer.alloc(0) }
  ]));
}

function makeJpegWithExif() {
  const minimal = Buffer.from(
    '/9j/4AAQSkZJRgABAQAAAQABAAD/2gAMAwEAAhEDEQA/AAAA/9k=',
    'base64'
  );
  const payload = Buffer.from('Exif\0\0TEST', 'binary');
  const header = Buffer.alloc(4);
  header[0] = 0xff;
  header[1] = 0xe1;
  header.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([minimal.subarray(0, 2), header, payload, minimal.subarray(2)]);
}

async function run() {
  const runDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mep-test-'));
  try {
    const pngPath = path.join(runDir, 'vector.png');
    await fs.writeFile(pngPath, makePngWithText());
    const pngResult = await cleaner.cleanMetadata(pngPath);
    const pngChunks = extractChunks(await fs.readFile(pngResult.resultPath)).map((chunk) => chunk.name);
    assert.deepStrictEqual(pngChunks, ['IHDR', 'IDAT', 'IEND']);
    assert.strictEqual(pngResult.removedTags.length, 1);

    const jpgPath = path.join(runDir, 'vector.jpg');
    const originalJpeg = makeJpegWithExif();
    await fs.writeFile(jpgPath, originalJpeg);
    const originalSos = cleaner.findSosOffset(originalJpeg);
    const jpgResult = await cleaner.cleanMetadata(jpgPath);
    const cleanJpeg = await fs.readFile(jpgResult.resultPath);
    const cleanSos = cleaner.findSosOffset(cleanJpeg);
    assert.ok(!cleanJpeg.includes(Buffer.from('Exif\0\0', 'binary')));
    assert.ok(originalJpeg.subarray(originalSos).equals(cleanJpeg.subarray(cleanSos)));

    console.log('Metadata cleaner tests passed.');
  } finally {
    await fs.rm(runDir, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

