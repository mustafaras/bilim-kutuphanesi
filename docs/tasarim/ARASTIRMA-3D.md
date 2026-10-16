# Araştırma notu — three.js teknikleri (Bölüm 5), uygulanan / reddedilen / yapılmayan

Kural: yalnızca fikir ve algoritma alınır, kod kopyalanmaz; çalışma zamanında dış istek yok; yeni vendor dosyası eklenmedi (toplam vendor büyümesi: **0 KB**).
**Doğrulama notu:** aşağıdaki "Lisans" sütunu 2026-10-16'da web aramasıyla kontrol edildi; "ikincil" = üçüncü taraf dizinler bildirdi, LICENSE dosyasını kendim açmadım.

## Kaynak ve lisans kontrolü
| Kaynak | Bulgu | Not |
|---|---|---|
| [three.js `MeshPhysicalMaterial` belgesi](https://threejs.org/docs/pages/MeshPhysicalMaterial.html) | `anisotropy` (0–1), `iridescence`, `transmission` (opacity 1 olmalı), `clearcoat` belgeli; belge ortam haritasını **şart** koşar ve per-pixel maliyetin yüksek olduğunu söyler | `thickness` ve `clearcoatNormalMap` girdilerini arama sonucunda göremedim; kodda r160 ile çalıştığını görsel olarak doğruladım |
| [troika-three-text](https://npmjs.com/package/troika-three-text) | MIT (npm dizinleri, ikincil); SDF atlasını çalışırken font dosyasından üretir | **Reddedildi:** 3B sahne etiketleri DOM + `BKText.declutter`; ek vendor ve çalışma-zamanı font ayrıştırma maliyeti |
| [Weighted Blended OIT, McGuire & Bavoil, JCGT 2013](https://www.jcgt.org/published/0002/02/09/paper.pdf) | Makale doğrulandı (Vol.2 No.2, s.122–141); ek derinlik hedefi gerektirmez, sahne-geneli ampirik yaklaşım; yoğun sahnede fazla saydam sonuç verebilir | **Reddedildi:** cam kuleler `opacity`+`renderOrder` ile yeterli; ek geçiş maliyeti ve çözünürlük bağımlılığı |
| [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) | MIT (ikincil); benzer adlı başka paketler var, kaynak olarak yalnız `gkjohnson/three-mesh-bvh` | **Gerekmedi:** seçim ekran-uzayında (kule/yıldız izdüşümü), raycast yok |
| [The Book of Shaders](https://thebookofshaders.com/) | Alt komut isteminin "CC BY-NC-SA" iddiasını **doğrulayamadım**; arşivlenmiş depo LICENSE'ı yalnızca telif sahibini ve tüm hakları saklı tuttuğunu gösteriyor | Kod alınmadı, yalnızca kavramsal okuma (fbm, domain warp) — ticari olmayan kullanım varsayımına güvenilmemeli |

## Teknik tablosu
| Teknik | Durum | Nerede / neden |
|---|---|---|
| Prosedürel stüdyo IBL (PMREM) | **Uygulandı** | `stage.js studioEnv`: kitap, madalya ve artık 6 atlas karosu aynı PMREM'i paylaşır |
| `MeshPhysicalMaterial` cam/iridescence/anisotropy | **Uygulandı** | atlas: cam atom çekirdeği/DNA/küre; madalya iridescence; kitap kapağı folyo `anisotropy .5`; cam kuleler `◇ Cam` (varsayılan kapalı, ağır) |
| `transmission` | **Kısmen** | yalnız Silüet `◇ Cam`; atlas camları ucuz yol: `transparent + clearcoat + env` (transmission ek geçiş ister) |
| Prosedürel normal/bump | **Uygulandı** | deri gren (`grainBump`), kâğıt yaprakları, **parmak izi clearcoat normal** (`smudgeNormal`), kenar aşınması (`wearEdges`) |
| Temas gölgesi | **Uygulandı** | tek kitapta gerçek `PCFSoft` gölge, raf kitaplarında radial |
| Düzlemsel yansıma | **Uygulandı (aynı geometri)** | Silüet zemini: kuleler zemine göre tam boy ayna örnekleri + derinlik soluklaşması (Reflector yerine; ek render geçişi yok) |
| DOF / bokeh | **Yapılmadı** | yerine `uBlur` radyal blur + kromatik patlama (dalış, koyu tema); gerçek DOF derinlik dokusu ister |
| God-rays | **Yapılmadı** | yerine kubbe yarığında sprite lambası + zemin yansıma şeridi (ucuz) |
| GPGPU / N-body | **Reddedildi** | 64k parçacıklı FBO ping-pong kazanç/maliyet düşük; galaksi analitik vertex shader'da, kalite yöneticisi var |
| Instancing | **Uygulandı** | Silüet kuleleri `InstancedMesh`; Nobel Galaksi yıldızları `InstancedBufferGeometry` küre-impostor billboard; DNA basamakları ve kafes düğümleri `InstancedMesh` |
| Curl-noise | **Yapılmadı** | takımyıldızı tozu sade sürükleme; kazanç küçük |
| SDF metin | **Reddedildi** | yukarıya bakın |
| `Line2` kalın çizgi | **Reddedildi** | takımyıldızı enerji tüpleri shader + akış parçacıkları (aynı sonuç, ek vendor yok) |
| OIT | **Reddedildi** | yukarıya bakın |
| Bloom / vinyet / CA / grain | **Uygulandı** | `UnrealBloom` + `grade` ShaderPass |
| SMAA/FXAA, anamorfik flare, LUT | **Yapılmadı** | bloom sonrası kazanç küçük; LUT ek dosya ister |
| Kritik sönümlü yay / ortak ease | **Uygulandı** | `motion.js` `BKMotion`: `damp` (kare hızından bağımsız), `spring`, ortak `ease` |
| View Transitions + GL warp | **Uygulandı** | kayıt açılışı `bk-cover`; yıldıza dalışta hayalet kapak + radyal blur |
| Scroll'a bağlı tek kamera yolu | **Uygulandı** | hero `CatmullRomCurve3` + `--hero-p` / `--atlas-in`; reduced-motion'da statik |

## Bilinen sınırlar (dürüst)
- Hareket/akıcılık ve gerçek GPU maliyeti bu ortamda (yazılımsal GL) ölçülemedi; yalnızca durağan kareler, durum sırası ve sayaçlar doğrulandı (`tools/motion_audit.py`, `tools/leak_audit.py`, `tools/reduced_audit.py`).
- `transmission` ve gerçek DOF/SSR bilerek eklenmedi: düşük güçlü GPU'da kalite yöneticisi bile yetmeyebilir.
