// ════════════════════════════════════════════════════════════════════════════
// EXPORT / IMPORT
// ════════════════════════════════════════════════════════════════════════════
function exportProjects(){
  const blob=new Blob([JSON.stringify({
    version:1,
    exportedAt:new Date().toISOString(),
    globalOrg:S.globalOrg,
    projects:S.projects
  },null,2)],{type:'application/json'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`teamiq-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function triggerImport(){
  const inp=document.createElement('input');
  inp.type='file'; inp.accept='.json';
  inp.onchange=async e=>{
    const file=e.target.files[0]; if(!file)return;
    try{
      const text=await file.text();
      const data=JSON.parse(text);
      if(!data.projects||!Array.isArray(data.projects)){
        alert('Invalid TeamIQ export file.'); return;
      }
      if(!confirm(`Import ${data.projects.length} project(s)?${data.globalOrg?' This will also replace your organization hierarchy.':''}`))return;
      const r=await POST('/api/import',data);
      if(r.ok){ await loadState(); rerender(); alert(`Imported ${r.imported} project(s) successfully.`); }
      else alert('Import failed: '+(r.error||'unknown error'));
    }catch(err){ alert('Could not parse file: '+err.message); }
  };
  inp.click();
}
