# Bilim Kütüphanem — World-Class Tasarım Planı

**Sürüm:** 1.0 · **Tarih:** 2026-10-14 · **Durum:** Onay bekliyor
**Kapsam:** `site/` altındaki tüm kullanıcı arayüzü (tek sayfalık katalog uygulaması)
**Kısıtlar (korunur):** Vanilla HTML/CSS/JS · GitHub Pages · çalışma anında dış servis yok · çevrimdışı katalog · TR/EN arayüz · WCAG 2.2 AA · azaltılmış hareket desteği

---

## 0. Yönetici Özeti

Bu plan, mevcut "parşömen katalog" görünümünü terk edip uygulamayı **"Gözlemevi" (The Observatory)** adlı tek bir sanatsal konsepte taşıyan, tüm uygulama için uçtan uca bir yeniden tasarım planıdır.

Üç temel dönüşüm:

| Boyut | Bugün (eski tasarım) | Hedef (bu plan) |
|---|---|---|
| Kimlik | Parşömen/fildişi sayfa + Georgia system serif + tek vurgu rengi | Derin uzay atmosferi, pirinç/altın enstrüman detayları, özel tipografi sistemi |
| Yerleşim | Tekrarlanan simetrik kart ızgaraları, tek tip kart anatomisi | Serif başlıkların başrolde olduğu editoryal + bento karışımı; her bölüm kendi sahne tasarımına sahip |
| Etkileşim | İnce hover geçişleri, diyalog tabanlı detay | Koreograflı scroll anlatısı (scrollytelling), komut paleti (⌘K), görünüm geçişleri, mikro-geri bildirim |

Plan; dünya çapında ödüllü kütüphane/müze arayüzleri (Rijksmuseum, Europeana, NYPL, Gallica), bilimsel koyu tema referansları (NASA Eyes) ve 2026 ödüllü web tasarımı pratiği (Awwwards eğilimleri, değişken font sistemleri) taranarak hazırlandı. Hiçbir varlık kopyalanmaz; yalnızca desenler uyarlanır.

---

## 1. Mevcut Durum Tespiti (Neden "aynı tasarım" eleştirisi doğru)

`site/style.css` (59 KB) ve `index.html` denetiminden bulgular:

1. **Tipografi kimliksiz.** Başlıklar Georgia / Times system serif; hiçbir özel karakteri yok. Premium yayın estetiğinin temeli olan özel display serif yok.
2. **Renk tek boyutlu.** Tek vurgu (`#a15c39`) + fildişi yüzeyler. Disiplin aileleri (omurga renkleri) kart kenarında ince bir çizgide kalıyor; bilgi hiyerarşisine renk katmıyor.
3. **Yerleşim ritmi yok.** Tüm bölümler aynı "başlık sol / açıklama sağ + ızgara" kalıbını tekrarlıyor; sayfa boyunca aynı tempo. Scroll bir anlatı gibi kurgulanmamış.
4. **Kart anatomisi düz.** Beyaz kutu + başlık + metin + çipler; kapak/omurga sistemi vitrin dışında geliştirilmemiş.
5. **Detay bir diyalog.** Kayıt detayı modal içinde sıkışık; künye zenginliği (dünya standartlarındaki katalog kaydı sunumu) yansıtılmıyor.
6. **Hareket dekoratif.** Canvas küre ve ambient ışıklar güzel ama işlevsel değil; keşif akışını destekleyen, anlatı taşıyan hareket yok.
7. **Keşif araçları güçsüz.** 9 adet `<select>` filtreden oluşan panel; dünya standartlarındaki fasetlı arama deneyimi (canlı sayımlar, uygulama-öneriler, yer imleri) yok.

Bu plan her bulgu için 8. bölümde somut tasarımla karşılık verir.

---

## 2. Dünya Örnekleri Araştırması (web taraması)

