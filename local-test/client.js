/* Served only by the loopback EDK test server; no Google credentials here. */
(() => {
  const form = document.querySelector('#application-form');
  const send = document.querySelector('#application-send');
  const check = document.querySelector('#application-check');
  const result = document.querySelector('#application-check-result');
  const note = document.querySelector('#application-preview-note');
  if (!form || !send) return;
  let csrf, busy = false, sent = false, requestId = `EDK-LOCAL-${crypto.randomUUID()}`;
  const status = document.createElement('p');
  status.id = 'edk-local-send-result';
  status.className = 'application-check-result';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.tabIndex = -1;
  status.hidden = true;
  result.after(status);
  const show = text => { status.textContent = text; status.hidden = false; status.focus({preventScroll:true}); status.scrollIntoView({block:'nearest'}); };
  const errors = {
    TEST_EMAIL_REQUIRED: 'Bu yerel testte deneme@example.test gibi .test veya .invalid ile biten bir deneme adresi kullanın.',
    TEST_PNG_REQUIRED: 'Bu yerel test için geçerli bir PNG dosyası seçin.',
    FILE_TYPE: 'Bu yerel test yalnızca PNG dosyalarını kabul eder.',
    FILE_SIZE: 'Bu yerel testte PNG dosyası en fazla 512 KB olabilir.',
    TEST_SINGLE_PHOTO_ONLY: 'Bu yerel testte tek bir PNG fotoğrafı seçin.',
    REQUEST_ID_CONFLICT: 'Bu deneme değiştirildi. Sayfayı yenileyip yeni bir deneme başlatın.',
    PHOTO_UPLOAD_UNCONFIRMED: 'Fotoğraf yükleme sonucu doğrulanamadı. Yeniden yükleme yapılmadı; bağlantı kontrol edilmeli.',
    SHEET_WRITE_UNCONFIRMED: 'Kayıt sonucu doğrulanamadı. Yeni kayıt oluşturulmadı; bağlantı kontrol edilmeli.',
    GOOGLE_HTTP_401: 'Google bağlantısının yenilenmesi gerekiyor.',
    GOOGLE_HTTP_403: 'Google bu test kaydına erişim vermedi.',
    GOOGLE_PERMISSION_DENIED: 'Google bu test kaydına erişim vermedi.',
    GOOGLE_API_NOT_ENABLED: 'Gerekli Google API bu hesapta etkin değil.'
  };
  check.addEventListener('click', () => {
    if (!result.hidden && csrf) result.textContent = 'Alanlar kontrol edildi. Deneme başvurusunu gönderebilirsiniz.';
  });
  form.addEventListener('input', () => {
    if (sent) { requestId = `EDK-LOCAL-${crypto.randomUUID()}`; sent = false; }
    if (!busy) { status.hidden = true; send.disabled = !csrf; send.textContent = 'Deneme başvurusunu gönder'; }
  });
  document.querySelector('#application-clear-photo').addEventListener('click', () => {
    status.hidden = true;
    if (sent) { requestId = `EDK-LOCAL-${crypto.randomUUID()}`; sent = false; send.disabled = !csrf; send.textContent = 'Deneme başvurusunu gönder'; }
  });
  send.addEventListener('click', async () => {
    if (!csrf || busy || sent) return;
    check.click();
    if (result.hidden) return;
    const data = new FormData(form);
    const email = String(data.get('email') || '').trim();
    if (!/\.(test|invalid)$/i.test(email.split('@')[1] || '')) { show(errors.TEST_EMAIL_REQUIRED); return; }
    const files = data.getAll('photo');
    if (files.length !== 1) { show(errors.TEST_SINGLE_PHOTO_ONLY); return; }
    if (files[0].type !== 'image/png') { show(errors.FILE_TYPE); return; }
    if (files[0].size > 512 * 1024 || files[0].size === 0) { show(errors.FILE_SIZE); return; }
    data.set('requestId', requestId);
    data.set('testFixture', 'true');
    busy = true;
    const controls = [...form.querySelectorAll('input,textarea,button')];
    const disabledBefore = controls.map(control => control.disabled);
    controls.forEach(control => { control.disabled = true; });
    send.textContent = 'Deneme kaydediliyor…';
    result.hidden = true;
    show('Deneme başvurusu kaydediliyor. Lütfen sonucu bekleyin.');
    try {
      const response = await fetch('/api/test-applications', {method:'POST', body:data, headers:{'X-EDK-CSRF':csrf}, credentials:'same-origin'});
      const receipt = await response.json();
      if (!response.ok || receipt.kind !== 'storage-acknowledged-test-receipt' || receipt.stored !== true || receipt.requestId !== requestId)
        throw new Error(receipt.code || 'STORAGE_UNCONFIRMED');
      sent = true;
      send.textContent = 'Deneme kaydedildi';
      const prefix = receipt.duplicate ? 'Bu deneme daha önce kaydedilmişti; ikinci kayıt oluşturulmadı.' : 'Deneme başvurunuz kaydedildi.';
      show(`${prefix} Fotoğraf ve tablo kaydı doğrulandı. Başvuru kodu: ${requestId}`);
      document.querySelector('.application-storage-note').textContent = 'Bu deneme kaydı ve fotoğrafı, özel test tablosunda ve klasöründe saklandı. Bu ekrandaki bilgiler sayfa yenilendiğinde temizlenir.';
      document.querySelectorAll('.application-photo-item small').forEach(el => { el.textContent = 'Özel test klasörüne yüklendi ve doğrulandı'; });
    } catch (error) {
      show(errors[error.message] || 'Kayıt sonucu doğrulanamadı; başarı bildirimi verilmedi. Aynı denemeyi tekrar kontrol edebilirsiniz.');
    } finally {
      busy = false;
      controls.forEach((control, i) => { control.disabled = disabledBefore[i]; });
      send.disabled = sent || !csrf;
      if (!sent) send.textContent = 'Deneme başvurusunu gönder';
    }
  });
  fetch('/api/test-status', {cache:'no-store', credentials:'same-origin'}).then(async response => {
    if (!response.ok) throw new Error('NOT_READY');
    const state = await response.json();
    if (state.ready !== true || state.mode !== 'local-test' || typeof state.csrf !== 'string') throw new Error('NOT_READY');
    csrf = state.csrf;
    note.querySelector('strong').textContent = 'Yerel test · Deneme gönderimi etkin.';
    note.querySelector('p').textContent = 'Yalnızca örnek bilgiler ve .test / .invalid e-posta adresi kullanın. Gönderilen deneme, özel test tablosuna ve klasörüne kaydedilir.';
    const photo = form.elements.namedItem('photo');
    photo.multiple = false;
    photo.accept = 'image/png';
    document.querySelector('#application-photo-hint').textContent = 'Bu yerel test için tek PNG seçin (en fazla 512 KB). Dosya, Gönder düğmesine bastığınızda özel test klasörüne yüklenir.';
    send.disabled = false;
    send.textContent = 'Deneme başvurusunu gönder';
  }).catch(() => {
    note.querySelector('strong').textContent = 'Yerel test bağlantısı hazır değil.';
    note.querySelector('p').textContent = 'Gönderim kapalı. Alanları doldurup kontrol edebilirsiniz.';
    send.disabled = true;
  });
})();
