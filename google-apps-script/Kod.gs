/**
 * EDK başvuru formları → Google E-Tablolar
 *
 * Sitedeki iki form (Katılımcı Kaydı ve Sunum/Atölye Başvurusu) bu web uygulamasına
 * gönderir; her gönderim bu tablodaki ilgili sayfaya yeni bir satır olarak eklenir.
 * Sunum başvurusundaki profil fotoğrafı Google Drive'da bir klasöre kaydedilir.
 *
 * Kurulum adımları: KURULUM-FORMLAR.md
 */

// ===== AYARLAR (yalnızca bu bölümü değiştirin) =====
const AYARLAR = {
  // Yeni başvuru gelince bilgi verilecek e-posta adresi. Boş bırakılırsa bildirim gönderilmez.
  BILDIRIM_EPOSTASI: '',
  // true yapılırsa başvuru yapan kişiye otomatik "başvurunuz alındı" e-postası gider.
  ONAY_EPOSTASI_GONDER: false,
  // Katılımcı kontenjanı. 0 = sınırsız. Dolunca yeni kayıt kabul edilmez.
  KATILIMCI_KONTENJANI: 0,
  // Fotoğrafların kaydedileceği Drive klasörünün adı.
  FOTO_KLASORU: 'EDK 2026 Başvuru Fotoğrafları',
  // E-postalarda görünen gönderen adı ve "Yanıtla" denince gidecek adres.
  GONDEREN_ADI: 'Eğitimde Değişim Konferansı',
  YANIT_ADRESI: 'destek@educat.com.tr',
  KONFERANS: '11. Eğitimde Değişim Konferansı'
};

// E-postada görünen etkinlik bilgileri. Değişirse buradan güncelleyin.
const ETKINLIK = {
  tarih: '19 Aralık 2026, Cumartesi',
  kayit: '08.00 – 09.00 · Kayıt ve karşılama',
  yer: 'İstinye Üniversitesi Vadi Kampüsü',
  sehir: 'İstanbul',
  harita: 'https://www.google.com/maps/search/?api=1&query=Istinye+Universitesi+Vadi+Ana+Kampus',
  site: 'https://educat-ai.github.io/edk-site/',
  logo: 'https://educat-ai.github.io/edk-site/assets/eposta/edk-logo.png',
  telefon: '0533 357 90 72',
  eposta: 'destek@educat.com.tr',
  program: [
    ['08.00 – 09.00', 'Kayıt ve karşılama'],
    ['09.00 – 11.00', 'Açılış ve keynote konuşmaları'],
    ['11.15 – 13.15', 'Paralel atölyeler'],
    ['13.15 – 14.15', 'Öğle arası ve networking'],
    ['14.15 – 15.00', '1. Oturum'],
    ['15.15 – 16.00', '2. Oturum'],
    ['16.15 – 16.45', 'Kapanış']
  ]
};
// ====================================================

const SAYFALAR = {
  participant: {
    ad: 'Katılımcılar',
    sutunlar: [
      ['submittedAt', 'Gönderim zamanı'], ['fullName', 'Ad Soyad'], ['email', 'E-posta'], ['phone', 'Telefon'],
      ['city', 'Şehir'], ['institution', 'Okul / Kurum'], ['role', 'Görev'], ['schoolType', 'Kurum türü'],
      ['levels', 'Kademe'], ['themes', 'İlgilendiği temalar'], ['newsletter', 'Duyuru izni'], ['consent', 'KVKK onayı'],
      ['requestId', 'Kayıt kodu']
    ],
    zorunlu: ['fullName', 'email', 'phone', 'city', 'institution', 'role', 'schoolType']
  },
  application: {
    ad: 'Sunum Başvuruları',
    sutunlar: [
      ['submittedAt', 'Gönderim zamanı'], ['fullName', 'Ad Soyad'], ['email', 'E-posta'], ['city', 'Şehir'],
      ['institution', 'Okul / Kurum'], ['jobTitle', 'Görev / Unvan'], ['education', 'Eğitim kademesi'],
      ['category', 'Tema'], ['presentationTitle', 'Sunum başlığı'], ['description', 'Sunum açıklaması'],
      ['biography', 'Özgeçmiş'], ['social', 'Sosyal medya'], ['photoUrl', 'Profil fotoğrafı'], ['consent', 'KVKK onayı'],
      ['requestId', 'Başvuru kodu'], ['durum', 'Durum'], ['not', 'Değerlendirme notu']
    ],
    zorunlu: ['fullName', 'email', 'city', 'institution', 'jobTitle', 'education', 'category', 'presentationTitle', 'description', 'biography']
  }
};

