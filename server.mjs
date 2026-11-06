import http from 'node:http';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = path.dirname(fileURLToPath(import.meta.url));
const pagesPrefix = '/art-hackathon';
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};
const privateDirectories = new Set(['scripts', 'tests', 'node_modules', 'private']);

export function createStaticServer(root = repositoryRoot) {
  root = path.resolve(root);
  return http.createServer(async (req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end('Method not allowed');
        return;
      }

      const queryIndex = req.url.indexOf('?');
      const rawPath = queryIndex === -1 ? req.url : req.url.slice(0, queryIndex);
      const query = queryIndex === -1 ? '' : req.url.slice(queryIndex);
      // Check before URL normalization can erase a traversal segment.
      let pathname = decodeURIComponent(rawPath);
      if (!pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('\\') ||
          pathname.split('/').some(part => part.startsWith('.') || privateDirectories.has(part))) {
        throw new Error('Private path');
      }
      if (pathname === pagesPrefix) pathname = '/';
      else if (pathname.startsWith(`${pagesPrefix}/`)) pathname = pathname.slice(pagesPrefix.length);

      let file = path.resolve(root, `.${pathname}`);
      if (file !== root && !file.startsWith(`${root}${path.sep}`)) throw new Error('Outside root');
      const isDirectory = (await stat(file)).isDirectory();
      if (isDirectory) {
        file = path.join(file, 'index.html');
      }
      const contentType = mime[path.extname(file).toLowerCase()];
      if (!contentType || /^package(?:-lock)?\.json$/.test(path.basename(file)) || !(await stat(file)).isFile()) {
        throw new Error('Not a public file');
      }
      const [realRoot, realFile] = await Promise.all([realpath(root), realpath(file)]);
      if (!realFile.startsWith(`${realRoot}${path.sep}`)) throw new Error('Outside root');

      if (isDirectory && !rawPath.endsWith('/')) {
        res.writeHead(301, { Location: `${rawPath}/${query}` });
        res.end();
        return;
      }
      const body = req.method === 'HEAD' ? undefined : await readFile(file);
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 5173);
  createStaticServer().listen(port, '127.0.0.1', () => console.log(`Art Hackathon — http://127.0.0.1:${port}`));
}
