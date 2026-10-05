# EDK ana sayfa — 2 Ekim 2026

Önizleme: http://localhost:4187/?design=summit-3
Aktif dosyalar: `dist/index.html`, `dist/editorial.css`, `dist/app.js`.
Uyarlama öncesi yedek: `design-backup-before-summit/`.

Future Summit referansının bölüm sırası ve somut yerleşimi EDK içeriğine uyarlandı. 76 px üst menü, 1920:570 masaüstü video bandı, iki sütun giriş, fotoğraf kolajlı hakkında, geniş kampüs fotoğrafı, iki kaydırılabilir tema sırası, 6/3/2 kolon konuşmacılar, üç renk başlıklı program kartı, galeri, başvuru alanı ve footer.
Yerel DM Sans, EDK lacivert/pembe/mavi renkleri ve gerçek EDK fotoğrafları kullanılıyor. Eski style.css/home.css/motion.css dosyaları sayfada yüklenmiyor.

Etkinlik ve mevcut metinler korundu. Tema kısa açıklamaları editoryal taslaklardır; kesin oturum açıklamaları değildir. Başvuru ve sponsorluk düğmeleri mevcut bilgilendirme pencerelerini açar; yeni form veya iletişim adresi uydurulmadı.

Vimeo: 1232285794. Masaüstü 1920:570, mobil 16:9. Yerel resmi Vimeo SDK, gerçek oynatıcı olaylarına bağlı kontrol ve fotoğraf kapağı. Önizleme ortamında Vimeo yüklenmedi; kapak doğrulandı, canlı oynatma teyidi açık.

Görsel karşılaştırmalar, yapılan düzeltmeler ve etkileşim kontrolleri: `design-qa.md`. Ekran görüntüleri: `qa-reference/`.

## Kampüs görseli güncellemesi

Kullanıcının sağladığı şeffaf `istinye.png`, `assets/istinye-cutout.png` olarak eklendi. Bina tüm oranıyla gösteriliyor; lacivert zeminde hafif mavi ortam ışığı, alt gölge ve CSS üzerinden küçük parlaklık/kontrast/doygunluk ayarı uygulandı. Orijinal PNG değiştirilmedi. Masaüstü ve mobil görünüm `qa-reference/venue-cutout-desktop.png` ve `venue-cutout-mobile.png` dosyalarında.

## Zemin ritmi

Hakkında ve konuşmacılar bölümleri açık, hafif mavi `#eaf3f6` zemine alındı. Bu bölümlerde metinler koyu, başlıklar koyu mavi; fotoğraf kolajı ve mavi portre daireleri korunuyor. Giriş, mekân, temalar, program, galeri ve alt bölüm koyu zeminde. Masaüstü 1280 px ve mobil 390 px ekran görüntüleri `qa-reference/section-balance-*` dosyalarında; yatay taşma yok.
