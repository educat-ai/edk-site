/* İki formun ortak gönderim katmanı. Adres form-config.js içindeki EDK_FORM_ENDPOINT. */
(() => {
  const messages = {
    FULL: 'Katılımcı kontenjanı doldu. Yeni kayıt alınamıyor.',
    BAD_EMAIL: 'E-posta adresini kontrol edin.',
    MISSING: 'Zorunlu alanlardan biri eksik görünüyor. Lütfen formu kontrol edin.',
    NO_CONSENT: 'Kişisel veri onayı gerekiyor.',
    BAD_PHOTO: 'Fotoğraf okunamadı. JPG veya PNG bir dosya seçin.',
    PHOTO_SIZE: 'Fotoğraf çok büyük. Daha küçük bir dosya seçin.',
    BUSY: 'Şu anda çok yoğunuz. Birkaç saniye sonra tekrar deneyin.'
  };
  const endpoint = () => String(window.EDK_FORM_ENDPOINT || '').trim();

  // Fotoğrafı tarayıcıda en fazla 1200 px'e küçültüp JPEG olarak hazırlar (yüklemeyi hızlandırır).
  async function preparePhoto(file, maxSide = 1200) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    return {name: file.name, type: 'image/jpeg', data: dataUrl.slice(dataUrl.indexOf(',') + 1)};
  }

  // Apps Script ön kontrol (preflight) isteğine yanıt vermez; bu yüzden gövde text/plain gönderilir.
  async function send(type, fields, extra = {}) {
    const body = JSON.stringify({type, fields, requestId: extra.requestId || crypto.randomUUID(), photo: extra.photo, website: extra.website || ''});
    let response;
    try {
      response = await fetch(endpoint(), {method: 'POST', headers: {'Content-Type': 'text/plain;charset=utf-8'}, body, redirect: 'follow'});
    } catch {
      throw new Error('İnternet bağlantısı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.');
    }
    let result;
    try { result = await response.json(); } catch { result = null; }
    if (!response.ok || !result || result.ok !== true) {
      throw new Error(messages[result?.code] || 'Gönderim tamamlanamadı. Lütfen biraz sonra tekrar deneyin.');
    }
    return result;
  }

  window.EDKForm = {enabled: () => Boolean(endpoint()), send, preparePhoto};

  // Gönderim etkinse önizleme uyarılarını gizle.
  if (endpoint()) {
    document.querySelectorAll('#participant-preview-note, #application-preview-note, .application-storage-note').forEach(element => { element.hidden = true; });
    const hint = document.querySelector('#application-photo-hint');
    if (hint) hint.textContent = 'JPG veya PNG, yüzünüzün net göründüğü bir fotoğraf.';
  }
})();
