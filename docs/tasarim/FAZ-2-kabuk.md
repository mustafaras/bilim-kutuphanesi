# FAZ 2 — Kabuk ve "İlk Işık" (Header, Hero, İstatistik, Alt Bilgi)

> **Not:** Bu dalda FAZ-2 sıfırdan, premium geçişle yeniden inşa edildi: yoğunlaşan çift katmanlı cam header (mono gezinme endeksleri, ⌘K tetikleyicisi), görüş alanı çerçeveli (viewfinder HUD) 100svh "İlk Işık" sahnesi (üç katmanlı yıldız alanı, Samanyolu bandı, kayma alanı paralaksı, veri güdümlü takımyıldız + meteor + çift sırt ufuk silueti ve teleskop kubbesi), enstrüman istatistik paneli (tek seferlik sayaç animasyonu) ve yıldız siluetli 3+1 sütunlu alt bilgi. Ölü `.hero-art`/`.orbit` kalıntıları CSS'ten temizlendi; `?v=44`.

**Öncül:** FAZ-0 · **Sonraki:** FAZ-3 · **Süre tahmini:** 1–2 oturum

## 1. Amaç

Uygulamanın "çerçevesini" (kabuk) ve ilk izlenimini (hero) yeni kimliğe taşımak: yoğunlaşan cam header, 100svh "İlk Işık" sahnesi, mono etiketli enstrüman istatistik paneli ve yıldız siluetli alt bilgi. Bu fazda ziyaretçi ilk kez "bu başka bir lig" hissini alır.

## 2. Kapsam

- **İçinde:** `index.html` (header/hero/stats/footer bölümleri), `style.css`, `visuals.js` (hero sahnesi), `effects.js` (kinetik giriş), `i18n.js` (yeni dizeler).
- **Dışında:** keşif alanları/vitrin/galaksi (FAZ-3), katalog (FAZ-4), komut paleti işlevselliği (FAZ-6 — bu fazda yalnız ⌘K tetikleyici düğmesi yerleşimi ve `aria-disabled` ara yüzü eklenir).

## 3. Teknik Spesifikasyon

