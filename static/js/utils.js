// ── API helpers ────────────────────────────────────────────────────────────
async function api(method, path, body){
  const opts = { method, headers: {'Content-Type':'application/json'} };
  if(body) opts.body = JSON.stringify(body);
  const r = await fetch(path, opts);
  return r.json();
}
const GET    = p       => api('GET',    p);
const POST   = (p, b)  => api('POST',   p, b);
const PATCH  = (p, b)  => api('PATCH',  p, b);
const DELETE = p       => api('DELETE', p);

async function loadState(){
  S = await GET('/api/state');
  renderSidebar();
}

// ── Semantic colour constants (mirrors CSS :root variables) ─────────────────
// Use these in JS template strings instead of bare hex literals.
// grep: C.blue C.teal C.amber C.red C.purple C.muted C.faint
const C = {
  blue:   '#4a9eff',  // primary · phases · integration
  teal:   '#1fb885',  // success · complete · platform
  amber:  '#f0a030',  // warning · dependency · medium risk
  red:    '#e05050',  // error · blocked · critical
  purple: '#9b7ee8',  // division · secondary
  muted:  '#8893a8',  // secondary text
  faint:  '#4a556a',  // tertiary text
};

// ── Colour helpers ─────────────────────────────────────────────────────────
const ini    = n => n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const spCol  = p => p>=.75?C.teal:p>=.5?C.amber:C.red;
const scv    = v => v>=7?C.teal:v>=4?C.amber:C.red;
const tCol   = t => ({integration:C.blue,dependency:C.amber,handoff:C.teal,reporting:C.purple})[t]||C.blue;

function ap(){ return S.projects?.find(p=>p.id===S.activeProjectId)||S.projects?.[0]; }

// ── Shared org-tree helpers (used by org hier, teams, import picker) ───────
function flatPersons(node,acc=[]){
  if(!node)return acc;
  if(node.type==='person')acc.push(node);
  (node.children||[]).forEach(c=>flatPersons(c,acc));
  return acc;
}
function flatPersonsUnder(node){
  if(!node)return[];
  if(node.type==='person')return[node];
  return(node.children||[]).flatMap(c=>flatPersonsUnder(c));
}
function findNode(node,id){
  if(!node)return null;
  if(node.id===id)return node;
  for(const c of(node.children||[])){const f=findNode(c,id);if(f)return f;}
  return null;
}
