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
