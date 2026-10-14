# FAZ 4 — Katalog Sistemi (Faset Rayı, Kart Anatomisi, Kayıt Defteri, Okuma Yolları)

**Öncül:** FAZ-0, FAZ-1 (i18n doğrulayıcı hazır olmalı), FAZ-2 · **Sonraki:** FAZ-5 · **Süre tahmini:** 2 oturum

## 1. Amaç

Kataloğu, dünya standartlarındaki fasetlı arama deneyimine taşımak: canlı sayımlı sol faset rayı, yeni kart anatomisi, akademik "kayıt defteri" liste görünümü, akıllı boş durum ve seyir haritası estetiğinde okuma yolları. **Arama/filtre davranış sözleşmesi birebir korunur** — yalnızca sunum ve keşif kalitesi değişir.

## 2. Kapsam

- **İçinde:** `index.html` (katalog + routes bölümleri), `style.css`, `app.js` (`populateFilters`, `render`, `renderFilterChips`, `renderPagination`, `renderRoutes`, öneri listesi), yeni `site/facets.js` (faset rayı mantığı — `app.js` şişmeden).
- **Dışında:** kayıt detayı (FAZ-5), komut paleti (FAZ-6).

## 3. Teknik Spesifikasyon

### 3.1 Faset Rayı (masaüstü ≥1024)
- `#catalog` içinde sol sticky sütun (E3 yüzey, cam yok — okuma alanı sakin); 9 faset grubu (koleksiyon/alan/dil/yıl aralığı/tür/seviye/erişim/sıralama).
- Her faset: disclosure (WAI-ARIA APG) başlık + değer listesi checkbox/radyo etiketli; **her değerin yanında canlı sonuç sayısı** (mevcut `filtered()` üzerinde, diğer aktif filtreler sabit tutularak hesap — 2653 kayıt için ön-hesaplı indeks: `tools/` derlemede `facet-counts.json` üretilebilir; çalışma anında yalnızca seçim değişince yeniden hesap, 120ms debounce).
- 0 sonuç veren değerler `disabled` + soluk; tıklanamaz (hata önleme).
- Mobil (<1024): mevcut `<details>` panel düzeni korunur; `select`'ler aynen kalır (dokunma UX).
- `populateFilters`/`options()` API'si korunur; ray, aynı `FILTERS` dizisini sürer.

### 3.2 Faset Çipleri + Sonuç Şeridi
- Mevcut çipler satırı yeni çip stiline göçer (etkileşim aynen: × tekli kaldırma, `saved` çipi).
- Sonuç şeridi (`result-bar` + `catalogJumpbar`): E3 cam; `resultCount` FAZ-1 `recordsSummary` anahtarıyla; sayfalama numaraları mono.
- Görünüm anahtarı (Kartlar/Liste) segmented control; `?view=` sözleşmesi aynen.

### 3.3 Kart Anatomisi (grid)
```
┌──────────────────────────────┐
│ ▌  BK-0142 · 1921 · makale   │ ← mono künye şeridi + sol 3px omurga
│ ▌  Kayıt Başlığı (Fraunces)  │
│ ▌  Yazar                     │
│ ▌  [çipler: dil·tür·seviye]  │
│ ▌  2 satır açıklama…         │
│ ▌  PDF ↗ | Kaynak ↗    ☆    │ ← eylem çubuğu
└──────────────────────────────┘
```
- Katalog no: kayıt `id`'sinin son 4 hanesi + koleksiyon öneki (görsel süs; `title-detail` davranışı aynen).
- Hover: E2 yükselme + omurga `--glow-1`; `highlight()` arama vurgulaması aynen.

### 3.4 Liste Görünümü — Kayıt Defteri
- Satırlar: `no | başlık (serif) | yazar | yıl | tür | dil | durum | ☆` — mono sütun başlıkları, zebra yerine saç teli ayraç; akademik katalog estetiği.
- `viewMode`/`localStorage`/`?view=list` sözleşmeleri aynen.

### 3.5 Boş Durum
- `t('empty')` metnine ek: "En yakın alternatifler" — aynı alanın diğer değerleri (mevcut `populateFilters` kapsamından), 3 öneri çipi; tıklayınca filtre değişir. Veri yoksa mevcut metin.

### 3.6 Okuma Yolları — Seyir Haritası
- `routeList`: dikey sürekli brass rota çizgisi (CSS `::before`) + numaralı durak düğümleri; `<details>` aç/kapa ve klavye davranışı aynen.
- Rota kartı içi: başlık + meta + açıklama; adım listesinde mevcut `catalogRecordArt` + `note`/`note_en` (FAZ-1) düzeni.

## 4. Görev Listesi

1. `facets.js` oluştur: ray render + canlı sayım (ön-hesap + debounce) + 0-sonuç disable.
2. `index.html` katalog bölümünü yeni yerleşime taşı (ray + sonuç şeridi + ızgara); mobil `select` fallback.
3. Kart anatomisini yeni stile göçür; liste görünümünü kayıt defterine dönüştür.
4. Boş durum alternatif önerileri; çipler/şerit/pagination stilleri.
5. Okuma yolları seyir haritası.
6. Yeni dizeler TR/EN; `?v=43`; regresyon turu (aşağıda tam liste).

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla JS, GitHub Pages, dış istek YASAK) FAZ-4'ü uygula: katalog sistemi. Önce TASARIM-PLANI.md ve docs/tasarim/FAZ-4-katalog.md dosyalarını oku. FAZ-0..3 tamamlanmış varsayılır; FAZ-1'in tools/validate_i18n.py aracı hazırsa her yeni metinde çalıştır.

