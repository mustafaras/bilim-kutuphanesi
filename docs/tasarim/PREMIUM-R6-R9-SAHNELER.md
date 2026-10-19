# Premium aşama ayrıntıları: R6 madalya · R7 hero galaksi · R8 zemin · R9 silüet

> Ana belge: `PREMIUM-GORSEL-VIZYON.md` (ilkeler §1, yetenek envanteri §3, altyapı A1–A6 §4, seviyeler §5, bütçe §6, kural kitabı §7). Önce onu oku.
> Durum: **tasarım; kodlanmadı.** Sayılar hedeftir, ölçülmemiştir. Her aşama alt adımlara (PR) bölünür; her alt adımın kendi testi vardır.
> Gösterim: **[S0]** seviye 0 (Sinema) · **[S1]** seviye 1 · **[S2]** seviye 2 · **[S3]** seviye 3.

---

# R6 — Madalya ve Nobel arşivi nesneleri: "Müzeden çıkmış nesne"

## Vizyon
Atlas sayfasında Nobel madalyası tek başına, karanlık bir vitrinde duruyor. İmleç hareket ettikçe **ışık madalyanın üstünde gezer**; yüzeydeki kabartma, kamera yaklaştıkça **gerçek derinlik** kazanır (ışığa göre gölgelenen oluklar); iridescence (ince film) altının üstünde **renk kayması** yapar; kenar tırtılları gerçek bir geometri; toz parçacıkları ışık huzmesinde asılı. Cam atlas nesneleri (atom, DNA, küre) **kalınlıklı gerçek cam**: arkadaki dünya kırılarak görünür, kenarlarda renk ayrışır.
Hedef izlenim: "ekran görüntüsü değil, bir nesneye bakıyorum".

## Bugünkü durum
`stage.js` madalya bölümü: kabartma yüzü `reliefOf(k)` yükseklik alanı → `normalFromHeight` normal haritası; `BKMaterials.foil` + `brass`; kenar tırtılı = normal haritası (`reed`), `TorusGeometry` kenar; 6 yüz (`faces`), `info()` testi (`B6`). Atlas camları: `transparent + clearcoat + env` (ucuz yol).

## Radikal fikirler ve teknik tasarım

### R6.1 Paralaks-oklüzyon haritalı kabartma (POM)
- **Ne:** normal haritası yalnız ışık yanılsaması verir; POM, bakış açısıyla **UV'yi yüksekliğe göre kaydırır** (kabartma yaklaşırken "derinlik" kazanır; siluet değil ama güçlü paralaks).
- **Nasıl:** `onBeforeCompile` ile `map_fragment` öncesinde ışın-yükseklik adımlama: bakış vektörünü teğet uzayına çevir, `N` adım (S0: 16, S1: 8, S2: kapalı) boyunca yükseklik dokusunu örnekle, kesişimde dur (+1 adım doğrusal interpolasyon, "relief" iyileştirme). Aynı kaydırılmış UV tüm haritalarda (renk, roughness, metalness, normal) kullanılır → tutarlı.
- **Veri:** yükseklik alanı zaten üretiliyor (`reliefOf`); 512² → **1024²** (R8 bitiş), tek kanal (R). `BKShaders.pom(...)` (A3).
- **Kapanma yolu:** seviye ≥ 1'de adım 8, ≥ 2'de kapalı (yalnız normal harita; bugünkü görünüm).
- **Maliyet notu:** POM piksel başına N doku okuması; madalya ekranın küçük bir kısmı olduğundan toplam düşük, ama tam ekran okuma sahnesinde sınır: yalnız madalya karosu, `scissor` içinde.

### R6.2 İnce-film iridescence + kalınlık haritası
- `MeshPhysicalMaterial.iridescence` var (R4). Bugün kalınlık **sabit aralık** `[180,420]` nm. **Fikir:** `iridescenceThicknessMap` (yeşil kanal) — gürültü + yüksekliğin türevi (kabartma kenarlarında ince, oluklarda kalın) → renk kayması **kabartmayı izler**. Tek doku, çizim maliyeti ≈ 0.
- Yüz başına farklı `ior`/kalınlık (6 yüz: fizik, kimya, tıp, edebiyat, barış, ekonomi) → her yüzün kendi renk karakteri.

