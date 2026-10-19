# Premium görsel vizyon ve ortak altyapı (R6–R13 için ana belge)

> Kapsam: `YOL-HARITASI-3D.md` içindeki bekleyen aşamaların (R6–R13) **radikal, sinematik ve performansı sonuna kadar kullanan** hâli.
> Bu belge ortak ilkeleri, three.js r160 yetenek envanterini, performans mimarisini (A1–A6 altyapı paketleri), kalite katmanı modelini ve kural kitabını içerir.
> Aşama ayrıntıları: `PREMIUM-R6-R9-SAHNELER.md` (madalya, hero, zemin, silüet) ve `PREMIUM-R10-R13-GECISLER-OLCEK.md` (geçişler, duvar, erişilebilirlik, worker).
> Durum: **yalnız tasarım belgesi.** Hiçbir madde kodlanmadı. Aşağıdaki milisaniye/sayı değerleri **hedef ve ön tahmindir**, ölçülmüş değildir; her aşama kendi ölçümünü `?perf` (R2) ile üretir ve bu belgedeki bütçeyi gerçek değerle günceller.

---

## 1. Sanat yönü: "Yaşayan Arşiv"

Site bir kütüphane ve Nobel arşividir. Radikal görsellik **süs değil, arşivin kendisini hissettirmek** için kullanılır: bilgi ışıktır, zaman derinliktir, kayıtlar maddedir.

| İlke | Anlamı | Somut sonuç |
|---|---|---|
| **1. Işık bilgidir** | Parlayan şey veridir; parlaklık sayıyı/önemi kodlar | galaksi yoğunluğu = kayıt sayısı; kule penceresi = ödül; madalya parıltısı = seçili yıl |
| **2. Madde gerçektir** | Her yüzeyin ölçeği ve malzemesi inandırıcıdır | deri gren, yaldız, cam kalınlığı, kâğıt lifi, mermer cila; hiçbir yüzey "plastik" değil |
| **3. Ölçek hissi** | Yakından mikro doku, uzaktan kozmik yapı | tek sahnede 10⁴ ölçek aralığı (toz tanesi → galaksi) için LOD ve ayrıntı yeniden enjeksiyonu |
| **4. Hareket anlamlıdır** | Her animasyon bir geçişi ya da nedeni anlatır | yıldıza dalış = kayda varış; yıl kaydırma = ışık dalgası; asla süs döngüsü değil |
| **5. Zarif bozulma** | Güçsüz cihazda daha az, ama hâlâ güzel | her efektin ucuz eşdeğeri vardır; seviye 3'te bile tutarlı bir görünüm |

**"Radikal" tanımı (ölçülebilir):** bir sahne radikal sayılır ancak (a) bugünkü sürümden *tek bakışta* ayırt edilir (R3 görsel kapısında ≥ %5 piksel farkı), (b) bir veri anlamı taşır, (c) seviye 3'e düştüğünde bile görsel kimliğini korur.

**Yasaklar:** anlamsız parçacık yağmuru, her şeyi saran bloom (parlaklık hiyerarşisini öldürür), sürekli dönen dekor, yavaşlatan "wow" (kare bütçesini aşan efekt kapanır), fotosensitif titreşim (bkz. R12).

---

## 2. Bugünkü durumun envanteri (kodda doğrulandı)