const EN_FAZLA_METIN = 6000;
const EN_FAZLA_FOTO = 8 * 1024 * 1024;
const IZINLI_FOTO = ['image/jpeg', 'image/png', 'image/webp'];

/** Kurulumda bir kez çalıştırın: sayfaları, başlıkları ve fotoğraf klasörünü hazırlar, izin ister. */
function kurulum() {
  const tablo = SpreadsheetApp.getActiveSpreadsheet();
  PropertiesService.getScriptProperties().setProperty('TABLO_ID', tablo.getId());
  Object.keys(SAYFALAR).forEach(tur => sayfaHazirla(tablo, tur));
  const klasor = fotoKlasoru();
  Logger.log('Kurulum tamam. Tablo: ' + tablo.getUrl());
  Logger.log('Fotoğraf klasörü: ' + klasor.getUrl());
}

/** Web uygulaması adresinin çalıştığını tarayıcıdan kontrol etmek için. */
function doGet() {
  return json({ ok: true, mesaj: 'EDK başvuru sistemi çalışıyor.' });
}

function doPost(e) {
  const kilit = LockService.getScriptLock();
  try {
    kilit.waitLock(20000);
  } catch (hata) {
    return json({ ok: false, code: 'BUSY' });
  }
  try {
    let veri;
    try {
      veri = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    } catch (hata) {
      return json({ ok: false, code: 'BAD_JSON' });
    }
    const tur = veri.type;
    const tanim = SAYFALAR[tur];
    if (!tanim) return json({ ok: false, code: 'BAD_TYPE' });
    // Botlar için gizli alan: dolu gelirse sessizce başarılı say, kaydetme.
    if (veri.website) return json({ ok: true, requestId: veri.requestId || '' });

    const alanlar = veri.fields || {};
    const eksik = tanim.zorunlu.filter(ad => !metin(alanlar[ad]));
    if (eksik.length) return json({ ok: false, code: 'MISSING', fields: eksik });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(metin(alanlar.email))) return json({ ok: false, code: 'BAD_EMAIL' });
    if (alanlar.consent !== true) return json({ ok: false, code: 'NO_CONSENT' });

    const requestId = metin(veri.requestId).slice(0, 80) || Utilities.getUuid();
    const tablo = tabloyuAc();
    const sayfa = sayfaHazirla(tablo, tur);

    // Aynı gönderim iki kez gelirse (ör. bağlantı koptu, tekrar denendi) ikinci satırı yazma.
    const idSutunu = tanim.sutunlar.findIndex(s => s[0] === 'requestId') + 1;
    if (sayfa.getLastRow() > 1) {
      const bulunan = sayfa.getRange(2, idSutunu, sayfa.getLastRow() - 1, 1)
        .createTextFinder(requestId).matchEntireCell(true).findNext();
      if (bulunan) return json({ ok: true, requestId: requestId, duplicate: true });
    }

    if (tur === 'participant' && AYARLAR.KATILIMCI_KONTENJANI > 0 && sayfa.getLastRow() - 1 >= AYARLAR.KATILIMCI_KONTENJANI) {
      return json({ ok: false, code: 'FULL' });
    }

    let photoUrl = '';
    if (tur === 'application') {
      if (!veri.photo || !veri.photo.data) return json({ ok: false, code: 'MISSING', fields: ['photo'] });
      const foto = fotoKaydet(veri.photo, requestId, metin(alanlar.fullName));
      if (foto.code) return json({ ok: false, code: foto.code });
      photoUrl = foto.url;
    }

    const satir = tanim.sutunlar.map(([ad]) => {
      if (ad === 'submittedAt') return new Date();
      if (ad === 'requestId') return requestId;
      if (ad === 'photoUrl') return photoUrl;
      if (ad === 'durum') return 'Beklemede';
      if (ad === 'not') return '';
      const deger = alanlar[ad];
      if (deger === true) return 'Evet';
      if (deger === false || deger === undefined || deger === null) return ad === 'consent' || ad === 'newsletter' ? 'Hayır' : '';
      if (Array.isArray(deger)) return guvenli(deger.map(metin).filter(Boolean).join(', '));
      return guvenli(metin(deger));
    });
    sayfa.appendRow(satir);

    const onayGitti = epostalar(tur, alanlar, requestId);
    return json({ ok: true, requestId: requestId, mailed: onayGitti });
  } catch (hata) {
    console.error(hata);
    return json({ ok: false, code: 'SERVER_ERROR' });
  } finally {
    kilit.releaseLock();
  }
}

