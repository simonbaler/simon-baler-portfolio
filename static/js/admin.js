const loadBtn = document.getElementById('load');
const saveBtn = document.getElementById('save');
const resetBtn = document.getElementById('reset');
const modeButtons = Array.from(document.querySelectorAll('[data-mode]'));
const clearModeBtn = document.getElementById('clear-mode');

let current = {}

// saved flags for per-item saved badges
const savedFlags = {}; // { key: { idx: timestamp } }

function markSaved(key, idx){
  if(!key || typeof idx === 'undefined' || idx === null) return;
  savedFlags[key] = savedFlags[key] || {};
  savedFlags[key][idx] = Date.now();
  // remove after 2.4s
  setTimeout(()=>{
    try{ delete savedFlags[key][idx]; }catch(e){}
  }, 2400);
}

function domListIdToDataKey(id){
  // map 'cert-list' -> 'certificates', 'snaps-list'->'snaps', 'events-list'->'events', 'projects-list'->'projects', 'skills-list'->'skills'
  if(!id) return id;
  if(id.endsWith('-list')){
    const base = id.slice(0, -5);
    if(base === 'cert') return 'certificates';
    if(base === 'snap') return 'snaps';
    if(base === 'event') return 'events';
    return base + (base.endsWith('s') ? '' : 's');
  }
  return id;
}

// debounce helper
function debounce(fn, wait){
  let t = null;
  return function(...args){
    clearTimeout(t);
    t = setTimeout(()=> fn.apply(this,args), wait);
  }
}

