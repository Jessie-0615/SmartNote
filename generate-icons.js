/* Generate SmartNote icons — mint-to-yellow gradient */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function lerp(a, b, t) { return Math.round(a + (b - a) * t); }

function createPNG(w, h) {
  const raw = [];
  for (let y = 0; y < h; y++) {
    raw.push(0);
    for (let x = 0; x < w; x++) {
      const t = (x + y) / (w + h);
      raw.push(
        lerp(0xCE, 0xEF, t), // R: CEE7E1 → EFE695
        lerp(0xE7, 0xE6, t), // G
        lerp(0xE1, 0x95, t), // B
      );
    }
  }
  const buf = Buffer.from(raw);
  const deflated = zlib.deflateSync(buf);
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w,0); ihdr.writeUInt32BE(h,4);
  ihdr[8]=8; ihdr[9]=2;
  const ihdrC = chunk('IHDR', ihdr);
  const idatC = chunk('IDAT', deflated);
  const iendC = chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdrC, idatC, iendC]);
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length,0);
  const tb = Buffer.from(type, 'ascii');
  const crcIn = Buffer.concat([tb, data]);
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc32(crcIn), 0);
  return Buffer.concat([len, tb, data, crcB]);
}

function crc32(buf) {
  let c=0xFFFFFFFF;
  for(let i=0;i<buf.length;i++){c^=buf[i];for(let j=0;j<8;j++)c=(c&1)?(c>>>1)^0xEDB88320:c>>>1;}
  return(c^0xFFFFFFFF)>>>0;
}

const dir = path.join(__dirname, 'public', 'icons');
if(!fs.existsSync(dir)) fs.mkdirSync(dir,{recursive:true});

fs.writeFileSync(path.join(dir,'icon-192.png'), createPNG(192,192));
fs.writeFileSync(path.join(dir,'icon-512.png'), createPNG(512,512));
console.log('Gradient icons generated (mint → yellow)');
