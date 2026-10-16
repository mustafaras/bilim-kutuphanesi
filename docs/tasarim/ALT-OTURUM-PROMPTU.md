# ALT OTURUM PROMPTU — "Bilim Kütüphanem": Top-Tier Premium three.js Geçişi

> Bu dosya, yeni bir Claude Code oturumuna **olduğu gibi yapıştırılacak** görev tanımıdır.
> Uzunluğu bilinçlidir: oturum bağlamı sıfırdan başlar, aşağıdaki her bölüm bir hatadan veya bir kullanıcı şikâyetinden doğmuştur.
> Önce BÖLÜM 0–3'ü oku, sonra taramaya (BÖLÜM 4) geç, sonra araştırmaya (BÖLÜM 5), sonra uygulamaya (BÖLÜM 6–9).

---

## BÖLÜM 0 — Kim, ne, neden

Sen "Bilim Kütüphanem" (https://mustafaras.github.io/bilim-kutuphanesi/) sitesinin tasarım/mühendislik ortağısın.
Site: vanilla JS + CSS, GitHub Pages, **çalışma anında dış istek yok** (yalnızca kendi dosyaları), 2.653 kayıtlık katalog
(kitaplar + Nobel belgeleri + ödül kayıtları), TR/EN, açık/koyu tema, Service Worker, three.js r160 (vendored).

Kullanıcı (Türkçe konuşur, kısa ve yüksek talepli yazar) şunu istiyor:

1. Sitenin **her** yerinde "ultra premium / world-class / top-tier" bir his: hareket, ışık, malzeme, tipografi, etkileşim.
2. three.js'in **tam potansiyeli**: shader, PBR, post-processing, instancing, GPU parçacık, hesaplama dostu hileler.
3. **Metin çakışması, kırpılma, üst üste binme, dağınık başlık** gibi hataların sıfırlanması (örnek aşağıda).
4. Açık ve koyu tema **eşit kalite**; hover'da metin okunurluğu asla bozulmamalı.
5. Her adımdan sonra **commit → push → PR → merge → deploy** (kullanıcının kalıcı talimatı; ayrıntı BÖLÜM 11).
6. Dürüst raporlama: görmediğin şeyi "gördüm" deme; GPU yoksa söyle.

### 0.1 Tetikleyici hata (bu oturumu doğuran ekran görüntüsü)

Kayıt sayfasındaki `3D` düğmesiyle açılan gerçekçi kitabın ön kapağında, uzun başlıklı bir Nobel belgesinde
(`John F. Enders; Thomas H. Weller; Frederick C. Robbins - Nobel Konferansı (ortak metin / tek belge)`)
**başlık satırları yazar satırının üstüne biniyordu**: başlık 5 satıra kadar büyüyor (y=430+i·54 → 646),
yazar ise sabit y=H−100=620'ye çiziliyordu. Ayrıca Nobel belgelerinde başlık zaten yazar adlarını taşıdığı için yazar ikinci kez basılıyordu.

Bu düzeltme `site/stage.js` `paintCover` içinde **yapıldı** (v85): başlık bloğu `TOP=400 … BOT=H−150` arasına
otomatik sığdırılıyor (44→22px kademeli ölçek, satır sınırı, `…`), yazar başlıkta geçiyorsa basılmıyor, yazar kırpılıyor.
**Ders:** canvas'a metin çizen *her* yer aynı sınıf hatayı taşıyor olabilir (BÖLÜM 4.3'te tam liste istenir).

---

## BÖLÜM 1 — Çalışma kuralları (pazarlık dışı)

### 1.1 Depo ve dal
- Repo: `mustafaras/bilim-kutuphanesi`. Çalışma dalı: `claude/friendly-pascal-994fmf` (talimat bunu verir; başka dala push etme).
- Her iş: dalda commit → `git push -u origin claude/friendly-pascal-994fmf` → `mcp__github__create_pull_request` (base `main`)
  → `mcp__github__merge_pull_request` (`merge`) → Actions'ta "Publish library" çalışmasını doğrula.
- **`gh` CLI yok**, GitHub MCP araçları var (`mcp__github__*`). Yoksa `ToolSearch` ile yükle.
- PR gövdesi sonuna şu satırlar: `🤖 Generated with [Claude Code](https://claude.com/claude-code)` ve oturum URL'si.
- Commit mesajı sonuna oturumun istediği `Co-Authored-By` / `Claude-Session` satırları.
- Yeni PR açmadan önce bir önceki yayının bitmesini bekle: Pages "in progress deployment" (HTTP 400) hatası verebilir.
  `pages.yml` artık 150 sn + 240 sn bekleyip yeniden dener (≈9 dk). Birleşmeleri art arda yığma.
- Bir PR birleştiyse yeni işi **aynı dalda** sürdür ama dal main'e göre geride kalmışsa `git fetch origin main && git merge origin/main`.
- `pkill -f …` komutunu kabuk komutunun içinde kendi arama dizenle eşleşecek şekilde **kullanma** (kabuğu öldürür, exit 144).
  Sunucuyu `(python3 -m http.server 8664 --directory site >/dev/null 2>&1 &)` ile başlat; ölürse yeniden başlat.

### 1.2 Sürüm disiplini (en sık unutulan şey)
Her kullanıcıya görünen değişiklikte **hepsini birden** artır:
1. `site/index.html` içindeki tüm `?v=NN` değerleri (css + her `<script>`),
2. `site/sw.js` içindeki `CACHE='bilim-kutuphane-vNN'` ve `FILES` listesindeki `?v=NN` değerleri,
3. yeni dosya eklediysen `sw.js` `FILES` listesine ekle (yoksa `validate_site.py` kırmızı olur),
4. yeni `.js` eklediysen `.github/workflows/pages.yml` içindeki `node --check` listesine ekle.
Komut: `sed -i 's/?v=OLD/?v=NEW/g; s/bilim-kutuphane-vOLD/bilim-kutuphane-vNEW/' site/index.html site/sw.js`.
Altbilgide `BUILD vNN` rozeti var (`progress.js`, `app.js?v=` değerinden okur) — kullanıcı eski önbelleği görüyorsa ilk bakılacak yer.

### 1.3 Doğrulama komutları (her commit öncesi, sırayla)
```
for f in site/*.js; do node --check $f || echo BAD $f; done
python3 tools/validate_site.py
python3 tools/validate_i18n.py
node tools/check_app.cjs
node tools/check_app.cjs --missing-art
BK_CHROMIUM=/opt/pw-browsers/chromium python3 tools/ui_audit.py
```
`ui_audit.py` 390/768/1024/1440 × açık/koyu: yatay taşma, konsol hatası, **hesaplanmış stilden kontrast < 3:1**, hover kontrastı,
kayıt görünümü yatay taşması. Hepsi yeşil olmadan commit yok. CI aynı adımları çalıştırır ve **yayını bloklar**.