| Yüzey | Dosya | Bugünkü teknik | Not |
|---|---|---|---|
| Hero galaksi | `hero3d.js` (448 satır) | `Points` + özel shader; ana galaksi 56 000 (küçük ekran 14 000), kayıt parçacıkları 3 600 / 1 200, arka plan yıldızı 3 200 / 900; `EffectComposer` + `RenderPass` + `ShaderPass` (lens, kromatik sapma, radyal blur, renk derecelendirme) + `UnrealBloomPass`; parçacık konumları **CPU'da** `Float32Array` ile güncellenir | R7'nin ana hedefi |
| Zemin | `ground3d.js` (85) | kontur çizgileri, dalga halkaları, şerit yansıma | R8 |
| Silüet | `skyline3d.js` (179) | `InstancedMesh` kule + ayna kopya yansıması + pencere shader'ı (`onBeforeCompile`), isteğe bağlı cam (transmission) | R9 |
| Nobel galaksi | `nobel3d.js` (210) | parçacık + halka | R7 ile ortak altyapı |
| Takımyıldızı | `constellation3d.js` (291) | yıldız/gezegen sahnesi | R10 geçişi |
| Raf/kitap/madalya | `stage.js` (~600) | tek paylaşılan `WebGLRenderer`, kutu başına scissor; `BKMaterials` (R4) | R5 bitti; R6 |
| Ortak katman | `gl.js` (126) | `BKGL`: probe, watch (bağlam kaybı), flags, perf paneli | R1/R2 bitti |
| Malzeme/ışık | `materials.js` (86) | foil/cloth/glass/brass/paper/leaf/gilt, tek PMREM, seviyeler | R4/R5 bitti |
| Görsel kapı | `tools/visual_audit.py` | 10 yüzey × 4 yapılandırma, `?still=1`, altın PNG | R3 bitti |

Vendor: three **r160** (`three.module.min.js` ≈ 670 KB, tembel yüklenir) + `EffectComposer`, `RenderPass`, `ShaderPass`, `MaskPass`, `Pass`, `UnrealBloomPass`, `CopyShader`, `LuminosityHighPassShader`. Çalışma zamanında dış istek yok; ilke korunur.

---

## 3. three.js r160 yetenek envanteri (ne var, ne işe yarar, ne kadar tutar)

Maliyet sütunu **göreli** (●=ucuz … ●●●●=pahalı). Uygulama yeri: hangi aşama kullanır.

