# FAZ 1 — Çok Dilli Mimarinin Onarımı (i18n)

**Öncül:** yok (FAZ-0'dan bağımsız yürütülebilir; FAZ-4'ten önce bitmiş olmalı) · **Sonraki:** FAZ-2 · **Süre tahmini:** 1 oturum

## 1. Amaç

EN dil modunda bazı alanların Türkçe kalması sorununu **kanıtıyla tespit edilen 7 kusurun tamamını** gidermek ve i18n'yi çalışma anı iyi şansına değil, **derleme zamanı doğrulamaya** dayalı kusursuz bir mimariye taşımak.

## 2. Kanıtlı Bulgular (2026-10-14 denetimi)

| # | Konum | Belirti (EN modda) |
|---|---|---|
| i1 | `app.js → renderRoutes()` | Okuma yolu **adım notları Türkçe kalır** — 75 nottan 64'ü Türkçe karakter içeriyor; `EN_ROUTES` yalnız 10 rotanın başlık+açıklamasını kapsıyor |
| i2 | `i18n.js → EN_ROUTES` | Pozisyonel dizi (`EN_ROUTES[i]`): rota sırası değişirse çeviriler sessizce yanlış rotaya eşleşir |
| i3 | `i18n.js → EN_LABELS` | Veri-güdümlü etiket haritası elle bakım; yeni kategori/tür/dil/seviye değeri EN'de sessizce Türkçe kalır (bugün 0 eksik, mekanizma kırılgan) |
| i4 | `app.js → renderDriveFolders()` | Fallback etiket `'Kişisel arşiv'` sabit Türkçe |
| i5 | `app.js → render()` | `resultCount` EN metni satır içi sabit; sözlük dışında |
| i6 | `app.js → t()` | Eksik anahtar sessizce anahtar adını döndürür |
| i7 | Genel | Çoğul biçimler elle çoğaltılır (`activeFilterSingular/Plural`); TR/EN çoğul kuralları modellenmemiş |

**Korunacak tasarım kararı:** kayıt başlıkları, yazarlar ve açıklamalar özgün dillerinde kalır (uluslararası katalog pratiği); arayüz `originalNote` ile bunu bildirir.

## 3. Hedef Mimari

1. **UI dizeleri** `site/i18n.js`'te kalır (tek kaynak). `t()` geliştirme modunda eksik anahtarda `console.warn` üretir (üretimde sessiz).
2. **Veri etiketleri** yeni `site/i18n-data.js`'e'a taşınır: `{ "labels": { "Fizik": "Physics", ... }, "routes": { "<route-id>": { "title": "...", "description": "...", "steps": { "<step-id>": "..." } } } }`. ID-anhtarlı; sıra bağımsız (i2 düzelir).
3. **Rota adım notları** için EN çevirileri: katalog üretim hattı (`Guncelle.ps1` / `tools/`) `catalog.json` içine `note_en` alanı yazacak şekilde güncellenir; öncesinde mevcut 75 notun EN çevirileri elle hazırlanır ve `i18n-data.js`'a `steps` bölümü olarak eklenir. Runtime: `renderRoutes()` EN modda önce `note_en`, yoksa `i18n-data.js` steps, yoksa `originalNote` işaretiyle özgün dil (asla sessiz Türkçe değil — EN modda özgün dilde kalan not görünür şekilde etiketlenir).
4. **Çoğul API:** `plural(key,n)` — TR: tek biçim; EN: `key`/`key_plural`. Yeni dizelerde kullanılır; mevcut `*Singular/*Plural` çiftleri bu API'ye göçer.
5. **Doğrulayıcı** `tools/validate_i18n.py`:
   - (a) `UI.tr` ve `UI.en` anahtar paritesi (eksik/fazla → hata);
   - (b) `catalog.json` içindeki **tüm** distinct `category/kind/level/language` değerlerinin `i18n-data.js → labels` içinde EN karşılığı var (i3);
   - (c) her `routes[]` id'sinin EN başlık+açıklaması ve her adım notunun EN karşılığı var (i1);
   - (d) EN değerlerde Türkçe karakter taraması (veri etiketleri ve UI değerleri için; bilinçli istisnalar `allowlist` ile);
   - (e) `index.html`'deki tüm `data-i18n*` özniteliklerinin sözlükte karşılığı var;
   - (f) `app.js`'te `t('...')` çağrılarındaki sabit anahtarların sözlükte karşılığı var (statik tarama).
   `pages.yml`'ye eklenir; hata → **yayın bloke**.
