# Tarama raporu (v99) — canvas metin envanteri ve denetim durumu

Kapsam notu (v99): kod taraması + otomatik denetimler + **ekran turu** (`tools/screen_tour.py`: 18 ekran × 2 tema × 3 genişlik = 108 kare, `ekran/v99/`). Yazılımsal GL olduğu için hareket hissi ve gerçek GPU hızı **ölçülmedi**.

## Otomatik kapılar (CI'da çalışır)
`validate_site`, `validate_i18n`, `check_app`, `ui_audit` (4 genişlik × 2 tema: taşma, konsol, kontrast), `text_fit_audit` (186 yüzey), `reduced_audit` (reduced-motion: tek durağan kare), `leak_audit` (kayıt 8× aç/kapat, 3B kitap; yerelde 20×). Yerel: `motion_audit` (dalış/scroll/Nobel geçişleri).

## Ekran turunda bulunan ve düzeltilen kusurlar
| Kusur | Nerede | Düzeltme |
|---|---|---|
| Nobel grafik görünümü 3B sahnenin altında da görünüyordu (altalta iki grafik) | tüm genişlikler | `[hidden]` ezilmesi (`display:flex`) düzeltildi (v97) |
| Kayıt başlığında beyaz odak çerçevesi | kayıt sayfası | `#recordTitle:focus{outline:0}` (v98) |
| Grafik sahnesi 3B sahneden 100px kısa / üstte boşluk | Nobel | şerit yüksekliği sahneye doldurur (v98) |
| Grafik görünümünde Nobel bloğu 756px'e şişip `GALAKSİ` düğmesi ve `Ekonomi` çipi kırpılıyordu | 768px | `.nobel-chronicle>*{min-width:0;max-width:100%}` (v99) |
| 3B kitap kapağı kenar benekleri kirli duruyordu | kayıt 3B | yoğunluk/opaklık düşürüldü (v99) |
| Atlas hover çizgileri başlık/açıklama üstünden geçiyordu | atlas karoları | tile-constellation maskesi (v99) |
| Liste önizlemesi erişim bağlantılarını örtüyordu | liste görünümü | önizleme meta sütunlarına taşındı (v99) |
| Her açılan 3B kitap GPU belleğinde kalıyordu (geometri 55→91, doku 56→100) | kayıt sayfası | kapanan sahneler `dispose` (v99); 20 turda geometri 6→6, canvas 18→18 |

## Hâlâ açık / dürüst notlar
1. Gerçek GPU'da akıcılık, ease hissi, dalış blur'u, kurdele fiziği: bu ortamda görülemedi.
2. 768px hero: paragraf, galaksi parçacıkları üstünde okunaklılığı azalıyor (mobil kapsam dışı; masaüstü etkilenmiyor).
3. Doku sayısı 20 turda 8→12 (küçük, sınırlı artış; geometri/canvas sabit) — izlemeye değer.
4. `transmission` camı yalnız Silüet `◇ Cam`; atlas camları ucuz (opacity+clearcoat).

## Eski açık işler (v86 listesinden)
Elle ekran turu → **yapıldı (v99)**. Nobel DOM etiketlerine `declutter` → Galaksi/Silüet'te var. Sızıntı testi → **yapıldı**. Paket B–I → uygulandı, bkz. DEVIR §36–49.
## Canvas / SVG metin envanteri
| Konum | Ne çiziyor | Eski risk | Şimdi |
|---|---|---|---|
| stage.js `paintCover` | kategori, başlık, yazar, biçim | başlık yazara biniyordu (v85'te yamandı) | `fitBlock/fitLine/authorInTitle`, denetimde 0 hata |
| stage.js `coverTexture` (raf) | başlık 5 satıra kadar, yazar `slice(0,34)` | 5 satır 420+4·54=636 > yazar 624 → binme | `fitBlock` TOP=400..H−150 |
| stage.js `spineTexture` | sırt başlığı | karakter kırpma, küçülmüyordu | önce küçülür (34→21px), sonra `…` |
| stage.js `backTexture` | sabit "BK / BİLİM KÜTÜPHANEM" | yok | değişmedi |
| stage.js madalya `faceMask` | sabit çevresel metin | dil/uzunluk değişirse taşar | sabit; notlandı |
| record.js `drawShareCard` | katalog no, başlık, yazar, koleksiyon | başlık 880px'te kırılır, y>420'de metin kaybolur; yazar y hesabı belirsiz | `fitBlock` 54→32px, yazar/etiket kırpılır |
| effects.js:72 | yıldız numaraları | 2 haneli sayı | sorun yok |
| visuals.js `LA_LABEL` | 16 sabit denklem etiketi | TR/EN farkı yok | sorun yok (≤14 karakter) |
| constellation3d.js DOM etiketleri | düğüm başlıkları | çakışabiliyordu | `declutter` |

