# Bilim Kütüphanem

Kitap seçkisi, Nobel belgeleri ve ödül kayıtları için çok dilli kişisel katalog. GitHub Pages yalnızca web uygulaması ve katalog künyelerini yayımlar; PDF arşivi kişisel Google Drive hesabındadır.

- [Kataloğu aç](https://mustafaras.github.io/bilim-kutuphanesi/)
- [Kişisel Drive arşivi](https://drive.google.com/drive/folders/1Lai0EFsOnBe7fj9iisipCBe0QHJSvhP5)
- [Yayın geçmişi](https://github.com/mustafaras/bilim-kutuphanesi/actions/workflows/pages.yml)

## Kullanım

Başlık, yazar veya konu ara; kategori, koleksiyon, dil, yıl, tür ve seviye filtrelerini birlikte kullan. Yıldız ile okuma listesi oluştur. Liste bu tarayıcıda tutulur; farklı cihaza taşımak için JSON dışa/içe aktarımını kullan.

PDF bağlantıları Drive'ın kendi oturum ve izin denetimini kullanır. Gizli PDFler siteye yüklenmez. Kaynak bağlantıları yayıncı/yazar/kurum sayfalarını açar; bazıları kurumsal erişim isteyebilir. Çevrimdışı önbellek katalog içindir, PDF arşivi için değildir.

Katalogdaki **Kişisel arşivler** bağlantısı iki Drive klasörünü gösterir: **Nobel ve ilk aktarım arşivi**, **Kitap arşivi**. Dosyalar yalnızca kendi Google hesaplarının erişimine açıktır. Yükleme kuyruğuna eklenmiş olmak tamamlanmış aktarım anlamına gelmez; katalogda Drive bağlantısı yalnızca doğrulanan dosyalarda görünür. Tarayıcıdan yapılan büyük aktarımlar sürerken yükleme sekmesi ve bilgisayar açık kalmalıdır.

Tarayıcı aktarımını kontrol ettikten sonra özel klasör listesini `python tools/import_browser_readback.py .local/full-archive-readback.json` ile içeri alabilirsin. Araç kategori, dosya adı, bayt boyutu ve indirilebilir durumu doğrular; aynı ad veya önceden yeniden adlandırılmış dosyalarda mevcut Drive kimliğini kullanır. Her klasörün hesap bilgisi aktarım kaydına korunarak yazılır. `.local/full-readback-audit.json` eksikleri ve eski eşlemeleri kaydeder. Uzaktan içerik özeti mevcut olmadığı için bu kontrol içerik hash karşılaştırması değildir; sırada bekleyen dosyaları tamamlanmış saymaz.

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

## Görsel keşif ve hareket

Sekiz özgün vektör çizimi, perspektifli bilgi küresi, altın yörüngeler, yıldız ışıkları, kart vurguları ve sayfa ilerleme çizgisi arayüze dahildir. Koyu göksel ana ekran ile fildişi katalog tek bir görsel kimlik kullanır. Sağ alttaki hareket düğmesi efektleri durdurur; seçim bu cihazda saklanır. İşletim sisteminin azaltılmış hareket tercihi otomatik uygulanır. Canvas animasyonu sekme gizlendiğinde veya kapak alanı görünümden çıktığında durur; çizimler ve efektler dış hizmet kullanmaz.

Görsel bileşenler `site/visuals.js`, hareket denetimi `site/effects.js`, stiller `site/style.css` içindedir. Dekoratif çizimler ekran okuyuculardan gizlenir; katalog ve filtreler hareket durdurulduğunda da kullanılabilir.

Masaüstünde ana çizimin üzerine gelen imleç kürenin bakış açısını hafifçe değiştirir. Enlem, boylam, yörüngeler ve yıldızlar tek bir Canvas 2D üzerinde üç boyutlu nokta izdüşümleriyle çizilir. Dokunmatik cihazlarda imleç etkisi uygulanmaz. Aynı görünürlük ve hareket denetimi kullanılır; dış grafik kütüphanesi veya yeni bir animasyon döngüsü yoktur.

## Kaynak vitrini ve ayrıntı paneli

Dört başlangıç kaynağı, katalog için hazırlanan özgün görsellerle sunulur. Kart başlığı ve vitrin düğmesi ayrıntı panelini açar. Panel kaynak künyesini, açıklamayı, doğrulanmış erişim durumunu, okuma listesi ve bağlantı kopyalama kontrollerini içerir. `?record=<katalog kimliği>&ui=tr` bağlantısı aynı kaynağı doğrudan açar. Escape paneli kapatır; klavye odağı panel içinde tutulur ve kapanınca önceki kontrole döner.

Panelin **Keşfe devam et** bölümünde aynı kategori ve koleksiyondan en fazla üç kaynak gösterilir. Aynı kaynak dili, bilinen aynı seviye ve farklı yazarlar önceliklidir; Nobel belgelerinde yakın ödül yılı da dikkate alınır. Bu, künye alanlarına dayanan keşif seçkisidir. Bir kaynaktan diğerine geçiş paneli yeniler, başlığı klavye odağına alır ve paylaşılabilir kaynak bağlantısını günceller. Panel kapanınca ilk açan katalog/vitrin düğmesine dönülür.

Geliştirme referansları: [V&A Collections](https://www.vam.ac.uk/collections) tematik keşif ve koleksiyon vitrini; [NYPL Research Catalog](https://www.nypl.org/research/research-catalog/search/advanced) ayrıntılı arama ve kaynak künyesi; [Awwwards Art gallery](https://www.awwwards.com/websites/art/) tipografi, boşluk ve görsel hiyerarşi araştırması. Bu sitelerin varlıkları veya tasarımları kopyalanmadı.

## Katalog görünümleri ve görsel rotalar

Kartlar ve Liste düğmeleri aynı arama sonuçlarını iki düzende gösterir. Görünüm bu cihazda saklanır; `?view=list` bağlantısı listeyi doğrudan açar. Seçili filtre etiketindeki çarpı yalnızca o filtreyi kaldırır. Türkçe/İngilizce geçişi sorguyu, filtreleri ve görünümü korur. Kaynak ayrıntılarına her iki görünümde de başlıktan erişilir.

Okuma yollarında özgün vektör simgeleri ve sıralı adımları gösteren bir çizgi bulunur. Rotalar yerel HTML açılır panelleriyle klavyeden kullanılabilir. [Rijksmuseum tematik keşif](https://www.rijksmuseum.nl/en/collection/discover) ve [Europeana'nın koleksiyon arayüzü](https://pro.europeana.eu/post/introducing-the-new-europeana-collections-website) konu keşfi ve sayfayı yenilemeden filtreleme araştırmasına kaynak oldu.

Sonuçların üzerindeki kompakt katalog şeridi yalnızca katalog bölümünde sabit kalır. Sonuç sayısını ve sayfa konumunu gösterir; **Aramaya dön** düğmesi sorgu ve filtreleri koruyarak arama alanına odaklanır. Sonuç yokken şerit gizlenir. [NN/g'nin sabit gezinme rehberi](https://www.nngroup.com/articles/sticky-headers/) küçük ve belirgin kontrollerin değerlendirilmesine kaynak oldu. Hareket durdurma seçimi sayfanın yumuşak kaydırmasını da kapatır.

Keşif kartları kendi konu grubunun kaynak/kayıt sayısını ve bilinen kaynak dili sayısını gösterir. Nobel grubunda belge ve ödül kayıtları birlikte sayılır; bu sayılar Drive yükleme durumunu ifade etmez. Koleksiyon seçimi alan, dil, yıl, tür ve seviye seçeneklerini o koleksiyona sınırlar. Ortak bir seçim korunur; yeni koleksiyonda bulunmayan seçim temizlenir. Doğrudan paylaşılan koleksiyon bağlantıları da aynı kuralla açılır.

Katalog kartları konu grubuna göre özgün çizimler taşır; matematik kaynaklarında ayrı geometrik çizim, Fields/Abel/Turing kaynaklarında ödül simgesi kullanılır. Aynı alan çizimi vitrin, ayrıntı ve ilgili kaynaklarda tutarlıdır. Dekoratif çizimler ekran okuyuculardan gizlenir. Kompakt Liste görünümü ve tam kaynak başlıkları korunur.
