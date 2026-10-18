# Sonraki adımlar ve yeni oturum devri (v108 sonrası)

Bu belge, bir sonraki oturumun sıfırdan başlayıp doğru yerden devam etmesi içindir. Önce **§1 Durum**, sonra **§2 Yapılacaklar**, işe başlarken **§6 Başlangıç istemi**. Büyük geliştirmeler için `YOL-HARITASI-3D.md`.

## 1. Durum (2026-10-18)
- Canlı: **v107** (`https://mustafaras.github.io/bilim-kutuphanesi/`). main = `710bbbc`, deploy koşusu #126 yeşil. Sürüm dizesi `site/index.html` (`?v=107`) ve `site/sw.js` (`bilim-kutuphane-v107`) içinde; her kod değişikliğinde ikisi birlikte artırılır.
- Yığın: vanilla JS/CSS, three.js r160 (vendor), TR/EN, açık/koyu, çalışma zamanında dış istek yok. `site/style.css` "son blok kazanır" kuralıyla `/* Package NN */` blokları ekleyerek büyür (son: 43).
- Yapılanlar (ayrıntı için `DEVIR-FAZ-4.md` §46–§51): sürekli kamera/dönüş uçuşu/kalite yöneticisi, 3D kitap (sayfa çevirme, okuma sahnesi, ayraç), madalya kabartması, kubbe teleskobu, ekran okuyucu yansıtması, GPU dayanıklılığı (bağlam kaybı kurtarma, kendi kendini denetleyen raf kitapları ve kademeli sadeleşme), PR öncesi CI kapısı.
- **Bu ortamda görülemeyenler:** gerçek GPU'da akıcılık/his, canlı sitenin gerçek tarayıcıdaki görüntüsü. Yazılımsal GL (SwiftShader) yalnızca durağan kareleri güvenilir gösterir (kapak hiçbir zaman tam yatmaz, ~2 fps).

## 2. Yapılacaklar (öncelik sırasıyla)

### 2.1 Kullanıcının gerçek makinede doğrulaması (bekleyen)
`?diag` ile açıp raf kitaplarına bakmak. Köşe satırı: seviye (0 normal · 1–3 sadeleşmiş · 4 CSS kapak), shader hata sayısı, GPU adı, her kitabın kapsama/parlaklık değeri. **Raf kitapları iki kez "gövde yok, yalnızca ayraç ve altın bantlar" diye bozulmuştu; asıl sebep hâlâ bilinmiyor.** v107 bozuk görünümü gösterilemez hâle getirdi ama sebebi çözmedi.
- Seviye 0 ve kitaplar düzgünse: sorun kapanmıştır (v106/v107 yaklaşımı yetmiş).
- Seviye ≥ 1 ise: `?diag` satırının ekran görüntüsü + F12 konsolundaki kırmızı hatalar + `chrome://gpu` istenir. Bununla kesin sebep bulunup sadeleşmeye gerek bırakmayacak şekilde düzeltilir (ör. belirli bir malzeme özelliği, doku birimi sayısı, ANGLE/D3D derleme sınırı).

### 2.1b Premium three.js geliştirmeleri → `YOL-HARITASI-3D.md`
Büyük geliştirmeler **aşama aşama** (R1–R13) ayrı belgede: her aşama ayrı oturum + ayrı PR, sayısal kabul ölçütü, kapanabilir (flag), kalite katmanlı. İlk üç aşama altyapıdır (ortak GL katmanı, gerçek GPU zamanlaması + `?perf`, deterministik görsel regresyon kapısı) ve görsel işlerden önce yapılmalıdır. Durum tablosu o belgenin §0'ındadır; R1 (BKGL) v108'de tamamlandı ve deploy edildi; R2 (GPU zamanlaması, `?perf`, ısıtma) v109'da kodlandı; gerçek GPU çıktısı bekleniyor (DEVIR §54). Bir sonraki oturum **R3** (görsel regresyon kapısı).