### R6.3 Gerçek geometri: defne çelengi ve tırtıl
- **Defne çelengi:** `ExtrudeGeometry` (kıvrık yaprak şekli, `bevelEnabled`, 2–3 segment) × **instancing** (≈ 48 yaprak, her yaprak 12 öznitelik rastgele açı/boyut, tohumlu). Yüzeyin üstünde **0.6–1.2 mm** gerçek derinlik; gölge ve speküler doğal gelir. (Bugün normal haritasında.)
- **Kenar tırtılı:** `InstancedMesh` ≈ 180 küçük silindir/prizma diş (tek çizim çağrısı); S2'de bugünkü `reed` normal haritası.
- **Üçgen bütçesi:** çelenk ≈ 48 × ~280 = 13 k; tırtıl ≈ 180 × 24 = 4,3 k; toplam madalya ≈ 25–30 k üçgen (hedef üst sınır 40 k).

### R6.4 Anahtar ışık: imleci izleyen **RectAreaLight**
- **Ne:** stüdyoda yumuşak kutu ışığı. `RectAreaLight` (LTC tabanlı, gerçekçi uzamsal speküler yansıma — madalya yüzünde **dikdörtgen yansıma** görülür; bu, "gerçek metal" izleniminin en güçlü işaretidir).
- **Davranış:** ışık, imleç konumuna **yay sönümlemeli** (kritik sönümlü) hareketle yönelir; boşta yavaş "nefes" (±3° sinüs).
- **Maliyet:** `RectAreaLightUniformsLib` (ek modül, küçük) + LTC dokuları (2×64²); gölge yok (RectAreaLight gölgesiz). S1'de yön ışığına (`DirectionalLight`) düşer; S2'de yalnız ortam ışığı (PMREM) + sabit yön.
- **Dikkat:** `BKMaterials` seviyeleri (`lighter()`) `MeshStandardMaterial`/Lambert'e inince `RectAreaLight` etkisi azalır; görsel kimlik için S1'de **sahte dikdörtgen yansıma sprite'ı** (envMap'e pişirilmiş yumuşak kutu, R4 PMREM'e yeni kutu) eklenir.

