#!/usr/bin/env node
/**
 * Collects the artefacts of the known-defect run into `defect-evidence/`,
 * converting Playwright's WebM recordings to MP4 so they play anywhere
 * without a codec argument.
 *
 * Run via `npm run evidence` — that script runs the tests first, then this.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const RAW = path.resolve('defect-evidence/raw');
const OUT = path.resolve('defect-evidence');

/** Maps a Playwright output directory name onto a readable evidence name. */
const NAMES = [
  [/router-malformed-modal/, '01-router-blank-page'],
  [/surfaces-a-conflict-message/, '02-duplicate-email-no-conflict-message'],
  [/registration-works-at-login/, '03-duplicate-email-password-rejected'],
];

function evidenceName(dir) {
  for (const [pattern, name] of NAMES) if (pattern.test(dir)) return name;
  return null;
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

if (!fs.existsSync(RAW)) {
  console.error(`No raw artefacts at ${RAW}. Run the evidence tests first.`);
  process.exit(1);
}

let converted = 0;
let copied = 0;

for (const dir of fs.readdirSync(RAW)) {
  const name = evidenceName(dir);
  if (!name) continue;

  for (const file of walk(path.join(RAW, dir))) {
    const ext = path.extname(file);

    if (ext === '.webm') {
      const target = path.join(OUT, `${name}.mp4`);
      // yuv420p + even dimensions: without them the output refuses to play in
      // QuickTime and most browsers.
      execFileSync('ffmpeg', [
        '-y', '-loglevel', 'error',
        '-i', file,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-movflags', '+faststart',
        target,
      ]);
      converted++;
      console.log(`  video  ${path.relative(process.cwd(), target)}`);
    }

    if (ext === '.png') {
      const target = path.join(OUT, `${name}.png`);
      fs.copyFileSync(file, target);
      copied++;
      console.log(`  shot   ${path.relative(process.cwd(), target)}`);
    }
  }
}

console.log(`\n${converted} recording(s) converted to MP4, ${copied} screenshot(s) collected.`);
if (converted === 0 && copied === 0) {
  console.error('Nothing collected — did the known-defect tests run?');
  process.exit(1);
}
