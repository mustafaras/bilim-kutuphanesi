# Ekran belgesi — v85 → v87 (Paket A, A5, B dilimi)

Görüntüler `docs/tasarim/ekran/v87/` altında. Hepsi yerel sunucuda, SwiftShader (CPU) WebGL ile, 1440×900 görünümde alındı; **gerçek GPU akıcılığı ve hareket görülmedi**. "Önce" = v85 (`a6f4215`), "sonra" = v87.

## 1. Kapak metin çakışması (Paket A)
Uzun başlıklı Nobel belgesi (Enders; Weller; Robbins) ve 248 karakterlik en uzun başlık. Başlık bloğu yazar satırından ayrı, kırpma `…` ile, yazar başlıkta geçiyorsa basılmıyor.

| Kayıt | Tema | Önce (v85) | Sonra (v87) |
|---|---|---|---|
| Enders belgesi | koyu | ![](ekran/v87/kapak-enders-once-v85-dark.png) | ![](ekran/v87/kapak-enders-sonra-v87-dark.png) |
| Enders belgesi | açık | ![](ekran/v87/kapak-enders-once-v85-light.png) | ![](ekran/v87/kapak-enders-sonra-v87-light.png) |
| En uzun başlık | koyu | ![](ekran/v87/kapak-uzun-baslik-once-v85-dark.png) | ![](ekran/v87/kapak-uzun-baslik-sonra-v87-dark.png) |
| En uzun başlık | açık | ![](ekran/v87/kapak-uzun-baslik-once-v85-light.png) | ![](ekran/v87/kapak-uzun-baslik-sonra-v87-light.png) |

Paylaşım kartı (Enders): önce ![](ekran/v87/paylasim-karti-once-v85.png) sonra ![](ekran/v87/paylasim-karti-sonra-v87.png)

Otomatik kanıt: `tools/text_fit_audit.py` → 186 yüzey, 405 metin satırı, 0 taşma, 0 çakışma (kod bilerek bozulunca FAIL verdiği doğrulandı).

## 2. Konuya göre kapak malzemesi (Paket B dilimi)
Beş farklı konu: deri/keten/karton cilt, altın/gümüş/bakır folyo, aşınmış kenar. Grain ve folyo farkı bu ölçekte ince; şerit ayraç hareketi durağan karede görülmez.

Koyu: ![](ekran/v87/malzeme-r0-dark.png) ![](ekran/v87/malzeme-r1-dark.png) ![](ekran/v87/malzeme-r2-dark.png) ![](ekran/v87/malzeme-r3-dark.png) ![](ekran/v87/malzeme-r4-dark.png)

Açık: ![](ekran/v87/malzeme-r0-light.png) ![](ekran/v87/malzeme-r1-light.png) ![](ekran/v87/malzeme-r2-light.png) ![](ekran/v87/malzeme-r3-light.png) ![](ekran/v87/malzeme-r4-light.png)

## 3. Etiket çakışma çözümü (A4/A5)
Ölçüm: takımyıldızı 3 kayıt × 2 tema 8/8 etiket 0 çakışma; Nobel Silüet 16 + Galaksi 7 etiket, 1440/768 × 2 tema 0 çakışma, 0 konsol hatası.

| | Koyu | Açık |
|---|---|---|
| Takımyıldızı | ![](ekran/v87/takimyildizi-dark.png) | ![](ekran/v87/takimyildizi-light.png) |
| Nobel Silüet | ![](ekran/v87/nobel-skyline-dark.png) | ![](ekran/v87/nobel-skyline-light.png) |
| Nobel Galaksi | ![](ekran/v87/nobel-galaxy-dark.png) | ![](ekran/v87/nobel-galaxy-light.png) |

## Doğrulama ve yayın
`validate_site`, `validate_i18n`, `check_app` (+`--missing-art`), `ui_audit` (390/768/1024/1440 × açık/koyu) yeşil. Yayınlar: #99 (v86) ve #100 (v87) `success`. Canlı siteye bu ortamdan erişilemez; altbilgide `BUILD v87` görünmeli.

