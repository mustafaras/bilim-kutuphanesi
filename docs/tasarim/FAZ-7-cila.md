# FAZ 7 — Hareket, Erişilebilirlik, Performans Cilası ve Yayın

**Öncül:** FAZ-0..6 (tümü) · **Sonraki:** — (kapanış) · **Süre tahmini:** 1–2 oturum

## 1. Amaç

Tüm parçaları uluslararası yayın kalitesinde cila etmek: hareket koreografisinin son geçişleri, tam erişilebilirlik denetimi (WCAG 2.2 AA), performans bütçelerinin tutturulması, ölü CSS temizliği ve yayın kontrol listesi. Bu faz yeni özellik eklemez — yalnızca kalite garantisi üretir.

## 2. Kapsam

- **İçinde:** `style.css` (hareket cila + ölü kural temizliği), `effects.js` (koreografi), `tools/validate_contrast.py` (yeni — varsa), `tools/validate_site.py` (genişletme), `pages.yml` (Lighthouse CI eşikleri), README güncellemesi (yeni özellikler + klavye + tasarım kimliği).
- **Dışında:** yeni özellik, yeni bölüm, yeni dosya (araçlar hariç).

## 3. Teknik Spesifikasyon

### 3.1 Hareket Koreografisi (son geçişler)
- Bölüm girişleri: `IntersectionObserver` + `reveal-in` (mevcut sınıf) tokenlara bağlı; ızgaralarda 40ms stagger yalnız ilk görünür 24 öğe.
- Sayfa içi geçiş öncelikleri: kart hover 120ms < panel 240ms < görünüm geçişi 400ms < sahne girişi 700ms — çakışma yok (aynı anda en fazla 2 katman hareket).
- `motionToggle` + `prefers-reduced-motion` birleşik denetimi: tüm animasyonlar tek kaynaktan (`effects-paused`) kapanır; scrollytelling eşdeğeri (FAZ-3) ve kinetik tip statik hale döner.

### 3.2 Erişilebilirlik Denetimi (WCAG 2.2 AA)
- `tools/validate_contrast.py` (yoksa yaz): kritik token çiftleri APCA Lc — gövde ≥75, başlık ≥60, dekoratif ≥45; iki tema; CI'a ekle.
- Manuel denetim listesi (kayıt altına alınır `docs/tasarim/FAZ-7-denetim.md`):
  1. Klavye turu: tüm akış (palet → faset → kart → kayıt → takımyıldız → rota) yalnız klavyeyle.
  2. Odak görünürlüğü: her interaktif öğede `--focus-ring`, iki temada.
  3. Hedef boyutu ≥24×24: çipler, yıldız, ×, yıl yıldızları, takımyıldız düğümleri.
  4. Ekran okuyucu (NVDA + VoiceOver): palet duyuruları, `resultCount` live bölge, kayıt görünümü başlık/odak, dekoratiflerin sessizliği, `lang` değişimi.
  5. Zoom %200 + metin ölçeği 1.5×: yerleşim bozulmuyor.
  6. `prefers-reduced-motion`: tam işlevsel eşdeğer deneyim.
  7. axe DevTools: 0 kritik/serious.
- Lighthouse a11y ≥ 95 (mobil).

### 3.3 Performans
- Lighthouse CI eşikleri `pages.yml`'e: performance ≥ 90, a11y ≥ 95, best-practices ≥ 95, SEO ≥ 95; LCP < 2.5s, CLS < 0.1, TBT bütçesi.
- Boyut bütçesi denetimi: CSS gzip ≤ 40KB, JS gzip ≤ 45KB, font ≤ 170KB (`validate_fonts.py`); aşım → CI hata.
- Ölü CSS taraması: kullanılmayan seçiciler (kaba araç: her sınıf adını JS/HTML'de ara) temizlenir; `style.css` versiyonlama notu.

### 3.4 Yayın Kontrol Listesi
- URL sözleşmesi tam regresyon (tüm parametreler, TR/EN, iki görünüm).
- Çevrimdışı senaryo: SW güncelleme akışı, katalog + i18n-data + fontlar önbellekte.
- OG görselleri (FAZ-5) üretimi CI'da.
- README: yeni tasarım kimliği, ⌘K/kısayollar, bonto/galaksi/takımyıldız bölümleri, i18n mimarisi (i18n-data.json + doğrulayıcılar) bölümleriyle güncellenir.
- `?v=46` son sürüm.

## 4. Görev Listesi

1. Hareket cila geçişleri + `effects.js` koreografi konsolidasyonu.
2. `validate_contrast.py` + CI; APCA sonuçlarını denetim belgesine işle.
3. Manuel a11y denetimi (3.2 listesi) → `FAZ-7-denetim.md`; bulunanlar düzeltilir.
4. Lighthouse CI eşikleri + boyut bütçesi; ölü CSS temizliği.
5. Tam regresyon turu + README güncellemesi; `?v=46`; yayın.

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla JS, GitHub Pages) FAZ-7'yi uygula: hareket/erişilebilirlik/performans cilası ve yayın. Önce TASARIM-PLANI.md ve docs/tasarim/FAZ-7-cila.md dosyalarını oku. FAZ-0..6 tamamlanmış varsayılır. Bu faz YENİ ÖZELLİK EKLEMEZ — yalnızca kalite garantisi.

