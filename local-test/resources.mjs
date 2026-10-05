import {ConnectionError, OWNER} from './oauth-local.mjs';
import {COLUMNS} from '../backend-draft/storage-plan.mjs';

export const TEST_POLICY = Object.freeze({maxFiles: 1, maxBytesPerFile: 512 * 1024, allowedMimeTypes: ['image/png']});
export const FILE_FIELDS = 'id,name,mimeType,trashed,parents,owners(emailAddress),permissions(type,role,emailAddress),appProperties';
export const TABLE_FIELDS = 'spreadsheetId,sheets(properties(sheetId,title),tables(tableId,name,range))';
const drive = 'https://www.googleapis.com/drive/v3/files';
export const fileRequest = id => ({url: `${drive}/${encodeURIComponent(id)}?fields=${encodeURIComponent(FILE_FIELDS)}`});
export const tableRequest = config => ({url: `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}?fields=${encodeURIComponent(TABLE_FIELDS)}`});
export function assertPrivate(resource, id, parent) {
  if (resource?.id !== id || resource.trashed === true || resource.owners?.length !== 1 || resource.owners[0].emailAddress !== OWNER ||
      resource.permissions?.length !== 1 || resource.permissions[0].type !== 'user' || resource.permissions[0].role !== 'owner' ||
      resource.permissions[0].emailAddress !== OWNER) throw new ConnectionError('TARGET_NOT_OWNER_ONLY');
  if (parent && (resource.parents?.length !== 1 || resource.parents[0] !== parent)) throw new ConnectionError('TARGET_PARENT_MISMATCH');
}
export function findTable(metadata, config) {
  const sheet = metadata.sheets?.find(s => s.properties?.sheetId === config.sheetId && s.properties.title === config.sheetName);
  const table = sheet?.tables?.find(t => t.name === config.tableName && (!config.tableId || t.tableId === config.tableId));
  // Google omits a range's default zero sheetId. Its containing sheet provides
  // the verified ID; an explicit conflicting range ID is still rejected.
  return table ? {...table, range:{...table.range, sheetId:table.range?.sheetId ?? sheet.properties.sheetId}} : undefined;
}
export function configFromConnection(connection) {
  return {mode: 'test-draft', ownerEmail: OWNER, ...connection.targets,
    privacyTextVersion: 'source-screenshots-2026-10-03', uploadPolicy: TEST_POLICY};
}

export async function ensureResources(session) {
  await session.verifyOwner();
  const targets = session.connection.targets ||= {sheetName: 'Başvurular', tableName: 'EDK_Test_Basvurular'};
  const create = async (key, name, mimeType, parent) => {
    if (!targets[key]) {
      // Persist pending state first. An ambiguous create cannot be repeated
      // automatically after restart, so a lost acknowledgment cannot duplicate it.
      if (targets.pendingCreate) throw new ConnectionError('RESOURCE_CREATE_UNCONFIRMED');
      targets.pendingCreate = key;
      await session.save();
      const file = await session.json(`${drive}?fields=id`, 'POST', {name, mimeType,
        ...(parent ? {parents: [parent]} : {}), appProperties: {edkMode: 'local-test', edkResource: key}});
      if (!file.id) throw new ConnectionError('RESOURCE_CREATE_UNCONFIRMED');
      targets[key] = file.id;
      delete targets.pendingCreate;
      await session.save();
    }
    const resource = await session.request(fileRequest(targets[key]));
    assertPrivate(resource, targets[key], parent);
    if (resource.mimeType !== mimeType) throw new ConnectionError('TARGET_TYPE');
  };
  await create('testRootFolderId', 'EDK Yerel Test — 3 Ekim 2026', 'application/vnd.google-apps.folder');
  await create('photoFolderId', 'Profil Fotoğrafları — Yerel Test', 'application/vnd.google-apps.folder', targets.testRootFolderId);
  await create('spreadsheetId', 'EDK Yerel Başvuru Testi — 3 Ekim 2026', 'application/vnd.google-apps.spreadsheet', targets.testRootFolderId);

  let metadata = await session.request(tableRequest(targets));
  if (!Number.isSafeInteger(targets.sheetId)) {
    const sheet = metadata.sheets?.[0]?.properties;
    if (!Number.isSafeInteger(sheet?.sheetId)) throw new ConnectionError('SHEET_TARGET_UNCONFIRMED');
    targets.sheetId = sheet.sheetId;
    await session.save();
  }
  const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${targets.spreadsheetId}:batchUpdate`;
  const tab = metadata.sheets?.find(s => s.properties.sheetId === targets.sheetId);
  if (!tab) throw new ConnectionError('SHEET_TARGET_UNCONFIRMED');
  if (tab.properties.title !== targets.sheetName) {
    await session.json(endpoint, 'POST', {requests: [{updateSheetProperties: {
      properties: {sheetId: targets.sheetId, title: targets.sheetName}, fields: 'title'
    }}]});
  }
  const headersUrl = `https://sheets.googleapis.com/v4/spreadsheets/${targets.spreadsheetId}/values/${encodeURIComponent("'Başvurular'!A1:S1")}`;
  const headers = await session.request({url: headersUrl});
  if (!headers.values?.length) {
    await session.json(`${headersUrl}?valueInputOption=RAW`, 'PUT', {range: "'Başvurular'!A1:S1", majorDimension: 'ROWS', values: [[...COLUMNS]]});
  } else if (JSON.stringify(headers.values[0]) !== JSON.stringify(COLUMNS)) throw new ConnectionError('HEADER_MISMATCH');
  metadata = await session.request(tableRequest(targets));
  let table = findTable(metadata, targets);
  if (!table) {
    if (targets.tableId || targets.pendingTable) throw new ConnectionError('TABLE_CREATE_UNCONFIRMED');
    targets.pendingTable = true;
    await session.save();
    await session.json(endpoint, 'POST', {requests: [{addTable: {table: {
      name: targets.tableName, range: {sheetId: targets.sheetId, startRowIndex: 0, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 19},
      columnProperties: COLUMNS.map((columnName, columnIndex) => ({columnIndex, columnName}))
    }}}]});
    metadata = await session.request(tableRequest(targets));
    table = findTable(metadata, targets);
  }
  if (!table?.tableId || table.range.endColumnIndex !== 19 || table.range.sheetId !== targets.sheetId)
    throw new ConnectionError('TABLE_MISMATCH');
  targets.tableId = table.tableId;
  delete targets.pendingTable;
  await session.save();
  return configFromConnection(session.connection);
}
