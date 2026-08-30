/**
 * IBIS - Insidental Bulgu Takip Sistemi
 * Cloudflare Pages Functions API (D1 tabanli)
 *
 * Bu dosya /functions/api/ altinda [[route]].js olarak durdugu icin
 * /api/ ile baslayan TUM istekleri (vaka-olustur, vakalar, simulasyon/...,
 * vaka-aksiyon, ozet) tek bir "catch-all" fonksiyon olarak yakalar.
 *
 * D1 binding: Pages projesi ayarlarinda "DB" adiyla baglanmis olmali
 * (bkz. KURULUM_REHBERI.md).
 */

const GECERLI_ONCELIK = ["ACIL", "TAKIP"];
const GECERLI_AKSIYON = ["ONAYLA", "REDDET", "ESKALE_ET"];

// ---------------------------------------------------------------------------
// Yardimcilar
// ---------------------------------------------------------------------------

function jsonYanit(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function isoEkleGun(baseDate, gun) {
  const d = new Date(baseDate.getTime());
  d.setUTCDate(d.getUTCDate() + gun);
  return d;
}

// Simule edilmis "su an": gercek zaman + D1'de saklanan ilerleme_gun
async function simdikiZamaniGetir(env) {
  const satir = await env.DB.prepare(
    "SELECT ilerleme_gun FROM sim_durumu WHERE id = 1"
  ).first();
  const ilerlemeGun = satir ? satir.ilerleme_gun : 0;
  const simdi = isoEkleGun(new Date(), ilerlemeGun);
  return { simdi, ilerlemeGun };
}

function rowToVaka(row) {
  return row; // D1 zaten duz obje donuyor, sutun isimleri ayni
}

// ---------------------------------------------------------------------------
// Endpoint isleyicileri
// ---------------------------------------------------------------------------

async function vakaOlustur(request, env) {
  const govde = await request.json().catch(() => ({}));

  const zorunlu = ["hasta_ad", "tckn", "tetkik", "bolum"];
  for (const alan of zorunlu) {
    if (!govde[alan]) {
      return jsonYanit({ basarili: false, hata: `'${alan}' alani zorunludur.` }, 400);
    }
  }

  const oncelik = GECERLI_ONCELIK.includes(govde.oncelik) ? govde.oncelik : "TAKIP";
  const sureAy = oncelik === "ACIL" ? 0 : Number(govde.sure_ay) || 6;
  const bulgu = govde.bulgu || "İnsidental bulgu saptandı, klinik korelasyon önerilir.";

  const { simdi } = await simdikiZamaniGetir(env);
  const kontrolTarihi = isoEkleGun(simdi, sureAy > 0 ? sureAy * 30 : 1);
  const eskalasyonTarihi = isoEkleGun(kontrolTarihi, 30);

  const id = crypto.randomUUID();

  await env.DB.prepare(
    `INSERT INTO vakalar (
      id, hasta_ad, tckn, hastane, accession, isteyen, tetkik, bolum, bulgu,
      oncelik, sure_ay, durum, klinisyen_notu,
      kayit_tarihi, kontrol_tarihi, eskalasyon_tarihi, guncelleme_tarihi
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  )
    .bind(
      id,
      govde.hasta_ad,
      govde.tckn,
      govde.hastane || "",
      govde.accession || "",
      govde.isteyen || "",
      govde.tetkik,
      govde.bolum,
      bulgu,
      oncelik,
      sureAy,
      "BEKLEMEDE",
      "",
      simdi.toISOString(),
      kontrolTarihi.toISOString(),
      eskalasyonTarihi.toISOString(),
      simdi.toISOString()
    )
    .run();

  return jsonYanit({ basarili: true, vaka_id: id });
}

async function vakalarListele(request, env) {
  const url = new URL(request.url);
  const durum = url.searchParams.get("durum");

  let sonuc;
  if (durum) {
    sonuc = await env.DB.prepare(
      "SELECT * FROM vakalar WHERE durum = ? ORDER BY kayit_tarihi DESC"
    )
      .bind(durum)
      .all();
  } else {
    sonuc = await env.DB.prepare("SELECT * FROM vakalar ORDER BY kayit_tarihi DESC").all();
  }

  const { simdi, ilerlemeGun } = await simdikiZamaniGetir(env);

  return jsonYanit({
    vakalar: (sonuc.results || []).map(rowToVaka),
    simulasyon: { ilerleme_gun: ilerlemeGun, simulasyon_tarihi: simdi.toISOString() },
  });
}

async function simulasyonIleriSar(request, env) {
  const url = new URL(request.url);
  const ay = Number(url.searchParams.get("ay")) || 1;

  const mevcut = await env.DB.prepare("SELECT ilerleme_gun FROM sim_durumu WHERE id = 1").first();
  const yeniIlerlemeGun = (mevcut ? mevcut.ilerleme_gun : 0) + ay * 30;
  await env.DB.prepare("UPDATE sim_durumu SET ilerleme_gun = ? WHERE id = 1")
    .bind(yeniIlerlemeGun)
    .run();

  const yeniZaman = isoEkleGun(new Date(), yeniIlerlemeGun);
  const yeniZamanIso = yeniZaman.toISOString();
  const simdiIso = new Date().toISOString();

  // 1) Kontrol zamani gelen BEKLEMEDE vakalari klinisyen onayina dusur
  const klinisyeneDusenler = await env.DB.prepare(
    `UPDATE vakalar SET durum = 'KLINISYEN_BEKLENIYOR', guncelleme_tarihi = ?
     WHERE durum = 'BEKLEMEDE' AND kontrol_tarihi <= ?
     RETURNING id`
  )
    .bind(simdiIso, yeniZamanIso)
    .all();

  // 2) Klinisyen onayi hala gelmemis ve eskalasyon esigini gecmis vakalari eskale et
  const eskaleEdilenler = await env.DB.prepare(
    `UPDATE vakalar SET durum = 'ESKALE_EDILDI', guncelleme_tarihi = ?
     WHERE durum = 'KLINISYEN_BEKLENIYOR' AND eskalasyon_tarihi <= ?
     RETURNING id`
  )
    .bind(simdiIso, yeniZamanIso)
    .all();

  return jsonYanit({
    basarili: true,
    eklenen_ay: ay,
    toplam_ilerleme_gun: yeniIlerlemeGun,
    simulasyon_tarihi: yeniZamanIso,
    klinisyene_dusen_vaka_sayisi: (klinisyeneDusenler.results || []).length,
    eskale_edilen_vaka_sayisi: (eskaleEdilenler.results || []).length,
  });
}

async function simulasyonSifirla(env) {
  await env.DB.prepare("UPDATE sim_durumu SET ilerleme_gun = 0 WHERE id = 1").run();
  // Demoyu bastan tekrarlanabilir kilmak icin ACIL vakalari klinisyen onayina,
  // digerlerini bekleme durumuna geri al (ONAYLANDI/ESKALE_EDILDI dahil).
  await env.DB.prepare(
    `UPDATE vakalar SET durum = CASE WHEN oncelik = 'ACIL' THEN 'KLINISYEN_BEKLENIYOR' ELSE 'BEKLEMEDE' END,
     guncelleme_tarihi = ?`
  )
    .bind(new Date().toISOString())
    .run();

  return jsonYanit({ basarili: true, mesaj: "Simülasyon sıfırlandı." });
}

async function vakaAksiyon(request, env) {
  const govde = await request.json().catch(() => ({}));
  const { vaka_id, aksiyon, not_metni } = govde;

  if (!vaka_id || !GECERLI_AKSIYON.includes(aksiyon)) {
    return jsonYanit({ basarili: false, hata: "Geçersiz vaka_id veya aksiyon." }, 400);
  }

  const mevcutVaka = await env.DB.prepare("SELECT id FROM vakalar WHERE id = ?").bind(vaka_id).first();
  if (!mevcutVaka) {
    return jsonYanit({ basarili: false, hata: "Vaka bulunamadı." }, 404);
  }

  const durumHaritasi = {
    ONAYLA: "ONAYLANDI",
    REDDET: "BEKLEMEDE",
    ESKALE_ET: "ESKALE_EDILDI",
  };
  const yeniDurum = durumHaritasi[aksiyon];

  await env.DB.prepare(
    "UPDATE vakalar SET durum = ?, klinisyen_notu = ?, guncelleme_tarihi = ? WHERE id = ?"
  )
    .bind(yeniDurum, not_metni || "", new Date().toISOString(), vaka_id)
    .run();

  return jsonYanit({ basarili: true, vaka_id, yeni_durum: yeniDurum });
}

async function ozet(env) {
  const sonuc = await env.DB.prepare(
    "SELECT durum, COUNT(*) AS adet FROM vakalar GROUP BY durum"
  ).all();

  const sayaclar = { BEKLEMEDE: 0, KLINISYEN_BEKLENIYOR: 0, ONAYLANDI: 0, ESKALE_EDILDI: 0 };
  for (const row of sonuc.results || []) {
    sayaclar[row.durum] = row.adet;
  }

  const { simdi, ilerlemeGun } = await simdikiZamaniGetir(env);

  return jsonYanit({
    ...sayaclar,
    simulasyon: { ilerleme_gun: ilerlemeGun, simulasyon_tarihi: simdi.toISOString() },
  });
}

// ---------------------------------------------------------------------------
// Ana yonlendirici
// ---------------------------------------------------------------------------

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;

  if (method === "OPTIONS") {
    return jsonYanit({});
  }

  if (!env.DB) {
    return jsonYanit(
      { basarili: false, hata: "D1 veritabanı bağlı değil. Pages ayarlarında 'DB' binding'ini kontrol edin." },
      500
    );
  }

  const rota = Array.isArray(params.route) ? params.route.join("/") : "";

  try {
    if (rota === "vaka-olustur" && method === "POST") return await vakaOlustur(request, env);
    if (rota === "vakalar" && method === "GET") return await vakalarListele(request, env);
    if (rota === "simulasyon/ileri-sar" && method === "POST") return await simulasyonIleriSar(request, env);
    if (rota === "simulasyon/sifirla" && method === "POST") return await simulasyonSifirla(env);
    if (rota === "vaka-aksiyon" && method === "POST") return await vakaAksiyon(request, env);
    if (rota === "ozet" && method === "GET") return await ozet(env);

    return jsonYanit({ basarili: false, hata: "Bilinmeyen rota: /api/" + rota }, 404);
  } catch (err) {
    return jsonYanit({ basarili: false, hata: err.message || String(err) }, 500);
  }
}
