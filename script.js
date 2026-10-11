document.querySelector('#year').textContent = new Date().getFullYear();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let scheduled = false;
function updateDepth() {
  scheduled = false;
  const offset = !motion.matches && innerWidth > 760 ? Math.min(scrollY, innerHeight) * 0.025 : 0;
  document.querySelector('.atmosphere').style.setProperty('--drift', `${offset}px`);
}
addEventListener('scroll', () => {
  if (!scheduled) { scheduled = true; requestAnimationFrame(updateDepth); }
}, { passive: true });
addEventListener('resize', updateDepth);
motion.addEventListener('change', updateDepth);
updateDepth();
// A finite horizontal space; empty until genuine public work is added.
const showcase = document.querySelector('.showcase');
const track = showcase.querySelector('.project-track');
const projects = window.shellProjects || [];
if (showcase.dataset.enabled === 'true' && projects.length) {
  showcase.hidden = false;
  projects.forEach((project, index) => {
    const article = document.createElement('article');
    article.className = 'project-entry';
    if (index % 2 === 1) article.classList.add('project-offset');
    article.dataset.position = String(index);
    const link = document.createElement(project.placeholder ? 'div' : 'a');
    if (project.href) link.href = project.href;
    if (project.placeholder) {
      article.classList.add('project-placeholder');
      const surface = document.createElement('div');
      surface.className = 'project-surface';
      surface.setAttribute('aria-hidden', 'true');
      link.append(surface);
    }
    link.draggable = false;
    if (project.image) {
      const image = document.createElement('img');
      image.src = project.image;
      image.alt = project.imageAlt || '';
      image.loading = 'lazy';
      image.draggable = false;
      link.append(image);
    }
    const title = document.createElement('h3');
    title.textContent = project.title;
    const description = document.createElement('p');
    description.textContent = project.description;
    link.append(title, description);
    article.append(link);
    track.append(article);
  });
  // Duplicate one sequence to cross the seam without a visible rewind.
  const originals = [...track.children];
  originals.forEach(entry => { const copy = entry.cloneNode(true); copy.setAttribute('aria-hidden', 'true'); copy.inert = true; track.append(copy); });
  const cycleWidth = () => track.children[originals.length].offsetLeft - track.children[0].offsetLeft;
  const play = showcase.querySelector('[data-action="play"]');
  let automatic = !motion.matches;
  let visible = false;
  let hovering = false;
  let speed = 0;
  let frame = 0;
  let previousTime = 0;
  let remainder = 0;
  let pointerPlayState = null;
  let drag = null;
  let suppressClick = false;
  const overflowing = () => track.scrollWidth > track.clientWidth + 1;
  function sync() {
    play.textContent = automatic ? 'Ⅱ' : '▷';
    play.setAttribute('aria-label', automatic ? '자동 이동 일시정지' : '자동 이동 재생');
    play.setAttribute('aria-pressed', String(automatic));
    showcase.querySelector('.showcase-controls').hidden = !overflowing();
  }
  function stop() { automatic = false; speed = 0; sync(); }
  function tick(time) {
    frame = 0;
    const dt = Math.min((time - previousTime) / 1000 || 0, .05);
    previousTime = time;
    const target = automatic && !hovering && !motion.matches && overflowing() ? 7 : 0;
    speed += (target - speed) * Math.min(1, dt * 8);
    if (speed > .05) {
      remainder += speed * dt;
      const pixels = Math.floor(remainder);
      if (pixels) { track.scrollLeft += pixels; remainder -= pixels; }
      const cycle = cycleWidth();
      if (cycle > 0 && track.scrollLeft >= cycle) track.scrollLeft -= cycle;
    }
    if (visible) frame = requestAnimationFrame(tick);
  }
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible && !frame) { previousTime = performance.now(); frame = requestAnimationFrame(tick); }
    if (!visible) { cancelAnimationFrame(frame); frame = 0; speed = 0; }
  }).observe(showcase);
  track.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') hovering = true; });
  track.addEventListener('pointerleave', () => { hovering = false; });
  play.addEventListener('pointerdown', () => { pointerPlayState = automatic; });
  showcase.addEventListener('focusin', event => { if (event.target !== play) stop(); });
  track.addEventListener('wheel', stop, { passive: true });
  track.addEventListener('keydown', event => {
    stop();
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault(); track.scrollBy({ left: (event.key === 'ArrowRight' ? 1 : -1) * track.clientWidth * .7, behavior: motion.matches ? 'instant' : 'smooth' });
    }
  });
  track.addEventListener('pointerdown', event => {
    stop(); suppressClick = false;
    if (event.pointerType === 'mouse' && event.button === 0) drag = { id:event.pointerId, x:event.clientX, left:track.scrollLeft };
  });
  track.addEventListener('pointermove', event => {
    if (!drag) return;
    if (Math.abs(event.clientX - drag.x) > 6) {
      suppressClick = true; track.setPointerCapture(drag.id); track.classList.add('dragging');
      track.scrollLeft = drag.left - (event.clientX - drag.x);
    }
  });
  function endDrag() { drag = null; track.classList.remove('dragging'); }
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  track.addEventListener('lostpointercapture', endDrag);
  track.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); suppressClick = false; }
    else if (event.target.closest('a')) {
      try { sessionStorage.setItem('shell-showcase-position', JSON.stringify({x:track.scrollLeft,y:scrollY})); } catch {}
    }
  }, true);
  showcase.querySelectorAll('[data-action]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.action === 'play') {
      automatic = !(pointerPlayState ?? automatic);
      pointerPlayState = null;
      if (automatic && track.scrollLeft >= cycleWidth()) track.scrollLeft %= cycleWidth();
      sync();
    } else {
      stop(); track.scrollBy({left: (button.dataset.action === 'next' ? 1 : -1) * track.clientWidth * .75,behavior:motion.matches ? 'instant' : 'smooth'});
    }
  }));
  motion.addEventListener('change', () => { if (motion.matches) stop(); });
  new ResizeObserver(sync).observe(track);
  if (performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
    try {
      const position = JSON.parse(sessionStorage.getItem('shell-showcase-position'));
      if (position) requestAnimationFrame(() => { track.scrollLeft = position.x; scrollTo({top:position.y,behavior:'instant'}); stop(); });
    } catch {}
  }
  sync();
}

// One-time reveals, grouped by meaning rather than individual words or icons.
(() => {
  if (!('IntersectionObserver' in window) || motion.matches) return;
  const targets = [...document.querySelectorAll(
    '.about .signature, .about-narrative > p, .aros-note, .affiliations, .personal-copy, .contact-copy > h2, .contact-note, .contact-links, footer, .showcase:not([hidden]) > h2, .showcase:not([hidden]) .project-track'
  )];
  const reveal = element => {
    element.classList.remove('is-waiting');
    element.dataset.revealed = 'true';
    observer.unobserve(element);
  };
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) reveal(entry.target); });
  }, { threshold: 0, rootMargin: '0px 0px -32px 0px' });
  targets.forEach(element => {
    element.classList.add('scroll-reveal');
    const rect = element.getBoundingClientRect();
    // Existing visible content and deep-link destinations remain readable at load.
    if (rect.top < innerHeight && rect.bottom > 0 || rect.bottom <= 0) {
      element.dataset.revealed = 'true';
    } else {
      element.classList.add('is-waiting');
      observer.observe(element);
    }
  });
  document.addEventListener('focusin', event => {
    const block = event.target.closest('.scroll-reveal.is-waiting');
    if (block) reveal(block);
  });
  motion.addEventListener('change', () => {
    if (motion.matches) { targets.forEach(reveal); observer.disconnect(); }
  });
})();
