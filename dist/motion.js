/* Optional real footage: set this to a local MP4/WebM path when supplied. */
const EDK_FOOTAGE = '';
(() => {
  const reel = document.querySelector('.reel');
  const scenes = [...reel.querySelectorAll('.scene')];
  const chapters = [...reel.querySelectorAll('.chapter')];
  const control = reel.querySelector('.playback');
  const video = reel.querySelector('video');
  const durations = [4800, 4400, 4400, 4600, 5800];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, elapsed = 0, last = 0, paused = reduced.matches, hidden = document.hidden;
  let wipeTimer;
  function renderScene(next, transition = true) {
    index = next;
    reel.classList.toggle('still-scene', paused || reduced.matches);
    elapsed = 0;
    clearTimeout(wipeTimer);
    reel.classList.remove('transitioning');
    if (transition && !reduced.matches) {
      void reel.offsetWidth;
      reel.classList.add('transitioning');
      wipeTimer = setTimeout(() => reel.classList.remove('transitioning'), 850);
    }
    scenes.forEach((scene, i) => scene.classList.toggle('active', i === index));
    chapters.forEach((chapter, i) => {
      chapter.classList.toggle('current', i === index);
      chapter.setAttribute('aria-pressed', String(i === index));
    });
    reel.dataset.scene = String(index);
    reel.style.setProperty('--progress', '0');
    reel.querySelector('.reel-index').textContent = `0${index + 1} / 05`;
    syncVideo();
  }
  function syncVideo() {
    if (!EDK_FOOTAGE) return;
    if (!paused && !hidden && (index === 1 || index === 3)) video.play().catch(() => {});
    else video.pause();
  }
  function setPaused(value) {
    paused = value;
    reel.classList.toggle('paused', paused || hidden);
    control.setAttribute('aria-label', paused ? 'Animasyonu oynat' : 'Animasyonu duraklat');
    control.innerHTML = paused ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 4 8 6-8 6Z"/></svg>' : '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10M13 5v10"/></svg>';
    syncVideo();
  }
  function tick(now) {
    if (!paused && !hidden && last) {
      elapsed += Math.min(now - last, 100);
      if (elapsed >= durations[index]) renderScene((index + 1) % scenes.length);
      reel.style.setProperty('--progress', String(elapsed / durations[index]));
    }
    last = now;
    requestAnimationFrame(tick);
  }
  chapters.forEach((chapter, i) => chapter.addEventListener('click', () => renderScene(i, !paused)));
  control.addEventListener('click', () => setPaused(!paused));
  document.addEventListener('visibilitychange', () => { hidden = document.hidden; last = 0; setPaused(paused); });
  reduced.addEventListener('change', () => { if (reduced.matches) { renderScene(4, false); setPaused(true); } });
  if (EDK_FOOTAGE) { video.src = EDK_FOOTAGE; video.addEventListener('loadeddata', () => reel.classList.add('has-footage')); }
  if (reduced.matches) renderScene(4, false);
  setPaused(paused);
  requestAnimationFrame(tick);
})();
