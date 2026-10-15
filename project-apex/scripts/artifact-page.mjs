// Builds dist/artifact.html: the page body for hosting the production build
// on claude.ai, which supplies the <html>/<head>/<body> skeleton itself.
import { readFileSync, writeFileSync } from 'node:fs';

const html = readFileSync('dist/index.html', 'utf8');
const script = html.match(/<script type="module"[^>]*src="\.?\/?(assets\/[^"]+\.js)"/)?.[1];
const style = html.match(/<link rel="stylesheet"[^>]*href="\.?\/?(assets\/[^"]+\.css)"/)?.[1];
if (!script || !style) throw new Error('Run `vite build` first: no bundle found in dist/index.html.');

const page = `<title>Project Apex</title>
<meta name="theme-color" content="#0b0c0f">
<style>
  :root { color-scheme: dark; background: #0b0c0f; }
  html, body, #root { height: 100%; }
  body { background: #0b0c0f; color: #f4f5f7; }
</style>
<link rel="stylesheet" href="${style}">
<div id="root"></div>
<script type="module" src="${script}"></script>
`;
writeFileSync('dist/artifact.html', page);
console.log(`dist/artifact.html -> ${script}, ${style}`);
