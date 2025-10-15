// Advanced animations for pro-level portfolio
document.addEventListener('DOMContentLoaded', function() {
  // Typewriter effect for name
  const nameEl = document.getElementById('name');
  if (nameEl) {
    const text = nameEl.textContent;
    nameEl.textContent = '';
    let i = 0;
    const typeWriter = () => {
      if (i < text.length) {
        nameEl.textContent += text.charAt(i);
        i++;
        setTimeout(typeWriter, 100);
      }
    };
    setTimeout(typeWriter, 500); // Delay start
  }

  // Particle background for ultra mode
  const createParticles = () => {
    if (!document.body.classList.contains('mode-ultra')) return;
    const container = document.createElement('div');
    container.id = 'particles';
    container.style.position = 'fixed';
    container.style.top = '0';
    container.style.left = '0';
    container.style.width = '100%';
    container.style.height = '100%';
    container.style.pointerEvents = 'none';
    container.style.zIndex = '-1';
    document.body.appendChild(container);

    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.style.position = 'absolute';
      particle.style.width = '2px';
      particle.style.height = '2px';
      particle.style.background = 'linear-gradient(45deg, #ff00c8, #00fff6)';
      particle.style.borderRadius = '50%';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.top = Math.random() * 100 + '%';
      particle.style.animation = `float ${Math.random() * 10 + 5}s linear infinite`;
      container.appendChild(particle);
    }
  };

  // Observe mode changes
  const observer = new MutationObserver(() => {
    if (document.body.classList.contains('mode-ultra')) {
      if (!document.getElementById('particles')) createParticles();
    } else {
      const particles = document.getElementById('particles');
      if (particles) particles.remove();
    }
  });
  observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });

  // Advanced hover effects
  document.querySelectorAll('.skill').forEach(skill => {
    skill.addEventListener('mouseenter', () => {
      skill.style.transform = 'scale(1.1) rotate(5deg)';
      skill.style.boxShadow = '0 10px 30px rgba(124,92,255,0.3)';
    });
    skill.addEventListener('mouseleave', () => {
      skill.style.transform = '';
      skill.style.boxShadow = '';
    });
  });

  // Parallax effect for hero
  let ticking = false;
  const parallax = () => {
    const scrolled = window.pageYOffset;
    const hero = document.querySelector('.hero');
    if (hero) {
      hero.style.transform = `translateY(${scrolled * 0.5}px)`;
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(parallax);
      ticking = true;
    }
  });

  // Staggered card reveals with advanced timing
  const cards = document.querySelectorAll('.card');
  cards.forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(50px) scale(0.95)';
    card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
  });

  const revealCards = () => {
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      if (rect.top < window.innerHeight - 100) {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0) scale(1)';
      }
    });
  };
  window.addEventListener('scroll', revealCards);
  revealCards(); // Initial check
});
