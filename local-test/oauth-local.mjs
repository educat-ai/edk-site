import {createServer} from 'node:http';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import {readFile,mkdir,lstat,open,rename,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SCOPE = 'https://www.googleapis.com/auth/drive.file';
export const OWNER = 'erencnr@gmail.com';
export const PRIVATE_DIRECTORY = '/Users/erencinar/Library/Application Support/EDK Local Test';
export const CONNECTION_FILE = path.join(PRIVATE_DIRECTORY,'connection.json');
export class ConnectionError extends Error {
  constructor(code){super(code);this.code=code;}
}
export function createAuthorizationParameters(clientId,redirectUri) {
  const verifier=randomBytes(48).toString('base64url');
  const state=randomBytes(32).toString('base64url');
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  Object.entries({client_id:clientId,redirect_uri:redirectUri,response_type:'code',
    scope:SCOPE,access_type:'offline',prompt:'consent',include_granted_scopes:'false',
    login_hint:OWNER,state,code_challenge_method:'S256',
    code_challenge:createHash('sha256').update(verifier).digest('base64url')
  }).forEach(([key,value])=>url.searchParams.set(key,value));
  return {url,verifier,state};
}
export function validState(expected,actual) {
  if(typeof actual!=='string')return false;
  const a=Buffer.from(expected),b=Buffer.from(actual);
  return a.length===b.length&&timingSafeEqual(a,b);
}
export function assertScope(scope) {
  const scopes=(scope||'').split(/\s+/).filter(Boolean);
  if(scopes.length!==1||scopes[0]!==SCOPE)throw new ConnectionError('SCOPE_MISMATCH');
}
export async function readApprovedClient(file,permissionApproved) {
  if(permissionApproved!==true)throw new ConnectionError('CONNECTION_NOT_APPROVED');
  const handle=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const stat=await handle.stat();
    if(!stat.isFile()||stat.size>32768)throw new ConnectionError('CLIENT_FILE_INVALID');
    let object;
    try{object=JSON.parse(await handle.readFile('utf8'));}catch{throw new ConnectionError('CLIENT_FILE_INVALID');}
    const c=object.installed;
    if(!c||typeof c.client_id!=='string'||!c.client_id.endsWith('.apps.googleusercontent.com')||typeof c.client_secret!=='string')throw new ConnectionError('DESKTOP_CLIENT_REQUIRED');
    return {clientId:c.client_id,clientSecret:c.client_secret};
  }finally{await handle.close();}
}
export async function writePrivateConnection(value,permissionApproved,directory=PRIVATE_DIRECTORY) {
  if(permissionApproved!==true)throw new ConnectionError('PERSISTENCE_NOT_APPROVED');
  await mkdir(directory,{recursive:true,mode:0o700});
  const info=await lstat(directory);
  if(!info.isDirectory()||info.isSymbolicLink()||info.uid!==process.getuid())throw new ConnectionError('PRIVATE_DIRECTORY_INVALID');
  await chmod(directory,0o700);
  const temp=path.join(directory,`.connection-${randomBytes(12).toString('hex')}.json`);
  const h=await open(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);
  try{await h.writeFile(JSON.stringify(value));await h.sync();}finally{await h.close();}
  await rename(temp,path.join(directory,'connection.json'));
}
export async function readPrivateConnection(permissionApproved,directory=PRIVATE_DIRECTORY) {
  if(permissionApproved!==true)throw new ConnectionError('CONNECTION_NOT_APPROVED');
  const dir=await lstat(directory);
  if(!dir.isDirectory()||dir.isSymbolicLink()||dir.uid!==process.getuid()||(dir.mode&0o077)!==0)throw new ConnectionError('PRIVATE_DIRECTORY_INVALID');
  const h=await open(path.join(directory,'connection.json'),constants.O_RDONLY|constants.O_NOFOLLOW);
  try{
    const info=await h.stat();
    if(!info.isFile()||info.uid!==process.getuid()||(info.mode&0o077)!==0)throw new ConnectionError('PRIVATE_STORAGE_INVALID');
    const value=JSON.parse(await h.readFile('utf8'));
    assertScope(value.scope);
    if(value.ownerEmail!==OWNER)throw new ConnectionError('OWNER_MISMATCH');
    return value;
  }finally{await h.close();}
}
export async function googleJson(url,options={}) {
  let response;
  try{response=await fetch(url,{...options,signal:AbortSignal.timeout(30000),redirect:'error'});}catch{throw new ConnectionError('GOOGLE_REQUEST_UNCONFIRMED');}
  if(!response.ok)throw new ConnectionError(`GOOGLE_HTTP_${response.status}`);
  try{return await response.json();}catch{throw new ConnectionError('GOOGLE_RESPONSE_INVALID');}
}
export async function connectApproved(file,{permissionApproved=false,persistApproved=false,openBrowser=false}={}) {
  const client=await readApprovedClient(file,permissionApproved);
  if(!persistApproved)throw new ConnectionError('PERSISTENCE_NOT_APPROVED');
  let flow,redirectUri,used=false,complete;
  const completed=new Promise(resolve=>{complete=resolve;});
  const server=createServer(async(req,res)=>{
    res.setHeader('Content-Type','text/html; charset=utf-8');
    res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    const answer=(status,text)=>{res.writeHead(status);res.end(`<meta charset="utf-8"><title>EDK Yerel Test</title><p>${text}</p>`);};
    if(req.method!=='GET'||req.headers.host!==new URL(redirectUri).host){answer(400,'Geçersiz yerel callback.');return;}
    const u=new URL(req.url,redirectUri);
    if(u.pathname!=='/'){answer(404,'Bu sayfa bulunamadı.');return;}
    if(!validState(flow.state,u.searchParams.get('state'))){answer(400,'Bağlantı durumu doğrulanamadı.');return;}
    if(used){answer(409,'Bu bağlantı isteği zaten işlendi.');return;}
    used=true;
    if(u.searchParams.has('error')){answer(400,'Google bağlantısı onaylanmadı.');complete({status:'denied'});return;}
    const code=u.searchParams.get('code');
    if(!code||code.length>4096){answer(400,'Google bağlantı kodu alınamadı.');complete({status:'failed',code:'CODE_MISSING'});return;}
    try{
      const body=new URLSearchParams({client_id:client.clientId,client_secret:client.clientSecret,
        code,code_verifier:flow.verifier,redirect_uri:redirectUri,grant_type:'authorization_code'});
      const token=await googleJson('https://oauth2.googleapis.com/token',{method:'POST',body,
        headers:{'Content-Type':'application/x-www-form-urlencoded'}});
      assertScope(token.scope);
      if(typeof token.access_token!=='string'||typeof token.refresh_token!=='string')throw new ConnectionError('TOKEN_INCOMPLETE');
      const about=await googleJson('https://www.googleapis.com/drive/v3/about?fields=user(emailAddress)',{headers:{Authorization:`Bearer ${token.access_token}`}});
      if(about.user?.emailAddress!==OWNER)throw new ConnectionError('OWNER_MISMATCH');
      await writePrivateConnection({version:1,ownerEmail:OWNER,scope:SCOPE,clientId:client.clientId,
        credentialPath:file,accessToken:token.access_token,refreshToken:token.refresh_token,
        expiresAt:Date.now()+Number(token.expires_in)*1000,connectedAt:new Date().toISOString(),
        resourceMode:'app-created-test',targets:null},persistApproved);
      answer(200,'Google bağlantısı onaylandı. Bu pencereyi kapatabilirsiniz. EDK yerel test kurulumu devam edecek.');
      complete({status:'connected',ownerVerified:true,scope:SCOPE,privatePersistence:true});
    }catch(error){
      answer(502,'Google bağlantısı tamamlanamadı. EDK test sunucusu bağlantı hatasını kontrol edecek.');
      complete({status:'failed',code:error instanceof ConnectionError?error.code:'CONNECTION_FAILED'});
    }
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  redirectUri=`http://127.0.0.1:${server.address().port}/`;
  flow=createAuthorizationParameters(client.clientId,redirectUri);
  // Never print the authorization URL, credential content, code or tokens.
  if(openBrowser){const child=spawn('open',[flow.url.href],{stdio:'ignore'});child.on('error',()=>complete({status:'failed',code:'BROWSER_OPEN_FAILED'}));}
  process.stdout.write('AUTH_READY: Google onay ekranı Mac’te açıldı. erencnr@gmail.com hesabını seçip erişimi onaylayın.\n');
  const timer=setTimeout(()=>complete({status:'failed',code:'AUTH_TIMEOUT'}),15*60*1000);
  const result=await completed;
  clearTimeout(timer);server.closeAllConnections();await new Promise(resolve=>server.close(resolve));
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2),approved=args.includes('--approved'),persist=args.includes('--persist-approved');
  const i=args.indexOf('--credential-file'),file=i<0?null:args[i+1];
  if(!approved||!persist||!file){process.stderr.write('Bağlantı kapalı: dosya yolu ve açık bağlantı/saklama onayı gerekli.\n');process.exitCode=2;}
  else{
    try{const result=await connectApproved(file,{permissionApproved:true,persistApproved:true,openBrowser:true});process.stdout.write(JSON.stringify(result)+'\n');if(result.status!=='connected')process.exitCode=1;}
    catch(error){process.stderr.write(JSON.stringify({status:'failed',code:error instanceof ConnectionError?error.code:'SETUP_FAILED'})+'\n');process.exitCode=1;}
  }
}
