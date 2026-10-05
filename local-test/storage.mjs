import {randomBytes, createHash} from 'node:crypto';
import {mkdir, open, rename, lstat} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {ConnectionError, PRIVATE_DIRECTORY} from './oauth-local.mjs';
import {buildStoragePlan} from '../backend-draft/storage-plan.mjs';
import {fileRequest, tableRequest, findTable, assertPrivate} from './resources.mjs';

export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const validId = id => typeof id === 'string' && /^[A-Za-z0-9_-]{8,100}$/.test(id);
export function checkPng(bytes) {
  const buffer = Buffer.from(bytes);
  if (buffer.length < 45 || !buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ||
      buffer.subarray(12,16).toString() !== 'IHDR' || buffer.subarray(-8,-4).toString() !== 'IEND')
    throw new ConnectionError('TEST_PNG_REQUIRED');
}
export class Journal {
  constructor(directory = path.join(PRIVATE_DIRECTORY, 'receipts')) { this.directory = directory; }
  async prepare() {
    await mkdir(this.directory, {recursive: true, mode: 0o700});
    const stat = await lstat(this.directory);
    if (!stat.isDirectory() || stat.isSymbolicLink() || stat.uid !== process.getuid() || (stat.mode & 0o077))
      throw new ConnectionError('PRIVATE_STORAGE_INVALID');
  }
  async get(id) {
    if (!validId(id)) throw new ConnectionError('REQUEST_ID_INVALID');
    await this.prepare();
    let h;
    try { h = await open(path.join(this.directory, `${id}.json`), constants.O_RDONLY | constants.O_NOFOLLOW); }
    catch (error) { if (error.code === 'ENOENT') return null; throw new ConnectionError('PRIVATE_STORAGE_INVALID'); }
    try {
      const stat = await h.stat();
      if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o077) || stat.size > 4096)
        throw new ConnectionError('PRIVATE_STORAGE_INVALID');
      return JSON.parse(await h.readFile('utf8'));
    } finally { await h.close(); }
  }
  async put(id, value) {
    if (!validId(id)) throw new ConnectionError('REQUEST_ID_INVALID');
    await this.prepare();
    const temp = path.join(this.directory, `.receipt-${randomBytes(12).toString('hex')}`);
    const h = await open(temp, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await h.writeFile(JSON.stringify(value)); await h.sync(); } finally { await h.close(); }
    await rename(temp, path.join(this.directory, `${id}.json`));
  }
}
export class Storage {
  constructor(session, config, journal = new Journal()) { this.session = session; this.config = config; this.journal = journal; this.queue = Promise.resolve(); }
  submit(input) {
    // A single writer also makes simultaneous double clicks idempotent.
    const pending = this.queue.then(() => this.execute(input));
    this.queue = pending.catch(() => {});
    return pending;
  }
  async preflight(plan) {
    const pairs = await Promise.all(Object.entries(plan.preflight).map(async ([key, req]) => [key, await this.session.request(req)]));
    const values = Object.fromEntries(pairs);
    values.table = findTable(values.tableMetadata, this.config);
    plan.validatePreflight(values);
    return values.table;
  }
  async rows() {
    const range = `'${this.config.sheetName.replaceAll("'", "''")}'!A2:S`;
    const data = await this.session.request({url: `https://sheets.googleapis.com/v4/spreadsheets/${this.config.spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`});
    return (data.values || []).map((row, index) => ({rowNumber: index + 2, values: Array.from({length:19}, (_, i) => row[i] ?? '')}));
  }
  findRow(rows, requestId) {
    const matches = rows.filter(row => row.values[0] === requestId);
    if (matches.length > 1) throw new ConnectionError('DUPLICATE_STORED_REQUEST');
    return matches[0];
  }
  async photo(id, bytes, requestId) {
    const file = await this.session.request(fileRequest(id));
    assertPrivate(file, id, this.config.photoFolderId);
    if (file.mimeType !== 'image/png' || file.appProperties?.edkRequestId !== requestId || file.appProperties?.edkMode !== 'test')
      throw new ConnectionError('PHOTO_ACK_UNCONFIRMED');
    const media = await this.session.request({url:`https://www.googleapis.com/drive/v3/files/${id}?alt=media`}, {binary:true});
    if (hash(media) !== hash(bytes)) throw new ConnectionError('PHOTO_BYTES_MISMATCH');
    return file;
  }
  async acknowledge(plan, input, row, write, duplicate = false) {
    const file = await this.photo(row.values[14], input.photos[0].bytes, input.requestId);
    const metadata = await this.session.request(tableRequest(this.config));
    const table = findTable(metadata, this.config);
    const receipt = plan.confirmAppend({write, rowValues: row.values, rowNumber: row.rowNumber, table}, [file], row.values[1]);
    return {...receipt, duplicate, rowNumber: row.rowNumber};
  }
  async execute(input) {
    const plan = buildStoragePlan(input, this.config);
    checkPng(input.photos[0].bytes);
    for (const text of Object.values(input.form)) if (text.length > 16000) throw new ConnectionError('TEST_TEXT_TOO_LONG');
    const fingerprint = hash(Buffer.concat([Buffer.from(JSON.stringify(input.form)), Buffer.from(input.photos[0].bytes)]));
    let entry = await this.journal.get(input.requestId);
    if (entry && entry.fingerprint !== fingerprint) throw new ConnectionError('REQUEST_ID_CONFLICT');
    await this.preflight(plan);
    const existing = this.findRow(await this.rows(), input.requestId);
    if (existing) {
      const receipt = await this.acknowledge(plan, input, existing, {spreadsheetId:this.config.spreadsheetId}, true);
      await this.journal.put(input.requestId, {fingerprint, state:'confirmed', receivedAt:existing.values[1], photoId:existing.values[14]});
      return receipt;
    }
    if (entry?.state === 'sheet-pending' || entry?.state === 'confirmed') throw new ConnectionError('SHEET_WRITE_UNCONFIRMED');
    entry ||= {fingerprint, state:'new', receivedAt:new Date().toISOString()};
    let file;
    if (entry.photoId) file = await this.photo(entry.photoId, input.photos[0].bytes, input.requestId);
    else {
      if (entry.state === 'upload-pending') throw new ConnectionError('PHOTO_UPLOAD_UNCONFIRMED');
      entry.state = 'upload-pending';
      await this.journal.put(input.requestId, entry);
      const upload = plan.uploads[0];
      const boundary = `edk_${randomBytes(18).toString('hex')}`;
      const body = Buffer.concat([
        Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(upload.metadata)}\r\n--${boundary}\r\nContent-Type: image/png\r\n\r\n`),
        Buffer.from(upload.media.bytes), Buffer.from(`\r\n--${boundary}--\r\n`)
      ]);
      const created = await this.session.request({url:upload.url, method:'POST', body, headers:{'Content-Type':`multipart/related; boundary=${boundary}`}});
      if (!created.id) throw new ConnectionError('PHOTO_ACK_UNCONFIRMED');
      // Save the known ID before readback so recovery never creates another photo.
      entry.photoId = created.id;
      entry.state = 'photo-created';
      await this.journal.put(input.requestId, entry);
      file = await this.photo(created.id, input.photos[0].bytes, input.requestId);
    }
    const append = plan.createSheetAppend([file], entry.receivedAt);
    entry.state = 'sheet-pending';
    await this.journal.put(input.requestId, entry);
    const write = await this.session.json(append.url, 'POST', append.body);
    const row = this.findRow(await this.rows(), input.requestId);
    if (!row) throw new ConnectionError('SHEET_ACK_UNCONFIRMED');
    if (JSON.stringify(row.values) !== JSON.stringify(append.expectedRow)) throw new ConnectionError('SHEET_ACK_UNCONFIRMED');
    const receipt = await this.acknowledge(plan, input, row, write);
    entry.state = 'confirmed';
    await this.journal.put(input.requestId, entry);
    return receipt;
  }
}
