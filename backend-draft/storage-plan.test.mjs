import test from 'node:test';
import assert from 'node:assert/strict';
import {buildStoragePlan, COLUMNS} from './storage-plan.mjs';

// Only mocked objects and invented data. No token, real target or HTTP request.
const config = {
  mode:'test-draft',ownerEmail:'erencnr@gmail.com',spreadsheetId:'fixture-sheet',
  photoFolderId:'fixture-folder',sheetName:'Örnek Başvurular',
  testRootFolderId:'fixture-root',sheetId:1,tableId:'fixture-table',tableName:'Fixture_Table',privacyTextVersion:'fixture-text-v1',
  // Test harness limits only; these are not approved production form rules.
  uploadPolicy:{maxFiles:2,maxBytesPerFile:10,allowedMimeTypes:['image/png']}
};
function application() {
  return {schemaVersion:1,requestId:'fixture-request-0001',testFixture:true,
    form:{email:'ornek@example.test',fullName:'Örnek Kişi',city:'Örnek Şehir',
      biography:'Örnek özgeçmiş',institution:'Örnek Kurum',jobTitle:'Örnek Görev',
      education:'İlkokul',category:'Serbest kategori',presentationTitle:'Örnek Sunum',
      description:'Örnek açıklama',social:'',approval:'Onaylıyorum'},
    photos:[{name:'ornek.png',mimeType:'image/png',bytes:new Uint8Array([1,2,3])}]};
}
function resource(id,mimeType,parents=[]) {
  return {id,mimeType,parents,trashed:false,owners:[{emailAddress:config.ownerEmail}],
    permissions:[{type:'user',role:'owner',emailAddress:config.ownerEmail}]};
}
function preflight() {
  return {identity:{user:{emailAddress:config.ownerEmail}},
    root:resource(config.testRootFolderId,'application/vnd.google-apps.folder'),
    folder:resource(config.photoFolderId,'application/vnd.google-apps.folder',[config.testRootFolderId]),
    spreadsheet:resource(config.spreadsheetId,'application/vnd.google-apps.spreadsheet',[config.testRootFolderId]),
    headers:{values:[[...COLUMNS]]},table:{tableId:config.tableId,name:config.tableName,
      range:{sheetId:config.sheetId,startColumnIndex:0,startRowIndex:0,endColumnIndex:19,endRowIndex:2}}};
}
const files=()=>[resource('fixture-photo','image/png',[config.photoFolderId])];
function throwsCode(action,code) { assert.throws(action,error=>error.code===code); }

test('disabled, missing targets and unconfirmed upload rules fail before any plan exists',()=>{
  throwsCode(()=>buildStoragePlan(application(),{...config,mode:'disabled'}),'BACKEND_DISABLED');
  throwsCode(()=>buildStoragePlan(application(),{...config,spreadsheetId:null}),'TARGETS_UNCONFIRMED');
  throwsCode(()=>buildStoragePlan(application(),{...config,uploadPolicy:null}),'UPLOAD_POLICY_UNCONFIRMED');
});
test('test draft refuses non-test email and missing fixture declaration',()=>{
  let a=application();a.form.email='person@example.com';
  throwsCode(()=>buildStoragePlan(a,config),'TEST_EMAIL_REQUIRED');
  a=application();a.testFixture=false;
  throwsCode(()=>buildStoragePlan(a,config),'TEST_FIXTURE_REQUIRED');
});
test('required fields, education, approval and file input are validated',()=>{
  let a=application();a.form.category=' ';
  throwsCode(()=>buildStoragePlan(a,config),'REQUIRED_FIELD');
  a=application();a.form.education='Üniversite';
  throwsCode(()=>buildStoragePlan(a,config),'EDUCATION_INVALID');
  a=application();a.form.approval='Evet';
  throwsCode(()=>buildStoragePlan(a,config),'APPROVAL_REQUIRED');
  a=application();a.photos=[];
  throwsCode(()=>buildStoragePlan(a,config),'PHOTO_REQUIRED');
  a=application();a.photos[0].bytes=new Uint8Array(11);
  throwsCode(()=>buildStoragePlan(a,config),'FILE_SIZE');
});
test('preflight requires expected owner, owner-only targets and exact column mapping',()=>{
  const plan=buildStoragePlan(application(),config);
  assert.equal(plan.validatePreflight(preflight()),true);
  let p=preflight();p.identity.user.emailAddress='other@example.test';
  throwsCode(()=>plan.validatePreflight(p),'OWNER_MISMATCH');
  p=preflight();p.folder.permissions.push({type:'anyone',role:'reader'});
  throwsCode(()=>plan.validatePreflight(p),'TARGET_NOT_OWNER_ONLY');
  p=preflight();p.headers.values[0][0]='Başka Başlık';
  throwsCode(()=>plan.validatePreflight(p),'HEADER_MISMATCH');
});
test('upload plan has only the configured private parent and no sharing operation',()=>{
  const plan=buildStoragePlan(application(),config);
  assert.deepEqual(plan.uploads[0].metadata.parents,[config.photoFolderId]);
  assert.equal(plan.uploads[0].metadata.appProperties.edkMode,'test');
  assert.equal(plan.kind,'unexecuted-test-storage-plan');
  assert.equal(plan.stored,undefined);
  assert.ok(!JSON.stringify(plan).includes('permissions.create'));
});
test('native table payload has 19 exact columns and uses literal strings for formula-like text',()=>{
  const a=application();a.form.presentationTitle='=1+1';
  const plan=buildStoragePlan(a,config);
  const append=plan.createSheetAppend(files(),'2026-10-03T18:00:00.000Z');
  const cells=append.body.requests[0].appendCells;
  assert.equal(cells.tableId,config.tableId);
  assert.equal(cells.rows[0].values.length,19);
  assert.deepEqual(cells.rows[0].values[12].userEnteredValue,{stringValue:'=1+1'});
  assert.equal(append.expectedRow[16],'');
  assert.equal(append.expectedRow[2],true);
});
test('upload failures or partial Sheet acknowledgment cannot become success',()=>{
  const plan=buildStoragePlan(application(),config);
  const time='2026-10-03T18:00:00.000Z';
  throwsCode(()=>plan.createSheetAppend([],'2026-10-03T18:00:00Z'),'PHOTO_ACK_UNCONFIRMED');
  throwsCode(()=>plan.confirmAppend({write:{spreadsheetId:config.spreadsheetId}},files(),time),'SHEET_ACK_UNCONFIRMED');
  const response={write:{spreadsheetId:config.spreadsheetId},rowNumber:3,
    rowValues:plan.createSheetAppend(files(),time).expectedRow,table:preflight().table};
  throwsCode(()=>plan.confirmAppend(response,files(),time),'TABLE_RANGE_UNCONFIRMED');
  response.table.range.endRowIndex=3;
  const ack=plan.confirmAppend(response,files(),time);
  assert.deepEqual(ack,{kind:'storage-acknowledged-test-receipt',requestId:'fixture-request-0001',stored:true});
  assert.equal('photoIds' in ack,false);
});
