# FAZ 0 — Tasarım Sistemi Temeli (Token + Tipografi)

**Öncül:** yok (ilk faz) · **Sonraki:** FAZ-2 · **Süre tahmini:** 1 oturum

## 1. Amaç

Mevcut 59KB'lık `style.css` içinde dağınık duran renk/boyut/süre değerlerini üç katmanlı token mimarisine oturtmak; Fraunces + Inter + IBM Plex Mono değişken fontlarını self-host olarak eklemek; koyu/aydınlık tema altyapısını `data-theme` üzerinden kurmak. **Bu fazda görsel tasarım değişmez** — yalnızca temel atılır; mevcut görünüm tokenlara göçer.

## 2. Kapsam

- **İçinde:** `site/style.css` ilk bölümü (token blokları), `site/fonts/*` (yeni), `index.html` (font preload + tema init script'i), `site/sw.js` (font önbelleği), `tools/validate_fonts.py` (yeni, bütçe denetimi).
- **Dışında:** bölüm bazlı yeni tasarımlar (FAZ-2+), hareket koreografisi (FAZ-7), i18n (FAZ-1).

## 3. Teknik Spesifikasyon

1. **Token blokları** — ana plan Bölüm 5.1'deki üç katman birebir uygulanır (`:root` ilkel, `[data-theme="dark"|"light"]` anlamsal, bileşen katmanı). Mevcut `--ink/--paper/--accent` değişkenleri anlamsal katmana `@deprecated` eşlemeyle taşınır: eski isimler yeni tokenlara yönlendirilir (tek `var()` indirection), böylece hiçbir kural kırılmaz.
2. **Fontlar** — `site/fonts/` altına woff2: Fraunces (opsz/wght değişken, latin+latin-ext), Inter (wght değişken, latin+latin-ext), IBM Plex Mono (400,500, latin+latin-ext). `@font-face`'lerde `font-display:swap`, `unicode-range`, metric-compatible `size-adjust` fallback'leri (local: Georgia → Fraunces, system-ui → Inter). `index.html`'de kritik ağırlıklar `<link rel="preload" as="font">`. Toplam ≤ 170KB — `tools/validate_fonts.py` bunu CI'da denetler.
3. **Tema altyapısı** — `<head>` içine satır-içi tema init script'i (FOUC önleme: localStorage `bk-theme` + `prefers-color-scheme` → `document.documentElement.dataset.theme`). Mevcut `applyTheme()` bu sözleşmeye bağlanır; davranış (auto/light/dark, toggle) aynen korunur.
4. **Tip ölçeği** — ana plan 5.3'teki clamp ölçeği `--fs-*` tokenları olarak tanımlanır; mevcut başlık kuralları bu tokenları kullanacak şekilde güncellenir (görsel kayma minimal: mevcut boyutlar ölçeğe yuvarlanır).
5. **`?v=` sürümü** — `index.html` ve `sw.js` önbellek listesinde `v=40`'a yükseltilir.

## 4. Görev Listesi

1. Font dosyalarını indir/subset et, `site/fonts/` altına koy (OFL lisans bildirimlerini `site/fonts/LICENSES.txt`'te sakla).
2. `style.css` başına üç katman token bloğunu ekle; eski değişkenleri yeni tokenlara yönlendiren geçiş bloğu yaz.
3. `@font-face` kuralları + tip ölçeği tokenları + başlık kurallarının tokenlara göçü.
4. `index.html`: preload + satır-içi tema init; `sw.js`: fontları önbellek listesine ekle, sürümü artır.
5. `tools/validate_fonts.py`: `site/fonts/` toplam boyut ≤ 170KB, her `@font-face`'de `font-display` ve `unicode-range` var, latin-ext kapsamı mevcut (Türkçe karakter testi: "çğıöşüÇĞİÖŞÜ" glyph aralığında). `pages.yml` doğrulama adımına ekle.
6. İki temada manuel gözden geçirme; kabul kriterlerini işaretle.

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (repo kökü: site/ — vanilla HTML/CSS/JS, GitHub Pages, dış servis YASAK) FAZ-0'ı uygula: tasarım sistemi temeli. Tasarım planı: TASARIM-PLANI.md (ana plan), docs/tasarim/FAZ-0-temel.md (bu fazın detayı). Önce her iki belgeyi oku.

Yapılacaklar:
1. site/style.css başına üç katmanlı CSS custom property sistemi ekle:
   a) :root ilkel katman — boşluk ölçeği (4/8/12/16/24/32/48/64/96/128px), yarıçap (2/6/10/16/999), süre (120/240/400/700ms), easing (cubic-bezier(.22,1,.36,1) ve (.34,1.56,.64,1)), z-index (100/150/200/300/400).
   b) [data-theme="dark"] ve [data-theme="light"] anlamsal katman — ana plan Bölüm 5.1'deki hex değerleri birebir kullan.
   c) Bileşen katmanı — header-h, card-pad, focus-ring vb.
   d) Mevcut --ink/--paper/--accent/--line vb. değişkenleri yeni anlamsal tokenlara yönlendiren geçiş bloğu; hiçbir mevcut kural kırılmamalı (mevcut görünüm korunur, yalnızca temel atılır).
