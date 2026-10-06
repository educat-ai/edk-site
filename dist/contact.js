/* İletişim formu: mesajları Google E-Tablolar'daki "İletişim Mesajları" sayfasına gönderir
   (adres form-config.js içinde). Adres boşsa gönderim yapılmaz, bilgi mesajı gösterilir. */
(() => {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const status = form.querySelector('#cf-status');
  const submit = form.querySelector('.cf-submit');
  const fields = [
    {name: 'fullName', message: 'Adınızı ve soyadınızı yazın.'},
    {name: 'email', message: 'E-posta adresinizi yazın.', email: true},
    {name: 'message', message: 'Mesajınızı yazın.'}
  ];
  let requestId = crypto.randomUUID();
  const input = name => form.elements.namedItem(name);
  function check(field) {
    const control = input(field.name);
    const value = control.value.trim();
    let message = value ? '' : field.message;
    if (!message && field.email && control.validity.typeMismatch) message = 'Geçerli bir e-posta adresi yazın.';
    const note = form.querySelector(`#${control.id}-error`);
    note.textContent = message;
    note.hidden = !message;
    if (message) control.setAttribute('aria-invalid', 'true'); else control.removeAttribute('aria-invalid');
    return !message;
  }
  function show(text, ok) {
    status.textContent = text;
    status.className = 'cf-status ' + (ok ? 'ok' : 'err');
    status.hidden = false;
  }
  form.addEventListener('input', event => {
    const field = fields.find(item => item.name === event.target.name);
    if (field && event.target.getAttribute('aria-invalid') === 'true') check(field);
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const valid = fields.map(check);
    if (valid.includes(false)) {
      input(fields[valid.indexOf(false)].name).focus();
      return;
    }
    if (!window.EDKForm?.enabled()) {
      show('Mesaj gönderimi şu anda etkin değil. Lütfen bilgi@egitimdedegisim.com adresine e-posta gönderin.', false);
      return;
    }
    submit.disabled = true;
    submit.textContent = 'Gönderiliyor…';
    status.hidden = true;
    try {
      const data = {
        fullName: input('fullName').value.trim(),
        email: input('email').value.trim(),
        subject: input('subject').value.trim(),
        message: input('message').value.trim()
      };
      await window.EDKForm.send('contact', data, {requestId, website: input('website').value});
      requestId = crypto.randomUUID();
      form.reset();
      show('Teşekkürler, mesajınız bize ulaştı. En kısa sürede size dönüş yapacağız.', true);
    } catch (problem) {
      show(problem?.message || 'Mesajınız gönderilemedi. Lütfen biraz sonra tekrar deneyin.', false);
    } finally {
      submit.disabled = false;
      submit.textContent = 'Mesaj Gönder';
    }
  });
})();
