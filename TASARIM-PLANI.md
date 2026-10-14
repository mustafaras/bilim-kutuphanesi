# Bilim Kütüphanem — "Gözlemevi" Uluslararası Düzeyde Tasarım ve Mühendislik Planı

**Sürüm:** 2.0 · **Tarih:** 2026-10-14 · **Durum:** Onay bekliyor
**Kalite hedefi:** Awwwards/Webby düzeyinde sanatsal yönetmenlik + WCAG 2.2 AA + Core Web Vitals "iyi" bandı + sıfır i18n kusuru
**Kapsam:** `site/` altındaki tüm kullanıcı arayüzü ve `tools/` doğrulama hattı
**Değişmez kısıtlar:** Vanilla HTML/CSS/JS · GitHub Pages statik yayın · çalışma anında dış istek yok (fontlar dahil self-host) · çevrimdışı katalog (SW) · TR/EN tam parite · azaltılmış hareket desteği · mevcut URL sözleşmesi (`?ui`, `?view`, `?record`, `?author`, `?collection`, `?discover`, `?saved`) aynen korunur

---

## 0. Bu Belge Nasıl Kullanılır

Bu belge **ana plan**dır: vizyon, bilimsel metodoloji, araştırma sentezi, i18n denetimi, tasarım sistemi spesifikasyonu ve faz mimarisi. Uygulama, `docs/tasarim/` altındaki **8 faz dosyasında** yürütülür. Her faz dosyası şunları içerir:

1. Amaç, girdiler, kapsam (içinde/dışında)
2. Dosya düzeyinde çalışma planı
3. Teknik spesifikasyon
4. Adım adım görev listesi
5. **Uygulama promptu** — yeni bir Copilot/Codex oturumuna olduğu gibi yapıştırılabilir, kendi kendine yeterli talimat
6. Kabul kriterleri (Checklist), doğrulama komutları, regresyon listesi, geri alma planı