2. Self-host fontlar (site/fonts/): Fraunces değişken (opsz,wght; latin+latin-ext), Inter değişken (wght; latin+latin-ext), IBM Plex Mono (400,500; latin+latin-ext). WOFF2, font-display:swap, unicode-range, local() metric fallback + size-adjust. Kritik ağırlıkları index.html'de preload et. OFL lisanslarını site/fonts/LICENSES.txt'te belgele. Fontlar için dış CDN/istek KULLANMA — dosyalar repoda durmalı. Türkçe karakter kapsamı (ç ğ ı ö ş ü Ç Ğ İ Ö Ş Ü) zorunlu.
3. index.html <head>'ine satır-içi tema init script'i: localStorage bk-theme + prefers-color-scheme → document.documentElement.dataset.theme (FOUC önleme). Mevcut applyTheme() davranışı (auto/light/dark, themeToggle, meta theme-color) korunacak ve yeni sözleşmeye bağlanacak.
4. Tip ölçeği tokenları: --fs-display:clamp(52px,8vw,108px); --fs-h2:clamp(34px,4vw,56px); --fs-h3:clamp(22px,2.4vw,30px); --fs-lead:clamp(17px,1.5vw,20px); gövde 16px/1.75; --fs-label:11px uppercase +0.18em mono. Mevcut başlık kurallarını bu tokenlara göçür (görsel kayma minimal olmalı).
5. site/sw.js önbellek listesine fontları ekle; index.html ve sw.js içindeki ?v= sürümünü 39'dan 40'a çıkar.
6. Yeni araç tools/validate_fonts.py: (a) site/fonts toplamı ≤170KB; (b) her @font-face'te font-display ve unicode-range var; (c) latin-ext kapsamı Türkçe glyph'leri içeriyor. .github/workflows/pages.yml doğrulama adımına ekle (hata → yayını bloke et).

Kısıtlar: Framework yok; çalışma anında dış istek yok; mevcut URL parametreleri (?ui,?view,?record,?author,?collection,?discover,?saved) ve tüm davranışlar aynen korunmalı; prefers-reduced-motion ve motionToggle mekanizmasına dokunma.

Kabul (Definition of Done):
- python tools/validate_site.py, python tools/validate_fonts.py, node --check site/app.js, node --check site/sw.js, node --check site/i18n.js → hepsi geçer.
- Koyu ve aydınlık temada sayfa, token göçü öncesiyle görsel olarak aynı (±hafif boyut yuvarlama).
- Fontlar yalnızca repodan servis ediliyor; DevTools Network'te dış font isteği 0.
- Türkçe karakterler yeni fontlarda doğru görünüyor (çğıöşü ÇĞİÖŞÜ test cümlesi).
- İki temada da ana metin kontrastı APCA Lc ≥ 75 (koyu: #F2EEE3 on #060A12; aydınlık: #1B2B38 on #F6F4EC).
Değişiklikleri tek commit'te "FAZ-0: design tokens, self-host fonts, theme foundation" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] Üç katman token bloğu `style.css` başında; bileşen kurallarında ham hex yok (geçiş eşlemeleri hariç)
- [ ] Font bütçesi ≤ 170KB; `validate_fonts.py` yeşil; CI'da çalışıyor
- [ ] FOUC yok: tema ilk boyamada doğru
- [ ] Görsel regresyon yok (mevcut tasarım korunmuş)
- [ ] Türkçe glyph kapsamı doğrulandı
- [ ] `?v=40` güncellendi; SW çevrimdışı testi geçiyor

## 7. Regresyon Kontrolü

TR/EN geçişi · tema geçişi (auto/light/dark) · çevrimdışı yükleme · tüm URL parametreleri · `node --check` üç JS dosyası.

## 8. Geri Alma

Tek commit → `git revert`. Font dosyaları repo boyutunu ~170KB büyütür; geri alımda tamamen çıkar.