| Kaynak | Ne için incelendi | Bu projeye uyarlanan |
|---|---|---|
| [Rijksmuseum Collection Online](https://www.museumnext.com/article/inside-the-infinite-rijksmuseum-how-one-museum-is-rethinking-digital-collections/) — 2025 Webby "Best UI" | Bağlantılı veri keşfi, "node" sayfaları, her yerde arama | Kayıt detayını "düğüm sayfasına" dönüştürme: yazar/alan/yıl bağlantılarıyla sınırsız keşif zinciri; yapışkan evrensel arama |
| [Europeana tasarım yaklaşımı](https://www.dataspace-culturalheritage.eu/en/news/exploring-europeana-s-approach-to-design) | Çok dilli, fasetlı keşif; kullanıcı araştırması temelli IA | Faset başına canlı sonuç sayısı, çok dilli etiketlerin tutarlı switching kuralları (mevcut `i18n.js` mimarisiyle) |
| [NYPL Digital Collections](https://www.nypl.org/research/research-catalog/search/advanced) | Arama-öncelikli IA, künye sunumu, gelişmiş arama | Aramayı sayfanın merkezine taşıyan hero; kayıt künyesinde tutarlı eylem seti (alıntıla, indir, paylaş) |
| [Gallica (BnF)](https://gallica.bnf.fr) | Akademik faset, IIIF benzeri derin önizleme | Liste görünümünü "kayıt defteri" (ledger) estetiğine taşıma; yıl/seri hiyerarşisi |
| [NASA Eyes on the Universe](https://eyes.nasa.gov/) + [NASA Web Design System](https://nasa.github.io/nasawds-site/) | Koyu, bilimsel HUD dili; cam katmanlar; erişilebilirlik omurgası | "Gözlemevi" koyu teması, cam paneller, ince parlayan çizgiler; a11y kuralları |
| [Awwwards tipografi koleksiyonu](https://www.awwwards.com/awwwards/collections/typography-in-web-design/) + [2026 eğilim raporları](https://www.figma.com/resource-library/web-design-trends/) | Kinetik/editoryal tipografi, scrollytelling, WebGL, bento yerleşimler, sanatsal yönetmenlik | Kinetik hero tipografisi; scroll'a bağlı bölüm anlatısı; keşif alanlarında bento ızgara |
| [2026 tipografi eğilimleri](https://madegooddesigns.com/web-typography-trends-2026/) · [Fontfabric](https://www.fontfabric.com/blog/top-typography-trends-for-2026/) | Değişken fontlar, serif rönesansı, `clamp()` akışkan ölçek, APCA kontrast | Fraunces + Inter + IBM Plex Mono üçlüsü; akışkan tip ölçeği; self-host woff2 |
| Linear / Vercel / Stripe estetiği | Koyu-öncelik, derinlik, mikro-etkileşim disiplini | Yükselme (elevation) ölçeği, odak halkaları, tutarlı 120–400ms hareket dili |

**İlke:** bu sitelerin varlıkları, metinleri veya görselleri kopyalanmaz; yalnızca etkileşim ve yerleşim desenleri, bu projenin özgün "Gözlemevi" kimliği için yeniden tasarlanır.

---

## 3. Tasarım İlkeleri

1. **Arşiv bir sergidir.** Kayıtlar veritabanı satırı değil, küratörlü bir serginin parçalarıdır. Her bölüm bir salon, her kayıt bir vitrin eseridir.
2. **Kozmik sessizlik.** Koyu, derin ve sakin zemin; içerik sahneye ışıkla çıkar. Gürültü değil, atmosfer.
3. **Tipografi başrolde.** Başlıklar görsel unsur olarak kullanılır (type-as-image); ölçek, kontrast ve ritim sayfanın estetik taşıyıcısıdır.
4. **Keşif hiyerarşisi.** Göz at → odaklan → derinleş. Her adımda "bir sonraki merak kıvılcımı" görünür olmalı (Rijksmuseum düğüm-modeli).
5. **Her etkileşim karşılık verir.** Hover, odak, filtre, sayfalama — hepsi 120–400ms aralığında kasıtlı, tutarlı geri bildirim üretir.
6. **Klavye ve ekran okuyucu birinci sınıf.** `⌘K` komut paleti, `/` arama, `?` kısayol haritası; tüm desenler WCAG 2.2 AA.
7. **Performans bir tasarım kararıdır.** Framework yok; fontlar subset; hareket INP-dostu (transform/opacity); canvas görünüm dışında durur.

---

## 4. Görsel Kimlik — Konsept: "Gözlemevi"

Bilgi, gece gökyüzünü izleyen bir gözlemevinin teleskopundan geçer: derin lacivert-gece zemin, pirinç/altın enstrüman detayları, yıldız haritası çizgileri, fildişi okuma ışığı. Koyu tema **birincil kimlik**; aydınlık tema "gün ışığı okuma modu" olarak ayrı ama eşit derecede özenli tasarlanır.

### 4.1 Renk Sistemi

**Koyu tema (birincil):**

| Token | Değer | Kullanım |
|---|---|---|
| `--space-950` | `#060A12` | Sayfa zemini |
| `--space-900` | `#0A101C` | Bölüm zemini |
| `--space-800` | `#101A2A` | Panel/kart zemini |
| `--space-700` | `#1A2838` | Yükseltilmiş yüzey |
| `--brass-300` | `#E8CE9E` | Birincil vurgu (etkileşim, odak) |
| `--brass-400` | `#D4B68A` | İkincil vurgu, çizgi süsleri |
| `--brass-500` | `#B39062` | Sönük pirinç, kenarlıklar |
| `--aurora-400` | `#7CC7B7` | Bilim/analiz vurgusu (Nobel, istatistik) |
| `--nebula-400` | `#B9A7D6` | Edebiyat/küreş vurgusu |
| `--ink-inverse` | `#F2EEE3` | Koyu üstü metin (fildişi mürekkep) |
| `--ink-inverse-muted` | `#A8B0BC` | Koyu üstü ikincil metin |
| `--line-dark` | `#FFFFFF1A` | Saç teli kenarlıklar (4–6% beyaz) |
| `--glass-bg` | `#101A2A80` + `backdrop-blur(16px)` | Cam paneller (header, palet, şerit) |

**Aydınlık tema ("gün ışığı"):** mevcut parşömen paleti rafine edilerek korunur (`--paper:#F6F4EC`, `--ink:#1B2B38`, vurgular aynı pirinç ailesi). Her iki tema da `data-theme` + `prefers-color-scheme` üzerinden çalışır; mevcut `themeToggle` davranışı aynen kalır.

**Kontrast taahhüdü:** tüm metin ≥ 4.5:1, büyük başlık ≥ 3:1 (APCA ile doğrulanır; 10. bölüm).

**Disiplin omurgaları:** mevcut renkli omurga sistemi genişletilir ve kartın tamamını taşır: kart sol kenarı 3px + kayıt başlığında ince renk ipucu + detay sayfasında tam şerit. Aileler: `fizik #7CC7B7`, `matematik #E8CE9E`, `biyoloji #8FBF8A`, `edebiyat #B9A7D6`, `tarih #D69A6B`, `nörobilim #7FA8D8`.

### 4.2 Tipografi Sistemi

Üç aile, hepsi OFL lisanslı, **self-host** woff2 (latin + latin-ext; Türkçe karakter zorunlu), `font-display: swap`, toplam ≤ 170 KB:

| Rol | Font | Eksenler/arıhk | Kullanım |
|---|---|---|---|
| Display serif | **Fraunces** (değişken) | opsz 9–144, wght 300–900, SOFT, WONK | h1–h3, kayıt başlıkları, vitrin kapakları; `opsz` ile mikro-tipografi |
| UI/body sans | **Inter** (değişken) | wght 400–700 | gövde, arayüz, filtreler |
| Mono etiket | **IBM Plex Mono** | 400/500 | künye etiketleri, katalog no, yıl, koordinat etiketleri (observatory HUD dili) |

**Akışkan tip ölçeği (clamp):**

| Kademe | Tanım |
|---|---|
| `--fs-display` | `clamp(52px, 8vw, 108px)` hero h1 |
| `--fs-h2` | `clamp(34px, 4vw, 56px)` |
| `--fs-h3` | `clamp(22px, 2.4vw, 30px)` |
| `--fs-lead` | `clamp(17px, 1.5vw, 20px)` |
| `--fs-body` | `16px / 1.75` |
| `--fs-meta` | `13.5px` |
| `--fs-label` | `11px, +0.18em tracking, uppercase, mono` |

Serif başlıklarda `-0.02em` letter-spacing; `SOFT` ekseni 50'de sabit (sıcaklık), `WONK` yalnızca hero'da 1 (karakter).

### 4.3 İkonografi ve İllüstrasyon

Mevcut 8 özgün vektör çizim korunur ve **tek çizgi kalınlığı sistemine** (1.5px, `--brass-400`, round cap) bağlanır. Yeni ekler: takımyıldız motifi (nokta + bağ çizgisi) keşif göstergesi olarak; tüm ikonlar 24px grid, `currentColor`.

### 4.4 Doku ve Derinlik

- **Grain:** SVG feTurbence tabanlı, %3 opaklıkta, sabit (animasyonsuz) film greni — koyu geçişlerde banding önler.
- **Cam:** yalnızca 3 yüzeyde (header, komut paleti, katalog şeridi) — aşırı glassmorphism'den kaçınılır.
- **Parıltı ölçeği:** `--glow-1` (hover, 8px blur, brass %25) → `--glow-2` (aktif vurgu, 20px, %40).
- **Yükselme ölçeği:** E0 düz / E1 kart / E2 hover kartı / E3 yapışkan şerit / E4 palet-diyalog. Gölge yerine koyu temada kenar-ışığı (`inset 0 1px 0 #FFFFFF0F`).

---

## 5. Tasarım Token Mimarisi

`site/style.css` başında üç katmanlı token bloğu (mevcut değişkenler bu isimlere göç ettirilir):

```css
/* Katman 1 — ilkel: renk, boyut, süre (tema bağımsız) */
/* Katman 2 — anlamsal: surface, text, accent, line (tema başına) */
/* Katman 3 — bileşen: card-radius, header-height, focus-ring */
:root { --space-4: 4px; --dur-1: 120ms; --ease-out: cubic-bezier(.22,1,.36,1); ... }
[data-theme="dark"] { --surface-1: var(--space-900); --text-1: var(--ink-inverse); ... }
[data-theme="light"] { --surface-1: var(--paper); --text-1: var(--ink); ... }
```

Kurallar: bileşen CSS'i yalnızca anlamsal/bileşen token'ı görür; renk hex'i bileşen katmanında yazılmaz. `?v=` önbellek kırma sürümü her fazda artar.

---

## 6. Yerleşim ve Boşluk

- **Izgara:** 12 sütun, `max-width: 1440px`, gutter `clamp(20px, 3vw, 44px)`; içerik çoğunlukla 8 sütunda, kenar süsler (yıl koordinatları, rozetler) dış sütunlarda.
- **Bölüm ritmi:** dikey padding `clamp(72px, 10vh, 140px)`; bölümler arasında tam-kanama "yıldız alanı" geçişleri.
- **Kırılımlar:** 480 / 768 / 1024 / 1440 (mevcut 760/1100 yerine; CSS'te güncellenir). Mobil: tek sütun, yapışkan alt eylem çubuğu (arama + liste/kartlar).
- **Bento:** keşif alanları asimetrik bento ızgarası (2 büyük + 4 küçük hücre; alan başına kaynak sayısına göre otomatik boyut).

---

## 7. Hareket Sistemi

| Token | Değer | Kullanım |
|---|---|---|
| `--dur-1` | 120ms | hover, odak |
| `--dur-2` | 240ms | çip/filtre, görünüm değişimi |
| `--dur-3` | 400ms | panel, diyalog |
| `--dur-4` | 700ms | bölüm girişleri |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | giriş |
| `--ease-spring` | `cubic-bezier(.34,1.56,.64,1)` | yıldız/sık kullanılan eylem geri bildirimi |

- **Scroll koreografisi:** IntersectionObserver ile `reveal-in` (mevcut sınıf korunur, zamanlama tokenlara bağlanır); kart ızgaralarında 40ms stagger.
- **Görünüm geçişleri:** kayıt açma/kapama, kart/liste geçişi ve tema geçişinde View Transitions API (desteklemeyen tarayıcıda anında geçiş — kademeli geliştirme).
- **Kinetic type:** hero başlığı satır satır maskeli yükseliş (tek seferlik, 700ms); katalog sayısı değişiminde `number-tick` (180ms).
- **Kurallar:** yalnızca `transform`/`opacity`; `prefers-reduced-motion` ve mevcut `motionToggle`/`effects-paused` mekanizması aynen korunur; canvas sekme dışında ve `IntersectionObserver` ile durur (mevcut davranış).

---

## 8. Bölüm Bölüm Yeniden Tasarım

### 8.1 Üst Menü + Komut Paleti
- Yoğunlaşan cam header: scroll'da yükseklik 72→56px, kenarlıklar belirginleşir (NN/g yapışkan başlık rehberi).
- **Komut paleti (⌘K / Ctrl+K):** kayıt, yazar, koleksiyon, okuma yolu ve eylemler (tema değiştir, hareketi durdur) üzerinden birleşik arama; ok tuşları + Enter; `i18n` ile TR/EN. Mevcut `/` odak kısayolu korunur; `?` kısayol haritası eklenir.
- TR/EN anahtarı ve tema düğmesi header sağ kümesinde kalır.

### 8.2 Hero — "İlk Işık"
- Tam ekran (100svh) koyu sahne; mevcut canvas küre **gözlemevi merkezi** olarak yeniden sahnelenir: ufuk çizgisi, teleskop silueti, takımyıldız veri noktaları (katalogdan gerçek kayıt sayıları!).
- Sol 7 sütunda kinetik display tipografi: "Bir dünya bilgi." / "Sonsuz keşif." satırları maskeli yükselişle girer; `em` vurgusu brass gradyanıyla parlar.
- Sağ altta mono koordinat etiketi (`DEC +41°16′ · RA 12h 30m` tarzı süs, HUD dili).
- Scroll göstergesi: ince brass çizgi + "aşağı in" mikro-etiket.

### 8.3 İstatistik Şeridi
Mono etiketli, ayraç çizgili "enstrüman paneli"; sayılar `number-tick` ile ilk görünümlerinde sayar. Aurora vurgu rengi yalnız burada.

### 8.4 Keşif Alanları — Bento
- 8 alan asimetrik bento: her hücre kendi disiplin omurga rengiyle sahnelenen özgün çizim + canlı kayıt/dil sayısı (mono).
- Hover: çizim 1.04 ölçek + bağlantı takımyıldızı çizgileri belirginleşir (40ms stagger ile nokta nokta parlar) — "bilgi bağlanır" fikrinin somut mikro-anlatısı.
- Aktif alan etiketi ve kaldırma davranışı korunur.

### 8.5 Vitrin
Mevcut özgün kapak sistemi korunur; kapaklar raf üzerinde (çift sıra gölge + raf çizgisi) sunulur, hover'da hafif eğim (perspective, 6°). "Neden bu dört kaynak?" küratör notu eklenir (i18n, 1–2 cümle).

### 8.6 Nobel Zaman Çizelgesi — Scrollytelling
- Yatay kaydırmalı "ödül galaksisi": her yıl bir yıldız; parlaklık = o yılın kayıt yoğunluğu. Seçilen yılın kayıtları şeridin altında özet kartla açılır.
- Masaüstünde scroll'a bağlı yatay kaydırma (sticky sahne + translateX, INP-dostu; reduced-motion'da yerleşik yatay kaydırma çubuğu).
- Mevcut yıl filtresi davranışı (katalog filtresi) aynen korunur.

### 8.7 Katalog — Fasetlı Arama Yeniden Tasarımı
- **Masaüstü:** sol ray (sticky) fasetler; her faset başlığında canlı sonuç sayısı; değer listeleri checkbox/radyo etiketli, uygulanan filtre brass işaretli. `<select>` yalnızca mobilde.
- **Faset çipleri:** uygulanmış her filtre çipleri satırında; çip üzerinde × kaldırır, "temizle" tümünü.
- **Boş durum:** "X için sonuç yok" + en yakın alternatif önerileri (yakın yıl, aynı alan) — Europeana deseni.
- Arama çubuğu öneri listesi (mevcut) + son aramalar + kaydettiklerine hızlı erişim.
- Kart/Liste anahtarı, `?view=` URL'leri, sayfalama, `catalogJumpbar` korunur.

### 8.8 Kayıt Kartları — Yeni Anotomi
Kart: sol 3px omurga + mono künye üst şeridi (katalog no · yıl · tür) → serif başlık → yazar → 2 satır açıklama → çip satırı → alt eylem çubuğu (Drive durumu, yıldız, aç). Hover: E2 yükselme + omurga `--glow-1`. **Liste görünümü:** "kayıt defteri" — mono künye sütunları + serif başlık tek satırda, akademik katalog estetiği (Gallica esintisi).

### 8.9 Kayıt Detayı — Düğüm Sayfası
- Diyalog yerine **tam kayıt görünümü** (View Transitions ile kart→sayfa morfu; URL `?record=` korunur, geri tuşu çalışır; mevcut odak yönetimi ve Escape davranışı yeni görünüme taşınır).
- Yerleşim: sol 5 sütun sanat paneli (kapak + bağlantılar) / sağ 7 sütun künye: mono etiketli alan künyesi (NYPL disiplinli sunum), serif başlık, açıklama, **alıntı hazır** (BiBTeX benzeri basit metin kopyalama), eylemler.
- **Keşif takımyıldızı:** mevcut "Keşfe devam et" 3'lü öneri, küçük bir SVG takımyıldız grafiğine dönüşür — merkezde açık kayıt, çevrede aynı alan/yazar/yıl kayıtları çizgiyle bağlı; düğüme tıkla → yeni kayıt. (Rijksmuseum düğüm-modeli, bu projenin verisiyle.)
- `detailRelated` mantığı (aynı kategori/koleksiyon, dil, seviye, Nobel yılı) aynen kalır.

### 8.10 Okuma Yolları
Rota kartları dikey seyir haritasına bağlanır: tek sürekli brass rota çizgisi, duraklarda numaralı düğümler; bir durak seçilince öncül/ardıl ilişkisi vurgulanır. `details/summary` klavye davranışı korunur.

### 8.11 Arşivler
Koyu, yıldız alanlı tam-kanama bölüm (mevcut). İlerleme göstergesi mono "gözlem günlüğü" estetiğine taşınır; Drive klasör kartları E1 cam kart olur.

### 8.12 Alt Bilgi
Üç sütun: kimlik + künye notu + teknik durum (çevrimdışı/senkron mono göstergeleri). Üst kenarda ince yıldız haritası silueti (mevcut çizim diliyle).

---

## 9. Yeni Kapasiteler (özet)

1. **Komut paleti (⌘K)** — 8.1.
2. **Keşif takımyıldızı** — 8.9; `catalog.json` üstünde önceden hesaplanabilir komşuluk (derleme adımında `tools/` çıktısı, çalışma anında hesap yok).
3. **Paylaşım kartları** — `tools/` içinde derleme zamanı OG görsel üretimi (özgün çizim diliyle, dış servis yok).
4. **Kısayol haritası (`?`)** ve tutarlı klavye modeli.
5. **Alıntı kopyalama** — kayıt künyesinden tek tıkla düz metin alıntı.

Kapsam dışı (bilinçli): kullanıcı hesapları, sunucu tarafı arama, dış CDN/font/analytics — projenin çevrimdışı ve dış-servissiz kimliği korunur.

---

## 10. Erişilebilirlik Planı (WCAG 2.2 AA)

- Kontrast: tüm metin çiftleri APCA ile doğrulanır ve `tools/validate_site.py` içine kontrast denetimi eklenir (kritik token çiftleri tablo halinde sabitlenir).
- Odak: her interaktif öğede `--brass-300` 2px halka + 2px ofset (koyu temada görünür).
- Hedef boyutu ≥ 24×24 (WCAG 2.2 — çipler, yıldız, × düğmeleri denetlenir).
- Komut paleti ve kayıt görünümü: `role="dialog"` / düğüm sayfası başlık sıralaması, odak tuzağı, Escape, kapanınca önceki odağa dönüş (mevcut davranışların devamlılığı).
- `lang` özniteliği TR/EN anahtarında güncellenir (ekran okuyucu telaffuzu).
- Hareket: `prefers-reduced-motion` + `motionToggle` birleşik; scrollytelling reduced-motion'da kaydırmalı listeye düşer.
- Dekoratif SVG/animasyon `aria-hidden`; canlı bölgeler (`resultCount`, `toast`) `aria-live="polite"` (korunur).

---

## 11. Performans Bütçesi

| Metrik | Bütçe |
|---|---|
| CSS (sıkıştırılmış) | ≤ 40 KB |
| JS (toplam, sıkıştırılmış) | ≤ 45 KB (framework yok) |
| Font (woff2, 3 aile subset) | ≤ 170 KB |
| Çalışma anında dış istek | 0 |
| LCP (mobil 4G) | < 2.5s |
| INP | < 200ms (yalnızca transform/opacity) |
| CLS | < 0.1 (font `size-adjust` fallback ile) |

Doğrulama: Lighthouse CI (Actions adımı), `python tools/validate_site.py`, `node --check`.

---

## 12. Bileşen Envanteri (durumlar)

| Bileşen | Varyantlar | Durumlar |
|---|---|---|
| Button | primary / quiet / glass / icon | default, hover, focus, active, disabled |
| Chip (faset/etiket) | filter / meta / removable | default, active, hover, focus |
| Card (kayıt) | grid / ledger | default, hover, focus-within, saved |
| Facet rail item | checkbox / radio | default, checked, indeterminate, disabled(0 sonuç) |
| Command palette | — | open, typing, empty, loading |
| Record view | — | loading, ready, no-access |
| Timeline star | — | default, hover, selected, filtered |
| Toast | bilgi / başarı | in, out |
| Stat | — | idle, ticking |

---

## 13. Uygulama Yol Haritası

Her faz bağımsız gönderilebilir; `?v=` sürümü artar; her faz sonunda doğrulama komutları çalışır.

| Faz | İçerik | Dosyalar | Kabul kriteri |
|---|---|---|---|
| **0 — Temel** | Token mimarisi, fontlar (self-host subset), tip ölçeği, tema altyapısı | `style.css` (ilk 200 satır yeniden), `site/fonts/*` | İki temada tüm temel metinler kontrastta; font bütçesi tutuyor |
| **1 — Kabuk** | Yoğunlaşan cam header, hero "İlk Işık", istatistik paneli, alt bilgi | `index.html`, `style.css`, `visuals.js`, `effects.js` | LCP < 2.5s; reduced-motion'da kinetik tip kapalı |
| **2 — Keşif** | Bento alanlar, vitrin rafı, Nobel galaksisi (scrollytelling) | `index.html`, `style.css`, `discovery.js`, `visuals.js` | Yatay sahne klavye ile erişilebilir; mobil tek sütun |
| **3 — Katalog** | Faset rayı, çipler, yeni kart/ledger anatomisi, boş durum | `index.html`, `style.css`, `app.js` | Tüm mevcut URL parametreleri (`?view`, `?author`, `?collection`…) aynen çalışır |
| **4 — Kayıt görünümü** | Düğüm sayfası, keşif takımyıldızı, alıntı, OG görseller | `app.js`, `index.html`, `tools/og_cards.py` (yeni) | `?record=` geri/ileri gezinme doğru; odak yönetimi korunur |
| **5 — Cila** | Komut paleti, kısayol haritası, hareket cila, a11y+perf denetimi | `app.js`, `style.css`, `tools/validate_site.py` | Lighthouse a11y ≥ 95, perf ≥ 90; WCAG checklist yeşil |

---

## 14. Kabul Testleri ve Doğrulama

```powershell
python tools/validate_site.py
node --check site/app.js
node --check site/sw.js
```

Ek manuel kontrol listesi (her faz): TR/EN geçişinde sorgu+filtre+görünüm korunumu · `?record=` doğrudan açma · klavye ile palet/faset/gezinme akışı · `motionToggle` + sistem azaltılmış hareket · 480px'de tek sütun ve yapışkan eylem çubuğu · çevrimdışı yükleme (SW) · ekran okuyucuda dekoratif öğelerin sessizliği.

## 15. Kaynakça

- Rijksmuseum Collection Online — [Webby 2025](https://winners.webbyawards.com/2025/websites-and-mobile-sites/features-design/best-user-interface/333807/rijksmuseum-collection-online) · [Museum Next analizi](https://www.museumnext.com/article/inside-the-infinite-rijksmuseum-how-one-museum-is-rethinking-digital-collections/)
- [Europeana tasarım yaklaşımı](https://www.dataspace-culturalheritage.eu/en/news/exploring-europeana-s-approach-to-design)
- [NYPL araştırma kataloğu](https://www.nypl.org/research/research-catalog/search/advanced) · [arama rehberi](https://libguides.nypl.org/researchcatalog/searching)
- [NASA Eyes](https://eyes.nasa.gov/) · [NASA Web Design System](https://nasa.github.io/nasawds-site/)
- [Awwwards tipografi koleksiyonu](https://www.awwwards.com/awwwards/collections/typography-in-web-design/) · [Figma 2026 eğilimleri](https://www.figma.com/resource-library/web-design-trends/) · [MadeGood web tipografisi 2026](https://madegooddesigns.com/web-typography-trends-2026/) · [Fontfabric 2026](https://www.fontfabric.com/blog/top-typography-trends-for-2026/)
- [NN/g yapışkan başlıklar](https://www.nngroup.com/articles/sticky-headers/) · [V&A Collections](https://www.vam.ac.uk/collections)

> Bu plan yalnızca özgün üretim içindir; referans sitelerden hiçbir görsel, metin veya varlık kopyalanmaz.
