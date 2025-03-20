# Güvenli Fotoğraf Yükleme Sistemi v1.0.1

## Proje Hakkında

Bu proje, RCE (Remote Code Execution) güvenlik açıklarına karşı korumalı, güvenli bir fotoğraf yükleme sistemi sağlamak amacıyla geliştirilmiştir. Modern web uygulamalarında dosya yükleme işlemleri, potansiyel güvenlik riskleri taşıdığından, bu sistem çeşitli güvenlik önlemleri ile bu riskleri en aza indirmeyi hedeflemektedir.

## Özellikler

- **Güvenli Dosya Yükleme**: Çeşitli güvenlik kontrolleri ile zararlı dosyaların yüklenmesini engeller
- **Dosya Türü Doğrulama**: Magic bytes kontrolü ile dosya içeriğinin gerçekten bir resim olduğunu doğrular
- **Metadata Temizleme**: Yüklenen resimlerdeki potansiyel tehlikeli metadata bilgilerini temizler
- **SVG Sanitizasyonu**: SVG dosyalarındaki XSS açıklarını önlemek için içeriği temizler
- **Dosya Boyutu Sınırlaması**: DoS saldırılarını önlemek için dosya boyutunu sınırlar (10MB)
- **Benzersiz Dosya Adları**: UUID kullanarak dosya adı çakışmalarını ve path traversal saldırılarını önler
- **Rate Limiting**: Kısa sürede çok fazla istek yapılmasını engelleyerek DoS saldırılarına karşı koruma sağlar
- **Güvenli HTTP Başlıkları**: Helmet kütüphanesi ile XSS, clickjacking gibi saldırılara karşı koruma sağlar

## Güvenlik Önlemleri

1. **Dosya İçerik Analizi**: Magic bytes kontrolü ile dosyanın gerçek türünü doğrular
2. **Dosya Uzantısı ve MIME Tipi Kontrolü**: Sadece izin verilen dosya türlerine izin verir
3. **Metadata Temizleme**: EXIF verileri gibi potansiyel tehlikeli bilgileri temizler
4. **SVG Güvenliği**: SVG dosyalarındaki script ve event attribute'larını kaldırır
5. **Dosya Adı Sanitizasyonu**: Path traversal saldırılarını önlemek için dosya adlarını temizler
6. **Geçici Dosya Yönetimi**: Güvenli geçici dosya dizini kullanarak bellek tüketimini azaltır
7. **Rate Limiting**: DoS saldırılarına karşı koruma sağlar
8. **Content-Type Doğrulama**: İstek başlığının doğru formatta olmasını sağlar



## Güvenlik Testleri ve Sonuçları

Sistem üzerinde 5 farklı güvenlik testi gerçekleştirildi ve tüm testler başarıyla tamamlandı.

### 1. Content-Type Manipülasyonu Testi
**Amaç:** Content-Type başlığını değiştirerek güvenlik kontrollerini bypass etmeye çalışmak
**Sonuç:** ✅ BAŞARILI (Güvenlik Önlemi Çalışıyor)
- Sistem yanlış Content-Type ile gelen istekleri reddetti
- Sadece geçerli resim MIME türlerine izin verildi

### 2. Magic Bytes Manipülasyonu Testi
**Amaç:** JavaScript dosyasını PNG magic bytes ile maskeleyerek yüklemeye çalışmak
**Sonuç:** ✅ BAŞARILI (Güvenlik Önlemi Çalışıyor)
- Sistem dosya içeriğini doğru şekilde analiz etti
- Sahte magic bytes ile yapılan saldırı engellendi

### 3. SVG XSS Testi
**Amaç:** SVG dosyası içine zararlı JavaScript kodu yerleştirme denemesi
**Sonuç:** ✅ BAŞARILI (Güvenlik Önlemi Çalışıyor)
- SVG içindeki script etiketleri başarıyla temizlendi
- XSS payload'ı etkisiz hale getirildi

