# FAZ 5 — Kayıt Deneyimi (Düğüm Sayfası, Keşif Takımyıldızı, Alıntı, OG Görseller)

**Öncül:** FAZ-0..4 · **Sonraki:** FAZ-6 · **Süre tahmini:** 2 oturum

## 1. Amaç

Kayıt detayını sıkışık diyalogdan, Rijksmuseum "düğüm sayfası" modelinde **tam keşif görünümüne** dönüştürmek: View Transitions ile kart→sayfa morfu, akademik künye sunumu, tek tıkla alıntı, ve aynı alan/yazar/yıl kayıtlarını bağlayan **keşif takımyıldızı** grafiği. URL/odak/geri-tuşu sözleşmesi birebir korunur.

## 2. Kapsam

- **İçinde:** `index.html` (yeni `record-view` bölümü; `recordDialog` kaldırılır), `style.css`, `discovery.js` (yeniden yazım: sayfa tabanlı), `app.js` (entegrasyon noktaları), yeni `site/record.js` (detay mantığı), `tools/og_cards.py` (yeni, derleme zamanı OG görselleri).
- **Dışında:** komut paleti (FAZ-6).

## 3. Teknik Spesifikasyon

### 3.1 Diyalog → Sayfa Geçişi
- `<dialog id="recordDialog">` yerine `#record-view` bölümü (sayfa içinde, `hidden` yönetimli) — **SPA kalır**: gerçek sayfa yükleme yok.
- Açılış: `document.startViewTransition` destekliyse kart→sayfa morfu (kapak öğesi `view-transition-name` ile eşleşir); destek yoksa anında geçiş + `reveal-in`.
- **Korunacak sözleşmeler:** `?record=<id>` URL'si (pushState; `library:ready`'de otomatik açılış), geri tuşu ile kapanış (`popstate`), kapanınca açan karta odağa dönüş, Escape ile kapanış, sayfa scroll kilidi, inert arka plan (mevcut `inertElements` mantığı sayfa moduna uyarlanır).
- Odak yönetimi: açılınca `#recordTitle` odak (`tabindex="-1"`); kapanınca önceki kontrol.
- `detailBackdrop` yerine: arka plan bölümleri `inert` + `aria-hidden` (mevcut desen).

### 3.2 Düğüm Sayfası Yerleşimi (12 sütun)
- **Sol 5:** sanat paneli — kapak (`cover()` mevcut), bağlantılar (PDF/kaynak), görsel not.
- **Sağ 7:** mono künye şeridi (katalog no · koleksiyon · yıl) → Fraunces başlık → yazar → erişim durumu → `dl` künye (dil/tür/seviye/yıl/sayfa — mono `dt`, değer `dd`) → açıklama (+`originalNote` işareti özgün dildeyse) → **alıntı kopyalama** → eylemler (yıldız, paylaş).
- **Alt tam genişlik:** keşif takımyıldızı.

### 3.3 Keşif Takımyıldızı
- SVG (Canvas 2D gerekmez — etkileşimli düğümler için SVG daha erişilebilir): merkezde açık kayıt; çevrede `renderRelated` mantığının genişletilmiş çıktısı (aynı kategori+koleksiyon, mevcut önceliklendirme: dil/seviye/farklı yazar/Nobel yılı yakınlığı — **hesaplama mantığı aynen**, yalnızca sunum 3 kart yerine 6–8 düğümlü graf).
- Düğümler: gerçek `<button>` (odaklanabilir, `aria-label` = başlık+yazar); bağ çizgileri dekoratif `aria-hidden`; merkez düğüme hover'da `--glow-1`.
- Komşu düğüme tıkla → aynı görünüm içinde yeni kayda geçiş (View Transition; `?record=` güncellenir; başlık odaklanır) — mevcut "panel yenilenir" davranışının devamı.
- Erişilebilir eşdeğer: grafiğin altında düğüm listesi (görsel olarak grafikle aynı veri, ekran okuyucu/klavye için) — grafik `role="img"` + `aria-label` özet; liste görsel olarak gizlenebilir değil, kompakt satır olarak kalır (WCAG 1.1.1).
- Reduced-motion: geçiş animasyonsuz; grafik statik.

