// Browser-side RSA-OAEP (SHA-256) encryptor supporting both SPKI and PKCS#1 PEM public keys.

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function readLength(bytes, offset) {
  let len = bytes[offset];
  if ((len & 0x80) === 0) {
    return { length: len, lengthBytes: 1 };
  }
  const n = len & 0x7f;
  let value = 0;
  for (let i = 0; i < n; i++) {
    value = (value << 8) | bytes[offset + 1 + i];
  }
  return { length: value, lengthBytes: 1 + n };
}

function parsePkcs1PublicKey(arrayBuffer) {
  // PKCS#1 RSAPublicKey ::= SEQUENCE { modulus INTEGER, exponent INTEGER }
  const bytes = new Uint8Array(arrayBuffer);
  let idx = 0;
  if (bytes[idx++] !== 0x30) throw new Error('Invalid PKCS#1: no SEQUENCE');
  const seqLen = readLength(bytes, idx);
  idx += seqLen.lengthBytes;

  if (bytes[idx++] !== 0x02) throw new Error('Invalid PKCS#1: expected INTEGER (modulus)');
  const modLen = readLength(bytes, idx);
  idx += modLen.lengthBytes;
  let modulus = bytes.slice(idx, idx + modLen.length);
  idx += modLen.length;

  if (bytes[idx++] !== 0x02) throw new Error('Invalid PKCS#1: expected INTEGER (exponent)');
  const expLen = readLength(bytes, idx);
  idx += expLen.lengthBytes;
  let exponent = bytes.slice(idx, idx + expLen.length);

  // remove possible leading zero byte
  if (modulus[0] === 0x00) modulus = modulus.slice(1);
  if (exponent[0] === 0x00) exponent = exponent.slice(1);

  return { modulus, exponent };
}

function uint8ToBase64(u8) {
  const CHUNK = 0x8000;
  let str = '';
  for (let i = 0; i < u8.length; i += CHUNK) {
    str += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + CHUNK)));
  }
  return btoa(str);
}

function toBase64Url(u8) {
  return uint8ToBase64(u8).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function arrayBufferToBase64(buffer) {
  const u8 = new Uint8Array(buffer);
  return uint8ToBase64(u8);
}

/**
 * Encrypt a string with an RSA public key PEM (SPKI or PKCS#1).
 * @param {string} pem - the PEM public key (including header/footer).
 * @param {string} message - plaintext string to encrypt.
 * @returns {Promise<string>} base64-encoded ciphertext
 */
async function encryptWithPublicKey(pem, message) {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('SubtleCrypto required (modern browser).');
  }

  // SPKI (BEGIN PUBLIC KEY) can be imported directly
  if (pem.includes('-----BEGIN PUBLIC KEY-----')) {
    const spki = pemToArrayBuffer(pem);
    const key = await crypto.subtle.importKey(
      'spki',
      spki,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const encoded = new TextEncoder().encode(message);
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
    return arrayBufferToBase64(cipher);
  }

  // PKCS#1 (BEGIN RSA PUBLIC KEY) -> parse modulus & exponent -> import as JWK
  if (pem.includes('-----BEGIN RSA PUBLIC KEY-----')) {
    const der = pemToArrayBuffer(pem);
    const { modulus, exponent } = parsePkcs1PublicKey(der);
    const jwk = {
      kty: 'RSA',
      n: toBase64Url(modulus),
      e: toBase64Url(exponent),
      alg: 'RSA-OAEP-256',
      ext: true
    };
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['encrypt']
    );
    const encoded = new TextEncoder().encode(message);
    const cipher = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded);
    return arrayBufferToBase64(cipher);
  }

  throw new Error('Unrecognized PEM format (expecting SPKI "BEGIN PUBLIC KEY" or PKCS#1 "BEGIN RSA PUBLIC KEY").');
}


//


function hashStringToHue(s){
  let h = 2166136261 >>> 0;
  for(let i=0;i<s.length;i++){
    h ^= s.charCodeAt(i);
    h += (h<<1) + (h<<4) + (h<<7) + (h<<8) + (h<<24);
    h >>>= 0;
  }
  return h % 360;
}

function ipToColor(ip){
  const h = hashStringToHue(String(ip));
  return `hsla(${h},70%,60%,0.13)`;
}

