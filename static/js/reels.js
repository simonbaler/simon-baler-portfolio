// Simple Reels implementation: full-screen vertical cards that autoplay and respond to swipe up/down
document.addEventListener('DOMContentLoaded', ()=>{
  const openBtn = document.getElementById('open-reels');
  const closeBtn = document.getElementById('close-reels');
  const data = (window.PAGE_DATA && window.PAGE_DATA.event) ? window.PAGE_DATA.event : [];
  let reelWrap = null;
  let idx = 0;
  let timer = null;

  function buildReels(){
    reelWrap = document.createElement('div'); reelWrap.className='reel-wrap';
    data.forEach((it,i)=>{
      const card = document.createElement('div'); card.className='reel-card';
      const img = document.createElement('img'); img.src = it.thumb || it.url || '';
      img.alt = it.name || it.title || '';
      const meta = document.createElement('div'); meta.className='reel-meta'; meta.innerHTML = `<h3>${it.name||''}</h3><p>${it.description||''}</p>`;
      card.appendChild(img); card.appendChild(meta); reelWrap.appendChild(card);
    });
    document.body.appendChild(reelWrap);
    reelWrap.addEventListener('touchstart', onTouchStart,{passive:true});
    reelWrap.addEventListener('touchmove', onTouchMove,{passive:true});
    reelWrap.addEventListener('touchend', onTouchEnd,{passive:true});
  }

  function showReel(i){
    idx = (i + data.length) % data.length;
    const cards = Array.from(reelWrap.querySelectorAll('.reel-card'));
    cards.forEach((c,j)=> c.style.transform = `translateY(${100*(j-idx)}%)`);
  }

  function startAuto(){ timer = setInterval(()=> showReel(idx+1), 3800); }
  function stopAuto(){ if(timer){ clearInterval(timer); timer=null } }

  let sy=0, dy=0, touching=false;
  function onTouchStart(e){ touching=true; sy = e.touches[0].clientY; dy=0; stopAuto(); }
  function onTouchMove(e){ if(!touching) return; dy = e.touches[0].clientY - sy; }
  function onTouchEnd(e){ touching=false; if(Math.abs(dy) > 40){ if(dy<0) showReel(idx+1); else showReel(idx-1); } startAuto(); }

  openBtn && openBtn.addEventListener('click', ()=>{
    if(!reelWrap) buildReels();
    reelWrap.classList.add('open');
    openBtn.style.display='none'; closeBtn.style.display='inline-flex';
    showReel(0); startAuto();
  });
  closeBtn && closeBtn.addEventListener('click', ()=>{
    if(reelWrap) { reelWrap.classList.remove('open'); stopAuto(); }
    openBtn.style.display='inline-flex'; closeBtn.style.display='none';
  });

  // SSE live updates: append new events when processed
  try{
    if(typeof(EventSource) !== 'undefined'){
      const es = new EventSource('/stream');
      es.addEventListener('processed', (ev)=>{
        try{
          const obj = JSON.parse(ev.data);
          if(obj.kind === 'events' || obj.kind === 'event'){
            // append to data and UI
            data.push({name: obj.name, url: obj.url, thumb: obj.thumb});
            if(reelWrap){
              const card = document.createElement('div'); card.className='reel-card';
              const img = document.createElement('img'); img.src = obj.thumb || obj.url || ''; img.alt = obj.name || '';
              const meta = document.createElement('div'); meta.className='reel-meta'; meta.innerHTML = `<h3>${obj.name||''}</h3><p></p>`;
              card.appendChild(img); card.appendChild(meta); reelWrap.appendChild(card);
            }
          }
        }catch(e){ console.warn('reels sse parse', e) }
      });
    }
  }catch(e){ console.warn('SSE not supported', e) }
});
