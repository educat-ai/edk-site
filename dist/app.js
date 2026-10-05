const nav = document.querySelector('#navigation');
const menu = document.querySelector('.menu-toggle');
function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menüyü aç'); }
menu.addEventListener('click', () => { const open = nav.classList.toggle('open'); menu.setAttribute('aria-expanded', String(open)); menu.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç'); });
nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
const panels = {
 participant: {title: 'Katılımcı Başvurusu', body: '<p>Katılımcı başvuru bağlantısı yakında eklenecek.</p>'},
 sponsor: {title: 'Eğitimcilerin buluşmasına destek olun.', body: '<p>EDK, gönüllü öğretmenlerin kurduğu Eğitimde İnovasyon Derneği tarafından düzenleniyor. Sponsorluk desteği, eğitimcilerin öğrenme ve deneyim paylaşımı ortamına katkı sağlar.</p><p class="dialog-note">Sponsorluk iletişim bilgileri ve başvuru detayları yakında paylaşılacak.</p>'}
};
const infoDialog = document.querySelector('#info-dialog');
document.querySelectorAll('[data-panel]:not([data-panel="apply"])').forEach(button => button.addEventListener('click', () => { const panel = panels[button.dataset.panel]; document.querySelector('#dialog-title').textContent = panel.title; document.querySelector('#dialog-body').innerHTML = panel.body; closeMenu(); infoDialog.showModal(); }));
const speakerData = JSON.parse(document.querySelector('#speaker-data').textContent);
document.querySelectorAll('[data-speaker]').forEach(button => button.addEventListener('click', () => {
 const speaker = speakerData[button.dataset.speaker];
 document.querySelector('#dialog-title').textContent = speaker.name;
 const body = document.querySelector('#dialog-body');
 body.replaceChildren();
 speaker.paragraphs.forEach(paragraph => {
  const text = document.createElement('p');
  text.textContent = paragraph;
  body.append(text);
 });
 infoDialog.showModal();
 infoDialog.scrollTop = 0;
}));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const themeData = JSON.parse(document.querySelector('#theme-data').textContent);
const themeViewport = document.querySelector('.theme-viewport');
const themeTrack = themeViewport.querySelector('.theme-track');
const originalThemeCards = [...themeTrack.querySelectorAll('.theme-card')];
const themePrevious = document.querySelector('.theme-prev');
const themeNext = document.querySelector('.theme-next');
let activeThemeCard = originalThemeCards[0];
let themeSettleTimer;
let themeDrag;
// Rotate original cards rather than duplicate them. Every visible detail
// button remains usable, and the same eight cards support both directions.
for (let i = 0; i < 2; i++) themeTrack.prepend(themeTrack.lastElementChild);
function themeCards() { return [...themeTrack.querySelectorAll('.theme-card')]; }
function themeStart() {
 return themeViewport.getBoundingClientRect().left + parseFloat(getComputedStyle(themeViewport).paddingLeft);
}
function alignTheme(card, smooth = true) {
 activeThemeCard = card;
 const left = themeViewport.scrollLeft + card.getBoundingClientRect().left - themeStart();
 if (smooth && !reducedMotion.matches) themeViewport.scrollTo({left, behavior: 'smooth'});
 else {
  const behavior = themeViewport.style.scrollBehavior;
  themeViewport.style.scrollBehavior = 'auto';
  themeViewport.scrollLeft = left;
  themeViewport.style.scrollBehavior = behavior;
 }
}
function nearestThemeCard() {
 const start = themeStart();
 return themeCards().reduce((nearest, card) => {
  const distance = Math.abs(card.getBoundingClientRect().left - start);
  return distance < nearest.distance ? {card, distance} : nearest;
 }, {card: activeThemeCard, distance: Infinity}).card;
}
function rotateThemeTo(card) {
 const position = themeCards().indexOf(card);
 const previousSnap = themeViewport.style.scrollSnapType;
 themeViewport.style.scrollSnapType = 'none';
 if (position > 2) for (let i = 0; i < position - 2; i++) themeTrack.append(themeTrack.firstElementChild);
 else for (let i = 0; i < 2 - position; i++) themeTrack.prepend(themeTrack.lastElementChild);
 alignTheme(card, false);
 themeViewport.style.scrollSnapType = previousSnap;
}
function settleThemeScroll() {
 if (themeDrag) return;
 rotateThemeTo(nearestThemeCard());
}
function scrollThemes(direction) {
 const cards = themeCards();
 const position = cards.indexOf(activeThemeCard);
 alignTheme(cards[Math.max(0, Math.min(cards.length - 1, position + direction))]);
 clearTimeout(themeSettleTimer);
 themeSettleTimer = setTimeout(settleThemeScroll, reducedMotion.matches ? 80 : 500);
}
themePrevious.addEventListener('click', () => scrollThemes(-1));
themeNext.addEventListener('click', () => scrollThemes(1));
themeViewport.addEventListener('scroll', () => {
 if (themeDrag) return;
 clearTimeout(themeSettleTimer);
 themeSettleTimer = setTimeout(settleThemeScroll, 140);
}, {passive: true});
themeViewport.addEventListener('keydown', e => {
 if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
  e.preventDefault(); scrollThemes(e.key === 'ArrowLeft' ? -1 : 1);
 } else if (e.key === 'Home' || e.key === 'End') {
  e.preventDefault(); rotateThemeTo(e.key === 'Home' ? originalThemeCards[0] : originalThemeCards.at(-1));
 }
});
themeViewport.addEventListener('pointerdown', e => {
 if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('button, a')) return;
 clearTimeout(themeSettleTimer);
 themeDrag = {id: e.pointerId, x: e.clientX, left: themeViewport.scrollLeft};
 themeViewport.setPointerCapture(e.pointerId);
 themeViewport.classList.add('is-dragging');
 e.preventDefault();
});
themeViewport.addEventListener('pointermove', e => {
 if (themeDrag?.id === e.pointerId) themeViewport.scrollLeft = themeDrag.left - (e.clientX - themeDrag.x);
});
function finishThemeDrag(e) {
 if (themeDrag?.id !== e.pointerId) return;
 themeDrag = null;
 themeViewport.classList.remove('is-dragging');
 if (themeViewport.hasPointerCapture(e.pointerId)) themeViewport.releasePointerCapture(e.pointerId);
 settleThemeScroll();
}
themeViewport.addEventListener('pointerup', finishThemeDrag);
themeViewport.addEventListener('pointercancel', finishThemeDrag);
themeTrack.addEventListener('dragstart', e => e.preventDefault());
window.addEventListener('resize', () => alignTheme(activeThemeCard, false));
alignTheme(activeThemeCard, false);
document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
 const theme = themeData[Number(button.dataset.theme)];
 document.querySelector('#dialog-title').textContent = theme.title;
 const body = document.querySelector('#dialog-body');
 body.replaceChildren();
 const text = document.createElement('p'); text.textContent = theme.body;
 const note = document.createElement('p'); note.className = 'dialog-note'; note.textContent = 'Planlanan salon teması. Oturum içerikleri ve ayrıntılı program yakında paylaşılacak.';
 body.append(text, note); infoDialog.showModal();
}));
const photoDialog = document.querySelector('#photo-dialog');
document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => { const photo = photoDialog.querySelector('img'); photo.src = button.dataset.photo; photo.alt = button.querySelector('img').alt; photoDialog.querySelector('p').textContent = button.dataset.caption; photoDialog.showModal(); }));
document.querySelectorAll('dialog').forEach(dialog => { dialog.querySelector('.close').addEventListener('click', () => dialog.close()); dialog.addEventListener('click', e => { if(e.target !== dialog) return; const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); }); });
const faqTabs = [...document.querySelectorAll('[data-faq]')];
const faqPanels = [...document.querySelectorAll('[data-faq-panel]')];
faqTabs.forEach(tab => tab.addEventListener('click', () => {
 faqTabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
 faqPanels.forEach(panel => { panel.hidden = panel.dataset.faqPanel !== tab.dataset.faq; });
}));
const frame = document.querySelector('#hero-player');
const localVideo = document.querySelector('.film-local');
if (reducedMotion.matches) frame.src = frame.src.replace('autoplay=1', 'autoplay=0');
const film = document.querySelector('.film-section');
function showFallback() {
 film.classList.remove('video-visible');
 film.classList.add('fallback-visible');
 if (!localVideo.src) localVideo.src = 'assets/edk-reel-fallback.mp4';
 if (!reducedMotion.matches) localVideo.play().catch(() => {});
}
localVideo.addEventListener('playing', () => {
 film.classList.add('local-visible');
});
localVideo.addEventListener('error', () => {
 film.classList.remove('local-visible');
});
reducedMotion.addEventListener('change', e => { if (e.matches) localVideo.pause(); });
// Keep the film's own opening frame visible until Vimeo actually starts playing.
const fallbackTimer = setTimeout(showFallback, 5000);
function revealVideo() {
 if (reducedMotion.matches) return;
 clearTimeout(fallbackTimer);
 localVideo.pause();
 film.classList.remove('local-visible', 'fallback-visible');
 film.classList.add('video-visible');
}
frame.addEventListener('error', showFallback);
if (reducedMotion.matches) showFallback();
if (window.Vimeo?.Player) {
 const video = new Vimeo.Player(frame);
 // Wait for playback progress; play/ready can fire while Vimeo still shows its poster.
 video.on('timeupdate', data => { if (data.seconds > 0) revealVideo(); });
 video.on('error', () => { clearTimeout(fallbackTimer); film.classList.remove('video-visible'); showFallback(); });
 video.ready().then(async () => {
  if(reducedMotion.matches) await video.pause();
 }).catch(() => { if (!film.classList.contains('video-visible')) { clearTimeout(fallbackTimer); showFallback(); } });
 reducedMotion.addEventListener('change', e => { if(e.matches) video.pause().catch(() => {}); });
}
