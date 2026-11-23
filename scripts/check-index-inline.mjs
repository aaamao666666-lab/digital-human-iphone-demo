import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const html = fs.readFileSync('index.html', 'utf8');
const blocks = [...html.matchAll(/<script\\b([^>]*)>([\\s\\S]*?)<\\/script>/gi)];
let checked = 0;

for (let index = 0; index < blocks.length; index += 1) {
  const attributes = blocks[index][1] || '';
  const source = blocks[index][2] || '';
  if (/\\bsrc\\s*=/.test(attributes) || /\\btype\\s*=\\s*["']importmap["']/i.test(attributes)) continue;
  if (!source.trim()) continue;

  const isModule = /\\btype\\s*=\\s*["']module["']/i.test(attributes);
  const extension = isModule ? '.mjs' : '.cjs';
  const file = path.join(os.tmpdir(), 'xinling-inline-' + process.pid + '-' + index + extension);
  fs.writeFileSync(file, source, 'utf8');
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  fs.rmSync(file, { force: true });

  if (result.status !== 0) {
    const detail = [result.stderr, result.stdout].filter(Boolean).join('\\n').trim();
    throw new Error('index.html 内联脚本 #' + (index + 1) + ' 语法检查失败：\\n' + detail);
  }
  checked += 1;
}

if (!checked) throw new Error('没有找到可检查的 index.html 内联脚本。');
console.log('index.html inline JavaScript syntax OK (' + checked + ' blocks)');
