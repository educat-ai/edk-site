# Başvuru formları: yazılım ekibi için teslim notu

> **Güncel durum (6 Ekim 2026):** Gönderim artık hazır. İki form Google Apps Script üzerinden Google E-Tablolar'a bağlanıyor. Kurulum için [KURULUM-FORMLAR.md](KURULUM-FORMLAR.md), Google tarafının kodu için [google-apps-script/Kod.gs](google-apps-script/Kod.gs) dosyasına bakın; adres `dist/form-config.js` içine yazılır. Aşağıdaki notlar ilk teslimden kalmadır; alan listeleri hâlâ geçerlidir.

Sitede iki ayrı form var. Arayüz ve tarayıcı tarafı doğrulama hazır; **verilerin bir yere kaydedilmesi henüz bağlı değil.** Bu not, gönderimi bağlamak için gereken her şeyi özetler.

| | Katılımcı Kaydı (izleyici) | Sunum ve Atölye Başvurusu |
|---|---|---|
| Açan düğmeler | `data-panel="participant"` ("Kayıt Ol", "Katılımcı Kaydı") | `data-panel="apply"` ("Sunum ve Atölye Başvurusu", "Başvuru Yap") |
| Pencere | `#participant-dialog`, form `#participant-form` | `#application-dialog`, form `#application-form` |
| Kod | `dist/participant.js` | `dist/application.js` |
| Adım | Tek sayfa | 3 adım: başvuru sahibi → sunum → kontrol ve onay |
| Dosya yükleme | Yok | Profil fotoğrafı (`photo`, çoklu seçime izin veriyor) |

Her iki pencere `dist/index.html` ve `dist/hakkimizda.html` içinde **aynı HTML ile tekrarlanıyor.** Birinde yapılan HTML değişikliği diğerine de uygulanmalı.

## 1. Katılımcı Kaydı alanları

| `name` | Tür | Zorunlu | Değerler / not |
|---|---|---|---|
| `fullName` | metin | ✓ | |
| `email` | e-posta | ✓ | Tarayıcı biçim kontrolü var |
| `phone` | telefon | ✓ | En az 10 rakam kontrolü var |
| `city` | metin | ✓ | |
| `institution` | metin | ✓ | Okul veya kurum |
| `role` | tek seçim | ✓ | Öğretmen · Okul yöneticisi / Eğitim lideri · Rehber öğretmen · Akademisyen · Eğitim teknolojileri uzmanı · Eğitim profesyoneli · Öğretmen adayı · Diğer |
| `schoolType` | tek seçim | ✓ | Devlet okulu · Özel okul · Üniversite · Diğer |
| `levels` | çoklu seçim | | Okul öncesi · İlkokul · Ortaokul · Lise |
| `themes` | çoklu seçim | | 8 salon teması (sitedeki temalarla aynı adlar) |
| `consent` | onay kutusu | ✓ | KVKK aydınlatma metni onayı |
| `newsletter` | onay kutusu | | E-posta duyuruları izni |

**Bağlanacak yer:** `dist/participant.js` içindeki `sendRegistration(registration)` fonksiyonu.
- `registration` nesnesi `collect()` ile hazırlanıyor. Çoklu seçimler dizi, onaylar `true/false` olarak geliyor ve `submittedAt` (ISO tarih) alanı da ekleniyor.
- Gönderim başarılıysa fonksiyon normal dönmeli. Hata olursa `throw` etmeli; arayüz bu durumda "Kaydın şu anda alınamadı…" mesajını gösterir.
- Gönderim sürerken düğme otomatik olarak devre dışı kalır.

## 2. Sunum ve Atölye Başvurusu alanları

| `name` | Tür | Zorunlu | Adım |
|---|---|---|---|
| `email` | e-posta | ✓ | 1 |
| `fullName` | metin | ✓ | 1 |
| `city` | metin | ✓ | 1 |
| `institution` | metin | ✓ | 1 |
| `biography` | uzun metin | ✓ | 1 |
| `jobTitle` | metin | ✓ | 1 |
| `education` | tek seçim | ✓ | 1, değerler: Ana Sınıfı · İlkokul · Ortaokul · Lise |
| `category` | tek seçim | ✓ | 2, değerler: 8 salon teması + Diğer |
| `presentationTitle` | metin | ✓ | 2 |
| `description` | uzun metin | ✓ | 2 |
| `photo` | dosya | ✓ | 2 (`multiple`; tür veya boyut sınırı henüz yok) |
| `social` | metin | | 2 |
| `approval` | tek seçim | ✓ | 3, KVKK onayı |

