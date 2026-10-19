# Premium aşama ayrıntıları: R10 geçişler · R11 kütüphane duvarı · R12 erişilebilirlik · R13 worker/WebGPU kararı

> Ana belge: `PREMIUM-GORSEL-VIZYON.md` (ilkeler, yetenek envanteri, A1–A6, seviyeler, bütçe, kural kitabı). Sahneler: `PREMIUM-R6-R9-SAHNELER.md`.
> Durum: **tasarım; kodlanmadı.** Sayılar hedeftir, ölçülmemiştir.
> Gösterim: **[S0]** Sinema · **[S1]** Yüksek · **[S2]** Orta · **[S3]** Düşük (bkz. ana belge §5).

---

# R10 — Sahneler arası portal geçişleri: "Her geçiş bir yolculuk"

## Vizyon
Galaksiden bir kayda gitmek **bir kamera uçuşu**: yıldıza doğru dalış (ışık çizgileri uzar), yıldızın rengi **kitap kapağına dönüşür** (yıldızdan eriyip kapak dokusu belirir), kapak açılır ve kayıt sayfası oturur. Zaman çizelgesinden galaksiye dönüş **film yanığı/iris** ile. Her geçiş bir **neden** anlatır (yıldız → kitap; yıl → kule; kule → dosya); süs değil.

## Bugünkü durum
Yıldıza dalış **DOM hayalet kapağı** (`.fly` ghost, `A2/A3/A4` testleri); `record.js` `withMorph` ve View Transitions ad çakışması testi; sahneler ayrı canvas/renderer'lar (hero, takımyıldızı, Nobel galaksi, silüet) ve paylaşılan `stage` renderer'ı (raf/kitap/madalya).

## Radikal fikirler ve teknik tasarım

### R10.1 "Dondur-ve-geç" mimarisi (ucuz, güvenli)
- İki sahneyi **aynı anda tam kalitede** çizmek pahalıdır. Çözüm: **giden sahnenin son karesi** bir render hedefine (veya `ImageBitmap`) dondurulur; **gelen sahne canlı** çizilir; geçiş shader'ı iki dokuyu birleştirir. Maliyet ≈ **1 sahne + 1 tam ekran birleştirme** (hedef geçici ≤ 10 ms, §6).
- Birleştirme **ayrı küçük bir canvas** (kullanıcı arayüzü üstünde, `pointer-events:none`) ya da A1'in uber geçişi; çıkışta canvas kaldırılır (DOM temizliği, `leak_audit`).
- Bağlam kaybı geçiş ortasında olursa: dondurulmuş kare düşer, **anında kesme** ve gelen sahne `BKGL.watch` ile kurtarılır.

