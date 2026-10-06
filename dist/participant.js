/* Katılımcı (izleyici) kayıt formu. Gönderim adresi form-config.js içinde;
   adres boşsa form önizleme modunda kalır (bkz. KURULUM-FORMLAR.md). */
(() => {
  const dialog = document.querySelector('#participant-dialog');
  if (!dialog) return;
  const form = dialog.querySelector('#participant-form');
  const summary = dialog.querySelector('#participant-error-summary');
  const submit = dialog.querySelector('#participant-submit');
  const views = name => [...dialog.querySelectorAll(`[data-participant-view="${name}"]`)];
  const fields = [
    {name: 'fullName', label: 'Ad Soyad'},
    {name: 'email', label: 'E-posta', kind: 'email'},
    {name: 'phone', label: 'Telefon', kind: 'phone'},
    {name: 'city', label: 'Şehir'},
    {name: 'institution', label: 'Okul veya Kurum'},
    {name: 'role', label: 'Görevin', kind: 'choice', message: 'Görevini seç.'},
    {name: 'schoolType', label: 'Kurum türü', kind: 'choice', message: 'Kurum türünü seç.'},
    {name: 'consent', label: 'Kişisel veri onayı', kind: 'choice', message: 'Kaydı tamamlamak için aydınlatma metnini onaylaman gerekiyor.'}
  ];
  const controls = field => [...form.querySelectorAll(`[name="${field.name}"]`)];
  function error(field) {
    if (field.kind === 'choice') return controls(field).some(control => control.checked) ? '' : field.message;
    const input = controls(field)[0];
    const value = input.value.trim();
    if (!value) return 'Bu alanı doldur.';
    if (field.kind === 'email' && input.validity.typeMismatch) return 'Geçerli bir e-posta adresi yaz.';
    if (field.kind === 'phone' && value.replace(/\D/g, '').length < 10) return 'Telefon numaranı alan koduyla birlikte yaz.';
    return '';
  }
  function setError(field, message) {
    const wrapper = form.querySelector(`[data-participant-field="${field.name}"]`);
    const note = wrapper.querySelector('.application-field-error');
    note.textContent = message;
    note.hidden = !message;
    controls(field).forEach(control => message ? control.setAttribute('aria-invalid', 'true') : control.removeAttribute('aria-invalid'));
  }
  // Formdaki tüm değerleri tek nesnede toplar; çoklu seçimler dizi olarak gelir.
  function collect() {
    const data = new FormData(form);
    return {
      fullName: data.get('fullName').trim(),
      email: data.get('email').trim(),
      phone: data.get('phone').trim(),
      city: data.get('city').trim(),
      institution: data.get('institution').trim(),
      role: data.get('role'),
      schoolType: data.get('schoolType'),
      levels: data.getAll('levels'),
      themes: data.getAll('themes'),
      consent: data.get('consent') === 'Onaylıyorum',
      newsletter: data.get('newsletter') === 'Evet',
      submittedAt: new Date().toISOString()
    };
  }
  // form-config.js içinde adres varsa Google E-Tablolar'a gönderir; yoksa önizleme olarak kalır.
  let requestId = crypto.randomUUID();
  async function sendRegistration(registration) {
    if (!window.EDKForm?.enabled()) return {};
    const {submittedAt, ...fields} = registration;
    const result = await window.EDKForm.send('participant', fields, {requestId, website: form.elements.namedItem('website')?.value});
    requestId = crypto.randomUUID();
    return result;
  }
  function show(name) {
    ['form', 'success'].forEach(view => views(view).forEach(element => { element.hidden = view !== name; }));
  }
  function reset() {
    form.reset();
    fields.forEach(field => setError(field, ''));
    summary.hidden = true;
    show('form');
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const invalid = fields.map(field => ({field, message: error(field)})).filter(item => item.message);
    fields.forEach(field => setError(field, invalid.find(item => item.field === field)?.message || ''));
    if (invalid.length) {
      summary.textContent = invalid.length === 1 ? 'Bir alanı kontrol etmen gerekiyor.' : `${invalid.length} alanı kontrol etmen gerekiyor.`;
      summary.hidden = false;
      controls(invalid[0].field)[0].focus();
      return;
    }
    summary.hidden = true;
    submit.disabled = true;
    const label = submit.innerHTML;
    if (window.EDKForm?.enabled()) submit.textContent = 'Gönderiliyor…';
    try {
      const registration = collect();
      const result = await sendRegistration(registration);
      dialog.querySelector('#participant-success-name').textContent = registration.fullName;
      dialog.querySelector('#participant-success-email').textContent = registration.email;
      const mailNote = dialog.querySelector('#participant-success-mail');
      if (mailNote) mailNote.hidden = !result?.mailed;
      show('success');
      dialog.querySelector('.participant-success').focus();
    } catch (problem) {
      summary.textContent = problem?.message || 'Kaydın şu anda alınamadı. Lütfen biraz sonra tekrar dene.';
      summary.hidden = false;
      summary.scrollIntoView({block: 'nearest'});
    } finally {
      submit.disabled = false;
      submit.innerHTML = label;
    }
  });
  form.addEventListener('change', event => {
    const field = fields.find(item => item.name === event.target.name);
    if (field && controls(field).some(control => control.getAttribute('aria-invalid') === 'true')) setError(field, error(field));
  });
  document.querySelectorAll('[data-panel="participant"]').forEach(button => button.addEventListener('click', () => {
    closeMenu();
    if (!views('success')[0].hidden) reset();
    document.documentElement.classList.add('application-open');
    dialog.showModal();
    dialog.querySelector('#participant-stage-title').focus({preventScroll: true});
  }));
  dialog.querySelector('#participant-done').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => document.documentElement.classList.remove('application-open'));
})();