| Yetenek | r160'ta durum | Ne katar | Maliyet | Aşama |
|---|---|---|---|---|
| `InstancedBufferGeometry` / `InstancedMesh` + örnek başına öznitelik | çekirdek | binlerce nesne tek çizim çağrısı; örnek başına renk/durum/doku dizini | ● | R9, R11, R6 (toz, diş) |
| `BatchedMesh` | çekirdek (r159+, deneysel) | farklı geometrileri tek çizim çağrısında, örnek başına görünürlük; `WEBGL_multi_draw` kullanır | ●● | R11 (karşılaştırılıp seçilecek) |
| **GPGPU** (`GPUComputationRenderer`, `examples/jsm/misc`) | ek modül (vendor'a eklenir) | parçacık/dalga simülasyonu GPU'da: konum+hız dokusu ping-pong; CPU döngüsü yok | ●● | A2 → R7, R8, R9 |
| Float / half-float render hedefi | `EXT_color_buffer_float` (`BKGL.probe` zaten sorguluyor) | HDR ara tamponlar, simülasyon dokuları | ●● | A1, A2 |
| Çoklu render hedefi (MRT) | `WebGLMultipleRenderTargets` | tek geçişte renk + kimlik/derinlik/normal | ●● | R9 picking, R11 |
| `Data3DTexture` | çekirdek | 3B LUT (renk derecelendirme), hacimsel gürültü, hacim verisi | ●● | R7 LUT, R6 |
| `compileAsync` + `KHR_parallel_shader_compile` | çekirdek (R2'de kullanılıyor) | ilk karede shader takılması yok | ● | hepsi |
| Son işlem geçişleri | `jsm/postprocessing` (ek vendor) | `BokehPass` (DOF), `SAOPass`/`SSAOPass` (AO), `SSRPass` (ekran-uzayı yansıma), `OutlinePass`, `LUTPass`, `AfterimagePass` (iz), `FilmPass`, `SMAAPass`/`TAARenderPass` (kenar yumuşatma), `OutputPass` (ton eşleme+renk uzayı) | ●●–●●●● | A1 (seçilenler) |
| Nesne yardımcıları | `jsm/objects` | `Lensflare`, `Reflector` (düzlemsel yansıma), `Sky`, `Water`, `Refractor` | ●●–●●● | R7, R8 |
| `RectAreaLight` + `RectAreaLightUniformsLib` | ek modül | stüdyo yumuşak kutu ışığı, doğru LTC speküler | ●●● | R6 (madalya anahtar ışığı) |
| `MeshPhysicalMaterial` | çekirdek | `iridescence`, `anisotropy`, `sheen`, `clearcoat`, `transmission`+`thickness`+`attenuationColor` | ●●●● (transmission ek geçiş) | R6, R9 |
| Kromatik dağılım (`dispersion`) | **r160'ta yok** (r163+) | — | — | özel shader ile sahtelenir (3 örnek ofset) |
| `ShaderMaterial` / `onBeforeCompile` (+`GLSL3`) | çekirdek | tüm özel efektler | değişken | hepsi |
| `Layers` + `MaskPass`/seçici bloom | çekirdek | yalnız seçilen nesneler parlar | ●● | R9 |
| `LOD`, `frustumCulled`, `drawRange` | çekirdek | uzak nesneye az üçgen, parçacık sayısını canlı değiştirme | ● | R7, R11 |
| `CompressedTexture` / `KTX2Loader` (+Basis transcoder) | ek modül + wasm | GPU'da sıkıştırılmış doku: 4–8× az bellek | ●; vendor boyutu ≈ yarım MB sınıfı (ölçülmedi) | R11 (isteğe bağlı) |
| `OffscreenCanvas` + Worker | tarayıcı + sınırlı three desteği | ana iş parçacığını boşaltma | — | R13 |
| `WebGPURenderer` | `jsm/renderers`, **deneysel** | compute shader, daha az CPU yükü | — | yalnız R13 karar kapısında değerlendirme |
| `EXT_disjoint_timer_query_webgl2` | tarayıcı (R2'de kullanılıyor) | kare başına GPU ms | 0 | A4 |

**Vendor politikası:** yeni `jsm` modülleri izinlidir (MIT lisanslı, three ile birlikte gelir); her eklenen dosya için **ham/gzip boyutu** `DEVIR`'e yazılır ve `sw.js` `FILES` listesine girer; yalnız ilgili aşama onu `import()` ile tembel yükler. Toplam eklenen vendor bütçesi: **≤ 120 KB gzip** (KTX2 transcoder hariç, o ayrı karar).

---

## 4. Performans mimarisi: ortak altyapı paketleri (A1–A6)

Premium görselliğin maliyeti **tek tek efektlerle değil, ortak altyapıyla** düşürülür. Bu altı paket R6–R9'dan önce (kısmen birlikte) yazılır.

### A1 — `BKFX`: tek, havuzlanmış son işlem zinciri
**Sorun:** her sahne kendi `EffectComposer`'ını kurar; geçişler tam çözünürlükte ve ayrı ayrı çalışır.
**Tasarım:**
- Tek zincir tanımı: `Render → (isteğe bağlı) DOF → Bloom(yarım çözünürlük, 5 mip) → **Uber geçişi** → Çıktı`.
- **Uber geçişi** tek `ShaderPass`: kromatik sapma + radyal/hareket bulanıklığı + lens bozulması + anamorfik flare birleşimi + 3B LUT derecelendirme + vinyet + film greni + dithering (IGN). Bugün lens/CA/grade ayrı geçişler; birleştirmek **tam ekran okuma sayısını azaltır** (bant genişliği, asıl maliyet).
- Render hedefi havuzu: aynı boyut/biçimdeki hedefler sahneler arasında paylaşılır (`BKGL` zaten bağlam kaybını izliyor; yeniden oluşturma tek yerde).
- Geçiş atlama: `uCA<ε`, `uLens=0`, `uBlur=0` ise ilgili dallar `if` ile (dinamik üniform dalı, tek bakış) ve bloom geçişi parlak piksel yoksa tamamen atlanır.
- Yarım çözünürlük bloom + `HalfFloatType`; DPR sınırı kalite seviyesinden gelir (A4).
**Hedef:** son işlem toplam maliyeti, bugünkü zincire göre **≥ %30 az** tam ekran okuma; hero toplam GPU ≤ 8 ms hedefi (R7) korunur.
**Kabul:** `perf.programs` ve `renderer.info.render.calls` ölçülür; yeni `tools/gpu_budget_audit.py` (A6) geçiş sayısını ve hedef sayısını sınırlar; R3 görsel kapısında hero altını **bilinçli** güncellenir.

### A2 — `BKSim`: GPU'da simülasyon (GPGPU)
**Sorun:** hero parçacıkları CPU'da güncelleniyor (56k; her kare JS döngüsü + `needsUpdate` yükleme). 10⁵–10⁶ parçacığa çıkmak CPU ile mümkün değil.
**Tasarım:**
- `GPUComputationRenderer` kalıbı: konum (RGBA32F/16F) ve hız dokusu, ping-pong; her parçacığın doku koordinatı `uv` olarak bir öznitelikte; **vertex shader konumu dokudan okur** (`texture2D(tPos, aRef)`), çizim yine **tek `Points` çağrısı**.
- Simülasyon fiziği tek `ShaderMaterial`: galaktik dönme (Kepler benzeri `v ∝ r^-0.5` yumuşatılmış), spiral kol yoğunluk dalgası, imleç çekimi (kütle çekimi sapması), tıklama şok dalgası (halka yayılımı), eğrilik (curl) gürültü türbülansı.
- Doku boyutu = parçacık sayısı: 256² = 65 536 · 512² = 262 144 · 1024² = 1 048 576.
- Float render hedefi yoksa (`BKGL.probe`) **otomatik geri dönüş**: bugünkü CPU yolu (56k).
- `drawRange` ile kalite seviyesinde parçacık sayısı canlı düşer (yeniden oluşturma yok).
**Bellek:** 512² RGBA32F ≈ 4 MB/doku × (konum 2 + hız 2) ≈ 16 MB; 1024² dört kat (≈ 64 MB, yalnız seviye 0'da ve yalnız `maxTextureSize ≥ 2048` + yeterli bellek sinyali varsa).
**Kabul:** yazılımsal GL'de simülasyon deterministik (`BKGL.reseed`, sabit `dt`) ve `?still=1` görüntüsü kararlı; parçacık sayısı seviyeye göre `drawRange` ile ölçülür (`BKHero.info()` yeni alan); CPU'da `Float32Array` güncelleme süresi ≈ 0 (profilde ölçülür).

### A3 — `BKShaders`: ortak GLSL parça kitaplığı
Tek dosya (`site/shaders.js`, `window.BKShaders`), **sürümlü parçalar** (`#include` benzeri string enjeksiyonu, shader önbellek anahtarı disiplini: `customProgramCacheKey`):
`hash/IGN dithering`, `simplex + curl gürültü`, `fbm`, `domain warp`, SDF primitifleri (kutu, silindir, yay, soft-union), `blackbody/B-V renk eğrisi` (1B LUT dokusuna pişirilir), `ACES + AgX benzeri` ton eşleme (R4 `acestone` ile hizalı), `LUT3D örnekleme`, POM (paralaks-oklüzyon) yardımcıları, `fwidth` tabanlı eğrilik/çizgi kalınlığı, hacimsel koni ışını adımlama, Gerstner/halka dalga yardımcıları.
**Kural:** aynı fonksiyonun ikinci kopyası yasaktır; `tools/materials_audit.py` kalıbıyla **statik denetim** (`shaders_audit.py`): shader metinlerinde tekrarlanan `float hash(` benzeri tanımları sayar.

### A4 — Kare bütçesi yöneticisi ve adaptif çözünürlük
R2'nin GPU ms ölçümünü **karar mekanizmasına** bağlar:
1. Hedef: yüzey başına GPU ms bütçesi (bkz. §6). Ölçülen > bütçe → merdiven (histerezisli, 1,5 sn aşağı / 6 sn yukarı):
   **efekt atla** (flare, DOF) → **iç çözünürlük** (`0.85 → 0.7 → 0.5` ölçek, kenar keskinliği için ardından FXAA benzeri) → **parçacık/örnek sayısı** (`drawRange`) → **malzeme seviyesi** (mevcut `lighter()`).
2. **Dinamik çözünürlük** (DPR yerine render hedefi ölçeği): etkileşim anında (sürükleme, dalış) kısa süreli düşür, durunca keskinleştir ("progressive refinement": durağan karede TAA/biriktirmeyle 8 kare üstüne yaz).
3. Kararlar `?perf` panelinde ve `BKGL.log`'da görünür; her indirme **neden** ile kaydedilir.
**Kabul:** yazılımsal GL'de (GPU zamanlayıcı yok) rAF yolu devreye girer; `feature_audit` B10 genişler: yapay yük verildiğinde merdiven **sırayla** iner ve yük kalkınca **histerezisle** çıkar (zaman penceresi ölçülür).

### A5 — Varlık ve bellek hattı
- **Doku politikası:** tek yerde `anisotropy = min(16, GPU)` (kitap sayfası 2× için R5'te var), mipmap açık/kapalı kararı, `colorSpace` doğruluğu.
- **Prosedürel doku önbelleği:** kapak/yaprak/kenar dokuları `OffscreenCanvas`+`ImageBitmap` ile boşta üretilir (ana iş parçacığında `getImageData` döngüleri yok; bugünkü `normalFromHeight` CPU döngüsü ≈ 0.4 M piksel/kitap).
- **Bellek bütçesi:** `renderer.info.memory.textures` + tahmini MB tablosu `?perf`'te; üst sınır aşılırsa en pahalı tembel doku (2× sayfa, 1024² simülasyon) düşer.
- **Dispose disiplini (v121 dersi):** render hedefleri, ışık gölge haritaları, `Reflector`/`WebGLRenderTarget`, GPGPU dokuları ve havuz hedefleri için **tek `dispose` sözleşmesi** (`disposeItem` genişler); `leak_audit` doğrusal büyümeyi eğimle yakalar (bkz. A6).
- İsteğe bağlı **KTX2**: yalnız R11 duvar atlası ölçülmüş bir bellek sorunu gösterirse.

### A6 — Test ve ölçüm altyapısı (yeni/genişleyen denetimler)
| Araç | Yeni davranış | Neden |
|---|---|---|
| `tools/gpu_budget_audit.py` (yeni) | yüzey başına `renderer.info`: çizim çağrısı, üçgen, program, render hedefi sayısı **üst sınırları** (yazılımsal GL'de de geçerli, yapısal) | bütçeyi sayısal kapıya bağlar |
| `tools/leak_audit.py` | `--rounds 40`, doku/geometri sayısına **doğrusal eğim** testi: son yarının eğimi > 0,1/tur ise **FAIL** (bugünkü +24 eşiği sızıntıyı kaçırdı) | v121 dersi |
| `tools/visual_audit.py` | yeni yüzeyler (hero sinema karesi, madalya, silüet gündüz/gece, duvar) + **ince değişim toleransı** tablosu (yüzey başına `tol`/`limit`; v120'de açık kitap için yapıldı) + **sabit sunucu portu** (görsel yakalamada URL metni sahte fark üretiyor) | kör kapıyı önler |
| `tools/shaders_audit.py` (yeni) | kopya fonksiyon, eksik `customProgramCacheKey`, `onBeforeCompile` anahtarsız kullanım | A3 disiplini |
| `feature_audit` B10/B11 | A4 merdiveni, `compileAsync` ısıtma, Long Task | A1–A4 |
**Kural:** her aşamanın ilk işi kendi kabul testini yazıp **kırdığını göstermektir** (proje kuralı).

---

## 5. Kalite katmanı modeli

Mevcut seviye numaraları korunur (0 en yüksek … 4 CSS). Adlar belgeleme içindir.

| Seviye | Ad | Kim | İçerik özeti |
|---|---|---|---|
| **0** | Sinema | güçlü GPU, GPU ms bütçe altında | GPGPU 262k–1M parçacık, DOF, anamorfik flare, 3B LUT, POM, transmission, planar yansıma, gölge, TAA/biriktirme, 2× doku |
| **1** | Yüksek | iyi GPU / orta yük | GPGPU 131k, DOF kapalı, flare ucuz sprite, POM 8 adım, transmission kapalı (ucuz cam), planar yansıma ½ çözünürlük |
| **2** | Orta | zayıf GPU / yüksek yük | parçacık 56k (CPU eşdeğeri), bloom yarım, LUT sabit, yansıma şerit, normal harita yok (`lighter` seviye 2) |
| **3** | Düşük | çok zayıf / pil tasarrufu | parçacık 14k, post yalnız çıktı, boşta kutular 15 fps, malzeme Lambert/Basic |
| **4** | CSS | WebGL yok/bozuk | CSS kapak ve DOM (bugünkü yol) |

Her aşama belgesi bir **özellik × seviye tablosu** içerir; tabloda olmayan özellik seviye 0'dadır ve seviye ≥ 1'de kapalıdır (varsayılan güvenli).

---

## 6. Yüzey başına kare bütçesi (hedef, ölçülmemiş)

Orta sınıf entegre GPU'yu **taban** alan hedefler (1080p'ye eşdeğer piksel). Birim: GPU ms/kare.

| Yüzey | Seviye 0 hedef | Seviye 1 | Seviye 2 | Çizim çağrısı üst sınırı (S0) | Not |
|---|---|---|---|---|---|
| Hero galaksi + kubbe | ≤ 8 | ≤ 6 | ≤ 4 | 14 | R7 |
| Zemin (hero'ya ek) | + ≤ 1,5 | + 1,0 | + 0,5 | +6 | R8 (mevcut hedef) |
| Silüet | ≤ 8 | ≤ 6 | ≤ 4 | 16 | R9 |
| Açık kitap | ≤ 6 | ≤ 4 | ≤ 3 | 22 | R5/R6 (mevcut hedef) |
| Madalya (atlas) | ≤ 5 | ≤ 3,5 | ≤ 2,5 | 14 | R6 |
| Kütüphane duvarı | ≤ 8 | ≤ 6 | ≤ 4 | 8 | R11 |
| Geçiş (iki sahne) | ≤ 10 geçici | ≤ 7 | — | 20 | R10 |

Bütçe aşılırsa **kabul edilmez**, A4 merdiveni ya da özellik düşer; bütçeyi büyütmek ayrı gerekçeli karardır.

---

## 7. Kural kitabı (tüm premium aşamalar için)

1. **Flag + geri dönüş:** her özellik `BKGL.flags` ile kapanır; kapalıyken eski görüntü birebir (R3 kapısı bunu kanıtlar).
2. **Test önce:** ölçülebilir kabul testi yazılır, kırıldığı gösterilir, sonra uygulanır.
3. **Deterministik:** `?still=1` altında zaman sabit, rastgelelik tohumlu (`BKGL.reseed`); GPGPU simülasyon sabit `dt` ile kararlı.
4. **Bütçe:** yüzey bütçesi (§6) ve A6 sınırları aşılamaz.
5. **Erişilebilirlik eşdeğeri:** her radikal görsel için `prefers-reduced-motion`, `prefers-contrast`, fotosensitivite sınırı (R12) ve klavye/metin eşdeğeri.
6. **Dış istek yok:** çalışma zamanında ağ yok; vendor yalnız repoda.
7. **Dispose sözleşmesi:** her yeni GPU kaynağı (hedef, doku, gölge) `disposeItem`/`BKGL` sözleşmesine kayıtlı; `leak_audit` eğim testi geçer.
8. **Belge:** her aşama `YOL-HARITASI-3D.md` §0 satırını ve `DEVIR-FAZ-4.md` bölümünü **aynı PR'da** günceller (belge için ayrı PR yok); bütçe tablosu (§6) ölçülen değerle güncellenir.
9. **Küçük PR'lar:** aşamalar alt adımlara bölünür (her alt adım ayrı PR, kendi testi, kendi altın güncellemesi); büyük görsel değişiklikte altınlar `Update visual goldens` ile CI'da üretilir ve **yalnız beklenen yüzeylerin** değiştiği doğrulanır.

---

## 8. Sıralama ve bağımlılıklar

```
A6 (test) ─┬─ A3 (shader kitaplığı) ─┬─ A1 (BKFX) ─┬─ R7 hero  ──┬─ R8 zemin ── R9 silüet ── R10 geçişler
           │                          │             │             │
           ├─ A2 (BKSim) ─────────────┘             └─ R6 madalya └─ R11 duvar ── R12 erişilebilirlik ── R13 (karar kapısı)
           └─ A4 (bütçe) ── A5 (varlık/bellek)
```

- **Önce:** A6 (testler), A3, A1, A4. Sonra A2 ile birlikte **R7** (ana sayfada en görünür kazanç, A1+A2'nin kanıtı).
- R6, R8, R9 birbirinden bağımsız (A1/A3 sonrası); R8, R9'un yansıma altyapısını paylaşır (`Reflector`/yansıma hedefi tek yerde).
- R10, hero/silüet/takımyıldızı sahneleri hazır olunca; R11 bağımsız ama A5'e (atlas/bellek) dayanır.
- R12 **her aşamayla paralel** ilerler (her aşamanın kabulünde erişilebilirlik eşdeğeri zorunlu), ayrı oturumda toplu denetim.
- R13 yalnız `?perf` verisi ana iş parçacığı sıkışması gösterirse.

**Oturum sayısı tahmini (alt adım = 1 oturum):** A-paketleri ≈ 5–6, R7 ≈ 5, R6 ≈ 5, R8 ≈ 3, R9 ≈ 4, R10 ≈ 4, R11 ≈ 5, R12 ≈ 3, R13 ≈ 2 (karar kapısı dahil). Toplam ≈ 36 oturum; öncelik değişirse sıralama değişir.

---

## 9. Risk kaydı

| Risk | Olasılık | Etki | Önlem / geri dönüş |
|---|---|---|---|
| GPGPU float doku desteği zayıf cihazlarda yok | orta | yüksek | `BKGL.probe` + CPU geri dönüşü (bugünkü yol korunur); seviye 2'de zaten CPU |
| Uber shader'ın derleme süresi uzun | orta | orta | `compileAsync` ısıtma (R2), dallar üniform ile; gerekirse 2 uber varyantı |
| Bloom/flare fotosensitif | düşük | yüksek | R12 yoğunluk sınırı + "güvenli mod"; flare yalnız yıldız parlaklığına bağlı, titreşimsiz |
| Bellek (1024² simülasyon, 2× doku) | orta | orta | A5 bellek bütçesi; seviye 0'da ve yalnız yeterli sinyalde |
| Görsel kapı yeni yüzeylerde kararsız | orta | orta | tohumlu simülasyon, sabit port, yüzey başına tolerans, kararlılık testi kırmızıysa altın alınmaz |
| Kapsam şişmesi | yüksek | yüksek | her aşama alt adımlara bölünür; "radikal" tanımı (§1) ve bütçe (§6) kapı görevi görür |
| Yazılımsal GL hareketi göstermez | kesin | orta | yapısal kabul (sayı, kare, bellek) + durağan görüntü; hareket kalitesi tasarım incelemesi |

---

## 10. Terimler
**POM** paralaks-oklüzyon haritalama · **GPGPU** GPU üzerinde genel amaçlı hesaplama (burada float dokularla) · **MRT** çoklu render hedefi · **LUT** renk arama tablosu · **DOF** alan derinliği · **IGN** interleaved gradient noise (dithering) · **TAA** zamansal kenar yumuşatma · **LOD** ayrıntı düzeyi · **BKFX/BKSim/BKShaders** bu belgede önerilen yeni ortak modüller (henüz yok).
