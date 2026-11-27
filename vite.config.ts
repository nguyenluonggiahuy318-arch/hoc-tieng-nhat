import { execSync } from 'node:child_process';
import { defineConfig, type Plugin } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// Trên GitHub Pages web nằm ở /<tên-repo>/ — workflow deploy truyền BASE_PATH vào.
const base = process.env.BASE_PATH || '/';

let sha = 'dev';
try {
  sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
} catch {
  /* chưa có git */
}

// Repo GitHub ("owner/repo") cho trang "Gửi bài": lấy từ GitHub Actions, hoặc từ git remote khi build trên máy.
let repo = process.env.GITHUB_REPOSITORY || '';
if (!repo) {
  try {
    const url = execSync('git remote get-url origin', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
    const m = url.match(/github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/);
    if (m) repo = `${m[1]}/${m[2]}`;
  } catch {
    /* chưa có remote */
  }
}

// Content-Security-Policy (chỉ khi build): trang chỉ được gọi tới chính nó, GitHub API và Google Fonts.
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "connect-src 'self' https://api.github.com https://fonts.googleapis.com https://fonts.gstatic.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'none'",
  "object-src 'none'",
].join('; ');
const cspPlugin: Plugin = {
  name: 'csp-meta',
  apply: 'build',
  transformIndexHtml: (html) => html.replace('<meta charset="utf-8" />', `<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`),
};

export default defineConfig({
  base,
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __BUILD_SHA__: JSON.stringify(sha),
    __REPO__: JSON.stringify(repo),
  },
  build: {
    target: ['es2020', 'safari14'],
    chunkSizeWarningLimit: 800,
  },
  plugins: [
    cspPlugin,
    preact(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png', 'icons/favicon-48.png'],
      manifest: {
        name: 'Học tiếng Nhật — Kana & từng bài',
        short_name: 'Học Nhật',
        description: 'Học Hiragana, Katakana, từ vựng và ngữ pháp sơ cấp theo từng bài. Giao diện tiếng Việt.',
        lang: 'vi',
        display: 'standalone',
        background_color: '#f6f2e9',
        theme_color: '#f6f2e9',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
