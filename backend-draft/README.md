# EDK başvuru arka ucu — yerel kurulum taslağı

Bu klasör mevcut EDK projesinin sunucu tarafı hazırlığıdır. `dist/` dosyalarına bağlı değildir; sunucu başlatmaz, HTTP isteği göndermez, OAuth yapmaz ve siteyi yayınlamaz. Mevcut formun gerçek gönderim düğmesi kapalı kalır. Gerçek Google kimlik bilgisi yoktur.

## Amaç ve mevcut durum

Ziyaretçi EDK'nın özel formunda kalır. Gelecekte `/api/applications` aynı sitedeki sunucuya gönderir; sunucu erencnr@gmail.com adına yetkilendirilen ayrı Sheet'e başvuruyu, yalnız Eren'e açık Drive klasörüne fotoğrafı kaydeder. Google ekranı ziyaretçiye açılmaz. Kurulumdaki Google onayı yalnız hesap sahibi içindir.

Native Google Forms yanıtı veya dosya yükleme sorusu taklit edilmez. ChatGPT Drive bağlantısının OAuth kimlik bilgileri sitede yeniden kullanılamaz; araç bağlantısı uygulamanın sunucu kimliği değildir.

Mevcut `.openai/hosting.json`: `project_id=appgprj_6abe250b85108191b77de1730ce68119`, `static.directory=dist`. Proje şu anda statik; Python önizleme sunucusu başvuruyu Google'a kaydeden bir API sağlamaz. Bu dosya değiştirilmedi.

Salt okunur Sites `get_site` kontrolü: aynı proje aktif, mevcut kullanıcı owner, version 0, live URL null, access mode custom. Kaynak repo/Worker runtime ve dağıtım yolu henüz doğrulanmadı; read sonucu bir Node sunucusu veya yayın yetkisi değildir.

Parent tarafından oluşturulup yalnız erencnr@gmail.com erişimi doğrulanan test hedefleri, devre dışı yerel örnek yapılandırmaya aynen aktarıldı:

| Hedef | Exact kimlik |
|---|---|
| Test kök klasörü | `1wTdZNkMaEC8j8kx5yyaEtK1UGaejwkBE` |
| Fotoğraf klasörü | `1Z_85YgPFvukSd18GUlmoouNnBXe2H3JJ` |
| Sheet dosyası | `16SRLZ-6vD3JisASx01PQwUt9szy0CK_qdoibpN3w56g` |
| Başvurular tabı | `1753152081` |
| Alan eşlemesi tabı | `1434583631` |
| EDK_Test_Basvurular native tablosu | `1658952954`, mevcut aralık `A1:S2` |

Seed `EDK-TEST-SEED-0001` ve parent'ın özel dummy fotoğrafı storage fixture'dır; frontend'den gönderilmiş başvuru sayılmaz. Bu worker Google'daki hedeflere veri yazmadı.

## Desteklenen seçenekler

| Seçenek | Çalışma biçimi | Kurulum önkoşulu | Bu oturumun sınırı |
|---|---|---|---|
| Aynı origin sunucu + Drive/Sheets REST API | Eren'in sunucuda tutulan OAuth yetkisiyle dosya yükler ve satır ekler; ziyaretçiye Google girişi gerekmez | Sunucu barındırma kararı, Drive/Sheets API etkinleştirme, hesap sahibinin OAuth onayı, gizli değerlerin sunucu kasasında tutulması | Yerel sözleşme/taslak hazır; OAuth ve dağıtım yapılmadı |
| Apps Script | Script hesap sahibi olarak çalışır; Drive ve Sheet'e yazar | Script projesi ve sahibi tarafından Google servis izinleri; daha sonra web app/API executable dağıtımı | Apps Script oluşturma/çalıştırma/dağıtma aracı mevcut değil; bağlı Drive aracı bu işi yapmaz |
| Cloud Run functions (Cloud Functions alternatifi) | API sunucusunu Google Cloud'da barındırır; My Drive fotoğrafı için yine Eren adına OAuth gerekir | Cloud proje kimliği, billing, ilgili API'ler, dağıtım/IAM ve secret erişimi | Google Cloud dağıtım aracı veya yetkilendirilmiş CLI oturumu doğrulanmadı; hiçbir kaynak oluşturulmadı |

Öneri: mevcut sitenin aynı origin sunucusuyla Drive/Sheets REST API. Seçilen barındırmanın runtime desteği ayrıca doğrulanmalı; mevcut statik Sites metadata'sı tek başına Node API'nin çalıştığını göstermez. Sites dağıtım/env araçları görünür olsa da Google OAuth sağlayamaz ve bunlar bu görevde çağrılmadı. Yeni Site oluşturulmaz; mevcut proje kimliği korunur.

