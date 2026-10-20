# Sonraki adımlar ve yeni oturum devri (v134: R1–R9 kodlandı; R9 silüet/Nobel zaman çizelgesi DEVIR §80)

> **Önce `DEVIR-FAZ-4.md` §80'i oku:** R9 (silüet / Nobel zaman çizelgesi) v134'te tamamlandı. Sıradaki aşama **R10** (`PREMIUM-R10-R13-GECISLER-OLCEK.md`).

Bu belge, bir sonraki oturumun sıfırdan başlayıp doğru yerden devam etmesi içindir. Önce **§1 Durum**, sonra **§2 Yapılacaklar**, işe başlarken **§6 Başlangıç istemi**. Büyük geliştirmeler için `YOL-HARITASI-3D.md`.

## 1. Durum (2026-10-18)
- Canlı: **v107** (`https://mustafaras.github.io/bilim-kutuphanesi/`). main = `710bbbc`, deploy koşusu #126 yeşil. Sürüm dizesi `site/index.html` (`?v=107`) ve `site/sw.js` (`bilim-kutuphane-v107`) içinde; her kod değişikliğinde ikisi birlikte artırılır.
- **Yerel çalışma dalı v134'e kadar ilerledi** (R5–R9 kodlandı, PR sırası bekliyor). Sürüm dizesi artık `?v=134` / `bilim-kutuphane-v134`; `site/style.css` son blok **Package 45**.
- Yığın: vanilla JS/CSS, three.js r160 (vendor), TR/EN, açık/koyu, çalışma zamanında dış istek yok. `site/style.css` "son blok kazanır" kuralıyla `/* Package NN */` blokları ekleyerek büyür (son: 45).
- Yapılanlar (ayrıntı için `DEVIR-FAZ-4.md` §46–§51): sürekli kamera/dönüş uçuşu/kalite yöneticisi, 3D kitap (sayfa çevirme, okuma sahnesi, ayraç), madalya kabartması, kubbe teleskobu, ekran okuyucu yansıtması, GPU dayanıklılığı (bağlam kaybı kurtarma, kendi kendini denetleyen raf kitapları ve kademeli sadeleşme), PR öncesi CI kapısı.
- **Bu ortamda görülemeyenler:** gerçek GPU'da akıcılık/his, canlı sitenin gerçek tarayıcıdaki görüntüsü. Yazılımsal GL (SwiftShader) yalnızca durağan kareleri güvenilir gösterir (kapak hiçbir zaman tam yatmaz, ~2 fps).

## 2. Yapılacaklar (öncelik sırasıyla)

### 2.1 Kullanıcının gerçek makinede doğrulaması (bekleyen)
`?diag` ile açıp raf kitaplarına bakmak. Köşe satırı: seviye (0 normal · 1–3 sadeleşmiş · 4 CSS kapak), shader hata sayısı, GPU adı, her kitabın kapsama/parlaklık değeri. **Raf kitapları iki kez "gövde yok, yalnızca ayraç ve altın bantlar" diye bozulmuştu; asıl sebep hâlâ bilinmiyor.** v107 bozuk görünümü gösterilemez hâle getirdi ama sebebi çözmedi.
- Seviye 0 ve kitaplar düzgünse: sorun kapanmıştır (v106/v107 yaklaşımı yetmiş).
- Seviye ≥ 1 ise: `?diag` satırının ekran görüntüsü + F12 konsolundaki kırmızı hatalar + `chrome://gpu` istenir. Bununla kesin sebep bulunup sadeleşmeye gerek bırakmayacak şekilde düzeltilir (ör. belirli bir malzeme özelliği, doku birimi sayısı, ANGLE/D3D derleme sınırı).

