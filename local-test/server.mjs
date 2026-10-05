import {createServer} from 'node:http';
import {randomBytes, timingSafeEqual} from 'node:crypto';
import {readFile, realpath, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {GoogleSession} from './google-session.mjs';
import {ensureResources, TEST_POLICY} from './resources.mjs';
import {Storage} from './storage.mjs';
import {ConnectionError} from './oauth-local.mjs';
import {DraftError} from '../backend-draft/storage-plan.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const textKeys = ['email','fullName','city','biography','institution','jobTitle','education','category','presentationTitle','description','social','approval'];
const valid = new Set([...textKeys, 'photo', 'requestId', 'testFixture']);
const contentTypes = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
  '.svg':'image/svg+xml','.ico':'image/x-icon','.mp4':'video/mp4','.woff2':'font/woff2'};
const safeCode = error => error instanceof ConnectionError || error instanceof DraftError ? error.code : 'LOCAL_REQUEST_FAILED';
export function sameSecret(expected, received) {
  if (typeof received !== 'string') return false;
  const a = Buffer.from(expected), b = Buffer.from(received);
  return a.length === b.length && timingSafeEqual(a, b);
}
export async function parseApplication(req, origin) {
  const type = req.headers['content-type'] || '';
  if (!/^multipart\/form-data;\s*boundary=/.test(type)) throw new ConnectionError('MULTIPART_REQUIRED');
  const limit = 768 * 1024;
  if (Number(req.headers['content-length']) > limit) throw new ConnectionError('BODY_TOO_LARGE');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new ConnectionError('BODY_TOO_LARGE');
    chunks.push(chunk);
  }
  let data;
  try { data = await new Request(`${origin}/api/test-applications`, {method:'POST', headers:{'Content-Type':type}, body:Buffer.concat(chunks)}).formData(); }
  catch { throw new ConnectionError('MULTIPART_INVALID'); }
  for (const key of data.keys()) if (!valid.has(key) || data.getAll(key).length !== 1) throw new ConnectionError('UNEXPECTED_FIELD');
  const form = Object.fromEntries(textKeys.map(key => [key, data.get(key) ?? '']));
  if (!Object.values(form).every(value => typeof value === 'string' && value.length <= 16000)) throw new ConnectionError('TEST_TEXT_TOO_LONG');
  const file = data.get('photo');
  if (!file || typeof file === 'string') throw new ConnectionError('PHOTO_REQUIRED');
  if (file.size > TEST_POLICY.maxBytesPerFile) throw new ConnectionError('FILE_SIZE');
  return {schemaVersion:1, requestId:data.get('requestId'), testFixture:data.get('testFixture') === 'true', form,
    photos:[{name:file.name, mimeType:file.type, bytes:new Uint8Array(await file.arrayBuffer())}]};
}
export async function createLocalServer({storage, config, dist = path.resolve(directory, '../dist'), port = 4188}) {
  const root = await realpath(dist);
  const client = await readFile(path.join(directory, 'client.js'));
  const csrf = randomBytes(32).toString('base64url');
  const server = createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    const origin = `http://127.0.0.1:${server.address().port}`;
    const json = (code, value) => { res.writeHead(code, {'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
    if (req.headers.host !== new URL(origin).host || !['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress) || req.headers['sec-fetch-site'] === 'cross-site') {
      json(403, {code:'LOCAL_ORIGIN_REQUIRED'}); return;
    }
    try {
      const url = new URL(req.url, origin);
      if (url.pathname === '/api/test-status' && req.method === 'GET') {
        json(200, {ready:true, mode:'local-test', csrf, testOnly:true, photoPolicy:TEST_POLICY}); return;
      }
      if (url.pathname === '/api/test-applications') {
        if (req.method !== 'POST') { json(405, {code:'POST_REQUIRED'}); return; }
        if (req.headers.origin !== origin || !sameSecret(csrf, req.headers['x-edk-csrf'])) { json(403, {code:'LOCAL_ORIGIN_REQUIRED'}); return; }
        const input = await parseApplication(req, origin);
        const receipt = await storage.submit(input);
        json(200, receipt); return;
      }
      if (!['GET','HEAD'].includes(req.method)) { json(405, {code:'GET_REQUIRED'}); return; }
      if (url.pathname === '/__edk_local_test/client.js') {
        res.writeHead(200, {'Content-Type':contentTypes['.js']}); res.end(req.method === 'HEAD' ? undefined : client); return;
      }
      const decoded = decodeURIComponent(url.pathname);
      const parts = decoded.split('/');
      if (parts.some(part => part.startsWith('.') || part.includes('\\'))) { json(404, {code:'NOT_FOUND'}); return; }
      const candidate = path.resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
      const target = await realpath(candidate).catch(() => null);
      if (!target || !target.startsWith(root + path.sep) || !(await stat(target)).isFile() || !contentTypes[path.extname(target)]) {
        json(404, {code:'NOT_FOUND'}); return;
      }
      let bytes = await readFile(target);
      if (target === path.join(root, 'index.html')) {
        bytes = Buffer.from(bytes.toString('utf8').replace('</body>', '<script src="/__edk_local_test/client.js?v=local-test-1"></script></body>'));
      }
      res.writeHead(200, {'Content-Type':contentTypes[path.extname(target)]});
      res.end(req.method === 'HEAD' ? undefined : bytes);
    } catch (error) {
      const code = safeCode(error);
      const status = code.includes('UNCONFIRMED') || code.includes('CONFLICT') ? 409 : code.startsWith('GOOGLE_') ? 502 : 400;
      if (!res.headersSent) json(status, {code, stored:false});
      else res.end();
    }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (!process.argv.includes('--use-approved-connection')) {
    process.stderr.write('EDK yerel test kapalı: mevcut onaylı bağlantı gerekli.\n'); process.exitCode = 2;
  } else {
    try {
      const session = await GoogleSession.load(true);
      const config = await ensureResources(session);
      const server = await createLocalServer({storage:new Storage(session, config), config, port:Number(process.env.EDK_LOCAL_PORT || 4188)});
      process.stdout.write(JSON.stringify({status:'ready', mode:'local-test', url:`http://127.0.0.1:${server.address().port}/`, targets:{
        root:config.testRootFolderId, photos:config.photoFolderId, spreadsheet:config.spreadsheetId, sheetId:config.sheetId, tableId:config.tableId
      }}) + '\n');
      for (const signal of ['SIGTERM','SIGINT']) process.on(signal, () => { server.closeAllConnections(); server.close(() => process.exit(0)); });
    } catch (error) { process.stderr.write(JSON.stringify({status:'failed', code:safeCode(error)}) + '\n'); process.exitCode = 1; }
  }
}
