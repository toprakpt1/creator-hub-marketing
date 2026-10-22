<div align="center">

# Creator Hub

**Oyununu tanıtacak küçük YouTube kanallarını bul, puanla ve onlara mail at.**

Kendi bilgisayarında, kendi API anahtarınla, kendi posta kutundan.

[![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js&logoColor=white)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-yerel-003B57?logo=sqlite&logoColor=white)](https://www.sqlite.org)
[![Lisans](https://img.shields.io/badge/lisans-MIT-green)](LICENSE)

[Kurulum](#-kurulum) · [Nasıl çalışır](#-nasıl-çalışır) · [Kurulum rehberi](docs/SETUP.md) · [Sürümler](#-sürümler)

</div>

---

## Bu ne işe yarıyor?

Indie bir oyunun var ve tanıtmak istiyorsun. Büyük YouTuber'lar pahalı ve ulaşılmaz. Asıl fırsat, **abone sayısının çok üstünde izlenme alan küçük kanallarda** — 10 bin abonesi olup videoları 150 bin izlenen biri, 500 bin abonesi olup 20 bin izlenen birinden çok daha değerli.

Creator Hub bu kanalları bulur, neden değerli olduklarını sayılarla açıklar ve onlara mail atmanı sağlar.

| Adım | Ne yapar |
| --- | --- |
| 🔍 **Keşfet** | Anahtar kelimeyle YouTube'da ara, gerçek kanal istatistiklerini çek, abone aralığına göre filtrele |
| 📊 **Puanla** | 0–100 arası, kural tabanlı ve şeffaf puan — her puanın dökümü görünür |
| 🔥 **Yükselen** | Medyan izlenmesi abone sayısını aşan kanalları işaretler |
| 📁 **Düzenle** | Listeler, kampanyalar ve gerçek durumlardan hesaplanan bir süreç takibi |
| ✉️ **İletişim** | Şablondan hazırla, doldurulmuş halini gör, kendi posta kutundan gönder |

> [!WARNING]
> ### Bunu çalıştırmadan önce oku
>
> **Bu bir öğrenme/demo projesidir, üretim yazılımı değil.** Giriş sistemi sahte — *herhangi bir* e-posta ve şifre seni içeri alır.
>
> - **Kendi bilgisayarında çalıştır.** Bu haliyle internete açık bir adrese kurma.
> - **`.env.local` dosyasını asla commit etme.** İçinde API anahtarın ve mail şifren var. `.gitignore`'da — öyle kalsın.
> - **Anahtarlarını asla paylaşma** — ekran görüntüsünde, videoda, issue'da. Sızarsa hemen iptal et ([nasıl](docs/SETUP.md#erişimi-iptal-etme)).
> - **Verin sende kalır.** `data/` klasörü gitignore'da; topladığın üreticiler ve e-posta adresleri repoya gitmez.
> - **Gönderdiğin maillerden sen sorumlusun.** [Sorumlu gönderim](docs/SETUP.md#4-sorumlu-gönderim) bölümünü oku.

---

## 🚀 Kurulum

Node.js 18.18+ gerekir.

```bash
git clone https://github.com/UgurKeskekci/creator-hub-marketing.git
cd creator-hub-marketing
npm install
cp .env.example .env   # sonra içini doldur
npm run preview
```

<http://localhost:3000> adresini aç. Herhangi bir e-posta/şifre ile giriş yapabilirsin.

SQLite veritabanı ve tabloları ilk açılışta kendiliğinden oluşur. **Kurulacak veritabanı sunucusu, Docker ya da migration komutu yok** — her şey `data/creator-hub.db` adlı tek bir yerel dosyada.

```env
# Keşif — https://console.cloud.google.com → YouTube Data API v3
YOUTUBE_API_KEY=AIza...
YOUTUBE_DAILY_QUOTA=10000
DATABASE_PATH=./data/creator-hub.db

# Gmail — Ayarlar → Mail ekranından bağlanır (OAuth2, sadece gmail.send izni).
# Google Cloud'da OAuth client oluşturup şu adresi redirect URI olarak ekle:
#   http://localhost:3000/api/mail/gmail/callback
GOOGLE_OAUTH_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...

# Yedek: Gmail bağlı değilken herhangi bir SMTP sunucusu kullanılabilir.
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sen@gmail.com
SMTP_PASS=16-haneli-uygulama-sifresi
SMTP_FROM_NAME=Stüdyo Adın
SMTP_DAILY_LIMIT=450
```

Bu değerler **yalnızca sunucu tarafında** okunur, tarayıcıya asla gitmez. Hiçbirinin başına `NEXT_PUBLIC_` koyma. Gmail token'ları veritabanına yazılmadan önce şifrelenir.

**→ [Adım adım kurulum rehberi](docs/SETUP.md)** — YouTube anahtarı, Gmail OAuth kurulumu, uygulama şifresi alternatifi, tüm ortam değişkenleri.

---

## 🔍 Nasıl çalışır

### Keşif ve kota

YouTube API'sinin günlük 10.000 birimlik ücretsiz kotası var ve bir arama bunun 100'ünü yiyor. Proje bu yüzden kotayı ciddiye alıyor:

```
anahtar kelime → search.list (100 birim, TEK çağrı)
               → videoları benzersiz kanallara indirge
               → zaten kayıtlı olanları ele (youtube_channel_id üzerinden)
               → channels.list, istek başına 50 kanal (1 birim)
               → abone aralığı filtresi
               → adaylar ekranda
                       ↓  (sen seçersin)
               → seçilenler üretici olarak kaydedilir
                       ↓  (üretici başına, açıkça)
               → playlistItems.list + videos.list (2 birim) → metrikler, puan
```

**Arama ile kaydetme ayrı şeylerdir.** Arama sonucu bir adaydır; sen seçmeden üretici olmaz. Video analizi de ayrı ve isteğe bağlı bir adımdır.

| Koruma | Davranış |
| --- | --- |
| Maliyet muhasebesi | Her istek, yanıt kullanılmadan **önce** kaydedilir — sayaç şaşmaz |
| Ön kontrol | Günlük sınırı aşacak arama baştan reddedilir |
| Önbellek | 24 saat içindeki aynı arama sıfır birim harcar, "yine de çalıştır" seçeneği açık kalır |
| Toplu istek | Kanal ve video sorguları 50'şerli gider, asla üretici başına bir istek atılmaz |
| Otomatik sayfalama yok | Sonraki sayfa için maliyeti yazan bir düğmeye basman gerekir |
| Önce ucuz olan | Abone filtresi 1 birimlik veriyle yapılır; 2 birimlik analiz sadece kaydettiklerine uygulanır |

### Puanlama

Kural tabanlı, 0–100, yapay zekâ yok — [`src/lib/scoring/score.ts`](src/lib/scoring/score.ts):

- **35** izlenme/abone performansı
- **25** güncellik ve yayın sıklığı
- **20** ortalama ve medyan izlenme (medyan ağırlıklı, tek viral video puanı şişirmesin)
- **20** anahtar kelime uyumu

Her bileşen ayrı saklanır ve üretici sayfasında gösterilir, yani bir puan her zaman açıklanabilir.

**Yükselen** ayrı bir sinyaldir: oran ≥ 1.5×, son 45 günde aktif, medyanı ortalamasının ≥ %35'i ve ≤ 50 bin abone. Ortalama değil **medyan** üzerinden bakar — tek bir patlayan video kimseyi yükselen yapmaz.

Eksik veri cezalandırılmaz, nötr puanlanır. Gizli abone sayısı hiçbir kanalı elemez.

### İletişim

E-postası kayıtlı üreticinin satırında ve profilinde bir **gönder** düğmesi çıkar. Mesaj şablondan doldurulmuş halde açılır, düzenleyebilirsin; bağladığın Gmail hesabından (ya da yedek SMTP kutusundan) gider.

```
şablon + üretici → doldurulmuş önizleme → sen düzenlersin → gönder
                                                             ↓
                          outreach_messages kaydı · durum → iletişime geçildi
```

İşlerin ters gidebileceği kısım burası olduğu için kasıtlı kısıtlar var:

| Koruma | Davranış |
| --- | --- |
| Teker teker | Toplu gönderim yok. Her mesajı bir insan onaylar |
| Gördüğün gidiyor | Diyalog, ekranda duran metni gönderir — önizlemeden farklı olabilecek ikinci bir doldurma adımı yoktur |
| Boş değişken engeli | İzlenme verisi olmayan üreticiye "ortalama — izlenme" gidemez |
| Mükerrer engeli | Daha önce mail atılmış üreticiye yanlışlıkla ikinci kez atılamaz |
| Günlük sınır | `SMTP_DAILY_LIMIT`, her gönderimde kontrol edilir |
| Dürüst kayıt | Kayıt SMTP çağrısından **önce** yazılır; çökme olsa bile iz kalır. Başarısızlıklar sebebiyle birlikte saklanır |

E-posta adresleri **elle girilir** — uygulama adres tahmin etmez, aramaz, toplamaz. Kanalın herkese açık "Hakkında" sayfasından veya video açıklamasından bulup tabloda E-posta hücresine tıklayarak yapıştırırsın.

---

## 🧱 Mimari

```
src/
  app/
    api/
      discover/search        POST  bir arama çalıştır
      discover/runs          GET   geçmiş
      creators               GET   liste · POST adayları kaydet
      creators/[id]          GET   detay · PATCH e-posta/durum · DELETE
      creators/[id]/analyze  POST  son videoları çek ve incele
      quota                  GET   bugünkü kullanım
      outreach/send          POST  tek mail gönder
      outreach/status        GET   posta ayarı + gönderim kaydı
      mail/gmail/connect     GET   Google izin ekranına yönlendir
      mail/gmail/callback    GET   OAuth dönüşü, token'ları şifreleyip sakla
      mail/gmail             GET   bağlı hesap · POST test · DELETE kaldır
    (app)/                   giriş yapılmış ekranlar
  lib/
    db/        client.ts (bağlantı + şema), creators.ts, groups.ts, mail.ts, schema.sql
    youtube/   client.ts (tipli API + kota muhasebesi), discovery.ts
    outreach/  mailer.ts (Gmail ↔ SMTP yönlendirmesi)
               gmail.ts (OAuth2 + Gmail API), mime.ts (ham mesaj)
               render.ts (şablon değişkenleri, önizleme ve gönderim ortak)
    crypto.ts  (Gmail token'ları için AES-256-GCM)
    scoring/   metrics.ts (yerel hesap), score.ts (kurallar)
    i18n/      en.ts / tr.ts sözlükleri
```

YouTube anahtarı yalnızca `lib/youtube/client.ts` içinde, mail bilgileri yalnızca `lib/outreach/mailer.ts` içinde okunur. İkisi de sunucuda çalışır. Tarayıcı sadece `/api/*` ile konuşur.

**Veritabanı** (SQLite, yerel): `creators` · `creator_keywords` · `youtube_videos` · `discovery_runs` · `api_usage` · `creator_lists` · `list_members` · `campaigns` · `campaign_members` · `email_templates` · `outreach_messages`

Aynı kanalın iki kez kaydedilmesi `youtube_channel_id` üzerindeki `UNIQUE` indeksle engellenir. `schema.sql` her açılışta yeniden uygulanabilir olduğu için ayrı bir migration komutu yoktur.

---

## 🌍 Tema ve diller

Açık tema — bej zemin, açık mavi kartlar. Tüm renkler `src/app/globals.css` içinde CSS değişkeni.

**Türkçe ve İngilizce**, üst bardan anında değişir. `en.ts` referanstır, `tr.ts` ona karşı tip kontrolünden geçer — eksik bir anahtar derleme hatası verir.

Tarihler, göreli zamanlar, sayı gruplaması ve ülke adları da seçilen dile uyar.

---

## 📦 Sürümler

Bu repo düzenli güncellenecek. Her sürüm [Releases](../../releases) sayfasında etiketlenir.

| Sürüm | İçerik |
| --- | --- |
| **v1.0** | YouTube keşfi, kural tabanlı puanlama, yükselen sinyali, listeler/kampanyalar/şablonlar, elle e-posta girişi, SMTP ile tekil gönderim |

### Yol haritası

- Yanıt takibi (IMAP ya da sağlayıcı webhook'u)
- Takip maili dizileri
- TikTok / Instagram / Twitch keşfi
- Toplu gönderim — hız sınırı ve ısıtma mantığıyla
- Keşif sonuçlarını dışa aktarma

**Yapılmayacaklar:** scraping, CAPTCHA çözme, otomatik e-posta bulma/tahmin etme, satın alınmış liste kullanımı.

---

## 🎮 Kendi oyunun için kullanma

Chest Blade'e özgü tek şey [`src/lib/outreach/render.ts`](src/lib/outreach/render.ts) içindeki iki sabit (`GAME_NAME`, `STEAM_LINK`) ve `src/lib/i18n/` içindeki metinler. Onları değiştir, kendi anahtarını ve posta kutunu bağla, kendi kelimelerinle ara.

Fork'la, kur, boz, öğren. Sadece internete açık bir adrese koyma ve anahtarlarını commit etme.

---

## 🤝 Katkı

Issue ve pull request'ler açık. PR göndermeden önce:

```bash
npx tsc --noEmit   # tip kontrolü temiz olmalı
npm run build      # derlenmeli
```

Katkı gönderirken kendi `.env.local`, veritabanı dosyan veya gerçek üretici e-postalarının diff'e karışmadığından emin ol.

---

## 📄 Lisans

[MIT](LICENSE) — dilediğin gibi kullan.
