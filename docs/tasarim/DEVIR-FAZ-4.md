# DEVİR — FAZ-4 (Katalog Sistemi) · Sonraki oturuma uygulama notları

**Tarih:** 2026-10-15 · **Yazan:** FAZ-3 oturumu (GLM-5.3) · **Alan:** Sonraki uygulayıcı (Opus 5.5)
**Durum:** FAZ-0..3 main'de ve canlıda. FAZ-3b (cila) ve **FAZ-4 uygulandı**, `claude/ecstatic-knuth-ad7fw0` dalında; main'e birleştirme bekliyor. Aşağıdaki 1–3. bölümler tarihîdir; güncel durum §7 ve §8'dedir.

Bu belge, `TASARIM-PLANI.md` ve `docs/tasarim/FAZ-4-katalog.md` yerine geçmez; onları okuduktan sonra buradaki **güncel durum + bu oturumların öğrettikleri** ile başla. FAZ-4 belgesindeki uygulama promptu geçerli; aşağıdaki düzeltme ve tuzaklarla birlikte uygula.

## 1. Güncel durum (bunu tahmin etme, buradan oku)

- **Canlı:** https://mustafaras.github.io/bilim-kutuphanesi/ · main = `eed84cf` · deploy yeşil.
- **Önbellek sürümü: `?v=46`** (HTML'de 7 referans + `sw.js` CACHE adı ve FILES listesi). FAZ-4 belgesi `?v=43` diyor — **tarihî; sonraki sürüm v47'dir.** Her faz/kırıcı düzeltmede: HTML `?v=`, `sw.js` CACHE adı ve FILES birlikte artar; `tools/validate_site.py` eşitsizlikte yayını bloklar.
- FAZ-3 çıktıları (FAZ-4'ün dokunmayacağı ama komşusu olduğu yüzeyler): bento keşif alanları (`renderCollections` + `bentoSpans` paketleyici + `tileConstellation` SVG), vitrin rafı (`shelf-edge` + küratör notu), Nobel galaksisi scrollytelling (`setupGalaxyScroll`/`teardownGalaxyScroll`), arşiv gözlem günlüğü (`archive-log-line`).

## 2. FAZ-3'ten öğrenilen tuzaklar (FAZ-4'te tekrar yapma)

1. **Sticky + padding-bottom TUZAĞI (en kritik):** Bir bölümün `padding-bottom`'u sticky çocuğun hareket alanını **genişletmez** — sticky containing block = parent'ın *content box*'ıdır. Galaksi sahnesinde panel ~140px sonra pin'dden çıkıyordu ve 1447px boş padding kullanıcıya "devasa boşluk" olarak görünüyordu. **Çözüm:** scroll alanını içerik akışına spacer elemanıyla kur (`panel.after(spacer)`, teardown'da `.remove()`). FAZ-4'ün sol sticky faset rayı benzer bir sahne kurarsa aynı pattern.
2. **Sürüm numaraları planda çürür:** FAZ-4 promptu `?v=43` der; gerçekte 46'dayız → **v47 kullan**. Kural: plandaki sayıyı değil depodaki gerçeği al.
3. **`tools/check_app.cjs` sahte DOM'da çalışır:** `matchMedia`, `requestAnimationFrame`, `MutationObserver`, global `addEventListener` **yoktur**; `documentElement.classList` yoktur. Yeni tarayıcı API'si kullanan her kod `typeof X==='function'` ile korunmalı (örnek: `app.js` içindeki galaksi fonksiyonları). Ayrıca `el('collectionGrid')` içinden `<svg ` sayar (şu an 16 = 8 oyma + 8 takımyıldız) — SVG ekleyip çıkarırsan bu assert'i güncelle; `--missing-art` modu da aynı sayıyı bekler.
4. **`validate_site.py` sözleşmeleri:** `app.js`'teki her `$('id')` index.html'de var olmalı; HTML'deki her `?v=N` varlığı `sw.js` FILES'ta birebir aynı dizgeyle durmalı.
5. **Yerel doğrulamada önbellek tuzağı:** `python -m http.server 8642 --directory site` + tarayıcı canvas ile test et; ama sayfayı düz reload edince **service worker + HTTP heuristic cache** eski varlıkları verebilir. Edit sonrası `http://localhost:8642/?devcache=<rastgele>` ile gez veya `caches.keys()` temizle. Production'ı etkilemez (v-sürümümlü URL'ler orada taze çekilir); sadece yerel test disiplini.
6. **CSS mimarisi:** `style.css` "son blok kazanır" düzeninde — her faz kendi bloğunu dosya sonuna ekler; eş-specificity kurallar orada eski kurlları ezer. Medya sorguları specificity eklemez; eski kuralı ezmek için ya daha yüksek specificity yaz ya da arkadan ekle. FAZ-3 bloğu en sondadır; FAZ-4 bloğunu onun arkasına ekle.
7. **impeccable tasarım hook'u:** Fraunces/Inter fontları, kart omurga renkleri, hero gradyanı gibi maddeleri işaretler — bunlar TASARIM-PLANI.md'nin bilinçli kararlarıdır; "düzeltme". Yalnız kendi yeni kodunun gerçek kusurlarını ele.

## 3. FAZ-4 uygulama sırası önerisi

1. `site/facets.js` oluştur (yeni dosya; `index.html`'e `?v=47` ile ekle + `sw.js` FILES'a ekle — **unutulursa offline cache eksik kalır**).
2. Faset rayı (≥1024, disclosure + canlı sayım + 0-sonuç disabled). Canlı sayım: `filtered()` üzerinde diğer filtreler sabit; 2653 kayıt × 9 faset — 120ms debounce yeter, ön-hesap dosyasına şimdilik gerek yok (ölç, gerekirse ekle).
3. Kart anatomisi + defter liste görünümü (davranış sözleşmesi: `FILTERS`, `populateFilters`, `pageList`, `highlight()`, `?view=`, `data-star`, `title-detail` AYNEN).
4. Boş durum alternatifleri, sonuç şeridi, sayfalama stilleri.
5. Okuma yolları seyir haritası.
6. Yeni dizeler TR+EN (`i18n.js` — çift anahtar paritesi otomatik doğrulanır), `?v=47`, tam regresyon turu.

## 4. Doğrulama rutini (her commit öncesi)

```
node --check site/app.js && node --check site/facets.js   # + diğer değişen js'ler
python tools/validate_site.py
python tools/validate_i18n.py
node tools/check_app.cjs
node tools/check_app.cjs --missing-art
```

Canlı davranış testi: yerel sunucu + tarayıcı canvas (`evaluate_javascript` ile geometri/transform ölçümü — FAZ-3'te pin davranışı böyle kanıtlandı). Sonra tek commit: `"FAZ-4: facet rail with live counts, new card anatomy, ledger list, smart empty state, journey routes"`.

## 5. Yayın akışı

Branch'te commit → `git push origin <branch>` → ana checkout'ta (`C:\Users\m_ras\bilim-kutuphanesi`) `fetch + merge --no-edit + push origin main` → `gh run watch` ile "Publish library" izle → canlıdan `?v=47` ve yeni içerik teyit et (`Invoke-WebRequest`).

## 6. Açık konular / notlar

- FAZ-3 kabul kriterlerinin tamamı yeşil; bekleyen iş yok. Kullanıcının bildirdiği sticky boşluk hatası `eed84cf` ile kapatıldı.
- Galaksi JS'i (`setupGalaxyScroll`) `renderTimeline` sonunda `scheduleGalaxyScroll()` ile tetiklenir — FAZ-4 katalog değişiklikleri `render()` sıklığını değiştirirse bu yeniden ölçüm maliyeti göz ardı edilebilir düzeyde kalır (idempotent teardown+setup).
- `check_app.cjs` içindeki çeviri/URL assert'leri yeni faset UI'ını kapsamaz; faset sözleşmesi için kendi ek assert'lerini `check_app.cjs`'e ekle (proje disiplimi böyle).

## 7. FAZ-3b güncellemesi (cila) — sürüm v47

- **Nobel galaksisi kaldırıldı** (`setupGalaxyScroll` + sticky sahne + spacer). Yerine **Nobel Chronicle**: kategoriye göre yığılmış 126 yıl sütunu (`#timelineStrip`, `.nc-*`), on yıl kısayolları (`#nobelDecades` → katalogda yıl aralığı süzer) ve **yıl dosyası** (`#nobelDossier`: büyük yıl, kategori dökümü, ödül sahipleri → `data-detail` ile kayıt penceresi). Klavye: ← → Home End. Sütun tıklaması yalnız önizler; katalog süzgeci "Bu yılı katalogda aç" ile uygulanır.
- Tuzak: genel `.empty` sınıfı `grid-column:1/-1` verir — Nobel sütunlarında `.is-empty` kullanıldı.
- Düzeltmeler: üstbilgi opaklığı (içerik sızıntısı), vitrin kartlarının eşit yüksekliği, gözlemevi kubbesi metinle çakışmıyor, altbilgi öncesi şerit boşluğu, hareket düğmesi ikon-only, mobilde iki satırlı kompakt üstbilgi, 2×2 istatistik, tek sütun bento (özgüllük hatası).
- `check_app.cjs` Nobel Chronicle assert'leri eklendi (126 sütun, dossier ödül sahibi sayısı, 1953 → Churchill).

## 8. FAZ-4 uygulandı — sürüm v49

- **`matchRecords(skip)`** (app.js): `filtered()` bunun üzerine kuruldu; `skip` verilen fasetin kendi süzgecini yok sayar (`'year'`, `'availability'`, `'query'` dahil). Canlı sayımların ve boş durum önerilerinin temeli.
- **`site/facets.js`**: ≥1024px sol sticky faset rayı (`#facetRail`). Mevcut `<select>`'ler tek doğruluk kaynağı: ray onları okur, `.value` yazar, `change` tetikler. Disclosure (APG), canlı sayım, 0 sonuç → `disabled`, odak yeniden kurulumda korunur, 60ms debounce (ölçüm: ~26ms/süzgeç değişimi). `<1024`'te ray gizli, `<details>` + `select` aynen.
- **Kart**: mono künye (`catalogNo`: BK/NB/AW + id son 4 hane) + yıl; açıklama 2 satır, başlık 4 satır clamp. **Liste = kayıt defteri** (`ledgerHead`/`ledgerRow`), mobilde kart-satır.
- **Boş durum** (`emptyState` + `facetAlternatives`): aynı fasetin en çok sonuç veren 3 değeri; hiç yoksa "filtreyi kaldır" çipleri (`query` dahil).
- **Okuma yolları**: tek sütun seyir haritası (brass rota + sayaçlı durak düğümleri). Tuzak: `.route-card{overflow:hidden}` düğümleri kırpar → `visible` yapıldı.
- Tuzaklar: `[hidden]` sınıf `display` kuralıyla ezilir (`.facet-body[hidden]` eklendi); `facets.js` `defer` ile yüklenir, `app.js` onu `typeof renderFacetRail` ile çağırır.
- `check_app.cjs`: `matchRecords` skip, künye, defter, boş durum assert'leri.