### 2.1b Premium three.js geliştirmeleri → `YOL-HARITASI-3D.md`
> **Güncel (v134):** R1–R9 tamam. Kalan R10–R13 için **premium kapsam** yazıldı: `PREMIUM-GORSEL-VIZYON.md` (ana belge: ilkeler, yetenek envanteri, altyapı A1–A6, seviyeler, bütçe), `PREMIUM-R6-R9-SAHNELER.md` ve `PREMIUM-R10-R13-GECISLER-OLCEK.md`. Önerilen sıra: A6 → A3 → A1 → A4 → R7 (A2 ile) → R6 → R8 → R9 → R10 → R11 → R12 → R13. **Sıradaki: R10.** A4 (gerçek GPU zamanlaması) ve A5 hâlâ açık; R2'nin gerçek GPU'da `?perf` doğrulaması bekliyor.
> **R9 sonrası zorunlu takip:** silüet artık Nobel'in varsayılan görünümü olduğu için `tools/golden/*__timeline.png` altınları **bilinçli olarak** değişti. R9 PR'ı birleştikten sonra **`Update visual goldens`** (workflow_dispatch) çalıştır, `goldens/update` PR'ındaki dört `__timeline.png` + iki `legacy` görüntüsünü gözle incele ve birleştir. Yerelde `visual_audit --update` **çalıştırma** (macOS kaydırma çubuğu farkı altınları bozar; §5 Tuzaklar).
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
| `feature_audit.py` | A1–A4 kamera/uçuş/yönetici/dalış, B5 kitap (kenar teması, sol sayfa, sayfa çevirme), B6 madalya, B7 kubbe, **B8 bağlam kaybı (raf + 3D hero)**, **B9 bozuk GPU (hata enjeksiyonu)**, **B21 silüet / Nobel zaman çizelgesi (R9)** |
| `gpu_budget_audit.py --surfaces <yüzey>` | yüzey başına çizim/üçgen/nokta/program/hedef/doku bütçesi (R9: skyline 16/26000/420/10/4/16) |
| `shaders_audit.py`, `materials_audit.py` | shader önbellek anahtarları, malzeme presetleri |
| `palette_audit.py` | komut paleti (kontrast, boş durum, eylem listesi) |
| `visual_audit.py [--update]` | altın görüntü regresyonu (`tools/golden/`); R9 sonrası skyline altınları yenilenmeli |
| `leak_audit.py --rounds 8` | kayıt aç/kapa döngüsünde GPU kaynak sızıntısı |
| `motion_audit.py --out DIR`, `screen_tour.py` | yalnız yerel; ekran görüntüsü turu |
Test kancaları için audit araçları `localStorage bk-test=1` ekler.