Apps Script doğrudan tarayıcıdan çapraz origin JSON yükleme için hazır bir API gateway sayılmaz: ContentService yanıtı googleusercontent.com'a yönlendirir, TextOutput API'sinde genel header/status ayarlama yöntemi yoktur. Bu belgelerden CORS davranışının her tarayıcıda güvenilir olduğu çıkarılamaz. Ayrı bir sunucu proxy'si veya gerçek tarayıcı testleri gerekir. `mode:no-cors` okunamayan yanıt üretirse başarılı kayıt sayılmaz. `google.script.run` yalnız Apps Script HTML ortamında kullanılır; mevcut yerel sitede var olduğu varsayılmaz.

Apps Script API `scripts.run` için API executable dağıtımı, script ve çağıran uygulamada ortak standard Cloud projesi ve uygun OAuth token gerekir. Bu API servis hesaplarıyla çalışmaz. Bir script dosyasını Drive'a yüklemek bunları oluşturmaz.

## Bağlantı onayından önce netleşmesi gerekenler

1. Test hedefleri geldi; sunucunun yeni OAuth bağlantısıyla erişim, sahiplik, yalnız sahibin paylaşımı ve verilen 19 başlık gerçek kayıt öncesinde tekrar doğrulanacak. Mevcut tablo başlıkları değiştirilmez; hedef ID'ler ziyaretçi payload'ından alınmaz.
2. Barındırma ve OAuth istemcisi belirlensin. Önerilen kapsam `https://www.googleapis.com/auth/drive.file`: yeni uygulamanın hedef Sheet ve klasöre erişimi, sahibi tarafından Picker/seçim veya aynı uygulamayla oluşturma yoluyla ayrıca verilmelidir. Sadece dosya ID'sini bilmek bu kapsamda erişim sağlamaz. Sheets append de `drive.file` kabul eder. `spreadsheets` veya bütün Drive'a erişen `drive` kapsamına sessizce genişlenmez.
3. Hesap sahibi için exact onay: “EDK sunucusunun seçtiğin test Sheet'e yazması ve özel test klasörüne dosya eklemesi için erencnr@gmail.com ile Google bağlantısı kurulacak. Ziyaretçiye Google ekranı açılmayacak. İstemci kimliği, redirect URI, istenecek kapsamlar ve saklanacak refresh token önce gösterilecek.” Bu adım bu görevde başlatılmadı.
4. Client secret/refresh token yalnız barındırmanın secret kasasında olur; `dist/`, tarayıcı, sohbet, log veya Git'e konmaz. Sunucu bağlı hesabı Drive `about.get` ile kontrol eder. Testing durumundaki OAuth token yaşam süresi ayrıca değerlendirilir; kalıcı üretim erişimi varsayılmaz.
5. Cloud Run seçilirse billing/API/IAM değişikliği ve maliyet kapsamı ayrıca onaylanır. Belgelenen deployer rolleri `roles/run.sourceDeveloper`, `roles/serviceusage.serviceUsageConsumer`, hizmet kimliğinde `roles/iam.serviceAccountUser`; build kimliği için `roles/run.builder`. Daha geniş admin rolü varsayılmaz. Public endpoint açılması ve canlı dağıtım ayrı onaydır.
6. Fotoğrafın gerçek izin verilen türü/sayısı/boyutu kaynakta bilinmiyor. `uploadPolicy=null` bunu bilerek kilitler. Test dosyası kuralları, üretim form kuralı diye sunulmaz. Sunucu gerçek dosya içeriğini de doğrulamalı; yalnız tarayıcının MIME etiketine güvenilmez.

Gmail/My Drive için servis hesabını klasöre eklemek fotoğraf sahipliği sorununun çözümü değildir: Google'a göre servis hesaplarının storage kotası yoktur ve dosya sahibi olamaz. İnsan kullanıcı adına OAuth veya uygun shared drive gerekir; mevcut talepte özel Gmail Drive hedefi esas alınır.

## Yerel kod ve veri sözleşmesi

`storage-plan.mjs` yalnız **çalıştırılmamış test istek planı** üretir. Her gerçek API isteği ve OAuth adapter'i gelecekte ayrıca uygulanır. Varsayılan `config.example.json` disabled durumundadır; test modunda dahi gerçek gönderen veya endpoint yoktur.

Girdi: `schemaVersion:1`, `requestId`, `testFixture:true`, `form` nesnesi ve `photos:[{name,mimeType,bytes:Uint8Array}]`. Form anahtarları mevcut UI ile aynıdır: email, fullName, city, biography, institution, jobTitle, education, category, presentationTitle, description, social, approval. Fotoğraf ayrı binary alandır. Kategori serbest metin, sosyal alan isteğe bağlı; kaynak tek seçimleri korunur. Test planı yalnız `.test`/`.invalid` adreslerini kabul eder; bunun diğer alanların gerçek veri olmadığını kendiliğinden kanıtlamadığı için yalnız kontrollü uydurma fixture kullanılır. Bu 19 kolonlu test senaryosu tek dummy fotoğraf içindir; üretim dosya sayısı kuralı belirlemez, mevcut çoklu yerel seçiciyi değiştirmez. `privacyTextVersion=source-screenshots-2026-10-03` yalnız gönderilen kaynak screenshotlarının yerel kayıt etiketidir, yayımlanmış KVKK metninin resmî sürümü olduğu iddia edilmez.