### 2.2 Düşük öncelikli açıklar
- **Orta sırt dikişi:** sayfa tam yatıkken temiz, yalnız ince açık bir dikiş çizgisi var. Yazılımsal GL'de sayfa yerleşirken (p≈0.99) görülen kesik çizgiler gerçek GPU'da beklenmez. Gerçek GPU görüntüsü gelmeden dokunma.
- **Sadeleşme parlaklığı:** seviye 2 (Lambert) kitaplar kayıpsız hâlin yaklaşık yarısı kadar parlak (≈50 / ≈108). İstenirse ortam ışığı artırılabilir.
- **`style.css` bölünmesi:** tek dosya çok büyük, "son blok kazanır" yönetimi zorlaşıyor. Görsel regresyon kapısı (ekran görüntüsü karşılaştırma) olmadan bölmek riskli; önce kapı.
- **Görsel regresyon kapısı ve GPU zamanlaması:** artık yol haritasında (R3 ve R2).
- **Depo ağırlığı:** `docs/tasarim/ekran` ≈105 MB, `.git` ≈126 MB. Geçmişi küçültmek **force push** ister ve bu ortamda reddedilir; yeni setler artık `.gitignore`'da (`docs/tasarim/ekran/v1NN/`).
- **Açık test globalleri:** `BKStage`, `BKDome`, `BKHorizon`, `BKMotion`, `BKText`, `BKRecordText` modüller arası işlevsel olarak kullanıldığı için açık. `BKHero` ve `__bkPerf` yalnızca `localStorage bk-test=1` ile.

### 2.3 Bilinen sınırlar
- Hareket ve sayfa çevirme "hissi" bu ortamda ölçülemedi.
- `ARASTIRMA-3D.md` lisans satırları web aramasına dayanıyor; The Book of Shaders lisansı doğrulanamadı (kod alınmadı).

