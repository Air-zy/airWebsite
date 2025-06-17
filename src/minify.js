// minify all js html cs from a directory and puts it on another

import { promises as fs } from 'fs';
import path from 'path';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';
import minifyHtml from '@minify-html/node';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';

const defaultHtmlOptions = {
  keep_spaces_between_attributes: false,
  keep_comments: false,
  // docs: https://www.npmjs.com/package/@minify-html/node
};

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function processFile(filePath, srcDir, outDir, htmlOptions) {
  const relPath = path.relative(srcDir, filePath);
  const destPath = path.join(outDir, relPath);
  await ensureDir(path.dirname(destPath));

  const ext = path.extname(filePath).toLowerCase();
  const content = await fs.readFile(filePath);

  try {
    if (ext === '.html') {
      const minifiedBuffer = minifyHtml.minify(Buffer.from(content), htmlOptions);
      await fs.writeFile(destPath, Buffer.from(minifiedBuffer));
      console.log(`Minified HTML: ${relPath}`);
    } else if (ext === '.js') {
      const code = content.toString('utf-8');
      const result = await minifyJs(code);
      if (result.code == null) throw new Error(`Terser failed for ${relPath}`);
      await fs.writeFile(destPath, Buffer.from(result.code, 'utf-8'));
      console.log(`Minified JS: ${relPath}`);
    } else if (ext === '.css') {
      const code = content.toString('utf-8');
      const output = new CleanCSS({}).minify(code);
      if (output.errors.length) {
        console.error(`CleanCSS errors in ${relPath}:`, output.errors);
      }
      await fs.writeFile(destPath, Buffer.from(output.styles, 'utf-8'));
      console.log(`Minified CSS: ${relPath}`);
    } else {
      // Copy other files unchanged
      await fs.copyFile(filePath, destPath);
      console.log(`Copied (no minify): ${relPath}`);
    }
  } catch (err) {
    console.error(`Error processing ${relPath}:`, err);
  }
}

async function walkDirectory(dir, srcDir, outDir, htmlOptions) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, srcDir, outDir, htmlOptions);
    } else if (entry.isFile()) {
      await processFile(fullPath, srcDir, outDir, htmlOptions);
    }
  }
}

export async function startMinify({ src = 'src', dest = 'dist', htmlOptions = {} } = {}) {
  const htmlOpts = { ...defaultHtmlOptions, ...htmlOptions };
  const srcDir = path.resolve(src);
  const outDir = path.resolve(dest);

  // remov current dest directory, then remak
  await fs.rm(outDir, { recursive: true, force: true });
  await ensureDir(outDir);

  console.log(`Starting minification: from ${srcDir} to ${outDir}`);
  await walkDirectory(srcDir, srcDir, outDir, htmlOpts);
  console.log('Minification complete.');
}