// central save helper used for manual save or autosave
async function saveData(showToastOnSuccess = true){
  try{
    // collect base fields before saving
    current.name = document.getElementById('name').value;
    current.email = document.getElementById('email').value;
    current.phone = document.getElementById('phone').value;
    current.location = document.getElementById('location').value;
    const res = await fetch('/api/data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)});
    if(!res.ok) throw new Error('Save failed');
    if(showToastOnSuccess) showToast('Details updated', 'success');
    // update admin status indicator if present
    try{ const st = document.getElementById('admin-status'); if(st){ st.textContent = 'Saved'; st.style.color = ''; setTimeout(()=>{ st.textContent = '\u00A0'; }, 2400); } }catch(e){}
    return true;
  }catch(err){
    console.error('saveData error', err);
    showToast('Save failed', 'error');
    try{ const st = document.getElementById('admin-status'); if(st){ st.textContent = 'Save failed'; st.style.color = 'tomato'; setTimeout(()=>{ st.textContent = '\u00A0'; }, 4200); } }catch(e){}
    return false;
  }
}

const autosave = debounce(async (context)=>{
  await saveData(false);
  if(context && context.key){ markSaved(context.key, context.idx); }
}, 800);

// ensure toast container exists
function ensureToastWrap(){
  if(document.querySelector('.toast-wrap')) return document.querySelector('.toast-wrap');
  const w = document.createElement('div'); w.className='toast-wrap'; document.body.appendChild(w); return w;
}

function showToast(message, type='info', title=''){
  const wrap = ensureToastWrap();
  const t = document.createElement('div'); t.className = 'toast ' + (type === 'success' ? 'success' : (type === 'error' ? 'error' : ''));
  if(title) t.innerHTML = `<div class="title">${title}</div><div class="body">${message}</div>`; else t.innerHTML = `<div class="body">${message}</div>`;
  wrap.appendChild(t);
  setTimeout(()=>{ t.style.opacity = '0'; t.style.transform='translateY(8px)'; setTimeout(()=>t.remove(),400) }, 4200);
}

async function render(){
  // populate fields
  document.getElementById('name').value = current.name || '';
  document.getElementById('email').value = current.email || '';
  document.getElementById('phone').value = current.phone || '';
  document.getElementById('location').value = current.location || '';

  const mapList = (id, arr)=>{
    const el = document.getElementById(id);
    el.innerHTML = '';
    (arr||[]).forEach((it,idx)=>{
      const dataKey = domListIdToDataKey(id);
      const div = document.createElement('div');
      div.className = 'list-item';
      // create editable label + up/down/remove controls
      const label = document.createElement('div');
      label.style.flex = '1';
      if(typeof it === 'string'){
        label.innerHTML = `<input class="inline-edit" value="${it}" data-idx="${idx}" />`;
      }else{
        const thumb = it.thumb? `<img class="thumb" src="${it.thumb}" alt="thumb"/>` : '';
        const name = it.name || it.url || '';
        const lottie = it.lottie || '';
        const desc = it.description || '';
        label.innerHTML = `<div style="display:flex;gap:.6rem;align-items:center"><div>${thumb}</div><div style="flex:1"><input class="inline-edit" value="${name}" data-idx="${idx}" /><input class="inline-lottie" placeholder="Lottie URL (optional)" value="${lottie}" data-idx="${idx}" style="margin-top:.4rem;width:100%"/><textarea class="inline-desc" placeholder="Description" data-idx="${idx}" style="margin-top:.45rem;width:100%">${desc}</textarea></div></div>`;
      }
  const controls = document.createElement('div');
  controls.className = 'controls';
  controls.innerHTML = `<button class="btn small outline up" data-idx="${idx}" title="Move up">▲</button><button class="btn small outline down" data-idx="${idx}" title="Move down">▼</button><button class="btn small ghost remove" data-idx="${idx}" title="Remove">Remove</button>`;
      div.appendChild(label);
      // saved badge
      const badge = document.createElement('span'); badge.className = 'saved-badge'; badge.textContent = 'Saved';
      div.appendChild(badge);
      div.appendChild(controls);
      el.appendChild(div);
  // events
  controls.querySelector('.remove').addEventListener('click', ()=>{ arr.splice(idx,1); render(); autosave({key: dataKey}); })
  controls.querySelector('.up').addEventListener('click', ()=>{ if(idx>0){ arr.splice(idx-1,0,arr.splice(idx,1)[0]); render(); autosave({key: dataKey}); } })
  controls.querySelector('.down').addEventListener('click', ()=>{ if(idx< arr.length-1){ arr.splice(idx+1,0,arr.splice(idx,1)[0]); render(); autosave({key: dataKey}); } })
  // inline edits
  const inline = div.querySelector('.inline-edit');
  if(inline){ inline.addEventListener('change', (e)=>{ arr[idx] = e.target.value; render(); autosave({key: dataKey, idx}); }) }
  const inlineL = div.querySelector('.inline-lottie');
  if(inlineL){ inlineL.addEventListener('change', (e)=>{ if(typeof arr[idx] === 'object') arr[idx].lottie = e.target.value; else { arr[idx] = {name: arr[idx], lottie: e.target.value} } render(); autosave({key: dataKey, idx}); }) }
  const inlineDesc = div.querySelector('.inline-desc');
  if(inlineDesc){ inlineDesc.addEventListener('change', (e)=>{ if(typeof arr[idx] === 'object') arr[idx].description = e.target.value; else { arr[idx] = {name: arr[idx], description: e.target.value} } render(); autosave({key: dataKey, idx}); }) }
      // show badge when recently saved
      const ts = savedFlags[dataKey] && savedFlags[dataKey][idx];
      if(ts && (Date.now() - ts) < 2200){ badge.classList.add('visible'); } else { badge.classList.remove('visible'); }
    })
  }

  mapList('skills-list', current.skills || []);
  mapList('achievements-list', current.achievements || []);
  mapList('projects-list', current.projects || []);
  mapList('cert-list', current.certificates || []);
  mapList('snaps-list', current.snaps || []);
  mapList('events-list', current.events || []);
}

loadBtn.addEventListener('click', async ()=>{
  const res = await fetch('/api/data');
  current = await res.json();
  render();
})

saveBtn.addEventListener('click', async ()=>{
  saveBtn.disabled = true;
  await saveData(true);
  saveBtn.disabled = false;
})

resetBtn.addEventListener('click', async ()=>{
  if(!confirm('Reset data to default?')) return;
  await fetch('/api/data',{method:'DELETE'});
  showToast('Reset done', 'success');
  const res = await fetch('/api/data');
  current = await res.json();
  render();
})

// add handlers
document.getElementById('add-skill').addEventListener('click', ()=>{
  const v = document.getElementById('skill-input').value.trim();
  if(!v) return; current.skills = current.skills || []; current.skills.push(v); document.getElementById('skill-input').value=''; render(); autosave();
})
document.getElementById('add-project').addEventListener('click', ()=>{
  const v = document.getElementById('project-input').value.trim();
  if(!v) return; current.projects = current.projects || []; current.projects.push(v); document.getElementById('project-input').value=''; render(); autosave();
})
// achievements add handler
const addAchievementBtn = document.getElementById('add-achievement');
if(addAchievementBtn){
  addAchievementBtn.addEventListener('click', ()=>{
    const v = document.getElementById('achievement-input').value.trim();
    if(!v) return; current.achievements = current.achievements || []; current.achievements.push(v); document.getElementById('achievement-input').value=''; render(); autosave();
  })
}
document.getElementById('add-cert').addEventListener('click', ()=>{
  (async ()=>{
    const v = document.getElementById('cert-input').value.trim();
    if(!v) return; current.certificates = current.certificates || [];
    const desc = await showDescriptionModal('Certificate description (optional)');
    current.certificates.push({name: v, description: desc}); document.getElementById('cert-input').value=''; render(); autosave();
  })();
})
document.getElementById('add-snap').addEventListener('click', ()=>{
  (async ()=>{
    const v = document.getElementById('snap-input').value.trim();
    if(!v) return; current.snaps = current.snaps || [];
    const desc = await showDescriptionModal('Snap description (optional)');
    current.snaps.push({name: v, description: desc}); document.getElementById('snap-input').value=''; render(); autosave();
  })();
})
// file upload handlers
document.getElementById('upload-cert').addEventListener('click', async ()=>{
  const f = document.getElementById('cert-file').files[0];
  if(!f) return showToast('Choose a file', 'error');
  const fd = new FormData(); fd.append('file', f); fd.append('kind','cert');
  let res;
  try{ res = await fetch('/api/upload',{method:'POST',body:fd}); }catch(e){ showToast('Network error', 'error'); return }
  if(res.status === 401){ showToast('Unauthorized — please login', 'error'); window.location.href = '/admin/login'; return }
  let j;
  try{ j = await res.json(); }catch(e){ showToast('Server error', 'error'); return }
  if(j.ok){
    // ask for description via modal and persist it
    const desc = await showDescriptionModal('Description for this certificate (optional)');
    // refresh server-side data (server already appended the new entry)
    const r = await fetch('/api/data'); current = await r.json();
    const cert = (current.certificates||[]).find(c=> c.url === j.url || c.name === j.url || c.name === j.name);
    if(cert && desc){ cert.description = desc; await fetch('/api/data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)}); }
    showToast('Uploaded', 'success');
    render();
    autosave();
  }else showToast('Upload error', 'error')
})

document.getElementById('upload-snap').addEventListener('click', async ()=>{
  const f = document.getElementById('snap-file').files[0];
  if(!f) return showToast('Choose a file', 'error');
  const fd = new FormData(); fd.append('file', f); fd.append('kind','snap');
  let res;
  try{ res = await fetch('/api/upload',{method:'POST',body:fd}); }catch(e){ showToast('Network error', 'error'); return }
  if(res.status === 401){ showToast('Unauthorized — please login', 'error'); window.location.href = '/admin/login'; return }
  let j;
  try{ j = await res.json(); }catch(e){ showToast('Server error', 'error'); return }
  if(j.ok){
    const desc = await showDescriptionModal('Description for this snap (optional)');
    const r = await fetch('/api/data'); current = await r.json();
    const snap = (current.snaps||[]).find(s=> s.url === j.url || s.name === j.name);
    if(snap && desc){ snap.description = desc; await fetch('/api/data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)}); }
    showToast('Uploaded', 'success');
    render();
    autosave();
  }else showToast('Upload error', 'error')
})

// show preview when selecting files
function previewFile(inputId, containerId){
  const inp = document.getElementById(inputId);
  inp.addEventListener('change', ()=>{
    const f = inp.files[0];
    if(!f) return;
    const url = URL.createObjectURL(f);
    let cont = inp.nextElementSibling;
    // create img preview element if not exists
    if(!cont || !cont.classList || !cont.classList.contains('file-preview')){
      cont = document.createElement('img'); cont.className='thumb file-preview'; inp.parentNode.insertBefore(cont, inp.nextSibling)
    }
    cont.src = url;
  })
}
previewFile('cert-file');
previewFile('snap-file');
previewFile('profile-file');

// upload profile photo
document.getElementById('upload-profile').addEventListener('click', async ()=>{
  const f = document.getElementById('profile-file').files[0];
  if(!f) return showToast('Choose a file', 'error');
  const fd = new FormData(); fd.append('file', f); fd.append('kind','profile');
  let res;
  try{ res = await fetch('/api/upload',{method:'POST',body:fd}); }catch(e){ showToast('Network error', 'error'); return }
  if(res.status === 401){ showToast('Unauthorized — please login', 'error'); window.location.href = '/admin/login'; return }
  let j;
  try{ j = await res.json(); }catch(e){ showToast('Server error', 'error'); return }
  if(j.ok){
    showToast('Uploaded', 'success');
    // refresh server copy and update preview
    const r = await fetch('/api/data'); current = await r.json();
    document.getElementById('profile-preview').src = current.profile && current.profile.picture_thumb ? current.profile.picture_thumb : (j.thumb || j.url);
    render();
    autosave();
  }else showToast('Upload error', 'error');
})
document.getElementById('add-event').addEventListener('click', ()=>{
  (async ()=>{
    const v = document.getElementById('event-input').value.trim();
    if(!v) return; current.events = current.events || [];
    const desc = await showDescriptionModal('Event description (optional)');
    current.events.push({name: v, description: desc}); document.getElementById('event-input').value=''; render(); autosave();
  })();
})

// upload event image
const uploadEventBtn = document.getElementById('upload-event');
if(uploadEventBtn){
  uploadEventBtn.addEventListener('click', async ()=>{
    const f = document.getElementById('event-file').files[0];
    if(!f) return showToast('Choose a file', 'error');
    const fd = new FormData(); fd.append('file', f); fd.append('kind','event');
    const res = await fetch('/api/upload',{method:'POST',body:fd});
    const j = await res.json();
    if(j.ok){
      const desc = await showDescriptionModal('Description for this event (optional)');
      const r = await fetch('/api/data'); current = await r.json();
      const ev = (current.events||[]).find(e=> e.url === j.url || e.name === j.name);
      if(ev && desc){ ev.description = desc; await fetch('/api/data',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(current)}); }
      showToast('Event uploaded', 'success'); render(); autosave();
    }else showToast('Upload error', 'error')
  })
}

// upload resume
const uploadResumeBtn = document.getElementById('upload-resume');
if(uploadResumeBtn){
  uploadResumeBtn.addEventListener('click', async ()=>{
    const f = document.getElementById('resume-file').files[0];
    if(!f) return showToast('Choose a resume file', 'error');
    const fd = new FormData(); fd.append('file', f); fd.append('kind','resume');
    const res = await fetch('/api/upload',{method:'POST',body:fd});
    const j = await res.json();
    if(j.ok){
      // refresh data
      const r = await fetch('/api/data'); current = await r.json();
      showToast('Resume uploaded', 'success'); render(); autosave();
    }else showToast('Upload error', 'error')
  })
}

// Update changes button: persist all current changes
const updateBtn = document.getElementById('update-changes');
if(updateBtn){
  updateBtn.addEventListener('click', async ()=>{
    updateBtn.disabled = true;
    const ok = await saveData(true);
    updateBtn.disabled = false;
    if(ok) showToast('All changes saved', 'success');
  })
}

// Description modal helper
function showDescriptionModal(title){
  return new Promise((resolve)=>{
    const modal = document.getElementById('desc-modal');
    const textarea = document.getElementById('desc-modal-text');
    const ok = document.getElementById('desc-modal-ok');
    const cancel = document.getElementById('desc-modal-cancel');
    const h = document.getElementById('desc-modal-title');
    h.textContent = title || 'Description';
    textarea.value = '';
    modal.style.display = 'block'; modal.setAttribute('aria-hidden','false');
    function cleanup(){ modal.style.display='none'; modal.setAttribute('aria-hidden','true'); ok.removeEventListener('click',okFn); cancel.removeEventListener('click',cancelFn); }
    function okFn(){ const v = textarea.value.trim(); cleanup(); resolve(v); }
    function cancelFn(){ cleanup(); resolve(null); }
    ok.addEventListener('click', okFn);
    cancel.addEventListener('click', cancelFn);
  });
}

// auto-load on open
loadBtn.click();

// UI mode handling (persisted)
function applyMode(mode){
  document.body.classList.remove('mode-ultra','mode-glam','mode-subtle','mode-lottie');
  if(mode) document.body.classList.add(mode);
  localStorage.setItem('ui-mode', mode || '');
}
const savedMode = localStorage.getItem('ui-mode');
function setActiveModeButton(mode){
  modeButtons.forEach(b=> b.classList.toggle('active', b.dataset.mode === mode));
}
if(savedMode) { applyMode(savedMode); setActiveModeButton(savedMode); }
// apply saved mode from server-side current if available after load
async function applySavedServerMode(){
  try{
    const res = await fetch('/api/data');
    if(res.ok){
      const d = await res.json();
      if(d && d.ui_mode){
        const m = 'mode-' + d.ui_mode;
        applyMode(m);
        setActiveModeButton(m);
      }
    }
  }catch(e){}
}
applySavedServerMode();

modeButtons.forEach(b=> b.addEventListener('click', async (e)=>{ 
  // dataset.mode may be 'mode-ultra' or just 'ultra' depending on markup; normalize
  let modeClass = b.dataset.mode || '';
  if(!modeClass) return;
  if(!modeClass.startsWith('mode-') && !modeClass.startsWith('ultra') && !modeClass.startsWith('glam') && !modeClass.startsWith('subtle') && !modeClass.startsWith('lottie')){
    modeClass = 'mode-' + modeClass;
  }
  // ensure the class we add matches CSS expectations (mode-...)
  if(!modeClass.startsWith('mode-')) modeClass = 'mode-' + modeClass.replace(/^mode-/,'');
  applyMode(modeClass); 
  setActiveModeButton(modeClass); 
  showToast('UI mode applied', 'success');
  // persist on server as short name (strip 'mode-') and perform immediate save
  const short = modeClass.replace('mode-','');
  current.ui_mode = short;
  // call saveData directly so we can show success/failure immediately
  const ok = await saveData(true);
  if(!ok){ showToast('Failed to persist UI mode', 'error'); }
}))
clearModeBtn && clearModeBtn.addEventListener('click', ()=>{ applyMode(''); setActiveModeButton(''); showToast('UI mode cleared', 'info'); })
