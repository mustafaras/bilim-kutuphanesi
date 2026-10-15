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

## 9. FAZ-5 uygulandı — sürüm v50

- **Diyalog kaldırıldı** → `#recordView` tam sayfa düğüm görünümü (SPA; `?record=` pushState/popstate, Escape, odak dönüşü, scroll kilidi + inert aynen). Yeni dosya `site/record.js`; `discovery.js` yalnız vitrin rafına indi (kapak için `window.recordCover`).
- **Tuzak: çift kilit** — `lockPage()` yalnız ilk açılışta (`!wasOpen`) çağrılmalı; düğüm gezinmesinde tekrar çağrılırsa `previousOverflow='hidden'` kaydedilir ve kapanışta kilit geri döner.
- **Tuzak: sahte DOM'da `item.closest` yok** — delege klikte koruma `!item.closest||item.closest('#recordView')` şeklinde olmalı; `view.hidden` mock'ta `undefined`, açık durum testi `hidden===false`.
- **check_app.cjs eklentileri**: context'e `window:{addEventListener(){}}` + `history.pushState`; el() mock'una `select(){}`; record.js discovery'den ÖNCE çalıştırılmalı (raf `window.recordCover` kullanır); assert'ler `el('recordSheet').innerHTML` üzerinden (içerik artık innerHTML string).
- **Takımyıldız**: SVG dekoratif (çizgiler `pathLength="1"` + rv-draw), düğümler gerçek `<button>` (SVG içinde değil, % konumlu HTML), erişilebilir liste eşdeğeri `.rv-neighbors`. Hesap mantığı `renderRelated` ile birebir (adet 3→8).
- **Alıntı + paylaşım kartı**: `t('citeTemplate')` TR/EN şablon; kart 1200×630 PNG tamamen istemcide (`canvas`, `toBlob`), çevrimdışı.
- **OG**: `site/og/default.png` commit'li (37 KB); `tools/og_cards.py --all` opsiyonel (repo 10 MB disiplini için CI ÜRETMEZ; `.gitignore` `site/og/*.png` + `!default.png`). og:title/description/url JS ile canlı güncellenir.
- **View Transition**: kaynak karta inline `view-transition-name:bk-cover`, mutate içinde yeni kapak aynı adı alır; root geçişleri CSS'te kapatıldı; `effects-paused`/reduced-motion'da morph atlanır.
- `pages.yml` artık `record.js` + `facets.js` de kontrol eder; `validate_i18n.py` ve `validate_site.py` record.js'i tarar.

## 10. FAZ-6 devri — komut paleti (v51)