Kritik sözleşme — davranış AYNEN korunur, yalnızca sunum değişir: FILTERS dizisi, populateFilters/options() API'si, ?query/?collection/?category/?language/?yearFrom/?yearTo/?kind/?level/?availability/?sort/?author/?discover/?saved/?view URL parametreleri, favoritesOnly, sayfalama (24/sayfa, pageList), highlight() arama vurgulaması, öneri listesi (combobox ARIA), / kısayolu.

Uygulanacak tasarım:
1. FASET RAYI (≥1024px) — #catalog içinde sol sticky sütun: 9 faset grubu, her biri WAI-ARIA APG disclosure deseni (button aria-expanded + bölge). Her faset değeri checkbox/radyo etiketli + YANINDA CANLI SONUÇ SAYISI: seçim değişince diğer aktif filtreler sabit tutularak hesap (120ms debounce; 2653 kayıt — gerekirse tools/ derleme adımında facet-counts önhesabı, çalışma anında birleştir). 0 sonuç veren değer disabled+soluk (tıklanamaz). Mobil <1024: mevcut <details> + <select> düzeni AYNEN kalır. Yeni dosya site/facets.js oluştur (app.js'i şişirme; app.js mevcut event'leriyle entegre).
2. SONUÇ ŞERİDİ — result-bar + catalogJumpbar E3 cam yüzey; resultCount FAZ-1 recordsSummary anahtarıyla; sayfa numaraları mono; Kartlar/Liste segmented control (mevcut viewMode/localStorage/?view sözleşmesi aynen).
3. KART ANATOMİSİ (grid) — sol 3px disiplin omurgası + mono künye şeridi (katalog no: id son 4 hane + koleksiyon öneki; yıl; tür) + Fraunces başlık + yazar + çipler + 2 satır açıklama (line-clamp) + eylem çubuğu (Drive/kaynak bağlantıları + yıldız). title-detail, data-star, highlight() davranışları aynen. Hover: E2 yükselme + omurga --glow-1.
4. LİSTE GÖRÜNÜMÜ — "kayıt defteri": satır bazlı (no | serif başlık | yazar | yıl | tür | dil | durum | ☆), mono sütun başlıkları, saç teli ayraçlar. viewMode sözleşmesi aynen.
5. BOŞ DURUM — mevcut t('empty') + "en yakın alternatifler": aynı fasetin diğer değerlerinden 3 öneri çipi (tıklayınca filtre değişir); öneri yoksa yalnız mevcut metin.
6. OKUMA YOLLARI — dikey seyir haritası: sürekli brass rota çizgisi + numaralı durak düğümleri; details/summary aç-kapa + klavye aynen; adım notları FAZ-1 note_en mimarisiyle.
7. Yeni tüm metinler site/i18n.js'e TR+EN; ?v=43.

Kalite kuralları: transform/opacity; tokenlar; --focus-ring her interaktif öğede; checkbox/radyolar gerçek input (görünmez ama erişilebilir pattern: label içinde input + custom kutu); aria-live=resultCount korunur; iki tema; 480/768/1024/1440.

Kabul (Definition of Done):
- python tools/validate_site.py + tools/validate_i18n.py + node --check (app.js, facets.js, i18n.js) → geçer.
- Regresyon turu TAMI: her URL parametresi tek tek test (örn. ?ui=en&collection=nobel&yearFrom=1921&yearTo=1921&sort=year-desc&view=list#catalog) — aynı sonuç kümesi ve durum.
- Faset sayıları doğru: bir değer seçilince diğer fasetlerin sayıları güncelliyor; 0'lı değerler disabled.
- Klavye: ray, çipler, kartlar, sayfalama tam klavye ile gezilebilir; odak görünür.
- TR↔EN: tüm faset etiketleri, çipler, boş durum, defter başlıkları çevriliyor.
- Lighthouse INP izlenimi: filtre değişimi 200ms altında (debounce + sayım optimizasyonu).
Değişiklikleri tek commit'te "FAZ-4: facet rail with live counts, new card anatomy, ledger list, smart empty state, journey routes" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] Faset rayı canlı sayımlı; 0'lı değerler disabled; mobil select fallback aynen
- [ ] Yeni kart + defter görünümü; tüm davranış sözleşmeleri regresyonsuz
- [ ] Boş durum alternatif önerileri çalışıyor
- [ ] Okuma yolları seyir haritası; adım notları EN'de çevrili (FAZ-1 çıktısı)
- [ ] `validate_i18n.py` 0 hata; `?v=43`; INP hedefi tutuyor

## 7. Regresyon Kontrolü (tam liste)

Her URL parametresi tek tek · filtre birleşimleri · yıl aralığı · sıralamalar · favoritesOnly + içe/dışa aktarım · `?record=` ile açılış · öneri listesi klavye · `returnSearch` · sayfalama + `pageInfo` · TR/EN · iki tema · çevrimdışı · `discover` etiketi kaldırma.

## 8. Geri Alma

Tek commit → `git revert`. `facets.js` yeni dosya; `app.js` değişiklikleri `populateFilters` çağrı noktalarında izole tutulmalı.