function fmtDate(ms) {
  if (ms == null) return '';
  // Try numeric (ms) first, otherwise try Date parsing from string
  let date;
  const n = Number(ms);
  if (!Number.isNaN(n)) {
    date = new Date(n);
  } else {
    date = new Date(String(ms));
  }
  if (isNaN(date)) return String(ms);

  const MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = MONTHS[date.getMonth()];
  const day = date.getDate();           // no leading zero: `13`
  const year = date.getFullYear();

  return `${mon} ${day} ${year}`;
}


function safeText(v){
  if(v===null||v===undefined) return '';
  if(typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function toRowsFromMap(map){
  const rows = [];
  for(const [ip, obj] of Object.entries(map)){
    const copy = Object.assign({}, obj);
    copy.ip = ip;
    rows.push(copy);
  }
  return rows;
}

function collectColumns(rows){
  const set = new Set();
  for(const r of rows){
    for(const k of Object.keys(r)) set.add(k);
  }
  const preferred = ['ip','firstAt','lastAt','prevAt','visits','city','region','isp','referer','user-agent','captcha'];
  const others = [...set].filter(x=>!preferred.includes(x)).sort();
  return [...preferred.filter(x=>set.has(x)), ...others];
}

/* ------------------------------
   Rendering & state
   ------------------------------ */
let _rows = [];
let _columns = [];
let _filter = '';
let _sortKey = null;
let _sortDir = 1; // 1 asc, -1 desc
let _page = 1;
let _perPage = 100;

async function renderTable(){
  const tbody = document.getElementById('tbody');
  const thead = document.getElementById('thead');

  if(!tbody || !thead) {
    console.warn('renderTable: missing DOM elements (thead/tbody).');
    return;
  }

  const filtered = _rows.filter(r => {
    if(!_filter) return true;
    const s = _filter.toLowerCase();
    for(const k of _columns){
      const v = r[k];
      if(v==null) continue;
      if(String(v).toLowerCase().includes(s)) return true;
    }
    return false;
  });

  if(_sortKey){
    filtered.sort((a,b)=>{
      let va = a[_sortKey];
      let vb = b[_sortKey];
      const na = Number(va); const nb = Number(vb);
      if(!Number.isNaN(na) && !Number.isNaN(nb)) return (na-nb)*_sortDir;
      if(/at$/i.test(_sortKey)){
        const da = new Date(va).getTime()||0; const db = new Date(vb).getTime()||0; return (da-db)*_sortDir;
      }
      va = safeText(va).toLowerCase(); vb = safeText(vb).toLowerCase();
      if(va < vb) return -1*_sortDir; if(va > vb) return 1*_sortDir; return 0;
    });
  }

  const total = filtered.length;
  const pages = Math.max(1, Math.ceil(total/_perPage));
  if(_page > pages) _page = pages;
  const start = (_page-1)*_perPage; const end = start + _perPage;
  const pageRows = filtered.slice(start,end);

  // header
  thead.innerHTML = '';
  const trh = document.createElement('tr');
  for(const col of _columns){
    const th = document.createElement('th');
    th.textContent = col;
    if(_sortKey === col) th.classList.add(_sortDir===1? 'sort-asc':'sort-desc');
    th.addEventListener('click', ()=>{
      if(_sortKey === col) _sortDir = -_sortDir; else {_sortKey = col; _sortDir = 1}
      renderTable();
    });
    trh.appendChild(th);
  }
  thead.appendChild(trh);

  // rows
  tbody.innerHTML = '';
  for(const r of pageRows){
    const tr = document.createElement('tr');
    const bg = ipToColor(r.ip || '');
    tr.style.background = bg;
    for(const col of _columns){
      const td = document.createElement('td');
      let v = r[col];
      if(col === 'firstAt' || col === 'lastAt' || col === 'prevAt'){
        td.innerHTML = `<div>${fmtDate(v)}</div><div class="small">${safeText(v)}</div>`;
      } else if(col === 'ip'){
        td.innerHTML = `<div class="ip-cell">${safeText(v)}</div>`;
        td.title = 'Click to copy IP';
        td.style.cursor = 'pointer';
        td.addEventListener('click', async ()=>{
          try{ await navigator.clipboard.writeText(String(v));
            td.style.outline = '2px solid rgba(255,255,255,0.08)';
            setTimeout(()=>td.style.outline='0',700);
          }catch(e){console.warn('copy failed',e)}
        });
      } else if(col === 'user-agent'){
        td.innerHTML = `<div class="small">${safeText(v).slice(0,140)}</div>`;
      } else if(typeof v === 'object'){
        td.textContent = JSON.stringify(v);
      } else td.textContent = safeText(v);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  const summaryEl = document.getElementById('summary');
  const pageNumEl = document.getElementById('pageNum');
  if(summaryEl) summaryEl.textContent = `${total} entries — showing ${total===0?0:start+1}-${Math.min(end,total)} (page ${_page})`;
  if(pageNumEl) pageNumEl.textContent = String(_page);
}

/* ------------------------------
   Public API: visualize(data)
   ------------------------------ */
async function visualize(data){
  if(!data || typeof data !== 'object'){
    throw new Error('visualize expects an object (ip => props)');
  }
  _rows = toRowsFromMap(data);
  _columns = collectColumns(_rows);

  // try to wire controls if they exist
  const perSel = document.getElementById('perpage');
  _perPage = Number(perSel?.value) || 100;

  const searchEl = document.getElementById('search');
  if(searchEl) searchEl.addEventListener('input', (ev)=>{ _filter = ev.target.value.trim(); _page = 1; renderTable(); });

  if(perSel) perSel.addEventListener('change', (ev)=>{ _perPage = Number(ev.target.value); _page = 1; renderTable(); });

  const prevBtn = document.getElementById('prev');
  if(prevBtn) prevBtn.addEventListener('click', ()=>{ if(_page>1) { _page--; renderTable(); } });

  const nextBtn = document.getElementById('next');
  if(nextBtn) nextBtn.addEventListener('click', ()=>{ _page++; renderTable(); });

  const downloadBtn = document.getElementById('download');
  if(downloadBtn) downloadBtn.addEventListener('click', ()=>{ downloadCSV(); });

  await renderTable();
}

/* ------------------------------
   CSV download
   ------------------------------ */
function downloadCSV(){
  if(!_columns || _columns.length ===0) return;
  const rows = [_columns.join(',')];
  for(const r of _rows){
    const cells = _columns.map(c => {
      let v = r[c];
      if(v===undefined || v===null) return '';
      if(typeof v === 'object') v = JSON.stringify(v);
      v = String(v).replace(/\"/g,'\"\"');
      if(v.indexOf(',')>=0 || v.indexOf('\n')>=0) v = `"${v}"`;
      return v;
    });
    rows.push(cells.join(','));
  }
  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8;'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href=url; a.download='ip_map_export.csv'; a.click();
  URL.revokeObjectURL(url);
}


//


async function getDashboard(session) {
  const token = session.token;
  const publicKey = session.publicKey;

  let passToTry = localStorage.getItem("dashboard_pass");
  if (!passToTry) {
    passToTry = prompt("Enter dashboard password:");
    if (!passToTry) throw new Error("No password provided.");
    localStorage.setItem("dashboard_pass", passToTry);
  }

  const pass = await encryptWithPublicKey(publicKey, passToTry);
  const dashboardResponse = await fetch('/dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, pass })
  });

  if (!dashboardResponse.ok) {
    console.warn("Dashboard request failed. Prompting for new password...");
    localStorage.removeItem("dashboard_pass");

    const newPass = prompt("Invalid password. Enter dashboard password again:");
    if (!newPass) throw new Error("No password provided.");

    localStorage.setItem("dashboard_pass", newPass);

    const encrypted = await encryptWithPublicKey(publicKey, newPass);
    const retryRes = await fetch('/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pass: encrypted })
    });

    if (!retryRes.ok) throw new Error(`Dashboard still failing: ${retryRes.status}`);

    return retryRes.json();
  }

  const dashboardData = await dashboardResponse.json();

  if (dashboardData.error) {
    console.warn("Dashboard returned error:", dashboardData.error);

    localStorage.removeItem("dashboard_pass");
    const newPass = prompt("Dashboard error. Enter password again:");
    if (!newPass) throw new Error("No password provided.");

    localStorage.setItem("dashboard_pass", newPass);

    const encrypted = await encryptWithPublicKey(publicKey, newPass);
    const retryRes = await fetch('/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, pass: encrypted })
    });

    if (!retryRes.ok) throw new Error(`Dashboard still failing: ${retryRes.status}`);

    return retryRes.json();
  }

  return dashboardData;
}

async function sendTokenToDashboard() {
  try {
    const tokenResponse = await fetch('/r');
    if (!tokenResponse.ok) throw new Error(`HTTP error! status: ${tokenResponse.status}`);

    const session = await tokenResponse.json();
    console.log('session data received:', session);

    const result = await getDashboard(session);
    console.log('Dashboard response:', result);

    visualize(result.adressMap)
  } catch (error) {
    console.error('Error:', error);
  }
}

sendTokenToDashboard();