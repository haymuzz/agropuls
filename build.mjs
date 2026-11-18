import { readFile, writeFile } from 'node:fs/promises';

const read = (name) => readFile(new URL('./src/' + name, import.meta.url), 'utf8');
const [template, rawData, app] = await Promise.all([
  read('index.template.html'),
  read('data.json'),
  read('app.js'),
]);

const data = JSON.stringify(JSON.parse(rawData));
const page = template.replace('__DATA__', () => data).replace('__APP__', () => app);
await writeFile(new URL('./index.html', import.meta.url), page, 'utf8');
