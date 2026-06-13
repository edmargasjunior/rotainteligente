/**
 * sync-web.js
 * Copia recursivamente os assets web da raiz para www/ antes do `cap sync`.
 * Exclui node_modules, android, .git e pastas de build.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WWW = path.join(ROOT, 'www');

/** Diretórios/arquivos ignorados na cópia para Capacitor. */
const IGNORE = new Set([
  'node_modules',
  'android',
  'www',
  '.git',
  '.github',
  'scripts',
  'package.json',
  'package-lock.json',
  'capacitor.config.json',
  '.gitignore',
  'README.md',
]);

/**
 * Copia recursivamente um diretório.
 * @param {string} src
 * @param {string} dest
 */
function copyDir(src, dest) {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  fs.readdirSync(src).forEach((entry) => {
    if (IGNORE.has(entry)) return;

    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✓ ${path.relative(ROOT, destPath)}`);
    }
  });
}

if (fs.existsSync(WWW)) {
  fs.rmSync(WWW, { recursive: true, force: true });
}
fs.mkdirSync(WWW, { recursive: true });

copyDir(ROOT, WWW);
console.log('\nAssets web sincronizados em www/');
