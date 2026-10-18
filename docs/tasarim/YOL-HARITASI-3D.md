# Premium three.js yol haritası (v107 sonrası; R1 v108'de) — aşama aşama

**Kural:** her aşama **ayrı bir oturum** ve ayrı bir PR'dır; bir aşama bitmeden sonrakine geçilmez. Her aşamanın sonunda bu belgedeki **§0 durum tablosu** ve `DEVIR-FAZ-4.md` güncellenir. Aşamalar sıralıdır: ilk üçü (R1–R3) altyapıdır ve görsel işlerden önce yapılmalıdır, çünkü sonraki her görsel değişiklik onların ölçüm ve güvenlik ağına dayanır.

Ortak sınırlar (her aşama için geçerli):
- Çalışma zamanında **dış istek yok**; yeni vendor dosyası yalnızca three.js'in kendi `examples/jsm` içinden (MIT) ve `sw.js` `FILES` + `pages.yml` `node --check` listesine eklenerek girer. Her eklenen vendor dosyası aşamanın PR'ında KB olarak raporlanır.
- Her yeni özellik **kapanabilir** olmalı: `BKGL.flags` (R1) ya da `localStorage bk-flag-<ad>`; kalite yöneticisi seviyesi ≥ 2'de ağır katmanlar kapanır; reduced-motion'da yalnız durağan kare.
- Yazılımsal GL (SwiftShader) **hareket hissini ve gerçek GPU maliyetini göstermez**. Her aşamanın "gerçek GPU doğrulaması" maddesi kullanıcıya aittir ve `?diag` / (R2'den sonra) `?perf` çıktısıyla yapılır; aşama, bu çıktı gelmeden "canlıda doğrulandı" sayılmaz.
- Kabul ölçütleri **sayısal** yazılmıştır ve bir audit aracına bağlanır; araç yoksa aşamanın ilk işi aracı yazmaktır.

## 0. Durum tablosu
| Aşama | Ad | Durum | PR / sürüm |
|---|---|---|---|
| R1 | Ortak GL katmanı (`BKGL`) | **tamam** — deploy yeşil (koşu 133); gerçek GPU doğrulamasını kullanıcı yaptı, sorun yok bildirdi (`?diag` çıktısı iletilmedi) | v108, PR #55 + #56 (test düzeltmesi) |
| R2 | Gerçek GPU zamanlaması + `?perf` + derleme ısıtma | bekliyor | — |
| R3 | Deterministik görsel regresyon kapısı | bekliyor | — |
| R4 | Ortak malzeme ve ışık kitaplığı (`BKMaterials`, tek PMREM) | bekliyor | — |
| R5 | Kitap gerçekçiliği (sayfa bükülmesi, kâğıt, yaldız) | bekliyor | — |
| R6 | Madalya ve Nobel arşivi nesneleri | bekliyor | — |
| R7 | Hero galaksi ve kubbe | bekliyor | — |
| R8 | Zemin ve atmosfer | bekliyor | — |
| R9 | Silüet / Nobel zaman çizelgesi (veri dokusu, kimlik tamponu) | bekliyor | — |
| R10 | Sahneler arası portal geçişleri | bekliyor | — |
| R11 | Kütüphane duvarı (2653 kayıt, instancing) | bekliyor | — |
| R12 | Erişilebilirlik ve dokunmatik girdi | bekliyor | — |
| R13 | (isteğe bağlı) Ana iş parçacığından ayırma: OffscreenCanvas + Worker | bekliyor | — |

Önerilen sıra: R1 → R2 → R3 → R4 → (R5, R6, R7, R8, R9 herhangi sırayla, kullanıcı önceliğine göre) → R10 → R11 → R12 → R13.

---

## R1 — Ortak GL katmanı (`BKGL`)
**Neden:** bugün 7 dosya kendi `WebGLRenderer`'ını açıyor; bağlam kaybı mantığı dosya dosya kopyalandı (v106/v107), kalite katmanını `stage.js` hiç dinlemiyor, `?diag` yalnız `stage.js`'te.
**Yapılacak:**
- Yeni `site/gl.js` (`window.BKGL`): `probe()` (GPU adı, `MAX_TEXTURE_IMAGE_UNITS`, `MAX_TEXTURE_SIZE`, float/half-float render hedefi, `KHR_parallel_shader_compile`, WebGL2 var mı), `watch(canvas, {onLost, onRestore})` (tek bağlam-kaybı yardımcısı; hero/zemin/takımyıldızı/Nobel/silüet/boş durum/stage hepsi bunu kullanır, kopya dinleyiciler silinir), `flags` (aç/kapa), `log` (tek `?diag` paneli; her modül kendi durumunu `BKGL.report(ad, nesne)` ile ekler).
- `stage.js` `bk:quality` olayını dinler: seviye ≥ 2'de DPR sınırı 1.0, ≥ 3'te boşta kutular 15 fps, 4'te yalnız hover'daki kutu canlı.
- `?diag` tek panelde tüm sahnelerin seviyesini/durumunu gösterir.
**Dosyalar:** `site/gl.js` (yeni; `index.html`, `sw.js`, `pages.yml` kayıtları), `stage.js`, `hero3d.js`, `ground3d.js`, `constellation3d.js`, `nobel3d.js`, `skyline3d.js`, `empty3d.js`, `motion.js`.
**Kabul:** hiçbir modülde doğrudan `webglcontextlost/restored` dinleyicisi kalmaz (grep ile sıfır); `feature_audit` B8 (raf + hero) ve B9 geçer; kalite seviyesi 3'e zorlanınca stage DPR'ı ve kare hızı ölçülebilir biçimde düşer (yeni B10 testi).
**Risk/geri dönüş:** düşük; mevcut davranışı yeniden düzenler, davranış testleri zaten var.

## R2 — Gerçek GPU zamanlaması, `?perf`, shader derleme ısıtma
**Neden:** kalite yöneticisi bugün rAF aralığından karar veriyor (CPU+vsync gürültüsü); gerçek GPU maliyeti bilinmiyor. İlk kullanımda shader derlemesi takılma yapabilir (kitap malzemeleri ağır).
**Yapılacak:**
- `EXT_disjoint_timer_query_webgl2` ile kare başına GPU ms (yalnız destekleyen GPU'da; yoksa mevcut rAF yolu). Governor önce GPU ms'ye, yoksa rAF'e bakar.
- `?perf` paneli: son 120 karenin GPU ms / CPU ms / kare hızı, kalite seviyesi, çizim çağrısı ve üçgen sayısı (`renderer.info`), program sayısı. Panelde "kopyala" düğmesi (metin → pano) — kullanıcı bunu bana yapıştırır.
- `renderer.compileAsync` (`KHR_parallel_shader_compile`) ile hero + kitap + madalya malzemelerinin **boşta** ısıtılması; ilk etkileşimde derleme takılması ölçülür (`perf.longFrames`).
**Dosyalar:** `site/gl.js`, `motion.js` (governor girdisi), `hero3d.js`, `stage.js`.
**Kabul:** yazılımsal GL'de panel açılır ve sayılar akar (değerler anlamsız olsa da); `?perf` kapalıyken ek maliyet 0 (flag); ısıtma, ilk 5 saniyede ana iş parçacığı bloklama > 50 ms'lik görev sayısını artırmaz (Long Task gözlemcisiyle `feature_audit` B11).
**Gerçek GPU doğrulaması (kullanıcı):** `?perf` panelini 20 sn kaydırıp "kopyala" çıktısını göndermek.

## R3 — Deterministik görsel regresyon kapısı
**Neden:** görsel kusurlar (kesik sayfa, kararan kitap) ancak kullanıcı bakınca fark edildi. Piksel tabanlı kapı, sonraki tüm görsel aşamaların güvenlik ağıdır.
**Yapılacak:**
- Deterministik mod: `?still=1` (zaman sabit, rastgelelik tohumlu, `effects-paused`, kapak tam yatık, sabit pencere boyutu 1440×900 ve 1024×768, koyu+açık, TR). Hero, raf, açık kitap (3 açılım), madalya, silüet, Nobel galaksi, takımyıldızı.
- `tools/visual_audit.py`: her yüzey için ekran görüntüsü → `tools/golden/*.png` ile karşılaştırma (kanal başına tolerans + değişen piksel oranı eşiği); farkı `tools/golden/_diff/` altına yazar. Altın görüntüler yazılımsal GL ile **CI'da** üretilir (aynı ortam) ve commit edilir; boyut sınırı için 50% ölçek + WebP/PNG sıkıştırma.
- CI'a adım; altın görüntü güncellemesi bilinçli bir `--update` komutudur ve PR'da farkı gösterir.
**Kabul:** aynı kod iki kez çalıştırıldığında fark < %0.1 (kararlılık testi); kitap kenar/sol-sayfa gibi bilinen hatalar enjekte edilince kapı kırılır.
**Risk:** yazılımsal GL sürümleri arası küçük fark; tolerans + yalnız CI altınları kullanılır (yerel çalıştırma yalnız bilgilendirir).

## R4 — Ortak malzeme ve ışık kitaplığı
**Neden:** `stage.js` ve `skyline3d.js` ayrı PMREM üretiyor; foil/kumaş/cam/kâğıt malzemeleri dosya dosya yeniden tanımlı, sürüklenme riski var.
**Yapılacak:** `site/materials.js` (`BKMaterials`): `foil(renk)`, `cloth(renk)`, `paper()`, `glass()`, `brass()`; tek stüdyo ışık sahnesi → tek PMREM (bağlam kaybında tek yerde yeniden pişirilir); tonemapping/maruz kalma tema başına tek yerde (ACES + tema başına `toneMappingExposure`); malzeme seviyeleri (`full / standard / lambert / basic`) bu kitaplıkta tanımlı — v107'deki `lighter()` buraya taşınır.
**Kabul:** `new m.MeshPhysicalMaterial(` sayısı `stage.js`'te ≥ %70 azalır; R3 altınları değişmez (görsel birebir) ya da fark bilinçli ve belgeli.

## R5 — Kitap gerçekçiliği
**Hedef:** kitap, sitenin imza nesnesi olarak "elde tutulan" hissini vermeli.
**Yapılacak (alt adımlar ayrı commit/PR olabilir):**
1. **Sayfa bükülmesi:** bugünkü `-amp·u²` parabolik eğriyi, silindir etrafında gerçek bükme (yarıçap = fonksiyon(p)) ile değiştir; bükülme sırasında sayfa kalınlığı ve ön/arka yüz geçişi; sayfa köşesinden tutma (sürükleyerek çevirme) isteğe bağlı.
2. **Kâğıt:** lif normal haritası (prosedürel, 2 oktav), arka yüze hafif ışık sızması (arka yüz metninin ters, çok soluk görünmesi — `onBeforeCompile` ile ince saydamlık), sayfa gölgelerini birbirine düşürme (yapraklar `receiveShadow`, yalnız ≥ seviye 1'de).
3. **Yaldız ve kenarlar:** sayfa bloğu kenarlarında altın yaldız (`foil` malzemesi, çizgili normal), başlık bandı (headband) kıvrımlı geometri, kapak kabartması için yükseklik haritasından türetilmiş normal (bugünkü madalya hattı `normalFromHeight` yeniden kullanılır).
4. **Metin netliği:** sayfa dokusu 768×1080 → okuma sahnesinde isteğe bağlı 1536×2160 yeniden çizim (yalnız açık kitap, yalnız seviye 0–1), anizotropi 16.
5. **Ayraç:** Verlet zincirine kitap ve sayfa ile çarpışma (sayfa üzerinde asılı kalma), rüzgârsız sönümleme.
**Dosyalar:** `stage.js` (kitap bölümü), `BKMaterials` (R4).
**Kabul:** R3 altınları (açık kitap 3 açılım) güncellenir ve sol sayfa/kenar testleri (B5) geçer; sayfa çevirme sırasında hiçbir karede sayfa çokgeni sahne kenarına temas etmez; seviye 2'de ağır katmanlar kapanır (B9 bozuk-GPU testi geçer); bellek: `leak_audit` geometri/doku sayacı artmaz.
**Gerçek GPU doğrulaması (kullanıcı):** sayfa çevirme akıcılığı ve kâğıt hissi; `?perf` kare maliyeti açık kitapta ≤ 6 ms hedefi.

## R6 — Madalya ve Nobel arşivi nesneleri
**Yapılacak:** madalya yüzünde paralaks-oklüzyon (basit yükseklik tabanlı UV kayması, `onBeforeCompile`), iridescence'ın kalınlık haritasıyla çeşitlendirilmesi, defne çelengi için `ExtrudeGeometry` ile gerçek derinlik, kenar tırtıllarının geometrik olması (bugün normal haritası), imleci izleyen anahtar ışık, yüzeyde çok ince toz parçacıkları (instanced, ≤ 200). Atlas kutularındaki cam nesnelere (atom, DNA, küre) kalite katmanlı `transmission` (yalnız seviye 0).
**Kabul:** R3 altınları (madalya), `feature_audit` B6 (normal, tırtıl) geçer; seviye 1+'da transmission kapanır; bellek sızıntısı yok.

## R7 — Hero galaksi ve kubbe
**Yapılacak:**
- Parçacıkları yumuşak SDF sprite'a (`InstancedBufferGeometry` + özel shader) taşı: yoğunluk dalgası kolları, toz şeritleri (koyulaştıran ikinci geçiş), yıldız renk sıcaklığı dağılımı (kolay B-V → renk eğrisi).
- İmleç çekim merceği: bugünkü radyal bulanıklığa ek olarak vertex'te yerçekimsel sapma (kalite katmanlı).
- Bloom sonrası **LUT renk derecelendirme** (küçük 16³ prosedürel 3D LUT, tema başına), anamorfik yatay parlama (yalnız parlak yıldızlarda), film greni zamana bağlı, kenarlarda kromatik sapma (var; ince ayar).
- Kubbe: tıklanan yıldıza **teleskop yönelmesi** (yay sönümlemeli), merceğe lens flare sprite'ı; kubbe yarığından hacimsel ışık konisi (ekleme karıştırmalı koni + gürültü).
- Seçim (picking): bugünkü ekran-uzayı izdüşümü yerine GPU renk-kimliği tamponu **yalnız** analitik yol çok yavaşsa (ölç; gereksizse yapma).
**Kabul:** R3 altınları (hero koyu/açık); kalite seviyesi 3'te parçacık sayısı ve LUT/flare kapanır (B9); `?perf` hero ≤ 8 ms (kullanıcı); `leak_audit` geçer.

## R8 — Zemin ve atmosfer
**Yapılacak:** zeminde galaksinin düzlemsel yansıması (düşük çözünürlüklü ayna render hedefi, yalnız seviye 0–1; bugünkü şerit yansıması yedek), ufukta alçak sis (derinlik tabanlı), kontur çizgilerinin eğriliğe duyarlı kalınlığı, dalga halkalarının fiziksel sönümü, zemin ile kubbe lambasının ışık havuzu.
**Kabul:** R3 altınları; zemin hero GPU maliyetini ≤ +1.5 ms artırır (kullanıcı `?perf`); yansıma hedefi bağlam kaybında yeniden oluşur (B8 genişletilir).

## R9 — Silüet / Nobel zaman çizelgesi
**Yapılacak:** kule/yıldız verisini uniform dizisi yerine `DataTexture`'a taşı (yıl, alan, sayı → doku); kimlik tamponu ile tıklama/hover seçimi (tek ek geçiş, 1/4 çözünürlük); yıllar arası kamera rayı (`CatmullRomCurve3`) ve kaydırma/zaman çubuğu senkronu; cam kulelerde kalite katmanlı `transmission`; DOM etiketleri `BKText.declutter` ile (SDF metin reddedilmişti, bkz. `ARASTIRMA-3D.md`).
**Kabul:** 126 yıl × 1895 kayıtla etkileşim gecikmesi (hover → vurgu) ≤ 2 kare; R3 altınları; Nobel grafiği ve galaksi geçişlerinde tek görünür görünüm (iki grafik alt alta hatası bir daha olmaz: ui_audit ek denetimi).

## R10 — Sahneler arası portal geçişleri
**Yapılacak:** iki sahneyi ayrı render hedeflerine çizip gölgelendiricide birleştiren ortak geçiş (gürültü çözülmesi, radyal silme, kromatik ayrışma). Yıldıza dalış: bugünkü DOM hayalet kapağı yerine gerçek kamera uçuşu + kapak malzemelenmesi (kitap kapağı yıldızın konumunda belirir, kapak dokusu yıldız renginden kapak rengine karışır). View Transitions API ile DOM geçişi eşlenir.
**Kabul:** geçiş süresince kare sayısı ≥ 20 (reduced-motion hariç; yazılımsal GL'de ≥ 4); reduced-motion'da yalnız kesme; `record.js` `withMorph` ad çakışması testi (A3/A4) geçer; bağlam kaybı geçiş ortasında olsa bile sahne kurtarılır.

## R11 — Kütüphane duvarı (2653 kayıt)
**Yapılacak:** katalog için opsiyonel "duvar" görünümü: `InstancedMesh` ile binlerce ince kitap sırtı, kapak dokuları atlas dokusunda (8×8), kimlik tamponu ile seçim, odak kitap "raftan çıkar" (mevcut raf kitabı sahnesine devir). Filtreler (alan, yıl, dil) örnek başına renk/ölçek değişimiyle canlı. Sanallaştırma: yalnız kamera çevresi tam detay.
**Kabul:** 2653 örnekle ≥ 30 fps hedefi (kullanıcı `?perf`); seviye 3'te statik sıralı ızgaraya düşer; erişilebilir alternatif liste her zaman DOM'da (sanal duvar yalnız görsel katman).

## R12 — Erişilebilirlik ve dokunmatik girdi
**Yapılacak:** yıldız/kutu/kitap için klavye ile gezinti (roving tabindex + 3D odak halkası), `prefers-contrast` ve `prefers-reduced-transparency` yolları, her 3D sahne için `aria-describedby` metin özeti (hesaplanmış), dokunmatik: iki parmakla yakınlaştır/döndür (galaksi, kitap), uzun basma = önizleme. Mevcut kitap canlı bölgesi (`aria-live`) tüm sahnelere genelleştirilir.
**Kabul:** klavye ile galaksiden bir kayda varış ve geri dönüş testi (Playwright, yalnız klavye); axe-benzeri kontrast ve ad denetimi `ui_audit`'e eklenir.

## R13 — (isteğe bağlı, yüksek risk) OffscreenCanvas + Worker
**Neden:** ağır hero'yu ana iş parçacığından ayırmak etkileşim gecikmesini düşürür. **Risk:** DOM etiketleri/pointer olayları köprülenmeli, Safari desteği, hata ayıklama zor. Yalnızca R2 `?perf` çıktısı ana iş parçacığı sıkışmasını gösterirse yapılır; aksi hâlde yapılmaz.

---

## Aşama oturumu için şablon istem
```
Bilim Kütüphanem (mustafaras/bilim-kutuphanesi). docs/tasarim/SONRAKI-ADIMLAR.md, docs/tasarim/YOL-HARITASI-3D.md ve DEVIR-FAZ-4.md (§46–§51) dosyalarını oku.
Bu oturumda YALNIZCA aşama <R?> yapılacak: kabul ölçütlerini sayısal olarak karşılayan, kapanabilir (flag) ve kalite katmanlı bir uygulama; gerekli audit/test araçlarını önce yaz, kırıldığını göster, sonra düzelt.
İş akışı: yerel kapılar → commit → push (claude/magical-hawking-kufhmz) → PR → PR koşusu yeşilse squash merge → main deploy adımı yeşil → dürüst rapor. YOL-HARITASI-3D.md §0 tablosunu ve DEVIR-FAZ-4.md'yi güncelle.
Bu aşamanın "gerçek GPU doğrulaması" maddesini kullanıcıya adım adım yaz (hangi adresi açacak, hangi çıktıyı gönderecek).
Türkçe, kısa ve dürüst raporla; yazılımsal GL'in hareketi göstermediğini unutma.
```