- `site/palette.js` IIFE; API'yi yalnızca `window.` üzerinden dışa açar (openPalette/closePalette/paletteIsOpen/shortcutsIsOpen/paletteQuery/paletteResults/palettePick). app.js/record.js de `window.openPalette` üzerinden bağlanır — vm testlerinde ham tanımlayıcı çözümlenemez.
- ⌘K sahibi artık palette.js (aç/kapat toggle). app.js yalnızca preventDefault + palet yoksa arama kutusuna odak yedeği. `/` aynen aramaya odak.
- Kayıt kısayolları record.js'te: j/k, kök kaydı da içeren takımyıldız halkasında döner (travelList=[current,...related]); s favori düğmesini basar, c `copyText(citation())` çağırır — düğme delegation'ına değil doğrudan fonksiyona bağlanır (sahte DOM'da #recordCiteCopy'nin kendi click handler'ı yok).
- Sahte DOM: `el()` artık `removeAttribute` içeriyor; palet klavye turları `documentEvents` keydown döngüsüyle test ediliyor (üç handler'da da güvenli).
- Sürüm v51; sw FILES'ta `palette.js?v=51`; validate_site dosya listesi + `$()` taraması + validate_i18n t() taraması palette.js'i kapsıyor.

## 10. FAZ-6 v2 + Hero 3D — sürüm v54

- **Hero 3D (`site/hero3d.js`, yeni):** three.js r160 **depoya gömülü** (`site/vendor/three.module.min.js`, ~670KB / ~167KB gzip; çalışma anında dış istek yok). `load` + boşta dinamik `import()`; WebGL yoksa/bağlam kaybolursa 2D sahne (`effects.js`) fallback. Sahne: diferansiyel dönen spiral galaksi (30k nokta), Bohr yörüngeleri + elektronlar, veri takımyıldızı (8 alan, parlaklık = kayıt sayısı, kenarda sinyal darbeleri), DNA sarmalı, girişim dalga şeridi, 3 derinlikli yıldız alanı, meteorlar, Balmer spektrum HUD'u (DOM). `.hero-scene.hero-gl` iken `effects.js` yıldız/bant/takımyıldız/meteoru çizmez (ufuk, kubbe, atmosfer 2D'de kalır). Kalite yöneticisi: ilk 90 karede yavaşsa DPR 1 + %60 galaksi. `effects-paused` ve reduced-motion'da tek statik kare. **ADR notu:** plan Canvas 2D diyordu; kullanıcı isteğiyle three.js kabul edildi (JS bütçesi aşıldı, lazy yükleniyor).
- **Palet v2 (`palette.js` yeniden yazıldı):** iki panel (liste + canlı önizleme), kapsam çipleri ve önekler (`>` eylem, `#` yol, `~` alan, `@` yazar; Alt+←/→ döngü), son kullanılanlar (`bk-palette-recent`), kayan seçim merceği, koyu enstrüman yüzeyi (iki temada), SVG simgeler. API aynı (`openPalette`, `paletteQuery`…).
- **Düzeltmeler:** alıntıda ham `nobel` yerine koleksiyon etiketi; rota araması `path/yol/okuma` eş anlamlıları; "1 record" tekili.
- Tuzak: `effects.js` sabitleri (`cx,cy,radius`) 2D bloğunun dışına alındı (blok `glOn()` ile atlanıyor, sonraki kod kullanıyor).

## 11. Record Galaxy + tema denetimi — sürüm v55

- **Hero artık veri:** `hero3d.js` 2653 kaydın her birini gerçek yıldız olarak çizer (8 kol = 8 keşif alanı, renk = kart omurgası). Yıldıza gel → künye/başlık/yazar ipucu, tıkla → kayıt sayfası; alan etiketi (gerçek `<button>`, `aria-label`) → kolu aydınlatır, tıkla → o alanın katalog süzgeci. Sürükle = yörünge (atalet). Karanlık = ışıklı toplamalı karışım; **açık = parşömen üstü mürekkep yıldız atlası** (aynı veri, `uLight`, normal karışım). `.hero-scene.hero-gl` iken `effects.js` yıldız/bant çizmez; ufuk/kubbe tema duyarlı.
- **Tuzak 1:** `--scene-*` değişkenleri yalnız hero'da değil (kayıt sayfası takımyıldızı `--scene-0..2` kullanır) → açık tema hero geçersiz kılmaları `:root[data-theme=light] .hero{…}` ile **kapsamlandı**; kökte yeniden tanımlamak kayıt takımyıldızını beyazlatmıştı.
- **Tuzak 2:** shader'da `uPick` varsayılanı −1 iken toz parçacıkların `aI=-1` değeri "seçili" sayılıyordu → varsayılan −99.
- **Tema denetimi:** koyu temada kayıt sayfasındaki `.related-source` hover'da sabit açık zemine (`#ede9df`) geçip metni görünmez yapıyordu → `var(--raised)/--hover-warm`. Katalog numaraları (omurga renkleri) iki temada AA'ya çekildi. Denetim betiği: her etkileşimli öğe üstünde fare → metin rengi ile ekran görüntüsünden örneklenen zemin kontrastı (yanlış pozitif: `color-mix()` renklerini ayrıştıramaz; kayıt sayfası açıkken alttaki sayfa taranmamalı).

## 12. Hero v3 — yayılan galaksi, bloom, zoom — sürüm v56

- **Teknikler (araştırma):** log-spiral parçacık diski + köke bağlı diferansiyel dönüş (vertex shader), spiral'e bükülmüş **FBM nebula düzlemi**, toz şeritleri, HII düğümleri, halo, parlak yıldızlarda kırınım kolları, **gerçek UnrealBloomPass** (karanlık tema; canvas `mix-blend-mode:screen`, çünkü bloom opak siyah zemin üretir), GPU imleç çekimi + tık şok dalgası, imlece zoom + pan, açılış uçuşu ve scroll'a bağlı geri çekilme.
- **Zoom:** `+ − ⌂` düğmeleri, Ctrl/⌘+tekerlek, çift tık (odakla/sıfırla); tekerlek yalnız galakside tıklanıp "engaged" olunca sayfa kaydırmasını yakalar. Sayfa kaydırması korunur.
- **Vendor:** `vendor/jsm/postprocessing|shaders` (EffectComposer, RenderPass, UnrealBloomPass + bağımlılıkları) ve `index.html`'de **import map** (`three` → `./vendor/three.module.min.js`). Addon yüklenemezse bloomsuz çizim.
- **Kalite yöneticisi:** ilk 90 karede yavaşsa önce bloom kapanır, sonra DPR 1.
- **Tuzak:** açılış animasyonu duvar saatine bağlı (dt tavanı `.05` düşük fps'te animasyonu uzatıp "sönük yıldız" gösteriyordu).

## 13. Hero v4 + kaydırma/banner denetimi — sürüm v57

- **Galaksi doğal hâle getirildi:** eşit olmayan kollar (güçler/uzunluklar farklı), çatal, yıldız oluşum kümeleri, açıya bağlı dış kenar, **bükülmüş dış disk** (`.022·r²·sin(açı)` shader'da, diferansiyel dönüşle hareket eder), cüce eşlik galaksi + **gelgit köprüsü**, FBM nebula kenarı/asimetrisi aynı eğim yasasıyla (`phase(r)`). Mükemmel elips = diyagram; kırılma bunu bozar.
- **Zoom kolay ve kaydırmayı tuzağa düşürmez:** Ctrl/pinch her zaman zoom; sayfa en üstteyken tekerlek ↑ yakınlaştırır, tekerlek ↓ önce uzaklaştırır, sıfırlanınca sayfa kayar; başka her yerde sayfa kayar. `+ − ⌂`, çift tık. Nokta boyutu yumuşak diz ile sınırlı (yakında dev disk olmasın). `interactive()` artık tüm `.hero-copy` kutusunu değil yalnız gerçek metin öğelerini engeller (başlık satırları galaksi üstüne taşıyordu).
- **Kaydırma:** `.facet-rail` `overscroll-behavior:contain` (tekerleği hapsediyordu) → `auto`; ekran yüksekliği <900'de ray statik. `scrollbar-gutter:stable`, ince temalı kaydırma çubukları, hero'da `touch-action:pan-y`.
- **Banner:** kayıt sayfası gökyüzü bandı 150px; başlık sütunu bandın altından başlar (başlık koyu metin koyu bant üstünde kalıyordu). Spektrum HUD'una kendi zemini verildi.
- Denetim notu: tam sayfa piksel örnekleyici `<details>` kapalı içerik ve `color-mix()` renklerinde yanlış pozitif verir.

## 14. Paket 1 (hızlı kazanımlar) — sürüm v58

- **Keşif takımyıldızı v2** (`record.js` `constellationHtml`/`relation`): bağ türleri anlamlı — aynı yazar (pirinç, kalın), yakın yıl ≤2 (mor), aynı dil (turkuaz), aynı alan (kesikli); kalınlık/opaklık = güç; efsane (`.rv-legend`); okunur etiketler (başlık 2 satır + yazar·yıl, AA kontrast), alan renginde düğmeler, süzülme animasyonu, imleçle paralaks, hover'da diğer bağlar kısılır.
- **Hero:** 8 alan artık her zaman görünen gerçek düğme çubuğu (`.hero-fields`, dönen etiketlerin yerine); dokunmatikte ilk dokunuş önizler, karta dokunmak açar; iki parmak sıkıştırma zoom'u; mobilde galaksi metnin altına.
- **Koyu temada beyaz kartlar:** `.route-body li a{background:#fffefa}` sabit renkti (açık kart + açık başlık). Token'a bağlandı, koyu temaya özel gradyan/hover. Sabit açık arka plan taraması: başka eşleşme yok.
- **Tipografi:** 8–10px mono etiketler 11px'e çıkarıldı.
- **CI:** `validate_site.py` artık `sw.js FILES` kapsamını denetler (her üst düzey `.js`, `vendor/**.js`, `fonts/*.woff2`).
