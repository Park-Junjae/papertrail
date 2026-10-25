/* Read-only static collections. No model calls, ranking, or weekly mutations. */
(function () {
  "use strict";
  const I = window.PaperIdentity;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function url(value) { try { const u=new URL(value); return ['http:','https:'].includes(u.protocol) ? u.href : '#'; } catch (_) { return '#'; } }
  const specialMode=document.body.dataset.collection === 'special';
  let papers=[],history={events:[],historyStatus:'pending'},special={},lookup=I.index(),limit=12;
  let saved;
  try { const data=JSON.parse(localStorage.getItem('papertrail:saved') || '[]'); saved=new Set(Array.isArray(data)?data:[]); } catch (_) {saved=new Set();}
  const keys=p => [p.id,...(I.match(p,lookup)?.savedKeys || p.savedKeys || [])];
  const isSaved=p => keys(p).some(k=>saved.has(k));
  const historyFor=p => I.events(p,lookup,history);
  const matchesStatus=(p,status)=>!status || (status==='recorded' ? historyFor(p).length>0 : historyFor(p).length===0);
  function historyMarkup(p) {
    if (history.historyStatus==='pending') return '<p class="meeting-history" lang="ko">발표 이력 미등록</p>';
    const events=historyFor(p), canonical=I.match(p,lookup);
    if (!events.length) return '<p class="meeting-history" lang="ko">발표 기록 없음 · 제공 목록 기준</p>';
    return `<p class="meeting-history" lang="ko"><a href="./journal-meetings.html?paper=${encodeURIComponent(canonical.id)}">발표 기록 ${events.length}건 · ${esc(events.map(e=>e.presentedAt || '날짜 미상').join(', '))}</a></p>`;
  }
  function eventMarkup(p) {
    const events=historyFor(p);
    return events.length ? `<ul class="meeting-events" lang="ko">${events.map(e=>`<li>${esc(e.presentedAt || '날짜 미상')}${e.presentedAt?' · 폴더 표기':''}${e.dateNoteKo?' · '+esc(e.dateNoteKo):''}</li>`).join('')}</ul>` : '';
  }
  function card(p,index) {
    const year=p.firstPublishedOnline || p.publicationYear || '연도 미상';
    const summary=specialMode && p.keyFindingKo ? `<p class="paper-summary korean-copy" lang="ko">${esc(p.keyFindingKo)}</p>` : '';
    const explanation=specialMode ? `<details><summary lang="ko">${p.keyFindingKo?'의미와 질문 · 출처':'서지정보 · 해석 보류'}</summary>
      ${p.scientificSignificanceKo?`<p class="analysis-label" lang="ko">왜 중요한가</p><p lang="ko">${esc(p.scientificSignificanceKo)}</p>`:''}
      ${p.evidenceLimitationsKo?`<p class="analysis-label" lang="ko">생각해볼 질문</p><p lang="ko">${esc(p.evidenceLimitationsKo)}</p>`:''}
      <p class="source-evidence" lang="ko">${p.keyFindingKo?'공개 초록 중심 요약 · 전문 전체 리뷰 아님':'제목·저널·온라인 게재일 확인 · 과학적 해석 미완료'}</p>
      ${(p.sourceEvidence||[]).map(s=>`<a class="source-evidence" href="${esc(url(s.url))}" target="_blank" rel="noopener noreferrer">확인 출처 · ${esc(s.checkedAt)}</a>`).join(' · ')}</details>` : eventMarkup(p);
    return `<article class="paper-card" id="${esc(p.id)}"><div class="paper-index">${String(index+1).padStart(2,'0')}</div>
      <div class="paper-main"><p class="journal-citation">${esc(p.journal || '저널 미확인')}</p>
      <h3>${p.url?`<a href="${esc(url(p.url))}" target="_blank" rel="noopener noreferrer">${esc(p.title)}</a>`:esc(p.title)}</h3>
      <p class="paper-meta">${esc(year)}${p.doi?' · '+esc(p.doi):''}</p>
      ${specialMode && p.authors?.length?`<p class="paper-meta">${esc(p.authors.slice(0,3).join(', '))}${p.authors.length>3?' et al.':''}</p>`:''}
      ${summary}${specialMode?`<div class="keyword-list">${(p.topics||[]).map(t=>`<span class="keyword">${esc(special.topics?.[t]||t)}</span>`).join('')}</div>`:''}
      ${historyMarkup(p)}${explanation}
      ${!specialMode && p.specialIssueId?`<p><a class="detail-link" href="./special.html?paper=${encodeURIComponent(p.specialIssueId)}">One-Year Special</a></p>`:''}</div>
      <aside class="paper-side"><button class="utility-button collection-save" data-save="${esc(p.id)}" aria-label="${isSaved(p)?'Unsave':'Save'} paper" title="${isSaved(p)?'Unsave':'Save'} paper" aria-pressed="${isSaved(p)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 3.5h11v17l-5.5-3.7-5.5 3.7z"/></svg></button></aside></article>`;
  }
  function filtered() {
    const query=I.title($('collection-search').value), journal=$('journal-filter').value,topic=$('topic-filter')?.value;
    const status=$('history-filter').value,year=$('year-filter')?.value,meetingYear=$('meeting-year-filter')?.value;
    return papers.filter(p=> {
      const text=I.title([p.title,p.doi,p.journal,...(p.authors||[]).map(a=>typeof a==='string'?a:a.name||''),...(p.topics||[])].join(' '));
      return (!query||text.includes(query))&&(!journal||p.journal===journal)&&(!topic||p.topics?.includes(topic))&&matchesStatus(p,status)
        &&(!year||String(p.publicationYear || p.firstPublishedOnline?.slice(0,4))===year)
        &&(!meetingYear||historyFor(p).some(e=>e.presentedAt?.slice(0,4)===meetingYear))
        &&(!$('saved-filter').checked||isSaved(p))&&(!$('type-filter')?.value||p.articleType===$('type-filter').value);
    }).sort((a,b)=> {
      if ($('sort-filter').value==='title') return a.title.localeCompare(b.title);
      const d = specialMode ? p=>p.firstPublishedOnline||'' : p=>historyFor(p).map(e=>e.presentedAt||'').sort().at(-1)||'';
      return d(b).localeCompare(d(a))||a.title.localeCompare(b.title);
    });
  }
  function render() {
    const selected=filtered();
    $('result-count').textContent=`${selected.length.toLocaleString()} papers`;
    $('collection-list').innerHTML=selected.slice(0,limit).map(card).join('');
    $('empty-message').hidden=selected.length>0;
    $('collection-more').hidden=selected.length<=limit;
    $('saved-count').textContent=saved.size;
  }
  function options(id,values,label) {
    if (!$(id)) return;
    $(id).innerHTML=`<option value="">${esc(label)}</option>`+[...new Set(values.filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');
  }
  async function get(path) {const response=await fetch(path,{cache:'no-store'}); if(!response.ok)throw new Error(`HTTP ${response.status}: ${path}`);return response.json();}
  async function init() {
    try {
      const [catalog,hist]=await Promise.all([get('./data/meeting_archive_catalog.json'),get('./data/journal_meetings.json')]);
      lookup=I.index(catalog.papers || []); history=hist;
      if (specialMode) {
        special=await get('./data/special/genome_editing_2025_2026.json');papers=special.papers || [];
        $('collection-stats').textContent=`${papers.length} verified papers · ${special.journalScope.journals.length} configured journals · Updated ${special.updatedAt}`;
        $('topic-counts').textContent=Object.entries(special.counts.byTopic).map(([t,n])=>`${special.topics[t]} ${n}`).join(' · ')+' · 주제별 수는 중복 집계됩니다.';
        $('overview').innerHTML=(special.overview||[]).map(o=>`<div><h3 lang="ko">${esc(o.titleKo)}</h3><p lang="ko">${esc(o.textKo)}</p></div>`).join('');
        $('highlights').innerHTML=papers.filter(p=>p.highlight).map(p=>`<li><a href="?paper=${encodeURIComponent(p.id)}#catalog">${esc(p.title)}</a></li>`).join('');
        $('journal-scope').textContent=special.journalScope.journals.join(' · ');
        $('topic-filter').innerHTML='<option value="">All topics</option>'+Object.entries(special.topics).map(([k,v])=>`<option value="${esc(k)}">${esc(v)}</option>`).join('');
      } else {
        papers=catalog.papers || [];
        $('collection-stats').textContent=`${papers.length} indexed papers · ${(history.events||[]).length} supplied records · Updated ${history.updatedAt || ''}`;
        options('meeting-year-filter',(history.events||[]).map(e=>e.presentedAt?.slice(0,4)),'All years');
      }
      options('journal-filter',papers.map(p=>p.journal),'All journals');
      options('year-filter',papers.map(p=>String(p.publicationYear||p.firstPublishedOnline?.slice(0,4)||'')),'All years');
      if (history.historyStatus==='pending') {$('history-filter').value='';$('history-filter').disabled=true;}
      const params=new URLSearchParams(location.search),target=params.get('paper');
      const found=papers.find(p=>p.id===target);
      if(found){$('collection-search').value=found.doi||found.title;$('history-filter').value='';}
      $('collection-loading').hidden=true;render();
      if(found) requestAnimationFrame(()=>$('catalog').scrollIntoView());
    } catch(error) {$('collection-loading').textContent='자료를 불러오지 못했습니다. '+error.message;}
  }
  document.addEventListener('DOMContentLoaded',()=> {
    $('collection-filters').addEventListener('input',event=>{if(event.target.id==='collection-search'){limit=12;render();}});
    $('collection-filters').addEventListener('change',event=>{if(event.target.id!=='collection-search'){limit=12;render();}});
    $('collection-more').addEventListener('click',()=>{limit+=12;render();});
    $('collection-saved-nav').addEventListener('click',()=>{$('saved-filter').checked=true;limit=12;render();$('catalog').scrollIntoView();});
    $('reset-filters').addEventListener('click',()=>{$('collection-filters').reset();limit=12;render();});
    $('collection-list').addEventListener('click',event=> {
      const button=event.target.closest('[data-save]');if(!button)return;
      const p=papers.find(p=>p.id===button.dataset.save);
      if(isSaved(p)) keys(p).forEach(k=>saved.delete(k));else saved.add(p.id);
      try{localStorage.setItem('papertrail:saved',JSON.stringify([...saved]));}catch(_){}
      render();
    });
    $('mobile-menu-button').addEventListener('click',()=>{const open=$('mobile-menu-button').getAttribute('aria-expanded')!=='true';$('mobile-menu-button').setAttribute('aria-expanded',String(open));$('nav-links').classList.toggle('is-open',open);});
    init();
  });
})();
