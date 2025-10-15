i // Enhanced UI enhancements: reveal animations, smooth scroll, performance optimizations
document.addEventListener('DOMContentLoaded', function(){
  // Preload critical images
  const preloadImages = ['/static/images/profile-photo.jpg', '/static/images/profile.svg'];
  preloadImages.forEach(src => {
    const img = new Image();
    img.src = src;
  });

  // Debounced scroll handler
  let scrollTimeout;
  const debouncedScroll = () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      // Additional scroll logic if needed
    }, 16); // ~60fps
  };
  window.addEventListener('scroll', debouncedScroll, { passive: true });

  document.querySelectorAll('.card').forEach((c,i)=>{
    c.style.transitionDelay = (i*60)+'ms'
    c.classList.add('enter')
    c.classList.add('reveal')
  })

  // Enhanced smooth scroll for anchors with easing
  document.querySelectorAll('a[href^="#"]').forEach(a=>{
    a.addEventListener('click', e=>{
      e.preventDefault();
      const id = a.getAttribute('href').slice(1);
      const el = document.getElementById(id);
      if(el) {
        const offsetTop = el.offsetTop;
        window.scrollTo({
          top: offsetTop - 20,
          behavior: 'smooth'
        });
      }
    })
  })

  // theme toggle (animated sun/moon)
  const toggle = document.getElementById('theme-toggle');
  const knob = toggle ? toggle.querySelector('.toggle-knob') : null;
  const applyTheme = (isLight)=>{
    document.body.classList.toggle('light', !!isLight);
    // slight CSS variable tweak for contrast (kept minimal)
    if(isLight) document.documentElement.style.setProperty('--bg1','#f5f9ff'); else document.documentElement.style.setProperty('--bg1','#061224');
    if(isLight) toggle && toggle.classList.add('is-light'); else toggle && toggle.classList.remove('is-light');
  }

  const stored = localStorage.getItem('theme');
  if(stored){
    applyTheme(stored === 'light');
  } else {
    const prefersLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight);
  }

  if(toggle){
    // click and keyboard support
    const flip = ()=>{
      const nowLight = document.body.classList.toggle('light');
      toggle.classList.toggle('is-light', nowLight);
      localStorage.setItem('theme', nowLight ? 'light' : 'dark');
      if(knob){
        knob.classList.add('bump');
        setTimeout(()=>knob.classList.remove('bump'),300);
      }
    }
    toggle.addEventListener('click', flip);
    toggle.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } })
  }
  // IntersectionObserver for reveal
  const io = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting) e.target.classList.add('visible')
    })
  },{threshold:0.12});
  document.querySelectorAll('.reveal').forEach(n=> io.observe(n));

  // Lazy-load Lottie for project cards and add pulse timing
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lottieContainers = Array.from(document.querySelectorAll('.project-lottie'));
  if(lottieContainers.length && !prefersReduced){
    // inject lottie script dynamically
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.10.1/lottie.min.js';
    script.onload = ()=>{
      const lio = new IntersectionObserver((entries)=>{
        entries.forEach(en=>{
          if(en.isIntersecting){
            const el = en.target;
            if(!el.dataset.loaded){
              const path = el.dataset.lottie;
              try{
                lottie.loadAnimation({container: el, renderer: 'svg', loop: true, autoplay: true, path: path});
                el.dataset.loaded = '1';
                // add small pulse to the parent card
                const card = el.closest('.card');
                if(card){
                  card.classList.add('pulse');
                  setTimeout(()=>card.classList.remove('pulse'), 2200);
                }
              }catch(err){console.warn('lottie load', err)}
            }
            lio.unobserve(el);
          }
        })
      }, {threshold: 0.3});
      lottieContainers.forEach(c => lio.observe(c));
    };
    document.body.appendChild(script);
  }

  // DP modal behavior
  const dpThumb = document.getElementById('profile-pic');
  const dpModal = document.getElementById('dp-modal');
  const dpFull = document.getElementById('dp-full');
  const dpClose = document.getElementById('dp-close');
  function openDp(src){
    if(!dpModal) return;
    dpFull.src = src || dpFull.src;
    dpModal.classList.add('open');
    dpModal.setAttribute('aria-hidden','false');
    // trap focus on close
    dpClose && dpClose.focus();
  }
  function closeDp(){
    if(!dpModal) return;
    dpModal.classList.remove('open');
    dpModal.setAttribute('aria-hidden','true');
  }
  if(dpThumb){
    dpThumb.addEventListener('click', ()=> openDp(dpThumb.dataset.full || dpThumb.src));
    dpThumb.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' ') openDp(dpThumb.dataset.full || dpThumb.src) })
  }
  if(dpClose){ dpClose.addEventListener('click', closeDp) }
  if(dpModal){ dpModal.addEventListener('click', (e)=>{ if(e.target === dpModal) closeDp() }) }
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') closeDp() })
  // Listen for server-sent events (ui_mode changes) to update theme live
  try{
    const es = new EventSource('/stream');
    es.addEventListener('ui_mode', (ev)=>{
      try{
        const data = JSON.parse(ev.data || '{}');
        const m = data.ui_mode || '';
        // remove any existing mode- classes
        document.body.classList.remove('mode-ultra','mode-glam','mode-subtle','mode-lottie');
        if(m) document.body.classList.add('mode-' + m);
        // persist to local preview storage
        localStorage.setItem('ui-mode', m ? ('mode-'+m) : '');
      }catch(e){console.warn('ui_mode SSE parse', e)}
    });
    // ignore other events
  }catch(e){ /* EventSource not supported or stream failed */ }

  // Contact form handler
  (function(){
    const form = document.getElementById('contact-form');
    if(form){
      form.addEventListener('submit', async function(e){
        e.preventDefault();

        // Show loading state
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;

        const formData = new FormData(form);
        try {
          const response = await fetch('/contact', {
            method: 'POST',
            body: formData
          });
          const data = await response.json();
          if (data.ok) {
            alert('Message sent successfully!');
            form.reset();
          } else {
            alert('Error: ' + (data.error || 'Failed to send message. Please try again.'));
          }
        } catch (error) {
          alert('Failed to send message. Please try again.');
          console.error('Fetch error:', error);
        } finally {
          submitBtn.textContent = originalText;
          submitBtn.disabled = false;
        }
      });
    }
  })();

  // User Info Modal
  (function(){
    const modal = document.getElementById('user-info-modal');
    const form = document.getElementById('user-info-form');
    if(!modal || !form) return;

    // Check if user info is set
    fetch('/api/user-info')
      .then(res => res.json())
      .then(data => {
        if(!data || !data.name){
          // Show modal
          modal.classList.add('open');
          modal.setAttribute('aria-hidden','false');
        }
      })
      .catch(e => console.warn('Failed to check user info', e));

    // Form submit
    form.addEventListener('submit', async function(e){
      e.preventDefault();
      const formData = new FormData(form);
      const obj = {
        role: formData.get('role'),
        name: formData.get('name'),
        details: formData.get('details')
      };
      try {
        const response = await fetch('/set-user-info', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(obj)
        });
        const data = await response.json();
        if (data.ok) {
          modal.classList.remove('open');
          modal.setAttribute('aria-hidden','true');
        } else {
          alert('Error: ' + (data.error || 'Failed to save info.'));
        }
      } catch (error) {
        alert('Failed to save info.');
        console.error('Fetch error:', error);
      }
    });
  })();
})