Yapılacaklar:
1. HAREKET CİLASI — site/effects.js + style.css: bölüm girişleri IntersectionObserver + reveal-in (mevcut sınıf) --dur/--ease tokenlarıyla; ızgara girişlerinde 40ms stagger YALNIZ ilk görünür 24 öğe. Öncelik hiyerarşisi: hover 120ms < panel 240ms < görünüm geçişi 400ms < sahne girişi 700ms; aynı anda en fazla 2 katman hareket. motionToggle + prefers-reduced-motion birleşik: tüm animasyon tek effects-paused kaynağından kapanır; scrollytelling ve kinetik tip statik eşdeğere düşer.
2. KONTRAST DOĞRULAYICI — tools/validate_contrast.py (yeni): kritik token çiftlerini APCA Lc ile denetle (gövde ≥75, başlık ≥60, dekoratif ≥45; koyu VE aydınlık tema). Çiftler: text-1/surface-0, text-2/surface-1, accent-1/surface-2, focus/surface-0... .github/workflows/pages.yml'e ekle.
3. ERİŞİLEBİLİRLİK DENETİMİ — docs/tasarim/FAZ-7-denetim.md oluştur ve şunları uygula/düzelt: (a) tam klavye turu: palet→faset→kart→kayıt→takımyıldız→rota; (b) her interaktif öğede --focus-ring iki temada; (c) hedef boyutu ≥24×24 (çipler, yıldız, ×, yıl yıldızları, takımyıldız düğümleri); (d) ekran okuyucu kontrol noktaları (palet duyuruları, resultCount live bölge, kayıt başlık/odak, dekoratif sessizlik, lang değişimi); (e) %200 zoom + 1.5× metin ölçeği; (f) prefers-reduced-motion eşdeğer deneyim; (g) axe DevTools 0 kritik/serious. Bulunan her kusuru düzelt ve denetim belgesine kaydet.
4. PERFORMANS — .github/workflows/pages.yml'e Lighthouse CI eşikleri: performance ≥90, a11y ≥95, best-practices ≥95, SEO ≥95; LCP <2.5s, CLS <0.1. Boyut bütçesi: CSS gzip ≤40KB, JS gzip ≤45KB, font ≤170KB (validate_fonts.py zaten var; CSS/JS denetimini de ekle). Ölü CSS taraması: style.css'teki sınıf adlarını JS/HTML taramasıyla doğrula, kullanılmayanları temizle (dikkat: JS'in dinamik ürettiği sınıflar — card, spine-*, cover-* vb. — DOKUNMA).
5. REGRESYON + YAYIN — tam URL sözleşmesi turu (tüm parametreler, TR/EN, kart/liste, ?record=, geri/ileri), çevrimdışı senaryo (SW güncelleme, katalog+i18n+font önbellek), OG görsellerinin CI üretimi. README.md'yi güncelle: yeni tasarım kimliği (Gözlemevi), ⌘K ve kısayollar, bonto/galaksi/takımyıldız bölümleri, i18n mimarisi (i18n-data.json + validate_i18n.py) — mevcut README üslubunu koru. ?v=46.

Kabul (Definition of Done):
- Tüm doğrulayıcılar yeşil: validate_site.py, validate_i18n.py, validate_fonts.py, validate_contrast.py, node --check (tüm JS), Lighthouse CI eşikleri.
- FAZ-7-denetim.md'de tüm maddeler "geçti" durumunda; axe 0 kritik.
- Boyut bütçeleri tutuyor; ölü CSS temizlendi.
- README güncel; ?v=46; canlı yayın kontrolü (GitHub Pages) — hero, katalog, kayıt, palet, iki dil, iki tema, çevrimdışı.
Değişiklikleri tek commit'te "FAZ-7: motion polish, WCAG 2.2 audit, performance budgets, release readiness" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] Hareket hiyerarşisi tutarlı; tek `effects-paused` kaynağı; reduced-motion tam eşdeğer
- [ ] `validate_contrast.py` CI'da; APCA hedefleri iki temada tutuyor
- [ ] `FAZ-7-denetim.md` tümü yeşil; axe 0 kritik; Lighthouse hedefleri
- [ ] Boyut bütçeleri: CSS ≤40KB, JS ≤45KB, font ≤170KB (gzip)
- [ ] README güncel; `?v=46`; canlı site kontrol edildi

## 7. Regresyon Kontrolü (yayın öncesi tam tur)

Tüm URL parametreleri (TR/EN) · kart/liste · `?record=` + geri/ileri · palet (5 kaynak) · j/k/s/c · tema × hareket × dil matrisi · çevrimdışı ilk yükleme + SW güncelleme · okuma listesi içe/dışa · OG meta · 480/768/1024/1440 · %200 zoom.

## 8. Geri Alma

Tek commit → `git revert`. CI eşik değişiklikleri `pages.yml` içinde izole; denetim belgesi rapor niteliğinde (revert gerekmez).
