# FAZ 6 — Komut Paleti ve Klavye Uygarlığı

**Öncül:** FAZ-0..5 · **Sonraki:** FAZ-7 · **Süre tahmini:** 1 oturum

## 1. Amaç

Uygulamayı klavye-öncelikli bir "pro araç" deneyimine taşımak: ⌘K/Ctrl+K komut paleti (kayıt, yazar, koleksiyon, okuma yolu ve eylem arama), `?` kısayol haritası, tutarlı eylem kısayolları. FAZ-2'de eklenen header tetikleyicisi gerçek paletle bağlanır.

## 2. Kapsam

- **İçinde:** yeni `site/palette.js`, `index.html` (palet DOM + kısayol haritası diyalogu), `style.css`, `i18n.js`, `sw.js` (yeni dosya önbelleği).
- **Dışında:** katalog/faset davranışları (FAZ-4 sözleşmeleri), kayıt görünümü içi odak akışı (FAZ-5).

## 3. Teknik Spesifikasyon

### 3.1 Komut Paleti
- **Açılış:** `⌘K`/`Ctrl+K` (input alanlarındayken bile — `preventDefault`); header ⌘K düğmesi; `/` kısayolu korunur (arama moduna odak).
- **DOM:** `role="dialog" aria-modal="true"` + içinde `combobox` deseni (APG): giriş + `listbox`; ok yukarı/aşağı, Enter seçim, Escape kapanış; odak palet içinde kalır (mevcut diyalog odak tuzağı deseni); kapanınca tetikleyiciye dönüş.
- **Kaynaklar (öncelik sırasıyla):**
  1. **Eylemler:** kataloğa git, keşfet, okuma yolları, arşivler, temayı değiştir, hareketi durdur/oynat, dili değiştir, okuma listemi göster, kataloğu indir.
  2. **Okuma yolları:** 10 rota başlığı (FAZ-1 ID-anhtarlı sözlükten EN karşılıklar).
  3. **Keşif alanları:** 8 bonto hücresi.
  4. **Kayıtlar:** mevcut `search` ön-hesaplı normalize alanı üzerinden başlık/yazar eşleşmesi; sonuç `?record=` ile açılır (FAZ-5 görünümü).
  5. **Yazarlar:** distinct yazar listesi; seçim `?author=` fasetini uygular.
- **Etkileşim:** 120ms debounce; boş sorguda eylemler; grup başlıkları mono; `aria-activedescendant`; fare tıklaması da destekli; sayı "n sonuç" `aria-live="polite"`.
- **Stil:** E4 yüzey, cam (`--glass`), genişlik `min(640px, 92vw)`; FAZ-2 estetiğiyle uyumlu.

### 3.2 Kısayol Haritası (`?`)
- Shift+/ → küçük diyalog: kısayol tablosu (⌘K, `/`, `?`, Escape, ok tuşları, j/k kayıt görünümünde önceki/sonraki komşu). `i18n` TR/EN.

### 3.3 Ek Kısayollar
- Kayıt görünümü açıkken: `j`/`k` → takımyıldızdaki sonraki/önceki komşuya geçiş (FAZ-5 görünüm içi geçişini çağırır); `s` → yıldız ekle/kaldır; `c` → alıntı kopyala. Input odaktayken devre dışı (mevcut `/` koşumantığının geneli).
- Tüm kısayollar `motionToggle`/dil durumundan bağımsız çalışır; reduced-motion'da geçişler anında.

## 4. Görev Listesi

1. `palette.js`: veri kaynakları + filtreleme + ARIA + klavye; `app.js`/`record.js` API'lerine bağlanma.
2. Palet DOM + stiller; header tetikleyicisini bağla.
3. `?` haritası diyalogu + kısayol tablosu i18n.
4. Kayıt görünümü j/k/s/c kısayolları.
5. SW önbelleği + `?v=45`; klavye turları (TR/EN, iki tema, reduced-motion).

## 5. Uygulama Promptu

> Aşağıdaki promptu yeni bir Copilot/Codex oturumuna olduğu gibi yapıştır:

