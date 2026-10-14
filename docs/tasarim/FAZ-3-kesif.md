# FAZ 3 — Keşif Katmanı (Bento Alanlar, Vitrin Rafı, Nobel Galaksisi, Arşivler)

**Öncül:** FAZ-0, FAZ-2 · **Sonraki:** FAZ-4 · **Süre tahmini:** 2 oturum

## 1. Amaç

Keşif bölümlerini tekdüze ızgaralardan çıkarıp her biri kendi sahne kurgusuna sahip deneyimlere dönüştürmek: asimetrik bonto keşif alanları, raf üstü vitrin, yatay scroll'lu "Nobel galaksisi" ve gözlem günlüğü estetiğinde arşiv bölümü.

## 2. Kapsam

- **İçinde:** `index.html` (collections/spotlight/timeline/archives), `style.css`, `discovery.js` (vitrin), `app.js` (`renderCollections`, `renderTimeline`, `renderArchiveProgress`), `visuals.js`/`effects.js` (takımyıldız hover, galaksi sahnesi).
- **Dışında:** katalog fasetleri/kartları (FAZ-4), kayıt detayı (FAZ-5).

## 3. Teknik Spesifikasyon

### 3.1 Keşif Alanları — Bento
- 12 sütunlu asimetrik ızgara: 2 "büyük" hücre (en çok kayıtlı iki alan — `renderCollections` içinde dinamik belirlenir, sabit kod yok) 5+4 sütun; kalan 6 alan 3'lü küçük hücreler. Mobil: tek sütun.
- Hücre anatomisi: mono sıra numarası (01–08) + özgün çizim + serif başlık + not + envanter satırı (kayıt/dil sayıları, mono).
- Hover: çizim `scale(1.04)` + hücre içinde takımyıldız bağ çizgileri (CSS `::before` nokta ızgarası + JS ile çizilen bağ SVG'si) 40ms stagger ile parlar — "bilgi bağlanır" mikro-anlatısı.
- Aktif alan etiketi (`discoveryTag`) ve katalog filtreleme davranışı aynen.

### 3.2 Vitrin — Raf
- 4 kapak çift sıra gölge + alt raf çizgisi üstünde; hover'da `transform: perspective(800px) rotateX(6deg)` köşe kaldırma hissi (reduced-motion'da statik).
- "Küratör notu": bölüm altında 1–2 cümle TR/EN (yeni i18n anahtarları; içerik: neden bu dört kaynak).
- `spotlight-card` davranışı (detay açma, aria-label) ve `choices` ID listesi aynen.

### 3.3 Nobel Galaksisi — Scrollytelling
- `#timeline` bölümü: masaüstünde sticky sahne (bölüm yüksekliği = şerit genişliği kadar) + scroll'a bağlı yatay `translateX` (RAF + `scroll` olayı pasif dinleyici; hız sınırlama yok, damping yok — doğrudan eşleme, INP güvenli).
- Şerit: her yıl bir yıldız (mevcut `renderTimeline` verisi); yıldız parlaklığı/yarıçapı kayıt sayısıyla orantılı; 10'ar yıllar mono etiketli.
- Seçim: tıklama/focus mevcut davranış (katalog o yıla filtrelenir) aynen; tooltip (mevcut `chronicle-tooltip`) cam yüzeye taşınır.
- `prefers-reduced-motion` + `motionToggle` kapalı: yerleşik `overflow-x:auto` yatay kaydırma + aynı içerik; klavye ile yıl yıldızlarında gezinme (mevcut focusin tooltip) korunur.
- `timelineReset` davranışı aynen.

### 3.4 Arşivler — Gözlem Günlüğü
- Koyu tam-kanama bölüm (mevcut); ilerleme kartları mono "gözlem günlüğü" dili: `DD.MM.YYYY · 758/1257 DOĞRULANDI` tarzı satırlar + mevcut `<progress>` yeniden stillenir (brass dolgu, saç teli iz).
- `renderArchiveProgress` veri ve bağlantı sözleşmesi (`?collection=..&availability=ready#catalog`) aynen.

## 4. Görev Listesi

1. Bento ızgarası CSS + `renderCollections` dinamik büyük-hücre seçimi + hover takımyıldız SVG.
2. Vitrin rafı stilleri + perspektif hover + küratör notu i18n.
3. Galaksi: sticky scroll sahnesi JS + şerit yeniden çizim + reduced-motion eşdeğeri.
4. Arşiv günlüğü stilleri + progress restili.
5. Yeni dizeler TR/EN; `?v=42`; kırılım + klavye + tema turları.

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla HTML/CSS/JS, GitHub Pages, dış istek YASAK) FAZ-3'ü uygula: keşif katmanı. Önce TASARIM-PLANI.md ve docs/tasarim/FAZ-3-kesif.md dosyalarını oku. FAZ-0 (token+font) ve FAZ-2 (kabuk+hero) tamamlanmış varsayılır.

