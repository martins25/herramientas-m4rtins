// Genera public/pwned/ para la herramienta "¿Está tu contraseña en los diccionarios?".
// Modelo k-anonymity con ficheros estáticos: por cada contraseña calcula SHA-1,
// y agrupa los hashes por prefijo de 2 hex (256 ficheros). El navegador solo pide
// el prefijo y compara el resto en local → la contraseña nunca sale.
//
// USO (en tu PC, una sola vez / cuando actualices listas):
//   node scripts/build-pwned.mjs lista1.txt lista2.txt ...
// Sube luego public/pwned/ por FileZilla. NO necesitas estas listas en el servidor.
import { createHash } from 'node:crypto';
import { createReadStream, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline';

const inputs = process.argv.slice(2);
if (!inputs.length) {
  console.error('Uso: node scripts/build-pwned.mjs <archivo1.txt> [archivo2.txt ...]');
  process.exit(1);
}

const OUT = 'public/pwned';
if (existsSync(OUT)) rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 256 buckets por prefijo de 2 hex, cada uno un Set de sufijos (38 hex).
const buckets = new Map();
let total = 0;

const sha1 = (s) => createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase();

for (const file of inputs) {
  console.log(`Procesando ${file}…`);
  const rl = createInterface({ input: createReadStream(file), crlfDelay: Infinity });
  for await (const line of rl) {
    const pw = line.replace(/\r$/, '');
    if (!pw) continue;
    const h = sha1(pw);
    const prefix = h.slice(0, 2);
    const suffix = h.slice(2);
    let set = buckets.get(prefix);
    if (!set) buckets.set(prefix, (set = new Set()));
    if (!set.has(suffix)) { set.add(suffix); total++; }
  }
}

let files = 0;
for (const [prefix, set] of buckets) {
  const lines = [...set].sort().join('\n');
  writeFileSync(`${OUT}/${prefix}.txt`, lines + '\n');
  files++;
}
console.log(`Hecho: ${total.toLocaleString('es')} hashes únicos en ${files} ficheros (public/pwned/).`);