### 4. Path Traversal Testi
**Amaç:** "../../../etc/passwd.jpg" gibi path traversal içeren dosya adları ile saldırı
**Sonuç:** ✅ BAŞARILI (Güvenlik Önlemi Çalışıyor)
- Tehlikeli karakterler dosya adından temizlendi
- Dizin gezinme girişimleri engellendi

### 5. DoS Koruması Testi
**Amaç:** 15MB boyutunda dosya yükleyerek boyut sınırını test etme
**Sonuç:** ✅ BAŞARILI (Güvenlik Önlemi Çalışıyor)
- 10MB üzerindeki dosyalar reddedildi
- Sistem kaynak tüketimi kontrol altında tutuldu

### Test Özeti
- **Toplam Test Sayısı:** 5
- **Başarılı Güvenlik Önlemi:** 5
- **Tespit Edilen Güvenlik Açığı:** 0



## Kurulum

### Gereksinimler

- Node.js (v14 veya üzeri)
- npm (v6 veya üzeri)

### Adımlar

1. Projeyi klonlayın veya indirin
2. Proje dizinine gidin: `cd fileup`
3. Bağımlılıkları yükleyin: `npm install`
4. Uygulamayı başlatın: `npm start`
5. Tarayıcınızda `http://localhost:3000` adresine gidin

## Kullanım

1. Ana sayfada "Fotoğrafı buraya sürükleyin veya seçmek için tıklayın" alanına tıklayın veya bir resim dosyasını sürükleyin
2. Seçilen dosyanın bilgileri görüntülenecektir (dosya adı, boyutu, türü)
3. "Yükle" düğmesine tıklayarak dosyayı yükleyin
4. Yükleme başarılı olursa, yüklenen resim görüntülenecektir

## Teknik Detaylar

### Kullanılan Teknolojiler

- **Express.js**: Web sunucu çerçevesi
- **express-fileupload**: Dosya yükleme middleware'i
- **file-type**: Magic bytes ile dosya türü doğrulama
- **sharp**: Resim işleme ve metadata temizleme
- **helmet**: HTTP başlıklarını güvenli hale getirme
- **dompurify & jsdom**: SVG sanitizasyonu için XSS koruması
- **svgo**: SVG optimizasyonu ve temizleme
- **express-rate-limit**: DoS saldırılarına karşı koruma
- **uuid**: Benzersiz dosya adları oluşturma
- **mime-types**: MIME türlerini doğrulama
- **sanitize-filename**: Dosya adlarını temizleme

### Dosya İşleme Süreci

1. Dosya yükleme isteği alınır ve Content-Type doğrulanır
2. Dosya boyutu kontrol edilir (10MB sınırı)
3. Magic bytes kontrolü ile dosya türü doğrulanır
4. Dosya uzantısı ve MIME tipi kontrol edilir
5. Dosya adı sanitize edilir ve benzersiz bir UUID ile yeniden adlandırılır
6. Dosya türüne göre özel işlemler uygulanır:
   - JPEG/PNG/GIF/WebP: Metadata temizlenir
   - SVG: İçerik sanitize edilir ve optimize edilir
7. İşlenmiş dosya uploads dizinine kaydedilir
8. Başarılı yanıt döndürülür

## Gelecek Geliştirmeler

> **Not**: Bu proje halen geliştirilme aşamasındadır ve aşağıdaki özellikler ilerleyen versiyonlarda eklenecektir.

- **Kullanıcı Kimlik Doğrulama**: Oturum yönetimi ve kullanıcı bazlı dosya yükleme
- **Dosya Şifreleme**: Yüklenen dosyaların şifrelenerek saklanması
- **Bulut Depolama Entegrasyonu**: AWS S3, Google Cloud Storage gibi servislere entegrasyon
- **Resim Boyutlandırma Seçenekleri**: Yüklenen resimlerin otomatik boyutlandırılması
- **Önizleme Oluşturma**: Yüklenen resimler için önizleme oluşturma
- **Gelişmiş Raporlama**: Yükleme işlemleri ve güvenlik olayları için detaylı raporlama
- **Çoklu Dosya Yükleme**: Birden fazla dosyanın aynı anda yüklenebilmesi
- **Sürükle-Bırak Arayüzü İyileştirmeleri**: Daha gelişmiş bir kullanıcı deneyimi
- **Mobil Uyumluluk**: Mobil cihazlar için optimize edilmiş arayüz