Uygulanacak tasarım:
1. KEŞİF ALANLARI (renderCollections + #collections bölümü) — asimetrik bento: en çok kayıtlı 2 alan 5+4 sütunluk büyük hücre (kayıt sayılarından DİNAMİK seç, sabit kodlama yok), diğer 6 alan 3 sütunluk hücreler; mobil tek sütun. Hücre: mono sıra no (01–08) + mevcut özgün çizim + Fraunces başlık + not + mono envanter satırı. Hover: çizim scale(1.04) + hücreye özgün takımyıldız bağ çizgileri (SVG, 40ms stagger ile nokta nokta parlar; --glow-1). Aktif alan etiketi (discoveryTag) ve filtre davranışı AYNEN.
2. VİTRİN (#spotlightGrid) — kapaklar raf üstünde: çift sıra gölge + alt raf çizgisi; hover'da perspective(800px) rotateX(6deg) (reduced-motion'da statik). Bölüm altına küratör notu ekle (1–2 cümle, TR+EN, yeni i18n anahtarı: neden bu dört başlangıç kaynağı). spotlight-card davranışı ve choices ID'leri aynen.
3. NOBEL GALAKSİSİ (#timeline) — masaüstünde sticky sahne: bölüm yüksekliği = yatay içerik genişliği; scroll konumu → translateX doğrudan eşleme (pasif scroll dinleyici + rAF throttle; damping yok). Şerit: her yıl yıldız, parlaklık/yarıçap kayıt sayısıyla orantılı (mevcut renderTimeline verisi); 10'ar yıl mono etiketli. Yıl seçimi (katalog filtresi), tooltip, timelineReset, klavye gezinme davranışları AYNEN; tooltip cam yüzeye taşınır. prefers-reduced-motion VE motionToggle kapalı → yerleşik overflow-x:auto yatay kaydırma ile AYNI içerik (sticky kurgu devre dışı).
4. ARŞİVLER (#archives) — koyu tam-kanamaha bölüm korunur; renderArchiveProgress kartlarını mono "gözlem günlüğü" diliyle yeniden kur: "758 / 1257 · %60 DOĞRULANDI" tarzı mono satırlar + <progress> brass dolgu/saç teli iz olarak restille. Veri ve ?collection=..&availability=ready#catalog bağlantı sözleşmesi AYNEN.
5. Yeni tüm arayüz metinleri site/i18n.js'e TR+EN çift olarak ekle. ?v=42.

Kalite kuralları: yalnızca transform/opacity animasyonları; tokenları (--dur/--ease/--glow/--fs-*) kullan; her interaktif öğede --focus-ring odak halkası; dekoratif SVG'ler aria-hidden; iki tema da kusursuz; 480/768/1024/1440 kırılımları; sticky galaksi sahnesi iOS Safari'de güvenli (100svh kullan, overflow kilidi yok).

Kabul (Definition of Done):
- python tools/validate_site.py + tools/validate_i18n.py (varsa) + node --check (app.js, discovery.js, visuals.js, effects.js) → geçer.
- Bento büyük hücreler veri değişince doğru alanları seçiyor (geçici veriyle test).
- Galaksi: masaüstünde scroll akıcı (INP < 200ms izlenim; dropped frame yok), reduced-motion'da kaydırılabilir eşdeğer; yıl tıklaması katalog filtresi çalışıyor.
- TR↔EN: bento başlık/not/envanter, küratör notu, galaksi etiketleri, arşiv günlüğü tamamen çevriliyor.
- Klavye: tüm hücreler/kapaklar/yıl yıldızları odaklanabilir ve görünür odaklı.
Değişiklikleri tek commit'te "FAZ-3: bento discovery, shelf spotlight, Nobel galaxy scrollytelling, observation-log archives" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] Bento asimetrik; büyük hücreler dinamik; hover takımyıldız stagger'lı
- [ ] Vitrin rafı + küratör notu TR/EN
- [ ] Galaksi scroll sahnesi + reduced-motion eşdeğeri + yıl filtresi regresyonsuz
- [ ] Arşiv günlüğü mono dili; progress sözleşmesi aynen
- [ ] `validate_i18n.py` 0 hata; `?v=42`

## 7. Regresyon Kontrolü

Alan seçimi → katalog filtresi · `?discover=` URL'si · vitrin → detay · yıl şeridi tooltip + filtre · arşiv hazır-kaynak bağlantısı · TR/EN · iki tema · çevrimdışı.

## 8. Geri Alma

Tek commit → `git revert`. Galaksi scroll mantığı `app.js` içinde `renderTimeline` çevresinde izole tutulmalı (revert kolaylığı için yeni fonksiyon adları: `setupGalaxyScroll`, `teardownGalaxyScroll`).