## 3. Çalışma düzeni (yeni oturum bunu izler)
- **Her adım:** değişiklik → yerel kapılar → commit → push (`claude/magical-hawking-kufhmz`) → PR → **PR koşusu yeşil** → squash merge → main push koşusunda `deploy` işi ve `Deploy` adımı yeşil → raporla. "Canlıda" yalnızca deploy adımı yeşilken söylenir; canlı site bu ortamdan görülemez, bunu açıkça belirt.
- **CI:** `.github/workflows/pages.yml` → `static` (hızlı kapılar) + paralel `browser` matrisi (5 iş) ve `deploy` (`needs: [static, browser]`, PR'da atlanır). Yalnız `docs/**` ve `*.md` değişen PR/push'ta koşu başlamaz (§53). Çakışmalı PR'da GitHub koşu başlatmaz.
- **Squash sonrası dal:** squash'ın ardından dal, main'in squash'ını içermez. Yeni işe başlarken `git fetch origin main && git merge origin/main`; sürüm dizesi çakışmalarında `git checkout --ours site/index.html site/sw.js`. Force push ve `merge -s ours` sınıflandırıcıda reddedilir.
- **Zamanlı kontrol:** PR/deploy beklerken `send_later` ile 10–12 dk sonrası; beklerken uyuma/yoklama yok. `actions_list` çıktısı çok büyüktür, `perPage 1` ve `list_workflow_jobs` kullan.
- **Dürüst raporlama:** yerelde geçen ≠ canlıda doğrulandı. Yazılımsal GL'de görülmeyen bir şeyi "düzeldi" deme.

## 4. Yerel doğrulama araçları (`tools/`)
Hepsi `BK_CHROMIUM=/opt/pw-browsers/chromium` ile (CI Playwright'ın kendi tarayıcısını kullanır).
| Araç | Ne denetler |
|---|---|
| `validate_site.py`, `validate_fonts.py`, `validate_i18n.py` | katalog, fontlar, TR/EN bütünlüğü |
| `node tools/check_app.cjs` | arama, filtre, rota, HTML güvenliği (DOM taklidiyle) |
| `ui_audit.py` | taşma, konsol hatası, kontrast |
| `text_fit_audit.py` | canvas metinleri (kapak, sırt, 6 sayfa yüzü, paylaşım kartı) |
| `reduced_audit.py` | reduced-motion: yalnız durağan kareler |
| `feature_audit.py` | A1–A4 kamera/uçuş/yönetici/dalış, B5 kitap (kenar teması, sol sayfa, sayfa çevirme), B6 madalya, B7 kubbe, **B8 bağlam kaybı (raf + 3D hero)**, **B9 bozuk GPU (hata enjeksiyonu)** |
| `leak_audit.py --rounds 8` | kayıt aç/kapa döngüsünde GPU kaynak sızıntısı |
| `motion_audit.py`, `screen_tour.py` | yalnız yerel; ekran görüntüsü turu |
Test kancaları için audit araçları `localStorage bk-test=1` ekler.

## 5. Tuzaklar (bu oturumlarda yaşandı)
- **Yerel sunucu sık ölür:** `python3 -m http.server 8671` arka plan süre sınırında kapanır. `run_in_background` ile, uzun `timeout` vererek başlat ve kullanmadan önce 2 sn bekle; `ERR_CONNECTION_REFUSED` görürsen önce sunucuya bak.
- **Kapak tam 1'e varmaz:** yazılımsal GL'de `coverK` ≈0.96–0.99'da kalır; kapak tam yatık davranışını sınamak için `effects-paused` sınıfını ekle (feature_audit B5 böyle yapar).
- **Sabit konumlu sahne:** bir atanın `transform` değeri (kimlik dönüşümü bile) `position:fixed` çocuğunun kapsayıcı bloğunu değiştirir; `.rv-art-col:has(.book-open){transform:none!important}` buna karşı.
- **View Transition (`bk-cover`):** kaynak öğe adı güncelleme geri çağırması içinde bırakılmalı, yoksa geçiş iptal olur (`record.js` `withMorph`).
- **`#spotlightGrid`:** raf kartları `.spotlight-card[data-detail]`; 3D kapakları `.shelf-3d`, kart `has-3d` sınıfını alır (CSS kapağı gizler); yedek durumda sınıf kaldırılır.
- **Sahne denetimi eşiği:** kapsama < %5 ya da ortalama parlaklık < 35 bozuk sayılır. Sağlıklı: kapsama ≈0.5, parlaklık ≈105–110 (koyu tema).
- **`?diag`**: `BKStage.diag()` aynı bilgiyi verir; `BKStage.forceLevel(n)` seviyeyi elle denemek içindir.

## 6. Yeni oturum için başlangıç istemi (kopyala-yapıştır)
```
Bilim Kütüphanem (mustafaras/bilim-kutuphanesi, GitHub Pages, vanilla JS/CSS + three.js r160) üzerinde çalışıyoruz; canlı sürüm v108.
Önce docs/tasarim/SONRAKI-ADIMLAR.md, docs/tasarim/YOL-HARITASI-3D.md ve docs/tasarim/DEVIR-FAZ-4.md (§46–§51) dosyalarını oku.
Dal: claude/magical-hawking-kufhmz. Her adım: değişiklik → yerel kapılar → commit → push → PR → PR koşusu yeşilse squash merge → main deploy adımı yeşil → dürüst rapor. Canlı siteyi bu ortamdan göremeyeceğini, yazılımsal GL'in hareketi/gerçek GPU'yu göstermediğini unutma.
Şimdi: <buraya yapılacak işi yaz — örn. "?diag çıktısı şu: ... buna göre raf kitaplarının kesin sebebini bul ve düzelt">.
Çıktılar Türkçe, kısa ve dürüst olsun; yapılmayanı yapıldı diye bildirme.
```
Raf kitapları hâlâ bozuksa isteme şunları ekle: `?diag` köşe satırı (ya da ekran görüntüsü), F12 konsolundaki kırmızı hatalar, `chrome://gpu` içindeki "Graphics Feature Status" ve "GL_RENDERER" satırları, tarayıcı ve işletim sistemi sürümü.