```text
Görev: "Bilim Kütüphanem" statik katalog uygulamasında (site/ — vanilla JS, GitHub Pages, dış istek YASAK) FAZ-6'yı uygula: komut paleti ve klavye uygarlığı. Önce TASARIM-PLANI.md ve docs/tasarim/FAZ-6-palet.md dosyalarını oku. FAZ-0..5 tamamlanmış varsayılır (header'da ⌘K tetikleyici düğmesi var; FAZ-5 kayıt görünümü site/record.js'te).

Uygulanacaklar:
1. KOMUT PALETİ — yeni dosya site/palette.js:
   - Açılış: Cmd/Ctrl+K (her yerde, input odaktayken bile preventDefault ile); header'daki mevcut ⌘K düğmesi; Escape kapanır; kapanınca tetikleyiciye odak döner.
   - ARIA (WAI-ARIA APG): dış kapsayıcı role="dialog" aria-modal="true"; içinde combobox deseni — input role="combobox" aria-expanded, aria-controls, aria-activedescendant; sonuçlar role="listbox" role="option"; odak palet içinde kalır (mevcut diyalog odak tuzağı desenini kullan); sonuç sayısı aria-live="polite".
   - Klavye: yukarı/aşağı gezinme, Enter seçim, Escape kapanış, fare tıklaması da çalışır.
   - Veri kaynakları (öncelik sırasıyla): (1) eylemler — kataloğa git, keşfet, okuma yolları, arşivler, temayı değiştir, hareketi durdur/oynat, dili değiştir (TR/EN), okuma listemi göster (?saved=1), katalog verisini indir; (2) 10 okuma yolu başlığı (FAZ-1 i18n-data.json routes sözlüğünden — ID-anhtarlı); (3) 8 keşif alanı (DISCOVERY + ?discover=); (4) kayıtlar — records[].search ön-hesaplı normalize alanıyla başlık/yazar eşleşmesi, seçim ?record= ile FAZ-5 görünümünü açar; (5) yazarlar — distinct liste, seçim mevcut ?author= fasetini uygular.
   - Davranış: 120ms debounce; boş sorguda eylemler listelenir; grup başlıkları mono (--fs-label); en fazla ~12 sonuç.
   - Stil: E4 yüzey + cam (--glass + blur), genişlik min(640px,92vw), FAZ-2 estetiğiyle uyumlu; index.html'e palet DOM'unu ekle (script'i defer ile yükle).
2. KISAYOL HARİTASI — Shift+/ ("?") → küçük diyalog: kısayol tablosu (⌘K, /, ?, Escape, ok tuşları, j/k/s/c). TR+EN i18n.
3. KAYIT GÖRÜNÜMÜ KISAYOLLARI — site/record.js'e ekle: görünüm açıkken j → takımyıldızdaki sonraki komşu, k → önceki (FAZ-5 düğüm geçişini çağırır), s → yıldız ekle/kaldır, c → alıntı kopyala. Input/textarea/select odaktayken ve palet açıkken devre dışı (mevcut "/" kısayolunun koşul mantığını genelleştir). Reduced-motion'da geçişler anında.
4. Tüm yeni metinler site/i18n.js'e TR+EN (palettePlaceholder, paletteNoResults, eylem adları, kısayol açıklamaları...). ?v=45; sw.js önbellek listesine palette.js ekle.

Kısıtlar: mevcut "/" kısayolu AYNEN çalışır; hiçbir kısayolu mevcut davranışın önüne geçmez; kayıtlı okuma listesi/dil/tema eylemleri mevcut API'leri (setLanguage, applyTheme, motionToggle...) çağırır — yeni mantık üretmez.

Kabul (Definition of Done):
- python tools/validate_site.py + tools/validate_i18n.py + node --check (palette.js, app.js, record.js, i18n.js) → geçer.
- Klavye turu: ⌘K → "ein" yaz → Einstein kaydı Enter ile açılır; ⌘K → "yol" / "path" → rota listesi; ⌘K → "tema"/"theme" → tema değişir; Escape → palet kapanır, tetikleyicide odak.
- Ekran okuyucu (NVDA/VoiceOver): palet açılış duyurulur, seçenekler okunur, sonuç sayısı duyurulur.
- TR ve EN'de palet tamamen yerelleşmiş; ? kısayol haritası iki dilde.
- Çevrimdışı: palet kayıt/yazar/rota araması çalışıyor (yerel veri).
Değişiklikleri tek commit'te "FAZ-6: command palette, shortcut map, keyboard-first record actions" mesajıyla gönder.
```

## 6. Kabul Kriterleri

- [ ] ⌘K/Ctrl+K her bağlamda; Escape/odak sözleşmesi kusursuz
- [ ] 5 veri kaynağı da çalışıyor; eylemler mevcut API'leri çağırıyor
- [ ] ARIA combobox + listbox deseni doğrulandı (ekran okuyucu testi)
- [ ] `?` haritası + j/k/s/c kısayolları; input koruması
- [ ] `validate_i18n.py` 0 hata; `?v=45`; SW önbelleğinde `palette.js`

## 7. Regresyon Kontrolü

`/` kısayolu · palet açıkken Escape ile kapanış + odak dönüşü · paletten açılan kayıtta j/k/s/c · TR/EN eylem adları · hareket durdurma eylemi `motionToggle` durumunu koruyor · çevrimdışı palet.

## 8. Geri Alma

Tek commit → `git revert`. `palette.js` izole; `record.js` kısayol ekleri `#record-view` görünürlük koşullu blokta.