### 3.1 Header
- `position:sticky; top:0; z-index:var(--z-sticky)`; cam yüzey (`--glass` + `backdrop-filter:blur(16px)` — `@supports` yoksa opak fallback).
- Yoğunlaşma: scrollY > 24px'te `data-condensed` → yükseklik `--header-h`(72px) → 56px; geçiş `--dur-2 --ease-out`; yalnızca padding/height (transform yok — sticky'de güvenli).
- İçerik: marka (mark + serif logotype), nav (Keşfet/Katalog/Okuma yolları/Arşivlerim), ⌘K arama tetikleyicisi (mono "⌘K" rozetli; tıklanınca `#catalog` arama alanına odaklar — FAZ-6'da paletle değişir), TR/EN anahtarı, tema düğmesi. Mevcut `nav`/`language-switch`/`themeToggle` semantiği ve davranışı korunur.
- Mobil (≤768): tek satır marka + ikon kümesi; nav, mevcut düzen yerine yatay kaydırılabilir satır.

### 3.2 Hero "İlk Işık"
- `min-height:100svh`; koyu sahne: `--surface-0` zemin + mevcut canvas (`knowledgeCanvas`) **gözlemevi sahnesine** yeniden kurgulanır: alt üçte birde ufuk silueti (basit teleskop kontürü — 1.5px brass çizgi), üstte katalog verisinden üretilen takımyıldız (8 keşif alanı = 8 düğüm; düğüm parlaklığı alanın kayıt sayısıyla orantılı — `library:ready` sonrası bir kez hesaplanır).
- Tipografi: sol 7 sütun; `--fs-display` Fraunces; satır satır maskeli giriş (`clip-path` + `translateY`, 700ms, 80ms stagger, tek seferlik). `em` vurgusu brass gradyan `background-clip:text`.
- Mono HUD detayları: sağ alt köşe koordinat etiketi (statik süs: `DEC +41°16′ · RA 12h 30m`), sol altta "aşağı in" scroll göstergesi (ince brass çizgi + ok animasyonu 2s döngü, reduced-motion'da statik).
- Mevcut `heroEyebrow/heroTitle/heroDescription/explore/choosePath/heroFoot` i18n anahtarları ve eylem hedefleri aynen; `artCenter/artTag/artCaption` HUD sözlüğüne güncellenir (i18n).
- Canvas: `IntersectionObserver` + `visibilitychange` ile durur (mevcut); imleç paralaksı korunur; mobilde dokunmatik etkileşim yok (mevcut).

### 3.3 İstatistik Paneli
- Mono etiketli 4'lü "enstrüman paneli": `--fs-h2` Fraunces sayaç + `--fs-label` mono açıklama; ilk görünümde `number-tick` (180ms, `requestAnimationFrame`, reduced-motion'da anında).
- Ayraçlar: dikey saç telleri `--line-1`; arka plan `--surface-1`.
- Mevcut `renderStats()` veri kaynağı ve `updated/syncStatus` davranışı korunur.

### 3.4 Alt Bilgi
- 3 sütun (marka+künye / not / teknik durum); üst kenarda ince yıldız haritası silueti (mevcut çizim diliyle dekoratif SVG, `aria-hidden`).
- Mevcut bağlantılar (katalog indir, repo, Drive) aynen.

## 4. Görev Listesi

1. Header yapısını yeniden kur; sticky + cam + yoğunlaşma; ⌘K tetikleyici ekle.
2. Hero HTML'ini yeni sahneye güncelle; `visuals.js`'te takımyıldız + ufuk sahnesini çiz; `effects.js`'e kinetik tipografi girişini ekle.
3. İstatistik panelini yeni stile göçür; `number-tick` ekle.
4. Alt bilgiyi yeniden kur; yıldız silueti SVG'si ekle.
5. Yeni UI dizelerini `i18n.js`'e TR/EN ekle (FAZ-1 doğrulayıcısı pariteyi zorunlu kılar).
6. `?v=41`; tüm kırılımlarda (480/768/1024/1440) gözden geçir; klavye turu.

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla HTML/CSS/JS, GitHub Pages, dış istek YASAK) FAZ-2'yi uygula: kabuk ve hero yeniden tasarımı. Önce TASARIM-PLANI.md (özellikle Bölüm 5 tasarım sistemi ve 6. bölüm özeti) ve docs/tasarim/FAZ-2-kabuk.md dosyalarını oku. FAZ-0 tamamlanmış varsayılır: token katmanları ve fontlar (Fraunces/Inter/IBM Plex Mono) hazır.