## Sürüm Geçmişi

### v1.0.1 (Güvenlik Güncellemesi - (20-03-2025)
- SVG dosyalarında XSS güvenlik açığı giderildi
- SVG sanitizasyon sistemi güçlendirildi
- Base64 kodlu içerik kontrolü geliştirildi
- DOMPurify ve SVGO konfigürasyonları optimize edildi
- SVG güvenlik filtreleri güncellendi
- Dosya yükleme güvenlik kontrolleri sıkılaştırıldı


### v1.0.0 (Mevcut Sürüm - Kararlı)
- İlk kararlı sürüm yayınlandı
- Tüm güvenlik önlemleri tam olarak implemente edildi
- Dosya içerik analizi (Magic bytes) ile dosya türü doğrulama sistemi eklendi
- SVG sanitizasyonu ve optimizasyonu tamamlandı
- Rate limiting sistemi eklendi (DoS koruması)
- Helmet kütüphanesi ile HTTP başlıkları güvenliği sağlandı
- Metadata temizleme sistemi optimize edildi
- Kapsamlı hata yakalama ve loglama sistemi eklendi
- Kullanıcı arayüzü iyileştirmeleri tamamlandı

### v0.9.0 (Beta)
- Gelişmiş dosya yükleme işlevselliği
- UUID ile benzersiz dosya adlandırma sistemi eklendi
- Dosya boyutu sınırlaması (10MB) eklendi
- Geçici dosya yönetimi iyileştirildi
- SVG dosyaları için temel güvenlik kontrolleri eklendi
- Arayüz geliştirmeleri ve kullanıcı deneyimi iyileştirmeleri
- Hata mesajları ve bildirimler geliştirildi

### v0.8.0 (Beta)
- MIME tipi ve dosya uzantısı doğrulama sistemi geliştirildi
- Content-Type doğrulama middleware'i eklendi
- Dosya adı sanitizasyonu eklendi (path traversal koruması)
- Yükleme sonrası dosya görüntüleme özelliği eklendi
- Arayüz iyileştirmeleri ve responsive tasarım düzenlemeleri

### v0.7.0 (Beta)
- Sharp kütüphanesi ile metadata temizleme eklendi
- EXIF verilerinin otomatik temizlenmesi sağlandı
- Dosya türüne göre özel işleme mantığı eklendi
- Hata yakalama ve raporlama sistemi geliştirildi
- Temel güvenlik testleri yapıldı ve iyileştirmeler uygulandı

### v0.6.0 (Alpha)
- DOMPurify ve JSDOM ile SVG sanitizasyonu eklendi
- SVGO ile SVG optimizasyonu eklendi
- Helmet kütüphanesi entegrasyonu başlatıldı
- Express-rate-limit ile DoS koruması eklendi
- Güvenli geçici dosya dizini yapılandırması eklendi

### v0.5.0 (Alpha)
- Proje yapısı oluşturuldu
- Express sunucu kurulumu tamamlandı
- Express-fileupload middleware'i entegre edildi
- Temel dosya yükleme işlevselliği eklendi
- Basit web arayüzü tasarlandı

## Katkıda Bulunma

Projeye katkıda bulunmak isterseniz, lütfen önce umut-cara@hotmail.com adresine e-posta göndererek iletişime geçin. Önerileriniz, hata raporlarınız ve pull request'leriniz memnuniyetle karşılanacaktır.

## İletişim

Proje ile ilgili sorularınız, önerileriniz veya geri bildirimleriniz için lütfen umut-cara@hotmail.com adresine e-posta gönderin.

## Lisans

Bu proje MIT lisansı altında lisanslanmıştır. Daha fazla bilgi için proje dizinindeki LICENSE dosyasına bakın.
