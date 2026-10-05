import {ConnectionError, readPrivateConnection, readApprovedClient, writePrivateConnection, assertScope, OWNER, SCOPE} from './oauth-local.mjs';

const APPROVED_CLIENT = '/Users/erencinar/client_secret_341320428840-geqn6069ilq4lu4tkq8t8dpjbba80gnp.apps.googleusercontent.com.json';

// Google credentials are held only by this local server. Never serialize a
// session, provider response, request headers or credential to the frontend.
export class GoogleSession {
  constructor(connection) { this.connection = connection; this.refreshing = null; }
  static async load(approved) {
    const connection = await readPrivateConnection(approved);
    if (connection.credentialPath !== APPROVED_CLIENT || connection.resourceMode !== 'app-created-test' ||
        typeof connection.accessToken !== 'string' || typeof connection.refreshToken !== 'string')
      throw new ConnectionError('CONNECTION_INVALID');
    return new GoogleSession(connection);
  }
  async save() { await writePrivateConnection(this.connection, true); }
  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = (async () => {
      const client = await readApprovedClient(APPROVED_CLIENT, true);
      if (client.clientId !== this.connection.clientId) throw new ConnectionError('CLIENT_MISMATCH');
      const body = new URLSearchParams({client_id: client.clientId, client_secret: client.clientSecret,
        refresh_token: this.connection.refreshToken, grant_type: 'refresh_token'});
      const response = await this.fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', body, headers: {'Content-Type': 'application/x-www-form-urlencoded'}
      });
      const token = await response.json().catch(() => { throw new ConnectionError('GOOGLE_RESPONSE_INVALID'); });
      if (token.scope !== undefined) assertScope(token.scope);
      if (typeof token.access_token !== 'string' || !Number.isFinite(Number(token.expires_in)) || Number(token.expires_in) <= 0)
        throw new ConnectionError('TOKEN_INCOMPLETE');
      this.connection.accessToken = token.access_token;
      this.connection.expiresAt = Date.now() + Number(token.expires_in) * 1000;
      if (typeof token.refresh_token === 'string') this.connection.refreshToken = token.refresh_token;
      await this.save();
    })();
    try { await this.refreshing; } finally { this.refreshing = null; }
  }
  async fetch(url, options) {
    let response;
    try { response = await fetch(url, {...options, redirect: 'error', signal: AbortSignal.timeout(30000)}); }
    catch { throw new ConnectionError('GOOGLE_REQUEST_UNCONFIRMED'); }
    if (!response.ok) {
      // Provider diagnostics are reduced to non-sensitive codes, never full bodies.
      let code = `GOOGLE_HTTP_${response.status}`;
      const detail = await response.json().catch(() => null);
      const reason = detail?.error?.errors?.[0]?.reason;
      if (reason === 'accessNotConfigured') code = 'GOOGLE_API_NOT_ENABLED';
      if (reason === 'insufficientPermissions') code = 'GOOGLE_PERMISSION_DENIED';
      throw new ConnectionError(code);
    }
    return response;
  }
  async request({url, method = 'GET', body, headers = {}}, {binary = false} = {}) {
    const address = new URL(url);
    if (address.protocol !== 'https:' || !['www.googleapis.com', 'sheets.googleapis.com'].includes(address.hostname))
      throw new ConnectionError('GOOGLE_ENDPOINT_INVALID');
    assertScope(this.connection.scope);
    if (!Number.isFinite(this.connection.expiresAt) || this.connection.expiresAt < Date.now() + 60000) await this.refresh();
    const response = await this.fetch(url, {method, body, headers: {...headers, Authorization: `Bearer ${this.connection.accessToken}`}});
    if (binary) return Buffer.from(await response.arrayBuffer());
    return response.json().catch(() => { throw new ConnectionError('GOOGLE_RESPONSE_INVALID'); });
  }
  async json(url, method, value) {
    return this.request({url, method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(value)});
  }
  async verifyOwner() {
    const about = await this.request({url: 'https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)'});
    if (about.user?.emailAddress !== OWNER || this.connection.scope !== SCOPE) throw new ConnectionError('OWNER_MISMATCH');
  }
}
