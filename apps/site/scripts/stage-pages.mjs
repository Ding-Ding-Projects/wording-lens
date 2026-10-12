import {
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const siteRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function normalizeBasePath(basePath = '') {
  if (basePath === '' || basePath === '/') return '';
  if (!/^\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*$/u.test(basePath)) {
    throw new Error(`Unsupported Pages base path: ${basePath}`);
  }
  return basePath;
}

function isWithin(root, candidate) {
  const path = relative(root, candidate);
  return (
    path === '' ||
    (!isAbsolute(path) && path !== '..' && !path.startsWith(`..${sep}`))
  );
}

async function assertRegularTree(root) {
  const metadata = await lstat(root);
  if (metadata.isDirectory()) {
    for (const entry of await readdir(root))
      await assertRegularTree(resolve(root, entry));
  } else if (!metadata.isFile()) {
    throw new Error(
      `Pages artifacts cannot include symbolic links or special files: ${root}`,
    );
  }
}

/** Check local resources against the URL mount used by project Pages. */
export async function validateResources(root, basePath = '') {
  const prefix = `${normalizeBasePath(basePath)}/`;
  let resources = 0;
  let scripts = 0;
  let styles = 0;
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) await visit(path);
      else if (entry.name.endsWith('.html')) {
        const documentPath = relative(root, path).split(sep).join('/');
        const html = await readFile(path, 'utf8');
        for (const match of html.matchAll(
          /<(script|link|img|source)\b[^>]*>/giu,
        )) {
          const attributes = Object.fromEntries(
            [...match[0].matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/gu)].map(
              (attribute) => [attribute[1].toLowerCase(), attribute[2]],
            ),
          );
          const tag = match[1].toLowerCase();
          if (
            tag === 'link' &&
            !/^(?:stylesheet|modulepreload|preload|icon|shortcut icon|apple-touch-icon)$/iu.test(
              attributes.rel ?? '',
            )
          )
            continue;
          const reference = tag === 'link' ? attributes.href : attributes.src;
          if (!reference || /^(?:data:|https?:\/\/|\/\/)/iu.test(reference))
            continue;
          const url = new URL(
            reference.replaceAll('&amp;', '&'),
            `https://pages.invalid${prefix}${documentPath}`,
          );
          if (
            url.origin !== 'https://pages.invalid' ||
            !url.pathname.startsWith(prefix)
          ) {
            throw new Error(
              `Resource escapes the Pages base path in ${documentPath}: ${reference}`,
            );
          }
          const resource = resolve(
            root,
            decodeURIComponent(url.pathname.slice(prefix.length)),
          );
          if (!isWithin(root, resource))
            throw new Error(
              `Resource escapes the Pages artifact: ${reference}`,
            );
          const metadata = await stat(resource).catch(() => null);
          if (!metadata?.isFile() || metadata.size === 0)
            throw new Error(
              `Missing or empty Pages resource in ${documentPath}: ${reference}`,
            );
          resources++;
          if (tag === 'script') scripts++;
          if (tag === 'link' && attributes.rel === 'stylesheet') styles++;
        }
      }
    }
  }
  await visit(root);
  if (!scripts || !styles)
    throw new Error(
      'The Pages export must include JavaScript and stylesheet resources.',
    );
  return resources;
}

export async function stagePages({ sourceRoot, outputRoot, basePath = '' }) {
  const prefix = normalizeBasePath(basePath);
  const source = resolve(sourceRoot);
  const output = resolve(outputRoot);
  if (isWithin(source, output) || isWithin(output, source)) {
    throw new Error('Pages source and staging directories must not overlap.');
  }
  const exportRoot = resolve(source, `.${prefix}`);
  const index = resolve(exportRoot, 'index.html');
  const metadata = await stat(index).catch(() => null);
  if (!metadata?.isFile() || metadata.size === 0)
    throw new Error(
      `The site build did not produce the base-path document: ${index}`,
    );
  await assertRegularTree(exportRoot);
  const fallbacks = [];
  if (prefix) {
    for (const name of ['404.html', '404']) {
      const path = resolve(source, name);
      if (await lstat(path).catch(() => null)) {
        await assertRegularTree(path);
        fallbacks.push(path);
      }
    }
  }
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  await cp(exportRoot, output, { recursive: true });
  for (const path of fallbacks)
    await cp(path, resolve(output, relative(source, path)), {
      recursive: true,
    });
  await writeFile(resolve(output, '.nojekyll'), '');
  const resources = await validateResources(output, prefix);
  return { outputRoot: output, basePath: prefix, resources };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const result = await stagePages({
    sourceRoot: resolve(siteRoot, 'dist/client'),
    outputRoot: resolve(siteRoot, 'dist/pages'),
    basePath: process.env.SITE_BASE_PATH ?? '',
  });
  console.log(
    `Staged Pages artifact with ${result.resources} local resource references for ${result.basePath || '/'}.`,
  );
}