**Yönetişim kuralı:** Bir faz, ancak kendi kabul kriterleri %100 yeşilken tamamlanır. Faz atlanmaz, sıra değiştirilmez (bağımlılıklar Bölüm 11'de). Her faz ayrı commit + ayrı PR olarak gönderilir; `?v=` önbellek sürümü her fazda artar.

---

## 1. Metodoloji — Bilimsel Çerçeve

Süreç, çift elmas (keşif→tanım→geliştirme→teslim) modeliyle yürütülür; her karar aşağıdaki kanıt çerçevelerine bağlanır:

| Çerçeve | Bu projedeki uygulama |
|---|---|
| **Nielsen 10 kullanılabilirlik heuristiği** | Mevcut arayüzün denetimi (Bölüm 1.1) ve her fazın kabul testlerinde kontrol maddesi |
| **WCAG 2.2 Level AA** | Kontrast, odak görünürlüğü, hedef boyutu (≥24×24), klavye, ekran okuyucu; ARIA desenleri WAI-ARIA APG'den alınır (combobox, dialog, disclosure) |
| **APCA (Lc)** | Metin kontrastı WCAG 2.x oransal yöntemi yerine APCA Lc ile doğrulanır: gövde ≥ Lc 75, büyük başlık ≥ Lc 60, dekoratif ≥ Lc 45 |
| **Core Web Vitals** | LCP < 2.5s, INP < 200ms, CLS < 0.1 (mobil 4G); her faz sonunda ölçüm |
| **Tasarım token taksonomisi (W3C DCG modeli)** | Üç katman: ilkel → anlamsal → bileşen (Bölüm 5.1) |
| **Kademeli geliştirme** | View Transitions API, `:has()`, container queries — desteklemeyen tarayıcıda eşdeğer statik davranış |
| **Kanıt temelli tasarım kararları (ADR)** | Her mimari karar Bölüm 11.3 ADR tablosuna işlenir |

### 1.1 Mevcut Arayüz Denetimi (Nielsen heuristikleri üzerinden)

| Heuristik | Bulgu | Şiddet |
|---|---|---|
| Görsel hiyerarşi | Tüm bölümler aynı "başlık+açıklama+ızgara" kalıbı; sayfa ritmi düz | Yüksek |
| Tutarlılık | Georgia system serif; marka karakteri taşıyan tipografi yok | Yüksek |
| Tanıma yerine hatırlama | Keşif bağlantıları (yazar/alan) yalnız detay diyalogunda; katalog yüzeyinde keşif kıvılcımı yok | Orta |
| Esneklik/verimlilik | Klavye kısayolu yalnız `/`; komut paleti, eylem kısayolları yok | Orta |
| Hata önleme | Faset seçeneklerinde canlı sonuç sayısı yok; 0 sonuç veren kombinasyonlar önceden görülmez | Orta |
| Estetik/minimalist tasarım | Dekorasyon (ambient ışıklar) içerik hiyerarşisine hizmet etmiyor | Düşük |

### 1.2 Ölçüt Hedefleri (SOTA tanımı)

- **Sanatsal:** hero'da kinetik tipografi; her bölümün kendi sahne kurgusu; tek kimlik (derin uzay + pirinç enstrüman + fildişi okuma ışığı).
- **Fonksiyonel:** her interaktif öğe 120–400ms'de kasıtlı geri bildirim; arama→odak→derinleş keşif zinciri her adımda sürdürülür.
- **Uluslararası:** EN modda **hiçbir arayüz etiketi Türkçe kalmaz**; veri-güdümlü etiketler derleme zamanında doğrulanır (Bölüm 4).
- **Kapsayıcı:** WCAG 2.2 AA + klavye-öncelikli + reduced-motion eşdeğer deneyim.

---

## 2. Araştırma Sentezi (web taraması, 2026-10-14)

| Kaynak | İncelenen özellik | Bu projeye uyarlanan | Bilinçli olarak alınmayan |
|---|---|---|---|
| Rijksmuseum Collection Online (2025 Webby, Best UI) | Bağlantılı veri keşfi, "düğüm sayfaları", her yerde arama | Kayıt sayfasını keşif düğümüne dönüştürme; takımyıldız komşuluk grafiği | Kullanıcı hesabı/remix galerisi |
| Europeana | Çok dilli fasetlı arama, kullanıcı araştırması temelli IA | Faset başına canlı sayım; dil değişiminde durum korunumu kuralları | Kurumsal portal ölçeği |
| NYPL Digital Collections | Arama-öncelikli IA; künye sunumu; gelişmiş arama | Künye alanlarının mono-etiketli akademik sunumu; alıntı kopyalama | Kütüphane oturum/yönetimi |
| Gallica (BnF) | Akademik faset, derin önizleme | Liste görünümünün "kayıt defteri" estetiği | IIIF görüntü sunucu |
| NASA Eyes + NASA WDS | Koyu bilimsel HUD dili, cam katmanlar, a11y omurgası | "Gözlemevi" koyu teması; HUD mono etiketler; erişilebilirlik kuralları | Gerçek zamanlı 3D motor |
| Awwwards 2026 eğilimleri | Kinetik tipografi, scrollytelling, bento, sanatsal yönetmenlik | Kinetic hero; Nobel galaksisi scroll sahnesi; bento keşif alanları | WebGL bağımlılığı (Canvas 2D yeterli) |
| 2026 tipografi (MadeGood, Fontfabric) | Değişken font sistemleri, serif rönesansı, `clamp()` ölçek, APCA | Fraunces+Inter+IBM Plex Mono; akışkan ölçek; APCA hedefleri | CDN font servisleri |
| Linear/Vercel/Stripe | Koyu-öncelik derinlik, mikro-etkileşim disiplini | Yükselme ölçeği, odak halkası, tutarlı hareket dili | Framework/bund altyapısı |

**Telif ilkesi:** Hiçbir görsel, metin, varlık veya stil kopyalanmaz; yalnızca etkileşim ve yerleşim desenleri bu projenin özgün kimliği için yeniden tasarlanır. Kaynakların tam listesi Bölüm 14'te.

---

## 3. Ürün Hedefleri ve Başarı Ölçütleri

| Hedef | Ölçüt | Ölçüm yöntemi |
|---|---|---|
| Ödüllü düzeyde görsel kimlik | 8 bölümün her biri farklı sahne kurgusunda; tek tip sistemi | Faz 2–5 kabul checklist'leri |
| i18n kusursuzluğu | EN modda kalan Türkçe arayüz etiketi sayısı = 0 | `tools/validate_i18n.py` (Faz 1) + manuel dil turu |
| Erişilebilirlik | Lighthouse a11y ≥ 95; WCAG 2.2 AA checklist yeşil | axe/Lighthouse + manuel klavye turu |
| Performans | LCP < 2.5s, INP < 200ms, CLS < 0.1; CSS ≤ 40KB, JS ≤ 45KB, font ≤ 170KB (gzip sonrası aktarım) | Lighthouse CI (Actions) |
| Davranışsal geriye uyumluluk | Tüm mevcut URL parametreleri + SW çevrimdışı + okuma listesi içe/dışa aktarım aynen çalışır | Faz kabul regresyon listeleri |

---

## 4. i18n Denetimi — Kanıtlı Bulgular ve Hedef Mimari

Kod incelemesi (2026-10-14, `site/app.js`, `site/i18n.js`, `site/data/catalog.json`, 2653 kayıt) sonucu tespit edilen kusurlar:

| # | Konum | Belirti (EN modda) | Kök neden | Çözüm (Faz 1) |
|---|---|---|---|---|
| i1 | `app.js → renderRoutes()` | Okuma yolu adım notları Türkçe kalır (75 not; 64'ü Türkçe karakter içerir) | `EN_ROUTES` yalnızca 10 rotanın başlık+açıklamasını çevirir; `steps[].note` çevrilmez | Adım notlarının EN karşılıkları veri hattında üretilir; `catalog.json` içine `note_en` alanı |
| i2 | `i18n.js → EN_ROUTES` | Rota sırası değişirse çeviriler **sessizce yanlış** rotaya eşleşir | Pozisyonel dizi (`EN_ROUTES[i]`) — ID bağlantısı yok | ID-anhtarlı sözlük; sıra bağımsız |
| i3 | `i18n.js → EN_LABELS` | Yeni kategori/tür/dil/seviye değeri eklendiğinde EN'de Türkçe kalır (bugün 0 eksik; mekanizma kırılgan) | Veri-güdümlü etiketler elle bakılan sabit harita | Derleme zamanı doğrulayıcı: katalogdaki tüm distinct değerlerin EN karşılığı zorunlu; CI'da bloke |
| i4 | `app.js → renderDriveFolders()` | Drive kökü fallback etiketi `'Kişisel arşiv'` sabit Türkçe | Sabit metin `t()` dışında | `t()` anahtarına taşınır |
| i5 | `app.js → render()` | `resultCount` EN metni satır içi sabit; sözlük dışı bakım | Kalıp dışı çeviri | `recordsSummary` bileşik anahtarına taşınır (çoğul kurallarıyla) |
| i6 | `app.js → t()` | Eksik anahtar sessizce anahtar adını döndürür | Fallback stratejisi yok | Geliştirme modunda `console.warn`; doğrulayıcıda eksik anahtar taraması |
| i7 | Genel | Çoğul biçimler elle çoğaltılıyor (`activeFilterSingular/Plural`) | TR/EN çoğul kuralları modellenmemiş | `plural(key, n)` yardımcı: TR tek biçim, EN çoğul eki; yeni anahtarlar bu API ile |

**Tasarım gereği korunan davranış (kusur değil):** kayıt başlıkları, yazarlar ve açıklamalar özgün dillerinde kalır (uluslararası katalog pratiği; arayüzde `originalNote` ile açıkça bildirilir).

**Hedef mimari (Faz 1):**
- UI dizeleri: `site/i18n.js` (tek kaynak; TR/EN anahtar paritesi doğrulanır).
- Veri etiketleri: `tools/` tarafından üretilen `site/data/i18n-data.json` — `EN_LABELS` buraya göçer; `EN_ROUTES` → ID-anhtarlı `routes` bölümü; adım notları `note_en`.
- Doğrulama: `tools/validate_i18n.py` — (a) UI anahtar paritesi, (b) tüm distinct faset değerlerinin EN karşılığı, (c) tüm rota/adım notlarının EN karşılığı, (d) EN değerlerde Türkçe karakter taraması (veri etiketleri için), (e) `index.html`'de `data-i18n*` özniteliği olup sözlükte karşılığı olmayan anahtar. `pages.yml` doğrulama adımına eklenir; hata varsa **yayın bloke**.

---

## 5. Tasarım Sistemi Spesifikasyonu — "Gözlemevi"

### 5.1 Token Mimarisi

Üç katman (W3C DCG modeli). Bileşen CSS'i yalnızca 2. ve 3. katmanı görür; ham renk/boyut bileşen katmanında yazılmaz.

```css
/* 1 — İlkel (tema bağımsız) */
:root{--space-1:4px;--space-2:8px;--space-3:12px;--space-4:16px;--space-6:24px;
--space-8:32px;--space-12:48px;--space-16:64px;--space-24:96px;--space-32:128px;
--radius-xs:2px;--radius-sm:6px;--radius-md:10px;--radius-lg:16px;--radius-pill:999px;
--dur-1:120ms;--dur-2:240ms;--dur-3:400ms;--dur-4:700ms;
--ease-out:cubic-bezier(.22,1,.36,1);--ease-spring:cubic-bezier(.34,1.56,.64,1);
--z-sticky:100;--z-jumpbar:150;--z-palette:200;--z-dialog:300;--z-toast:400;}
/* 2 — Anlamsal (tema başına) */
[data-theme="dark"]{--surface-0:#060A12;--surface-1:#0A101C;--surface-2:#101A2A;--surface-3:#1A2838;
--text-1:#F2EEE3;--text-2:#A8B0BC;--accent-1:#E8CE9E;--accent-2:#D4B68A;--line-1:#FFFFFF1A;
--focus:#E8CE9E;--glass:rgba(16,26,42,.62);}
[data-theme="light"]{--surface-0:#F6F4EC;--surface-1:#FBFAF5;--surface-2:#FFFFFF;--surface-3:#EFEDE4;
--text-1:#1B2B38;--text-2:#5A6B77;--accent-1:#8A5A32;--accent-2:#A15C39;--line-1:#1B2B3820;
--focus:#8A5A32;--glass:rgba(251,250,245,.72);}
/* 3 — Bileşen */
:root{--card-radius:var(--radius-sm);--card-pad:var(--space-6);--header-h:72px;
--focus-ring:2px solid var(--focus);--focus-offset:2px;}
```

### 5.2 Renk

**Koyu tema (birincil kimlik):** gece zemini `#060A12→#1A2838`; pirinç vurgu ailesi `#E8CE9E/#D4B68A/#B39062`; bilimsel ikincil `--aurora:#7CC7B7` (istatistik/Nobel); `--nebula:#B9A7D6` (edebiyat). **Aydınlık tema:** rafine parşömen (mevcut paletin devamı) — eşit özen. Kontrast taahhüdü APCA Lc ile: gövde ≥75, başlık ≥60, dekoratif ≥45; `tools/validate_contrast.py` kritik çiftleri CI'da denetler.

**Disiplin omurgaları** (kart sol kenarı 3px + başlık ipucu + detay tam şerit): fizik `#7CC7B7`, matematik `#E8CE9E`, biyoloji `#8FBF8A`, edebiyat `#B9A7D6`, tarih `#D69A6B`, nöro `#7FA8D8`, kimya `#D8A05A`, yer `#8FA8A0`.

### 5.3 Tipografi

Self-host woff2 (latin + **latin-ext — Türkçe zorunlu**), `font-display: swap`, `size-adjust` fallback, toplam ≤ 170KB:

| Rol | Aile | Kullanım |
|---|---|---|
| Display serif | **Fraunces** var (opsz 9–144, wght 300–900, SOFT 50, WONK hero'da 1) | h1–h3, kayıt başlıkları, kapaklar |
| UI/body | **Inter** var (wght 400–700) | gövde, arayüz, fasetler |
| Mono/HUD | **IBM Plex Mono** 400/500 | künye etiketleri, katalog no, koordinat süsleri |

Ölçek: `--fs-display:clamp(52px,8vw,108px)`, `--fs-h2:clamp(34px,4vw,56px)`, `--fs-h3:clamp(22px,2.4vw,30px)`, `--fs-lead:clamp(17px,1.5vw,20px)`, gövde `16px/1.75`, meta 13.5px, etiket 11px/uppercase/+0.18em mono. Serif başlıklarda `-0.02em`.

### 5.4 Yerleşim

12 sütun, `max-width:1440px`, gutter `clamp(20px,3vw,44px)`; içerik çoğunlukla 8 sütun; bölüm dikey ritmi `clamp(72px,10vh,140px)`; kırılımlar **480/768/1024/1440** (mevcut 760/1100 bu değerlere göçer). Mobilde yapışkan alt eylem çubuğu (ara + görünüm anahtarı).

### 5.5 Hareket

Tokenlar Bölüm 5.1'de. Kurallar: yalnızca `transform/opacity` (INP); ızgara girişlerinde 40ms stagger; kart→kayıt geçişinde View Transitions (destek yoksa anında); sayı değişimlerinde `number-tick` 180ms; `prefers-reduced-motion` + mevcut `motionToggle`/`effects-paused` mekanizması aynen; canvas sekme dışında + `IntersectionObserver` ile durur (mevcut davranış korunur).

### 5.6 Doku ve Derinlik

Sabit film greni (SVG feTurbulence, %3, animasyonsuz; banding önler). Cam yalnız 3 yüzeyde: header, komut paleti, katalog şeridi. Yükselme: E0 düz / E1 kart / E2 hover / E3 yapışkan şerit / E4 palet-diyalog — koyu temada gölge yerine kenar-ışığı `inset 0 1px 0 #FFFFFF0F`. Parıltı ölçeği: `--glow-1` 8px %25 (hover) → `--glow-2` 20px %40 (aktif).

### 5.7 İkonografi

Mevcut 8 özgün vektör korunur; tek çizgi kuralı (1.5px, `--accent-2`, round cap, 24px grid, `currentColor`). Yeni: takımyıldız motifi (nokta+bağ çizgisi) keşif göstergesi.

---

## 6. Bölüm Bölüm Tasarım Özeti

Ayrıntılar faz dosyalarında; burada hedef deneyim:

| Bölüm | Yeni deneyim | Faz |
|---|---|---|
| Header | Yoğunlaşan cam header (72→56px) + ⌘K komut paleti giriş noktası | 2, 6 |
| Hero "İlk Işık" | 100svh koyu sahne; gözlemevi ufku + gerçek kayıt sayılarından takımyıldız; kinetik display tipografi; mono koordinat HUD | 2 |
| İstatistikler | Mono etiketli enstrüman paneli; `number-tick` sayaçlar | 2 |
| Keşif alanları | Asimetrik bento (2 büyük + küçük hücreler); hover'da takımyıldız bağları belirginleşir | 3 |
| Vitrin | Raf üstü kapaklar (çift gölge + raf çizgisi), hover'da 6° perspektif; küratör notu | 3 |
| Nobel galaksisi | Yatay scroll sahnesi; yıl-yıldızlar, parlaklık=kayıt yoğunluğu; sticky kurgu; reduced-motion'da yerleşik kaydırma | 3 |
| Katalog | Sol ray fasetler (canlı sayım, checkbox/radyo, E1 cam); çipler; boş durumda en yakın alternatif önerileri | 4 |
| Kartlar | Yeni anotomi (omurga + mono künye şeridi + serif başlık + eylem çubuğu); liste = "kayıt defteri" | 4 |
| Kayıt | Diyalog → tam düğüm sayfası (View Transitions; URL/odak sözleşmesi korunur); künye + alıntı kopyalama + keşif takımyıldızı | 5 |
| Okuma yolları | Dikey seyir haritası; sürekli brass rota çizgisi, numaralı duraklar | 4 |
| Arşivler | Koyu yıldız alanı; mono "gözlem günlüğü" ilerlemesi | 3 |
| Alt bilgi | 3 sütun + yıldız haritası silueti | 2 |

---

## 7. Bileşen Envanteri

| Bileşen | Varyant | Durumlar |
|---|---|---|
| Button | primary/quiet/glass/icon | default, hover, active, focus-visible, disabled |
| Chip | filter/meta/removable | default, active, hover, focus |
| Card | grid/ledger | default, hover, focus-within, saved |
| Facet item | checkbox/radio | default, checked, indet., disabled(0) |
| Command palette | — | open, typing, empty, loading |
| Record view | — | loading, ready, no-access |
| Timeline star | — | default, hover, selected, in-range |
| Stat | — | idle, ticking |
| Toast | info/success | in, out |
| Progress (arşiv) | — | idle, partial, complete |

Her bileşek için boş/yükleniyor/hata durumu tanımlıdır; loading iskeletleri CLS'siz (`min-height` sabit).

---

## 8. Erişilebilirlik Spesifikasyonu (WCAG 2.2 AA)

1. Odak: tüm interaktif öğelerde `--focus-ring` + `--focus-offset`; hiçbir `outline:none` tek başına kalmaz.
2. Hedef boyutu ≥ 24×24 (çipler, yıldız, ×, yıl yıldızları).
3. ARIA desenleri WAI-ARIA APG: arama+öneri = combobox (`aria-expanded`, `aria-activedescendant` — mevcut korunur); komut paleti = dialog + listbox; faset paneli = disclosure; kayıt görünümü = başlık hiyerarşisi + odak yönetimi (mevcut davranışların devamlılığı).
4. `lang` özniteliği TR/EN anahtarında güncellenir (ekran okuyucu telaffuz).
5. Canlı bölgeler: `resultCount`, `toast` → `aria-live="polite"` (korunur).
6. Dekoratif SVG/canvas `aria-hidden`; `skip` bağlantısı korunur.
7. Hareket: `prefers-reduced-motion` = tam işlevsel eşdeğer deneyim (scrollytelling → kaydırılabilir liste).
8. Doğrulama: axe DevTools taraması + manuel klavye turu her fazda; Faz 7'de tam denetim.

---

## 9. Performans Bütçesi ve Strateji

| Metrik | Bütçe | Önlem |
|---|---|---|
| CSS (gzip) | ≤ 40KB | Faz bazlı denetim; ölü kural temizliği |
| JS (gzip) | ≤ 45KB | Framework yok; mevcut vanilla mimari |
| Font (woff2) | ≤ 170KB | 3 aile × subset (latin+latin-ext); kritik ağırlık preload |
| Dış istek (çalışma) | 0 | Self-host; SW önbelleği |
| LCP | < 2.5s (mobil 4G) | Hero metni CSS'te; canvas `defer`; font swap + size-adjust |
| INP | < 200ms | transform/opacity; 120ms debounce arama (mevcut) |
| CLS | < 0.1 | Sabit en-boy oranları; skeleton `min-height` |

Ölçüm: Lighthouse CI her faz PR'ında (Actions); manuel WebPageTest kontrolü Faz 7.

---

## 10. Riskler ve Önlemler

| Risk | Olasılık | Önlem |
|---|---|---|
| View Transitions desteklenmez | Bilinen | Kademeli: statik geçiş eşdeğeri; özellik algılama |
| Font bütçesi aşılır | Orta | Subset denetimi Faz 0 kabulünde; gerekirse mono aile subset'i daraltılır |
| Katalog 2653 kayıtla ızgara render yavaşlar | Orta | Sayfalama korunur (24/sayfa); stagger yalnız ilk 24 kartta |
| i18n göçü veri hattını kırar | Orta | Faz 1, göçü `tools/` içinde çift-yazım (eski+yeni alan) ile yapar; `Guncelle.ps1` uyumlu |
| Scrollytelling INP'yi düşürür | Orta | `translateX` transform; RAF sınırı; reduced-motion eşdeğeri |
| Geriye uyumluluk kaybı (URL'ler) | Düşük | Her fazda regresyon listesi; `?record=` davranışı Faz 5'te özel test |

---

## 11. Faz Mimarisi

### 11.1 Sıra ve Bağımlılıklar

```
FAZ-0 Token+Tipografi ──► FAZ-2 Kabuk+Hero ──► FAZ-3 Keşif Katmanı ──► FAZ-4 Katalog ──► FAZ-5 Kayıt ──► FAZ-6 Komut Paleti ──► FAZ-7 Cila+Yayın
FAZ-1 i18n Onarımı (FAZ-0'dan bağımsız; FAZ-4 öncesi bitmiş olmalı)
```

### 11.2 Faz Özeti

| Faz | Dosya | Hedef | Temel çıktı |
|---|---|---|---|
| 0 | `docs/tasarim/FAZ-0-temel.md` | Tasarım sistemi temeli | Token katmanları, self-host fontlar, tip ölçeği, tema altyapısı |
| 1 | `docs/tasarim/FAZ-1-i18n.md` | Çok dilli mükemmellik | i1–i7 düzeltmeleri, `i18n-data.json`, `validate_i18n.py`, CI bloke |
| 2 | `docs/tasarim/FAZ-2-kabuk.md` | Kabuk ve "İlk Işık" | Cam header, hero sahnesi, istatistik paneli, alt bilgi |
| 3 | `docs/tasarim/FAZ-3-kesif.md` | Keşif katmanı | Bento alanlar, vitrin rafı, Nobel galaksisi, arşiv bölümü |
| 4 | `docs/tasarim/FAZ-4-katalog.md` | Katalog sistemi | Faset rayı, yeni kart/ledger, okuma yolları haritası, boş durum |
| 5 | `docs/tasarim/FAZ-5-kayit.md` | Kayıt deneyimi | Düğüm sayfası, keşif takımyıldızı, alıntı kopyalama, OG görseller |
| 6 | `docs/tasarim/FAZ-6-palet.md` | Komut paleti + klavye | ⌘K paleti, `?` kısayol haritası, eylem kısayolları |
| 7 | `docs/tasarim/FAZ-7-cila.md` | Hareket/a11y/perf cilası | Lighthouse hedefleri, tam a11y denetimi, hareket koreografisi, yayın |

### 11.3 Mimari Karar Kaydı (ADR)

| Karar | Gerekçe | Alternatif (reddedilen) |
|---|---|---|
| Framework yok, vanilla devam | 45KB JS bütçesi; çevrimdışı; bakım sadeliği | React/Astro — bütçe ve altyapı karmaşıklığı |
| Fontlar self-host | Sıfır dış istek; GDPR/çevrimdışı | Google Fonts CDN |
| Kayıt detayı: diyalog → sayfa (View Transitions) | Keşif zinciri + URL paylaşımı + geri tuşu | Modal kalması — derinlik hissi ve keşif sınırlı |
| Veri çevirileri derleme zamanında | Çalışma anında hata imkânı sıfır; CI bloke | Runtime sözlük — sessiz kaçak riski |
| Canvas 2D (WebGL yok) | INP bütçesi; yeterli ifade | Three.js — bağımlılık + performans |

---

## 12. Kabul Testleri (genel, her fazda)

```powershell
python tools/validate_site.py
python tools/validate_i18n.py   # Faz 1 sonrası
node --check site/app.js
node --check site/sw.js
node --check site/i18n.js
```

Manuel tur (her faz): TR↔EN geçişinde sorgu+filtre+görünüm+detay korunumu · EN'de Türkçe kalan etiket taraması · klavye ile tam akış · `motionToggle` + sistem reduced-motion · 480/768/1024/1440 kırılımları · çevrimdışı yükleme · okuma listesi içe/dışa aktarım · tüm URL parametre sözleşmesi.

---

## 13. Kaynakça

- Rijksmuseum: [Webby 2025](https://winners.webbyawards.com/2025/websites-and-mobile-sites/features-design/best-user-interface/333807/rijksmuseum-collection-online) · [Museum Next](https://www.museumnext.com/article/inside-the-infinite-rijksmuseum-how-one-museum-is-rethinking-digital-collections/)
- [Europeana tasarım](https://www.dataspace-culturalheritage.eu/en/news/exploring-europeana-s-approach-to-design) · [NYPL katalog](https://www.nypl.org/research/research-catalog/search/advanced) · [V&A Collections](https://www.vam.ac.uk/collections)
- [NASA Eyes](https://eyes.nasa.gov/) · [NASA WDS](https://nasa.github.io/nasawds-site/)
- [Awwwards tipografi](https://www.awwwards.com/awwwards/collections/typography-in-web-design/) · [Figma 2026 eğilimleri](https://www.figma.com/resource-library/web-design-trends/) · [MadeGood tipografi 2026](https://madegooddesigns.com/web-typography-trends-2026/) · [Fontfabric 2026](https://www.fontfabric.com/blog/top-typography-trends-for-2026/)
- [WAI-ARIA APG](https://www.w3.org/WAI/ARIA/apg/) · [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [APCA](https://git.apcacontrast.com/documentation/APCAeasyIntro) · [NN/g yapışkan başlıklar](https://www.nngroup.com/articles/sticky-headers/)

> Bu plan özgün üretim içindir; referans sitelerden hiçbir görsel, metin veya varlık kopyalanmaz.
