# Bilim Kütüphanem

Kitap seçkisi, Nobel belgeleri ve ödül kayıtları için çok dilli kişisel katalog. GitHub Pages yalnızca web uygulaması ve katalog künyelerini yayımlar; PDF arşivi kişisel Google Drive hesabındadır.

- [Kataloğu aç](https://mustafaras.github.io/bilim-kutuphanesi/)
- [Kişisel Drive arşivi](https://drive.google.com/drive/folders/1Lai0EFsOnBe7fj9iisipCBe0QHJSvhP5)
- [Yayın geçmişi](https://github.com/mustafaras/bilim-kutuphanesi/actions/workflows/pages.yml)

## Kullanım

Başlık, yazar veya konu ara; kategori, koleksiyon, dil, yıl, tür ve seviye filtrelerini birlikte kullan. Yıldız ile okuma listesi oluştur. Liste bu tarayıcıda tutulur; farklı cihaza taşımak için JSON dışa/içe aktarımını kullan.

PDF bağlantıları Drive'ın kendi oturum ve izin denetimini kullanır. Gizli PDFler siteye yüklenmez. Kaynak bağlantıları yayıncı/yazar/kurum sayfalarını açar; bazıları kurumsal erişim isteyebilir. Çevrimdışı önbellek katalog içindir, PDF arşivi için değildir.

Katalogdaki **Kişisel arşivler** bağlantısı iki Drive klasörünü gösterir: **Nobel ve ilk aktarım arşivi**, **Kitap arşivi**. Dosyalar yalnızca kendi Google hesaplarının erişimine açıktır. Yükleme kuyruğuna eklenmiş olmak tamamlanmış aktarım anlamına gelmez; katalogda Drive bağlantısı yalnızca doğrulanan dosyalarda görünür. Tarayıcıdan yapılan büyük aktarımlar sürerken yükleme sekmesi ve bilgisayar açık kalmalıdır.

Tarayıcı aktarımını kontrol ettikten sonra özel `.local/second-readback.json` dosyasındaki klasör listesini `python tools/import_browser_readback.py` ile içeri alabilirsin. Araç, kategori ve dosya adı tekil eşleşen, boyutu yerel dosyayla aynı ve indirilebilir dosyalar için aktarım kaydı oluşturur; sırada bekleyen dosyaları tamamlanmış saymaz.

## Geliştirme ve yayın

Arayüz Türkçe ve İngilizce olarak kullanılabilir; üst menüdeki TR / EN seçimi tarayıcıda saklanır ve `?ui=tr` / `?ui=en` bağlantılarıyla paylaşılabilir. Kaynak başlıkları, eserler ve mevcut editoryal açıklamalar özgün dillerinde korunur. Arayüz metinleri `site/i18n.js` içindedir; yeni bir arayüz öğesi eklerken iki dilde de karşılığını ekle.

Sekiz keşif alanı kataloğu konu gruplarına ayırır. Alan seçimi kaynak dili, belge türü ve erişim filtreleriyle birleşir; aktif alan etiketi kaldırılabilir. Arama için `/` kısayolu kullanılabilir. Mobil düzende kartlar ve okuma yolları tek sütuna iner. Arayüzün görünümü `site/style.css`, davranışı `site/app.js` dosyasında geliştirilir.

`site/` içindeki HTML, CSS ve JavaScript dosyaları uygulamadır. `site/data/catalog.json` kamuya açık katalog metadatasıdır. `main` dalına gönderilen değişiklikler `.github/workflows/pages.yml` ile doğrulanıp GitHub Pages'te yayımlanır. GitHub Actions üzerinden **Publish library → Run workflow** ile elle yeniden yayın yapılabilir.

Başka bir bilgisayarda da bu depoyu klonlayıp arayüzü geliştirebilirsin. Arayüz ve mevcut katalog üzerinde çalışmak için masaüstündeki PDF klasörleri gerekmez. Yeni dosyaların özel Drive bağlantılarını eşlemek ve yerel CSV kataloglarını yeniden üretmek için aşağıdaki güncelleme adımlarını kullan.

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
