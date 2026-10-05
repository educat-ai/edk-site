// Server-side draft only. This module makes no HTTP requests, starts no server,
// reads no credentials and is not imported by the EDK frontend.
export const COLUMNS = Object.freeze([
  'application_id', 'submitted_at', 'test_record', 'email', 'privacy_acknowledgement',
  'full_name', 'city', 'biography', 'organization', 'job_title', 'education_level',
  'proposal_category', 'presentation_title', 'presentation_description',
  'profile_photo_file_id', 'profile_photo_url', 'social_media', 'privacy_text_version', 'record_origin'
]);
const required = ['email', 'fullName', 'city', 'biography', 'institution',
  'jobTitle', 'education', 'category', 'presentationTitle', 'description', 'approval'];
const education = ['Ana Sınıfı', 'İlkokul', 'Ortaokul', 'Lise'];
const textKeys = [...required, 'social'];
const expectedOwner = 'erencnr@gmail.com';

export class DraftError extends Error {
  constructor(code) { super(code); this.name = 'DraftError'; this.code = code; }
}
function requireCondition(condition, code) {
  if (!condition) throw new DraftError(code);
}
function nonempty(value) { return typeof value === 'string' && value.trim().length > 0; }
function assertPrivate(resource, ownerEmail, expectedId) {
  requireCondition(resource?.id === expectedId && resource.trashed !== true, 'TARGET_MISMATCH');
  requireCondition(resource.owners?.length === 1 && resource.owners[0].emailAddress === ownerEmail, 'OWNER_MISMATCH');
  requireCondition(resource.permissions?.length === 1 && resource.permissions[0].type === 'user' &&
    resource.permissions[0].role === 'owner' && resource.permissions[0].emailAddress === ownerEmail, 'TARGET_NOT_OWNER_ONLY');
}
function verifyConfig(config) {
  // Even a configured draft cannot submit: it only produces an unexecuted plan.
  requireCondition(config?.mode === 'test-draft', 'BACKEND_DISABLED');
  requireCondition(config.ownerEmail === expectedOwner, 'OWNER_MISMATCH');
  requireCondition(nonempty(config.spreadsheetId) && nonempty(config.photoFolderId) &&
    nonempty(config.testRootFolderId) && nonempty(config.sheetName) && Number.isSafeInteger(config.sheetId) &&
    nonempty(config.tableId) && nonempty(config.tableName) && nonempty(config.privacyTextVersion), 'TARGETS_UNCONFIRMED');
  const policy = config.uploadPolicy;
  requireCondition(policy && Number.isSafeInteger(policy.maxFiles) && policy.maxFiles > 0 &&
    Number.isSafeInteger(policy.maxBytesPerFile) && policy.maxBytesPerFile > 0 &&
    Array.isArray(policy.allowedMimeTypes) && policy.allowedMimeTypes.length > 0 &&
    policy.allowedMimeTypes.every(nonempty), 'UPLOAD_POLICY_UNCONFIRMED');
}
function validate(input, config) {
  requireCondition(input?.schemaVersion === 1, 'SCHEMA_MISMATCH');
  requireCondition(nonempty(input.requestId) && /^[A-Za-z0-9_-]{8,100}$/.test(input.requestId), 'REQUEST_ID_INVALID');
  requireCondition(input.testFixture === true, 'TEST_FIXTURE_REQUIRED');
  const form = input.form;
  requireCondition(form && typeof form === 'object' && !Array.isArray(form), 'FORM_REQUIRED');
  requireCondition(Object.keys(form).every(key => textKeys.includes(key)), 'UNEXPECTED_FIELD');
  const values = Object.fromEntries(textKeys.map(key => [key, typeof form[key] === 'string' ? form[key].trim() : '']));
  requireCondition(required.every(key => nonempty(values[key])), 'REQUIRED_FIELD');
  requireCondition(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email), 'EMAIL_INVALID');
  requireCondition(/\.(test|invalid)$/i.test(values.email.split('@')[1]), 'TEST_EMAIL_REQUIRED');
  requireCondition(education.includes(values.education), 'EDUCATION_INVALID');
  requireCondition(values.approval === 'Onaylıyorum', 'APPROVAL_REQUIRED');
  const photos = input.photos;
  requireCondition(Array.isArray(photos) && photos.length > 0, 'PHOTO_REQUIRED');
  // This particular storage fixture has one photo ID/URL column. This does not
  // define the still-unconfirmed production form file-count policy.
  requireCondition(photos.length === 1, 'TEST_SINGLE_PHOTO_ONLY');
  requireCondition(photos.length <= config.uploadPolicy.maxFiles, 'FILE_COUNT');
  photos.forEach(file => {
    requireCondition(nonempty(file.name) && config.uploadPolicy.allowedMimeTypes.includes(file.mimeType), 'FILE_TYPE');
    requireCondition(file.bytes instanceof Uint8Array && file.bytes.byteLength > 0 &&
      file.bytes.byteLength <= config.uploadPolicy.maxBytesPerFile, 'FILE_SIZE');
  });
  return {values, photos};
}