**Bağlanacak yer:** `dist/application.js`.
- **Gönder düğmesi:** "Başvuruyu gönder" düğmesi (`#application-send`) şu an `disabled` ve tıklama olayı yok.
- **Kontrol düğmesi:** "Alanları kontrol et" (`#application-check`) bütün alanları doğrulayıp yalnızca bir önizleme mesajı gösteriyor (`checkAll()`).
- **Yapılacak:** Gönderim için `#application-send` etkinleştirilmeli ve `checkAll()` başarılı olduktan sonra veriler `FormData(form)` ile gönderilmeli; fotoğraf dosyası da bunun içinde. Başarı ve hata durumları için bir ekran tasarlanmadı; katılımcı formundaki onay ekranı örnek alınabilir.

## 3. Yayına almadan önce kaldırılacak önizleme notları

- `#participant-preview-note`: "Önizleme · Gönderim henüz etkin değil."
- `#application-preview-note`: "Yerel önizleme · Gönderim henüz etkin değil."
- `.application-storage-note`: Sunum formu 3. adımda "Yazdıklarınız yalnızca bu sayfa açıkken tutulur…"
- `#application-photo-hint` ve fotoğraf önizlemesindeki "Dosya yüklenmedi" metinleri (`application.js` içinde `previewPhotos()`).
- `application.js` içindeki `checkAll()` mesajı: "Bu bir önizlemedir; başvurunuz gönderilmedi."

## 4. Arayüzün verdiği sözler

- **Katılımcı onay ekranı:** "Kayıt ayrıntıları **{e-posta}** adresine gönderilecek." yazıyor. Otomatik onay e-postası gönderilmeyecekse bu cümle değiştirilmeli (`#participant-success-email` paragrafı).
- **Kapasite ve son başvuru:** Arayüzde kapasite (yaklaşık 500 kişi), son başvuru tarihi ya da başvuru değerlendirme süreci hakkında bir söz **yok.** Bunlar netleşince "Katılım" kartlarına (`#katilim`) ve SSS'ye eklenebilir.

## 5. Verilerin saklanması için seçenekler

Site şu an tamamen statik (sunucusuz). Değerlendirilen seçenekler:

1. **Google Apps Script → Google E-Tablolar (+ Drive)** (önerilen, en hafif yol)
   - Form verisi bir Apps Script web uygulamasına POST edilir. Script satırları "Katılımcılar" ve "Sunum Başvuruları" sekmelerine yazar, fotoğrafları bir Drive klasörüne kaydeder.
   - İsteğe bağlı olarak başvurana onay e-postası, ekibe bildirim gönderilebilir.
   - Statik barındırmayla (ör. GitHub Pages) çalışır.
   - CORS ve fotoğraf yükleme davranışı gerçek tarayıcıda test edilmeli.
2. **Kendi sunucu ucu + Drive/Sheets API:** Önceki plan, ayrıntıları `backend-draft/` klasöründe. Barındırma ve kimlik bilgisi yönetimi gerektirir.
3. **Hazır form servisi** (Tally, Formspree vb.): Kurulumu kolay, ancak veriler üçüncü taraf sunucularda tutulur ve ücretli plan gerekebilir.

**KVKK:** İki formda da Eğitimde İnovasyon Derneği'nin aydınlatma metni bağlantısı ve zorunlu onay var. Verilerin tutulacağı yer (ör. Google) için derneğin KVKK metni ve yurt dışına aktarım hükümleri kontrol edilmeli.

## 6. Diğer notlar

- `local-test/client.js` sunum formundaki bazı öğelere (`#application-form`, `#application-send`, `#application-check` vb.) bağlı. `category` alanı metin kutusundan seçim listesine çevrildi; yerel testin bu değişiklikten etkilenip etkilenmediği kontrol edilmeli.
- **Kapanma davranışı:** Form pencereleri `Esc`, × düğmesi ve pencere dışına tıklamayla kapanır (`site.js`). Pencere açıkken sayfa kaydırması kilitlenir (`html.application-open`).