### 1.4 Yerel görsel doğrulama (zorunlu)
- Sunucu: `python3 -m http.server 8664 --directory site`.
- Playwright + `/opt/pw-browsers/chromium`; WebGL için bayraklar: `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`.
- URL'ye her seferinde rastgele `?devcache=<x>` ekle, `service_workers='block'` kullan.
- `page.wait_for_selector('#cards .card')` bazen yazılım render'ında asılır → `wait_for_function("document.querySelectorAll('#cards .card').length>0", timeout=60000)` kullan.
- Ağır sahnelerde ekran görüntüsü timeout'a düşer → `screenshot(timeout=90000)`, bağlamları işi bitince `context.close()` ile kapat (iki GL bağlamı CPU'yu boğar).
- Bu ortamda **GPU yok** (`/dev/dri` yok): WebGL = SwiftShader (CPU). FPS ölçümleri gerçek GPU'yu temsil etmez; "gerçek cihazda ölçülmedi" diye açıkça yaz.
- Ekran görüntülerini `/tmp/claude-0/.../scratchpad/` altına yaz, `Read` ile bak. **Her görsel değişikliği hem açık hem koyu temada** gör.

### 1.5 Dil ve ton
Kullanıcıya Türkçe, kısa, somut yaz. Başlıkları ve madde işaretlerini ölçülü kullan. "Mükemmel/kusursuz" deme; ne gördüğünü ve neyi göremediğini söyle.
Emoji yok. Pronoun: kullanıcıdan söz ederken cinsiyet varsayma.

---

## BÖLÜM 2 — Mimari özeti (neyin nerede olduğunu bil)

### 2.1 Dosya haritası (site/)
| Dosya | Rol |
|---|---|
| `index.html` | İskelet, importmap (`three` → `./vendor/three.module.min.js`), script sırası, footer, `#recordView`, `#paletteOverlay` |
| `style.css` | Tek dosya; **"son blok kazanır"** — yeni kurallar sona eklenir (`/* Package NN */` başlıklarıyla) |
| `app.js` | Katalog, filtreler, kartlar, rotalar, Nobel şeridi, `render()`, `records` dizisi, `DISCOVERY`, `nobelIndex`, `selectNobelYear` |
| `i18n.js` / `i18n-data.js` | TR/EN sözlük (`UI.tr/UI.en`), `t(key)`; `validate_i18n.py` parite ve anahtar çözümlemesini denetler |
| `visuals.js` | `SUBJECT_ART`, **canlı kapaklar** (`livingKey`, `LIVING_SVG`, `livingArt`) |
| `effects.js` | 2B gözlemevi sahnesi (yıldız bandı, yatay çizgi), `glOn()` WebGL hero varken kapatır |
| `hero3d.js` | Ana sayfa galaksisi: özel point shader'ları, UnrealBloom + "grade" ShaderPass (kromatik sapma, mercek, vinyet, gren), kalite yöneticisi, alan işaretçileri, tekillik (basılı tut) |
| `ground3d.js` | Hero yer bandı: yükselti çizgili arazi (vertex yükseklik alanı + fragment `fwidth` çizgileri), işaretçi dalgaları |
| `stage.js` | Ortak WebGL sahnesi: 8 atlas karosu, **gerçekçi 3B kitap (`bookScene`)**, Nobel madalyası, `studioEnv` (PMREM), raf kitapları, kayıt sayfası `3D` düğmesi |
| `nobel3d.js` | Nobel bölümü kabuğu: başlık rakamları, HUD (canlı okuma + ortak kategori çipleri `window.NobelFilter`), görünüm anahtarı, **Galaksi** görünümü |
| `skyline3d.js` | Nobel **Silüet** görünümü (InstancedMesh kuleler, yansıma, ışın, klavye ile yıl gezinme) |
| `constellation3d.js` | Kayıt sayfası "Keşif takımyıldızı" v2: shader yıldız, korona, bantlı gezegen, enerji tüpleri, dalış animasyonu |
| `record.js` | Kayıt sayfası (FAZ-5), sekmeler (Özet / Atıf), `constellationHtml`, `window.openRecord/closeRecord/recordCurrent` |
| `palette.js` | Komut paleti (FAZ-6), bulanık arama ("Şunu mu demek istediniz") |
| `progress.js` | Okuma ilerlemesi, halkalar, istatistik düğmeleri, alt gezinme, BUILD rozeti |
| `facets.js`, `discovery.js` | Faset rayı, keşif bölümü |
| `sw.js` | Ağ-öncelikli Service Worker; `FILES` listesi `validate_site.py` ile eşleşmeli |
| `vendor/three.module.min.js` + `vendor/jsm/{postprocessing,shaders}` | r160, **yalnız** EffectComposer/RenderPass/UnrealBloomPass/ShaderPass/MaskPass/Pass/CopyShader/LuminosityHighPassShader |

### 2.2 Çalışma-zamanı sözleşmeleri
- `?record=<id>` URL sözleşmesi, `focus`/`back` davranışı **bozulmaz**.
- `window.recordCurrent()` açık kaydı döndürür; `window.openRecord(id)` kaydı açar.
- `window.NobelFilter.on[0..6]` kategori süzgeci; değişince `document` üzerinde `nobel:filter` olayı.
- `document` olayları: `library:ready`, `library:language`, `nobel:hover` (detail=yıl), `nobel:filter`.
- Tüm WebGL bağlamları **tembel** yüklenir (`import('./vendor/three.module.min.js')`), `IntersectionObserver` ile ekran dışında durur,
  `prefers-reduced-motion` ve `.effects-paused` altında statik kare çizer. **Bu kalıbı koru.**
- Tek paylaşılan renderer (`stage.js`) kutucuk/raf/kitap için; her ağır sahne kendi bağlamını açabilir ama **aynı anda 3'ten fazla canlı bağlam olmasın**.

