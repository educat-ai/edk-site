import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {get as httpGet} from 'node:http';
import {Storage} from './storage.mjs';
import {createLocalServer} from './server.mjs';
import {ConnectionError} from './oauth-local.mjs';
import {COLUMNS} from '../backend-draft/storage-plan.mjs';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j8zEAAAAASUVORK5CYII=','base64');
const config = {mode:'test-draft',ownerEmail:'erencnr@gmail.com',testRootFolderId:'root',photoFolderId:'photos',spreadsheetId:'sheet',
  sheetName:'Başvurular',sheetId:0,tableId:'123',tableName:'EDK_Test_Basvurular',privacyTextVersion:'test-v1',
  uploadPolicy:{maxFiles:1,maxBytesPerFile:512*1024,allowedMimeTypes:['image/png']}};
function application(id = `EDK-TEST-${randomUUID()}`) {
  return {schemaVersion:1,requestId:id,testFixture:true,form:{email:'deneme@example.test',fullName:'Örnek Kişi',city:'Örnek Şehir',
    biography:'Örnek özgeçmiş',institution:'Örnek Kurum',jobTitle:'Örnek Görev',education:'İlkokul',category:'Örnek kategori',
    presentationTitle:'=1+1',description:'Örnek açıklama',social:'',approval:'Onaylıyorum'},photos:[{name:'test.png',mimeType:'image/png',bytes:png}]};
}
function resource(id,mimeType,parent) {
  return {id,mimeType,trashed:false,parents:parent?[parent]:[],owners:[{emailAddress:config.ownerEmail}],
    permissions:[{type:'user',role:'owner',emailAddress:config.ownerEmail}]};
}
class MemoryJournal {
  entries = new Map();
  async get(id) { return structuredClone(this.entries.get(id) || null); }
  async put(id, value) { this.entries.set(id,structuredClone(value)); }
}
class FakeGoogle {
  calls = []; writes = 0; uploads = 0; rows = []; files = new Map();
  // Real Sheets omits default zero sheetId from table ranges.
  table = {tableId:'123',name:config.tableName,range:{startRowIndex:0,startColumnIndex:0,endColumnIndex:19,endRowIndex:2}};
  async request(req, options = {}) {
    this.calls.push({url:req.url,method:req.method||'GET'});
    const url = new URL(req.url);
    if (url.pathname.endsWith('/about')) return {user:{emailAddress:config.ownerEmail}};
    if (url.pathname.includes('/values/')) {
      if (decodeURIComponent(url.pathname).endsWith('A1:S1')) return {values:[[...COLUMNS]]};
      return {values:structuredClone(this.rows)};
    }
    if (url.hostname === 'sheets.googleapis.com') return {spreadsheetId:'sheet',sheets:[{properties:{sheetId:0,title:'Başvurular'},tables:[structuredClone(this.table)]}]};
    if (req.method === 'POST') {
      this.uploads++;
      const body = Buffer.from(req.body);
      const boundary = req.headers['Content-Type'].split('boundary=')[1];
      const text = body.toString();
      const start = text.indexOf('\r\n\r\n')+4, end = text.indexOf(`\r\n--${boundary}`, start);
      const metadata = JSON.parse(text.slice(start,end));
      const mediaStart = body.indexOf('\r\n\r\n',end+4)+4;
      const mediaEnd = body.indexOf(`\r\n--${boundary}--`,mediaStart);
      const id = `photo-${this.uploads}`;
      const file = {...resource(id,'image/png','photos'),appProperties:metadata.appProperties};
      this.files.set(id,{file,bytes:body.subarray(mediaStart,mediaEnd)});
      if (this.failUpload) throw new ConnectionError('GOOGLE_REQUEST_UNCONFIRMED');
      return file;
    }
    const id = url.pathname.split('/').at(-1);
    if (this.files.has(id)) return options.binary ? Buffer.from(this.files.get(id).bytes) : structuredClone(this.files.get(id).file);
    if (id === 'root') return resource(id,'application/vnd.google-apps.folder');
    if (id === 'photos') {
      const folder = resource(id,'application/vnd.google-apps.folder','root');
      if (this.shared) folder.permissions.push({type:'anyone',role:'reader'});
      return folder;
    }
    if (id === 'sheet') return resource(id,'application/vnd.google-apps.spreadsheet','root');
    throw new Error('Unexpected fake request');
  }
  async json(url,method,body) {
    this.writes++;
    const append = body.requests[0].appendCells;
    assert.equal(append.tableId,'123');
    assert.equal(append.rows[0].values[12].userEnteredValue.stringValue,'=1+1');
    const row = append.rows[0].values.map(cell => cell.userEnteredValue.boolValue ?? cell.userEnteredValue.stringValue);
    if (this.corruptRow) row[3] = 'changed@example.test';
    this.rows.push(row);
    if (!this.shortRange) this.table.range.endRowIndex = Math.max(2,this.rows.length+1);
    if (this.failWrite) throw new ConnectionError('GOOGLE_REQUEST_UNCONFIRMED');
    return {spreadsheetId:'sheet'};
  }
}
const rejected = (promise, code) => assert.rejects(promise, e => e.code === code);
test('actual adapter workflow verifies private PNG bytes, 19 values, table range and literal formula-like text',async()=>{
  const google = new FakeGoogle();
  const storage = new Storage(google,config,new MemoryJournal());
  const a = application();
  assert.equal((await storage.submit(a)).stored,true);
  assert.equal((await storage.submit(application())).rowNumber,3);
  assert.equal(google.uploads,2); assert.equal(google.writes,2); assert.equal(google.table.range.endRowIndex,3);
  assert.equal(google.rows[0].length,19); assert.equal(google.rows[0][2],true); assert.equal(google.rows[0][12],'=1+1');
});
test('concurrent double-click and retry after server restart reuse exactly one photo and one row',async()=>{
  const google = new FakeGoogle(), journal = new MemoryJournal(), a = application();
  const storage = new Storage(google,config,journal);
  const receipts = await Promise.all([storage.submit(a),storage.submit(a)]);
  assert.equal(receipts[0].duplicate,false); assert.equal(receipts[1].duplicate,true);
  assert.equal((await new Storage(google,config,journal).submit(a)).duplicate,true);
  assert.equal(google.uploads,1); assert.equal(google.writes,1);
  const changed = application(a.requestId); changed.form.city = 'Farklı';
  await rejected(storage.submit(changed),'REQUEST_ID_CONFLICT');
  assert.equal(google.writes,1);
});
test('lost upload acknowledgment cannot report success or trigger another upload on retry',async()=>{
  const google = new FakeGoogle(); google.failUpload = true;
  const storage = new Storage(google,config,new MemoryJournal()), a = application();
  await rejected(storage.submit(a),'GOOGLE_REQUEST_UNCONFIRMED');
  await rejected(storage.submit(a),'PHOTO_UPLOAD_UNCONFIRMED');
  assert.equal(google.uploads,1); assert.equal(google.writes,0);
});
test('lost Sheet acknowledgment is recovered by full readback without another append',async()=>{
  const google = new FakeGoogle(); google.failWrite = true;
  const storage = new Storage(google,config,new MemoryJournal()), a = application();
  await rejected(storage.submit(a),'GOOGLE_REQUEST_UNCONFIRMED');
  assert.equal((await storage.submit(a)).duplicate,true);
  assert.equal(google.uploads,1); assert.equal(google.writes,1);
});
test('wrong row, short table range or changed photo cannot be reported as saved',async()=>{
  let google = new FakeGoogle(); google.corruptRow = true;
  let storage = new Storage(google,config,new MemoryJournal()), a = application();
  await rejected(storage.submit(a),'SHEET_ACK_UNCONFIRMED');
  await rejected(storage.submit(a),'SHEET_ACK_UNCONFIRMED');
  assert.equal(google.writes,1);
  google = new FakeGoogle(); google.shortRange = true;
  storage = new Storage(google,config,new MemoryJournal());
  await storage.submit(application());
  await rejected(storage.submit(application()),'TABLE_RANGE_UNCONFIRMED');
  google = new FakeGoogle(); storage = new Storage(google,config,new MemoryJournal()); a = application();
  await storage.submit(a);
  google.files.get('photo-1').bytes = Buffer.from('changed');
  await rejected(storage.submit(a),'PHOTO_BYTES_MISMATCH');
});
test('shared resource and invalid dummy inputs stop before Google writes',async()=>{
  let google = new FakeGoogle(); google.shared = true;
  await rejected(new Storage(google,config,new MemoryJournal()).submit(application()),'TARGET_NOT_OWNER_ONLY');
  assert.equal(google.writes,0); assert.equal(google.uploads,0);
  google = new FakeGoogle(); const storage = new Storage(google,config,new MemoryJournal());
  let a = application(); a.form.email = 'real@example.com';
  await rejected(storage.submit(a),'TEST_EMAIL_REQUIRED');
  a = application(); a.photos[0].bytes = Buffer.from('<svg></svg>');
  await rejected(storage.submit(a),'TEST_PNG_REQUIRED');
  a = application(); a.form.approval = '';
  await rejected(storage.submit(a),'REQUIRED_FIELD');
  assert.equal(google.calls.length,0);
});
test('loopback HTTP protects same-origin POST, CSRF, credentials and traversal; correctly parses a real multipart request',async()=>{
  const temporary = await mkdtemp(path.join(os.tmpdir(),'edk-local-http-'));
  await writeFile(path.join(temporary,'index.html'),'<html><body>Fixture</body></html>');
  const submissions = [];
  const storage = {submit:async input => {submissions.push(input); return {kind:'storage-acknowledged-test-receipt',stored:true,requestId:input.requestId};}};
  const server = await createLocalServer({storage,config,dist:temporary,port:0});
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    const response = await fetch(origin+'/');
    assert.equal(response.status,200); assert.ok((await response.text()).includes('/__edk_local_test/client.js'));
    const state = await (await fetch(origin+'/api/test-status')).json();
    assert.equal(state.ready,true); assert.equal('accessToken' in state,false);
    const wrongHost = await new Promise((resolve,reject) => {
      httpGet(origin+'/api/test-status',{headers:{Host:'evil.example'}},response => { response.resume(); resolve(response.statusCode); }).on('error',reject);
    });
    assert.equal(wrongHost,403);
    for (const endpoint of ['/local-test/oauth-local.mjs','/../connection.json','/%2e%2e/connection.json','/api/test-applications'])
      assert.notEqual((await fetch(origin+endpoint)).status,200);
    const a = application();
    const data = new FormData();
    Object.entries(a.form).forEach(([key,value])=>data.set(key,value));
    data.set('requestId',a.requestId); data.set('testFixture','true');
    data.set('photo',new Blob([png],{type:'image/png'}),'test.png');
    assert.equal((await fetch(origin+'/api/test-applications',{method:'POST',body:data,headers:{Origin:origin}})).status,403);
    assert.equal((await fetch(origin+'/api/test-applications',{method:'POST',body:data,headers:{Origin:'https://evil.example','X-EDK-CSRF':state.csrf}})).status,403);
    const posted = await fetch(origin+'/api/test-applications',{method:'POST',body:data,headers:{Origin:origin,'X-EDK-CSRF':state.csrf}});
    assert.equal(posted.status,200); assert.equal(submissions.length,1); assert.deepEqual(submissions[0].form,a.form);
    assert.deepEqual(Buffer.from(submissions[0].photos[0].bytes),png);
    data.set('unknown','value');
    assert.equal((await fetch(origin+'/api/test-applications',{method:'POST',body:data,headers:{Origin:origin,'X-EDK-CSRF':state.csrf}})).status,400);
    assert.equal(submissions.length,1);
  } finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); await rm(temporary,{recursive:true}); }
});
