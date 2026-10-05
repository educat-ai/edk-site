(() => {
  const hero = document.querySelector('#giris');
  const viewport = hero?.querySelector('.hero-slides');
  const slides = viewport ? [...viewport.querySelectorAll('.hero-slide')] : [];
  const controls = hero?.querySelector('.hero-carousel-controls');
  if (!controls || slides.length < 2) return;
  const previous = controls.querySelector('[data-hero-previous]');
  const next = controls.querySelector('[data-hero-next]');
  const pause = controls.querySelector('[data-hero-pause]');
  const count = controls.querySelector('.hero-slide-count');
  const status = hero.querySelector('.hero-carousel-status');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const delay = 6000;
  let index = 0;
  let userPaused = false;
  let hovered = false;
  let focused = hero.contains(document.activeElement);
  let timer;
  let transition;
  let queuedDirection = 0;
  let gesture;

  function stopTimer() { clearTimeout(timer); timer = undefined; }
  function updateControls() {
    const paused = userPaused || motion.matches;
    pause.disabled = motion.matches;
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', motion.matches ? 'Otomatik geçiş kapalı; hareket tercihiniz uygulanıyor' : paused ? 'Fotoğrafların otomatik geçişini başlat' : 'Fotoğrafların otomatik geçişini duraklat');
    pause.querySelector('[data-pause-icon]').hidden = paused;
    pause.querySelector('[data-play-icon]').hidden = !paused;
    count.textContent = `${index + 1} / ${slides.length}`;
    hero.dataset.heroSlide = String(index + 1);
  }
  function schedule() {
    stopTimer();
    updateControls();
    const canRun = !userPaused && !motion.matches && !hovered && !focused && !document.hidden && !transition && !gesture;
    hero.dataset.heroAutoplay = canRun ? 'running' : 'paused';
    if (canRun) timer = setTimeout(() => {
      if (motion.matches || document.hidden || userPaused || hovered || focused || gesture) schedule();
      else show(1, false);
    }, delay);
  }
  function commit(target, announce) {
    index = target;
    slides.forEach((slide, i) => {
      slide.classList.toggle('is-active', i === index);
      slide.classList.remove('is-incoming');
      slide.style.removeProperty('transform');
      slide.setAttribute('aria-hidden', String(i !== index));
    });
    viewport.classList.remove('is-moving');
    updateControls();
    if (announce) status.textContent = `Arşiv fotoğrafı ${index + 1} / ${slides.length}`;
  }
  function finish() {
    if (!transition) return;
    const pending = transition;
    transition = undefined;
    clearTimeout(pending.fallback);
    cancelAnimationFrame(pending.frame);
    pending.incoming.removeEventListener('transitionend', pending.onEnd);
    commit(pending.target, pending.announce);
    const direction = queuedDirection;
    queuedDirection = 0;
    if (direction) show(direction);
    else schedule();
  }
  function show(direction, announce = true) {
    stopTimer();
    if (transition) { queuedDirection = direction; return; }
    const target = (index + direction + slides.length) % slides.length;
    if (motion.matches || document.hidden) { commit(target, announce); schedule(); return; }
    const outgoing = slides[index];
    const incoming = slides[target];
    incoming.classList.add('is-incoming');
    incoming.style.transform = `translateX(${direction * 100}%)`;
    incoming.getBoundingClientRect();
    const pending = {target, incoming, announce};
    pending.onEnd = event => { if (event.target === incoming && event.propertyName === 'transform') finish(); };
    incoming.addEventListener('transitionend', pending.onEnd);
    transition = pending;
    hero.dataset.heroAutoplay = 'paused';
    pending.frame = requestAnimationFrame(() => {
      viewport.classList.add('is-moving');
      outgoing.style.transform = `translateX(${-direction * 100}%)`;
      incoming.style.transform = 'translateX(0)';
    });
    pending.fallback = setTimeout(finish, 850);
  }

  previous.addEventListener('click', () => show(-1));
  next.addEventListener('click', () => show(1));
  pause.addEventListener('click', () => { userPaused = !userPaused; updateControls(); schedule(); });
  hero.addEventListener('pointerenter', event => { if (event.pointerType !== 'touch') { hovered = true; schedule(); } });
  hero.addEventListener('pointerleave', event => { if (event.pointerType !== 'touch') { hovered = false; schedule(); } });
  hero.addEventListener('focusin', () => { focused = true; schedule(); });
  hero.addEventListener('focusout', () => { queueMicrotask(() => { focused = hero.contains(document.activeElement); schedule(); }); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { queuedDirection = 0; finish(); } schedule(); });
  motion.addEventListener('change', () => { queuedDirection = 0; finish(); updateControls(); schedule(); });
  window.addEventListener('resize', () => { queuedDirection = 0; finish(); });
  hero.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' || event.target.closest('a,button')) return;
    gesture = {id: event.pointerId, x: event.clientX, y: event.clientY};
    hero.setPointerCapture(event.pointerId);
    schedule();
  });
  hero.addEventListener('pointerup', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    const dx = event.clientX - gesture.x;
    const dy = event.clientY - gesture.y;
    gesture = undefined;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.25) show(dx < 0 ? 1 : -1);
    else schedule();
  });
  hero.addEventListener('pointercancel', () => { gesture = undefined; schedule(); });
  controls.hidden = false;
  updateControls();
  Promise.all(slides.map(slide => slide.querySelector('img').decode().catch(() => {}))).then(schedule);
})();