Plan şu sırayı tanımlar:

1. Bağlı hesap, Sheet/klasör tipi, sahiplik ve yalnız sahibin paylaşımı kontrolü; kolon başlıkları exact eşleşir. Kullanıcı payload'ından hedef ID alınmaz.
2. Drive multipart upload: metadata + binary; yalnız yapılandırılmış klasör `parents` olarak verilir. `permissions.create` veya herkese açık paylaşım yok. Upload yanıtı id/parent/owner-only izinleriyle doğrulanır.
3. Mevcut native tabloya `spreadsheets.batchUpdate` içindeki `appendCells.tableId` ile 19 kolon eklenir. Bu resmî yöntem tablo gövdesini genişletir. Kullanıcı metni `stringValue`, test_record `boolValue:true` olarak verilir; formül gibi başlayan metin formüle çevrilmez. Bu, values.append kullanılsaydı RAW ile sağlanacak davranışın typed-cell karşılığıdır. Mevcut kolon düzeni aynen korunur: application_id, submitted_at, test_record, email, privacy_acknowledgement, full_name, city, biography, organization, job_title, education_level, proposal_category, presentation_title, presentation_description, profile_photo_file_id, profile_photo_url, social_media, privacy_text_version, record_origin.
4. Drive yükleme onayı, Sheets yazma onayı, exact 19 hücrenin requestId ile okunup doğrulanması ve aynı native tablonun aralığının kayıt satırını kapsaması görülmeden başarı makbuzu yok. URL sütunu özel Drive dosyasının yalnız sahibi tarafından açılabilen görünüm adresidir; dosya paylaşılmaz, ID/URL ziyaretçiye geri dönmez. record_origin `EDK_LOCAL_BACKEND_TEST`; üretim kabulü yok.

Gelecek HTTP adapter'i; dosya byte sınırını okumadan önce uygulamalı, onaylanmış dosya içeriği doğrulaması yapmalı, aynı origin/CSRF kontrolü, rate limit ve kalıcı requestId tekrar kontrolünü sağlamalı. Aynı requestId iki kez satır oluşturamaz. Drive/Sheets atomik bir transaction değildir. Timeout veya belirsiz append yanıtında otomatik tekrar/başarı/temizlik yapılmaz; yalnız operasyon kimliğiyle hedef kayıtlar uzlaştırılır. Bu taslak bu üretim adapter'i/idempotency katmanı değildir.

## Yerel kontrol

```sh
node --check storage-plan.mjs
node --test storage-plan.test.mjs
```

Testler yalnız uydurma nesneler kullanır; ağ bağlantısı, token veya gerçek Sheet/Drive işlemi yoktur. Başarılı mock test, canlı Google entegrasyonu çalışıyor anlamına gelmez. Frontend aynı kalır; endpoint ve gerçek uçtan uca kayıt testi bitmeden gönderim açılmaz.

## Doğrulanan resmî belgeler (3 Ekim 2026)

- [Drive upload ve multipart](https://developers.google.com/workspace/drive/api/guides/manage-uploads)
- [Drive OAuth kapsamları ve refresh token saklama](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)
- [Sheets append ve desteklenen OAuth kapsamları](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append)
- [RAW değer girişi](https://developers.google.com/workspace/sheets/api/reference/rest/v4/ValueInputOption)
- [Native tablolar ve tableId ile append](https://developers.google.com/workspace/sheets/api/guides/tables)
- [AppendCellsRequest ve typed değerler](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#AppendCellsRequest)
- [Drive hesabı bilgisi](https://developers.google.com/workspace/drive/api/reference/rest/v3/about/get)
- [Drive servis hesabı sahiplik/kota sınırı](https://developers.google.com/workspace/drive/api/guides/handle-errors)
- [Sunucu OAuth akışı](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Apps Script web app kimliği ve dağıtımı](https://developers.google.com/apps-script/guides/web)
- [Apps Script API executable koşulları](https://developers.google.com/apps-script/api/how-tos/execute)
- [ContentService TextOutput yöntemleri](https://developers.google.com/apps-script/reference/content/text-output)
- [Cloud Run kurulum/billing](https://docs.cloud.google.com/run/docs/setup)
- [Cloud Run functions API/IAM/dağıtım](https://docs.cloud.google.com/run/docs/deploy-functions)
