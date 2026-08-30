-- ============================================================================
-- IBIS - Insidental Bulgu Takip Sistemi
-- Cloudflare D1 (SQLite) semasi
-- Kurulum: wrangler d1 execute ibis-db --remote --file=schema.sql
--          (veya Cloudflare Dashboard > D1 > Console'a yapistirip calistirin)
-- ============================================================================

DROP TABLE IF EXISTS vakalar;
DROP TABLE IF EXISTS sim_durumu;

-- ----------------------------------------------------------------------------
-- Ana takip tablosu
-- ----------------------------------------------------------------------------
CREATE TABLE vakalar (
    id                  TEXT PRIMARY KEY,
    hasta_ad            TEXT NOT NULL,
    tckn                TEXT NOT NULL,
    hastane             TEXT DEFAULT '',
    accession           TEXT DEFAULT '',
    isteyen             TEXT DEFAULT '',
    tetkik              TEXT NOT NULL,
    bolum               TEXT NOT NULL,
    bulgu               TEXT NOT NULL,
    oncelik             TEXT NOT NULL DEFAULT 'TAKIP'
                            CHECK (oncelik IN ('ACIL', 'TAKIP')),
    sure_ay             INTEGER NOT NULL DEFAULT 0,
    durum               TEXT NOT NULL DEFAULT 'BEKLEMEDE'
                            CHECK (durum IN ('BEKLEMEDE', 'KLINISYEN_BEKLENIYOR', 'ONAYLANDI', 'ESKALE_EDILDI')),
    klinisyen_notu      TEXT DEFAULT '',
    kayit_tarihi        TEXT NOT NULL,   -- ISO 8601, vakanin RIS'ten bildirildigi (simule) an
    kontrol_tarihi      TEXT NOT NULL,   -- ISO 8601, hekim onayinin beklendigi son tarih
    eskalasyon_tarihi   TEXT NOT NULL,   -- ISO 8601, bu tarihe kadar onay gelmezse otomatik eskale olur
    guncelleme_tarihi   TEXT NOT NULL
);

CREATE INDEX idx_vakalar_durum ON vakalar (durum);
CREATE INDEX idx_vakalar_kontrol_tarihi ON vakalar (kontrol_tarihi);

-- ----------------------------------------------------------------------------
-- Tek satirlik "simulasyon saati" tablosu. Cloudflare Functions stateless
-- oldugu icin "kac gun ileri sarildi" bilgisini burada tutuyoruz; boylece
-- "+1 Ay Ileri Sar" butonuna art arda basildiginda ilerleme kalici olur.
-- ----------------------------------------------------------------------------
CREATE TABLE sim_durumu (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    ilerleme_gun    INTEGER NOT NULL DEFAULT 0
);

INSERT INTO sim_durumu (id, ilerleme_gun) VALUES (1, 0);

-- ----------------------------------------------------------------------------
-- Demo/jüri verisi — RIS ekranindaki 7 hastadan 3'u icin insidental bulgu
-- kaydi acilmis gibi baslangic durumu. Tarihler gorece (datetime('now', ...))
-- hesaplanir; bu sayede D1'e ne zaman yuklerseniz yukleyin senaryo tutarli
-- kalir: Zeynep Arslan ACIL oldugu icin hemen onay bekliyor, Fatma Sahin'in
-- kontrol tarihi gecmis durumda (ilk "+1 Ay Ileri Sar" ile klinisyen onayina
-- dusecek), Ayse Kilic'in kontrol tarihi ise 3 ay sonraya kurulu.
-- ----------------------------------------------------------------------------
INSERT INTO vakalar (
    id, hasta_ad, tckn, hastane, accession, isteyen, tetkik, bolum, bulgu,
    oncelik, sure_ay, durum, kayit_tarihi, kontrol_tarihi, eskalasyon_tarihi, guncelleme_tarihi
) VALUES
(
    'demo-0001', 'Ayşe Kılıç', '12345678901', 'Maltepe Hastanesi', 'ACC-100234', 'Dr. Kemal Öz',
    'Toraks BT (Kontrastsız)', 'Göğüs Hast.', 'Sağ akciğer üst lobda 8mm nodül, 6 ay sonra kontrol BT önerilir.',
    'TAKIP', 6, 'BEKLEMEDE',
    datetime('now', '-14 days'), datetime('now', '+166 days'), datetime('now', '+196 days'), datetime('now', '-14 days')
),
(
    'demo-0002', 'Fatma Şahin', '34567890123', 'Maltepe Hastanesi', 'ACC-100236', 'Dr. Onur Ak',
    'Batın BT (Kontrastlı)', 'Genel Cerrahi', 'Sağ böbrek üst polde 14mm kistik lezyon, 3 ay sonra kontrol USG önerilir.',
    'TAKIP', 3, 'BEKLEMEDE',
    datetime('now', '-95 days'), datetime('now', '-5 days'), datetime('now', '+25 days'), datetime('now', '-95 days')
),
(
    'demo-0003', 'Zeynep Arslan', '56789012345', 'Maltepe Hastanesi', 'ACC-100238', 'Dr. Kemal Öz',
    'Toraks BT (Kontrastlı)', 'Onkoloji', 'Tiroid sol lobda 11mm nodül, insidental — acil klinik korelasyon önerilir.',
    'ACIL', 0, 'KLINISYEN_BEKLENIYOR',
    datetime('now', '-2 days'), datetime('now', '-1 days'), datetime('now', '+29 days'), datetime('now', '-1 days')
);