### R6.5 Toz ve kıvılcım
- **≤ 200 örnek** (`InstancedMesh`/`Points`), ışık huzmesinde yavaş curl-noise sürüklenmesi (GPU'da vertex shader içinde, simülasyon dokusu **gerekmez**: konum = f(başlangıç, zaman)). Yalnız ışık konisi içinde parlak (mesafe/koni maskesi), konidışı görünmez → derinlik hissi.
- Madalya yüzü değişirken (6 yüz) **bir kez** parıltı patlaması (30 kıvılcım, 400 ms, sönümlü); `prefers-reduced-motion`'da yok.
- Deterministik: tohum + zaman parametresi; `?still=1`'de sabit.

### R6.6 Kalınlıklı cam atlas nesneleri (transmission)
- `MeshPhysicalMaterial.transmission` + `thickness` + `ior` + `attenuationColor/Distance` (three, arka planı **ayrı bir geçişte** render hedefine alıp kırar). Pahalı olduğu için **yalnız aktif (hover/odak) karo** ve yalnız S0.
- **Sahte kromatik dağılım** (r160'ta `dispersion` yok): fragment'ta kırılma vektörünü 3 kanal için küçük ofsetle örnekle (3 transmission örneği) — yalnız S0'da.
- S1: bugünkü ucuz yol (`transparent + clearcoat + env`) + kenar fresnel parıltısı; S2: opak yarı saydam.
- **Önemli:** transmission'ın ek geçişi paylaşılan renderer'da `scissor` ile karo boyutuna sınırlanır; aynı karede yalnız **bir** transmission nesnesi.

## Seviye tablosu (R6)
| Özellik | S0 | S1 | S2 | S3 |
|---|---|---|---|---|
| POM | 16 adım | 8 | kapalı (normal harita) | kapalı |
| İridesans kalınlık haritası | evet | evet | sabit aralık | yok |
| Defne/tırtıl geometrisi | gerçek | gerçek (az yaprak) | normal harita (bugün) | normal harita |
| RectAreaLight | evet | yön ışığı + sahte yansıma | ortam | ortam |
| Toz/kıvılcım | 200 | 100 | yok | yok |
| Cam transmission | aktif karo | ucuz yol | opak | opak |

## Alt adımlar (her biri ayrı PR)
1. **R6.a** yükseklik 1024² + POM + iridesans haritası (madalya yüzü). 2. **R6.b** gerçek defne/tırtıl geometrisi. 3. **R6.c** `RectAreaLight` + sahte yansıma geri dönüşü. 4. **R6.d** toz/kıvılcım. 5. **R6.e** transmission cam + sahte dağılım. Her adımda B6 genişler.

## Kabul testleri (sayısal)
- `feature_audit` **B6**: `faces`=6; `heightTex` 1024²; POM adımı seviyeye göre (16/8/0) `BKStage.medal.info()`'dan okunur; defne `InstancedMesh.count` ≥ 40; tırtıl sayısı ≥ 150; toz ≤ 200 ve S1'de ≤ 100; seviye 2'de transmission ve POM **kapalı** (`diag`).
- `gpu_budget_audit`: madalya karosu çizim çağrısı ≤ 14, üçgen ≤ 40 k, program ≤ 6.
- `visual_audit`: madalya (6 yüz) altınları bilinçli güncellenir; yalnız madalya yüzeyi değişir (diğer yüzeyler 0,0000).
- `leak_audit --rounds 40`: eğim testi (A6) geçer; transmission render hedefi `dispose` sözleşmesinde.
- Bütçe: madalya S0 ≤ 5 ms hedef (`?perf` ile ölçülür, §6).

## Riskler
POM kenarlarda "yüzme" artefaktı (bakış açısı çok eğik): adım sayısı + kenar solma. Transmission ek geçişi paylaşılan renderer'da `scissor` ile çakışırsa → karo-yerel hedef. RectAreaLight + `lighter()` uyumsuzluğu → seviye tablosu. **Dosyalar:** `stage.js` (madalya), `materials.js` (POM/iridesans fabrikası), `shaders.js` (A3).

---

# R7 — Hero galaksi ve kubbe: "Galaksi bir sinema sahnesi"

## Vizyon
Açılışta kamera karanlıktan **yavaşça** sahneye girer: önce soğuk mavi bir ışık, sonra galaksinin **gerçek spiral kolları** (yoğunluk dalgası) ve kollar boyunca **koyu toz şeritleri** belirir; parlak yıldızlarda **kırınım ışınları**, çekirdekte **sıcak ışıma**. Kayıt parçacıkları (3 600) sönük genel galaksi içinde "veri yıldızı" olarak ayrışır. İmleç, ışığı bükerek yerçekimi merceği gibi çalışır. Kubbe: tıklanan yıldıza teleskop **yay sönümlemeyle** döner, mercekten flare gelir, kubbe yarığından **hacimsel ışık huzmesi** iner.
Hedef izlenim: "bilimsel belgesel açılışı", 10⁵–10⁶ yıldız.

## Bugünkü durum
`hero3d.js`: 56 000 / 14 000 parçacık (CPU konum güncellemesi), 3 600 / 1 200 kayıt parçacığı, 3 200 / 900 arka plan yıldızı, meteorlar; `EffectComposer` (Render + lens/CA/blur `ShaderPass` + `UnrealBloomPass` + `grade` `ShaderPass`); GPU imleç çekimi ve şok dalgası (shader içinde); karanlık temada tam, açık temada sade.

## Radikal fikirler ve teknik tasarım

### R7.1 GPU simülasyonlu galaksi (A2) — 262 144 → 1 048 576 yıldız
- Konum/hız dokuları (§A2). Başlangıç dağılımı **logaritmik spiral kollar**: yarıçap `r`, açı `θ = b·ln(r/r0) + kol_ofseti` + gürültü dağılımı; z'de ince disk (Gauss) + şişkin merkez (bulge: üstel).
- **Yoğunluk dalgası teorisi benzeri:** kollar sabit desen hızında (`Ωp`) döner, yıldızlar ise diferansiyel dönme (`Ω(r)`) ile → kollar boyunca yıldızlar yığılır/dağılır; kol, parçacıkların *kendisi* değil **desen**, doğal görünür. Simülasyon shader'ı: `θ += Ω(r)·dt`; kol yoğunluğu parlaklığı modüle eder (`brightness *= 1 + A·cos(m(θ − Ωp t) − k·ln r)`).
- **İmleç çekimi:** kütle çekimi sapması (`Δv ∝ −(x−p)/(|x−p|²+ε)`), kısa menzilli; **tıklama şok dalgası**: halka içinde radyal itki (zaten var, GPU'ya taşınır).
- **Yaşam ve renk:** her parçacığın `aT` (tür/sıcaklık) özniteliği → B-V benzeri **kara cisim LUT** (1B doku, A3): çekirdek sıcak sarı-beyaz, kollar mavi, bulge kırmızımsı.
- **Çizim:** tek `Points`; yıldız boyutu `gl_PointSize = f(mutlak parlaklık, mesafe, DPR)`; yumuşak SDF sprite (disk + gaussian halo); `drawRange` ile kalite.
- **Deterministik:** tohumlu başlangıç + sabit `dt` + `uTime` yalnız görsel (`?still`'de sabit).

### R7.2 Toz şeritleri (koyulaştıran ikinci geçiş)
- Gerçek galakside kolların iç kenarında toz **ışığı emer**. İki seçenek, **ölçümle seçilir**:
  - **(a) Alfa-çarpma katmanı:** toz parçacıkları (≈ 40 k) *çarpma/koyulaştırma* karışımıyla (`MultiplyBlending` benzeri özel `blendFunc`) yıldız katmanının **üstüne** çizilir.
  - **(b) Düşük çözünürlüklü emisyon-soğurma dokusu:** disk düzlemine yansıtılmış 512² "optik derinlik" dokusu (fbm + spiral desen); yıldız fragment'ı `exp(−τ)` ile çarpılır (tek doku okuması, çok ucuz). **Tercih (b)**; (a) yedek.
- Toz şeridi **kırmızımsı ışık saçılması** ekler (toz kenarında hafif turuncu), kollar arasında HII bölgeleri (≈ 120 pembe emisyon sprite'ı).

### R7.3 Parlak yıldızlarda kırınım ışınları ve anamorfik flare
- **Kırınım spike'ı:** yalnız en parlak ≈ 300 yıldız için ayrı `InstancedMesh` quad'ı (4/6 ışınlı SDF), boyut ve yön tohumlu; parlaklık eşiğinin üstünde. **Titreşimsiz** (fotosensitivite, R12).
- **Anamorfik yatay flare:** bloom'un yatay uzatılmış varyantı: parlak-geçiş mip'inin **ayrılabilir geniş yatay bulanıklığı** (yalnız 2 çok geniş tek eksen geçişi, yarım çözünürlük) → sinematik mavi yatay çizgi (yalnız en parlak yıldızlarda, `UnrealBloom` ile aynı parlak-geçiş girdisini paylaşır → ek parlak-geçiş maliyeti yok).
- **Mercek yansımaları:** `Lensflare` (jsm/objects; **tek** kaynak: kubbe lambası/güneş yıldızı) — S0; S1 ucuz sprite.

### R7.4 3B LUT renk derecelendirme + sinematik son işlem (A1 uber)
- **16³ → 32³ prosedürel `Data3DTexture`**, tema başına (koyu: soğuk gölge/sıcak parlak, "teal & amber" değil — arşivin pirinç/mavi paletinden: gölgelerde derin mavi-mor, parlaklarda pirinç); `LUTPass` yerine **uber geçişin içinde** üç-doğrusal örnekleme.
- Film greni **zamana bağlı** (tohum + kare), yoğunluk düşük (~%2); vinyet; **kenarda kromatik sapma** (mevcut; ince ayar); `OutputPass` benzeri ton eşleme uber'de.
- **Derinlik hissi:** boyuta bağlı sahte DOF — yakın büyük parçacıklar yumuşak halo (nokta boyutu ↑, alfa ↓), uzak küçük keskin; gerçek `BokehPass` yalnız S0 ve yalnız "keşif" kamerası yavaşken (hareketsiz karede).

### R7.5 Kubbe sinematiği
- **Teleskop yönelmesi:** tıklanan yıldıza `lookAt` hedefi **yay-sönüm** (ωn, ζ=0.8) ile; kamera pozisyonu hafif "itme" (dolly 2–4%); yönelme sırasında hareket bulanıklığı (uber'de radyal, hız tabanlı).
- **Hacimsel ışık konisi:** kubbe yarığından inen koni: ekran-uzayı ışın adımlama, **çeyrek çözünürlük**, 24 adım, gürültü ile ofset (banding yok), koni içi yoğunluk = `fbm(x·f + t)`; sonuç ekleme karışımıyla birleştirilir. S1: 12 adım; S2: sabit gradyan sprite.
- **Kamera giriş uçuşu:** ilk yüklemede 2,4 sn "sinematik giriş" (z: −6 → 0, hafif spiral), kullanıcı etkileşimi (kaydırma/dokunma) anında **iptal**; `reduced-motion`'da kesme.

### R7.6 Seçim (picking)
- Bugünkü ekran-uzayı analitik izdüşüm korunur. GPU **renk-kimliği tamponu** yalnız analitik yol 3 ms'yi aşarsa (ölçülür; gereksizse yapılmaz) — A4 ölçümü karar verir.

## Seviye tablosu (R7)
| Özellik | S0 | S1 | S2 | S3 |
|---|---|---|---|---|
| Parçacık | 262 144 – 1 048 576 (GPGPU) | 131 072 (GPGPU) | 56 000 (CPU yolu) | 14 000 |
| Spiral kollar + toz | tam | tam (toz dokusu) | yalnız kollar | düz |
| Kırınım ışınları | 300 | 120 | yok | yok |
| Anamorfik flare | evet | ucuz sprite | yok | yok |
| `Lensflare` | evet | sprite | yok | yok |
| 3B LUT (32³) | evet | 16³ | sabit | yok |
| DOF (gerçek) | durağan karede | yok | yok | yok |
| Hacimsel koni | 24 adım ¼ çöz. | 12 adım | gradyan sprite | yok |
| Film grenı / CA | evet | CA | yok | yok |

## Alt adımlar (her biri ayrı PR)
1. **R7.a** A1 `BKFX` uber geçişi + 32³ LUT + sinematik derecelendirme (hero altını bilinçli günceller). ✅ **tamam (v123)** 2. **R7.b** A2 simülasyon + 262 144 parçacık + spiral kollar. ✅ **tamam (v124** — `BKSim` + B14; `rt` bugün 16, ≤ 6 hedefi A4/`BKFX` havuzu paylaştıkça gelecek; `particles`/`sim`/seviye sayımları ve `?still` donması B14'te)**. 3. **R7.c** toz dokusu + HII + kara cisim LUT. ✅ **tamam (v125** — `uSky` toz deseni (τ + dalga kazancı), `uLut` kara cisim paleti (B-V indeksli yaklaşık IMF), kızarmış şerit kenarları, 150 HII sprite'ı, çekirdek parıltısı; test B15; hero program bütçesi 26 → 28)**. 4. **R7.d** kırınım ışınları + anamorfik flare + `Lensflare`. 5. **R7.e** kubbe: yay-sönüm yönelme + hacimsel koni + giriş uçuşu. 6. **R7.f** 1 048 576 seviyesi (yalnız bellek sinyaliyle) ve A4 ayarı.

## Kabul testleri (sayısal)
- **B9** (bozuk-GPU) geçer; seviye 3'te parçacık, LUT, flare, koni **kapalı** (`BKHero.info()`).
- `BKHero.info()`: `particles` (S0 ≥ 262 144; S1 131 072; S2 56 000; S3 14 000), `sim:'gpu'|'cpu'`, `passes` ≤ 5 (Render, Bloom, Uber + isteğe bağlı DOF/flare), `rt` (render hedefi sayısı) ≤ 6.
- `gpu_budget_audit`: hero çizim çağrısı ≤ 14, program ≤ 12, **CPU konum güncellemesi 0 bayt/kare** (S0/S1).
- `?still=1`: GPGPU simülasyon iki yakalamada fark < %0,1 (tohumlu); R3 altınları hero için bilinçli güncellenir (yalnız hero).
- `leak_audit --rounds 40` eğimi ≤ 0,1/tur (GPGPU hedefleri ve LUT `dispose`).
- Bütçe: hero S0 ≤ 8 ms hedefi `?perf` ile ölçülür, aşılırsa A4 merdiveni devreye girer ve alt adım **kabul edilmez**.
- Reduced-motion: giriş uçuşu ve yönelme **kesme**; kırınım/flare parlaklığı titreşimsiz (R12).

## Riskler
Float RT yok → CPU yolu (bugünkü). Uber shader derleme süresi → `compileAsync` ısıtma. Toz soğurması "kirli" görünebilir → τ üst sınırı ve tema başına ayar. 1 048 576 parçacık bellek (≈ 64 MB sim dokuları) → yalnız sinyalle. **Dosyalar:** `hero3d.js`, `fx.js` (yeni A1), `sim.js` (yeni A2), `shaders.js` (A3), `gl.js` (probe: float RT).

---

# R8 — Zemin ve atmosfer: "Cilalı gece mermeri"

## Vizyon
Zemin siyah-mavi, **cilalı bir mermer yüzey**: galaksi, kubbe ışığı ve kule/yıldız yansımaları **bulanıklaşan, mesafeyle sönen** gerçek bir yansıma olarak yüzeyde görünür. İmleç ya da tıklama zeminde **gerçek dalga denklemiyle** yayılan halkalar bırakır (girişim, sönüm, kenardan yansıma). Ufukta alçak sis; kubbe lambasının zeminde **ışık havuzu** ve havuzda hareket eden **kostik** deseni.

## Bugünkü durum
`ground3d.js` (85 satır): kontur çizgileri, dalga halkaları (analitik), şerit yansıma; hero `Points` galaksisine yansıma yalnız şerit.

## Radikal fikirler ve teknik tasarım

### R8.1 Düzlemsel yansıma (planar) + pürüzlülük bulanıklığı
- `Reflector` kalıbı: sahneyi zemin düzlemine göre **aynalı kamerayla** düşük çözünürlüklü render hedefine çiz (**½ çözünürlük**, S1: ¼), yalnız yansıyan **katmanları** (`Layers`): galaksi parçacıkları + kubbe lambası + kule/madalya yok. Eğik clip düzlemi (`clippingPlanes`) ile zemin altı kesilir.
- **Pürüzlülük bulanıklığı:** yansıma dokusunun mip zinciri (mip bias) + yüzey gürültüsünden türeyen normal ile bozulma; **mesafeyle sönme** (fresnel + mesafe), uzak yansıma daha bulanık (cilalı mermer + hafif mat).
- **Maliyet kontrolü:** yansıma hedefi **her karede değil, her 2. karede** (hero hareketliyken) ve kamera durgunken biriktirmeyle yenilenir; hero parçacıkları ucuz katmanda (S1: 14k alt küme çizilir).
- S2/S3: bugünkü şerit yansıma (yedek).

### R8.2 Dalga denklemi simülasyonu (GPGPU) → normal haritası
- A2 ile **256² float doku**, ping-pong: `h_{t+1} = 2h_t − h_{t−1} + c²·dt²·∇²h_t − d·(h_t − h_{t−1})` (2B dalga denklemi, sönüm `d`, kenarda emici/yansıtıcı sınır). İmleç hareketi ve tıklama **yükseklik darbesi** (gauss) ekler.
- Sonuç yükseklik alanından **normal haritası** türetilir (merkezi fark) → zemin normali + yansıma bozulması + kostik ışık havuzu girdisi. Gerçek girişim desenleri, halkaların birbirini kesmesi, kenardan dönüş.
- CFL kararlılığı: `c·dt/dx ≤ 0,5`; kalite seviyesinde 256² → 128². Deterministik (sabit `dt`).
- **Fiziksel sönüm:** halkalar zaman içinde `exp(−d t)`; sıfıra yakınsa simülasyon **uyku** (hiç hareket yokken GPU maliyeti ≈ 0: hedef "ısınmış" ise geçiş atlanır).

### R8.3 Ufuk sisi ve derinlik
- **Yükseklik sisi** shader içinde (derinlik tabanlı `exp(−k·d)` × yükseklik gradyanı), zemin shader'ına ve galaksi alt kenarına; **renk** sahne rengine bağlı (karanlık mavi → ufuk çizgisinde sıcak).
- **3 yarı saydam sis kartı** (ucuz hacim izlenimi, yavaş curl kayması) — S0; S1'de 1 kart.

### R8.4 Kontur çizgileri: eğriliğe duyarlı kalınlık
- Konturlar `fwidth` tabanlı: ekran-uzayı türeviyle çizgi **piksel kalınlığı sabit**, ama eğrilik yüksek yerde ince (CAD benzeri kalite); mesafeyle sönme. Bugünkü sabit kalınlık yerine.

### R8.5 Işık havuzu ve kostik
- Kubbe lambasından zemine **spot ışık havuzu** (eliptik gradyan + fresnel) ve havuz içinde **animasyonlu kostik** deseni: dalga simülasyonunun normalinden türeyen `|∇·n|` yoğunlaşması (ucuz sahte kostik) ya da önceden pişirilmiş tekrarlayan gürültü dokusu (S1).

## Seviye tablosu (R8)
| Özellik | S0 | S1 | S2 | S3 |
|---|---|---|---|---|
| Planar yansıma | ½ çöz., 2 kare/yenile | ¼ çöz. | şerit (bugün) | şerit |
| Dalga simülasyonu | 256² | 128² | analitik halka (bugün) | analitik |
| Ufuk sisi | evet + 3 kart | evet + 1 kart | gradyan | gradyan |
| Kontur `fwidth` | evet | evet | sabit | sabit |
| Kostik | simülasyondan | doku | yok | yok |

## Alt adımlar (PR)
1. **R8.a** sis + `fwidth` kontur + ışık havuzu (ucuz, görsel fark büyük). 2. **R8.b** planar yansıma. 3. **R8.c** dalga simülasyonu + kostik.

## Kabul testleri
- **B8** (bağlam kaybı) **genişler**: yansıma hedefi ve dalga dokuları bağlam kaybından sonra yeniden oluşur (yeni alan `BKGround.info().targets`).
- Bütçe: zemin hero'ya **+ ≤ 1,5 ms** (S0), `?perf` karşılaştırması (zemin açık/kapalı); `gpu_budget_audit`: zemin ek çizim çağrısı ≤ 6, ek render hedefi ≤ 3.
- Hareketsizken simülasyon **uykuda** (`info().simActive=false`, ek GPU işi 0).
- `visual_audit`: zemin altınları (hero içinde) bilinçli güncellenir; `leak_audit` eğim testi.
- `prefers-reduced-motion`: halka yayılımı yerine tek, hızlı sönen izdüşümü; yansıma statik.

## Riskler
Yansıma + hero çift maliyeti → ½ çözünürlük ve kare atlama; ters yüz kare sıralaması artefaktı → yansıma `autoClear` politikası. **Dosyalar:** `ground3d.js`, `sim.js`, `fx.js`, `shaders.js`.

---

# R9 — Silüet / Nobel zaman çizelgesi: "126 yıl bir şehir"

## Vizyon
126 yıl, ışıl ışıl bir **kule şehri**: her yıl bir bina, her ödül alanı bir katman rengi; **zaman çubuğunu kaydırırken ışık dalgası** şehrin üzerinden geçer, o yılın kulesi yükselir, bir **parçacık konfetisi** kısa süre havada kalır. Cam kulelerde gerçek kırılma (S0). Kamera, yıllar arasında **ray üzerinde** (Catmull-Rom) süzülür; ufukta sis. Her kule seçilince **yalnız o parlar** (seçici bloom), diğerleri geri çekilir.

## Bugünkü durum
`skyline3d.js` (179 satır): `InstancedMesh` K kule (yıl × alan katmanı), pencere shader'ı (`onBeforeCompile`, hash tabanlı yanıp sönme), ayna kopya yansıması, isteğe bağlı cam (transmission, varsayılan kapalı), yay sönümlü yeniden yığılma, DOM etiketleri `BKText.declutter`.

## Radikal fikirler ve teknik tasarım

### R9.1 Veri dokusu (`DataTexture`) ve GPU-yönlendirmeli kuleler
- Kule verisi (yıl, alan, sayı) uniform dizisi yerine **`DataTexture`** (RGBA32F; her texel = bir kule: x=yıl, y=alan, z=sayı, w=durum). Vertex shader örnek kimliğinden texel okur → **binlerce kule** uniform sınırı olmadan; yükseklik, renk, parlaklık **GPU'da** hesaplanır.
- Yay-sönüm (yeniden yığılma) **GPU'da**: hedef yükseklik dokusu + hız dokusu (mini GPGPU, A2): CPU'da 756 yay yok; filtre değişiminde tüm kuleler aynı karede düzgün.

### R9.2 Işık dalgası ve yıl senkronu
- Zaman çubuğu konumu `uYear` ile bir **ışık dalgası** shader'ı: dalga cephesi şehirde yıla göre ilerler (`smoothstep(|y − uYear|)`), cephede pencere yoğunluğu ↑, kule kenarı **fresnel parıltısı** ↑; geçtikten sonra yavaş sönen "iz".
- Seçili yılda kule **yükselir** (yay) + **konfeti parçacıkları** (≤ 150, GPU'da konum = f(başlangıç, t), 1,2 sn, sönümlü). `reduced-motion`: yalnız vurgu.

### R9.3 Kimlik tamponu ile seçim (MRT)
- Hover/tıklama için **kimlik tamponu**: kuleler ek bir çıktıya **örnek kimliğini** yazar (MRT: renk + kimlik; ya da ayrı ¼ çözünürlüklü tek geçiş); imleç konumunda tek piksel `readPixels` (zaman uyumsuz: `PIXEL_PACK_BUFFER`/`fenceSync` ile, ana iş parçacığını durdurmadan; destek yoksa 1 kare gecikmeli senkron).
- Hedef: hover → vurgu gecikmesi **≤ 2 kare** (bugünkü hedef korunur); 126 yıl × 1 895 kayıt etkileşimde (`BKHorizon`) sabit.
- Ek geçiş maliyeti ¼ çözünürlükte ≈ ihmal edilebilir; S2'de analitik ekran-uzayı izdüşümü (bugün).

### R9.4 Seçici bloom (Layers + MaskPass)
- Seçili kule ve önizleme kulesi `Layers` ile ayrılır; yalnız bu katman parlak-geçişe girer ( `MaskPass` / ikinci küçük hedef) → seçilmeyen binalar **bloom'a karışmaz**, hiyerarşi okunur ("ışık bilgidir" ilkesi).

### R9.5 Kamera rayı
- `CatmullRomCurve3` (yıl → konum) + hız-yumuşatmalı parametre; kaydırma/zaman çubuğu ↔ kamera **çift yönlü senkron**; **ray üstünde** `lookAt` hedefi bir sonraki on yıl ortası (ufuk hissi). Kullanıcı sürüklediğinde ray **bırakılır**, bırakınca geri süzülür (yay).

### R9.6 Cam kuleler (transmission) ve ufuk
- S0: `transmission` + `thickness` + sahte dağılım (R6.6 ile paylaşılan fabrika); **yalnız odaktaki ± 6 yıl** cam (diğerleri ucuz fresnel malzeme) → ek geçiş maliyeti sınırlı. S1: ucuz cam. Zemin yansıması **R8.1 yansıma hedefini paylaşır** (ayna kopya yerine gerçek planar yansıma, S0/S1).
- Ufuk sisi + gece/gündüz paletleri (tema); kule tepelerinde **uçak ikaz ışığı** benzeri yavaş nabız (yalnız vurgulanan kulelerde, ≤ 1 Hz, fotosensitif güvenli).

### R9.7 Etiketler
DOM + `BKText.declutter` kalır (SDF metin reddedildi; `ARASTIRMA-3D.md`). Premium: etiketler kuleye **bağlanma çizgisi** (CSS) ve yılda kademeli beliren; kimlik tamponuyla çakışmada otomatik yer değiştirir.

## Seviye tablosu (R9)
| Özellik | S0 | S1 | S2 | S3 |
|---|---|---|---|---|
| Kule verisi | DataTexture + GPU yay | DataTexture + GPU yay | uniform + CPU yay (bugün) | uniform |
| Işık dalgası | tam | tam | yalnız vurgu | yok |
| Konfeti | 150 | 60 | yok | yok |
| Kimlik tamponu | MRT/¼ çöz. | ¼ çöz. | analitik (bugün) | analitik |
| Seçici bloom | evet | evet | genel bloom | yok |
| Cam | ±6 yıl transmission | ucuz cam | opak | opak |
| Yansıma | planar (R8) | planar ¼ | ayna kopya (bugün) | yok |
| Kamera rayı | evet | evet | basit tween | yok |

## Alt adımlar (PR)
1. **R9.a** veri dokusu + GPU yay (davranış aynı, CPU maliyeti ↓). 2. **R9.b** kimlik tamponu + hover ≤ 2 kare. 3. **R9.c** ışık dalgası + konfeti + seçici bloom. 4. **R9.d** kamera rayı + senkron. 5. **R9.e** cam + planar yansıma birleşimi.

## Kabul testleri
- **B12/benzeri `BKSkyline.info()`**: `source:'texture'`, `K` ≥ 750, `picking:'id'|'analytic'`.
- **Etkileşim gecikmesi:** 126 yıl × 1 895 kayıt, hover → vurgu **≤ 2 kare** (Playwright kare sayacı; yazılımsal GL'de ≤ 8).
- Nobel grafiği ↔ galaksi geçişlerinde **tek görünür görünüm** (iki grafik alt alta hatası): `ui_audit` ek denetimi.
- `gpu_budget_audit`: silüet çizim çağrısı ≤ 16, program ≤ 10, render hedefi ≤ 4.
- `visual_audit`: silüet gündüz/gece altınları bilinçli; tohumlu, sabit sunucu portu.
- `leak_audit` eğim; reduced-motion: ışık dalgası ve konfeti yok, vurgu statik.
- Bütçe: silüet S0 ≤ 8 ms hedef (`?perf`).

## Riskler
`readPixels` senkron durması → asenkron okuma/gecikmeli; MRT yazılımsal GL'de yavaş → ¼ çözünürlüklü ayrı geçiş yedeği. Seçici bloom ek hedefi bellek → ¼ çözünürlük. **Dosyalar:** `skyline3d.js`, `sim.js`, `fx.js`, `shaders.js`, `motion.js` (kamera ray senkronu), `nobel3d.js` (geçiş).