Uygulanacak tasarım (detaylar faz dosyasında):
1. HEADER — sticky, cam yüzey (--glass + backdrop-filter:blur(16px); @supports yoksa opak fallback), scrollY>24'te data-condensed → 72px'ten 56px'e yoğunlaşma (--dur-2 --ease-out). İçerik: marka (mevcut mark + Fraunces logotype), mevcut nav (Keşfet/Katalog/Okuma yolları/Arşivlerim), YENİ ⌘K arama tetikleyici düğmesi (mono "⌘K" rozeti; tıklanınca #catalog'taki arama girişine odaklanır — tam komut paleti FAZ-6'da gelecek, şimdilik bu davranış), mevcut TR/EN anahtarı ve tema düğmesi (semantik+davranış aynen). Mobil ≤768: tek satır + yatay kaydırılabilir nav.
2. HERO "İlk Işık" — min-height:100svh koyu sahne. Mevcut canvas (knowledgeCanvas) yeniden kurgu: alt üçte birde ince brass (1.5px) ufuk silueti + basit teleskop kontürü; üstte KATALOĞUN GERÇEK VERİSİNDEN takımyıldız — 8 keşif alanı (DISCOVERY dizisi) 8 düğüm; düğüm parlaklığı alanın kayıt sayısıyla orantılı (library:ready olayından sonra bir kez hesapla). Sol 7 sütunda tipografi: --fs-display Fraunces, satır satır maskeli giriş (clip-path + translateY, 700ms, 80ms stagger, TEK SEFERLİK), em vurgusu brass gradyan background-clip:text. Mono HUD süsleri: sağ altta koordinat etiketi, sol altta "aşağı in" scroll göstergesi (2s döngü; prefers-reduced-motion'da statik). Mevcut i18n anahtarları (heroEyebrow/Title/Description/explore/choosePath/heroFoot) ve eylem hedefleri AYNEN; artCenter/artTag/artCaption değerlerini gözlemevi sahnesine uygun TR/EN metinlerle güncelle. Canvas durdurma (IntersectionObserver + visibilitychange) ve imleç paralaksı davranışlarını koru; mobilde dokunmatik etkileşim yok.
3. İSTATİSTİK PANELİ — mono etiketli 4'lü enstrüman paneli: --fs-h2 Fraunces sayaçlar + --fs-label mono açıklamalar; ilk görünümde number-tick animasyonu (180ms rAF; reduced-motion'da anında değer). renderStats() veri kaynağı, updated/syncStatus davranışı aynen.
4. ALT BİLGİ — 3 sütun (marka+künye / footerNote / teknik durum: çevrimdışı+senkron göstergeleri); üst kenarda ince yıldız haritası silueti (özgün dekoratif SVG, aria-hidden). Mevcut bağlantılar aynen.
5. Tüm yeni arayüz metinleri için site/i18n.js'e TR+EN karşılıkları ekle (FAZ-1'deki tools/validate_i18n.py pariteyi zorunlu kılıyor — python tools/validate_i18n.py 0 hata dönmeli; araç henüz yoksa anahtar paritesini elle iki dilde de garanti et).
6. index.html ve sw.js'de ?v= değerini artır (41).

Kalite kuralları: yalnızca transform/opacity animasyonları (sticky header'da height/padding geçişi istisna); --dur/--ease tokenlarını kullan; odak halkaları --focus-ring ile her interaktif öğede; dekoratif öğeler aria-hidden; ARIA semantiği mevcut haliyle korunur (nav aria-label, language-switch role=group vb.); iki tema da (koyu birincil, aydınlık parşömen) aynı özenle çalışmalı; 480/768/1024/1440 kırılımlarını test et.

Kabul (Definition of Done):
- python tools/validate_site.py + python tools/validate_i18n.py (varsa) + node --check (app.js, sw.js, visuals.js, effects.js, i18n.js) → hepsi geçer.
- Lighthouse (mobil): LCP < 2.5s, CLS < 0.1; hero metni CSS'te, canvas defer.
- prefers-reduced-motion: kinetik giriş ve scroll göstergesi animasyonsuz; içerik eksiksiz erişilebilir.
- Klavye turu: Tab sırası mantıklı; odak halkaları iki temada görünür.
- TR↔EN geçişinde hero, header, istatistik ve alt bilgi tamamen çevriliyor.
Değişiklikleri tek commit'te "FAZ-2: glass header, First Light hero, instrument stats, starlit footer" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [x] Header yoğunlaşıyor (72→56px); cam fallback çalışıyor; ⌘K tetikleyicisi aramaya odaklıyor
- [x] Hero 100svh; satır maskeli kinetik tip tek seferlik; takımyıldız veri-güdümlü; canvas dışarıda duruyor
- [x] İstatistik sayaçları gerçek count-up ile tick alıyor; reduced-motion'da anında
- [x] Alt bilgi 3 sütun + yıldız silueti + künye tabanı; mevcut bağlantılar sağlam
- [x] Lighthouse LCP/CLS hedefleri tutuyor (hero metni CSS'te, canvas defer); iki tema da kusursuz
- [x] `validate_i18n.py` 0 hata; `validate_site.py` + `check_app.cjs` geçer; `?v=44`

## 7. Regresyon Kontrolü

Nav çapa bağlantıları · tema geçişi · TR/EN · `/` kısayolu · skip bağlantısı · çevrimdışı · 480px tek sütun.

## 8. Geri Alma

Tek commit → `git revert`. Hero canvas değişikliği `visuals.js` içinde izole; revert sonrası eski sahne döner.