### 2.3 Tuzaklar (acı deneyimle öğrenildi)
1. **`[hidden]` display kuralıyla ezilir.** `.x[hidden]{display:none!important}` yaz.
2. **`.empty` global `grid-column` tuzağı**; kendi sınıfın başka ada sahip olsun.
3. **Sticky + `overflow` + `contain`** sayfa kaydırmasını kilitler; `overscroll-behavior:contain` yalnız gerçekten gerektiğinde.
4. **JS satır içi `style.transform` CSS'teki `transform:none!important` ile ezilir** (hero alan işaretçileri bu yüzden sol üstte yığılmıştı).
5. **`scene.traverse` dispose** haritaları (`map`) da `dispose` etmeli (sızıntı).
6. **Test kabuğu (`tools/check_app.cjs`) sahte DOM'dur**: `matchMedia`, `rAF`, `classList`, `setProperty` yok → `typeof … === 'function'` ile koru.
7. **`MeshPhysicalMaterial` + sheen/clearcoat yazılım render'ında çok yavaş**; sürü hâlinde (4+ raf kitabı) hafif malzeme düşün, ama gerçek GPU'da ölç.
8. **PMREM üretirken `renderer.setScissorTest(false)`** gerekir (paylaşılan renderer scissor kullanıyor), sonra geri aç.
9. **Pages dağıtımı** art arda birleşmede çakışır (bkz. 1.1).
10. **Hesaplanmış kontrast**: gradyan üstü metin atlanır; yeni metni sade zemine koy ya da denetimin görebileceği bir zemin ver.
11. **CSS "son blok kazanır"** — eski bir kural `!important` ile yenisini ezebilir; çakışma görürsen `grep -n` ile bul, eskisini düzelt.
12. **`user-select:none`** animasyon yüzeylerinde zorunlu (kullanıcı kopyalama işaretlerinden şikâyet etti); yeni sahnede de ekle.
13. **Canvas 2B metin**: `fillText` taşmayı/kırpmayı bilmez — **her** metin için ölç (`measureText`), sığdır, kırp, çakışmayı hesapla.

---

## BÖLÜM 3 — Kullanıcının bu projedeki tüm geri bildirim geçmişi (tekrarlama!)

Bunların her biri bir kez canlıda kötü göründü. Aynı hatayı yeniden yapma.

