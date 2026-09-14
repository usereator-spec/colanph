import { cp, mkdir, readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const rootFiles = [
  'index.html',
  'works.html',
  'work.html',
  'about.html',
  'login.html',
  '_redirects',
  '_headers'
];

for (const file of rootFiles) {
  await cp(path.join(root, file), path.join(dist, file));
}

await cp(path.join(root, 'assets', 'css'), path.join(dist, 'assets', 'css'), { recursive: true });
await cp(path.join(root, 'assets', 'js'), path.join(dist, 'assets', 'js'), { recursive: true });
await cp(path.join(root, 'admin'), path.join(dist, 'admin'), { recursive: true });

console.log('Build statico completato in dist/.');
