# Kurulum Rehberi

Creator Hub'ı kendi hesaplarınla çalıştırmak için gereken her şey. Bağlanacak iki
şey var — üretici bulmak için **YouTube API anahtarı**, onlara yazmak için bir
**SMTP posta kutusu**. İkisinin de ücretsiz seçeneği fazlasıyla yeterli.

Toplam süre: yaklaşık 15 dakika.

---

> [!WARNING]
> ### Önce bunu oku
>
> **Bu bir öğrenme/demo projesidir, üretim aracı değil.** Giriş sistemi sahte —
> *herhangi bir* e-posta ve şifre içeri alır. Yani çalışan uygulamaya erişebilen
> herkes onu kullanabilir.
>
> - **Kendi bilgisayarında çalıştır.** Bu haliyle internete açık bir adrese kurma.
> - **`.env.local` dosyasını asla commit etme.** İçinde API anahtarın ve mail
>   şifren var. Zaten `.gitignore`'da — öyle kalsın.
> - **Anahtarlarını asla paylaşma** — ekran görüntüsünde, videoda, hata
>   bildiriminde veya pull request'te. Biri sızarsa hemen iptal et
>   ([nasıl yapılır](#erişimi-iptal-etme)).
> - **Veritabanı senindir.** `data/` klasörü gitignore'da; topladığın üreticiler
>   ve e-posta adresleri bilgisayarında kalır, repoya gitmez.
> - **Gönderdiğin maillerden sen sorumlusun.** [Sorumlu gönderim](#4-sorumlu-gönderim).

---

## 1. Kurulum ve çalıştırma

**Node.js 18.18+** gerekir (20 veya üstü önerilir).

```bash
npm install
cp .env.example .env.local
npm run preview
```

<http://localhost:3000> adresini aç. Herhangi bir bilgiyle giriş yapabilirsin.

SQLite veritabanı ve tabloları ilk açılışta kendiliğinden oluşur. Migration
komutu yok, **kurulacak Supabase, Postgres veya Docker da yok** — tüm veritabanı
`data/creator-hub.db` adlı tek bir yerel dosya.

`.env.local` boşken de uygulama açılır; sadece arama yapamaz ve mail atamazsın.

---

## 2. YouTube Data API anahtarı

Ücretsiz. Google her projeye **günde 10.000 kota birimi** veriyor — yaklaşık 100
arama demek, kullanacağından çok daha fazlası.

### Adımlar

1. [Google Cloud Console](https://console.cloud.google.com/)'a gir.
2. Sol üstteki proje menüsü → **Yeni Proje** → bir isim ver → **Oluştur**.
3. **APIs & Services → Library** → *YouTube Data API v3* ara → **Enable**.
4. **APIs & Services → Credentials → Create credentials → API key**.
5. Anahtarı kopyala, sonra **Edit API key**'e tıkla:
   - **API restrictions** → *Restrict key* → **YouTube Data API v3**'ü işaretle.
   - **Application restrictions** → *None* bırak. Anahtar tarayıcıdan değil
     sunucudan kullanılıyor; HTTP referrer kısıtı koyarsan çalışmaz.
6. `.env.local` dosyasına yapıştır:

```env
YOUTUBE_API_KEY=AIza...senin-anahtarin
YOUTUBE_DAILY_QUOTA=10000
DATABASE_PATH=./data/creator-hub.db
```

7. Uygulamayı yeniden başlat.

### Maliyeti

| Çağrı | Birim | Ne zaman |
| --- | --- | --- |
| `search.list` | **100** | Her anahtar kelime aramasında bir kez |
| `channels.list` | 1 | İstek başına 50 kanal, toplu |
| `playlistItems.list` | 1 | Bir üreticiyi incelerken |
| `videos.list` | 1 | Bir üreticiyi incelerken |

Tipik bir arama ~101 birim, bir üreticiyi incelemek 2 birim tutar. Uygulama her
çağrıyı yanıtı kullanmadan **önce** `api_usage` tablosuna yazar — sayaç şaşmaz —
ve günlük sınırı aşacak aramayı baştan reddeder.

### Çalışmazsa

| Mesaj | Sebep |
| --- | --- |
| *"YouTube Data API v3 is not enabled for this API key"* | 3. adım atlanmış ya da 5. adımdaki kısıt bu API'yi içermiyor |
| *"quota exceeded"* | 10.000 birim bitmiş. Pasifik saatiyle gece yarısı sıfırlanır |
| Arama boş dönüyor | Anahtar kelime fazla dar ya da abone filtresi her şeyi eliyor |

---

## 3. Mail gönderimi (SMTP)

Uygulama **herhangi bir SMTP sunucusu** üzerinden gönderir — kendi mail servisi
yoktur, bir sağlayıcıya bağlı değildir. Aşağıdakilerden birini seçip ayarlarını
`.env.local`'a yaz.

### Seçenek A — Gmail (ücretsiz, domain gerekmez) ← *buradan başla*

Günde yaklaşık **500 alıcı**. Test ve küçük ölçekli iletişim için yeterli.

> İletişim için **ayrı bir Gmail hesabı** kullan, kişisel hesabını değil.
> Yanıtlar karışmaz ve bir sorun çıkarsa kişisel mailin etkilenmez.

**Adımlar**

1. Gönderim yapacağın Gmail hesabını aç.
2. 2 Adımlı Doğrulama'yı aç: <https://myaccount.google.com/signinoptions/twosv>
   — bu **zorunlu**, uygulama şifreleri 2FA olmadan hiç görünmez.
3. <https://myaccount.google.com/apppasswords> adresine git (URL'yi doğrudan aç —
   Google çoğu hesapta bu girişi Güvenlik menüsünden kaldırdı).
4. Bir isim ver (örn. *Creator Hub*) → **Oluştur**.
5. 16 haneli şifreyi kopyala. Google boşluklu gösterir; **boşlukları sil**.
6. `.env.local` dosyasına ekle:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=sen.iletisim@gmail.com
SMTP_PASS=abcdefghijklmnop
SMTP_FROM_NAME=Stüdyo Adın
SMTP_DAILY_LIMIT=450
```

7. Yeniden başlat, **İletişim → Bağlantıyı test et**'e bas.

**Uygulama şifreleri sayfası "kullanılamıyor" diyorsa** 2 Adımlı Doğrulama henüz
gerçekten açılmamıştır. Authenticator uygulaması eklemek 2FA'yı açmakla aynı şey
değildir — önce 2. adımı bitir.

### Seçenek B — Gerçek bir gönderim sağlayıcısı (ücretsiz katman, domain ister)

Birkaç kişiden fazlasına yazmaya başlayınca mailin spam'e düşmemesi için daha
iyi. Hepsi aynı değişkenlere yazacağın SMTP bilgisi verir.

| Sağlayıcı | Ücretsiz | Not |
| --- | --- | --- |
| **Brevo** | ~300/gün | Kart istemiyor, cömert, kolay |
| Mailjet | ~200/gün | |
| Resend | ~100/gün | En temiz geliştirici deneyimi |
| MailerSend | ~3.000/ay | |

*Ücretsiz limitler değişebiliyor — kayıt olurken güncel değerleri kontrol et.*

Bunlar sahip olduğun bir domaini doğrulamanı ve **SPF**, **DKIM**, **DMARC** DNS
kayıtlarını eklemeni ister. Zaten olay bu: mailinin spam'e düşmesini engelleyen
şey o kayıtlar.

### Seçenek C — Ethereal (ücretsiz, geliştirme için)

Maili **iletmek yerine yakalayan** sahte bir SMTP sunucusu, sana bir önizleme
linki veriyor. Geliştirirken mükemmel — hesap açmana gerek yok, yanlışlıkla
gerçek birine mail gitme riski yok.

```bash
node -e "require('nodemailer').createTestAccount().then(a=>console.log(a))"
```

Dönen host, user ve pass değerlerini `.env.local`'a yaz.

### Önerilmeyenler

- **Outlook / Hotmail kişisel hesaplar** — Microsoft basic-auth SMTP'yi kapattı,
  OAuth istiyor; kurulumu çok daha zahmetli.
- **Kendi mail sunucun** (Postal, Mailcow) — açık kaynak, ama ev veya ucuz VPS
  IP'sinden gönderilen mail hemen her yerde engelleniyor ya da spam'e düşüyor.

---

## 4. Sorumlu gönderim

Uygulama toplu mail atmayı bilerek zorlaştırıyor: teker teker gönderim, her
mesajı bir insanın onaylaması ve günlük sınır.

- **Isıt.** Yeni açılmış bir gönderim adresi günde 10–20 mailden başlamalı ve
  yavaş yükselmeli. İlk gün 200 mail atmak spam klasörüne giden en kısa yol.
- **Kişiselleştir.** `{{değişkenler}}` her mesajın gerçekten o üreticiyle ilgili
  olması için var. Şablon olduğu belli olan bir mail okunmadan silinir.
- **Çıkış yolu bırak.** Rahatsız olmak istemeyenlerin ne yapacağını yaz.
- **Yasaya uy.** Ticari e-posta düzenlenmiş bir alan — AB'de GDPR, ABD'de
  CAN-SPAM, Türkiye'de 6563 sayılı kanun ve *İleti Yönetim Sistemi* (İYS).
  Herkese açık bir iş adresine yapılan B2B iletişim genelde kabul görür, ama
  kendi durumun için kuralları kontrol etmek sana düşer.
- **Sadece üreticinin iş için yayınladığı adresleri kullan.** Adres toplama,
  tahmin etme veya satın alma.

---

## 5. Ortam değişkenleri

| Değişken | Zorunlu | Varsayılan | Ne yapar |
| --- | --- | --- | --- |
| `YOUTUBE_API_KEY` | arama için | — | YouTube Data API v3 anahtarı. **Sadece sunucuda** |
| `YOUTUBE_DAILY_QUOTA` | hayır | `10000` | Uygulamanın aşmayı reddettiği günlük birim |
| `DATABASE_PATH` | hayır | `./data/creator-hub.db` | SQLite dosyasının yeri |
| `SMTP_HOST` | gönderim için | — | örn. `smtp.gmail.com` |
| `SMTP_PORT` | hayır | `587` | `587` STARTTLS, `465` doğrudan TLS |
| `SMTP_USER` | gönderim için | — | Posta kutusu kullanıcısı, genelde adresin |
| `SMTP_PASS` | gönderim için | — | Uygulama şifresi — **asla** hesap şifren |
| `SMTP_FROM_NAME` | hayır | `Chest Blade` | Mailde görünen gönderen adı |
| `SMTP_FROM_EMAIL` | hayır | `SMTP_USER` | Çoğu sağlayıcı farklı bir From'u reddeder |
| `SMTP_DAILY_LIMIT` | hayır | `500` | Günde gönderilecek mail sınırı |

**Hiçbirinin başına `NEXT_PUBLIC_` koyma.** O önek değeri tarayıcıya taşır, yani
anahtarını ve mail şifreni siteye giren herkese açar. Uygulama sırları yalnızca
sunucu kodunda okur (`lib/youtube/client.ts` ve `lib/outreach/mailer.ts`).

---

## Erişimi iptal etme

Bir anahtar veya şifre sızarsa — ekran görüntüsü, video, yanlışlıkla atılmış
commit:

- **YouTube anahtarı** — Cloud Console → *APIs & Services → Credentials* →
  anahtarı sil, yenisini oluştur.
- **Gmail uygulama şifresi** — <https://myaccount.google.com/apppasswords> →
  kaldır. Anında çalışmaz olur, hesap şifren etkilenmez.

İptal etmek anlık ve ücretsiz. Önce iptal et, sonra düşün.

---

## Bu proje neleri yapmaz

Scraping yok. CAPTCHA çözme yok. Otomatik e-posta bulma yok. Yapay zekâ
puanlama yok. Satın alınmış liste yok. Arka plan görevi veya zamanlayıcı yok.

Üretici e-postalarını bir insan girer — kanalın herkese açık "Hakkında"
sayfasından ya da video açıklamasından bulur, E-posta sütununa yapıştırırsın.