function tabloyuAc() {
  const id = PropertiesService.getScriptProperties().getProperty('TABLO_ID');
  return id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
}

function sayfaHazirla(tablo, tur) {
  const tanim = SAYFALAR[tur];
  let sayfa = tablo.getSheetByName(tanim.ad);
  if (!sayfa) sayfa = tablo.insertSheet(tanim.ad);
  if (sayfa.getLastRow() === 0) {
    sayfa.appendRow(tanim.sutunlar.map(s => s[1]));
    sayfa.getRange(1, 1, 1, tanim.sutunlar.length).setFontWeight('bold').setBackground('#dbe6ff');
    sayfa.setFrozenRows(1);
    if (tur === 'application') {
      const durum = tanim.sutunlar.findIndex(s => s[0] === 'durum') + 1;
      const kural = SpreadsheetApp.newDataValidation().requireValueInList(['Beklemede', 'Kabul', 'Ret'], true).build();
      sayfa.getRange(2, durum, 1000, 1).setDataValidation(kural);
    }
  }
  return sayfa;
}

function fotoKlasoru() {
  const ozellikler = PropertiesService.getScriptProperties();
  const id = ozellikler.getProperty('FOTO_KLASOR_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (hata) { /* klasör silinmiş: yeniden oluştur */ }
  }
  const klasor = DriveApp.createFolder(AYARLAR.FOTO_KLASORU);
  ozellikler.setProperty('FOTO_KLASOR_ID', klasor.getId());
  return klasor;
}

function fotoKaydet(foto, requestId, adSoyad) {
  const tur = metin(foto.type).toLowerCase();
  if (IZINLI_FOTO.indexOf(tur) === -1) return { code: 'BAD_PHOTO' };
  let baytlar;
  try {
    baytlar = Utilities.base64Decode(metin(foto.data));
  } catch (hata) {
    return { code: 'BAD_PHOTO' };
  }
  if (!baytlar.length || baytlar.length > EN_FAZLA_FOTO) return { code: 'PHOTO_SIZE' };
  const uzanti = tur === 'image/png' ? 'png' : tur === 'image/webp' ? 'webp' : 'jpg';
  const ad = (adSoyad || 'basvuru').replace(/[^\p{L}\p{N} ]+/gu, '').trim().slice(0, 60) || 'basvuru';
  const dosya = fotoKlasoru().createFile(Utilities.newBlob(baytlar, tur, `${ad} - ${requestId}.${uzanti}`));
  return { url: dosya.getUrl() };
}

function epostalar(tur, alanlar, requestId) {
  const baslik = tur === 'participant' ? 'Katılımcı Kaydı' : 'Sunum ve Atölye Başvurusu';
  let onayGitti = false;
  try {
    if (AYARLAR.BILDIRIM_EPOSTASI) {
      const satirlar = SAYFALAR[tur].sutunlar
        .filter(([ad]) => alanlar[ad] !== undefined && alanlar[ad] !== '' && ad !== 'consent')
        .map(([ad, etiket]) => [etiket, Array.isArray(alanlar[ad]) ? alanlar[ad].join(', ') : alanlar[ad] === true ? 'Evet' : alanlar[ad] === false ? 'Hayır' : alanlar[ad]]);
      MailApp.sendEmail({
        to: AYARLAR.BILDIRIM_EPOSTASI,
        subject: `Yeni ${baslik}: ${metin(alanlar.fullName)}`,
        name: AYARLAR.GONDEREN_ADI,
        body: satirlar.map(([k, v]) => `${k}: ${v}`).join('\n') + `\n\nTablo: ${tabloyuAc().getUrl()}`,
        htmlBody: ekipEpostasi(baslik, satirlar, requestId)
      });
    }
    if (AYARLAR.ONAY_EPOSTASI_GONDER) {
      const posta = onayEpostasi(tur, alanlar, requestId);
      const secenek = { to: metin(alanlar.email), subject: posta.konu, name: AYARLAR.GONDEREN_ADI, body: posta.metin, htmlBody: posta.html };
      if (AYARLAR.YANIT_ADRESI) secenek.replyTo = AYARLAR.YANIT_ADRESI;
      MailApp.sendEmail(secenek);
      onayGitti = true;
    }
  } catch (hata) {
    // E-posta gönderilemese de kayıt tabloya yazıldığı için başvuru başarılı sayılır.
    console.error(hata);
  }
  return onayGitti;
}