### 3.4 Alıntı Kopyalama
- `t('cite')` düğmesi → panoya düz metin: `Yazar. "Başlık." Koleksiyon, Yıl. Bilim Kütüphanem, erişim: <URL>` (TR/EN şablonu i18n anahtarında). `navigator.clipboard` yoksa metin alanı fallback (mevcut paylaşım deseni).

### 3.5 OG Paylaşım Görselleri
- `tools/og_cards.py`: derleme zamanında (Actions veya Guncelle.ps1) her kayıt için 1200×630 SVG→PNG statik görsel üretme — kapak + başlık + omurga rengi; `site/og/<id>.png`. `index.html`'e dinamik `og:image` meta (JS ile `?record=` açılışında güncellenir; crawl varsayılanı vitrin görseli). Harici kütüphane bağımlılığı: repo içinde sabit Python (ör. Pillow varsa kullan; yoksa SVG çıktı + GitHub Actions adımında rasterizasyon; **çalışma anında dış servis kesinlikle yok**).

## 4. Görev Listesi

1. `record.js`: `openRecord(id)/closeRecord()` + View Transitions + `popstate` + odak/inert yönetimi; `discovery.js`'teki diyalog mantığını taşı ve sadeleştir.
2. `index.html`: `#record-view` yapısı; diyalog kaldır.
3. Düğüm sayfası yerleşimi + künye + alıntı.
4. Takımyıldız SVG render + liste eşdeğeri + düğüm geçişi.
5. `tools/og_cards.py` + `pages.yml` derleme adımı.
6. Yeni dizeler TR/EN (cite, citedCopied, constellationSummary vb.); `?v=44`; tam regresyon.

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla JS, GitHub Pages, dış istek YASAK) FAZ-5'i uygula: kayıt deneyimi. Önce TASARIM-PLANI.md ve docs/tasarim/FAZ-5-kayit.md dosyalarını oku. FAZ-0..4 tamamlanmış varsayılır.

