const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

// Menü: kaydırınca koyulaşır, mobilde açılır panel
const header = document.querySelector('#site-nav');
const nav = document.querySelector('#navigation');
const menu = document.querySelector('.menu-toggle');
const setSolid = () => header.classList.toggle('solid', scrollY > 40 || nav.classList.contains('open'));
addEventListener('scroll', setSolid, {passive: true});
setSolid();
function closeMenu() { nav.classList.remove('open'); menu.setAttribute('aria-expanded', 'false'); menu.setAttribute('aria-label', 'Menüyü aç'); setSolid(); }
menu.addEventListener('click', () => {
 const open = nav.classList.toggle('open');
 menu.setAttribute('aria-expanded', String(open));
 menu.setAttribute('aria-label', open ? 'Menüyü kapat' : 'Menüyü aç');
 setSolid();
});
nav.querySelectorAll('a, button').forEach(item => item.addEventListener('click', closeMenu));
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

// Aktif bölümü menüde işaretle
const navLinks = [...document.querySelectorAll('.nav-links a')];
const observed = navLinks.map(link => link.hash && link.pathname === location.pathname ? document.querySelector(link.hash) : null).filter(Boolean);
const sectionObserver = new IntersectionObserver(entries => entries.forEach(entry => {
 if (!entry.isIntersecting) return;
 navLinks.forEach(link => link.classList.toggle('on', link.hash === '#' + entry.target.id));
}), {rootMargin: '-45% 0px -50% 0px'});
observed.forEach(section => sectionObserver.observe(section));

// Geri sayım: 19 Aralık 2026, İstanbul saati
const eventDate = new Date('2026-12-19T00:00:00+03:00');
const countParts = {d: document.querySelector('[data-count="d"]'), h: document.querySelector('[data-count="h"]'), m: document.querySelector('[data-count="m"]')};
function tick() {
 if (!countParts.d) return;
 const ms = Math.max(0, eventDate - Date.now());
 countParts.d.textContent = Math.floor(ms / 864e5);
 countParts.h.textContent = String(Math.floor(ms / 36e5) % 24).padStart(2, '0');
 countParts.m.textContent = String(Math.floor(ms / 6e4) % 60).padStart(2, '0');
}
tick();
setInterval(tick, 30000);

// Bilgi penceresi: başvuru, sponsorluk, konuşmacı ve tema ayrıntıları
const infoDialog = document.querySelector('#info-dialog');
const dialogTitle = document.querySelector('#dialog-title');
const dialogBody = document.querySelector('#dialog-body');
const dialogRole = document.querySelector('#dialog-role');
const dialogPhoto = document.querySelector('#dialog-photo');
function openInfo({title, paragraphs = [], note, role, photo}) {
 dialogTitle.textContent = title;
 dialogRole.hidden = !role; dialogRole.textContent = role || '';
 dialogPhoto.hidden = !photo; if (photo) dialogPhoto.src = photo;
 dialogBody.replaceChildren(...paragraphs.map(text => { const p = document.createElement('p'); p.textContent = text; return p; }));
 if (note) { const p = document.createElement('p'); p.className = 'dialog-note'; p.textContent = note; dialogBody.append(p); }
 infoDialog.showModal();
 infoDialog.scrollTop = 0;
}
const panels = {
 sponsor: {title: 'Eğitimcilerin buluşmasına destek olun.', paragraphs: ['EDK, gönüllü öğretmenlerin kurduğu Eğitimde İnovasyon Derneği tarafından düzenleniyor. Sponsorluk desteği, eğitimcilerin öğrenme ve deneyim paylaşımı ortamına katkı sağlar.'], note: 'Sponsorluk iletişim bilgileri ve başvuru detayları yakında paylaşılacak.'}
};
// "apply" düğmeleri application.js, "participant" düğmeleri participant.js tarafından formlara bağlanır.
document.querySelectorAll('[data-panel="sponsor"]').forEach(button => button.addEventListener('click', () => openInfo(panels[button.dataset.panel])));

