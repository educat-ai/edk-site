# EDK yerel başvuru testi

Bu arka uç Eren’in mevcut EDK tasarımını, yalnız bu Mac’te Google Drive ve Sheets’e deneme başvurusu gönderebilir hâle getirir. Siteyi `EDK Yerelde Aç.command` dosyasına çift tıklayarak açın. Yerel test hazırsa formda **Deneme başvurusunu gönder** görünür. Sayfa dosyasını doğrudan açmak, gönderimi kapalı tasarım önizlemesini gösterir.

## Kayıt akışı

- Sunucu yalnız `127.0.0.1` üzerinde dinler. Varsayılan yerel adres `http://127.0.0.1:4187/`.
- `.test` veya `.invalid` ile biten örnek e-posta ve sentetik bilgiler kullanılır. Test fotoğrafı tek PNG, en fazla 512 KB’dır. Bunlar yalnız yerel test sınırlarıdır; üretim kuralları değildir.
- Form aynı yerel sunucuya gönderilir. Google bağlantısı, kapsamı ve tokenları tarayıcıya aktarılmaz.
- Yeni, özel test klasörü, fotoğraf klasörü ve native Sheets tablosu uygulamanın kendi `drive.file` bağlantısıyla oluşturuldu. Eski test kaynaklarına yazılmaz.
- Fotoğrafın özel klasördeki içeriği, başvurunun 19 sütunu ve native tablo aralığı geri okunmadan başarı verilmez. Metinler formül olarak çalıştırılmaz.
- Aynı başvuru koduyla tekrar gönderim aynı kaydı doğrular; ikinci fotoğraf veya satır oluşturmaz. Belirsiz yazma sonucu otomatik yeniden yazılmaz.
- Başvuru alanları tarayıcı belleğindedir; localStorage/sessionStorage kullanılmaz. Özel makbuz dosyaları yalnız kod, hash, zaman, fotoğraf kimliği ve işlem durumu tutar; başvuru metinlerini veya Google tokenlarını kaydetmez.

## Yerel kullanım ve kontroller

Başlatıcı mevcut çalışan test sunucusunu kullanır; yoksa onaylanmış bağlantıyı kullanarak başlatır. Yeni Google onay akışı veya daha geniş kapsam istemez. Google kayıt testi için internet bağlantısı gerekir.

Geliştirici başlatması: proje klasöründe `EDK_LOCAL_PORT=4187 node local-test/server.mjs --use-approved-connection`.

Kontroller: `node --test local-test/local-test.test.mjs backend-draft/storage-plan.test.mjs` ve `node --check local-test/server.mjs`.

Google bağlantısı proje dışında, kullanıcıya özel Mac klasöründe tutulur. Klasör izni 0700, dosya izni 0600’dır. Kimlik dosyası ve bağlantı dosyası siteye, rapora veya Git’e eklenmez. Sunucu loglarında başvuru gövdesi, Google kodu veya token bulunmaz.

`dist` tasarım dosyaları değiştirilmedi. Yerel sunucu yalnız bellekte kendi istemci betiğini ekler; bu betik mevcut formu test arka ucuna bağlar. Önceki başlatıcı `local-test/EDK Yerelde Aç.original.command` olarak korunur. Kamuya yayın veya dağıtım yapılmadı.

Google API kaynakları: [native tablo appendCells](https://developers.google.com/workspace/sheets/api/guides/tables), [Drive multipart yükleme](https://developers.google.com/workspace/drive/api/guides/manage-uploads).
