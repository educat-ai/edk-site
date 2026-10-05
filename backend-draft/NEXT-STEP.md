# En küçük sonraki bağlantı adımı

Seçilen yol: mevcut EDK formu → aynı origin sunucu endpoint'i → sahibin OAuth yetkisiyle private Drive + ayrı Sheet. Google ekranı yalnız Eren'in kurulumunda görülür; ziyaretçinin form akışına eklenmez.

Önce mevcut Sites projesinin sunucu runtime/repo yolu salt okunur doğrulanmalı. Mevcut metadata statik, live URL yok; yerel repo `.git` içermiyor. Sites yayın araçları pushed commit SHA ister; bu bağlantı doğrulanmadan deploy planı tamamlanmış sayılmaz. Yeni Site kurulmaz.

Ardından **işlem anında** Eren'e sunulacak izin: belirlenen Google Cloud projesinde Drive/Sheets API'lerini etkinleştirme; backend OAuth client ve exact callback URI oluşturma; erencnr@gmail.com için `drive.file` ile yalnız seçilen test hedeflerini açma; backend secret kasasında refresh token saklama. Bağlı ChatGPT Drive hesabının token'ı alınmaz. Kapsam yetmezse sessizce genişletilmez. Bu izin ve işlem henüz verilmedi/yapılmadı.

Apps Script/Cloud Functions dağıtım aracı mevcut değil. Apps Script alternatifinde script sahibi izinleri ve deployment; Cloud Run alternatifinde proje, billing, API/IAM, secret ve deploy onayı gerekir. Bunlar küçük Drive test dosyası oluşturma onayına dahil değildir.

OAuth bağlantısı ve sunucu doğrulandıktan sonra yalnız uydurma tek dosya/başvuru ile uçtan uca deneme yapılır. Dosya, exact 19 kolonlu satır ve native tablo aralığı gerçek okunarak doğrulanana kadar frontend gönderimi kapalı kalır. Şimdiki yedi mock test böyle bir uçtan uca kanıt değildir.