export function buildStoragePlan(input, config) {
  verifyConfig(config);
  const {values, photos} = validate(input, config);
  const target = {...config};
  const requestId = input.requestId;
  const quoteSheet = `'${target.sheetName.replaceAll("'", "''")}'`;
  const metadataFields = 'id,mimeType,trashed,parents,owners(emailAddress),permissions(type,role,emailAddress)';
  const fileInfo = id => ({method:'GET',url:`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(metadataFields)}`});
  return {
    kind: 'unexecuted-test-storage-plan',
    requestId,
    target: {ownerEmail:target.ownerEmail, spreadsheetId:target.spreadsheetId, photoFolderId:target.photoFolderId, sheetName:target.sheetName, sheetId:target.sheetId, tableId:target.tableId},
    // These are server requests after owner OAuth approval, never browser requests.
    preflight: {
      identity: {method:'GET',url:'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)'},
      folder: fileInfo(target.photoFolderId),
      root: fileInfo(target.testRootFolderId),
      spreadsheet: fileInfo(target.spreadsheetId),
      headers: {method:'GET',url:`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(target.spreadsheetId)}/values/${encodeURIComponent(`${quoteSheet}!A1:S1`)}`},
      tableMetadata: {method:'GET',url:`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(target.spreadsheetId)}?fields=${encodeURIComponent('spreadsheetId,sheets(properties(sheetId,title),tables(tableId,name,range))')}`}
    },
    validatePreflight({identity, root, folder, spreadsheet, headers, table}) {
      requireCondition(identity?.user?.emailAddress === target.ownerEmail, 'OWNER_MISMATCH');
      assertPrivate(folder, target.ownerEmail, target.photoFolderId);
      assertPrivate(root, target.ownerEmail, target.testRootFolderId);
      assertPrivate(spreadsheet, target.ownerEmail, target.spreadsheetId);
      requireCondition(folder.parents?.includes(target.testRootFolderId) &&
        spreadsheet.parents?.includes(target.testRootFolderId), 'TARGET_PARENT_MISMATCH');
      requireCondition(folder.mimeType === 'application/vnd.google-apps.folder' &&
        spreadsheet.mimeType === 'application/vnd.google-apps.spreadsheet', 'TARGET_TYPE');
      requireCondition(JSON.stringify(headers?.values?.[0]) === JSON.stringify(COLUMNS), 'HEADER_MISMATCH');
      requireCondition(table?.tableId === target.tableId && table.name === target.tableName &&
        table.range?.sheetId === target.sheetId && (table.range.startRowIndex || 0) === 0 &&
        (table.range.startColumnIndex || 0) === 0 && table.range.endColumnIndex === 19, 'TABLE_MISMATCH');
      return true;
    },
    uploads: photos.map((photo, index) => ({
      method:'POST',
      url:`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${encodeURIComponent(metadataFields)}`,
      // A future server adapter must encode these two parts as multipart/related.
      metadata: {name:`${requestId}-profile-${index + 1}`,mimeType:photo.mimeType,parents:[target.photoFolderId],appProperties:{edkRequestId:requestId,edkMode:'test'}},
      media: {mimeType:photo.mimeType,bytes:photo.bytes}
    })),
    createSheetAppend(createdFiles, receivedAtUtc) {
      requireCondition(Array.isArray(createdFiles) && createdFiles.length === photos.length, 'PHOTO_ACK_UNCONFIRMED');
      requireCondition(new Set(createdFiles.map(file => file.id)).size === photos.length, 'PHOTO_ACK_UNCONFIRMED');
      createdFiles.forEach(file => {
        requireCondition(nonempty(file.id) && file.parents?.length === 1 && file.parents[0] === target.photoFolderId, 'PHOTO_ACK_UNCONFIRMED');
        assertPrivate(file, target.ownerEmail, file.id);
      });
      requireCondition(nonempty(receivedAtUtc) && Number.isFinite(Date.parse(receivedAtUtc)) && receivedAtUtc.endsWith('Z'), 'TIMESTAMP_INVALID');
      const photoId = createdFiles[0].id;
      const row = [requestId, receivedAtUtc, true, values.email, values.approval, values.fullName,
        values.city, values.biography, values.institution, values.jobTitle, values.education,
        values.category, values.presentationTitle, values.description, photoId,
        `https://drive.google.com/file/d/${encodeURIComponent(photoId)}/view`, values.social,
        target.privacyTextVersion, 'EDK_LOCAL_BACKEND_TEST'];
      return {
        method:'POST',
        url:`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(target.spreadsheetId)}:batchUpdate`,
        // Native table append expands the table body. Explicit stringValue
        // prevents formula interpretation, without changing user text.
        expectedRow:row,
        body:{requests:[{appendCells:{tableId:target.tableId,fields:'userEnteredValue',
          rows:[{values:row.map(value=>({userEnteredValue:typeof value==='boolean'?{boolValue:value}:{stringValue:value}}))}]}}]}
      };
    },
    confirmAppend(response, createdFiles, receivedAtUtc) {
      // Revalidate the file acknowledgments before accepting a Sheet acknowledgment.
      const append = this.createSheetAppend(createdFiles, receivedAtUtc);
      const table = response?.table;
      requireCondition(response?.write?.spreadsheetId === target.spreadsheetId &&
        JSON.stringify(response.rowValues) === JSON.stringify(append.expectedRow) &&
        Number.isSafeInteger(response.rowNumber) && response.rowNumber > 1, 'SHEET_ACK_UNCONFIRMED');
      requireCondition(table?.tableId === target.tableId && table.name === target.tableName &&
        table.range?.sheetId === target.sheetId && (table.range.startRowIndex || 0) === 0 &&
        (table.range.startColumnIndex || 0) === 0 && table.range.endColumnIndex === 19 &&
        table.range.endRowIndex >= response.rowNumber, 'TABLE_RANGE_UNCONFIRMED');
      return {kind:'storage-acknowledged-test-receipt', requestId, stored:true};
    }
  };
}
