# Tarama raporu (v86) — canvas metin envanteri ve denetim durumu

Kapsam notu: bu tur **kod düzeyinde** tarama + otomatik denetimdir (`ui_audit.py` 4 genişlik × 2 tema yeşil). 12 ekranlık elle ekran turu, GPU akıcılık ölçümü ve sızıntı testi (20× aç/kapat) **yapılmadı**; BÖLÜM 4.1/4.5 açıktır.

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

## Açık işler (öncelik: etki × çaba)
1. Elle ekran turu + hover taraması (yüksek etki, düşük çaba).
2. Nobel Silüet/Galaksi DOM etiketlerine `declutter` (A5).
3. Sızıntı testi: kayıt sayfası 20× aç/kapat, `renderer.info.memory`.
4. Paket B–I (malzeme, Nobel sahnesi, hero süreklilik…): başlanmadı.
