# İBİS — Cloudflare Pages + D1 Kurulum Rehberi

Bu rehber, projeyi yerel Python/FastAPI'den tamamen kurtarıp GitHub üzerinden
tek bir **Cloudflare Pages** projesi olarak canlıya almanız için adım adım
yazılmıştır. Terminal/CLI zorunlu değildir — hepsi Cloudflare Dashboard
üzerinden fare ile yapılabilir (D1 şemasını yüklemek için tek bir SQL
yapıştırma adımı hariç).

## 0. Repo klasör yapısı (bu teslimatla birebir aynı)

```
ibis/
├── schema.sql
├── functions/
│   └── api/
│       └── [[route]].js        ← tüm /api/* isteklerini karşılayan tek fonksiyon
└── frontend/
    ├── index.html               ← RİS / İBİS'e yönlendirme sayfası
    ├── ris/
    │   └── index.html
    └── ibis/
        └── index.html
```

Bu yapıyı olduğu gibi GitHub reponuza yükleyin (kök dizin projenin kökü olsun,
yani `schema.sql` ve `functions/` klasörü repo'nun en üst seviyesinde
görünmeli).

## 1. GitHub reposunu oluşturun

1. GitHub'da yeni bir repo açın (ör. `ibis-projesi`), **public** veya
   **private** fark etmez.
2. Yukarıdaki klasör yapısını bu repoya push edin (GitHub'ın web arayüzünden
   "Add file → Upload files" ile sürükle-bırak da yapabilirsiniz, komut
   satırı gerekmez).

## 2. Cloudflare D1 veritabanını oluşturun

1. [dash.cloudflare.com](https://dash.cloudflare.com) → sol menüden
   **Workers & Pages → D1 SQL Database** bölümüne girin.
2. **Create database** butonuna basın, ismini `ibis-db` verin, bölge
   olarak size en yakın olanı seçin, **Create** deyin.
3. Veritabanı oluşunca açılan sayfada üstteki **Console** sekmesine geçin.
4. Bu teslimattaki `schema.sql` dosyasının **tüm içeriğini** kopyalayıp
   konsola yapıştırın ve **Execute** / **Run** butonuna basın.
   - Bunu yaptığınızda `vakalar` ve `sim_durumu` tabloları oluşur ve 3
     demo vaka (Ayşe Kılıç, Fatma Şahin, Zeynep Arslan) otomatik eklenir.
   - İstediğiniz zaman aynı SQL'i tekrar çalıştırarak veritabanını sıfırdan
     kurabilirsiniz (dosyanın başındaki `DROP TABLE IF EXISTS` satırları
     bunu güvenli hale getirir).

## 3. Cloudflare Pages projesini GitHub'a bağlayın

1. Dashboard'da **Workers & Pages → Create → Pages → Connect to Git**
   yolunu izleyin.
2. Az önce oluşturduğunuz `ibis-projesi` reposunu seçin, **Begin setup**
   deyin.
3. **Build settings** ekranında:
   - **Framework preset:** `None`
   - **Build command:** *(boş bırakın)*
   - **Build output directory:** `frontend`
4. **Save and Deploy** ile ilk deploy'u başlatın (bu ilk deploy'da API
   henüz D1'e bağlı olmadığı için `/api/...` istekleri 500 hatası
   verecektir — bir sonraki adımda bunu düzelteceğiz).

> Not: `functions/` klasörü repo kökünde olduğu sürece Cloudflare Pages
> bunu otomatik olarak algılar ve `/api/*` isteklerini
> `functions/api/[[route]].js` dosyasına yönlendirir; ayrıca bir ayar
> yapmanıza gerek yoktur.

## 4. D1 binding'ini Pages projesine tanımlayın

1. Az önce oluşan Pages projesine girin → **Settings → Functions**
   sekmesine geçin.
2. **D1 database bindings** bölümünde **Add binding** butonuna basın.
   - **Variable name:** `DB`  ⚠️ *Bu isim kod ile birebir eşleşmeli
     (`env.DB` olarak kullanılıyor), farklı bir isim yazarsanız API
     500 hatası döner.*
   - **D1 database:** `ibis-db` (2. adımda oluşturduğunuz veritabanı)
3. **Save** deyin.
4. Değişikliğin etkili olması için **Deployments** sekmesinden en son
   deploy'un yanındaki **⋯ → Retry deployment** ile yeniden deploy edin
   (binding eklemek yeni bir deploy tetiklemez, mevcut deploy'u yeniden
   çalıştırmanız gerekir).

## 5. Test edin

1. Pages projenizin verdiği adrese gidin
   (ör. `https://ibis-projesi.pages.dev`).
2. Açılış sayfasından **RİS Ekranı**'na girin, bir hastanın ⋮ menüsünden
   **"İnsidental Bulgu Bildir ▶"** ile bir süre seçin — yeşil onay
   banner'ı görmelisiniz.
3. **İBİS Paneli**'ne geçin, **Takip Listesi**'nde az önce eklediğiniz
   vakayı görmelisiniz.
4. Sağ üstteki **"+1 Ay İleri Sar"** butonuna art arda basarak kontrol
   zamanı gelen vakaların **Klinisyen Onayı** sekmesine düştüğünü,
   onaylanmadan bırakılırsa bir sonraki "+1 Ay"da kırmızı
   **Eskalasyon** alarmına dönüştüğünü gösterebilirsiniz.
5. **"↺ Sıfırla"** butonu simülasyon saatini ve vaka durumlarını demo
   başlangıcına döndürür — jüri sunumunu tekrar tekrar temiz baştan
   çalıştırmak için kullanın.

## 6. Sık karşılaşılan hatalar

| Belirti | Sebep | Çözüm |
|---|---|---|
| `/api/...` her istekte "D1 veritabanına bağlı değil" hatası dönüyor | Binding adı `DB` değil ya da deploy binding eklenmeden önce yapılmış | Adım 4'ü kontrol edin, sonra **Retry deployment** yapın |
| RİS/İBİS ekranı açılıyor ama "API'ye bağlanılamıyor" uyarısı çıkıyor | `frontend` klasörü build output olarak seçilmemiş, ya da `functions/` klasörü repo kökünde değil | Adım 0 ve 3'teki klasör yolunu tekrar kontrol edin |
| D1 konsolunda `CHECK constraint failed` hatası | `schema.sql` yapıştırılırken bir kısmı kesilmiş (kopyala-yapıştır eksik kalmış) | Dosyanın tamamını (baştan sona) tekrar kopyalayıp çalıştırın |
| Yeni bulgu eklendiğinde tarih hesapları saçma görünüyor | Simülasyon saati sıfırlanmadan defalarca "+1 Ay" basılmış | "↺ Sıfırla" ile simülasyonu sıfırlayıp tekrar deneyin |

---

Bu kurulum tamamlandığında proje tamamen Cloudflare üzerinde, herhangi bir
yerel Python/uvicorn süreci veya Windows dosya kilidi sorunu olmadan
çalışır; her `git push` otomatik olarak yeni bir Pages deploy'u tetikler.