1. Ana sayfa hero alanı "çirkin, eliptik, yapay": gerçek, yayılan, doğal bir galaksi istedi → özel spiral shader'ı yapıldı.
2. Kolay zoom yok / kaydırma sorunları → Ctrl+tekerlek, pinch, çift tık, sayfa kaydırmasını **asla** tuzağa düşürme.
3. Koyu modda beyaz kartlar / hover'da okunmayan metin → token tabanlı renk, hover kontrastı CI kapısı.
4. Kayıt sayfası başlık/banner renk çakışması → `rv-sky` yüksekliği ve sütun ofseti.
5. Takımyıldızı (kayıt sayfası) "karmaşık/çirkin" → v2, sakin etiketler (hover'da açılır).
6. Hero alt bandında alan çipleri + spektrum rozeti "dağınık" → galaksi kollarında yaşayan işaretçiler (panel yok).
7. Animasyonlu yüzeylerde seçilebilir metin işaretleri → `user-select:none`.
8. Nobel kartı = **"Nobel yılları" bölümü** (madalyalı kart değil!): başlık dağınık, "Chart ve Galaksi çok çirkin" → tek enstrüman: üç rakam + canlı okuma + ortak çipler.
9. Kitap kartlarının içeriğe göre animasyonu → 16 bilimsel desen + denklem etiketleri.
10. 3B kitap "çok daha detaylı, gerçekçi" → PBR, folyo, yuvarlak sırt, sayfa kenarı, şerit ayraç.
11. **(Şimdi)** 3B kitap kapağında metin çakışması → düzeltildi; aynı sınıf hatayı her yerde ara.

Kullanıcı **istemediği** şeyler: mobil odaklı çalışma (şu an web uygulaması önceliği), performans bütçesi/mobil ölçüm maddeleri (ayrıca belirtmedikçe).
Kullanıcının tonu: büyük harf, ünlem = "bu gerçekten kötü, kökten çöz". Yarım çözüm ("sadece kamerayı düzelttim") kabul etmedi.

---

## BÖLÜM 4 — ZORUNLU ÖNCE: Uygulamayı kapsamlı tara

Kod yazmadan önce **envanter ve kusur raporu** çıkar (`docs/tasarim/TARAMA-RAPORU.md`, TR). Rapor şunları içermeli.

### 4.1 Ekran turu (her ekran × 2 tema × 3 genişlik: 1440, 1100, 768)
Sırayla: Hero (üstte, kaydırılmış) → Keşif alanı (atlas) → Kitap rafı (spotlight) → Nobel yılları (Silüet, Grafik, Galaksi) →
Katalog (kart/liste, boş durum, faset rayı) → Okuma yolları (açık/kapalı) → Arşivler → Altbilgi →
Kayıt sayfası (Özet sekmesi, Atıf sekmesi, `3D` düğmesi açık/kapalı, takımyıldızı, ilgili kaynaklar) → Komut paleti (boş, sonuçlu, bulanık öneri, kapsamlar) → Kısayol haritası.
Her ekran için bir ekran görüntüsü al ve **görsel kusurları** madde madde yaz: çakışma, kırpılma, hizasızlık, düşük kontrast,
boş alan dengesizliği, dar/ince metin, kopuk tipografi ölçeği, tutarsız köşe yarıçapı, gölge dili.

### 4.2 Kontrast ve hover taraması
`tools/ui_audit.py` çıktısı dışında **elle** hover test et: kartlar, atlas karoları, rota adımları, Nobel çipleri, palet satırları, kitap düğmeleri.
Koyu temada açık zemin sızıntısı, açık temada beyaz-üstü-beyaz metin ara.

### 4.3 Canvas/shader metin envanteri (çakışma sınıfı hataların kaynağı)
`grep -n "fillText\|measureText\|createElement('canvas')" site/*.js` — **her** canvas metin çizimini listele ve her biri için şunu doldur:

| Konum | Ne çiziyor | Maksimum uzunluk | Ölçüyor mu? | Taşarsa ne olur | Çözüm |
|---|---|---|---|---|---|
Zorunlu kontrol edilecekler:
- `stage.js` `paintCover` (düzeltildi — sınırları doğrula), `spineTexture` (sırt başlığı: `H-270` sınırı; çok kısa başlıkta ve çok uzun yazarda dene),
  `backTexture`, madalya yüzü (`faceMask` yazısı: harf harf yay üzerine; uzun metin eklenirse taşar),
- `visuals.js` canlı kapak `LA_LABEL` etiketleri (`<text>` SVG, `text-anchor:middle`; EN/TR uzunluk farkı),
- `hero3d.js` işaretçi etiketleri (DOM), `nobel3d.js`/`skyline3d.js` etiketleri (DOM, `translate`),
- `record.js` `constellationHtml` düğüm etiketleri (uzun başlık, uzun yazar, RTL olmayan ama çok uzun tek kelime).
Test verisi: en uzun başlıkları ve yazarları bul (`python3` ile `site/data/catalog.json`'dan `len(title)` sırala),
`;` ile ayrılmış 3+ yazarlı Nobel belgelerini, tek kelimelik çok uzun başlıkları, Türkçe `İ ı Ş Ğ` içerenleri, EN'de çevrilmiş başlıkları dene.

### 4.4 Etkileşim taraması
Klavye turu (Tab sırası, odak halkası görünürlüğü, Escape ile çıkış, ok tuşları), fare (hover/odak/aktif), dokunma (yalnız ana akışlar),
`prefers-reduced-motion` (tüm WebGL durmalı, işlev eşdeğer), `effects-paused` düğmesi.

### 4.5 Performans ve sızıntı taraması (GPU yoksa dahi yapılabilenler)
- Canlı WebGL bağlamı sayısı (`document.querySelectorAll('canvas')` + `getContext` çağrıları) farklı ekranlarda kaç tane?
- Kayıt sayfasını 20 kez aç/kapat: bağlam ve bellek sızıyor mu (`WEBGL_lose_context`, `renderer.dispose`)?
- `scene.traverse` dispose'ları; `CanvasTexture` sızıntıları.
- JS gzip ~138 KB, CSS ~38 KB: büyüklük raporu; üç boyutlu dosyaların tembel yükleme sırası.

Raporun sonunda **öncelik tablosu**: etki (1–5) × çaba (1–5) × risk (1–5).

---

## BÖLÜM 5 — Webden etkileyici three.js tekniklerini araştır (ve uygula)

`WebSearch` (mode: extended) ile **yalnızca MIT/Apache/CC-BY/serbest** kaynaklardan teknik topla; kod kopyalama, **fikri** ve algoritmayı al.
Çalışma-zamanı dış istek yasak → her şeyi `site/vendor/` altına yerel koy veya kendi yaz. Her araştırma notunu `docs/tasarim/ARASTIRMA-3D.md` içine
(kaynak URL, teknik adı, neden uygun, maliyet tahmini, bu projede nereye) yaz. Aşağıdaki başlıkları **ara ve değerlendir**:

### 5.1 Işık ve malzeme
- Image-based lighting: PMREM zaten var; **RoomEnvironment** benzeri daha gerçekçi stüdyo, HDRI yerine prosedürel gökyüzü.
- `MeshPhysicalMaterial`: `transmission` + `thickness` + `ior` + `attenuationColor` (cam kule/madalya vitrini), `iridescence` (sabun köpüğü film efekti),
  `anisotropy` (fırçalanmış metal), `clearcoat` + `clearcoatNormalMap` (cilalı deri kitap kapağı).
- Prosedürel normal/bump: deri gren, kumaş dokuması, kâğıt lif dokusu (canvas ile üret, `bumpMap`/`normalMap`).
- Kontak gölgesi: `ShadowMaterial` + `PCFSoftShadowMap` veya "baked blur shadow" (şu an elle çizilmiş radial) → gerçek yumuşak gölge, **ucuz** yolu seç.
- Ekran-uzayı yansıma (SSR) yerine **düzlemsel yansıma** (`Reflector` benzeri, yarım çözünürlük) — Silüet zemini için.
- Alan derinliği (Bokeh/DOF) post-pass: yalnız sinematik anlarda (dalış animasyonu) kısa süreli aç.
- God-rays / volumetric light (ışın) — hero'da gözlemevi kubbesinden gelen ışık huzmesi, düşük çözünürlük + blur.

### 5.2 Parçacık ve veri-görselleştirme
- GPGPU parçacık (FBO ping-pong, `WebGLRenderTarget` float) — hero galaksisi şimdi vertex-shader'da analitik; **gerçek N-body benzeri çekim** için 64k parçacık dene (kalite yöneticisiyle).
- Instancing: Silüet kuleleri `InstancedMesh`; **Nobel Galaksi'yi** de `InstancedMesh` + özel `onBeforeCompile` ile küre-impostor'a çevirmeyi değerlendir (şu an `Points`).
- Curl-noise akış alanı: takımyıldızı tozu, ground3d kıvılcımları.
- SDF tipografi: 3B sahnede keskin metin için `troika-three-text` fikri (MSDF atlas'ı **önceden üret, vendora koy**), DOM etiket yerine GL etiket yalnız gerçekten gerekirse.
- Çizgi: `Line2/LineMaterial` (kalın, kalınlığı piksel sabit) — Nobel spirali, tüpler yerine ucuz alternatif; `fwidth` ile anti-alias.
- Sıralı/derinlik doğru şeffaflık: `renderOrder`, `depthWrite:false`, **Weighted Blended OIT** değerlendir (cam kuleler).

### 5.3 Sinematik katman
- Post: `UnrealBloom` var; **SMAA/FXAA**, **anamorfik lens flare**, **film grain + LUT renk derecelendirme** (`.cube` LUT'u 3D dokuya çevir), **vignette** (var), **chromatic aberration** (var).
- Kamera: kritik sönümlü yay (damped spring) ile tüm kamera hareketleri; ease eğrileri tek kaynaktan (`THREE.MathUtils`).
- Sahne geçişleri: **View Transitions API** (kayıt açılışı için var) + GL "warp" (galaksiye dalış → kayıt) senkronu.
- Scroll-bağlı sahne: hero → atlas → Nobel arasında **tek sürekli kamera yolu** (CatmullRomCurve3 üzerinde ilerleme = scroll). Reduced-motion'da statik.

### 5.4 Kaynaklar (başlangıç noktaları; hepsini doğrula, lisansa bak)
- three.js resmi örnekleri: `webgl_materials_physical_transmission`, `webgl_postprocessing_unreal_bloom_selective`, `webgl_instancing_*`, `webgl_gpgpu_*`, `webgl_lines_fat`.
- Codrops / Bruno Simon / Active Theory / Lusion / Igloo Inc. gibi sitelerin **teknik yazıları** (fikir için).
- Shadertoy (yalnızca lisans uygunsa fikir), "The Book of Shaders" (Patricio Gonzalez Vivo, CC BY-NC-SA → **kod kopyalama yok**, anlama amaçlı).
- three-mesh-bvh (raycast hızlandırma) — çok kuleli sahnelerde seçim için; yalnız gerekirse **vendor'a** kopyala (MIT).
- Her aday için tabloya ekle: *Kazanç (görsel)*, *Maliyet (KB gzip + GPU ms)*, *Risk*, *Geri dönüş planı*.

**Kural:** yeni vendor dosyası = `sw.js` `FILES` + boyut raporu + `validate_site.py` yeşil. Toplam vendor büyümesi ≤ 120 KB gzip (tembel).

---

## BÖLÜM 6 — Uygulama paketleri (öncelik sırası; her biri ayrı PR)

Her paket: tasarım notu (5 satır) → kod → görsel doğrulama (2 tema) → denetim → sürüm artışı → PR → birleştirme → yayın doğrulama.

### PAKET A — Metin çakışması sıfırlama (önce bu)
**Hedef:** hiçbir 3B yüzeyde, hiçbir veri kombinasyonunda metin üst üste binmez, kırpılmaz, taşmaz.
- A1. `paintCover` (✔ v85) ve `spineTexture`, `backTexture` için **bir ortak yardımcı** yaz: `fitText(ctx, text, {maxW, maxH, sizes, lineHeight, maxLines, font})` →
  `{lines, size}`; tüm canvas metinleri bunu kullansın (kopya mantık yok).
- A2. Madalya yazısı: `faceMask` çevresel metin uzunluğu sabit ("NOBEL · ARCHIVE · 1901 – 2026"); EN/TR hâline göre yayı ölç; harf aralığı hesabı.
- A3. SVG canlı kapak etiketleri (`LA_LABEL`) `textLength`/`lengthAdjust` ile viewBox'a sığdır; TR/EN en uzun hâl testi.
- A4. Takımyıldızı DOM etiketleri: iki etiketin çakıştığı durumu tespit et (bounding box testi, her karede ucuz), çakışanlardan **uzaktaki** olanı gizle/yan kaydır
  (`label collision avoidance`: öncelik = hover > yakın derinlik > ilişki ağırlığı).
- A5. Nobel Silüet/Galaksi etiketleri: on yıl etiketleri ile cetvel etiketleri çakışmasın; tooltips ekran kenarında kırpılmasın (`clamp`).
- A6. **Test aracı:** `tools/text_fit_audit.py` — Playwright ile 40 "kötü" kaydı (en uzun başlık/yazar, çok yazarlı, tek uzun kelime) kayıt sayfasında 3B kitaba çevirir,
  `canvas.toDataURL` yerine **texture üretim fonksiyonunu doğrudan** çağırıp `ctx.measureText` ile her satırın `maxW` içinde olduğunu ve blokların dikey çakışmadığını doğrular
  (DOM'a bağımlı olmayan saf fonksiyon olarak test edilebilir olsun). CI'a **ekleme**; yerel kapı olarak belgele (ağırsa).
- Kabul: 40 kayıtta sıfır çakışma; ekran görüntüleri 6 örnek için eklenir.

### PAKET B — Kitap ve madalya: "fotogerçekçi"ye yaklaş
- B1. Kapak malzemesi: **deri gren normal haritası** (prosedürel, 512²), kenarlarda aşınma (curvature benzeri: kenar mask'inde roughness ↓ / renk açılması),
  folyo baskı: `metalnessMap` + **anisotropy** (fırçalanmış altın), hafif **clearcoat normal** (parmak izi lekesi, çok düşük şiddet).
- B2. Sayfa bloğu: gerçek **sayfa katmanı** hissi için `normalMap` ile ince çizgi + hafif dalgalı alt/üst kenar (vertex displacement ±0.004), **ciltten sayfa kıvrımı** (ön kapak yarı açık varyantı: menteşe animasyonu, `3D` düğmesinde hover'da 12° aç).
- B3. Şerit ayraç: iki ucu farklı uzunlukta, **kuyruk dalgası** (basit verlet 6 segment), hafif satin `sheen`.
- B4. Zemin: raf/masa yerine **yumuşak gerçek gölge** (DirectionalLight `PCFSoftShadowMap`, tek `shadowMap 1024`, yalnız tek kitaplı sahnede); raf kitaplarında ucuz blur gölge kalsın.
- B5. Madalya: ön yüzde **kabartma portre/rozet** (Nobel kategorisine göre madalya yüzü: Fizik atom, Kimya benzen, Tıp Asklepios çubuğu stilize, Edebiyat kalem, Barış güvercin, Ekonomi — kategori `nobelCat`), **`iridescence`** ince film efekti (kurdele metaliği), kenar pervazı.
- B6. Kapak varyasyonu: kategori başına **malzeme kimliği** (kumaş, deri, keten, mat karton) ve folyo rengi (altın, gümüş, bakır) — `COVER` paleti 8 renk yerine malzeme tanımları.
- B7. `3D` kitapta **sürükle-çevir**: yönelim snap'i (ön/sırt/arka'ya yay ile yaslan), çift tıkla "okuma pozu".
- Kabul: koyu ve açık temada ekran görüntüleri; çakışma yok; yazılım render'ında ≥ 6 fps (kabaca; gerçek GPU'da ölçülmedi notu).

### PAKET C — Nobel bölümü: "dünya standardı veri sahnesi"
- C1. **Silüet:** kulelerde `transmission` cam malzemesi (düşük kalite modunda düz malzemeye düş), seçili yıl için **yükselen ışık sütunu + parçacık yağmuru**,
  ortamda yavaş "toz ışığı". Zemin: düzlemsel yansıma (yarım çözünürlük), kule altına renkli **yansıma sızıntısı (bloom)**.
- C2. **Zaman kaydırıcısı:** alt kenarda 3B yıl kaydırıcısı (sürükle = yıl değişir, kamera yıla kayar, kule yükselir). Klavye eşdeğeri var (Sol/Sağ).
- C3. **Karşılaştırma modu:** iki yıl seç → iki sütun kıyas paneli (kategori farkı oklarla). Tooltip'e `Δ önceki on yıl %`.
- C4. **Galaksi:** `Points` → **instanced billboard impostor** (yıldız disk + difraksiyon spike); **kategori renkli ışık hüzmeleri** (volumetric billboards), yıl halkası akışı;
  seçili yılın laureate'ları için **yaylı etiketler** (isim kapsülleri, çakışma kaçınma — A4 ile aynı yardımcı).
- C5. **Üç görünüm arası morph:** Grafik ⇄ Silüet ⇄ Galaksi geçişinde **aynı parçacıklar/çubuklar** yeni konumlarına yay ile akar (data-driven transition; ortak `position` hedefleri).
- C6. **Dossier bağlantısı:** yıl seçilince dossier numarası 3B sahnedeki ışık sütunundan dossier başlığına **ince bir çizgi/ışık** ile bağlansın (SVG overlay).
- C7. Erişilebilirlik: canvas'ın yanında **tablo eşdeğeri** (gizli, ekran okuyucu), `aria-live` yıl duyuruları, Ctrl+Arrow ile on yıl.
- Kabul: üç görünüm iki temada; morph hata vermez; filtre çipleri üçünü birden süzer; klavye turu tamam.

### PAKET D — Ana sayfa hero: sinematik süreklilik
- D1. **Tek kamera yolu:** hero galaksi → (scroll) → atlas'a "uçuş": kamera `CatmullRomCurve3` üstünde ilerler; galaksi uzaklaşırken atlas sahnesi yaklaşır (iki sahne, tek `scrollProgress`).
- D2. **Gözlemevi kubbesi** 3B (şu an 2B silüet): yarım küre + yarık, yarık ışığı galaksiye bakar (volumetric ışın), fare takip eden teleskop.
- D3. **Zemin arazisi:** `ground3d.js`'de gerçek gölge/yansıma: galaksi ışığı çizgilerde dalga gibi gezsin (renk ≈ yakın yıldız renkleri).
- D4. **Işık-hareket dili:** tüm sahnelerde ortak `ease` + `spring` yardımcı (`site/motion.js` — küçük, tek kaynak).
- D5. **Kalite yöneticisi** (var): 4 kademe; **ölçüm** için `window.__bkPerf` (yalnız geliştirme) hâlâ GPU yokken çalışsın.
- D6. Kullanıcı bir yıldıza uçtuğunda (`fly`) **DOF + kromatik** vurgusu (kısa), kayıt açılınca View Transition ile **kapak morfu** kitabın 3B kapağına dönüşsün (A paketiyle kapak aynı dokuyu paylaşır).

### PAKET E — Takımyıldızı v3 (kayıt sayfası)
- E1. Gezegen yüzeyleri **kategoriye özgü** prosedürel shader (gaz devi bantları, taşlı kayalık, buzlu, okyanus); renk = kitabın `--spine`.
- E2. **Enerji tüpleri** yerine kalın anti-aliased `Line2` + **akış parçacıkları GPU'da** (shader'da `fract(time*speed - u)`); ucuz ve temiz.
- E3. Dalış animasyonu: tıklanan gezegenin yüzeyine **gerçek yaklaşma** (kamera dolly + FOV genişlemesi + hafif radial blur), 600 ms; `reduced-motion`'da anında.
- E4. **Konum kararlılığı:** düğüm yerleşimi şu an sahte-rastgele; **kuvvet-yönlü yerleşim** (spring layout; ilişki ağırlığı = yay sertliği; 8 düğümde ucuz) ile okunur, deterministik.
- E5. Etiket çakışma çözümü (A4), "yakın/uzak" derinlik soluklaşması, seçili gezegen detay kartı (ince kapak + yazar + yıl + "Aç").
- E6. Ses: **yok** (kullanıcı istemedi).

### PAKET F — Atlas (keşif alanı) ve rafı
- F1. 8 atlas karosu: her sahne **kendi malzemesinde** (cam atom, cam DNA, altın küre…) — `studioEnv` ile aynı IBL'yi paylaşsın (tek PMREM).
- F2. Karo **tilt + parallax**: fare konumu = kamera ve ışık konumu; kart içi metin DOM, sahne canvas, **derinlik katmanları** (3 plan).
- F3. Raf kitapları: tek paylaşılan renderer'da **instanced kitap geometrisi** (4 kitap aynı geometri, farklı doku) — çizim çağrısı ve bellek azalır.
- F4. Hover'da kitap raftan **hafif çıkar** (z +0.3, eğilme), sırtı döner, komşular kayar.

### PAKET G — Katalog kartı / liste / boş durum cilası
- G1. Kart **cam kenar parıltısı** (conic-gradient maske) hover'da dönen ince ışık; koyu/açık için farklı; hover kontrastı CI'da kalmalı.
- G2. Canlı kapak SVG'leri: 16 desene **yüzey derinliği** (iki katmanlı parallax), kontrast etiketleri (`.la-t{opacity:1}` kuralı korunur).
- G3. "Sonuç yok" boş durumu: küçük 3B **boş kutu/sönük galaksi** (yalnız bu durumda tembel).
- G4. Liste görünümünde satır önizlemesi: hover'da sağda mini 3B kapak (paylaşılan renderer, tek örnek).

### PAKET H — Komut paleti ve kayıt sayfası mikro-etkileşimler
- H1. Palet açılırken **arka plan blur + chroma** (CSS `backdrop-filter`, ucuz); önizleme panelinde 3B mini kapak.
- H2. Kayıt sayfası sekme geçişi: iki panel arasında **kayarak karışan** geçiş (`View Transitions` ya da FLIP).
- H3. `Atıf` panelinde kopyala düğmesi: kopyalanınca **konfeti değil**, altın bir dalga (CSS) — sade.

### PAKET I — Erişilebilirlik, kalite kapıları (sadece kod tarafı; kullanıcı mobil/ölçüm istemiyor)
- I1. Her 3B sahnenin **metinsel eşdeğeri** (ekran okuyucu özeti, `aria-describedby`), odaklanabilir kontroller, Esc ile 3B'den çıkış.
- I2. `prefers-reduced-motion`: **tüm** yeni sahnelerde `still()` yolu; test: `emulateMedia(reduced_motion='reduce')` ile ekran görüntüsü + hata yok.
- I3. `ui_audit.py` genişlet: yeni bileşenlerde taşma/kontrast; Nobel HUD için hover kontrastı; kayıt sayfasında 3B kitap açıkken konsol hatası yok.
- I4. **Sızıntı testi:** kayıt sayfasını 20 kez aç/kapat + 3B düğmesini aç/kapat; `renderer.info.memory` (`geometries`, `textures`) sabit kalmalı.

---

## BÖLÜM 7 — Tasarım ilkeleri (karar verirken)

1. **Sakin lüks:** çok şey hareket ediyorsa hiçbir şey premium durmaz. Aynı anda ≤ 2 hareketli katman; geri kalanı **hover/odakta** canlanır.
2. **Bilgi hiyerarşisi:** 3B sahne süs değil, **veriyi anlatır** (Nobel, ilişkiler, konular). Her animasyon bir anlam taşır.
3. **Tipografi:** Fraunces (başlık/rakam), Inter (gövde), IBM Plex Mono (etiket, sayı). Mono etiketler en az 10.5px; harf aralığı .06–.16em; büyük harf yalnız ≤ 24 karakter.
4. **Renk:** koyu = derin lacivert zemin + pirinç/altın vurgu; açık = parşömen + koyu mürekkep + bronz vurgu. Kategori renkleri (CATC) iki temada da ayırt edilebilir (renk körlüğü: yalnız renge dayanma, çip etiketi/şekil).
5. **Işık yönü sabit:** sol-üst anahtar ışık, sağ-arka soğuk dolgu. Tüm sahnelerde aynı.
6. **Kenar dili:** köşe yarıçapı 12/16/20; cam kenar `1px` iç parıltı; gölge `0 26px 60px -34px`.
7. **Kırpma değil kaydırma:** uzun metin → 2 satır + `…` + hover'da tam (tooltip), canvas'ta **otomatik ölçekleme**.
8. **Etiket asla çakışmaz:** çakışma çözümü yoksa etiketi gösterme.
9. **Her şeyin iki teması:** yeni bileşende önce açık temayı da çiz; "sonra bakarız" yok.
10. **Geri dönüş:** WebGL yoksa/`reduced-motion`'da eski SVG/DOM eşdeğeri çalışır (var olanı bozma).

---

## BÖLÜM 8 — Kabul ölçütleri (her paket sonunda aşağıdaki liste işaretlenir)

- [ ] `for f in site/*.js; do node --check $f; done` temiz
- [ ] `validate_site.py`, `validate_i18n.py`, `check_app.cjs`, `check_app.cjs --missing-art` yeşil
- [ ] `ui_audit.py` yeşil (4 genişlik × 2 tema)
- [ ] Yeni/değişen her yüzey için **açık + koyu** ekran görüntüsü alındı ve incelendi
- [ ] Metin çakışması taraması: yeni metin çizen her yerde `fitText`/ölçüm var
- [ ] `user-select:none` animasyon yüzeylerinde; `::selection` şeffaf
- [ ] `prefers-reduced-motion` yolu çalışıyor
- [ ] Sürüm `?v=` + `sw.js` CACHE + FILES artırıldı, yeni dosya `pages.yml` `node --check` listesinde
- [ ] `docs/tasarim/DEVIR-FAZ-4.md` içine **yeni numaralı bölüm** (neden, ne, tuzaklar) eklendi (TR)
- [ ] PR açıldı, birleşti, "Publish library" çalışması **success** (yoksa nedenini raporla)
- [ ] Kullanıcıya özet: ne yaptım / ne gördüm / **ne göremedim** (GPU yok, hareket durağan kareyle doğrulanamadı vb.)

---

## BÖLÜM 9 — Çalışma akışı (adım adım)

1. `git fetch origin main && git status -sb` ; dal güncel mi? (`git pull origin claude/friendly-pascal-994fmf`).
2. `docs/tasarim/DEVIR-FAZ-4.md` §9–35'i oku (bu oturumdan önceki **tüm** tuzaklar orada).
3. BÖLÜM 4 taramasını yap → `TARAMA-RAPORU.md` yaz → **kısaca kullanıcıya özetle** (3–5 satır), onay bekleme.
4. BÖLÜM 5 araştırmasını yap → `ARASTIRMA-3D.md` yaz.
5. Paket A'yı bitir (merge+deploy), sonra B → C → D → E → F → G → H → I sırasıyla; her paket ayrı PR.
6. Her paket sonunda kullanıcıya **kısa** durum (Türkçe): ne eklendi, ne gördün, ne göremedin, sıradaki.
7. Kullanıcı "dur" diyene kadar devam et; "mobil", "performans ölçümü" gibi **istenmeyenlere** dokunma.
8. Bağlam dolarsa: özet yaz, `DEVIR-FAZ-4.md` güncel kalsın (bir sonraki oturum buradan devam eder).

### 9.1 Alt-ajan kullanımı
Ağır tarama/araştırma için `Agent` (Explore / general-purpose) kullanabilirsin; ama **doğrulamayı** (ekran görüntüsü, denetim) kendin yap.
Bir ajan "çalışıyor" derse kanıt iste (komut çıktısı, ekran görüntüsü).

### 9.2 Zaman kutusu
Her paket için yaklaşık 1 oturum bölümü; paket çok büyüyorsa **dikey dilimle** (önce en görünür yarısı, merge, sonra ikinci yarı).

---

## BÖLÜM 10 — Kod kalıpları (kopyala-kullan; projeye uygun)

### 10.1 Canvas metin sığdırma (Paket A1 için taslak)
```js
function fitText(x,text,{maxW,maxH,sizes=[44,40,36,32,28,25,22],lh=1.2,family='Fraunces,Georgia,serif',weight=400,maxLines=99}){
  const words=String(text).split(/\s+/).filter(Boolean);
  for(const size of sizes){
    x.font=`${weight} ${size}px ${family}`;
    const lines=[];let cur='';
    for(const w of words){const t=(cur+' '+w).trim();
      if(x.measureText(t).width>maxW&&cur){lines.push(cur);cur=w}else cur=t}
    lines.push(cur);
    const fit=Math.min(maxLines,Math.floor(maxH/(size*lh)));
    if(lines.length<=fit||size===sizes.at(-1)){
      let out=lines.slice(0,Math.max(1,fit));
      if(lines.length>out.length){let last=out.at(-1);while(x.measureText(last+'…').width>maxW&&last.length>1)last=last.slice(0,-1);out[out.length-1]=last.trimEnd()+'…'}
      // tek kelime çok uzunsa harf kırp
      out=out.map(l=>{while(x.measureText(l).width>maxW&&l.length>3)l=l.slice(0,-2)+'…';return l});
      return{size,lh:size*lh,lines:out}
    }
  }
}
```
Kullanım: `const f=fitText(x,title,{maxW:W-112,maxH:BOT-TOP});f.lines.forEach((l,i)=>x.fillText(l,52,TOP+f.size+i*f.lh))`.

### 10.2 DOM etiket çakışma kaçınma (Paket A4/E5 için)
```js
function declutter(items){ // items: [{el,x,y,w,h,prio}] ekran koordinatı, prio büyük = kalır
  const shown=[];
  items.sort((a,b)=>b.prio-a.prio).forEach(it=>{
    const box={x:it.x-it.w/2,y:it.y,w:it.w,h:it.h};
    const hit=shown.some(s=>!(box.x>s.x+s.w||box.x+box.w<s.x||box.y>s.y+s.h||box.y+box.h<s.y));
    it.el.style.visibility=hit?'hidden':'visible'; if(!hit)shown.push(box);
  });
}
```
Her karede değil, **her 6. karede** ve hover değişiminde çalıştır.

### 10.3 Kritik sönümlü yay (kamera/etiket)
```js
const spring=(cur,vel,target,k=90,c=2*Math.sqrt(90),dt)=>{const a=-k*(cur-target)-c*vel;vel+=a*dt;cur+=vel*dt;return[cur,vel]};
```

### 10.4 Tembel, durdurulabilir sahne iskeleti
```js
const io=new IntersectionObserver(es=>{visible=es[0].isIntersecting;if(visible)kick()},{threshold:0});
function frame(now){raf=0;if(!visible||document.hidden)return;paint(now);
  const still=reduced.matches||root.classList.contains('effects-paused');
  if(!still||animating)raf=requestAnimationFrame(frame)}
```

### 10.5 Dispose kalıbı
```js
scene.traverse(o=>{o.geometry?.dispose();(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>{if(!m)return;for(const k in m)if(m[k]?.isTexture)m[k].dispose();m.dispose()})});
renderer.dispose();renderer.forceContextLoss();canvas.remove();
```

### 10.6 Kalite kademesi (paylaşımlı)
Tek `window.BKQuality = {level:0..3}`; her sahne `level`'a göre: 0 = tam, 1 = bloom/transmission kapalı, 2 = DPR düşür, 3 = parçacık/instance sayısı yarıya.
Ölçüt: 90 karelik ortalama dt > 26 ms (ilk iki kademe), > 40 ms (sonrakiler). Zamana dayalı pencere (≥4 kare ve >1.4 sn) — kare sayısına değil.

---

## BÖLÜM 11 — Dağıtım prosedürü (birebir)

1. `git add -A && git commit -m "<paket>: <özet>; vNN"` (trailer'lar dahil).
2. `git push -u origin claude/friendly-pascal-994fmf` (ağ hatasında 2/4/8/16 sn bekleyerek 4 kez dene).
3. `mcp__github__create_pull_request` (head=dal, base=main, TR/EN kısa başlık, gövdede neyin değiştiği + "Validators and UI audit pass").
4. `mcp__github__merge_pull_request` (`merge_method: merge`).
5. `mcp__github__actions_list` → `list_workflow_runs` (`resource_id: pages.yml`, `workflow_runs_filter: {"branch":"main","event":"push"}`, `per_page: 1`).
   Başarısızsa: `mcp__github__get_job_logs` (`failed_only`, `return_content`, `tail_lines`) → neden? "in progress deployment" ise bekle; kod hatasıysa düzelt.
   Pages API yolu proxy ile kapalı; takılı yayını **iptal edemezsin** — kullanıcıya GitHub arayüzünden iptali tarif et.
6. Kullanıcıya: "vNN birleşti; yayın #X success/pending; altbilgide `BUILD vNN` görünmeli; görünmezse Service Worker'ı kaldırıp site verisini temizleyip sert yenile."
7. Canlı siteye bu ortamdan **erişemezsin** (`github.io` proxy'de 403): "canlıda baktım" **deme**.

---

## BÖLÜM 12 — Rapor şablonu (her paket sonu, Türkçe, ≤ 25 satır)

```
Paket X (vNN) birleşti. Yayın: #NNN <sonuç>.
Ne değişti: …
Gördüğüm: (açık/koyu ekran görüntüsü, hangi genişlik)
Göremediğim: (GPU akıcılığı, hareketin kendisi, gerçek cihaz)
Düzelttiğim hata(lar): …
Sıradaki: …
```

---

## BÖLÜM 13 — "Top-tier premium" için kendine sor (her ekranda)

1. Bu ekranı ilk gören biri **3 saniyede** ne olduğunu anlıyor mu?
2. Hareket bir şey **anlatıyor** mu, yoksa sadece mi var?
3. Işık bir **kaynağa** ait mi (her gölge/parıltının sebebi var mı)?
4. Metin her durumda **okunuyor** mu (uzun başlık, TR/EN, açık/koyu, hover)?
5. Etiketlerden biri başka bir şeyin üstüne biniyor mu?
6. Boş alan **kasıtlı** mı?
7. Fare olmadan (klavye) aynı bilgiye ulaşılıyor mu?
8. `reduced-motion`'da sayfa yine **güzel** mi (sadece "bozulmamış" değil)?
9. 20 kez aç-kapatınca bir şey sızıyor mu?
10. Ben bunu **gerçekten gördüm** mü, yoksa koddan mı çıkarım yaptım?

---

## BÖLÜM 14 — Yasaklar

- Çalışma anında dış CDN/font/görsel isteği **yok**.
- Yeni framework/bundler **yok** (vanilla kalır).
- `three.module.min.js` sürümünü değiştirme (r160 sabit); yalnız `jsm` ek dosyaları ekleyebilirsin.
- Test/denetimi atlamak, `--no-verify`, `git push --force`, başka dala push **yok**.
- Kullanıcının mobil/performans ölçümü istemediği maddelere zaman harcama (kod güvenliği için gerekli korumalar hariç).
- Görsel doğrulama yapmadan "tamam" deme.
- Kullanıcı e-postası/kimliği vb. kişisel veriyi herhangi bir yere yazma.

---

## BÖLÜM 15 — İlk 30 dakika için somut başlangıç

1. `git log --oneline -15` ; `sed -n 1,80p docs/tasarim/DEVIR-FAZ-4.md` ; `ls site`.
2. Sunucuyu başlat; `book.py`-benzeri bir betikle **kötü verili 6 kaydı** 3B kitap olarak aç; çakışma var mı?
   (`records` içinden `author` içinde `;` olan Nobel belgeleri, en uzun 5 başlık, başlığı yazarı içeren kayıtlar.)
3. `grep -n "fillText" site/*.js` çıktısından BÖLÜM 4.3 tablosunu doldur.
4. `fitText` yardımcısını `stage.js` içinde tek yere koy, `paintCover/spineTexture/backTexture`'ı ona taşı, A2–A5'i bitir.
5. Ekran görüntüleri (açık+koyu) → denetimler → v bump → PR → birleştir → yayın doğrula → kullanıcıya rapor.
6. Sonra BÖLÜM 4'ün geri kalanı ve BÖLÜM 5 araştırması; ardından B'ye geç.

> Başarı ölçütü tek cümle: **kullanıcı ekran görüntüsü gönderip "şurası çirkin" demek zorunda kalmamalı.**
