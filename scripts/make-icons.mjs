// Tạo icon PWA từ SVG (chạy một lần: npm run icons). Cần phông có chữ Nhật trên máy.
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const out = path.resolve('public/icons');
fs.mkdirSync(out, { recursive: true });

const svg = (size, { maskable = false, rounded = false } = {}) => {
  const r = maskable ? size * 0.3 : size * 0.36;
  const font = r * 1.25;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.2 : 0}" fill="#f6f2e9"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="#c4412f"/>
  <text x="50%" y="50%" dy="0.36em" text-anchor="middle" font-family="IPAGothic, 'Noto Sans JP', 'Hiragino Sans', sans-serif" font-weight="700" font-size="${font}" fill="#fffdf8">あ</text>
</svg>`;
};

const make = async (name, size, opts) => {
  await sharp(Buffer.from(svg(size, opts))).png({ compressionLevel: 9 }).toFile(path.join(out, name));
  console.log('✔', name);
};

await make('icon-192.png', 192);
await make('icon-512.png', 512);
await make('icon-maskable-512.png', 512, { maskable: true });
await make('apple-touch-icon.png', 180);
await make('favicon-48.png', 48, { rounded: true });
fs.writeFileSync(path.resolve('public/favicon.svg'), svg(64, { rounded: true }).replace("font-family=\"IPAGothic, 'Noto Sans JP', 'Hiragino Sans', sans-serif\"", "font-family=\"'Hiragino Sans','Noto Sans JP','Yu Gothic',sans-serif\""));
console.log('✔ favicon.svg');