const speakerData = JSON.parse(document.querySelector('#speaker-data')?.textContent || '{}');
document.querySelectorAll('[data-speaker]').forEach(button => button.addEventListener('click', () => {
 const speaker = speakerData[button.dataset.speaker];
 if (!speaker) return;
 const card = button.closest('.key, .spk, .member');
 openInfo({title: speaker.name, paragraphs: speaker.paragraphs, role: card.querySelector('.role').textContent, photo: card.querySelector('img').currentSrc || card.querySelector('img').src});
}));

const themeData = JSON.parse(document.querySelector('#theme-data')?.textContent || '[]');
document.querySelectorAll('[data-theme]').forEach(button => button.addEventListener('click', () => {
 const theme = themeData[Number(button.dataset.theme)];
 openInfo({title: theme.title, paragraphs: [theme.body]});
}));

// Galeri büyütme: aynı galerideki fotoğraflar arasında oklarla gezinme
const photoDialog = document.querySelector('#photo-dialog');
const photoImg = photoDialog.querySelector('img');
const photoCaption = photoDialog.querySelector('p');
let photoSet = [];
let photoIndex = 0;
function showPhoto(index) {
 photoIndex = (index + photoSet.length) % photoSet.length;
 const button = photoSet[photoIndex];
 photoImg.src = button.dataset.photo;
 photoImg.alt = button.querySelector('img').alt;
 photoCaption.textContent = photoSet.length > 1 ? `${button.dataset.caption} · ${photoIndex + 1} / ${photoSet.length}` : button.dataset.caption;
 photoDialog.classList.toggle('single', photoSet.length < 2);
}
document.querySelectorAll('[data-photo]').forEach(button => button.addEventListener('click', () => {
 const group = button.closest('[data-gallery]');
 photoSet = group ? [...group.querySelectorAll('[data-photo]')] : [button];
 showPhoto(photoSet.indexOf(button));
 photoDialog.showModal();
}));
photoDialog.querySelector('.pd-prev')?.addEventListener('click', () => showPhoto(photoIndex - 1));
photoDialog.querySelector('.pd-next')?.addEventListener('click', () => showPhoto(photoIndex + 1));
photoDialog.addEventListener('keydown', e => {
 if (e.key === 'ArrowLeft') showPhoto(photoIndex - 1);
 if (e.key === 'ArrowRight') showPhoto(photoIndex + 1);
});

// Pencereleri kapat: × düğmesi veya dışına tıklama
[infoDialog, photoDialog, document.querySelector('#application-dialog'), document.querySelector('#participant-dialog')].filter(Boolean).forEach(dialog => {
 dialog.querySelector('.close').addEventListener('click', () => dialog.close());
 dialog.addEventListener('click', e => {
  if (e.target !== dialog) return;
  const r = dialog.getBoundingClientRect();
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
 });
});

// SSS sekmeleri
const faqTabs = [...document.querySelectorAll('[data-faq]')];
const faqPanels = [...document.querySelectorAll('[data-faq-panel]')];
faqTabs.forEach(tab => tab.addEventListener('click', () => {
 faqTabs.forEach(item => item.setAttribute('aria-selected', String(item === tab)));
 faqPanels.forEach(panel => { panel.hidden = panel.dataset.faqPanel !== tab.dataset.faq; });
}));

// Tanıtım filmi: görünür olunca sessiz önizleme; düğmeyle Vimeo sesli oynar
const filmFrame = document.querySelector('#film-frame');
const preview = filmFrame?.querySelector('video');
if (filmFrame && !reducedMotion.matches) {
 new IntersectionObserver(([entry]) => {
  if (!preview.isConnected) return;
  if (entry.isIntersecting) preview.play().catch(() => {}); else preview.pause();
 }, {threshold: .25}).observe(filmFrame);
}
document.querySelector('#play-film')?.addEventListener('click', () => {
 const player = document.createElement('iframe');
 player.src = 'https://player.vimeo.com/video/1232285794?autoplay=1&title=0&byline=0&portrait=0&color=2f6bff&dnt=1';
 player.allow = 'autoplay; fullscreen; picture-in-picture';
 player.allowFullscreen = true;
 player.title = '11. EDK tanıtım filmi';
 preview.remove();
 filmFrame.append(player);
 filmFrame.classList.add('playing');
 player.focus();
});
