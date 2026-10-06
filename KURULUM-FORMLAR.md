# Başvuru formlarını Google E-Tablolar'a bağlama

Kurulum bitince sitedeki iki form şöyle çalışır:
- **Katılımcı Kaydı:** Her kayıt bir Google E-Tablo'nun **"Katılımcılar"** sayfasına yeni satır olarak düşer.
- **Sunum ve Atölye Başvurusu:** Her başvuru **"Sunum Başvuruları"** sayfasına düşer. Profil fotoğrafı Google Drive'daki bir klasöre kaydedilir; tabloda fotoğrafın bağlantısı olur.

Ücretsizdir; ayrı bir sunucu gerekmez. Yaklaşık 10 dakika sürer.

> **Hangi hesap?** Tablo ve fotoğraflar, kurulumu yapan Google hesabında durur. Kalıcı olması için kişisel değil, derneğin ya da Educat'in kurumsal hesabını kullanın.

---

## 1. Tabloyu oluştur

1. [sheets.new](https://sheets.new) adresini açın; boş bir Google E-Tablo açılır.
2. Sol üstten adını **EDK 2026 Başvurular** yapın.

## 2. Kodu yapıştır

1. Tablonun menüsünden **Uzantılar → Apps Script**'i açın. Yeni bir sekmede kod düzenleyici açılır.
2. Soldaki `Kod.gs` dosyasının içindekileri tamamen silin.
3. Bu projedeki [`google-apps-script/Kod.gs`](google-apps-script/Kod.gs) dosyasının **tamamını** kopyalayıp yapıştırın.
4. Sol üstteki "Adsız proje" yazısına tıklayıp adını **EDK Başvuru Sistemi** yapın.
5. **Kaydet** simgesine (💾) basın.

### İsteğe bağlı ayarlar

Kodun en üstündeki `AYARLAR` bölümünü değiştirebilirsiniz:

| Ayar | Ne işe yarar |
|---|---|
| `BILDIRIM_EPOSTASI` | Yeni başvuru gelince buraya e-posta gider. Ör. `'ekip@ornek.org'`. Boşsa gönderilmez. |
| `ONAY_EPOSTASI_GONDER` | `true` yapılırsa başvuran kişiye "başvurunuz alındı" e-postası gider. |
| `KATILIMCI_KONTENJANI` | Ör. `500` yapılırsa 500 kayıttan sonra yeni kayıt kabul edilmez. `0` = sınırsız. |

E-postalar kurulumu yapan hesaptan gönderilir. Google'ın günlük gönderim sınırı vardır: normal Gmail hesabında günde yaklaşık 100, Google Workspace hesabında yaklaşık 1.500 e-posta.

## 3. Kurulumu çalıştır ve izin ver

1. Üstteki araç çubuğunda, **Çalıştır** düğmesinin yanındaki açılır listeden **`kurulum`** fonksiyonunu seçin.
2. **Çalıştır**'a basın.
3. "Yetkilendirme gerekli" penceresinde **İzinleri incele**'ye basın ve hesabınızı seçin.
4. **"Google bu uygulamayı doğrulamadı"** uyarısı çıkarsa bu normaldir; kodu siz eklediniz. **Gelişmiş**'e, ardından **EDK Başvuru Sistemi (güvenli değil) sayfasına git**'e basın.
5. İzinleri **İzin ver** ile onaylayın. Kodun istediği izinler: tabloya yazma, Drive'a fotoğraf kaydetme ve e-posta gönderme.

İşlem bitince tabloya dönün. **Katılımcılar** ve **Sunum Başvuruları** sayfaları başlıklarıyla oluşmuş olmalı. Google Drive'ınızda da **EDK 2026 Başvuru Fotoğrafları** klasörü oluşmuş olmalı.

## 4. Web uygulaması olarak yayınla

1. Apps Script'te sağ üstten **Dağıt → Yeni dağıtım**'a basın.
2. "Tür seçin" (⚙️) simgesinden **Web uygulaması**'nı seçin.
3. Ayarları şöyle yapın:
   - **Açıklama:** EDK formları
   - **Şu kullanıcı olarak yürüt:** **Ben** (kendi hesabınız)
   - **Erişimi olan kullanıcılar:** **Herkes**
4. **Dağıt**'a basın. Gerekirse izinleri tekrar onaylayın.
5. Çıkan **Web uygulaması URL'sini** kopyalayın. `https://script.google.com/macros/s/…/exec` biçimindedir.

> "Herkes" ayarı, sitenin ziyaretçilerinin formu gönderebilmesi içindir. Ziyaretçiler tabloyu ya da fotoğrafları **göremez**; yalnızca yeni satır ekleyebilirler. Tabloyu sadece sizin paylaştığınız kişiler görür.

**Kontrol:** Kopyaladığınız adresi tarayıcıda açın. `{"ok":true,"mesaj":"EDK başvuru sistemi çalışıyor."}` yazısını görmelisiniz.

## 5. Siteye bağla

Web uygulaması adresini Claude'a gönderin; siteye ekleyip yayına alır.

Kendiniz yapmak isterseniz:
1. `dist/form-config.js` dosyasındaki satırı şöyle değiştirin:
   ```js
   window.EDK_FORM_ENDPOINT = 'https://script.google.com/macros/s/…/exec';
   ```
2. Dört sayfada (`index.html`, `hakkimizda.html`, `galeri.html`, `komite.html`) `form-config.js?v=1` yazısını `form-config.js?v=2` yapın. Böylece tarayıcılar yeni ayarı hemen alır.
3. GitHub'a yükleyin.

Adres eklenince formların üstündeki "Önizleme · Gönderim henüz etkin değil" uyarısı kendiliğinden kaybolur.

## 6. Dene

1. Sitede **Kayıt Ol** formunu deneme bilgileriyle doldurun. Tabloda **Katılımcılar** sayfasına satır düşmeli.
2. **Sunum Başvurusu** formunu bir fotoğrafla doldurun. **Sunum Başvuruları** sayfasına satır düşmeli; "Profil fotoğrafı" sütununda Drive bağlantısı olmalı.
3. Deneme satırlarını silebilirsiniz. Satırı seçip sağ tıklayın ve **Satırı sil**'i seçin.

---

## E-postaların bilgi@egitimdedegisim.com adresinden gitmesi

Kodda gönderen adresi `bilgi@egitimdedegisim.com` olarak ayarlı. Gmail'in bu adres adına göndermesine izin vermek için, kurulumu yapan Gmail hesabında bir kerelik şu adımları yapın:

1. Gmail'i açın; sağ üstte ⚙️ → **Tüm ayarları görün** → **Hesaplar ve İçe Aktarma**.
2. **Postayı farklı adresten gönder** satırında **Başka bir e-posta adresi ekleyin**'e tıklayın.
3. **Ad:** `Eğitimde Değişim Konferansı`, **E-posta:** `bilgi@egitimdedegisim.com`. "Takma ad olarak değerlendir" işaretli kalsın. **Sonraki adım**.
4. Gmail, bilgi@ adresinin e-posta sunucusu bilgilerini (SMTP) ister. Bunları alan adının barındırma panelinden ya da e-posta sağlayıcısından alın:
   - **SMTP sunucusu:** genelde `mail.egitimdedegisim.com`. Adres Google Workspace'teyse `smtp.gmail.com`.
   - **Kullanıcı adı:** `bilgi@egitimdedegisim.com`
   - **Şifre:** bilgi@ hesabının şifresi. Google Workspace'te iki adımlı doğrulama açıksa "uygulama şifresi" gerekir.
   - **Bağlantı noktası:** 587 (TLS) ya da 465 (SSL)
5. **Hesap ekle**'ye basın. Gmail, **bilgi@egitimdedegisim.com** adresine bir doğrulama e-postası gönderir; içindeki kodu girin ya da bağlantıya tıklayın.
6. Apps Script'te üstteki listeden **`gonderenKontrol`** fonksiyonunu seçip **Çalıştır**'a basın. Yürütme günlüğünde "Tamam: e-postalar bilgi@egitimdedegisim.com adresinden gidecek." yazmalı.

Bu adımlar yapılmadan önce de sistem çalışır: e-postalar kurulum hesabından gider ve "Yanıtla"ya basılınca yanıt bilgi@egitimdedegisim.com adresine düşer.

## Günlük kullanım

- **Excel olarak indirmek:** Tabloda **Dosya → İndir → Microsoft Excel (.xlsx)**.
- **Ekiple paylaşmak:** Sağ üstteki **Paylaş** düğmesi. Tabloda telefon ve e-posta gibi kişisel veriler var; KVKK açısından erişimi gerçekten ihtiyacı olan kişilerle sınırlı tutun.
- **Sunum başvurularını değerlendirmek:** "Durum" sütununda **Beklemede / Kabul / Ret** seçenekleri var; "Değerlendirme notu" sütununa not yazılabilir. Bu iki sütunu ekip kendisi doldurur.
- **Filtrelemek ve sıralamak:** **Veri → Filtre oluştur**.
- **Aynı başvuru iki kez gelmez:** Bağlantı kopup form tekrar gönderilirse sistem bunu tanır ve ikinci satırı yazmaz.

## Kodda değişiklik yaparsanız

Örneğin kontenjanı değiştirdiniz. Kaydettikten sonra **Dağıt → Dağıtımları yönet**'e gidin, mevcut dağıtımın yanındaki ✏️ simgesine basın, **Sürüm: Yeni sürüm**'ü seçip **Dağıt**'a basın.

Böyle yapınca web uygulaması adresi **değişmez**; siteye dokunmanız gerekmez. "Yeni dağıtım" ile yeni bir adres oluşturmayın; oluşturursanız siteyi de güncellemek gerekir.

## Sorun giderme

| Belirti | Neden / çözüm |
|---|---|
| Formda "Gönderim tamamlanamadı" | Dağıtım ayarlarında **Erişim: Herkes** olduğundan emin olun. |
| Adres açılınca giriş sayfası çıkıyor | Erişim "Herkes" değil; dağıtımı düzenleyin. |
| Satır gelmiyor ama hata da yok | Apps Script'te soldaki **Yürütmeler** (≡▶) bölümünde hata kaydına bakın. |
| Sayfalar bozuldu ya da silindi | `kurulum` fonksiyonunu tekrar çalıştırın; eksik sayfalar yeniden oluşur. |

**Sayfa ve sütun adları:** Tablodaki sayfa adlarını ("Katılımcılar", "Sunum Başvuruları") değiştirmeyin. Sütunların sırasını da değiştirmeyin. Sağ tarafa yeni sütun eklemek sorun çıkarmaz.