### R10.2 Geçiş kitaplığı (shader, A3)
| Geçiş | Kullanım | Teknik |
|---|---|---|
| **Dalış (warp)** | galaksi → kayıt/takımyıldızı | radyal bulanıklık + yıldız çizgileri (hıza bağlı uzama), merkez `uCenter`'a (tıklanan yıldızın ekran konumu); kamera gerçekten ileri (dolly) gider |
| **Materyalizasyon** | yıldız → kitap kapağı | gürültü eşikli **çözülme** (`fbm > t`), eşik kenarında **emisyon çizgisi** (yıldız rengi); yıldız rengi → kapak dokusu **renk geçişi**; kapak, yıldızın konumunda ölçeklenerek belirir |
| **İris / film yanığı** | silüet ↔ galaksi | dairesel maske (`smoothstep(|uv−c|, r)`), kenarda sıcak yanık gradyanı + kısa greyn |
| **Kromatik ayrışma** | genel yedek | R/G/B kanal ofseti zamanla artıp azalır |
| **Kesme** | `reduced-motion` ve S3 | 1 kare çapraz solma (≤ 120 ms) |
- Hepsi **tek `ShaderMaterial`** içinde `uMode` ile seçilir (program sayısı artmaz), kare zamanı `uT` (sabit `dt` ile `?still`'de deterministik).

### R10.3 Gerçek kamera uçuşu ve kapak malzemelenmesi
- Bugünkü DOM hayalet kapağı yerine, takımyıldızı/galaksi sahnesinde **kamera yolu** (Catmull-Rom, yay-sönüm) ve yıldızın yerinde **3B kitap kapağı** (stage'in `BKStage.mini`/bookScene altyapısı; paylaşılan renderer, `scissor`) — kapak dokusu başlangıçta yıldız rengi gradyanı, uçuş sonunda kapak dokusu (**lerp** `uBlend`).
- **Sıra:** (1) kamera yıldıza (0–600 ms), (2) kapak belirir + yıldız söner (600–900), (3) kapak sayfa düzenine **oturur** (DOM kayıt kitabıyla aynı konum; `withMorph` View Transition ile DOM yarısını eşler), (4) çıkış shader'ı kapanır.
- Geri dönüş **simetrik** (uçuş tersi); klavye `Esc`/geri.

### R10.4 DOM ile eşleme
- View Transitions API (`document.startViewTransition`) DOM yarısını yönetir; 3B yarısı **aynı süre eğrisi** (cubic-bezier ortak). Ad çakışması: `view-transition-name` tek yerde tahsis edilir (A3/A4 testleri korunur, yeni: geçiş sırasında **tek** aktif ad).
- Destek yoksa: yalnız 3B geçiş + DOM kesme.

## Seviye tablosu (R10)
| Özellik | S0 | S1 | S2 | S3 |
|---|---|---|---|---|
| Dalış çizgileri + radyal blur | tam | yarım çözünürlük | solma | kesme |
| Materyalizasyon çözülmesi | evet | evet | solma | kesme |
| Gerçek kamera uçuşu | evet | evet | kısa tween | kesme |
| Dondur-ve-geç | HalfFloat RT | 8-bit RT | `ImageBitmap` | yok |

## Alt adımlar (PR)
1. **R10.a** geçiş shader kitaplığı + dondur-ve-geç (silüet↔galaksi, düşük risk). 2. **R10.b** dalış + kamera uçuşu. 3. **R10.c** materyalizasyon + kapak. 4. **R10.d** View Transitions eşlemesi ve geri dönüş.

## Kabul testleri
- Geçiş süresince **kare sayısı ≥ 20** (gerçek GPU'da; yazılımsal GL'de ≥ 4), `reduced-motion`'da kesme (kare sayacı ≤ 2).
- `record.js` `withMorph`/A3-A4 **ad çakışması testi geçer**; geçiş ortasında `WEBGL_lose_context` ile bağlam kaybı → sahne **kurtarılır** ve geçiş canvas'ı kaldırılır (B8 genişler).
- `gpu_budget_audit`: geçiş sırasında ek render hedefi ≤ 3, ek program ≤ 2; geçiş bitince hedefler `dispose` (`leak_audit` eğim).
- `visual_audit`: geçiş **ara kareleri** `?still` modunda sabit `uT` değerleriyle (0, 0.25, 0.5, 0.75, 1) altına alınır; yalnız geçiş yüzeyi.

## Riskler
View Transitions tarayıcı farkları → özellik tespiti. İki sahnenin aynı anda canlı kalması → bilinçli reddedildi (dondur-ve-geç). **Dosyalar:** `transition.js` (yeni; `fx.js` uber'i kullanır), `record.js`, `hero3d.js`, `constellation3d.js`, `stage.js`.

---

# R11 — Kütüphane duvarı: "2 653 sırt, tek bakışta"

## Vizyon
Katalog için isteğe bağlı bir **duvar görünümü**: sonsuz uzanan raflarda 2 653 kitap sırtı, kategoriye göre renk ve doku; kamera raflar boyunca **süzülür**, yaklaşılan kitapların kapakları belirginleşir, uzakta renk bantları. Filtre (alan, yıl, dil) uygulandığında eşleşmeyen kitaplar **geri çekilip kararır**, eşleşenler **öne çıkıp parlar** (canlı, örnek başına). Bir kitaba tıklayınca **raftan çıkar**, döner ve mevcut raf-kitap sahnesine (açık kitap akışı) devredilir.

## Bugünkü durum
Raf: kutu başına paylaşılan `stage` renderer'ında bir kitap sahnesi (`bookScene`, 16'lık önbellek); duvar yok. Kapak çizimi prosedürel `paintCover`.

## Radikal fikirler ve teknik tasarım

### R11.1 Örnekleme mimarisi (InstancedMesh, 1–8 çizim çağrısı)
- **Sırt geometrisi:** tek `BoxGeometry` + örnek başına öznitelikler (`InstancedBufferAttribute`): `aColor` (kategori), `aSize` (yükseklik/kalınlık varyasyonu: tohumlu), `aTilt` (rafta hafif eğik), `aAtlas` (doku dizini), `aState` (odak/soluk/seçili), `aYear`.
- **Çizim çağrısı hedefi ≤ 8** (raf bölümü başına en çok 1–2 `InstancedMesh`), üçgen: 2 653 × 12 ≈ **32 k** (kutu) — bol bütçe; ayrıntı için "yakın" kitaplarda sırt kabartma/yaldız şeridi **normal doku** (A3/BKMaterials).
- **Karşılaştırma ölçümü:** `InstancedMesh` ↔ `BatchedMesh` (r159+; örnek başına görünürlük ve farklı geometri) — A6 `gpu_budget_audit` ile **ölçüp** seçilir; ölçülmeden karar yok.

### R11.2 Doku akışı: 2 653 kapak 64'lük atlasa nasıl sığar?
- 2 653 benzersiz kapak aynı anda GPU'da **tutulmaz**. Tasarım: **sanal doku (LRU atlas)** — `DataArrayTexture` (256 katman × 128×192, ≈ 25 MB RGBA) veya 8×8 / 16×16 atlas; yalnız **kameraya yakın ≈ 120–200 kitabın** kapağı yüklü, geri kalanı **kategori rengi + prosedürel sırt deseni** (`aColor`, hash).
- Kamera hareket ederken en yakın kitaplar için kapaklar **boşta** `OffscreenCanvas` + `ImageBitmap` ile üretilip `texSubImage` ile atlasa yazılır (**kare başına en çok 2 doku yükleme**, ana iş parçacığı bütçesi ≤ 1,5 ms). Yüklenene kadar sırt rengi; geçiş **solarak**.
- İsteğe bağlı **KTX2** yalnız ölçülmüş bellek sorununda (A5).

### R11.3 Sanallaştırma ve LOD
- **Parçalar (chunk):** raf blokları (örn. 8 raf × 24 sırt); `frustumCulled` blok düzeyinde (örnek düzeyinde kırpma yok): kamera çevresi **tam ayrıntı**, uzak **düz renk şerit** (4 köşeli kart `aLod`), çok uzak **tek doku bandı**.
- Yakın yığın **sırt başlığı yaldızı** + **kapak yüzü** (dönerken görünür) — LOD kademesine göre shader dalı.
- **Hareket:** kamera rayı raflar boyunca; yatay kaydırma/sürükleme; **rack-focus** (sahte DOF: yakın dışı kitaplar hafif bulanık sırt dokusu, `aState` ile).

### R11.4 Seçim ve devir
- **Kimlik tamponu** (R9.3 ile ortak altyapı): örnek kimliği → kayıt. Hover: kitap **1 cm öne çıkar** (örnek ofset animasyonu) + sırt parıltısı. Tıklama: **raftan çıkar** (yay), kamera yaklaşır, kitap **mevcut raf kitap sahnesine** (`bookScene`, paylaşılan renderer) devredilir; duvar karartılır (R10 iris).
- **Klavye:** ok tuşları ile komşu kitap, `Enter` açar (R12).

### R11.5 Filtre ve veri
- Filtre sonucu **örnek başına maske dokusu** (`DataTexture` R8: 2 653 değer; GPU'da `aState` türetilir): eşleşen → parlak, diğerleri → 0,15 opaklık ve geri itilmiş; geçiş yay (R9.1 mini-GPGPU ile ortak).
- Sıralama modları: alana göre raf, yıla göre zaman rafı, dile göre — **konum hedef dokusu** yeniden yazılır, kitaplar **yeni yerlerine süzülür** (GPU yay).

### R11.6 Işık ve atmosfer
- **Ambient occlusion (pişirilmiş):** sırt kenarı koyulaşması (shader'da `fwidth` + örnek komşuluk), raf arka paneli; gerçek SSAO **yok** (maliyet). **Volumetrik toz** (≤ 120 parçacık) yalnız raf arasında. Kamera yakınında **sıcak okuma lambası** (spot, gölge yok).

## Seviye tablosu (R11)
| Özellik | S0 | S1 | S2 | S3 |
|---|---|---|---|---|
| Duvar | 3B tam | 3B az ayrıntı | statik sıralı ızgara kartları (3B yok) | DOM ızgara |
| Kapak akışı | 200 yakın kitap | 80 | yok (renk) | yok |
| Filtre animasyonu | GPU yay | GPU yay | anlık | anlık |
| Rack-focus | evet | yok | yok | yok |
| Volumetrik toz | 120 | 40 | yok | yok |

## Alt adımlar (PR)
1. **R11.a** DOM'da **erişilebilir alternatif liste her zaman** (duvar yalnız görsel katman) + 3B sırt renk duvarı (kapak yok). 2. **R11.b** LOD + chunk + kamera rayı. 3. **R11.c** sanal kapak atlası. 4. **R11.d** kimlik tamponu + hover + devir. 5. **R11.e** filtre/sıralama GPU yayı + atmosfer.

## Kabul testleri
- **2 653 örnek ile ≥ 30 fps hedefi** (`?perf`); `gpu_budget_audit`: duvar çizim çağrısı ≤ 8, program ≤ 6, üçgen ≤ 120 k, doku belleği ≤ 48 MB; kapak yüklemesi **kare başına ≤ 2** (Playwright sayacı).
- **Seviye 3'te statik sıralı ızgaraya düşer** (B9 bozuk-GPU testi genişler); DOM listesi her zaman var (`ui_audit`: görsel ve DOM kayıt sayısı eşit = 2 653).
- Filtre uygulanınca eşleşen sayısı = `aState` parlak örnek sayısı (`BKWall.info()`).
- `visual_audit`: duvar altınları (sabit kamera yolu parametresi ile `?still`); `leak_audit` eğim (atlas LRU `dispose`).

## Riskler
Atlas yükleme takılması → kare başına sınır + boşta üretim. Çok geniş duvar bellek → LRU üst sınırı. **Dosyalar:** `wall3d.js` (yeni), `stage.js` (devir), `app.js`/`record.js` (görünüm anahtarı), `fx.js`, `shaders.js`, `sw.js`/`index.html` kayıtları.

---

# R12 — Erişilebilirlik ve dokunmatik girdi: "Radikal ama herkes için"

## İlke
Premium görsellik **erişilebilirliği tüketmez**: her radikal sahnenin bir **metin eşdeğeri**, **klavye yolu** ve **azaltılmış hareket** hâli vardır. R12, her aşamanın kabul koşulu olarak **paralel** yürür; en sonda toplu denetim yapılır.

## Kapsam ve teknik tasarım
1. **Klavye ile gezinti:** galaksi (yıldızlar), raf/duvar (kitaplar), silüet (yıllar), atlas (kutular) için **roving tabindex** + 3B **odak halkası** (sahnede vurgu: halka + parlaklık; DOM'da gerçek `:focus-visible`). Galaksiden kayda varış ve geri dönüş **yalnız klavye ile** tamamlanabilir.
2. **Metin eşdeğeri:** her 3B sahne için `aria-describedby` ile **hesaplanmış özet** (örn. galaksi: "56 000 yıldız, 2 653 kayıt, en yoğun alan: Fizik"); canlı bölge (`aria-live`) tüm sahnelere genelleştirilir (kitap için var).
3. **Fotosensitivite güvenliği (WCAG 2.3.1):** hiçbir bölge saniyede **3'ten fazla** parlak/koyu geçiş yapamaz; bloom/flare/kırınım parlaklığı kare başına **değişim sınırı** (`Δlüminans ≤ 0,1/kare` yumuşatma); ışık dalgası ve konfeti **titreşimsiz**. "**Güvenli mod**" anahtarı: tüm parıltı/flare/konfeti/uçuş kapalı, geçişler kesme.
4. **`prefers-reduced-motion`, `prefers-contrast: more`, `prefers-reduced-transparency`, `prefers-reduced-data`:** her sahne için tanımlı yol (hareket → statik; kontrast → daha belirgin kontur, bloom ↓; saydamlık → opak; veri → kapak akışı ve 2× doku kapalı).
5. **Dokunmatik:** iki parmak **yakınlaştır/döndür** (galaksi, kitap, madalya), tek parmak sürükle, **uzun bas = önizleme**, çift dokun = odak; `pointer events` birleşik katman (`BKInput`), kaydırma ile çakışmayı `touch-action` ve eşik ile çözer; titreşim geri bildirimi (`navigator.vibrate(8)`) yalnız destekleyen cihazda ve ayarlanabilir.
6. **Okunurluk:** WebGL üstü DOM etiketlerinde kontrast ≥ 4.5:1 **arka plan piksellerinden** (bugünkü `ui_audit` canvas tabanlı denetimi, 3B yüzeylerin üstünü de ölçer); etiket yerleşiminde `BKText.declutter`.

## Kabul testleri
- **Yalnız klavye uçtan uca (Playwright):** galaksi → bir kayda varış → geri dönüş; duvar'da komşu kitap + `Enter`; silüette yıl gezinti (`←/→`).
- `ui_audit` eklemeleri: tüm etkileşimli 3B odak hedeflerinin erişilebilir adı var; axe-benzeri kontrast ve ad denetimi; 3B yüzey üstü etiket kontrastı.
- **Fotosensitivite testi:** karelerin yüzde kaçında Δlüminans eşiği aşılıyor (kare başına ortalama lüminans izi; hero, silüet, geçişler; yazılımsal GL'de de ölçülebilir) → **0 ihlal**.
- `reduced-motion` ve "güvenli mod": hiçbir sahne süreklilik animasyonu çalıştırmaz (kare farkı yalnız kullanıcı girdisinde, `effects-paused` ile ölçülür).
- Dokunmatik: Playwright `touchscreen` ile iki parmak yakınlaştır/döndür etkisi `BKHero.info().zoom` değerini değiştirir.

## Riskler
Çok sayıda hedef odak sırasını karıştırır → yapısal odak yönetimi, "bölgeler" (landmark). **Dosyalar:** `input.js` (yeni, `BKInput`), `a11y3d.js` (yeni), her sahne dosyası (odak API'si), `style.css` (yeni blok), `ui_audit.py`.

---

# R13 — OffscreenCanvas + Worker ve WebGPU karar kapısı

## Neden "kapı"
Ağır hero'yu ana iş parçacığından ayırmak etkileşim gecikmesini düşürür; WebGPU compute daha çok simülasyon demektir. İkisi de **yüksek risk, yüksek maliyet**. Bu yüzden **yalnız ölçüm kanıtlarsa** yapılır.

## Karar kapısı (ölçüm ön koşulları)
| Soru | Ölçüt (R2 `?perf` + Long Task) | Evet ise |
|---|---|---|
| Ana iş parçacığı sıkışıyor mu? | Hero S0'da ana iş parçacığı **> %35 dolu** ya da Long Task (> 50 ms) kare başına > 0,1 | Worker (R13.a) |
| GPGPU yetmiyor mu? | 1 048 576 parçacık S0'da GPU bütçesini aşıyor, WebGL2 sınırı (tek hedef boyutu, bant genişliği) | WebGPU spike (R13.b) |
| Hedef cihazların WebGPU desteği? | kullanım analitiği yok → tarayıcı özellik tespiti + sabit bir "uyumluluk tablosu" | yalnız aşamalı iyileştirme |
Karar belgesi `DEVIR`'de gerekçe + ölçümle yazılır; **ölçüm yoksa R13 yapılmaz.**

## R13.a Worker (OffscreenCanvas)
- Hero tek `OffscreenCanvas` + Worker'da `WebGLRenderer`; ana iş parçacığı yalnız **girdi ve DOM**. İmleç/tıklama/odak `postMessage` ile (yüksek frekanslı imleç **paylaşılan sayaç** `SharedArrayBuffer` → COOP/COEP gerektirir, **GitHub Pages'ta uygun başlık yok** → `postMessage` + `requestAnimationFrame` toplu iletim).
- DOM etiketleri (`BKText`) için Worker'dan **ekran-uzayı konum listesi** iletilir; `pointer` olayları köprülenir; `BKGL.watch` bağlam kaybı Worker içine taşınır.
- Safari/Firefox `OffscreenCanvas` WebGL2 desteği tespit edilir; yoksa mevcut ana-iş-parçacığı yolu.
- **Kabul:** `?perf` ana iş parçacığı doluluğunda **≥ %40 düşüş**; etkileşim gecikmesi (hover→vurgu) değişmez veya iyileşir; B8/B9/B11 geçer; yazılımsal GL'de **yapısal** test (Worker oluşuyor, `info()` Worker'dan gelir).

## R13.b WebGPU spike (araştırma, üretime değil)
- `jsm/renderers/webgpu` (deneysel, r160) ile **yalnız hero parçacık simülasyonu** için compute shader prototipi; WebGL2 yolu **korunur**, WebGPU **aşamalı iyileştirme** (özellik tespiti `navigator.gpu`).
- **Çıktı:** karşılaştırma tablosu (parçacık sayısı × GPU ms × kod karmaşıklığı) ve "yap/yapma" kararı; üretime alma ayrı aşama.
- **Risk:** r160 WebGPU API kararsız; vendor ağırlığı artar → spike tek dalda, `main`'e girmez.

---

# Ek A — Uygulama sırası (PR planı, öneri)

| Dalga | PR'lar | Çıktı | Bağımlılık |
|---|---|---|---|
| **0 Altyapı** | A6 (testler: `gpu_budget_audit`, `leak_audit` eğim, `visual_audit` tablo+sabit port) → A3 (`shaders.js`) → A1 (`fx.js` uber) → A4 (bütçe yöneticisi) | ölçülebilir zemin | — |
| **1 Vitrin** | R7.a–R7.f (A2 `sim.js` dahil) | ana sayfa dönüşümü | Dalga 0 |
| **2 Nesneler** | R6.a–R6.e, R8.a–R8.c | madalya + zemin | A1/A3; R8 yansıma altyapısı R9 ile paylaşılır |
| **3 Zaman** | R9.a–R9.e | silüet | A2, R8.b |
| **4 Akış** | R10.a–R10.d | geçişler | R7, R9 |
| **5 Ölçek** | R11.a–R11.e, A5 | duvar | A1, A5 |
| **6 Herkes için** | R12 toplu denetim (her dalgada parça parça) | erişilebilirlik | hepsi |
| **7 Kapı** | R13 karar | ölçüme bağlı | `?perf` verisi |

# Ek B — Kabul test envanteri (hangi araç neyi kapıya bağlar)

| Araç | Mevcut | Bu belgeyle eklenen |
|---|---|---|
| `feature_audit` B5–B12 | kitap, madalya, kalite, ısıtma, malzeme | B6 madalya (POM/geometri), B8 yansıma+dalga dokuları, B10 merdiven eğimi, yeni **B13** (hero `info()`: parçacık/sim), **B14** (silüet `info()`/hover ≤ 2 kare), **B15** (duvar), **B16** (geçiş) |
| `visual_audit` | 10 yüzey × 4 yapılandırma | hero sinema karesi, madalya 6 yüz, silüet gündüz/gece, duvar, geçiş ara kareleri; yüzey başına `tol/limit` tablosu; sabit port |
| `leak_audit` | 20 tur, +24 eşiği | 40 tur, **doğrusal eğim** testi, yeni hedef/doku türleri |
| `gpu_budget_audit` | — (yeni) | çizim çağrısı, üçgen, program, render hedefi, doku MB üst sınırları |
| `shaders_audit` | — (yeni) | kopya fonksiyon, `customProgramCacheKey` |
| `ui_audit` | taşma, hata, kontrast | klavye uçtan uca, 3B odak adı, fotosensitivite, duvar DOM eşitliği |
| `materials_audit` | R4/R5 | POM/transmission fabrikaları `BKMaterials` içinde |

# Ek C — "Yap/yapma" ilkesi
Her alt adım şu soruyla kapanır: *"Bu, kabul testini ve bütçeyi geçerken seviye 3'te bile kimliğini koruyor mu?"* Hayır ise **özellik küçülür ya da kaldırılır**; bütçeyi büyütmek, ayrı bir gerekçeli karardır (`DEVIR`'de yazılı).
