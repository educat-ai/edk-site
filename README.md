# EDK web sitesi

Statik site: `dist/`. Yerel önizleme: `python3 -m http.server 4187 --directory dist`.

## Aktif dosyalar (Gece Mavisi tasarımı, 5 Ekim 2026)

- `dist/index.html` — ana sayfa
- `dist/hakkimizda.html` — Hakkımızda sayfası (EDK’nın hikâyesi, yaklaşım, katılımcılar, geçmiş konuşmacılar, dernek, 11. EDK yapısı). Menü, alt bilgi ve pencereler ana sayfadan kopyalandı; birinde değişiklik yapılırsa diğerine de uygulanmalı.
- `dist/assets/gecmis/` — `../foto` klasöründen web için küçültülmüş geçmiş EDK fotoğrafları (1600 px)
- `dist/site.css` — tüm sayfa stili (koyu gece mavisi zemin, tek vurgu rengi elektrik mavisi; başlıklar Google Fonts'tan Sora, metin yerel DM Sans)
- `dist/site.js` — menü, geri sayım, bilgi/özgeçmiş/tema pencereleri, galeri, SSS, tanıtım filmi
- `dist/application.css`, `dist/application.js` — sunum ve atölye başvuru formu (değişmedi)

`dist/` içindeki diğer CSS/JS dosyaları (`app.js`, `revamp.css`, `refinement.css`, `brand.css`, `hero-carousel.*`, `editorial.css`, `home.css`, `style.css`, `motion.*`) artık sayfada yüklenmiyor. Önceki tasarımın tam yedeği: `site-backup-before-gece-mavisi-2026-10-05/`. Tasarım taslakları: `tasarim-taslak/`.

## İçerik notları

- Tanıtım filmi: bölüm görününce `assets/edk-reel-fallback.mp4` sessiz önizleme olarak döner; "Filmi izle" Vimeo 1232285794'ü sesli açar.
- Konuşmacı özgeçmişleri `#speaker-data`, tema açıklamaları `#theme-data` JSON bloklarındadır.
- Geri sayım `site.js` içinde 19 Aralık 2026 00:00 (İstanbul) hedefine göre çalışır; başlangıç saati netleşince `eventDate` güncellenmeli.
- Katılımcı başvurusu ve sponsorluk düğmeleri şimdilik bilgilendirme penceresi açar.

## Yayın durumu

Sites proje kimliği `.openai/hosting.json` içindedir; yeni proje oluşturmayın.
