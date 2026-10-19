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

## 15. Paket 2 — paylaşılan WebGL sahnesi (Stage) — sürüm v59

- **`site/stage.js`:** tek three.js renderer, sayfadaki sıradan **2D canvas'lara** çizer (sabit tam sayfa canvas yerine): DOM ile kayar, `overflow`/z-sırasına uyar, yazının altında kalır, kaydırmada gecikmez. Tek WebGL bağlamı tüm karolara hizmet eder. Görünür olanlar render edilir (IntersectionObserver); boştakiler 30fps, üzerine gelinen tam hızda; `effects-paused`/reduced-motion'da tek kare (dirty bayrağı).
- **Bento:** 8 alanın her biri canlı çizgi-gravür sahne (atom, DNA, kıta/ark globe, açık kitap + uçuşan sayfalar, kafes + sinyaller, halkalı gezegen, armiller küre, Nobel madalyası); imleçle eğilir, hover'da hızlanır. SVG gravür yedek kalır (`.has-3d` ile soluklaşır).
- **Vitrin:** gerçek 3B kitaplar (kapak dokusu kayıttan canvas'ta çizilir: alan, başlık, yazar; sırt/arka/sayfa dokuları); imleçle eğilir, sürükleyerek çevrilir (atalet), sürükleme sonrası tıklama bastırılır (`click` capture), düz tıklama kaydı açar.
- `Stage` sonraki paketler için (Nobel yıl galaksisi vb.) `register(canvas2d, factory)` API'sidir.

## 16. Paket 3 — Nobel Galaksisi, kayıt uçuşu, UI kalite kapısı — sürüm v60

- **`site/nobel3d.js`:** Nobel bölümüne **Grafik | Galaksi** anahtarı. Galaksi: 1901→bugün tek spiral, her Nobel/ödül kaydı bir yıldız (renk = kategori; ödül sahibi daha büyük), on yıl etiketleri, imleç ipucu (yıl · kategori · başlık), tık → yıl seçimi (`selectNobelYear`, dossier güncellenir, kamera seçili yıla kayar), çift tık → kaydı aç, sürükle = yörünge, Ctrl+tekerlek/düğmeler = zoom. Erişilebilir grafik varsayılan; galaksi isteğe bağlı (`sr-only` not). Kendi WebGL bağlamı (hero + stage + galaksi = 3).
- **Kayıt uçuşu (hero):** yıldıza tık → kamera yıldıza dalar (zoom 3.4 + şok dalgası), 560ms sonra kayıt açılır; kayıt kapanınca (`#recordView[hidden]` MutationObserver) kamera geri çıkar. Dokunmatikte kart dokunuşu aynı yolu kullanır.
- **`tools/ui_audit.py` + CI adımı (yayını bloklar):** 390/768/1024/1440 × açık/koyu: yatay taşma, konsol hatası, **hesaplanmış stillerle** metin kontrastı <3:1 (gradyan üstü metin atlanır; piksel örnekleme `content-visibility`/currentColor nedeniyle güvenilmezdi), hover'da bileşen kontrastı. Yerelde: `BK_CHROMIUM=/opt/pw-browsers/chromium python tools/ui_audit.py`. Bulduğu ve düzeltilen: 1024px'te `.shelf-3d` yatay taşması (`.spotlight-section{overflow-x:clip}`), altbilgi koordinat metni 2.4:1.
- **Bilinçli olarak yapılmayanlar:** GPU renk-seçimi (CPU seçim 2653 yıldız için <1ms/olay; kazanç yok), OffscreenCanvas worker (tek ana iş parçacığı bütçesi yeterli, karmaşıklık fazla). Hero'da `?perf` HUD'u yok.

## 17. Paket 4 (v61) — okuma ilerlemesi ve küçük canlı detaylar

- `progress.js`: açılan kayıtlar `localStorage['bk-read']` içinde tutulur; okuma yollarında adım ✓'i ve rota başına `n/N` halkası, arşiv kartlarında yörünge halkası. Hepsi yerel, ağ yok.
- Üst istatistikler (kitap / Nobel / PDF) gerçek filtre düğmeleridir (`button.stat[data-stat]`).
- Alt bilgi: bölüm haritası + `BUILD vNN` rozeti (`app.js?v=` değerinden okunur; önbellek şüphesinde ilk bakılacak yer).
- `app.js` `withFlip`: kart listesi değişince FLIP animasyonu (reduced-motion'da kapalı).
- Tuzak: `progress.js` hem `sw.js` FILES hem `pages.yml` `node --check` listesinde olmalı.
- Eklenmedi: palet bulanık arama ("bunu mu demek istediniz").

## 18. Paket 5 (v62) — palet bulanık arama

- Sonuç yoksa `palette.js` her bilinmeyen kelimeyi kütüphane sözlüğündeki (yazar/başlık/eylem/alan kelimeleri) en yakın kelimeye çeker (Levenshtein ≤1; 7+ harfte ≤2) ve en üstte "Şunu mu demek istediniz: …?" satırı gösterir; seçilince paleti kapatmadan sorguyu düzeltir.
- Sözlük ilk kullanımda tembel kurulur; normal aramalar etkilenmez (`build` → `build0`, bulanık yol yalnızca boş sonuçta).

## 19. Paketler 6–7 + erişilebilirlik (v63)

- **Kayıt sekmeleri:** `record.js` şablonu `.rv-tabs` (role=tablist) + iki panel: Özet / Atıf ve paylaşım. Ok tuşları, Home/End; `?record=/focus/back` sözleşmesi değişmedi. Atıf düğmesi gizli panelde de DOM'da olduğundan `c` kısayolu çalışır. `[hidden]` display kuralıyla ezilmesin diye `.rv-panel[hidden]{display:none!important}`.
- **Mobil alt gezinme:** `#bottomNav` (≤760px): Keşfet, Katalog, ortada palet, Yollar, Tema; IntersectionObserver ile `aria-current`, klavye açılınca (`visualViewport`) ve kayıt/palet açıkken gizlenir. Body'ye alt boşluk, hareket düğmesi yukarı alındı. Koyu temada büyüteç düğmesi koyu metin (kontrast).
- **Erişilebilirlik:** yeni bileşenlerde `:focus-visible`, `touch-action:pan-y` (3D tuvallerde sayfa kaydırması), reduced-motion'da panel/halka animasyonu kapalı.
- Gerçek cihaz GPU performansı hâlâ ölçülmedi.

## 20. Paket 8 (v64) — canlı 3D takımyıldızı + hero dock

- `constellation3d.js`: kayıt sayfasındaki takımyıldızı three.js ile canlı sahne. DOM düğmeleri (`.rv-node`) erişilebilir/tıklanabilir katman olarak kalır; GL tuvali (`.rv-gl`) arkada derinlikli yıldızlar, bulutsu, parlayan çekirdek, yörünge halkaları, ilişki renkli kenarlar ve akan parçacıklar çizer; her karede düğmelerin `left/top` değeri 3B'den yeniden izdüşürülür (sürükleyince etiketler takip eder; atalet, boşta yumuşak salınım, çift tık sıfırlar, Shift+ok klavye). Koyu: additive ışıma; açık: parşömen üzerine mürekkep (NormalBlending). WebGL yok/reduced-motion → eski SVG.
- Düğümde nokta artık düğmenin merkezi (etiket `position:absolute` altta), böylece halo noktayla hizalı. Yerleşim iki halkaya (138/218) alternatif — etiket çakışması giderildi.
- Hero: alan çipleri cam "dock" içine alındı, spektrum rozeti ayrı satıra; kısa ekranda (≤820px) spektrum gizlenir. Spektrum etiketleri taşmıyordu→ genişlik 300px.

## 21. Paket 9 (v65) — kayıt görünümü mobil taşma

- 390px'te kayıt görünümü 96px yatay taşıyordu (`.rv-art-col` ve `.rv-constellation` aspect-ratio + min-height'tan gelen içsel genişlik, `1fr` izi min-content'e açıktı). Çözüm: `grid-template-columns:minmax(0,1fr)`, `min-width:0`, `width:100%`. Mobilde 3B takımyıldızda etiketler yalnızca dokunulan/odaklanan düğümde görünür.
- `tools/ui_audit.py` artık her genişlikte bir kayıt açıp `#recordView` yatay taşmasını da denetler (CI kapısı).
- Bilinen kozmetik: "Tümü" koleksiyon görünümünde iki "Chemistry" gerçeği (kitaplar `17 - Kimya`, Nobel `02 - Kimya`); koleksiyon seçilince tek görünür. Birleştirmek test sözleşmesini değiştirir, bırakıldı.

## 22. Paket 10 (v66) — kalite yöneticisi, GPU testi

- Bu ortamda fiziksel GPU yok (`/dev/dri` yok); WebGL = SwiftShader (CPU). Ölçüm: hero ~3.8 fps, takımyıldızı ~7 fps — gerçek GPU için temsil edici DEĞİL, ama en kötü durum testi.
- `hero3d.js` yöneticisi zaman tabanlı (≥4 kare ve >1.4 sn pencere) ve 4 kademeli: bloom → çözünürlük → yıldızların %55'i → %30'u. SwiftShader'da hero 3.8 → ~8.3 fps. Hızlı cihazda ilk iki kademe eşiği aynı (26ms), tetiklenmez.

## 23. Paket 11 (v67) — hero dock yer değiştirdi

- Alan çipleri galaksinin üstünden kaldırıldı: yer (mavi) bandında tek, sessiz bir satır (`.hero-fields`, ≥901px). <1600px'te sayaçlar gizlenir (aria-label'de durur). Spektrum rozeti alt-sağda, hareket düğmesinin solunda. ≤820px yükseklikte spektrum gizli, çipler sağa hizalı.

## 24. Paket 12 (v68)

- Arşiv kartı başlığı: halka | başlık (sola) | sayı; EN modda `%100` yerine `100%`. Nobel/rotalar bölümleri gözden geçirildi, ek kusur yok.

## 25. Paket 13 (v69) — içeriğe göre canlı kapaklar

- `visuals.js`: `livingKey(r)` (koleksiyon+kategori → atom, chem, dna, book, peace, econ, math, gear, circuit, neural) ve `livingArt(r)`; `catalogRecordArt` önce bunu dener, yoksa eski statik sanat. Tek yerden kartlar, spotlight, palet önizlemesi ve kayıt sayfası beslenir.
- Hareket saf CSS/SVG: yörünge = `scale(1 .38)` içinde dönen grup; DNA = gecikmeli `scaleX` basamakları; yazı = `pathLength=1` dash; çubuklar `scaleY`. Kartlarda yalnızca hover'da (`animation-play-state`), kayıt kapağında sürekli; reduced-motion/`effects-paused` dondurur. Başlangıç karesi (0%) tam çizilmiş durumdadır (duraklatılmış görünüm boş kalmasın).
- Nobel kapakları (hep `cover-7`) kayıt sayfasında `data-la` ile konuya göre renk tonu alır. Kapsam dışı: tarih/felsefe/sanat/çevre kitapları eski statik sanatta kalır.

## 26. Paket 14 (v70) — bilimsel ek açıklamalı, genişletilmiş kapaklar

- Desen sayısı 10 → 16: graph (felsefe/sosyal bilimler), scales (tarih-siyaset-hukuk), globe (çevre), strata (yer bilimleri), spiral (sanat; altın oran + logaritmik spiral), armillary (bilim tarihi). `livingKey` tüm kitap kategorilerini kapsar.
- Her desende bilimsel ek açıklama: köşe işaretleri (`.la-corner`) ve mono denklem/etiket (`LA_LABEL`: n=1·2·3, C₆H₆·120°, 5′/3′, ΣF=0, φ=1.618, ε=23.4° …). Etiket kontrastı için `.la-t{opacity:1}` (UI denetimi açık zeminli kartta 2.55:1 yakaladı).
- Yörüngeler artık düzeltildi: elektron/uydu, ana grupla aynı süre/gecikmeyle ters dönen iç grup taşır → ebeveyn `scale(1 .38)` altında bile yuvarlak kalır. DNA sarmalı daha geniş/uzun (11 basamak). Kayıt kapağında sanat 300px.

## 27. Paket 15 (v71)

- Katalog kartlarında canlı sanat 150px yüksekliğe çıktı: `.card-illustration:has(.living-art){height:150px}` (ebeveyn sabit 110px yüksekliği etiketi kırpıyordu). Mobilde 126px.
- CI: Pages deploy adımı "in progress deployment" (HTTP 400) hatasında 150 sn ve 240 sn bekleyip yeniden dener (Paket 13-14 yayınları bu yüzden düşmüştü; elle iptal API yolu proxy ile kapalıydı).

## 28. Paket 16 (v72) — hero "enstrüman güvertesi"

- Yer bandındaki çipler + spektrum rozeti tek cam güverteye (`.hero-fields`, ≥901px) birleştirildi: solda canlı okuma paneli (`.deck-read`: alan no, ad, kayıt·dil·yazar sayısı, pay çubuğu, spektrum; çipe hover/odakta güncellenir, ilgili spektrum çizgisi `hot` yanar), sağda 4x2 çip ızgarası. Sayaçlar çiplerde gizli (okuma panelinde).
- Yer düzlemine hafif perspektif ızgara (`.hero-ground`). Mobilde (<=900px) eski yatay şerit; okuma paneli ve ızgara gizli.
- `hero3d.js` `buildLabels` yeniden çağrılırsa spektrum eski panelden alınıp yenisine taşınır.

## 29. Paket 17 (v74) — three.js zemin manzarası, hero sinematik geçişi, seçilemez animasyon yüzeyleri

- `ground3d.js`: hero yer bandı canlı three.js manzarası. Vertex shader yükseklik alanı (3 katmanlı sinüs) + işaretçi dalgaları (6 halkalık ring buffer); fragment shader eş yükselti çizgileri (`fwidth` ile sabit kalınlık), seyrek ölçü ızgarası, galaksinin altında yansıma parıltısı ve kıvılcım noktaları. Koyu: pirinç ışık, açık: mürekkep çizgi. Kendi küçük WebGL bağlamı; hero dışındayken durur; reduced-motion tek kare. `requestIdleCallback` `timeout:1200` ile (yazılım render altında aç kalıyordu).
- `hero3d.js`: UnrealBloom sonrası "grade" ShaderPass (kromatik sapma — zoom/şok/uçuşla artar, işaretçi çevresinde yerçekimi merceği, vinyet, film greni; yalnız koyu tema). Basılı tut (320ms, kıpırdamadan) = tekillik: GPU çekim kuyusu + girdap + mercek; bırakınca şok dalgası + renk sapması patlaması.
- `user-select:none` tüm animasyon yüzeylerinde (hero, takımyıldızı, Nobel, kapaklar, kutucuklar, alt çubuk) + `::selection` şeffaf. İpucu hapı masaüstünde üste taşındı (güverteyle çakışıyordu).

## 30. Paket 18 (v76) — alan işaretçileri galaksinin kollarında, 3B kitap, kaydırmaya bağlı Nobel girişi

- Hero güvertesi kaldırıldı (çok betimleyiciydi, galaksiyle uyumsuzdu). 8 keşif alanı artık galaksinin kendi kollarında dönen parlayan düğümler (`placeMarkers`: tilt/rig matrisleriyle her karede izdüşüm; halka nabzı; hover/odakta etiket belirir, diğer alanlar sönükleşir). Düğüme basınca `flyField`: kamera o kola dalar (zoom 2.5 + renk sapması), 620ms sonra `fieldRun` ve zoom geri. Spektrum rozeti gizli. Eski `.hero-field{transform:none!important}` kuralı kaldırıldı (satır içi transform'u eziyordu).
- Kayıt sayfasında kapak üzerindeki `3D` düğmesi canlı kapağı sürüklenebilir gerçek 3B kitapla (`stage.js` `mountRecord`, `bookScene` yeniden kullanıldı) değiştirir; varsayılan canlı animasyonlu kapak korunur.
- `nobel3d.js`: bölüm görünür olurken galaksi kaydırmaya bağlı yaklaşır ve döner (`se` = smoothstep(scroll)), hero ile süreklilik hissi.

- v77: işaretçi açısı `phase(r)` ile hesaplanır (aynı spiral kolun eğrisi), düğümler gerçek kolların üzerinde durur.

- v78 (mobil): <=900px alan işaretçileri metnin üstünde süzülmez; alt çubuğun üstünde yatay kaydırmalı sessiz bir şeride dönüşür (`transform:none!important` JS satır içi konumu ezer). `.hero-foot` mobilde gizli, hareket düğmesi şeridin üstüne alındı.

## 31. Paket 20 (v79) — gerçekçi 3B kitap ve Nobel madalyası

- `stage.js` `studioEnv`: yumuşak kutulardan PMREM stüdyo ortamı (bir kez, `setScissorTest` geçici kapatılır); folyo, kumaş, clearcoat ve altın gerçek malzeme gibi okunur.
- `bookScene` yeniden yazıldı: bevelli yuvarlak köşeli ExtrudeGeometry kapaklar, kumaş dokusu (bump), altın folyo katmanı (metalnessMap + roughnessMap + bumpMap — başlık, çerçeve, halkalar kabartma/parlak), yuvarlatılmış sırt (yarım silindir) + 4 yükseltili altın bant, sayfa bloğu (ince çizgili kenar dokusu, üst/alt/ön kenar), başlık bantları, dalgalı kırmızı saten şerit ayracı, yumuşak temas gölgesi, tema duyarlı ışık. Kayıt sayfasındaki `3D` düğmesi ve spotlight rafları aynı sahneyi kullanır.
- Nobel kutucuğu: kabartmalı altın madalya (defne çelengi, yıldız, çevresel yazı bump ile), clearcoat, mavi kurdele, halka, orbit eden parıltılar; kutucuk büyütüldü (270px sanat alanı), eski çizgi takımyıldızı gizlendi.
- Performans notu: PBR + 4 raf kitabı yazılım render'da yavaş; gerçek GPU'da ölçülmedi. Yavaşsa `MeshPhysicalMaterial` → `MeshStandardMaterial` (sheen/clearcoat kapat) ilk adaydır.

## 32. Paket 21 (v80) — Nobel Silüeti (three.js), tema uyumlu Nobel bölümü

- `skyline3d.js` (`window.NobelSkyline`): 126 yıl, kategori renkli yığılmış kuleler (InstancedMesh, PMREM stüdyo ortamı), yansıma, on yıl cetvelleri, seçili yıl için ışık huzmesi + rozet. Etkileşim: hover → yıl dökümü (kategori sayıları), tıkla → aynı `selectNobelYear` ile yıl dosyası, lejant çipleri kategori izole eder (Shift/Alt = tek), kuleler yay animasyonuyla yeniden yığılır; sürükle=yörünge, Ctrl/⌘+tekerlek / düğmeler=yakınlaştır, ←/→/Home/End/PgUp/PgDn=yıl gezinme (canvas odaklanabilir, `role=application`). Silüet artık varsayılan görünüm; Grafik ve Galaksi korunur (erişilebilir grafik).
- Tema: `.nobel-chronicle` açık temada parşömen/koyu mürekkep (önceden hep koyu); 3B paneller, lejant, tooltip, kontroller, yıl dosyası başlığı açık temada uyumlu.
- Yazılım render'da `MeshPhysicalMaterial` çok yavaştı → kulelerde `MeshStandardMaterial`, DPR 1.5.

## 33. Paket 22 (v81) — Nobel bölümü tek enstrüman

- Başlık = üç büyük rakam (yıl/kayıt/en yoğun yıl) + görünüm anahtarı; eski meta satırı ve yinelenen lejant gizli. HUD: canlı okuma (hover yılı / seçili yıl, kayıt·ödüllü sayısı, kategori payı çubuğu) + tüm görünümlerde ortak kategori çipleri (`window.NobelFilter`: Silüet, Galaksi ve Grafik aynı anda süzülür; Shift/Alt = izole). Galaksi: kategori attribute + `uOn[7]` uniform, kategori bulutsuları, büyük çekirdek. Silüet: ortalanmış kamera. Üç görünüm aynı sahne çerçevesinde; ondalık seçici tek satır; açık tema uyumlu.

## 34. Paket 23 (v82) — Keşif takımyıldızı v2

- `constellation3d.js` yeniden yazıldı: shader yıldızlar (renk sıcaklığı, kıvılcım), bulutsu sprite'ları, shader tabanlı korona merkez yıldızı (ışınlar, halka, nabız; açık temada ışınsız mürekkep halesi), her kayıt için bantlı gezegen (fresnel atmosfer, hover'da yörünge halkası + uydu), enerji tüpleri (TubeGeometry + akan darbe shader'ı) ve parçacıklar, süzülen toz, sinematik dolly-in, hover odağı (kamera düğüme yaslanır, diğerleri sönükleşir), sürükle-yörünge + atalet. DOM düğmeleri erişilebilir katman olarak kalır.
- Etiketler sakin: tek satır kapsül, hover/odakta açılır (başlık+yazar). Düğmeye basınca sıcak flaş (`.warp`).

- v83: 3B kitap sırt bantları uçlara taşındı (±1.2/±1.3), başlık genişliği H-270; başlık bantlara değmez.

## 35. Paket 24 (v84)

- Galaksi: büyütülmüş/parlatılmış yıldızlar (çekirdek+kenar), arka plan toz diski, on yıl çentikleri, seçili yıl için çekirdekten ışın + yayılan çift halka. Grafik: cam çubuklar (yatay parlaklık gradyanı), hover'da yıl sütunu parlar/yükselir + dikey ışın, seçili yıl nabız atar.
- Takımyıldızı: düğüme tıklayınca capture aşamasında durdurulur, kamera gezegene dalar (600ms) ve ardından gerçek tıklama yeniden gönderilir (`it.go`); reduced-motion'da doğrudan açılır.

- v85: 3B kitap kapağı başlık bloğu `TOP=400..H-150` arasına otomatik sığar (44→22px), yazar başlıkta geçiyorsa basılmaz (Nobel belgelerinde çakışma). Sonraki oturum için `ALT-OTURUM-PROMPTU.md`.

## 36. Paket A (v86) — Canvas metin çakışması sıfırlama
**Neden:** 3B kitap kapağında uzun başlık yazar satırının üstüne biniyordu (v85'te yalnız `paintCover` yamandı); aynı sınıf hata başka canvas'larda da vardı.
**Ne:**
- `site/textfit.js` (yeni, `window.BKText`): `ellipsize`, `wrap` (tek uzun kelimeyi karakterden böler), `fitBlock` (boyut kademesi + satır sınırı + `…`), `fitLine` (önce küçül, sonra kırp), `authorInTitle`, `declutter` (DOM etiket çakışma çözümü).
- Kullanıcılar: `stage.js` `paintCover`, raf `coverTexture` (artık yazar başlıkta geçiyorsa basılmıyor), `spineTexture` (kırpmadan önce küçülür), `record.js` paylaşım kartı (başlık 54→32px kademeli, yazar/katalog satırı kırpılır).
- `constellation3d.js`: her 6. karede ve hover değişiminde etiketler `declutter` ile çözülür (hover > kameraya yakın); kaybeden `visibility:hidden`.
- `tools/text_fit_audit.py`: gerçek boyama fonksiyonlarını (`window.BKStage` test kancası) kayıt yapan bağlamda çalıştırır; en kötü ~60 kayıt × 3 yüzey; güvenli alan taşması ve metin kutusu kesişimi varsa kırmızı. Yerel kapı (CI'da değil). Mutasyonla doğrulandı: `BOT` bozulunca FAIL verir.
**Tuzaklar:** `textfit.js`, `stage.js`'ten ÖNCE yüklenmeli (index.html, sw.js FILES, pages.yml `node --check`). `stage.js` `BKText` yoksa sessizce çıkar. Madalya çevresel yazısı sabit metin (`· NOBEL · ARCHIVE · 1901 – 2026 ·`), dil bağımsız; uzatılırsa yay uzunluğu ölçülmeli. SVG `LA_LABEL` dizeleri sabit ve kısa (≤14 karakter, viewBox 140'ta ~56px), çeviri yok.

## 37. Paket A5 + B (dilim) (v87)
- **A5:** Nobel Silüet ve Galaksi etiketleri her 6. karede `BKText.declutter` ile çözülür (Silüet: 16 etiket, Galaksi: 7; 1440/768 × açık/koyu: 0 çakışma, 0 konsol hatası). Takımyıldızı 3 kayıt × 2 tema: 8/8 etiket, 0 çakışma.
- **B1/B6 (dilim):** `MATS` (stage.js): konu indeksine göre cilt (deri / keten / mat karton), folyo metali (altın / gümüş / bakır), cila. `grainBump` prosedürel ve **deterministik** (tohum = indeks + kayıt) deri benekleri / keten dokuma / karton tanesi üretir; folyo kabartma maskesiyle birleşip `bumpMap` olur (`metalnessMap` hâlâ yalnız maske). Aşınmış kenar (açık rub çizgisi + koyu rim) renk haritasında. Sırt çizgileri ve bantlar folyo rengini izler.
- **B3 (dilim):** şerit ayraç kuyruğu yayılan dalga ile hareket eder (`rp0` taban konumu).
- **Tuzak:** grain boyama ~370k piksel; deri için 24px ızgara ile en yakın nokta araması (düz O(n) çok yavaş). Gerçek GPU/CPU süresi ölçülmedi.
- **Yapılmadı:** B2 (sayfa kıvrımı), B4 (gerçek gölge), B5 (madalya portresi/iridescence), B7 (snap + okuma pozu).

## 38. Paket B tamam (v88)
- **B5 madalya:** `faceMaskOf(k)` altı Nobel yüzü (Fizik atom, Kimya benzen, Tıp Asklepios çubuğu, Edebiyat kalem, Barış güvercin, Ekonomi grafik) + arka yüz; her yüz ayrı `CircleGeometry` bindirmesi (ön `z=+.0815`, arka `-.0815`), silindir kapakları düz altın. Çevresel yazı `arcText`: karakter genişliği ölçülür, yay sığmazsa font küçülür (A2 kapandı). Her ~5.5 sn madalya bir kez 360° döner; yüz tam arkası dönükken değişir. Kurdele ve kenarda `iridescence`. `api.face(k)` test/hata ayıklama için yüz seçer. Güvercin küçük ölçekte zayıf okunuyor.
- **B7 poz makinesi (`bookScene`):** `auto → drag → snap → auto` ve `read`. Bırakınca atalet projeksiyonu ile en yakın yüze (ön / sırt / arka / sayfa kenarı, 90° adım) yaylanır; imleç 2.2 sn ayrılırsa `auto`. Çift tık (yalnız kayıt sayfası, `opts.dbl`) okuma pozu: dik, 1.06× büyük, kapak kapalı. `wrap()` yaw'ı 2π'ye göre normalize eder.
- **B2:** ön kapak `hinge` grubunda; hover'da 12° açılır (okuma/sürüklemede kapalı). Sayfa bloğu `BoxGeometry(...,1,1,8)` ile hafif dışbükey ön kenar (`+.022`), `pageEdge`'e yaprak çizgileri.
- **B4:** `renderer.shadowMap` PCFSoft; yalnız kayıt sayfası kitabı (`real=true`) `DirectionalLight` gölgesi (1024) + `ShadowMaterial` zemin; raf kitapları eski yumuşak lekeyle. Not: `PCFSoftShadowMap` `shadow.radius`'u yok sayar.
- **Tuzak:** `pkill -f` ile kendi kabuğu öldürme (exit 144); `pgrep -f` izleyicileri kendini yakalar.
- Ölçülmedi: gerçek GPU maliyeti (gölge haritası + 7 madalya dokusu), akıcılık.

## 39. Paket 25 (v89) — Nobel Galaksi açık temada okunur
**Şikâyet:** açık temada Galaksi katkılı (additive) karışımla parşömene çizildiği için her şey beyaza yıkanıyordu.
- `nobel3d.js`: `uLight` uniform; açık temada nokta shader'ı opak "mürekkep" yıldız (hafif doygun, `*.8` koyulaştırılmış kategori rengi, keskin çekirdek + zayıf hale), `NormalBlending`. `applyTheme()` her `draw()`te tema değişimini yakalar; tüm katkılı yardımcılar (kılavuz, parıltı sprite'ları, tikler, ışın, halkalar, toz) `themed[]` ile normal karışıma ve koyulaştırılmış renge geçer; merkez `core` parıltısı açık temada gizli. İlk deneme (`1.7` doygunluk) altın Fizik'i kırmızıya kaydırdı; `1.18 / .8` ile efsane çipleriyle eşleşiyor.
- Kadraj: kamera `13.5→15.4` uzaklık, dış halka artık panel üstünde kırpılmıyor (iki temada).
- CSS (Package 25): açık temada Galaksi dekad etiketleri koyu + açık hale.
- `skyline3d.js`: seçili yıl çipi panel içine kelepçelenir (`offsetWidth`); panel kenarında yarım kalan etiketler gizlenir.
- **Tuzak:** katkılı karışım yalnız koyu zeminde çalışır; açık temada her additive nesne ayrıca düşünülmelidir.

## 40. Paket 26 (v90) — Kara delik / yerçekimi merceği opsiyonel
**Şikâyet:** hero'da fare galaksinin üstündeyken (ve basılı tutunca) büyük bir mercek girdabı oluşuyordu.
- `hero3d.js`: `lensOn` (varsayılan **kapalı**, `localStorage 'bk-hero-lens'`). Kapalıyken `uLens=0` ve basılı tutma tekilliği (`wellT`) devre dışı. Açıkken de mercek küçültüldü (`.011/(r²+.014)` → `.008/(r²+.02)`, taban gücü `.3→.22`, tutma `1.5→1.1`).
- Yakınlaştırma dock'una 4. düğme (`.hero-lens-btn`, ◎, `aria-pressed`); i18n `heroLens` (TR/EN).
- Not: fare yaklaşınca parçacıkların hafifçe çekilmesi (`uMouseOn`) etkileşimin parçası olarak kaldı; yalnız mercek ve tekillik opsiyonel.
- Bulgu (yapılmadı): açık temada hero galaksisi çok soluk (katkılı karışım parşömende kayboluyor) — Paket 25'teki Nobel Galaksi düzeltmesi gibi bir "mürekkep" yolu gerekir.

## 41. Paket 27 (v91) — çerçevesiz takımyıldızı, yumuşak geçiş, açık tema hero
- **Çerçevesiz takımyıldızı:** `.rv-constellation` kenarlık / yarıçap / zemin / gölge kaldırıldı (CSS, `!important`); canvas `mask-image` radyal gradyanla kenarlara doğru sayfaya karışır. Canvas boyutu kutuyla aynı kalmalı (renderer `setSize` kutudan okur), bu yüzden büyütme yerine maske kullanıldı.
- **Yumuşak geçiş:** tıklama artık 1250 ms (`DIVE_MS`, `easeIO`): kamera yaya yakın düz hatla gezegene uçar, FOV 38→48 açılır, seçili gezegen büyür, diğerleri/etiketler/tüpler solar; %62'de `#recordSheet.rv-leaving` (opacity transition .5 sn), bitince `finishDive()` tıklamayı kayıt yönlendiricisine geri verir, yeni kayıt yeniden belirir. `finishDive` aynı zamanda `setTimeout(DIVE_MS+450)` ile çalışır: sekme gizli / canvas ekran dışıyken tıklama asılı kalmaz (kayıt sayfasında `IntersectionObserver` boyamayı durdurur). Eski parlama (`rv-warp`) yumuşak `rv-dive-glow`a çevrildi.
- **Açık tema gezegenler:** `planetTexture` ikinci (açık, `lerp(white,.52)`) dokusu; sırt rengi koyu kitaplarda gezegenler siyah top gibiydi. Çekirdek halkası açıkta `.08`.
- **Hero galaksisi açık tema:** fragment shader'da `ink` yolu (doygunluk `1.3`, `*.5`), alfa `x3.2`, nokta boyutu `.95` — pastel katkılı ışık yerine koyu mürekkep tozu.
- **Ölçülemeyen:** gerçek akıcılık (SwiftShader'da kare >1 sn, toplam süre ölçümü anlamsız); yalnızca sıralama (`leave` ≈ 800 ms) doğrulandı.
- Hâlâ çerçeveli: Nobel Silüet/Galaksi panelleri (`.nc-3d`).

## 42. Paket 28 (v92) — Takımyıldızı: prosedürel gezegenler, gerçek aydınlatma, doğal hareket
**Şikâyet:** gezegenlerin hepsi aynı turuncu bantlı top; kutu kenarı hâlâ sezilir; hareket yapay.
- **Gezegen shader'ı (`PLN_F`)**: kayıt (`spine|i|kind` hash) → dört aile: gaz devi (bantlar + fbm türbülans + fırtına lekesi), karasal (okyanus/kıta/kutup buzu, dönen bulut katmanı, gece yüzünde şehir ışıkları, okyanus speküleri), çöl (krater çizgileri), buz (çatlaklar). Renkler kitabın sırt renginden türetilir (`tint`). Merkez yıldızdan **gerçek Lambert** aydınlatma: `uSun` her karede yıldızın görüş uzayı konumu; terminatör, gün/gece, kenarda atmosfer saçılması (terminatörde turuncuya kayar). Kamera uzayında hesap — `uTime` tüm gezegenlerde ortak, `uRot` her gezegende farklı.
- **Halkalar** (`RING_F`): gaz devlerinin 2/3'ü, bantlı/boşluklu, yıldıza göre aydınlık. **Aylar**: her gezegende 1–3, MeshStandard, sürekli dönüşte.
- **Yıldız:** ekran-yatay anamorfik ışık çizgisi (koyu tema); hover'da güçlenir.
- **Fare derinliği:** imleç konumu dünya/gök eksenlerini ±.16/.09 rad yavaşça yaylandırır (`ptrYaw/ptrPitch`); sürüklerken kapalı.
- **Kenar:** `mask-image: radial-gradient(closest-side, #000 48%, transparent)`; önceki elips hâlâ üst kenarı gösteriyordu.
- Gezegen yarıçapı 13→19+, etiket kayması 24 px (CSS `!important` + `declutter` y).
- **Doğrulama:** 3 kayıt × 2 tema, shader derleme hatası yok (console `error/warning` + `pageerror` süzüldü); `ui_audit.py` WebGL günlüklerini yok sayar, shader hatası için ayrı bak.
- **Ölçülemeyen:** gerçek GPU akıcılığı; fbm 5 oktav × 3 çağrı/piksel × 8 gezegen (gezegen küçük ekranda <100 px, ucuz olmalı ama ölçülmedi).

## 43. Paket 29 (v93) — Nobel bölümü çerçevesiz + Paket C (dilim)
**İstek:** Silüet ve Galaksi panelleri "yapmacık" kutular; Paket C'yi ultra premium uygula.
- **Çerçevesiz:** `.nobel-chronicle` (dış kart), `.nc-3d`, `.nc-sky` kenarlık / zemin / yarıçap / gölge kaldırıldı (`!important`, çünkü açık tema kuralları daha özgül); Silüet canvas'ı iki eksenli `mask-composite:intersect` kenar solması, Galaksi canvas'ı `radial-gradient(closest-side,#000 64%,transparent)`. Galaksi kamerası 15.4→17.2 (halkanın üstü kırpılıyordu).
- **C1 Silüet (dilim):** kule yüzlerinde **yanıp sönen pencere ızgarası** (`onBeforeCompile`, dünya konumundan hash'li pencereler, kategori rengiyle) + fresnel kenar ışığı; seçili yıl ışık sütununa **yükselen kıvılcımlar**; hacimde yavaş **toz zerreleri**; hepsi açık temada normal karışım + koyu mürekkep. `reduced-motion`/`effects-paused`'ta durağan.
- **C2:** alt kenarda **yıl kaydırıcı** (`.nc-sky-time`, native `input[type=range]`, klavye eşdeğeri hazır, ödülsüz yıllarda en yakın veri yılına yapışır); seçili yılın **ekran-okuyucu tablosu** (`table.sr-only`).
- **C4 (dilim):** Galaksi'de seçili yılın **ödül sahibi kapsülleri** (`.nc-cap`): yıldızın yanında yaylı belirir, merkezden dışa 34/26 px itilir, `declutter` ile çakışmaz, tıklayınca `openRecord`.
- **Önceden var olan hata düzeltildi:** Silüet tooltip'inde `catName` tanımsızdı (kule üstüne gelince `ReferenceError`); `nobelCatLabel` ile tanımlandı.
- **Test tuzağı:** `#timeline` gibi viewport'tan uzun elemanın ekran görüntüsü canvas'ı parça parça (boş) yakalar; panel elemanını ayrı çek ya da pencereyi yükselt. Kısa wait'te canvas `opacity` geçişinde kalır.
- **Yapılmadı:** C3 karşılaştırma modu, C5 görünümler arası morph, C6 dossier çizgisi, cam (transmission) kule, düzlemsel yansıma.

## 44. Paket 30 (v94) — Paket C'nin kalanı
- **C3 karşılaştırma modu (Silüet):** `⇄ Karşılaştır` düğmesi (veya `C` tuşu): seçili yıl = A, ikinci tıklanan kule = B (`cmpYear`); `aside.nc-cmp` cam kartında iki yılın toplamı, kategori başına çift yönlü çubuk, ▲/▼ farklar, toplam yüzde. Klavye: `Shift+←/→` B'yi gezdirir (`Ctrl` ile on yıl), `Esc` kapatır. B için ikinci ışık sütunu (`beam2`) ve çip. Tooltip'e **Δ önceki on yıl %** (önceki 10 yılın ortalamasına göre) eklendi.
- **C1 kalanı:** `◇ Cam` anahtarı: `MeshPhysicalMaterial` (transmission .62, ior 1.45, clearcoat, iridescence) — varsayılan kapalı (ağır); pencere shader'ı iki malzemede ortak (`windows`). Kule altına **renkli ışık sızıntısı** (`bleed`): her yıl baskın kategori renkleriyle zemine akar, filtre değişince yeniden boyanır. Yansıma, yarım çözünürlüklü gerçek düzlemsel yansıma yerine ayna örnekli (mirrored instance) kalır.
- **C4 kalanı:** Galaksi yıldızlarına difraksiyon çıkıntıları (`vBig`: ödül kayıtları + seçili yıl), seçili yıldan kategori renkli **ışık hüzmeleri** (6 sprite, uzunluk = kayıt sayısı, ekran-uzayı dönüş). Impostor `InstancedMesh` yerine `Points` shader'ı kaldı.
- **C5:** gerçek veri morph'u (tek sahne, aynı öğeler) **yapılmadı**: üç görünüm ayrı render'lar. Yerine geçiş koreografisi: gelen görünüm blur→net + kayma (`.nc-enter`), kamera 1.3× uzaktan yaklaşır (`inst.enter()` / galaksi `zoom*.7`).
- **C6:** `svg.nc-link` — seçili yılın 3B konumundan `.nc-big` (yıl dosyası) başlığına akan kesik çizgi (bezier); çizim animasyonu + akış; yıl değişince yeniden çizilir; `reduced-motion`'da tek kare. **Tuzak:** `IntersectionObserver` geri çağrısında `es[0]` değil son girdi (`es[es.length-1]`) kullanılmalı; yoksa çizgi hiç çizilmedi.
- **C7 kalanı:** Galaksi'de klavye (`←/→`, `Ctrl` = on yıl, `Home/End/PageUp/PageDown`); Silüet'te `Ctrl+←/→` on yıl.

## 45. Paket 31 (v95) — gerçek veri morph'u + kalan C maddeleri
- **C5 gerçek morph:** `nobel3d.js` `morphTo/run`. Her kayıt = bir parçacık (`mrows` = Galaksi'nin `rows`'uyla aynı süzgeç → aynı sıra). Konum sağlayıcıları: **Grafik** → `.nc-year[data-year] .nc-cK` segment dikdörtgeninin içi (seviye `l`/`n`); **Silüet** → `inst.projectRecords(mList,xy)` (yıl×kategori yığınında kayıt başına bir blok, `cur` yükseklikleriyle, süzgeçte gizli kategori soluk); **Galaksi** → `api.projectRecords(xy)`. Akış: kaynak konumları oku → hedef görünümü opaklık 0 ile göster → 4 kare bekle (RO/boyut) → hedef konumları oku → `canvas.nc-morph` 1600 ms: yıla göre dalga gecikmesi (`.3`), `easeInOutCubic`, dik yönde girdap + kalkış, kuyruk çizgisi, `lighter` (koyu) / mürekkep (açık). %55'te hedef görünüm 650 ms'de belirir. `reduced-motion` ve henüz başlatılmamış görünümde eski koreografi.
- **C1 gerçek yansıma:** yansıma, zemin düzlemine göre **tam boy ayna** örnekleri (önceden %50 basık); aynı pencere shader'ı + derinlikle sönme (`exp(y*.62)`). Zemin dokusuna dikey solma: arka kenardaki sert plaka çizgisi gitti.
- **C4 küre impostor:** Galaksi nokta-sprite'larının çekirdeği normal-from-coordinate ile aydınlatılmış küre gibi gölgelenir (+ speküler); difraksiyon çıkıntıları ve hüzmeler v94'ten.
- **Yapılmayan:** morph'ta cam kule/ortam nesneleri (kıvılcım, hüzme) parçacıklara dahil değil; morph sırasında yıl seçimi değişirse konumlar eski kalır.

## 46. Paket 33 (v96) — C kapanışı + Paket D (kamera, gözlemevi, hareket sistemi)
**C kapanışı:** Galaksi yıldızları `InstancedBufferGeometry` billboard'lara taşındı (küre impostor + difraksiyon, nokta-sprite sınırı yok); grafik görünümü çerçevesiz ve 3B sahnelerle **aynı yükseklikte** (görünüm değişince düzen zıplamaz); morph sürerken (`.nc-morphing`) kontroller kilitli.

**D1 — scroll kamera yolu:** `hero3d.js` iki `CatmullRomCurve3` (göz + hedef, `centripetal`) kurar (`buildPath`, `layout`'ta W/H'ye göre). Eğri, sönümlenmiş (`BKMotion.damp`, λ=4.2) ve `ease.smooth`'lanmış scroll ilerlemesiyle örneklenir; zoom/pan/fare paralaksı yolun üstüne biner. Eski `1/(1+scroll*.55)` ölçeği kalktı. `motion.js` scroll'dan `--hero-p` ve `--atlas-in` CSS değişkenlerini yazar (WebGL olmasa da); `#catalog` başlığı/aramayı `translate/scale` ile yaklaştırır (kaydırma yeri bozmaz, reduced-motion'da kapalı).
**D2 — 3B gözlemevi:** `hero3d.js` içinde küçük ortografik sahne (`dome`): gövde + yarık açık yarım küre (`SphereGeometry` phi boşluğu) + sıcak iç yüzey + pirinç kenar halkaları + lamba sprite'ı + inverse-square sıcak nokta ışığı. Konum `effects.js`'in yayınladığı `BKHorizon{ox,oy,w,h}`'den; yarık gökte yavaşça döner, lamba nefes alır. Dome hazır olunca `BKDome.on` → 2B silüet çizilmez (WebGL yoksa 2B yedek aynen çalışır). Kuleyi ridge'in altından kesen 2B tuval üstte kaldığı için kule "tepeye oturur".
**D3 — zemin:** `ground3d.js`: kontur çizgileri keşif-alanı renklerinde (turkuaz/mor/kızıl) yavaş **palet dalgaları** olarak akar; kubbe lambasının **yansıma şeridi** (`uDomeX`, `uLamp`) zemine, çizgilere bölünerek düşer.
**D4 — ortak hareket:** `motion.js` → `BKMotion{ease,damp,spring,quality,tick}`. Hero zoom/pan/eğim `damp` ile (kare hızından bağımsız); Nobel morph ve takımyıldızı dalışı aynı `ease.inOut3`'ü kullanır.
**D5 — kalite katmanı:** hero'nun kare-süresi yöneticisi `degrade` 0–4'ü `BKMotion.quality.set`'e yayınlar; `bk:quality` olayını Silüet, Galaksi, zemin dinler (piksel oranı ×[1,1,.85,.7,.55]); takımyıldızı oluşturulurken seviyeyi okur. `window.__bkPerf` canlı fps/ms.
**D6 — yıldıza dalış:** koyu temada `uBlur/uBlurC` radyal blur (6 örnek) seçilen yıldızdan dışa akar; **hayalet kapak** yıldızın ekran konumunda doğar, okura büyür ve kayıt, view-transition `bk-cover` ile bu kapaktan açılır.
**Yapılmayan / dürüst notlar:** blur yalnızca bloom hattında (açık temada composer yok → yalnızca hayalet kapak). Dome ortografik, galaksi perspektifiyle paralaks yapmaz. Hareket ve gerçek GPU hızı bu konteynerde (SwiftShader) doğrulanamadı; yalnızca durağan kareler görüldü.

## 47. Paket 34 (v98) — doğrulama turu (D ve C kapanışı)
**Yöntem:** `tools/motion_audit.py` (yeni): hero scroll yolu (6 durak), yıldıza dalış, üç Nobel görünümü arası geçiş, iki tema; ayrıca *kontrol eder*: her görünümde tam bir Nobel sahnesi görünür, konsol hatası yok, `--atlas-in` katalog yaklaşırken 0→0,9, dalışta hayalet kapak oluşur ve kayıt açılır. Yazılımsal GL (~2 fps) olduğu için **ölçek/ease ilerlemesi ölçülemez**; yalnızca durum sırası ve DOM doğrulanır.
**Bulunan ve düzeltilen:** (1) kayıt başlığı programatik odak halkası = çerçeve → `#recordTitle:focus{outline:0}`; (2) grafik sahnesi 3B sahnenin 100px altında kalıyordu → şerit yüksekliği sahneye doldurur (500px); (3) kare hızına bağlı yumuşatmalar (`*.12`, `*.18`, `*.006`) `damp`/`dt`'ye çevrildi (constellation, nobel etiketleri) — 144 Hz ekranda 60 Hz ile aynı his; (4) kubbe %40 büyütüldü (56px birim), lamba yansıma şeridi güçlendirildi.
**Bilinçli karar:** hero kalite yöneticisi tek yönlü kalır (geri toparlanma yok) — titreşimli kademe değişimi (flip-flop) kötü; bunun yerine `bk:quality` yalnızca düşürür.
**Doğrulanamayan:** gerçek GPU'da akıcılık, ease eğrisinin hissi, dalış blur'u.

## 48. Paket 35–39 (v99) — B, E, F, G, H, I kalanları
- **B1** kapak: `wearEdges` (kenar/köşe aşınması: renk açılması + roughness↑), folyo `anisotropy .5` (fırçalanmış altın), `smudgeNormal` parmak izi **clearcoat normal** (çok düşük şiddet). **B2** sayfa bloğu: 28×1×8 segment, fore-edge şişkinliği + baş/son kenarlarda dalgalı yer değiştirme (±0.004), hover'da kapak 12° açılır (v88'den). **B3** kurdele: 6 segmentli **verlet zinciri** (yerçekimi kitabın duruşuna göre döner, hızlı yaw kuyruğu savurur), sheen satin.
- **E4** `record.js constellationHtml`: deterministik **yay yerleşimi** (160 adım soğutma; ilişki ağırlığı = merkeze çekim sertliği: yazar > yıl > dil > alan; düğümler birbirini iter). 8 düğümde en yakın iki düğüm ≥157 birim. **E5** derinlik soluklaşması (kameraya uzaklıkla opaklık −%40) + üzerine gelinen/odaklanan gezegen için **detay kartı** (`.rv-pcard`: kapak rengi, başlık, yazar·yıl, "Kaydı aç"); eski genişleyen etiket kompakt pill'e döndü.
- **F1** her atlas karosuna kendi katı/ışıklı nesnesi: cam atom çekirdeği + altın yörünge halkaları, cam DNA tüpleri + altın basamaklar (`InstancedMesh`), cam küre + altın ekvator, altın kafes düğümleri (`InstancedMesh`), ışıklı bantlı gezegen + altın ay, altın armiller halkalar; hepsi **aynı `studioEnv` PMREM'i**. **F2** işaretçiyle kamera paralaksı. **F3** raf kitapları ortak geometriyi (`shared()` önbelleği: pano, sayfa bloğu, sırt) paylaşır. **F4** raf kitabı hover'da öne çıkar (z +.3) ve komşu kartlar ±9px kayar (CSS `translate`).
- **G1** kart kenarında dönen conic ışık (`@property --card-ang`; koyu pirinç / açık bakır). **G2** canlı kapakta derinlik: işaretçiyle `--mx/--my`, ızgara ve çizim zıt yönde kayar. **G3** `empty3d.js`: "sonuç yok" durumunda kutu içinde sönük galaksi (tembel, kendi küçük GL bağlamı, element ile birlikte bırakılır, reduced-motion'da tek kare). **G4** liste görünümünde satıra gelince **gerçek 3B kapak önizlemesi** (tek canvas, sahne önbellekli `sceneFor`).
- **H1** palet: `backdrop-filter` blur + saturate + chroma lekeleri; kayıt önizlemesinde 3B mini kitap (`BKStage.mini`). **H2** kayıt sekmeleri: gelen panel yönüne göre kayarak belirir (WAAPI). **H3** atıf kopyala: altın dalga (CSS), konfeti yok.
- **I1** Esc: önce 3B kitaptan çıkar, sonra kayıttan; Galaksi canvas'ında Esc odağı bırakır. **I2** `tools/reduced_audit.py`. **I3/A6** CI: `text_fit_audit`, `reduced_audit`, `leak_audit` adımları. **I4** `tools/leak_audit.py` + gerçek sızıntı bulundu: kapanan 3B sahneler `dispose` edilmiyordu → `disposeItem` (geometri/materyal/doku; ortak ENV hariç).
- **Bölüm 4/5:** `tools/screen_tour.py` (108 kare), `TARAMA-RAPORU.md` güncel; `ARASTIRMA-3D.md` (kaynak + lisans kontrolü; "Book of Shaders CC BY-NC-SA" iddiası doğrulanamadı).
- **Yapılmayan / sınırlar:** gerçek GPU'da hareket, kurdele fiziği hissi, dalış blur'u görülmedi. `transmission`/DOF/SSR bilerek yok (bkz. ARASTIRMA-3D).

## 49. Paket 40 (v100) — A: sürekli kamera, dönüş uçuşu, kalite toparlanması, atlas dalışı
- **A1 sürekli kamera:** `BKMotion.arrival(el)` (0 = kıvrımın altında, 1 = ekranın ortasında; reduced-motion / durdurulmuşta 1). Atlas nesneleri karoya yaklaşırken kameraya doğru **yaklaşır** (z ×1,5 → ×1) ve opaklık .3 → 1; Silüet kamerası bölüme girerken %42 uzaktan yaklaşır (Galaksi'de scroll'a bağlı dolly zaten vardı). Hero'nun scroll yolu bitince atlas yaklaşmaya başlar: aynı yön, tek sürekli hareket hissi.
- **A2 dönüş uçuşu:** `record.js` kapanırken `bk:record-closing` (kapak dikdörtgeni) yayınlar; yıldızdan doğan kayıtta hero, kapağı **yıldızına geri** uçuran `fly-return` hayaleti çizer (560 ms, ters ease) ve kısa kromatik vurgu verir. Yıldızdan açılmamış kayıtta hayalet yok; reduced-motion'da yok.
- **A3 kalite toparlanması:** governor artık `govern(avg, now)`: yavaş pencerede **hemen** bir kademe düşer; hızlı pencerede (<11,5 ms) **4 ardışık pencere + son değişimden 20 sn** sonra bir kademe geri çıkar; geri çıkışın 15 sn içinde geri alınması durumunda 2 dakika kilit (titreşim yok). Bloom artık `composer`'ı yok etmez, `bloomOff` ile askıya alınır (geri açılabilir).
- **A4 atlas dalışı:** karoya tıklayınca nesnenin kamerası 420 ms içinde yaklaşır (`.diving`), tıklama **sonra** normal akışla gider (tam bir kez). Değiştirici tuşlu tıklama, reduced-motion ve durdurulmuş efektlerde dalış atlanır.
- **Doğrulama:** `tools/feature_audit.py` (CI'da): A1 kamera z 7,85 → 5,24 / opaklık .3 → .999; A2 yıldızdan doğan kayıtta 1, sıradan kayıtta 0 hayalet; A3 yol `[1,2,2,2,2,1,1,1,1,0,1,…,0]` (kilit dahil); A4 `.diving` görünür, filtre dalıştan önce uygulanmaz, sonra tam bir kez.
- **Sınır:** hareketin hissi ve gerçek GPU'da akıcılık bu ortamda görülemedi; testler durum ve değer doğrular.

## 50. Paket 41 (v101) — B: sayfa çevirme, madalya kabartması, kubbede teleskop
- **B5 sayfa çevirme (kayıt sayfası, 3B kitap):** "Kitabı aç" büyük bir **okuma sahnesi** açar (sabit konumlu `.rec-3d`, bulanık perde, `min(1100px,96vw)`); kapak tam 180° döner, iç yüzüne **ön kâğıt** (eşmerkezli desen) döşenir. 3 yaprak sırt ekseninde menteşelenir; dönen yaprak **kıvrılır** (dış kenarı geride kalır) ve yığının üstünden kalkar (z yayı). Sayfa yüzleri **gerçek kayıt verisiyle** 768×1080 doku olarak boyanır (`paintPage`): 1 başlık sayfası, 2 özet, 3 künye, 4 atıf, 5 birlikte okunabilir, 6 kolofon; tüm metin `BKText` ile sığdırılır. Kontroller: Kitabı aç/kapat, ‹ ›, ←/→ tuşları, sayfa yarısına tıklama, Esc (önce kitabı kapatır), perdeye tıklama. Reduced-motion'da animasyonsuz geçer. Yapraklar ilk açılışta kurulur (6 doku ucuz değil).
  - Bulunan ve düzeltilen: `.rv-art-col` kimlik `transform`'u `position:fixed` sahneyi sütuna bağlıyordu (`:has(.book-open)` ile kaldırıldı); ön kâğıt kapağın bevel'inin içinde kalıp görünmüyordu (z = −(T/2+.016)−.004); son sayfada "sonraki" düğmesi devre dışı kalınca odak kaybolup Esc çalışmıyordu (odak taşınır, Esc belge düzeyinde dinlenir).
- **B6 madalya:** yüz artık **yükseklik alanından türetilmiş normal haritası** (`normalFromHeight`, Sobel): güneş ışını zemini, guilloche bandı, 72'lik **yıl cetveli**, her kabartmada yumuşak omuz (`blur` 2 px + 7 px); kenarda 96'lık **çentik (reeding)** normal haritası. Eski düz maske `bumpMap`'i kalktı. Altı yüz (fizik/kimya/tıp/edebiyat/barış/ekonomi) iki temada doğrulandı. (Gerçek bir kişinin portresi çizilmedi: kategori amblemi korunur.)
- **B7 teleskop:** kubbenin kendi çerçevesinde pirinç tüp (bantlar + mavi mercek); yarığın meridyen düzleminde durur (tüp eğimi = yükseklik açısı). Fare üzerindeyken kubbe yarığıyla **fareye döner** (±.42 rad) ve teleskop yükselir/alçalır (.45–1.5 rad); boştayken yavaş gökyüzü taraması.
- **Doğrulama:** `text_fit_audit` artık 6 sayfa yüzü × 60 en kötü kayıt (558 yüzey, 3826 metin satırı) kontrol eder: taşma/çakışma yok. `feature_audit`: B5 (açılış, sahne ortalanmış, 2× ileri = 2. yaprak, geri = 1, 3× daha = 3 ve "sonraki" devre dışı, Esc kapatır), B6 (normal haritalı + çentikli kenar + 6 yüz), B7 (işaretçi konumuna göre `el`/`ry` değişir).
- **CI düzeltmesi (v100'ün deploy hatası):** `feature_audit.py` tarayıcıyı sabit `/opt/pw-browsers/chromium` yolundan başlatıyordu; CI'da bu yol yok → adım 1 sn'de çöktü, v100 yayınlanmadı (canlı site v99'da kaldı). Yol artık `BK_CHROMIUM` yoksa Playwright'ın kendi tarayıcısı; A2/A4 kontrolleri de zamanlama yerine gözlemciyle yapılır.
- **Sınır:** hareket hissi, sayfa çevirmenin akıcılığı ve gerçek GPU'da maliyet bu ortamda görülemedi.

## §51 — v103–v107: kapı, erişilebilirlik, kitap kusurları, GPU dayanıklılığı
- **CI:** `pages.yml` artık `verify` (tüm kapılar, `pull_request` + `push`) ve `deploy` (`needs: verify`, PR'da atlanır) olarak ayrık. Çakışmalı PR'larda GitHub iş akışını başlatmaz; önce main'i dala alın.
- **Kitap:** açık kitap sahnesi büyük (kenar payı), kapak tam yatıkken sol yaprak yığını endpaper'ın önünde (`zl` 0.2985; eskiden sayfanın sırta yakın yarısı gizleniyordu), ayraç kısaltıldı, gölge kitapla taşınır. `feature_audit` B5: sahne kenarına temas eden piksel (0 olmalı) ve kapak tam yatıkken sol sayfa şeridi.
- **Erişilebilirlik:** açık kitabın görünen sayfaları `aria-live` ile `.rv-book-live` içinde metin olarak yansıtılır; EN modunda kayıt verisi değerleri (`label()`) çevrilir.
- **Test kancaları:** `BKHero` ve `__bkPerf` yalnızca `localStorage bk-test=1` ile açılır (audit araçları ekler).
- **GPU dayanıklılığı (stage):** bağlam kaybında son kare korunur, PMREM stüdyo haritası yeniden pişirilir (B8). Kendi kendini denetleme: raf/kayıt kitabı çizimi bozuk görünürse (kapsama < %5 ya da parlaklık < 35) ya da shader derlenemezse sahne kademeli sadeleşir — 1 standart malzeme, 2 Lambert, 3 düz renk, 4 CSS kapağı (B9, hata enjeksiyonuyla). Adrese `?diag` eklenirse köşede seviye, shader hatası sayısı ve GPU adı görünür; `BKStage.diag()` aynı bilgiyi verir.
- **Bağlam kaybı, diğer sahneler:** hero (3D artık sökülmez; kayıpta 2D yedek, dönüşte 3D geri gelir), zemin, takımyıldızı, Nobel galaksisi, silüet (stüdyo haritası yeniden pişirilir), boş durum galaksisi geri gelince yeniden çizer.
- **Bilinen sınır:** orta sırtta yalnızca yazılımsal GL'de sayfa tam düzleşmeden (p≈0.99) görülen ince kesik çizgiler vardı; sayfa tam yatıkken görünmüyor. Ekran görüntüleri artık commit edilmez (`.gitignore`); geçmişteki ~105 MB force push olmadan küçültülemez.

## §52 — v108: aşama R1, ortak GL katmanı (`site/gl.js`, `window.BKGL`)
- **Ne:** `gl.js` index.html'de ilk betik (sw.js `FILES` ve `pages.yml` `node --check` listesinde). `BKGL.watch(canvas,{name,onLost,onRestore})` kod tabanındaki **tek** `webglcontextlost/restored` dinleyicisi ve her zaman `preventDefault` çağırır; hero, stage, ground, constellation, nobel, skyline ve empty bunu kullanır (grep sıfır: `tools/gl_audit.py`). `BKGL.probe(renderer)` GPU adı, doku birimi/boyutu, WebGL2, float/half-float hedef, `KHR_parallel_shader_compile` (önbellekli, kendi bağlamını açmaz). `BKGL.flags` (`stagequality` varsayılan açık; `localStorage bk-flag-<ad>` ya da `BKGL.flags.set`). `BKGL.report(ad, fn|obj)`, `BKGL.diag()` (sahne başına `lost/losses/restores`), tek `?diag` paneli (`pre[data-bkgl-diag]`; stage'in eski kendi paneli kaldırıldı).
- **Kalite katmanı stage'e bağlandı** (`bk:quality`, bayrak kapalıyken eski davranış): seviye ≥ 2 kutu DPR sınırı 1.5 → 1.0; ≥ 3 boşta kutular her 4. karede (15 fps, eskiden 30); 4 yalnız hover/sürükle altındaki kutu canlı, diğerleri değişince bir kez boyanır. `BKStage.diag()` artık `ql`, `dprCap`, `stats{idleFrames,idleRenders,hoverRenders}` verir.
- **Test:** `tools/gl_audit.py` (statik, CI'da) — önce 15 ihlal ve eksik gl.js ile kırıldı, sonra geçti. `feature_audit` **B10** (`--only b10` ile tek başına): DPR oranları (L0 1.5, L2/L3 1.0), boşta çizim oranı (L0 ≈0.5, L3 ≈0.25, L4 0), L4'te yalnız hover'daki kutu canlı, bayrak kapalıyken tam kalite, `?diag` tek panel ve hero/stage/ground/skyline satırları. B8 `BKGL.diag()` ile hero ve stage'in kayıp/dönüşünün sayıldığını ve hiçbir sahnenin "kayıp" kalmadığını da denetler. B10 yazılımsal GL'de kare **hızını** değil render/kare **oranını** ölçer (ms değil).
- **Keşif:** constellation/ground/nobel/skyline/empty yalnızca `restored` dinliyor, `lost` olayını `preventDefault` etmiyordu; spesifikasyona göre bu durumda tarayıcı bağlamı geri vermez. BKGL bunu tek yerde düzeltiyor (gerçek tarayıcıda doğrulanmadı).
- **İstisna:** kayıt sayfasındaki açık kitap (`opts.focus`) her seviyede canlı. İlk uygulamada seviye 4 onu da donduruyordu; yazılımsal GL'de hero yönetici seviyeyi 3–4'e çektiği için kapak hiç açılmadı ve `feature_audit` B5 zaman aşımına düştü (düzeltildi, tam `feature_audit` ve `leak_audit` geçti).
- **Raf kitabı hatası (§2.1) hâlâ açık:** kullanıcı v107'de "gövde yok, yalnız altın bant ve ayraç" görüntüsü gönderdi. Yerelde (koyu/açık tema) üretilemedi. Haritalı malzemelerin çizilmemesini sessizce taklit eden bir deneme farklı bir görüntü verdi (yalnız sayfa bloğu kalıyor) ve kendi kendini denetleme bunu sağlam saydı (kapsama 0.37, parlaklık 247): denetim yalnız kapsama ve ortalama parlaklığa bakıyor, açık renkli sayfa bloğu yetiyor. Gerçek sebep için `?diag` satırı, F12 hataları ve `chrome://gpu` gerekiyor. Olası bir not: eski önbellekten (service worker) eski sürüm yüklenmiş olabilir, doğrulanmadı.
- **Yapılmadı / sınır:** nesne düzeyi `renderer.info`, GPU ms ve `?perf` R2'nin işi. Diğer sahneler (ground, skyline, nobel, constellation) kalite seviyesini zaten dinliyordu; bu aşamada onlara dokunulmadı. Yazılımsal GL'de gerçek kare hızı/his ölçülemez.
- **Deploy:** main koşusu 131 `feature_audit` B10'da düştü (yavaş koşucuda 24 karelik örnek oranı 0.33 verdi, test dalgalanmasıydı, ürün hatası değil); #56 testi en az 80 kare toplayacak şekilde düzeltti. Koşu 133 (`4e3cd9e`) verify + deploy + Deploy adımı yeşil (verify 14 dk 16 sn). Kullanıcı gerçek GPU'da doğruladığını, sorun görmediğini bildirdi; `?diag` satırı/ekran görüntüsü iletilmedi, raf kitabı hatası (§2.1) için bu yeterli bir kanıt değil, ayrıca teyit edilmedi.

## §53 — CI hızlandırma
- `pages.yml`: `verify` tek işi yerine **`static`** (saniyeler: validate_*, `node --check site/*.js`, check_app, gl_audit) ve paralel **`browser`** matrisi (5 iş: ui_audit · text_fit+reduced+leak · feature_audit `--only main` · B9 · B10). `deploy` `needs: [static, browser]`.
- `feature_audit.py --only main|b9|b10` (varsayılan hepsi, yerel kullanım değişmedi). B9 ayrı işleve çıkarıldı.
- Playwright tarayıcı indirmesi `actions/cache@v4` ile önbelleğe alınır (anahtar: Playwright sürümü); sistem kütüphaneleri `install-deps` ile.
- `paths-ignore: docs/**, **/*.md`: yalnız belge değişen PR/push'ta koşu başlamaz (deploy da olmaz; yayınlanan site değişmediği için).
- `concurrency`: PR'da yeni push eski koşuyu iptal eder; main'de iptal yok.
- Ölçüm: önceki `verify` 12–14 dk (UI 3.5 + text/reduced 1.4 + feature_audit 7.4 + leak 2). Beklenen yeni süre en yavaş dilim + kurulum. **Gerçek süre (PR koşusu 12:09–12:13): ~4 dk** (eskiden 12–14 dk). v109 ile matrise 6. iş (B11) eklendi.


## §54 — v109: aşama R2, GPU zamanlaması, `?perf`, shader ısıtma (`site/gl.js`)
- **GPU ms:** `BKGL.gpuTimer(gl|renderer)` — `EXT_disjoint_timer_query_webgl2` (tek sorgu uçuşta, en çok 8 bekleyen, disjoint sonuç atılır; uzantı yoksa `null`). Bayrak `gputime` (varsayılan açık). Hero governor `govern(avg,now,gpuSec)`: pencerede ≥ 8 GPU örneği varsa **GPU ms**'ye bakar (yavaş > 13 ms, seviye ≥ 2'de > 20 ms; hızlı < 5 ms), yoksa eski rAF kuralı (değişmedi). `BKHero.gov.feed(avg,now,gpu)` test kancası.
- **`?perf`** (ya da `BKGL.flags.set('perf',true)`): sağ altta `[data-bkgl-perf]` paneli; son 120 kare için GPU/CPU ms (ort/p95/maks), fps, çizim çağrısı, üçgen (`renderer.info`, `autoReset` kapatılıp kare başında sıfırlanır), program/geometri/doku sayısı, >50 ms kare sayısı, governor kaynağı (gpu|raf), ısıtma durumu, Long Task özeti ve **“kopyala”** düğmesi (`BKGL.perf.lastCopy`). İzlenen sahneler: `hero` (kare başına) ve `stage` (kutu çizimi başına). Adres çubuğu sayfa yüklenince yeniden yazıldığı için `?perf` yalnız yüklemede okunur (ilk uygulamada panel 1 sn sonra kayboluyordu; test yakaladı).
- **Maliyet:** `?perf` kapalıyken kayıt kodu hiç çalışmaz (`BKGL.perf.work === 0`, panel yok). Governor için GPU sorgusu (`gputime`) kapalı değilse GPU zamanlayıcısı olan makinede yine de kare başına bir sorgu açılır; kapatmak için `bk-flag-gputime=0`.
- **Isıtma** (`BKGL.warm(ad,renderer,build,{now,minAt})`, bayrak `warm`): `renderer.compileAsync` yalnız `KHR_parallel_shader_compile` varken (yoksa derleme ana iş parçacığını bloklar → `skipped`; yalnız testler için `warmforce`). Hero sahnesi ve kubbe sahnesi başlangıçta hemen (ilk kareden önce derleme başlasın), **kayıt sayfası kitabı (gölgeli) ve Nobel madalyası ilk 5 sn'den sonra**, boşta (`requestIdleCallback`), adım adım. Isıtılan sahneler `warmHold`'da tutulur (malzeme atılırsa three programı serbest bırakır). Kapsam dışı: bloom/grade geçişlerinin malzemeleri, açık kitabın sayfa yaprakları.
- **Test:** `feature_audit` **B11** (`--only b11`, CI matrisinde 6. iş): `?perf` kapalıyken sıfır maliyet; ilk 5 sn'de >50 ms görev sayısı ısıtma açık/kapalı (2'şer yükleme, en iyisi; fark ≤ 2); ısıtma yolu `warmforce` ile yazılımsal GL'de de çalıştırılır (hero + stage `done`, program ≥ 3); varsayılanda uzantı yoksa `skipped`; `?perf` açıkken ≥ 20 hero karesi akar, draws/tris/programs/cpu/fps > 0, panel metni, “kopyala” → pano; GPU zamanlayıcı sahte bağlamla (sonuç, disjoint atma, uzantı yok → null) ve governorun GPU'yu rAF'tan önce okuması. Önce test yazıldı: `BKGL.perf` yokken kırıldı.
- **Bu ortamda görülen:** bu Chromium (SwiftShader) `EXT_disjoint_timer_query_webgl2` sunuyor ama `KHR_parallel_shader_compile` sunmuyor; GPU ms değerleri yüzlerce ms (anlamsız, yazılımsal). Gerçek GPU'da zamanlama ve paralel derleme **gözlenmedi**.
- **Hata düzeltmesi (kullanıcı raporu, koyu mod):** belirli açılarda galaksi yıldızları kayboluyor (arka plan siyah, işaretçiler/kubbe/zemin kalıyor). Yazılımsal GL'de yeniden üretilemedi (pitch ±0.5, yaw, ölçek denendi; ama yazılımsal GL'de governor hemen bloom'u kapatıyor, bloom yolu hiç çizilmedi). Şüphe: kenardan/yakından bakışta toplamsal noktalar birkaç pikselde üst üste binip yarım duyarlıklı hedefi Inf'e taşır, bloom bulanıklığı Inf'i NaN yapıp galaksiyi siler. Savunmacı düzeltme: `RenderPass`'ten sonra, bloom'dan önce NaN→0 ve `min(c,48)` süzgeci (ShaderPass). **Gerçek GPU'da doğrulanmadı.**
- **Gerçek GPU doğrulaması (kullanıcı):** `https://mustafaras.github.io/bilim-kutuphanesi/?perf` → ~20 sn sayfayı kaydır ve galaksiyi sürükleyerek eğ/yakınlaştır → panelde “kopyala” → çıktıyı yapıştır. Ayrıca koyu modda galaksiyi önceki hatalı açılara getir (ekranda yıldızlar duruyor mu).

## §55 — v110: atlas kartlarının açık tema yüzü + R3 (kısmi)
- **Atlas kartları, açık tema** (kullanıcı isteği): koyu kartlar aynen kaldı; açık temada her kart kendi alan renginin soluk yıkaması + mürekkep metin (`style.css` Package 44). 3D nesneler açık kartta toplamsal ışıkla görünmez olduğundan `atlasTheme()` onları **mürekkep gravürüne** çevirir: çizgiler normal karışımda kart mürekkebi renginde, her çizgi 1.2 px aralıkla üç kez çizilir (WebGL çizgisi 1 px), soluk katı parçalar mürekkep konturu alır, noktalar büyür, soluk altın parçalar (armillary halkaları) koyu bronza döner. İlk açık-tema sürümü “belli belirsiz” bulundu (çizgiler soluktu, hareket zayıftı); ikinci sürümde yukarıdakiler ve **ortak stüdyo hareketi** (`enhance()`, iki temada da): süzülme, yavaş sallanma, nefes alan ölçek, imleçte yükselme + yakınlaşma, nesne yükseldikçe sıkılaşan yumuşak temas gölgesi.
- **R3:** `?still=1` (`BKGL.still`): tohumlu `Math.random`, `effects-paused` (effects.js'in geri almasını engeller), kutular dt=0, kutu başlangıç fazı sabit. `tools/visual_audit.py`: yüzeyler (hero, atlas, raf, zaman çizelgesi, kayıt kitabı kapalı + 3 açılım) 1440×900 ve 1024×768, koyu+açık; kararlılık (iki yükleme, < %0,1), bilinen hata enjeksiyonu (gizli atlas tuvali %6–21, raf CSS yedeğe düşünce %88 fark → kapı görüyor), altın karşılaştırma (yoksa söyler; `--update`). Yerelde `--quick` kararlılığı **geçmedi**: hero kararlı oldu (effects.js düzeltmesinden sonra), raf/atlas/kitap hâlâ kutu animasyon fazı ve yapışkan üst çubuk yüzünden %3–20 farklıydı; son düzeltmeler (sabit faz, çubuk gizleme) yerelde yeniden denenmedi. Bu yüzden CI işi `continue-on-error`. İlk sürümde `browser` matrisindeydi ve `deploy` onu da bekledi (koşu 139'da görsel iş ~6 dk+ sürdü, deploy gecikti); v110'dan sonra ayrı `visual` işi (`--quick`: 1440×900 koyu, iki çekim), `deploy` onu **beklemez**. Kararlılık kanıtlanınca engelleyici yapılacak; altın görüntüler CI artifact'ı `visual-candidates`'ten commit edilecek.
- **Yapılmadı:** Nobel galaksi/silüet/takımyıldızı yüzeyleri (timeline hariç), madalya ayrı yüzey, 1024×768 yerelde koşulmadı, altın görüntü yok.

## §56 — (çözüldü, bkz. §57) Devir: v110 canlıya çıkamadı, B9 çözülmedi
**Durum.** Canlıda **v109** (koşu 137, deploy yeşil). `main` = `11ae2d3` (v110 kodu + CI düzeni) ama **deploy edilmedi**: `Broken GPU fallback (B9)` CI'da kırmızı olduğu için `deploy` işi hiç başlamıyor (koşu 139 ve 142 kırmızı; PR koşularından biri kırmızı, yeniden koşusu ve #60 koşusu yeşil). Yani sorun deploy adımı değil, B9 kapısı.
**B9 (kök neden bilinmiyor).** CI imzası: ilk ya da ikinci senaryoda `{'lvl': 1, 'cards': 4, 'cover': [None×4]}` (150 sn sonra seviye 1'de, kapak istatistiği hiç üretilmemiş). Yerelde 4/4 geçiyor. İşe yaramayan denemeler: (1) “yavaş runner” varsayımı, (2) `effects-paused` ile 70 yerine 2 çizim (PR koşusu yeşil, main koşusu 142 kırmızı).
Hipotezler (hiçbiri kanıtlanmadı): (a) v110 `stage.js` değişiklikleri — `atlasTheme()` / `enhance()` / `still` kontrolü; `mountAtlas` 8 atlas sahnesini B9'da da kurar ve `applySafe` → `simplify` bunlara `lighter()` uygular (temas gölgesi `MeshBasicMaterial`, çizgi/nokta malzemeleri `MeshStandard`'a çevrilir); render sırasında oluşan bir istisna `tick` döngüsünü öldürür (`raf` yeniden kurulmaz) ve kapaklar hiç çizilmez; (b) `selfCheck` duraklatılmış modda 2 çizim ister ama çizim yalnız `dirty` iken olur → `rn` 1'de takılabilir (`applySafe` `dirty`'yi bir kez işaretler); (c) CI hızı.
**Sonraki adım (öneri).** 1) B9'a tanı çıktısı ekle: her 10 sn `BKStage.diag()` + `stats` + konsol hataları (`pageerror`) yazdır; CI'da bir koşu al. 2) `enhance()` ve `atlasTheme()` çağrılarını bayrakla kapatıp B9'u CI'da dene (v109→v110 farkını ikiye böl). 3) `tick` içine `try/catch` koy (bir kutudaki istisna tüm döngüyü öldürmesin) — bu tek başına gerçek bir sağlamlaştırma. Geçici seçenek (**yapılmadı**, kullanıcı kararı): B9'u engelleyici olmaktan çıkarıp v110'u yayımlamak; kapıyı zayıflatmak olur.
**v110'da neler var (canlıya çıkınca).** Atlas kartlarının açık tema yüzü + mürekkep gravürü 3D + stüdyo hareketi (§55), R3 kısmi (`?still=1`, `tools/visual_audit.py`), `visual` ayrı ve engellemeyen CI işi. Açık tema kartları **gerçek tarayıcıda hiç görülmedi**; kullanıcı ilk sürümleri “belli belirsiz, light ile uyumsuz” buldu, ikinci sürümü (kalın çizgi, kontur, gölge, hareket) yalnız yazılımsal GL ekran görüntüsüyle gördüm.
**Açık işler.** R2 gerçek GPU doğrulaması (`?perf` “kopyala”); koyu mod galaksi kaybolması (bloom öncesi NaN süzgeci, gerçek GPU'da doğrulanmadı); `visual` işi kırmızı (kararlılık %3–20, altın görüntü yok); R3 kalanı; sonra R4.
**Çalışma dersleri.** Yerelde birden çok yazılımsal GL koşusunu aynı anda başlatma (birbirini yavaşlatır, sahte kırmızı üretir); beklerken `send_later`; CI'daki bir kırmızıyı “flake” demeden önce imzasını logdan oku.

## §57 — v110–v115 canlıda; B9 kök neden; R3 kapandı
- **Canlı:** v113 (koşu 148), v115 (koşu 153; v114 ara sürümdü: koşu 151 B9 yüzünden deploy olmadı) deploy yeşil. Altın görüntü PR'ı (#68) main'de (`89b58f6`).
- **B9 kök neden** (v111'de eklenen tanı çıktısıyla görüldü): `{'lvl': 1, 'cards': 4, 'cover': [None×4], 'diag': {'esc': ['shader error -> level 1'], idleRenders ~100/150 sn}}`. Kırık shader'larla her çizim çok yavaş (CI'da ~0,6 fps). Seviye 1 (standart malzeme) de aynı `#define STANDARD` ile kırık; bir sonraki adım `selfCheck`'in “kutu başına 70 çizim” şartına bağlıydı → runner hızına bağlı yarış (yerelde geçiyor, CI'da çoğu koşuda geçmiyordu). Başarısız denemeler: `effects-paused` (effects.js geri alıyor), v113'ün “6 sn sonra yeni shader hatası” kuralı (seviye 1'in hatası değişiklikten hemen sonra bir kez geliyor, kural hiç tetiklenmiyor). **Çözüm (v115):** bir shader hatası görüldüyse `selfCheck` 70 yerine 6 çizimle pikseli kontrol eder. Ayrıca v111: `tick` içinde her kutunun çizimi try/catch (bir istisna döngüyü öldürmesin; `BKStage.diag().renderErrors/lastError`).
- **R3 tamam:** `?still=1` (`BKGL.still`; tohumlu `Math.random`, `BKGL.reseed(n)`, effects.js duraklatma, kutu dt=0 / sabit faz, zemin ve silüet sabit saat, kayıt kitabı tek büyük adımla hedefe oturur, kitap kayışı durur, takımyıldızı ve Nobel galaksisi sabit saat). `tools/visual_audit.py`: hero, atlas (+madalya), raf, zaman çizelgesi, Nobel galaksi, takımyıldızı, kitap kapalı + 3 açılım × 1440×900 / 1024×768 × koyu / açık. Kararlılık sınırı %0,1 (takımyıldızı %2, Nobel galaksi %1: rastgele yıldız/etiket düzeni), altın sınırı %0,5 (gevşekler %3 / %2). Hata enjeksiyonu: gizli atlas tuvali %4,8, CSS'e düşen raf %88 fark → kapı görüyor. CI: `visual` dört paralel iş (~3,5 dk), `deploy` onu bekler ve **engelleyicidir**. Altın görüntüleri yenileme: `Update visual goldens` (workflow_dispatch) → `goldens/update` dalı → PR → incele → merge.
- **Süre:** PR koşusu ~4–5 dk (en yavaş iş: Features ~3,5 dk, görsel işler ~3,5 dk).
- **Açık/doğrulanmamış:** R2'nin gerçek GPU çıktısı (`?perf` “kopyala”) gelmedi. Koyu mod galaksi kaybolma düzeltmesi (bloom öncesi NaN/Inf süzgeci) yalnızca kullanıcının “sorun yok” bildirimiyle; neden doğrulanmadı. Bu ortamda yazılımsal GL `KHR_parallel_shader_compile` sunmadığı için ısıtma yolu `warmforce` ile test edildi.
- **Sıradaki:** R4 (ortak malzeme ve ışık kitaplığı, `BKMaterials`, tek PMREM). Her görsel değişiklikten sonra altın görüntüleri bilinçli olarak yenile.

## §58 — v116: aşama R4, ortak malzeme ve ışık kitaplığı (`site/materials.js`, `window.BKMaterials`)
- **Ne:** `materials.js` (index.html'de `gl.js`'ten sonra, sw.js `FILES`; `pages.yml` zaten `site/*.js` glob'u ile `node --check` yapar). (1) `foil/cloth/glass/brass` (MeshPhysical) ve `paper` (MeshStandard) fabrikaları: `BKMaterials.glass(THREE,{...})`; varsayılanlar yalnız ortak olanı tutar, her çağrı farkı kendisi yazar → malzemeler eskisiyle aynı değerlerde. (2) `env(renderer,THREE,preset)`: stüdyo ışığı (yumuşak kutular → PMREM), renderer + preset başına **bir** pişirme, önbellekli; `rebake()` bağlam kaybında yeniden pişirir, `swapEnv()` sahneleri taşır. Presetler `book` (stage) ve `city` (skyline) eski kutu/sigma değerlerini aynen korur. (3) `tone(renderer)`: ton eşleme + pozlama tek yerde; `bk:flag` ve `data-theme` değişince yeniden uygulanır. (4) `lighter(THREE,mt,level)` + `LEVELS` (`full/standard/lambert/basic`): stage.js'teki `lighter()` buraya taşındı.
- **Bayraklar (`BKGL.flags`):** `matlib` (varsayılan açık; kapalıyken tüm fabrikalar düz standart seviyeyi döndürür — kill switch), `acestone` (varsayılan **kapalı**).
- **Bilinçli sapmalar (dürüst not):**
  - “ACES + tema başına pozlama”: kodda kuruldu (koyu 1.10, açık 0.95; gerçek ekranda ayarlanmadı) ama **varsayılan kapalı**; çünkü bugünkü sahneler `NoToneMapping` ile çiziliyor ve ACES R3 altınlarını değiştirirdi. Açmak ayrı, bilinçli bir görsel iştir (altınları yenile).
  - “Tek PMREM”: bir PMREM yalnız kendi GL bağlamında geçerlidir; stage ve skyline ayrı `WebGLRenderer`'dır, doku paylaşamaz. Tek olan **pişirme kodu** (`PMREMGenerator` grep sayısı 2 → 1) ve renderer başına önbellek; skyline kendi `city` presetini korur (birebir görsel için).
  - Skyline'ın `MeshPhysicalMaterial` (cam kule) ve onBeforeCompile'lı `MeshStandardMaterial`'ları ile stage'deki altın `MeshStandardMaterial`'lar bu aşamada fabrikaya taşınmadı (kabul yalnız stage.js'teki Physical sayısını ister; özel shader'lı olanlar R5–R8'de).
- **Test (önce yazıldı, kırıldığı görüldü):** `tools/materials_audit.py` (statik, CI `static`): stage.js Physical ≤ 3 (önce 12), tek `PMREMGenerator` (önce 2), ton eşleme yalnız materials.js'te, `lighter` stage'de yok, yükleme sırası/sw/sürüm. `feature_audit --only b12` (yeni CI işi): bakes = renderer/preset çiftleri (kopya pişirme yok), varsayılan ton `NoToneMapping`/1, `acestone` → ACES(4) + tema başına farklı pozlama + kapatınca geri dönüş, fabrika türleri, seviyeler (physical/standard/lambert/basic), `matlib=0` → standart. B8'e ek: bağlam kaybı sonrası `BKMaterials.diag().rebakes ≥ 1` ve bakes toplamı tutarlı.
- **Doğrulanmayan:** gerçek GPU; canlı site. Görsel birebirlik yerelde değil, CI `visual` işlerinde (40 PNG) sınanır.
- **Sıradaki:** R5–R9 (kullanıcı önceliği). R2'nin gerçek GPU `?perf` çıktısı hâlâ gelmedi.


## §59 — v117: aşama R5 alt adım 1–2 (sayfa bükülmesi, kâğıt)
- **Ne:** (1) `stage.js`: dönen yaprak, yay uzunluğu korunarak dikey silindir etrafında bükülür (`leafAt`/`leafCurv`, işaretli eğrilik; uç açısı p=.25'te ≈0.61 rad, eski parabol ≈0.13); ön/arka yüz bükülmüş normal boyunca ±1,2 mm ayrık (kalınlık 2,4 mm; üst üste yüzler kalktı). Yaprak geometrisi yalnız p değişince güncellenir. Bayrak `pagebend` (kapalı = eski parabol, birebir). (2) `materials.js`: `BKMaterials.leaf` (lif normal haritası + `onBeforeCompile` ile diğer yüzün mürekkebinin soluk sızması) ve `fiberHeight` (tohumlu, 2 oktav, döşenebilir); stage.js `normalFromHeight` ile normal haritaya çevirir (paylaşılan tek doku). Yapraklar `receiveShadow`; gölgeyi yalnız kalkıkken (0,02<p<0,98) atar (dururken yapraklar birbirinden birkaç bin birim, tek gölge pikselinden küçük). Bayrak `paperfiber` (kapalı = düz kâğıt).
- **Seviyeler:** gölge zaten yalnız seviye 0'da (`shadowMap` seviye ≥1'de kapalı); `lighter()` seviye ≥1'de normal harita ve sızma gölgelendiricisini düşürür. Not: istemdeki "≥ seviye 1'de sayfa gölgeleri" ifadesini bu şekilde yorumladım.
- **Testler (önce yazıldı, kırıldı):** `feature_audit` B5 eki (`pageShape`: uç açı ≥0,3, yay uzunluğu ±%0,3, kalınlık 1,5–4 mm, `pagebend=0` eski; `book.bounds()`: ara karelerde sayfa köşeleri ≤0,985; `book.leaves()`: lif/sızma/alma, seviye 2'de kapalı), B12 eki (`leaf`, `paperfiber=0`), `materials_audit` (leaf/fiberHeight, satır içi sayfa malzemesi yok).
- **Bilinçli sapma:** R3 açık kitap altınları güncellenir (yalnız `book-open-*`). Kenar şeritleri (sayfa ucu kalınlığı geometrisi) yapılmadı; kalınlık yüzey ayrımıdır. Alt adım 3–5 sonraki oturum.
- **Doğrulanmayan:** gerçek GPU (akıcılık, kâğıt hissi, `?perf` açık kitap ≤ 6 ms); R2'nin gerçek GPU çıktısı hâlâ gelmedi ve R4/R5 gerçek GPU'da bakılmadı.


## §60 — v118: aşama R5 alt adım 3 (yaldız kenarlar, başlık bandı)
- **Ne:** `BKMaterials.gilt` (kapağın yaldız rengiyle metalik `foil`; bayrak `gilt` kapalıyken `o.plain` kâğıt kenarı) ve `BKMaterials.edgeHeight` (yaprak başına tohumlu çıta/oluk yükseklik alanı; `stage.js` `normalFromHeight` ile normal haritaya çevirir, `edgeNormal` önbellekli). Kayıt kitabında (`real`) ön kenar, baş ve kuyruk yaldızlı; başlık bandı 12 mm dışa bükülen `TubeGeometry` (ölçülen sapma ≈ 10 mm) ve bükümlü kumaş şeritli doku. Raf kitapları ve `gilt=0` eski görüntüyle aynı.
- **Seviyeler:** seviye ≥1'de `lighter()` kenar normal haritasını düşürür (ölçüldü: seviye 2'de `normal:false`).
- **Testler (önce yazıldı, kırıldı):** B5 `BKStage.book.edges()`, B12 `gilt`/`edgeHeight`, `materials_audit` (TubeGeometry, API).
- **Bilinçli sapma:** yalnız kayıt kitabı görüntüleri (`book-closed`, `book-open-*`) değişebilir. Kapak kabartmasının yükseklik haritasından normal haritaya taşınması yapılmadı (raf kapakları da etkilenirdi). Alt adım 4–5 sonraki oturum.
- **Doğrulanmayan:** gerçek GPU (kâğıt/yaldız görünümü, `?perf` açık kitap ≤ 6 ms). Kullanıcının canlı ekran görüntüsünde sağ sayfa yamuk göründü; kullanıcı "sorun yok" dedi, kapatıldı, kök neden araştırılmadı.
