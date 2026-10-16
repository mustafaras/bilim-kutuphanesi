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
