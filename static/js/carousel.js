// Simple carousel for certs/snaps/events. Elements expected:
// .cert-carousel with .cert-post children, controls with ids like cert-next, cert-prev and details container id cert-details
function wireCarousel(prefix){
  try{
    const carousel = document.getElementById(prefix + '-carousel');
    if(!carousel) return;
    const posts = Array.from(carousel.querySelectorAll('.cert-post'));
    let idx = 0;
    function show(i){
      idx = (i + posts.length) % posts.length;
      posts.forEach((p,j)=>{
        p.style.transform = `translateX(${100*(j-idx)}%)`;
        p.style.opacity = j===idx? '1':'0.3';
      })
      // populate details
      const data = window.PAGE_DATA && window.PAGE_DATA[prefix] ? window.PAGE_DATA[prefix][idx] : null;
      const detailsEl = document.getElementById(prefix + '-details');
      if(detailsEl){
        if(data){
          detailsEl.innerHTML = `<h3>${data.name || data.title || 'Item'}</h3><p>${data.description || data.desc || ''}</p>`;
        }else{
          detailsEl.innerHTML = '';
        }
      }
    }
    // initial layout
    posts.forEach((p,i)=>{ p.style.transition='transform .48s cubic-bezier(.2,.9,.2,1),opacity .3s'; p.style.position='relative'; p.style.display='inline-block'; p.style.minWidth='100%'; });
    show(0);
    // bind controls
    const next = document.getElementById(prefix + '-next');
    const prev = document.getElementById(prefix + '-prev');
    next && next.addEventListener('click', ()=> show(idx+1));
    prev && prev.addEventListener('click', ()=> show(idx-1));
    // keyboard left/right
    document.addEventListener('keydown',(e)=>{ if(e.key==='ArrowRight') show(idx+1); if(e.key==='ArrowLeft') show(idx-1); })
    // touch / swipe support
    let startX = 0, deltaX = 0, touching = false;
    carousel.addEventListener('touchstart', (ev)=>{ touching = true; startX = ev.touches[0].clientX; deltaX = 0; }, {passive:true});
    carousel.addEventListener('touchmove', (ev)=>{ if(!touching) return; deltaX = ev.touches[0].clientX - startX; }, {passive:true});
    carousel.addEventListener('touchend', (ev)=>{ touching = false; if(Math.abs(deltaX) > 40){ if(deltaX < 0) show(idx+1); else show(idx-1); } startX = 0; deltaX = 0; });

    // click to zoom modal
    function ensureZoom(){
      if(document.getElementById('zoom-modal')) return document.getElementById('zoom-modal');
      const modal = document.createElement('div'); modal.id='zoom-modal'; modal.className='zoom-modal'; modal.innerHTML = `<div class="zoom-frame"><button id="zoom-close" class="btn small ghost">Close</button><img id="zoom-img" src="" alt="zoom"/></div>`; document.body.appendChild(modal);
      modal.addEventListener('click',(e)=>{ if(e.target === modal) modal.classList.remove('open'); });
      document.getElementById('zoom-close').addEventListener('click', ()=> modal.classList.remove('open'));
      return modal;
    }
    posts.forEach(p=>{
      const img = p.querySelector('img');
      if(img){ img.style.cursor='zoom-in'; img.addEventListener('click', ()=>{
        const modal = ensureZoom();
        document.getElementById('zoom-img').src = img.src;
        modal.classList.add('open');
      })}
    })
  }catch(err){ console.warn('carousel', err) }
}

document.addEventListener('DOMContentLoaded', ()=>{
  wireCarousel('cert');
  wireCarousel('snap');
  wireCarousel('event');
  // live update via Server-Sent Events
  try{
    if(typeof(EventSource) !== 'undefined'){
      const es = new EventSource('/stream');
      es.addEventListener('processed', async (ev)=>{
        try{
          const data = JSON.parse(ev.data);
          // update local PAGE_DATA arrays
          if(data.kind === 'certificates' || data.kind === 'cert'){
            window.PAGE_DATA = window.PAGE_DATA || {};
            window.PAGE_DATA.cert = window.PAGE_DATA.cert || [];
            window.PAGE_DATA.cert.push({name: data.name, url: data.url, thumb: data.thumb});
            // re-wire the carousel to include the new element (reload page data)
            setTimeout(()=> wireCarousel('cert'), 100);
          }
          if(data.kind === 'snaps' || data.kind === 'snap'){
            window.PAGE_DATA = window.PAGE_DATA || {};
            window.PAGE_DATA.snap = window.PAGE_DATA.snap || [];
            window.PAGE_DATA.snap.push({name: data.name, url: data.url, thumb: data.thumb});
            setTimeout(()=> wireCarousel('snap'), 100);
          }
          if(data.kind === 'events' || data.kind === 'event'){
            window.PAGE_DATA = window.PAGE_DATA || {};
            window.PAGE_DATA.event = window.PAGE_DATA.event || [];
            window.PAGE_DATA.event.push({name: data.name, url: data.url, thumb: data.thumb});
            setTimeout(()=> wireCarousel('event'), 100);
          }
        }catch(e){ console.warn('sse processed parse', e) }
      });
    }
  }catch(e){ console.warn('SSE not supported', e) }
});
