// Builds dist/artifact.html: a single self-contained page (inline JS + CSS, Google Fonts) for sandboxed hosts.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
const dir = new URL('../dist/assets/', import.meta.url);
const files = readdirSync(dir);
const js = readFileSync(new URL(files.find((f) => f.endsWith('.js')), dir), 'utf8').replace(/<\/script/gi, '<\\/script');
let css = readFileSync(new URL(files.find((f) => f.endsWith('.css')), dir), 'utf8');
css = css.replace(/@font-face\s*\{[^}]*\}/g, '');
const html = `<title>EGO: Beyond Blue Lock</title>
<meta name="theme-color" content="#05070d">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&display=swap">
<style>:root{color-scheme:dark}html,body{height:100%}${css}</style>
<div id="root"></div>
<script type="module">${js}</script>
`;
writeFileSync(new URL('../dist/artifact.html', import.meta.url), html);
console.log('artifact.html', (html.length / 1024).toFixed(0) + ' KB');