function kac(deger) {
  return metin(deger).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function onayEpostasi(tur, alanlar, requestId) {
  const ad = kac(alanlar.fullName);
  const katilimci = tur === 'participant';
  const konu = katilimci ? `Kaydınız alındı · ${AYARLAR.KONFERANS}` : `Başvurunuz alındı · ${AYARLAR.KONFERANS}`;
  const ust = katilimci ? 'Kaydınız alındı!' : 'Başvurunuz alındı!';
  const giris = katilimci
    ? `Merhaba ${ad},<br>${AYARLAR.KONFERANS} için katılımcı kaydınız tamamlandı. Sizi aramızda görmek için sabırsızlanıyoruz.`
    : `Merhaba ${ad},<br>${AYARLAR.KONFERANS} için sunum ve atölye başvurunuz bize ulaştı. Paylaşmak istediğiniz deneyim için teşekkür ederiz.`;
  const ozet = katilimci ? '' : kutu('Başvurunuz', [
    ['Sunum başlığı', kac(alanlar.presentationTitle)], ['Tema', kac(alanlar.category)]
  ]) + `<p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#33446e">Başvurular organizasyon kurulu tarafından değerlendirilecek. Sonucu bu e-posta adresine bildireceğiz.</p>`;
  const html = sablon(ust, giris,
    ozet +
    kutu('Etkinlik bilgileri', [
      ['Tarih', ETKINLIK.tarih], ['Kayıt', ETKINLIK.kayit],
      ['Yer', `${ETKINLIK.yer}<br><span style="color:#6b7aa6">${ETKINLIK.sehir}</span> · <a href="${ETKINLIK.harita}" style="color:#2f6bff;text-decoration:none">Haritada gör →</a>`]
    ]) +
    (katilimci ? programTablosu() : '') +
    `<p style="margin:0 0 6px;font-size:13px;color:#6b7aa6">${katilimci ? 'Kayıt kodunuz' : 'Başvuru kodunuz'}</p>
     <p style="margin:0 0 28px;font-family:Menlo,Consolas,monospace;font-size:13px;color:#071233;background:#eef3ff;border-radius:8px;padding:10px 12px;word-break:break-all">${kac(requestId)}</p>` +
    dugme(ETKINLIK.site, 'Konferans sayfasını ziyaret et'));
  const duz = `${katilimci ? 'Kaydınız alındı' : 'Başvurunuz alındı'}\n\nMerhaba ${metin(alanlar.fullName)},\n` +
    (katilimci ? `${AYARLAR.KONFERANS} için katılımcı kaydınız tamamlandı.` : `${AYARLAR.KONFERANS} için sunum ve atölye başvurunuz bize ulaştı. Sonucu bu e-posta adresine bildireceğiz.`) +
    `\n\nTarih: ${ETKINLIK.tarih}\nKayıt: ${ETKINLIK.kayit}\nYer: ${ETKINLIK.yer}, ${ETKINLIK.sehir}\nHarita: ${ETKINLIK.harita}\n\n` +
    (katilimci ? 'Günün akışı:\n' + ETKINLIK.program.map(([s, a]) => `${s}  ${a}`).join('\n') + '\n\n' : '') +
    `Kod: ${requestId}\n\n${ETKINLIK.site}\nİletişim: ${ETKINLIK.telefon} · ${ETKINLIK.eposta}`;
  return { konu, html, metin: duz };
}

function ekipEpostasi(baslik, satirlar, requestId) {
  return sablon(`Yeni ${baslik.toLowerCase()}`, `Sitedeki formdan yeni bir ${baslik.toLowerCase()} geldi.`,
    kutu('Gönderilen bilgiler', satirlar.map(([k, v]) => [kac(k), kac(v).replace(/\n/g, '<br>')])) +
    `<p style="margin:0 0 24px;font-size:13px;color:#6b7aa6">Kod: ${kac(requestId)}</p>` +
    dugme(tabloyuAc().getUrl(), 'Tabloyu aç'));
}

function kutu(baslik, satirlar) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #dbe4fb;border-radius:14px;border-collapse:separate">
    <tr><td style="padding:16px 20px 4px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#2f6bff;font-weight:bold">${baslik}</td></tr>
    ${satirlar.map(([k, v]) => `<tr><td style="padding:10px 20px;border-top:1px solid #eef2fd"><div style="font-size:12px;color:#6b7aa6;margin-bottom:3px">${k}</div><div style="font-size:15px;line-height:1.5;color:#071233">${v}</div></td></tr>`).join('')}
    <tr><td style="height:8px;line-height:8px;font-size:0">&nbsp;</td></tr>
  </table>`;
}

function programTablosu() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border:1px solid #dbe4fb;border-radius:14px;border-collapse:separate">
    <tr><td colspan="2" style="padding:16px 20px 8px;font-size:12px;letter-spacing:1.6px;text-transform:uppercase;color:#2f6bff;font-weight:bold">Günün akışı</td></tr>
    ${ETKINLIK.program.map(([saat, olay]) => `<tr><td style="padding:8px 0 8px 20px;width:112px;font-size:14px;color:#071233;font-weight:bold;white-space:nowrap;vertical-align:top">${saat}</td><td style="padding:8px 20px 8px 8px;font-size:14px;color:#33446e">${olay}</td></tr>`).join('')}
    <tr><td colspan="2" style="padding:6px 20px 14px;font-size:12px;color:#6b7aa6">Program değişebilir; güncel akış sitemizde.</td></tr>
  </table>`;
}