6. **i4:** fallback `'Kişisel arşiv'` → `t('privateArchive')` anahtarı (TR/EN).
7. **i5:** `resultCount` metni `recordsSummary` bileşik anahtarıyla (`{count} records · {saved} saved` / `{count} kayıt · okuma listende {saved}`) sözlüğe taşınır; `plural` API kullanılır.


> **Uygulama notu (2026-10-14):** Veri sözlüğü site/i18n-data.js olarak, global I18N_DATA sabiti biçiminde uygulandı (fetch yerine script yüklemesi): SW çevrimdışı önbelleği ve 	ools/check_app.cjs fetch-mock''u ile sıfır sürtünme; içerik ve doğrulama sözleşmesi aynı. sync_catalog.py isteğe bağlı 
ote_en geçişini destekler; runtime önceliği 
ote_en → i18n-data.js → özgün dil + etiket.


> **Veri katmanı tamamlaması (2026-10-14):** Kullanıcı denetimi üzerine EN modundaki tüm veri kaynaklı Türkçe metinler de kapatıldı: 551 ödül konusu, 347 farklı açıklama ve Nobel belge başlığı son ekleri (i18n-data.js içinde wardTopics/descriptions + displayTitle/displayDescription yardımcıları). Özgün baskı başlıkları (Türkçe/Almanca eser adları) uluslararası katalog pratiği gereği özgün dilde kalır ve originalNote ile bildirilir.

## 4. Görev Listesi

1. `i18n-data.js` iskeleti; `EN_LABELS` içeriğini taşı; `EN_ROUTES`'u ID-anhtarlı `routes` bölümüne çevir.
2. 75 adım notunun EN çevirilerini hazırla (rotaların içeriklerine sadık, akademik ton).
3. `app.js`: `renderRoutes`, `renderDriveFolders`, `render`, `label()` çağrılarını yeni mimariye bağla; `plural()` yardımcısını ekle.
4. `i18n.js`: eksik-anahtar uyarısı; `privateArchive`, `recordsSummary` anahtarları.
5. `tools/validate_i18n.py` yaz; `pages.yml`'ye ekle.
6. `Guncelle.ps1`/`tools/` katalog üretimine `note_en` alan desteği ekle (çift-yazım: alan yoksa mevcut davranış).
7. Tam TR↔EN turu: her ekran, her durum (filtreli, detay, rota, palet sonrası).

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla JS, GitHub Pages) FAZ-1'i uygula: çok dilli (TR/EN) mimarinin onarımı. Önce TASARIM-PLANI.md Bölüm 4'ü ve docs/tasarim/FAZ-1-i18n.md dosyasını oku — bu fazın tek doğruluk kaynağı onlardır.

Tespit edilmiş kusurlar (bunları düzelt):
i1) site/app.js renderRoutes(): EN modda okuma yolu ADIM NOTLARI Türkçe kalıyor. EN_ROUTES (site/i18n.js) yalnızca 10 rotanın başlık+açıklamasını çeviriyor; steps[].note çevrilmiyor.
i2) EN_ROUTES pozisyonel dizi (EN_ROUTES[i]) — rota sırası değişirse çeviriler yanlış rotaya düşer. ID-anhtarlı yapıya geçir.
i3) EN_LABELS veri-güdümlü etiket haritası kırılgan: catalog.json'daki (site/data/catalog.json, 2653 kayıt) tüm distinct category/kind/level/language değerlerinin EN karşılığı olmalı ama mekanizma doğrulanmıyor.
i4) app.js renderDriveFolders(): fallback 'Kişisel arşiv' sabit Türkçe.
i5) app.js render(): resultCount EN metni satır içi sabit.
i6) t() eksik anahtarda sessizce anahtarı döndürüyor.
i7) Çoğul biçimler elle çoğaltılmış (activeFilterSingular/Plural).

