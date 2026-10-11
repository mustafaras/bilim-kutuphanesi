# Bilim Kütüphanem

Kitap seçkisi, Nobel belgeleri ve ödül kayıtları için çok dilli kişisel katalog. GitHub Pages yalnızca web uygulaması ve katalog künyelerini yayımlar; PDF arşivi kişisel Google Drive hesabındadır.

## Kullanım

Başlık, yazar veya konu ara; kategori, koleksiyon, dil, yıl, tür ve seviye filtrelerini birlikte kullan. Yıldız ile okuma listesi oluştur. Liste bu tarayıcıda tutulur; farklı cihaza taşımak için JSON dışa/içe aktarımını kullan.

PDF bağlantıları Drive'ın kendi oturum ve izin denetimini kullanır. Gizli PDFler siteye yüklenmez. Kaynak bağlantıları yayıncı/yazar/kurum sayfalarını açar; bazıları kurumsal erişim isteyebilir. Çevrimdışı önbellek katalog içindir, PDF arşivi için değildir.

## Geliştirme ve yayın

`site/` içindeki HTML, CSS ve JavaScript dosyaları uygulamadır. `site/data/catalog.json` kamuya açık katalog metadatasıdır. `main` dalına gönderilen değişiklikler `.github/workflows/pages.yml` ile doğrulanıp GitHub Pages'te yayımlanır. GitHub Actions üzerinden **Publish library → Run workflow** ile elle yeniden yayın yapılabilir.

## Yerel katalog güncellemesi

Masaüstündeki `ODTU Kitap Seckisi` ve `Nobel Calismalari Arsivi` kataloglarını güncelledikten sonra:

```powershell
.\Guncelle.ps1
.\Guncelle.ps1 -Publish
```

İlk komut yalnızca yerel katalog verisini yeniler. İkinci komut doğrulanmış veri değişikliğini GitHub'a gönderir. Yeni dosyaları Drive'a yükleme ayrı bir adımdır; bu komut PDF yüklediğini iddia etmez. Codex'te “Bilim Kütüphanem arşivini Drive'a eşitle ve siteyi güncelle” diyerek aynı işi sürdürebilirsin.

Drive dosya eşlemesi ve aktarım günlükleri `.local/` altında tutulur ve Git'e gönderilmez. İlk aktarımın eksik dosyaları bu günlüklerden devam ettirilebilir; aynı içerik yeniden yüklenmez. Farklı bilgisayarda geliştirmek için yerel katalog köklerini `BOOK_LIBRARY` ve `NOBEL_LIBRARY` ortam değişkenleriyle seç; `.local/drive-index.json` eşlemesinin özel yedeğini geri yükle. Gizli kimlik bilgileri repoya eklenmemelidir.

## Doğrulama

```text
python tools/validate_site.py
node --check site/app.js
node --check site/sw.js
```

Künye ve dosya denetimleri metinlerin bilimsel doğruluğunun baştan sona incelenmesi anlamına gelmez. Okuma sıraları editoryal önerilerdir.
