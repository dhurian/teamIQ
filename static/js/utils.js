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

// ── Colour helpers ─────────────────────────────────────────────────────────
const ini    = n => n.split(' ').slice(0,2).map(w=>w[0]).join('').toUpperCase();
const spCol  = p => p>=.75?'#1fb885':p>=.5?'#f0a030':'#e05050';
const scv    = v => v>=7?'#1fb885':v>=4?'#f0a030':'#e05050';
const tCol   = t => ({integration:'#4a9eff',dependency:'#f0a030',handoff:'#1fb885',reporting:'#9b7ee8'})[t]||'#4a9eff';

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
