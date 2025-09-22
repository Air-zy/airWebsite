// minify all js html cs from a dir and puts it on another dir
const fs = require('fs/promises');
const path = require('path');
const { minify: minifyHtml } = require('html-minifier-terser');
const { minify: minifyJs } = require('terser');
const CleanCSS = require('clean-css');

const defaultHtmlOptions = {
  removeComments: true,
  collapseWhitespace: true,
  minifyJS: true,
  minifyCSS: true,
};

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function processFile(filePath, srcDir, outDir) {
  const relPath = path.relative(srcDir, filePath);
  const destPath = path.join(outDir, relPath);
  await ensureDir(path.dirname(destPath));

  const ext = path.extname(filePath).toLowerCase();
  try {
    let content;

    if (ext === '.html' || ext === '.htm') {
      const input = await fs.readFile(filePath, 'utf8');
      content = await minifyHtml(input, defaultHtmlOptions);
      
      content = `<!-- minified by avy \u2764\uFE0F -->\n${content}`;
      await fs.writeFile(destPath, content, 'utf8');
      //console.log(`Minified HTML: ${relPath}`);

    } else if (ext === '.js') {
      const input = await fs.readFile(filePath, 'utf8');
      const { code } = await minifyJs(input);
      
      content = `// minified by avy \u2764\uFE0F\n${code}`;
      await fs.writeFile(destPath, content, 'utf8');
      //console.log(`Minified JS: ${relPath}`);

    } else if (ext === '.css') {
      const input = await fs.readFile(filePath, 'utf8');
      const output = new CleanCSS().minify(input);
      if (output.errors.length) {
        console.error(`CSS minify errors in ${relPath}:`, output.errors);
      }
      
      content = `/* minified by avy \u2764\uFE0F */\n${output.styles}`;
      await fs.writeFile(destPath, content, 'utf8');
      //console.log(`Minified CSS: ${relPath}`);

    } else {
      await fs.copyFile(filePath, destPath);
      //console.log(`Copied: ${relPath}`);
    }
  } catch (err) {
    console.error(`Error processing ${relPath}:`, err);
  }
}

async function walkDirectory(dir, srcDir, outDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkDirectory(fullPath, srcDir, outDir);
    } else if (entry.isFile()) {
      await processFile(fullPath, srcDir, outDir);
    }
  }
}

async function startMinify({ src = 'src', dest = 'dist' } = {}) {
  const srcDir = path.resolve(src);
  const outDir = path.resolve(dest);
  await fs.rm(outDir, { recursive: true, force: true });
  await ensureDir(outDir);

  console.log(`Minifying from ${srcDir} to ${outDir}`);
  await walkDirectory(srcDir, srcDir, outDir);
  console.log('Minify Done.');
}

module.exports = { startMinify };