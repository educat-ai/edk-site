/* Sunum ve atölye başvuru formu. form-config.js içinde adres varsa Google E-Tablolar'a gönderir;
   adres boşsa önizleme modunda kalır (bkz. KURULUM-FORMLAR.md). */
(() => {
  const dialog = document.querySelector('#application-dialog');
  const form = document.querySelector('#application-form');
  const body = dialog.querySelector('.application-body');
  const stages = [...dialog.querySelectorAll('[data-application-step]')];
  const steps = [...dialog.querySelectorAll('.application-steps li')];
  const next = dialog.querySelector('#application-next');
  const back = dialog.querySelector('#application-back');
  const finalActions = dialog.querySelector('#application-final-actions');
  const summary = dialog.querySelector('#application-error-summary');
  const result = dialog.querySelector('#application-check-result');
  const photo = form.elements.namedItem('photo');
  const photoPreview = dialog.querySelector('#application-photo-preview');
  const clearPhoto = dialog.querySelector('#application-clear-photo');
  let step = 0;
  const live = () => Boolean(window.EDKForm?.enabled());
  const send = dialog.querySelector('#application-send');
  let requestId = crypto.randomUUID();
  let sending = false;
  let photoUrls = [];
  const fields = [
    {name: 'email', label: 'E-posta', step: 0, kind: 'email'},
    {name: 'fullName', label: 'Ad Soyad', step: 0},
    {name: 'city', label: 'Konferansa hangi şehirden katılmak istiyorsunuz?', step: 0},
    {name: 'biography', label: 'Özgeçmiş', step: 0},
    {name: 'institution', label: 'Görevli Olduğunuz Okul veya Kurum', step: 0},
    {name: 'jobTitle', label: 'Göreviniz- Ünvanınız', step: 0},
    {name: 'education', label: 'Eğitim Kademesi', step: 0, kind: 'choice'},
    {name: 'category', label: 'Sunumunuz veya atölyeniz hangi kategoride bulunmaktadır?', step: 1, kind: 'choice'},
    {name: 'presentationTitle', label: 'Sunum Başlığı', step: 1},
    {name: 'description', label: 'Sunum Açıklaması', step: 1},
    {name: 'photo', label: 'Profil Fotoğrafı', step: 1, kind: 'file'},
    {name: 'social', label: 'Sosyal Medya Hesabı (İsteğe Bağlı)', step: 1, optional: true},
    {name: 'approval', label: 'Onaylıyorum', step: 2, kind: 'choice'}
  ];
  function controls(field) {
    return [...form.querySelectorAll(`[name="${field.name}"]`)];
  }
  function value(field) {
    if (field.kind === 'choice') return controls(field).find(control => control.checked)?.value || '';
    if (field.kind === 'file') return [...photo.files].map(file => file.name).join('\n');
    return controls(field)[0].value.trim();
  }
  function error(field) {
    if (field.optional) return '';
    if (field.kind === 'file') {
      if (!photo.files.length) return 'Profil fotoğrafınızı seçin.';
      if (!photo.files[0].type.startsWith('image/')) return 'Fotoğraf olarak bir görsel dosyası (JPG veya PNG) seçin.';
      if (photo.files[0].size > 15 * 1024 * 1024) return 'Fotoğraf en fazla 15 MB olabilir.';
      return '';
    }
    if (!value(field)) {
      if (field.name === 'education') return 'Eğitim kademenizi seçin.';
      if (field.name === 'category') return 'Bir kategori seçin.';
      if (field.name === 'approval') return 'Devam etmek için “Onaylıyorum” seçeneğini işaretleyin.';
      return 'Bu alanı doldurun.';
    }
    if (field.kind === 'email' && controls(field)[0].validity.typeMismatch) return 'Geçerli bir e-posta adresi yazın.';
    return '';
  }
  function setError(field, message) {
    const wrapper = form.querySelector(`[data-application-field="${field.name}"]`);
    const note = wrapper.querySelector('.application-field-error');
    if (!note) return;
    note.textContent = message;
    note.hidden = !message;
    controls(field).forEach(control => {
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
    });
  }
  function validate(selectedFields) {
    const invalid = [];
    selectedFields.forEach(field => {
      const message = error(field);
      setError(field, message);
      if (message) invalid.push(field);
    });
    return invalid;
  }
  function showErrors(invalid) {
    summary.hidden = !invalid.length;
    summary.textContent = invalid.length ? `Devam etmek için ${invalid.length} alanı kontrol edin.` : '';
    if (invalid.length) controls(invalid[0])[0].focus();
  }
  function renderReview() {
    const review = dialog.querySelector('#application-review');
    review.replaceChildren();
    fields.filter(field => field.name !== 'approval').forEach(field => {
      const label = document.createElement('dt');
      const content = document.createElement('dd');
      label.textContent = field.label;
      content.textContent = value(field) || 'Belirtilmedi';
      review.append(label, content);
    });
  }
  function showStep(position, focus = true) {
    step = position;
    stages.forEach((stage, index) => { stage.hidden = index !== step; });
    steps.forEach((item, index) => {
      if (index === step) item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    });
    back.hidden = step === 0;
    next.hidden = step === 2;
    finalActions.hidden = step !== 2;
    dialog.querySelector('#application-position').textContent = `Adım ${step + 1} / 3`;
    summary.hidden = true;
    summary.textContent = '';
    if (step === 2) renderReview();
    body.scrollTop = 0;
    if (focus) stages[step].querySelector('h3').focus({preventScroll: true});
  }
  function advance() {
    const invalid = validate(fields.filter(field => field.step === step));
    if (invalid.length) { showErrors(invalid); return; }
    showStep(Math.min(step + 1, 2));
  }
  function checkAll() {
    result.hidden = true;
    const invalid = validate(fields);
    if (invalid.length) {
      if (invalid[0].step !== step) showStep(invalid[0].step);
      showErrors(invalid);
      return;
    }
    summary.hidden = true;
    summary.textContent = '';
    result.textContent = live() ? 'Alanlar tamam. “Başvuruyu gönder” ile başvurunuzu iletebilirsiniz.' : 'Alanlar kontrol edildi. Bu bir önizlemedir; başvurunuz gönderilmedi.';
    result.hidden = false;
    result.scrollIntoView({block: 'nearest'});
  }
  function releasePhotoUrls() {
    photoUrls.forEach(url => URL.revokeObjectURL(url));
    photoUrls = [];
  }
  function previewPhotos() {
    releasePhotoUrls();
    photoPreview.replaceChildren();
    clearPhoto.hidden = !photo.files.length;
    [...photo.files].forEach(file => {
      const item = document.createElement('figure');
      const caption = document.createElement('figcaption');
      const note = document.createElement('small');
      item.className = 'application-photo-item';
      caption.textContent = file.name;
      note.textContent = live() ? 'Başvuruyla birlikte gönderilecek' : 'Yalnızca yerel seçim · Dosya yüklenmedi';
      caption.append(note);
      // Preview raster images via an in-memory blob URL. No file is uploaded.
      if (/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)) {
        const image = document.createElement('img');
        const url = URL.createObjectURL(file);
        photoUrls.push(url);
        image.alt = 'Seçilen profil fotoğrafının yerel önizlemesi';
        image.src = url;
        image.addEventListener('error', () => {
          image.remove();
          note.textContent = 'Görsel önizleme gösterilemedi · Dosya yüklenmedi';
        }, {once: true});
        item.append(image);
      } else note.textContent = 'Bu dosya için görsel önizleme yok · Dosya yüklenmedi';
      item.append(caption);
      photoPreview.append(item);
    });
  }
  document.querySelectorAll('[data-panel="apply"]').forEach(button => button.addEventListener('click', () => {
    closeMenu();
    showStep(step, false);
    document.documentElement.classList.add('application-open');
    dialog.showModal();
    stages[step].querySelector('h3').focus({preventScroll: true});
  }));
  dialog.addEventListener('close', () => document.documentElement.classList.remove('application-open'));
  next.addEventListener('click', advance);
  back.addEventListener('click', () => showStep(Math.max(0, step - 1)));
  dialog.querySelector('#application-check').addEventListener('click', checkAll);
  form.addEventListener('submit', event => {
    event.preventDefault();
    if (step < 2) advance();
    else checkAll();
  });
  form.addEventListener('input', event => {
    result.hidden = true;
    const field = fields.find(item => item.name === event.target.name);
    if (field && controls(field).some(control => control.getAttribute('aria-invalid') === 'true')) setError(field, error(field));
    if (!form.querySelector('[aria-invalid="true"]')) { summary.hidden = true; summary.textContent = ''; }
  });
  photo.addEventListener('change', previewPhotos);
  clearPhoto.addEventListener('click', () => {
    photo.value = '';
    previewPhotos();
    result.hidden = true;
    const photoField = fields.find(field => field.name === 'photo');
    if (photo.getAttribute('aria-invalid') === 'true') setError(photoField, error(photoField));
    photo.focus();
  });
  window.addEventListener('pagehide', releasePhotoUrls);

  // Gerçek gönderim (yalnızca form-config.js içinde adres varsa)
  function collect() {
    const data = new FormData(form);
    const fieldsOut = {};
    ['email', 'fullName', 'city', 'institution', 'biography', 'jobTitle', 'education', 'category', 'presentationTitle', 'description', 'social']
      .forEach(name => { fieldsOut[name] = String(data.get(name) || '').trim(); });
    fieldsOut.consent = data.get('approval') === 'Onaylıyorum';
    return fieldsOut;
  }
  function showSuccess(name, email, mailed) {
    let success = dialog.querySelector('.application-success');
    if (!success) {
      success = document.createElement('div');
      success.className = 'participant-success application-success';
      success.tabIndex = -1;
      success.innerHTML = '<div class="ok" aria-hidden="true">✓</div><h3>Başvurunuz alındı!</h3><p><strong data-name></strong>, sunum ve atölye başvurunuz bize ulaştı.</p><p>Değerlendirme sonrasında <strong data-email></strong> adresinden sizinle iletişime geçeceğiz.</p><p data-mailed hidden>Başvurunuzun özeti bu adrese e-posta olarak gönderildi.</p>';
      body.after(success);
    }
    success.querySelector('[data-name]').textContent = name;
    success.querySelector('[data-email]').textContent = email;
    success.querySelector('[data-mailed]').hidden = !mailed;
    [body, dialog.querySelector('.application-steps'), dialog.querySelector('.application-actions')].forEach(element => { element.hidden = true; });
    success.hidden = false;
    success.focus();
  }
  function resetAfterSuccess() {
    const success = dialog.querySelector('.application-success');
    if (!success || success.hidden) return;
    form.reset();
    photo.value = '';
    previewPhotos();
    fields.forEach(field => setError(field, ''));
    success.hidden = true;
    [body, dialog.querySelector('.application-steps'), dialog.querySelector('.application-actions')].forEach(element => { element.hidden = false; });
    result.hidden = true;
    showStep(0, false);
  }
  if (live()) {
    send.disabled = false;
    send.addEventListener('click', async () => {
      if (sending) return;
      checkAll();
      if (result.hidden) return;
      sending = true;
      send.disabled = true;
      send.textContent = 'Gönderiliyor…';
      result.textContent = 'Başvurunuz gönderiliyor, lütfen bekleyin…';
      try {
        const fieldsOut = collect();
        const photoData = await window.EDKForm.preparePhoto(photo.files[0]);
        const sent = await window.EDKForm.send('application', fieldsOut, {requestId, photo: photoData, website: form.elements.namedItem('website')?.value});
        requestId = crypto.randomUUID();
        showSuccess(fieldsOut.fullName, fieldsOut.email, sent?.mailed);
      } catch (problem) {
        result.textContent = problem?.message || 'Gönderim tamamlanamadı. Lütfen biraz sonra tekrar deneyin.';
        result.hidden = false;
      } finally {
        sending = false;
        send.disabled = false;
        send.textContent = 'Başvuruyu gönder';
      }
    });
    document.querySelectorAll('[data-panel="apply"]').forEach(button => button.addEventListener('click', resetAfterSuccess));
  }
})();