Kritik sözleşme — aynen korunacak davranışlar (mevcut kod: site/discovery.js'teki dialog mantığı):
- ?record=<id> URL'si: library:ready'de otomatik açılış; açıkken URL'de kalır; kapanınca silinir.
- Geri tuşu kayıt görünümünü kapatır (popstate); Escape kapatır.
- Kapanınca açan kontrole (kart başlığı, vitrin, rota bağlantısı) odağa dönüş.
- Açıkken arka plan inert + sayfa scroll kilidi.
- detailFavorite/detailShare (clipboard + fallback input) davranışları.
- Keşif önerileri hesaplama mantığı (renderRelated): aynı collection+category, öncelik aynı dil/seviye/farklı yazar/Nobel yakın yıl — hesap AYNEN, sunum değişecek.

Uygulanacak tasarım:
1. DİYALOG → SAYFA — <dialog id="recordDialog"> ve #detailBackdrop KALDIR; yerine #record-view bölümü (index.html, hidden yönetimli; SPA kalır, gerçek sayfa yükleme YOK). Açılışta document.startViewTransition varsa kart→sayfa morfu (kart kapağı ve sayfa sanat paneli aynı view-transition-name ile eşleşsin); yoksa anında geçiş + reveal-in. Odak: açılınca #recordTitle (tabindex=-1), kapanınca önceki kontrol. Yeni dosya site/record.js (openRecord/closeRecord/popstate/odak/inert); discovery.js sadeleşir (vitrin + ilgili-kayıt hesabı kalır).
2. DÜĞÜM SAYFASI — 12 sütun: sol 5 sanat paneli (mevcut cover() çıktısı + bağlantılar + görsel not), sağ 7: mono künye şeridi (katalog no · koleksiyon · yıl) → Fraunces başlık → yazar → erişim → dl künye (dil/tür/seviye/yıl/sayfa; mono dt) → açıklama (+ özgün dildeyse originalNote) → ALINTI KOPYALAMA düğmesi → eylemler.
3. ALINTI — t('cite'): panoya "Yazar. \"Başlık.\" Koleksiyon, Yıl. Bilim Kütüphanem. <URL>" (TR/EN şablonu i18n'de; URL mevcut paylaşım URL'si üretimiyle aynı). navigator.clipboard yoksa metin alanı fallback. kopyalandı toast'u (t('citedCopied')).
4. KEŞİF TAKIMYILDIZI — sayfa altında SVG graf: merkezde açık kayıt, çevrede 6–8 komşu (renderRelated mantığının genişletilmiş çıktısı; hesap değişmez, adet 3→6-8). Düğümler GERÇEK <button> (odaklanabilir, aria-label="başlık — yazar"); bağ çizgileri aria-hidden dekoratif; merkez hover --glow-1. Düğüme tıkla → görünüm içinde yeni kayda geçiş (View Transition, ?record= güncellenir, başlık odaklanır). Erişilebilirlik: grafik role="img" + aria-label özet; ALTINDA kompakt düğüm LİSTESİ (aynı veri, klavye/ekran okuyucu için; görsel olarak gizlenmez, kompakt satır). Reduced-motion: geçiş animasyonsuz, grafik statik.
5. OG GÖRSELLERİ — tools/og_cards.py (yeni): derleme zamanında her kayıt için 1200×630 paylaşım görseli (kapak + başlık + omurga rengi) → site/og/<id>.png; CI/pages adımında üretim. index.html'de og:image meta: ?record= açılışında JS ile güncellenir, varsayılan vitrin görseli. Çalışma anında dış servis YOK.
6. Yeni metinler site/i18n.js'e TR+EN (cite, citedCopied, constellationSummary, nodeJump...); ?v=44.

Kalite kuralları: transform/opacity; tokenlar; --focus-ring; iki tema; 480/768/1024/1440 (mobilde sanat panel üstte, künye altta); ARIA: bölüm role="region" aria-labelledby=detailTitle değil — gerçek başlık hiyerarşisi (h2) + odak yönetimi; takımyıldız düğmeleri sekme sırasında mantıklı.

Kabul (Definition of Done):
- python tools/validate_site.py + tools/validate_i18n.py + node --check (app.js, record.js, discovery.js, i18n.js) → geçer.
- Regresyon: ?record= doğrudan açılış (TR ve EN, ?ui=en&record=...), geri/ileri tarayıcı gezinmesi, Escape, odak dönüşü, rota adım bağlantısından açılış, yıldız ekle/kaldır görünüm içinde, paylaşım bağlantısı kopyalama.
- View Transitions destekli tarayıcıda morf akıcı; desteklemeyende anında geçiş (test: Firefox).
- Takımyıldız: klavye ile gezilebilir; düğüm geçişi URL'yi güncelliyor; liste eşdeğeri ekran okuyucuda okunur.
- OG görselleri üretildi; sosyal paylaşım önizlemesinde görünür (meta kontrol).
Değişiklikleri tek commit'te "FAZ-5: record node page with view transitions, citation copy, discovery constellation, OG cards" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] Diyalog kaldırıldı; `?record=` + geri tuşu + Escape + odak dönüşü kusursuz
- [ ] View Transitions morf + desteklenmeyen tarayıcı eşdeğeri
- [ ] Alıntı kopyalama TR/EN şablonlu
- [ ] Takımyıldız: erişilebilir (SVG role=img + liste), düğüm geçişi çalışıyor, hesap mantığı değişmedi
- [ ] OG görseller derlemede üretiliyor; meta dinamik
- [ ] `validate_i18n.py` 0 hata; `?v=44`

## 7. Regresyon Kontrolü

`?record=` (TR/EN) · geri/ileri · Escape · odak dönüşü (kart/vitrin/rota/yıl kaynakları) · yıldız + paylaşım · takımyıldız düğüm geçişi · rota adım bağlantısı · `data-browse` (yazar/alan keşfi) hâlâ çalışıyor · çevrimdışı · iki tema.

## 8. Geri Alma

Tek commit → `git revert`. `record.js`/`og_cards.py` yeni dosyalar; `discovery.js` yeniden yazımı nedeniyle revert öncesi `recordDialog` kodunun geçmişi korunur (git history).