Hedef mimari:
1. site/data/i18n-data.js OLUŞTUR (yeni dosya): { "labels": {...EN_LABELS içeriği...}, "routes": { "<route-id>": { "title": "...", "description": "...", "steps": { "<adım-id veya sıra-anahtarı>": "çeviri" } } } }. Route id'leri catalog.json → routes[].id alanlarından al (id yoksa title'ın normalize edilmiş halini anahtar yap ve bunu belgele).
2. catalog.json'daki 10 rotanın TÜM adım notlarını (steps[].note, toplam 75) İngilizceye çevir — içeriklere sadık, akademik-ama-doğal ton; çevirileri i18n-data.js routes bölümüne koy. Kaynak metinleri okuyarak çevir; makine çevirisi hissi veren kalıplardan kaçın.
3. app.js'i yeni mimariye bağla:
   - label(): EN_LABELS yerine i18n-data.js → labels (yükleme: start() içinde fetch veya i18n.js'e gömülü — SW çevrimdışı uyumlu olacak şekilde seç, tercihen site/i18n.js içine import edilmiş sabit ya da site/data/i18n-data.js fetch + sw.js önbelleğine ekle).
   - renderRoutes(): EN modda başlık/açıklama/adım notu ID-anhtarlı sözlükten; notun çevirisi yoksa notu özgün dilde göster VE arkasına görsel "(original language)" mikro-etiketi koy — asla sessizce Türkçe bırakma.
   - renderDriveFolders(): 'Kişisel arşiv' fallback'i → t('privateArchive').
   - render(): resultCount → t('recordsSummary') + plural API.
   - plural(key, n): TR tek biçim, EN key/key_plural; mevcut *Singular/*Plural çiftlerini göçür.
4. site/i18n.js: t() fonksiyonuna geliştirme modunda (location.protocol==='file:' veya ?debug) eksik anahtar console.warn; yeni anahtarlar: privateArchive, recordsSummary, recordsSummary_plural, stepNoteOriginal.
5. tools/validate_i18n.py YAZ (yeni): (a) UI.tr/UI.en anahtar paritesi; (b) catalog.json'daki tüm distinct category/kind/level/language değerlerinin i18n-data.js labels'ta karşılığı; (c) her rotanın EN başlık+açıklaması ve her adım notunun EN karşılığı; (d) EN değerlerde Türkçe karakter taraması ([çğıöşüÇĞİÖŞÜ]) — allowlist ile istisnalar; (e) index.html'deki data-i18n* özniteliklerinin hepsinin sözlükte karşılığı; (f) app.js'te t('...') sabit anahtarlarının sözlükte karşılığı (regex taraması). .github/workflows/pages.yml doğrulama adımına ekle — hata yayını BLOKE etsin.
6. tools/ katalog üretim hattına (Guncelle.ps1'nin çağırdığı python araçları) note_en alan desteği ekle: alan catalog kaynaklarında varsa catalog.json'a yazılır; yoksa davranış bugünküyle aynı (çift-yazım güvenli göç).

Kısıtlar: vanilla JS; UI dizeleri site/i18n.js'de kalıyor; kayıt başlığı/yazar/açıklama özgün dilde kalıyor (bu KUSUR DEĞİL, tasarım kararı — dokunma); tüm URL parametreleri ve davranışlar korunmalı; çevrimdışı (SW) i18n-data.js dahil çalışmalı.

Kabul (Definition of Done):
- python tools/validate_i18n.py → 0 hata; pages.yml'de çalışıyor.
- node --check site/app.js, node --check site/i18n.js, python tools/validate_site.py → geçer.
- Manuel tur: EN modda tüm ekranlarda (hero, alanlar, vitrin, zaman şeridi, katalog+filtreler+çipler, kartlar, liste görünümü, kayıt detayı, okuma yolları AÇIK ve KAPALI, arşivler, alt bilgi, toast mesajları) Türkçe kalan TEK BİR arayüz etiketi yok (kayıt künyesi hariç — o özgün dilde ve etiketli).
- TR modda hiçbir regresyon yok; dil geçişi sorgu/filtre/görünüm/detay durumunu koruyor.
Değişiklikleri tek commit'te "FAZ-1: i18n architecture repair — data-driven labels, ID-keyed routes, step-note translations, CI validation" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] i1–i7'nin her biri için düzeltme kanıtlandı (öncesi/sonrası ekran kontrolü)
- [ ] `validate_i18n.py` 0 hata; CI'da bloke edici
- [ ] EN turunda 0 Türkçe arayüz etiketi (özgün-dil künye alanları etiketli biçimde hariç)
- [ ] Rota sırası değiştirme testi: çeviriler doğru rotada kalıyor (ID bağı)
- [ ] Çevrimdışı modda i18n verisi yükleniyor
- [ ] `Guncelle.ps1` akışı kırılmadı

## 7. Regresyon Kontrolü

TR↔EN geçişinde: sorgu + filtre + görünüm + açık detay + rota durumu · `?ui=en` doğrudan açılış · okuma listesi içe/dışa aktarım · SW çevrimdışı.

## 8. Geri Alma

Tek commit → `git revert`. `i18n-data.js` runtime bağımlılığı olduğundan revert sonrası `app.js` de dönmeli (aynı commit'te olduklarından otomatik).
