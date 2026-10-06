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
  KONFERANS: '11. Eğitimde Değişim Konferansı'
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

    epostalar(tur, alanlar, requestId);
    return json({ ok: true, requestId: requestId });
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
  try {
    if (AYARLAR.BILDIRIM_EPOSTASI) {
      MailApp.sendEmail(AYARLAR.BILDIRIM_EPOSTASI, `Yeni ${baslik}: ${metin(alanlar.fullName)}`,
        `${AYARLAR.KONFERANS} için yeni bir ${baslik.toLowerCase()} geldi.\n\nAd Soyad: ${metin(alanlar.fullName)}\nE-posta: ${metin(alanlar.email)}\nKod: ${requestId}\n\nTablo: ${tabloyuAc().getUrl()}`);
    }
    if (AYARLAR.ONAY_EPOSTASI_GONDER) {
      const govde = tur === 'participant'
        ? `Merhaba ${metin(alanlar.fullName)},\n\n${AYARLAR.KONFERANS} için kaydınız alındı. 19 Aralık 2026'da İstinye Üniversitesi Vadi Kampüsünde görüşmek üzere.\n\nKayıt kodunuz: ${requestId}`
        : `Merhaba ${metin(alanlar.fullName)},\n\n${AYARLAR.KONFERANS} için sunum ve atölye başvurunuz alındı. Değerlendirme sonrasında sizinle iletişime geçeceğiz.\n\nBaşvuru kodunuz: ${requestId}`;
      MailApp.sendEmail(metin(alanlar.email), `${AYARLAR.KONFERANS} · ${baslik}`, govde);
    }
  } catch (hata) {
    // E-posta gönderilemese de kayıt tabloya yazıldığı için başvuru başarılı sayılır.
    console.error(hata);
  }
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