## Yapılmayanlar
B2, B4, B5, B7; Paket C–I; BÖLÜM 5 araştırması; elle 12 ekranlık tur; sızıntı testi.

---

# v88 — Paket B tamamlandı
Görüntüler `ekran/v88/`. Yazılım render'ı; hareketin kendisi (hinge açılışı, yaylanma, madalya dönüşü) durağan karelerle ancak sonuç pozlarında görülür.

## Kitap pozları (kayıt sayfası, açık ve koyu)
| Hover: kapak 12° açık | Sürükle → arka yüze snap | Sürükle → sırt (3/4) snap | Çift tık: okuma pozu |
|---|---|---|---|
| ![](ekran/v88/kitap-hover-kapak-acik-dark.png) | ![](ekran/v88/kitap-surukle-snap-arka-dark.png) | ![](ekran/v88/kitap-surukle-snap-sirt-dark.png) | ![](ekran/v88/kitap-okuma-pozu-dark.png) |
| ![](ekran/v88/kitap-hover-kapak-acik-light.png) | ![](ekran/v88/kitap-surukle-snap-arka-light.png) | ![](ekran/v88/kitap-surukle-snap-sirt-light.png) | ![](ekran/v88/kitap-okuma-pozu-light.png) |

Açık temada kitabın zeminine düşen **gerçek gölge** (yalnız kayıt sayfası kitabında) görünür.

## Nobel madalyası: altı yüz (koyu / açık)
Fizik, Kimya, Tıp, Edebiyat, Barış, Ekonomi. Çevresel yazı ölçülerek yaya sığdırılır.

| | Koyu | Açık |
|---|---|---|
| Fizik | ![](ekran/v88/madalya-0-dark.png) | ![](ekran/v88/madalya-0-light.png) |
| Kimya | ![](ekran/v88/madalya-1-dark.png) | ![](ekran/v88/madalya-1-light.png) |
| Tıp | ![](ekran/v88/madalya-2-dark.png) | ![](ekran/v88/madalya-2-light.png) |
| Edebiyat | ![](ekran/v88/madalya-3-dark.png) | ![](ekran/v88/madalya-3-light.png) |
| Barış | ![](ekran/v88/madalya-4-dark.png) | ![](ekran/v88/madalya-4-light.png) |
| Ekonomi | ![](ekran/v88/madalya-5-dark.png) | ![](ekran/v88/madalya-5-light.png) |

Bilinen zayıflık: güvercin amblemi küçük ölçekte net okunmuyor.

---

# v89 — Nobel Galaksi açık temada
Kullanıcı görüntüsüyle bildirilen sorun: açık temada Galaksi beyaz bir lekeye dönüşüyordu. Düzeltme: açık temada opak mürekkep yıldızlar, kategori renkleri efsane çipleriyle eşleşiyor, kadraj panele sığıyor. Görüntüler `ekran/v89/`.

| | Koyu | Açık |
|---|---|---|
| Galaksi (tüm bölüm) | ![](ekran/v89/galaxy-dark.png) | ![](ekran/v89/galaxy-light.png) |
| Silüet (çip kelepçeli) | ![](ekran/v89/skyline-dark.png) | ![](ekran/v89/skyline-light.png) |

---

# v90 — Kara delik (yerçekimi merceği) opsiyonel
Fare galaksinin üstündeyken oluşan büyük mercek girdabı artık **varsayılan kapalı**; yakınlaştırma dock'undaki ◎ düğmesiyle açılır ve hatırlanır. Açıkken de daha küçük. Görüntüler `ekran/v90/`.

| | Mercek kapalı (varsayılan) | Mercek açık (◎ basılı) |
|---|---|---|
| Koyu | ![](ekran/v90/hero-mercek-kapali-dark.png) | ![](ekran/v90/hero-mercek-acik-dark.png) |
| Açık | ![](ekran/v90/hero-mercek-kapali-light.png) | ![](ekran/v90/hero-mercek-acik-light.png) |