function dugme(adres, yazi) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px"><tr><td style="border-radius:999px;background:#2f6bff">
    <a href="${adres}" style="display:inline-block;padding:14px 26px;font-size:15px;font-weight:bold;color:#ffffff;text-decoration:none;border-radius:999px">${yazi} →</a>
  </td></tr></table>`;
}

function sablon(ust, giris, icerik) {
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef2fb">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2fb"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
    <tr><td style="background:#071233;background-image:linear-gradient(135deg,#071233 0%,#0d2a7a 60%,#2f6bff 140%);padding:30px 32px 34px">
      <img src="${ETKINLIK.logo}" width="120" height="60" alt="EDK · Eğitimde Değişim Konferansı" style="display:block;border:0;width:120px;height:auto">
      <p style="margin:26px 0 8px;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#8fd0ff">${AYARLAR.KONFERANS}</p>
      <h1 style="margin:0;font-size:28px;line-height:1.2;font-weight:600;color:#ffffff">${ust}</h1>
    </td></tr>
    <tr><td style="padding:30px 32px 10px">
      <p style="margin:0 0 26px;font-size:16px;line-height:1.65;color:#1b2a55">${giris}</p>
      ${icerik}
    </td></tr>
    <tr><td style="padding:22px 32px 30px;border-top:1px solid #eef2fd;font-size:13px;line-height:1.6;color:#6b7aa6">
      Sorularınız için: <a href="tel:+905333579072" style="color:#2f6bff;text-decoration:none">${ETKINLIK.telefon}</a> · <a href="mailto:${ETKINLIK.eposta}" style="color:#2f6bff;text-decoration:none">${ETKINLIK.eposta}</a><br>
      Eğitimde İnovasyon Derneği · <a href="${ETKINLIK.site}" style="color:#2f6bff;text-decoration:none">EDK web sitesi</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

function metin(deger) {
  return deger === undefined || deger === null ? '' : String(deger).trim().slice(0, EN_FAZLA_METIN);
}

// =, +, -, @ ile başlayan değerler E-Tablolar'da formül olarak çalışmasın.
function guvenli(deger) {
  return /^[=+\-@]/.test(deger) ? "'" + deger : deger;
}

function json(nesne) {
  return ContentService.createTextOutput(JSON.stringify(nesne)).setMimeType(ContentService.MimeType.JSON);
}
