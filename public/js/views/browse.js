/* ---------------------------------------------------------------------------
   Browse View — #/browse
   --------------------------------------------------------------------------- */
function renderBrowse(container) {
  const savedMode = localStorage.getItem('engnotes_browse_mode') || 'list';
  container.innerHTML = `
    <div class="page-header"><h2>Browse Notes</h2><p>Filter by category, search, and view your collection.</p></div>
    <div class="search-input"><span class="icon"></span><input type="text" id="browseSearch" placeholder="Search notes..." autocomplete="off"></div>
    <div class="flex-between" style="margin-bottom:var(--space-sm);flex-wrap:wrap;gap:var(--space-sm)">
      <div class="filter-pills" id="categoryPills">
        <button class="pill active" data-cat="all">All</button>
        <button class="pill" data-cat="word">Word</button>
        <button class="pill" data-cat="phrase">Phrase</button>
        <button class="pill" data-cat="sentence_pattern">Pattern</button>
        <button class="pill" data-cat="idiom">Idiom</button>
        <button class="pill" data-cat="common_usage">Usage</button>
        <button class="pill" data-cat="favorites">★ Favorites</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-shrink:0">
        <div style="display:flex;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
          <button class="view-mode-btn ${savedMode==='list'?'active':''}" data-mode="list" style="padding:6px 14px;font-size:var(--font-size-sm);font-weight:500;background:${savedMode==='list'?'var(--primary)':'var(--card-bg)'};color:${savedMode==='list'?'#fff':'var(--text-secondary)'};border:none;cursor:pointer">List</button>
          <button class="view-mode-btn ${savedMode==='notebook'?'active':''}" data-mode="notebook" style="padding:6px 14px;font-size:var(--font-size-sm);font-weight:500;background:${savedMode==='notebook'?'var(--primary)':'var(--card-bg)'};color:${savedMode==='notebook'?'#fff':'var(--text-secondary)'};border:none;cursor:pointer">Notebook</button>
        </div>
        <span style="color:var(--text-tertiary);font-size:var(--font-size-xs);user-select:none">|</span>
        <button class="view-mode-btn" data-mode="select" style="padding:6px 14px;font-size:var(--font-size-sm);font-weight:500;background:transparent;color:var(--text-secondary);border:1px solid var(--border);border-radius:var(--radius-sm);cursor:pointer">Select</button>
      </div>
    </div>
    <div class="flex-between" style="margin-bottom:var(--space-md)">
      <span id="resultCount" class="text-secondary" style="font-size:var(--font-size-sm)"></span>
      <select id="sortSelect" style="padding:6px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);font-size:var(--font-size-sm);background:var(--card-bg);color:var(--text)">
        <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="review">Next review</option>
      </select>
    </div>
    <div id="selectBar" style="display:none;background:var(--primary-bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:var(--space-md);margin-bottom:var(--space-md);z-index:50">
      <div class="flex-between" style="flex-wrap:wrap;gap:var(--space-sm)">
        <span id="selectCount" style="font-weight:600;font-size:var(--font-size-sm)"></span>
        <div style="display:flex;gap:var(--space-sm);flex-wrap:wrap">
          <button class="btn btn--outline btn--sm" id="selectUnexpandedBtn">Select All Unexpanded</button>
          <button class="btn btn--primary btn--sm" id="batchExpandBtn">Expand Selected</button>
          <button class="btn btn--ghost btn--sm" id="cancelSelectBtn">Cancel</button>
        </div>
      </div>
    </div>
    <div id="noteList"><div class="empty-state"><div class="icon">Browse</div><h3>No notes yet</h3><p>Start by adding your first English entry!</p></div></div>
  `;

  let currentCat='all', currentSearch='', currentSort='newest', currentMode=savedMode;
  let selectedIds = new Set();

  async function refreshList() {
    let notes = await getAllNotes();
    if (currentMode==='list' && currentCat==='favorites') notes = notes.filter(n => n.favorited);
    else if (currentMode==='list' && currentCat!=='all') notes = notes.filter(n => n.category===currentCat);
    if (currentSearch) { const q=currentSearch.toLowerCase(); notes=notes.filter(n=>n.content.toLowerCase().includes(q)||(n.userMemo&&n.userMemo.toLowerCase().includes(q))||(n.aiDefinition&&n.aiDefinition.toLowerCase().includes(q))||(n.aiChineseTranslation&&n.aiChineseTranslation.toLowerCase().includes(q))); }
    if (currentSort==='newest') notes.sort((a,b)=>b.createdAt-a.createdAt);
    else if (currentSort==='oldest') notes.sort((a,b)=>a.createdAt-b.createdAt);
    else notes.sort((a,b)=>a.nextReviewAt-b.nextReviewAt);
    const list=document.getElementById('noteList'), countEl=document.getElementById('resultCount');
    if (currentMode==='notebook') renderNotebook(notes,list,countEl);
    else if (currentMode==='select') renderSelectList(notes,list,countEl);
    else renderListView(notes,list,countEl);
  }

  function renderListView(notes,list,countEl) {
    countEl.textContent=`${notes.length} note${notes.length!==1?'s':''}`;
    if (!notes.length) { list.innerHTML=`<div class="empty-state"><div class="icon">${currentCat!=='all'?'':'Empty'}</div><h3>${currentSearch?'No matches':'No notes in this category'}</h3><p>${currentSearch?'Try a different search term.':'Add some notes to see them here.'}</p></div>`; return; }
    list.innerHTML=notes.map(n=>{
      const catInfo=categoryInfo(n.category||'');
      return `<div class="swipe-wrapper" data-id="${n.id}"><div class="swipe-actions"><button class="swipe-btn swipe-btn--fav" data-action="fav">★</button><button class="swipe-btn swipe-btn--del" data-action="del">✕</button></div><div class="swipe-card-inner"><div class="note-card"><div class="note-card__body"><div class="note-card__content">${escapeHtml(n.content)}${n.favorited?' <span style="color:var(--warning)">★</span>':''}</div>${n.userMemo?`<div class="note-card__memo">${escapeHtml(n.userMemo)}</div>`:''}${n.aiChineseTranslation?`<div class="note-card__meta">${escapeHtml(n.aiChineseTranslation)}</div>`:''}</div><span class="badge ${n.category?'badge--'+n.category:''}" style="flex-shrink:0;${!n.category?'background:var(--border);color:var(--text-secondary)':''}">${n.category?catInfo.label:'···'}</span></div></div></div>`; }).join('');
    // Card click navigation
    list.querySelectorAll('.note-card').forEach(card=>{card.addEventListener('click',()=>{const wrapper=card.closest('.swipe-wrapper');if(wrapper&&wrapper.dataset.swiped==='1')return;location.hash='#/note/'+wrapper.dataset.id;});});
    // Swipe action buttons
    list.querySelectorAll('.swipe-btn').forEach(btn=>{btn.addEventListener('click',async e=>{e.stopPropagation();const wrapper=btn.closest('.swipe-wrapper');const id=wrapper.dataset.id;if(btn.dataset.action==='fav'){const note=await getNote(id);await updateNote(id,{favorited:!note.favorited});closeSwipe(wrapper);refreshList();showToast(note.favorited?'Unfavorited':'Favorited!','success');}else if(btn.dataset.action==='del'){const confirmed=await confirmDialog('Delete Note','Delete this note? This cannot be undone.','Delete',true);if(confirmed){await deleteNote(id);refreshList();showToast('Note deleted','success');}}});});
    // Swipe touch handlers
    attachSwipeHandlers(list);
  }

  function attachSwipeHandlers(list) {
    list.querySelectorAll('.swipe-card-inner').forEach(inner=>{
      let startX=0, startY=0, currentX=0, swiping=false;
      inner.addEventListener('touchstart',e=>{if(e.target.closest('.swipe-btn'))return;startX=e.touches[0].clientX;startY=e.touches[0].clientY;currentX=0;swiping=true;inner.style.transition='none';},{passive:true});
      inner.addEventListener('touchmove',e=>{if(!swiping)return;const dx=e.touches[0].clientX-startX;const dy=e.touches[0].clientY-startY;if(Math.abs(dy)>Math.abs(dx)&&Math.abs(dy)>10){swiping=false;inner.style.transition='';inner.style.transform='';return;}if(dx<0){currentX=Math.max(dx,-130);inner.style.transform=`translateX(${currentX}px)`;}e.preventDefault();},{passive:false});
      inner.addEventListener('touchend',()=>{if(!swiping){inner.style.transition='';inner.style.transform='';return;}swiping=false;inner.style.transition='transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)';const wrapper=inner.closest('.swipe-wrapper');if(currentX<-60){inner.style.transform='translateX(-130px)';wrapper.dataset.swiped='1';}else{inner.style.transform='translateX(0)';wrapper.dataset.swiped='0';}});
    });
    // Close any open swipe on tap elsewhere in the list
    list.addEventListener('click',e=>{const clickedInner=e.target.closest('.swipe-card-inner');list.querySelectorAll('.swipe-card-inner').forEach(inner=>{if(inner!==clickedInner){closeSwipe(inner.closest('.swipe-wrapper'));}});});
  }

  function closeSwipe(wrapper) {
    if(!wrapper||wrapper.dataset.swiped!=='1')return;
    const inner=wrapper.querySelector('.swipe-card-inner');
    inner.style.transition='transform 0.25s cubic-bezier(0.25,0.46,0.45,0.94)';
    inner.style.transform='translateX(0)';
    wrapper.dataset.swiped='0';
  }

  function updateSelectBar() {
    const bar = document.getElementById('selectBar');
    const countEl = document.getElementById('selectCount');
    if (bar) bar.style.display = currentMode==='select'?'block':'none';
    if (countEl) countEl.textContent = `${selectedIds.size} selected`;
  }

  function renderSelectList(notes, list, countEl) {
    countEl.textContent = `${notes.length} note${notes.length!==1?'s':''} · Select mode`;
    if (!notes.length) {
      list.innerHTML = `<div class="empty-state"><h3>No notes</h3></div>`;
      updateSelectBar();
      return;
    }
    list.innerHTML = notes.map(n => {
      const catInfo = categoryInfo(n.category||'');
      const checked = selectedIds.has(n.id) ? 'checked' : '';
      return `<div class="note-card select-card" data-id="${n.id}" style="cursor:pointer">
        <input type="checkbox" class="select-checkbox" ${checked} style="margin-right:var(--space-md);width:20px;height:20px;accent-color:var(--primary);flex-shrink:0;pointer-events:none">
        <div class="note-card__body">
          <div class="note-card__content">${escapeHtml(n.content)}${n.favorited?' ★':''}</div>
          ${n.aiChineseTranslation?`<div class="note-card__meta">${escapeHtml(n.aiChineseTranslation)}</div>`:''}
        </div>
        <span class="badge ${n.category?'badge--'+n.category:''}" style="flex-shrink:0;${!n.category?'background:var(--border);color:var(--text-secondary)':''}">${n.category?catInfo.label:'···'}</span>
      </div>`;
    }).join('');
    list.querySelectorAll('.select-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.dataset.id;
        const cb = card.querySelector('.select-checkbox');
        if (selectedIds.has(id)) { selectedIds.delete(id); cb.checked = false; }
        else { selectedIds.add(id); cb.checked = true; }
        updateSelectBar();
      });
    });
    updateSelectBar();
  }

  // Select all unexpanded
  document.getElementById('selectUnexpandedBtn')?.addEventListener('click', async () => {
    const notes = await getAllNotes();
    if (currentCat==='favorites') notes = notes.filter(n => n.favorited);
    else if (currentCat!=='all') notes = notes.filter(n => n.category===currentCat);
    const unexpanded = notes.filter(n => !n.aiExpanded);
    if (!unexpanded.length) {
      showToast('All notes are already expanded!', 'success');
      return;
    }
    unexpanded.forEach(n => selectedIds.add(n.id));
    showToast(`${unexpanded.length} unexpanded note${unexpanded.length!==1?'s':''} selected`, 'success');
    refreshList();
  });

  // Batch expand handler
  document.getElementById('batchExpandBtn')?.addEventListener('click', async () => {
    if (!selectedIds.size) { showToast('Select at least one note', 'error'); return; }
    const btn = document.getElementById('batchExpandBtn');
    btn.disabled = true;
    let done = 0, failed = 0;
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        const note = await getNote(id);
        const result = await aiExpand(note.content, note.category||'common_usage');
        await updateNote(id, {
          aiExpanded: true, aiExpandedAt: Date.now(),
          aiChineseTranslation: result.chineseTranslation||null,
          aiDefinition: result.definition||null,
          aiDefinitionEn: result.definitionEn||null,
          aiExamples: result.examples||[],
          aiEtymology: result.etymology||null,
          aiRelatedExpressions: result.relatedExpressions||[],
        });
        done++;
      } catch { failed++; }
      btn.textContent = `Expanding ${done+failed} of ${ids.length}...`;
    }
    btn.disabled = false;
    btn.textContent = 'Expand Selected';
    selectedIds = new Set();
    currentMode = 'list';
    localStorage.setItem('engnotes_browse_mode','list');
    document.getElementById('selectBar').style.display = 'none';
    container.querySelectorAll('.view-mode-btn').forEach(b=>{const isSelect=b.dataset.mode==='select';if(isSelect){b.style.background='transparent';b.style.color='var(--text-secondary)';b.style.borderColor='var(--border)';}else{b.style.background=b.dataset.mode==='list'?'var(--primary)':'var(--card-bg)';b.style.color=b.dataset.mode==='list'?'#fff':'var(--text-secondary)';}});
    showToast(`Expanded ${done} note${done!==1?'s':''}!${failed?' ('+failed+' failed)':''}`, 'success');
    refreshList();
  });

  document.getElementById('cancelSelectBtn')?.addEventListener('click', () => {
    currentMode = 'list';
    selectedIds = new Set();
    document.getElementById('selectBar').style.display = 'none';
    container.querySelectorAll('.view-mode-btn').forEach(b=>{const isSelect=b.dataset.mode==='select';if(isSelect){b.style.background='transparent';b.style.color='var(--text-secondary)';b.style.borderColor='var(--border)';}else{b.style.background=b.dataset.mode==='list'?'var(--primary)':'var(--card-bg)';b.style.color=b.dataset.mode==='list'?'#fff':'var(--text-secondary)';}});
    refreshList();
  });

  function renderNotebook(notes,list,countEl) {
    const total=notes.length; countEl.textContent=`${total} note${total!==1?'s':''} · Notebook view`;
    const categoryOrder=['word','phrase','sentence_pattern','idiom','common_usage'];
    const grouped={}; const uncategorized=[];
    for (const cat of categoryOrder) grouped[cat]=[];
    for (const n of notes) { if (n.category&&grouped[n.category]) grouped[n.category].push(n); else uncategorized.push(n); }
    let html='';
    if (uncategorized.length) html+=renderNbSection('Uncategorized','uncategorized',uncategorized);
    for (const cat of categoryOrder) html+=renderNbSection(categoryInfo(cat).label,cat,grouped[cat]);
    if (!total) { list.innerHTML='<div class="empty-state"><div class="icon">Notebook</div><h3>'+(currentSearch?'No matches':'Your notebook is empty')+'</h3><p>'+(currentSearch?'Try a different search term.':'Add some notes to fill your notebook!')+'</p></div>'; return; }
    list.innerHTML=html;
    list.querySelectorAll('.notebook-item').forEach(item=>{item.addEventListener('click',()=>{location.hash='#/note/'+item.dataset.id;});});
  }

  function renderNbSection(title,catClass,notes) {
    const hdrCls=catClass?'nb-header--'+catClass:'nb-header--uncategorized';
    if (!notes.length) return `<div class="notebook-section"><div class="notebook-section-header ${hdrCls}">${title}<span class="nb-count">empty</span></div></div>`;
    const items=notes.map(n=>{
      const catInfo=categoryInfo(n.category||'');
      return `<div class="notebook-item" data-id="${n.id}"><div class="nb-item-main"><div class="nb-item-title">${escapeHtml(n.content)}${n.favorited?' <span style="color:var(--warning);font-size:var(--font-size-xs)">★</span>':''}${n.userMemo?'<span class="nb-memo-dot">Memo</span>':''}</div>${n.aiChineseTranslation?`<div class="nb-item-zh">${escapeHtml(n.aiChineseTranslation)}</div>`:''}</div><div class="nb-item-meta"><span class="badge ${n.category?'badge--'+n.category:''}" style="font-size:var(--font-size-xs);${!n.category?'background:var(--border);color:var(--text-secondary)':''}">${n.category?catInfo.label:'···'}</span><span>&rsaquo;</span></div></div>`;
    }).join('');
    return `<div class="notebook-section"><div class="notebook-section-header ${hdrCls}"><span>${title}</span><span class="nb-count">${notes.length} note${notes.length!==1?'s':''}</span></div><div class="nb-items-container">${items}</div></div>`;
  }

  // Mode toggle
  container.querySelectorAll('.view-mode-btn').forEach(btn=>{btn.addEventListener('click',()=>{
    currentMode=btn.dataset.mode;
    if(currentMode!=='select') localStorage.setItem('engnotes_browse_mode',currentMode);
    container.querySelectorAll('.view-mode-btn').forEach(b=>{
      const isSelect = b.dataset.mode === 'select';
      const isActive = b.dataset.mode === currentMode;
      if (isSelect) {
        b.style.background = isActive ? 'var(--primary)' : 'transparent';
        b.style.color = isActive ? '#fff' : 'var(--text-secondary)';
        b.style.borderColor = isActive ? 'var(--primary)' : 'var(--border)';
      } else {
        b.style.background = isActive ? 'var(--primary)' : 'var(--card-bg)';
        b.style.color = isActive ? '#fff' : 'var(--text-secondary)';
      }
    });
    if(currentMode==='select'){selectedIds=new Set();document.getElementById('selectBar').style.display='block';updateSelectBar();}
    else {selectedIds=new Set();document.getElementById('selectBar').style.display='none';}
    if(currentMode==='notebook'){currentCat='all';document.querySelectorAll('#categoryPills .pill').forEach(p=>p.classList.remove('active'));document.querySelector('#categoryPills .pill[data-cat="all"]')?.classList.add('active');}
    refreshList();
  });});
  // Category pills
  document.getElementById('categoryPills').addEventListener('click',e=>{const pill=e.target.closest('.pill');if(!pill)return;if(currentMode==='notebook'){currentMode='list';localStorage.setItem('engnotes_browse_mode','list');container.querySelectorAll('.view-mode-btn').forEach(b=>{const isSelect=b.dataset.mode==='select';const isActive=b.dataset.mode==='list';if(isSelect){b.style.background='transparent';b.style.color='var(--text-secondary)';b.style.borderColor='var(--border)';}else{b.style.background=isActive?'var(--primary)':'var(--card-bg)';b.style.color=isActive?'#fff':'var(--text-secondary)';}});}document.querySelectorAll('#categoryPills .pill').forEach(p=>p.classList.remove('active'));pill.classList.add('active');currentCat=pill.dataset.cat;refreshList();});
  // Search
  document.getElementById('browseSearch').addEventListener('input',debounce(e=>{currentSearch=e.target.value.trim();refreshList();},250));
  // Sort
  document.getElementById('sortSelect').addEventListener('change',e=>{currentSort=e.target.value;refreshList();});
  refreshList();
}