Bilinen sorun: açık temada hero galaksisi çok soluk (ayrı iş).

---

# v91 — Çerçevesiz takımyıldızı, yumuşak geçiş, açık tema hero
Görüntüler `ekran/v91/`. Kutu çerçevesi kaldırıldı; sahne kenarlarda sayfaya karışıyor. Tıklama: 1,25 sn'lik yavaş uçuş + kayıt çapraz solması (hareket durağan karede görülemez; `gecis-1-*` uçuşun ortasındaki kare).

| | Koyu | Açık |
|---|---|---|
| Takımyıldızı | ![](ekran/v91/takimyildizi-dark.png) | ![](ekran/v91/takimyildizi-light.png) |
| Geçiş (uçuş ortası) | ![](ekran/v91/gecis-1-dark.png) | ![](ekran/v91/gecis-1-light.png) |
| Ana sayfa hero | ![](ekran/v91/hero-dark.png) | ![](ekran/v91/hero-light.png) |

---

# v92 — Takımyıldızı: gerçek gezegenler
Prosedürel gezegenler (gaz devi + halka, karasal, çöl, buz), merkez yıldızdan aydınlatma, aylar, anamorfik ışık çizgisi, çerçevesiz kenar. Görüntüler `ekran/v92/` (1440 px, SwiftShader).

| Kayıt | Koyu | Açık |
|---|---|---|
| 1 | ![](ekran/v92/takimyildizi-0-dark.png) | ![](ekran/v92/takimyildizi-0-light.png) |
| 2 | ![](ekran/v92/takimyildizi-1-dark.png) | ![](ekran/v92/takimyildizi-1-light.png) |
| 3 | ![](ekran/v92/takimyildizi-2-dark.png) | ![](ekran/v92/takimyildizi-2-light.png) |

---

# v93 — Nobel bölümü çerçevesiz + Silüet/Galaksi yükseltmesi
Dış kart ve panel çerçeveleri kalktı; sahne sayfaya karışıyor. Silüet: yanan pencereler, ışık sütunu + kıvılcım, yıl kaydırıcı. Galaksi: ödül sahibi kapsülleri. Görüntüler `ekran/v93/` (panel elemanı, 1440 px, SwiftShader).

| | Koyu | Açık |
|---|---|---|
| Silüet (1984 seçili) | ![](ekran/v93/silet-dark.png) | ![](ekran/v93/silet-light.png) |
| Galaksi (kapsüller) | ![](ekran/v93/galaksi-dark.png) | ![](ekran/v93/galaksi-light.png) |

---

# v94 — Paket C'nin kalanı
Karşılaştırma modu, cam kuleler (anahtar), zemin ışık sızıntısı, Galaksi ışık hüzmeleri + difraksiyon, yıl dosyasına bağlanan çizgi, görünüm geçiş koreografisi. Görüntüler `ekran/v94/`.

| | Koyu | Açık |
|---|---|---|
| Karşılaştırma (1969 ⇄ 2022) | ![](ekran/v94/karsilastirma-dark.png) | ![](ekran/v94/karsilastirma-light.png) |
| Cam kuleler açık | ![](ekran/v94/cam-dark.png) | ![](ekran/v94/cam-light.png) |
| Galaksi ışık hüzmeleri | ![](ekran/v94/galaksi-huzme-dark.png) | ![](ekran/v94/galaksi-huzme-light.png) |
| Yıl dosyası çizgisi (Silüet) | ![](ekran/v94/yildosyasi-cizgi-silet-dark.png) | ![](ekran/v94/yildosyasi-cizgi-silet-light.png) |

---

# v95 — Gerçek veri morph'u, tam yansıma, küre yıldızlar
Grafik ⇄ Silüet ⇄ Galaksi geçişinde 1.895 kaydın her biri aynı parçacık olarak yeni konumuna akar. Aşağıdaki kareler morph'un ortasından (durağan kare). Görüntüler `ekran/v95/`.

