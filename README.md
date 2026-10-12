İBİS Prototipi — Kurulum ve Çalıştırma
Bu paket, Claude Code CLI'da yaşanan (pyc çözme, dosya kilidi, buffer kopması,
uvicorn PATH hatası) sorunları tamamen atlayacak şekilde, üç dosya doğrudan
tam ve tek parça olarak üretilmiştir. Terminalde tek satır kod basmanıza
gerek yok — sadece klasörleri kopyalayıp çalıştırmanız yeterli.
1) Klasörleri yerleştirin
Bu zip'i açtığınızda şu yapı gelir:
```
ibis/
  backend/
    app.py
  frontend/
    ris/
      index.html
    ibis/
      index.html
```
Bunu doğrudan `C:\\\\Users\\\\Bülent\\\\Desktop\\\\IBIS` klasörünün üzerine kopyalayabilir
ya da tamamen yeni bir klasöre açabilirsiniz (öneri: yeni/temiz bir klasör,
eski kilitli dosyalarla karışmasın).
2) Backend'i kurun ve çalıştırın
Windows'ta `uvicorn` komutunun PATH'te bulunamaması hatasını (CommandNotFoundException)
önlemek için HER ZAMAN `python -m uvicorn` şeklinde çağırın:
```powershell
cd ibis\\\\backend
pip install fastapi uvicorn
python -m uvicorn app:app --reload --port 8000
```
Terminalde şunu görmelisiniz:
```
Uvicorn running on http://127.0.0.1:8000
```
İlk çalıştırmada `ibis.db` adında bir SQLite dosyası otomatik oluşur.
3) Ekranları açın
`frontend/ris/index.html` ve `frontend/ibis/index.html` dosyalarını doğrudan
tarayıcıda çift tıklayarak açabilirsiniz (backend'in `CORSMiddleware` ile
tüm origin'lere açık olması sayesinde `file://` üzerinden de çalışır).
Jüri sunumu akışı:
RİS ekranını açın, bir hastanın satırındaki `⋮` menüsünden
"İnsidental Bulgu Bildir ▶" ile 1/3/6 ay ya da Acil seçin.
İBİS panelini açın — bildirilen vaka "Bekleyen Vaka" sayacına düşer.
Panelin sağ üstündeki "6 Ay İleri Sar" butonuna basın — kontrol
zamanı gelen vakalar otomatik olarak "Hekim Onayı Bekleyen" kartlarına
düşer (bu, RİS/HBYS arasındaki zaman akışını simüle eder).
Kart üzerinden "Randevu Oluştur ve Onayla", "Ertele" ya da
"Eskale Et" aksiyonlarından birini uygulayın; sayaçlar ve alt
tablo canlı güncellenir (panel 5 saniyede bir otomatik yeniler).
Neden bu sefer sorun çıkmaz
Dosyalar CLI üzerinden `Write` aracıyla parça parça basılmadı; tek seferde
tam içerikle oluşturuldu — Windows'un `.tmp` rename kilidine (`EPERM`) hiç
girilmiyor.
Hiçbir yerde `cat << 'EOF'` veya PowerShell `Set-Content` ile tek satırlık
uzun komut kullanılmadı — 1015 bayt buffer sınırına takılma riski yok.
Kod, `\\\_\\\_pycache\\\_\\\_/\\\*.pyc` üzerinden değil, doğrudan okunabilir `.py`
kaynağından geliyor — marshal/dis ile tersine mühendislik gerekmiyor.
`uvicorn` komutu yerine `python -m uvicorn` kullanımı belgeleniyor, PATH
sorunuyla tekrar karşılaşmazsınız.
Sonraki adımlar (opsiyonel geliştirmeler)
RİS'teki hasta listesi şu an demo amaçlı sabit veriden geliyor; gerçek
RİS entegrasyonunda bu, gerçek bir `/api/hastalar` endpoint'ine bağlanabilir.
`sure\\\_ay` alanına göre gerçek takvim bildirimleri (e-posta/SMS) eklenebilir.
`oncelik = ACIL` vakalar için ayrı bir push/bildirim kanalı düşünülebilir.