## 5. Tuzaklar (bu oturumlarda yaşandı)
- **`visual_audit` altınları yerelde karşılaştırılamaz (macOS):** altınlar CI'da (Linux, SwiftShader) üretilir. Linux'ta dikey kaydırma çubuğu yer kaplar (~10 px), macOS'ta kaplamalı (overlay) olduğu için kaplamaz; bu yüzden `width:100%` yüzeyler yerelde 10 px daha geniş çıkar ve `ratio()` boyut uyuşmazlığında **1.0000** döner. Yani yerelde "40 altının 40'ı %100 farklı" görmek regresyon değil, ortam farkıdır. Sabit genişlikli yüzeyler (kitap) karşılaştırılabilir ama onlar da farklı SwiftShader sürümünde farklı gölgelenir. **Kural:** altın karşılaştırmasını yalnız CI yapar; yerelde `--update` **çalıştırma** (CI altınlarını macOS kopyalarıyla bozarsın). Bilinçli görsel değişiklikten sonra `Update visual goldens` (workflow_dispatch) çalıştır, `goldens/update` PR'ını incele ve birleştir. Yerelde yalnız iki kontrol anlamlıdır: **stability** (aynı kod iki kez) ve **defect** (gizli tuval / CSS yedeği) — `constellation` stability'si tohumlanmamış parçacıklar yüzünden yerelde 0.023–0.030 çıkabilir (CI limiti 0.02); bu da ortam farkıdır.
- **`motion_audit` dalış penceresi:** örnekleyici duvar saatiyle 4,2 sn çalışır; yazılımsal GL'de tek bir `rAF` yüzlerce ms gecikebildiği için kayıt 3,7 sn'de açılabiliyor. Bu yüzden "kayıt açıldı" iddiası hem örnekleyiciyi hem de **oturmuş son durumu** (`recordView.hidden === false`) kabul eder.
- **Denetimlerde sahte hata: `ERR_CONNECTION_RESET` (v134'te çözüldü):** `python -m http.server` iş parçacıklı olsa da `socketserver`'ın varsayılan `request_queue_size = 5` kuyruğunu devralır. Sayfa ~30 betiği aynı anda çeker; yazılımsal GL'de yavaş makinede kabul kuyruğu taşar ve Chromium rastgele birkaç dosya için `net::ERR_CONNECTION_RESET` / `net::ERR_SOCKET_NOT_CONNECTED` verir. Belirtiler yanıltıcıdır: `PAGEERR UI is not defined` (i18n.js gelmedi), `records is not defined` (app.js gelmedi), `openRecord is not defined`, `wait_for_function("window.BKHero&&window.BKDome")` 90 sn timeout, `.nc-viewswitch button` tıklaması timeout. **Bunlar kod hatası değildir.** Çözüm: tüm tarayıcı denetimleri artık `tools/_serve.py` kullanır (`request_queue_size=256`, `protocol_version="HTTP/1.1"` keep-alive, `daemon_threads`). Yeni bir denetim yazarken `-m http.server` **kullanma**, `_serve.py`'yi çağır. Teşhis için sayfaya `requestfailed` dinleyicisi ekle; `bad: []` görmüyorsan ölçüm geçersizdir.
- **Yerel sunucu sık ölür:** `python3 -m http.server 8671` arka plan süre sınırında kapanır. `run_in_background` ile, uzun `timeout` vererek başlat ve kullanmadan önce 2 sn bekle; `ERR_CONNECTION_REFUSED` görürsen önce sunucuya bak. (Kalıcı çözüm: `tools/_serve.py`.)
- **Kapak tam 1'e varmaz:** yazılımsal GL'de `coverK` ≈0.96–0.99'da kalır; kapak tam yatık davranışını sınamak için `effects-paused` sınıfını ekle (feature_audit B5 böyle yapar).
- **Sabit konumlu sahne:** bir atanın `transform` değeri (kimlik dönüşümü bile) `position:fixed` çocuğunun kapsayıcı bloğunu değiştirir; `.rv-art-col:has(.book-open){transform:none!important}` buna karşı.
- **View Transition (`bk-cover`):** kaynak öğe adı güncelleme geri çağırması içinde bırakılmalı, yoksa geçiş iptal olur (`record.js` `withMorph`).
- **`#spotlightGrid`:** raf kartları `.spotlight-card[data-detail]`; 3D kapakları `.shelf-3d`, kart `has-3d` sınıfını alır (CSS kapağı gizler); yedek durumda sınıf kaldırılır.
- **Sahne denetimi eşiği:** kapsama < %5 ya da ortalama parlaklık < 35 bozuk sayılır. Sağlıklı: kapsama ≈0.5, parlaklık ≈105–110 (koyu tema).
- **`?diag`**: `BKStage.diag()` aynı bilgiyi verir; `BKStage.forceLevel(n)` seviyeyi elle denemek içindir.

## 6. Yeni oturum için başlangıç istemi (kopyala-yapıştır)
```
Bilim Kütüphanem (mustafaras/bilim-kutuphanesi, GitHub Pages, vanilla JS/CSS + three.js r160) üzerinde çalışıyoruz; yerel dal v134 (R1–R9 kodlandı), canlı v107.
Önce docs/tasarim/SONRAKI-ADIMLAR.md, docs/tasarim/YOL-HARITASI-3D.md ve docs/tasarim/DEVIR-FAZ-4.md (§80) dosyalarını oku.
Dal: mustafaras-r9-siluet-zaman-cizelgesi. Her adım: değişiklik → yerel kapılar → commit → push → PR → PR koşusu yeşilse squash merge → main deploy adımı yeşil → dürüst rapor. Canlı siteyi bu ortamdan göremeyeceğini, yazılımsal GL'in hareketi/gerçek GPU'yu göstermediğini unutma.
Şimdi: <buraya yapılacak işi yaz — örn. "?diag çıktısı şu: ... buna göre raf kitaplarının kesin sebebini bul ve düzelt">.
Çıktılar Türkçe, kısa ve dürüst olsun; yapılmayanı yapıldı diye bildirme.
```
Raf kitapları hâlâ bozuksa isteme şunları ekle: `?diag` köşe satırı (ya da ekran görüntüsü), F12 konsolundaki kırmızı hatalar, `chrome://gpu` içindeki "Graphics Feature Status" ve "GL_RENDERER" satırları, tarayıcı ve işletim sistemi sürümü.