| | |
|---|---|
| Galaksi → Silüet (ortada) | ![](ekran/v95/morph-dark-1.png) |
| Silüet → Grafik (ortada) | ![](ekran/v95/morph-silet-grafik.png) |

| | Koyu | Açık |
|---|---|---|
| Silüet (tam yansıma, yumuşak zemin) | ![](ekran/v95/silet-yansima-dark.png) | ![](ekran/v95/silet-yansima-light.png) |
| Galaksi (küre yıldızlar) | ![](ekran/v95/galaksi-kure-dark.png) | ![](ekran/v95/galaksi-kure-light.png) |

## v96 — C kapanışı + Paket D
Yazılımsal GL (SwiftShader) durağan kareleri; hareket ve GPU hızı doğrulanmadı.

| | Koyu | Açık |
|---|---|---|
| Hero + 3B gözlemevi | ![](ekran/v96/hero-dome-dark.png) | ![](ekran/v96/hero-dome-light.png) |
| Gözlemevi yakın (palet dalgaları, lamba yansıması) | ![](ekran/v96/hero-dome-zoom-dark.png) | ![](ekran/v96/hero-dome-zoom-light.png) |
| Scroll kamera yolu (420px) | ![](ekran/v96/hero-scroll-dark.png) | ![](ekran/v96/hero-scroll-light.png) |
| Silüet (tam yansıma) | ![](ekran/v96/silet-yansima-dark.png) | ![](ekran/v96/silet-yansima-light.png) |
| Galaksi (instanced küre yıldızlar) | ![](ekran/v96/galaksi-kure-dark.png) | ![](ekran/v96/galaksi-kure-light.png) |

## v98 — doğrulama turu
| | Koyu | Açık |
|---|---|---|
| Hero + büyütülmüş kubbe | ![](ekran/v98/scroll-dark-0000.png) | ![](ekran/v98/scroll-light-0000.png) |
| Kayıt (başlıkta çerçeve yok) | ![](ekran/v98/dive-dark-record.png) | ![](ekran/v98/dive-light-record.png) |

## v99 — B, E, F, G, H, I ve ekran turu
Tam tur: `ekran/v99/{1440,1100,768}-{dark,light}-NN-*.png` (18 ekran × 6 yapılandırma). Öne çıkanlar:

| | Koyu | Açık |
|---|---|---|
| Atlas (katı PBR nesneler) | ![](ekran/v99/1440-dark-02-atlas.png) | ![](ekran/v99/1440-light-02-atlas.png) |
| 3B kitap (aşınma, kurdele) | ![](ekran/v99/1440-dark-14-record-3d.png) | ![](ekran/v99/1440-light-14-record-3d.png) |
| Takımyıldızı | ![](ekran/v99/1440-dark-15-record-constellation.png) | ![](ekran/v99/1440-light-15-record-constellation.png) |
| Palet (blur + 3B önizleme) | ![](ekran/v99/1440-dark-17-palette-results.png) | ![](ekran/v99/1440-light-17-palette-results.png) |
| Boş durum | ![](ekran/v99/1440-dark-08-catalog-empty.png) | ![](ekran/v99/1440-light-08-catalog-empty.png) |
| Nobel grafik, 768px (taşma düzeltildi) | ![](ekran/v99/768-dark-05-nobel-chart.png) | ![](ekran/v99/768-light-05-nobel-chart.png) |

## v101 — Paket B: sayfa çevirme, madalya, teleskop
| | |
|---|---|
| Okuma sahnesi: kapak içi + başlık sayfası | ![](ekran/v101/kitap-acik-sayfa-1.png) |
| Atıf ve "birlikte okunabilir" sayfaları | ![](ekran/v101/kitap-acik-sayfa-5.png) |
| Madalya, altı yüz — koyu | ![](ekran/v101/madalya-alti-yuz-koyu.png) |
| Madalya, altı yüz — açık | ![](ekran/v101/madalya-alti-yuz-acik.png) |
| Kubbe teleskopu (boşta / sağ-üst / sol-alt, iki tema) | ![](ekran/v101/kubbe-teleskop.png) |
