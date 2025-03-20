/**
 * Güvenli Fotoğraf Yükleme Sistemi
 * Bu uygulama, RCE (Remote Code Execution) güvenlik açıklarına karşı korumalı
 * bir fotoğraf yükleme sistemi sağlar.
 */

// Express ve temel modüller
const express = require('express'); // Web sunucu çerçevesi
const fileUpload = require('express-fileupload'); // Dosya yükleme middleware'i
const path = require('path'); // Dosya yolu işlemleri için
const fs = require('fs'); // Dosya sistemi işlemleri için
const { v4: uuidv4 } = require('uuid'); // Benzersiz dosya adları oluşturmak için

// Güvenlik modülleri
const helmet = require('helmet'); // HTTP başlıklarını güvenli hale getirmek için
const sanitize = require('sanitize-filename'); // Dosya adlarını temizlemek için
const rateLimit = require('express-rate-limit'); // DoS saldırılarına karşı koruma
const mime = require('mime-types'); // MIME türlerini doğrulamak için

// Dosya türü doğrulama ve işleme modülleri
// file-type v16.5.4 için doğru import şekli
const fileType = require('file-type'); // Dosya türünü magic bytes ile doğrulamak için
const sharp = require('sharp'); // Resim işleme ve metadata temizleme için

// SVG sanitizasyonu için gerekli kütüphaneler
const { JSDOM } = require('jsdom'); // DOM manipülasyonu için
const createDOMPurify = require('dompurify'); // XSS koruması için
const { optimize } = require('svgo'); // SVG optimizasyonu için

// DOMPurify için JSDOM window nesnesi oluştur
// XSS saldırılarına karşı koruma sağlamak için sanal bir DOM ortamı oluşturuyoruz
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// DOMPurify için özel konfigürasyon
// SVG dosyalarındaki tehlikeli özellikleri ve base64 içeriğini temizlemek için
const domPurifyConfig = {
  USE_PROFILES: { svg: true, svgFilters: true },
  // Tehlikeli tag'leri engelle - image tag'i özellikle base64 içerik için kullanılabilir
  FORBID_TAGS: [
    'script', 'iframe', 'object', 'embed', 'foreignObject', 'image', 'use', 'a', 'animate', 'animateTransform', 'set',
    // Ek olarak potansiyel tehlikeli SVG elementleri
    'feImage', 'pattern', 'symbol', 'mask', 'clipPath', 'marker', 'filter', 'view'
  ],
  // Tehlikeli özellikleri engelle - xlink:href ve href özellikle base64 içerik için kullanılabilir
  FORBID_ATTR: [
    // Event handler'lar
    'onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousemove', 'onmousedown', 'onmouseup',
    'onkeydown', 'onkeypress', 'onkeyup', 'onfocus', 'onblur', 'onchange', 'onsubmit', 'onreset', 'onselect',
    'eval', 'function',
    // URL ve data özellikleri
    'xlink:href', 'href', 'data', 'src', 'from', 'to', 'values', 'by',
    // Form özellikleri
    'formaction', 'form', 'poster',
    // Görsel özellikleri
    'background', 'dynsrc', 'lowsrc', 'style',
    // Diğer tehlikeli özellikler
    'ping', 'action', 'profile',
    'data-*', // Tüm data-* özelliklerini engelle
    'encoding', 'method',
    'attributeName', 'begin', 'dur', 'repeatCount', 'in', 'result',
    // Ek olarak potansiyel tehlikeli SVG özellikleri
    'externalResourcesRequired', 'requiredExtensions', 'systemLanguage',
    'color-interpolation', 'color-rendering', 'fill', 'fill-opacity', 'fill-rule',
    'filter', 'mask', 'opacity', 'stroke', 'stroke-dasharray', 'stroke-dashoffset',
    'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-opacity', 'stroke-width'
  ],
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  FORCE_BODY: true,
  SANITIZE_DOM: true,
  WHOLE_DOCUMENT: true,
  ADD_URI_SAFE_ATTR: [], // Güvenli URI özelliklerini ekleme
  ADD_DATA_URI_TAGS: [], // Data URI'lere izin verilen tag'leri ekleme
  RETURN_DOM: false,      // DOM nesnesi yerine string döndür
  RETURN_DOM_FRAGMENT: false, // DOM fragment yerine string döndür
  RETURN_TRUSTED_TYPE: false  // Trusted Types kullanma
};

// SVG optimizasyon ve sanitizasyon ayarları
// SVG dosyalarındaki potansiyel tehlikeli içerikleri temizlemek için kullanılır
const svgoConfig = {
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          removeScriptElements: true,
          removeOnEventAttributes: true,
          removeHiddenElems: true,
          removeMetadata: true,
          removeXMLProcInst: true,
          removeComments: true,
          removeDoctype: true,
          removeDesc: true,
          removeEditorsNSData: true,
          removeEmptyAttrs: true,
          removeEmptyText: true,
          removeEmptyContainers: true,
          removeUnknownsAndDefaults: true,
          removeUselessDefs: true,
          cleanupIDs: true,
          cleanupNumericValues: true,
          cleanupListOfValues: true,
          convertStyleToAttrs: false,
          removeNonInheritableGroupAttrs: true,
          removeUselessStrokeAndFill: true,
          removeUnusedNS: true,
          cleanupEnableBackground: true,
          removeHiddenElems: true,
          removeEmptyText: true,
          convertShapeToPath: true,
          moveElemsAttrsToGroup: true,
          moveGroupAttrsToElems: true,
          collapseGroups: true,
          convertPathData: true
        }
      }
    },
    {
      name: 'removeAttrs',
      params: {
        attrs: [
          'data.*',
          'style',
          'fill.*',
          'stroke.*',
          'filter',
          'clip.*',
          'mask',
          'marker.*',
          'enable-background',
          'opacity'
        ]
      }
    }
  ],
  multipass: true
};

// Express uygulaması oluştur ve port ayarla
const app = express();
const PORT = process.env.PORT || 3000;

// Güvenlik başlıkları
// Helmet, HTTP başlıklarını güvenli hale getirerek XSS, clickjacking gibi saldırılara karşı koruma sağlar
app.use(helmet());

// Rate limiting - DoS saldırılarına karşı koruma
// Belirli bir süre içinde yapılabilecek istek sayısını sınırlayarak Denial of Service saldırılarını engeller
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika zaman penceresi
  max: 50, // IP başına 15 dakikada maksimum 50 istek
  message: { error: 'Çok fazla istek gönderdiniz, lütfen daha sonra tekrar deneyin.' }
});

// Dosya yükleme yolları için rate limiting uygula
// Özellikle dosya yükleme gibi kaynak yoğun işlemlerde rate limiting kritik önem taşır
app.use('/upload', limiter);

// Statik dosyaları sunma
// HTML, CSS, JavaScript gibi istemci tarafı dosyaları public klasöründen sunuyoruz
app.use(express.static(path.join(__dirname, 'public')));

// Yüklenen dosyaları saklamak için uploads klasörü oluştur
// Uygulama başlatıldığında uploads dizininin varlığını kontrol eder ve yoksa oluşturur
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Güvenli geçici dosya dizini oluştur
// Dosya yükleme işlemi sırasında kullanılacak geçici dosyalar için güvenli bir dizin oluşturur
// Bu, dosya işleme sırasında oluşabilecek güvenlik risklerini azaltır
const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Dosya yükleme middleware'i
// express-fileupload modülü ile dosya yükleme işlemlerini yönetiyoruz
// Çeşitli güvenlik önlemleri ve sınırlamalar burada tanımlanır
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // Maksimum dosya boyutu: 10MB
  abortOnLimit: true,                     // Boyut sınırı aşıldığında işlemi iptal et
  useTempFiles: true,                     // Geçici dosya kullanımını etkinleştir (bellek tüketimini azaltır)
  tempFileDir: tempDir,                   // Güvenli geçici dizin tanımla
  debug: false,                           // Hata ayıklama modunu kapat
  safeFileNames: true,                    // Dosya adlarını güvenli hale getir
  preserveExtension: true,                // Dosya uzantısını koru
  parseNested: true                       // İç içe form verilerini doğru şekilde ayrıştır
}));

// İzin verilen MIME tipleri
// Sadece bu listedeki dosya türlerine izin verilir, diğerleri reddedilir
// Bu, zararlı dosya yüklemelerini engellemek için önemli bir güvenlik önlemidir
const allowedMimeTypes = [
  'image/jpeg',  // JPEG resim dosyaları
  'image/png',   // PNG resim dosyaları
  'image/gif',   // GIF resim dosyaları
  'image/webp',  // WebP resim dosyaları
  'image/svg+xml' // SVG vektör grafik dosyaları
];

// İzin verilen dosya uzantıları
// Dosya adı doğrulaması için kullanılır, MIME tipi doğrulamasını tamamlar
const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];

// Content-Type doğrulama middleware'i
// İstek başlığındaki Content-Type'ın multipart/form-data olduğunu doğrular
// Bu, dosya yükleme isteklerinin doğru formatta olmasını sağlar ve yanlış istekleri engeller
const validateContentType = (req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  if (!contentType.includes('multipart/form-data')) {
    return res.status(400).json({ error: 'Geçersiz Content-Type. multipart/form-data olmalıdır' });
  }
  next();
};

// Dosya yükleme endpoint'i
// Bu endpoint, istemciden gelen dosya yükleme isteklerini işler
// Çeşitli güvenlik kontrolleri uygulayarak güvenli bir şekilde dosyaları kabul eder
app.post('/upload', validateContentType, async (req, res) => {
  try {
    // Dosya kontrolü
    // İstek içinde dosya olup olmadığını kontrol eder
    // Dosya yoksa veya 'image' alanında bir dosya yoksa hata döndürür
    if (!req.files || Object.keys(req.files).length === 0 || !req.files.image) {
      return res.status(400).json({ error: 'Yüklenecek dosya bulunamadı' });
    }

    const uploadedFile = req.files.image;
    
    // 1. Dosya boyutu kontrolü (10MB)
    // Büyük dosyaların yüklenmesini engeller, bu DoS saldırılarına karşı koruma sağlar
    // ve sunucu kaynaklarının tükenmesini önler
    if (uploadedFile.size > 10 * 1024 * 1024) {
      return res.status(400).json({ error: 'Dosya boyutu 10MB\'dan küçük olmalıdır' });
    }

    // 2. Dosya içeriği analizi (Magic bytes kontrolü)
    // Dosyanın gerçek içeriğini analiz ederek dosya türünü doğrular
    // Bu, dosya uzantısı değiştirilmiş zararlı dosyaları tespit etmek için önemlidir
    let fileBuffer;
    
    // useTempFiles: true olduğunda data yerine tempFilePath kullanılır
    // Geçici dosya kullanımı, büyük dosyaları belleğe yüklemeden işlemeyi sağlar
    if (uploadedFile.tempFilePath) {
      try {
        fileBuffer = fs.readFileSync(uploadedFile.tempFilePath);
        console.log('Dosya geçici dosyadan okundu:', uploadedFile.tempFilePath);
      } catch (err) {
        console.error('Geçici dosya okuma hatası:', err);
        return res.status(400).json({ error: 'Dosya okunamadı' });
      }
    } else {
      fileBuffer = uploadedFile.data;
    }
    
    console.log('Dosya analizi başlıyor:', uploadedFile.name, uploadedFile.mimetype);
    console.log('Dosya buffer tipi:', typeof fileBuffer, fileBuffer ? 'Dolu' : 'Boş');
    console.log('Dosya buffer boyutu:', fileBuffer ? fileBuffer.length : 0, 'bytes');
    
    // file-type v16.5.4 için doğru kullanım şekli
    let fileTypeResult;
    try {
      fileTypeResult = await fileType.fromBuffer(fileBuffer);
      console.log('fileType sonucu:', fileTypeResult);
      
      // fileTypeResult undefined ise dosya türünü alternatif yöntemlerle doğrula
      // Bazı dosya türleri için fileType kütüphanesi sonuç döndürmeyebilir, bu durumda alternatif kontroller yapılır
      if (!fileTypeResult) {
        console.log('fileType sonucu undefined, alternatif doğrulama yapılıyor...');
        
        // SVG dosyası kontrolü
        // SVG dosyaları metin tabanlı olduğu için içeriğini kontrol ederek doğrulama yapıyoruz
        if (uploadedFile.mimetype === 'image/svg+xml') {
          const svgContent = fileBuffer.toString('utf8');
          if (svgContent.includes('<svg') && svgContent.includes('</svg>')) {
            fileTypeResult = { mime: 'image/svg+xml' };
            console.log('SVG içerik doğrulaması başarılı');
          } else {
            return res.status(400).json({ error: 'Geçersiz SVG dosyası' });
          }
        }
        // PNG dosyası kontrolü - PNG magic bytes: 89 50 4E 47 0D 0A 1A 0A
        // PNG dosyaları için dosya başlığındaki magic bytes değerlerini kontrol ederek doğrulama yapıyoruz
        // Bu, dosya uzantısı değiştirilmiş zararlı dosyaları tespit etmek için önemli bir güvenlik önlemidir
        else if (uploadedFile.mimetype === 'image/png' && fileBuffer.length > 8) {
          const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
          let isPng = true;
          for (let i = 0; i < 8; i++) {
            if (fileBuffer[i] !== pngSignature[i]) {
              isPng = false;
              break;
            }
          }
          
          if (isPng) {
            console.log('PNG dosyası magic bytes doğrulaması başarılı');
            fileTypeResult = { mime: 'image/png' };
          } else {
            console.log('PNG dosyası magic bytes doğrulaması başarısız');
            return res.status(400).json({ error: 'Geçersiz PNG dosyası' });
          }
        }
        // Diğer resim formatları için MIME tipine güven
        // Bazı dosya formatları için özel kontroller yapılamıyorsa, MIME tipine göre kabul ediyoruz
        // Ancak bu, diğer güvenlik kontrolleriyle birlikte kullanılmalıdır
        else if (allowedMimeTypes.includes(uploadedFile.mimetype)) {
          console.log('MIME tipine göre dosya kabul edildi:', uploadedFile.mimetype);
          fileTypeResult = { mime: uploadedFile.mimetype };
        } else {
          return res.status(400).json({ error: 'Dosya türü belirlenemedi' });
        }
      }
    } catch (err) {
      console.error('fileType hatası:', err);
      // Hata durumunda güvenlik nedeniyle işlemi sonlandır
      return res.status(400).json({ error: 'Dosya türü doğrulanamadı' });
    }
    
    // Dosya türü sonucunu kontrol et ve izin verilen MIME tiplerinden biri olup olmadığını doğrula
    // Bu kontrol, dosya içeriğinin gerçekten izin verilen bir resim formatı olduğunu garantiler
    if (!fileTypeResult || !allowedMimeTypes.includes(fileTypeResult.mime)) {
      console.log('Geçersiz dosya türü tespit edildi:', fileTypeResult ? fileTypeResult.mime : 'bilinmiyor');
      // Eğer fileTypeResult undefined ise ve dosya MIME tipi izin verilen tiplerden biriyse, devam et
      // Bu, bazı dosya formatları için fileType kütüphanesinin sonuç döndürmediği durumlarda bir yedek mekanizma sağlar
      if (!fileTypeResult && allowedMimeTypes.includes(uploadedFile.mimetype)) {
        console.log('Dosya MIME tipi kabul edildi:', uploadedFile.mimetype);
        fileTypeResult = { mime: uploadedFile.mimetype };
      } else {
        return res.status(400).json({ error: 'Geçersiz dosya türü. Sadece resim dosyaları kabul edilmektedir' });
      }
    }

    // 3. MIME tipi kontrolü
    // Tespit edilen MIME tipinin izin verilen türlerden biri olduğunu bir kez daha doğruluyoruz
    // Bu, güvenlik için çoklu doğrulama katmanı sağlar
    const detectedMimeType = fileTypeResult.mime;
    if (!allowedMimeTypes.includes(detectedMimeType)) {
      return res.status(400).json({ error: 'Geçersiz dosya türü. Sadece resim dosyaları kabul edilmektedir' });
    }

    // 4. Dosya uzantısı kontrolü
    // Dosya uzantısının izin verilen uzantılardan biri olduğunu kontrol eder
    // Bu, dosya adı manipülasyonu ile yapılabilecek saldırılara karşı koruma sağlar
    const fileExtension = path.extname(uploadedFile.name).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return res.status(400).json({ error: 'Geçersiz dosya uzantısı' });
    }

    // 5. MIME tipi ve uzantı uyuşmazlığı kontrolü
    // Dosya uzantısına göre beklenen MIME tipi ile gerçek MIME tipinin uyuşup uyuşmadığını kontrol eder
    // Bu, dosya uzantısı değiştirilmiş zararlı dosyaları tespit etmek için önemli bir güvenlik önlemidir
    const expectedMimeType = mime.lookup(fileExtension);
    if (expectedMimeType && expectedMimeType !== detectedMimeType) {
      return res.status(400).json({ error: 'Dosya uzantısı ve içeriği uyuşmuyor' });
    }

    // 6. Güvenli dosya adı oluşturma
    // Dosya adını sanitize ederek zararlı karakterleri temizler ve benzersiz bir isim oluşturur
    // Bu, dosya adı manipülasyonu ve çakışma sorunlarını önler
    const sanitizedFileName = sanitize(uploadedFile.name);
    const uniqueFileName = `${uuidv4()}${path.extname(sanitizedFileName)}`;
    // Path traversal saldırılarına karşı normalize et
    const filePath = path.normalize(path.join(uploadsDir, uniqueFileName));
    
    // Path traversal kontrolü - dosya yolunun uploads dizini içinde olduğunu doğrula
    // Bu, '../' gibi yol manipülasyonları ile yapılabilecek saldırılara karşı koruma sağlar
    if (!filePath.startsWith(uploadsDir)) {
      return res.status(400).json({ error: 'Geçersiz dosya yolu' });
    }

    // 7. Resim işleme ve metadata temizleme
    // Resim dosyalarındaki metadata, konum bilgisi, kamera modeli gibi hassas bilgiler içerebilir
    // Bu bilgileri temizlemek, kullanıcı gizliliği ve güvenliği için önemlidir
    if (detectedMimeType !== 'image/svg+xml') {
      try {
        // Dosya verilerini kontrol et
        if (!fileBuffer || fileBuffer.length === 0) {
          console.error('Dosya verisi boş');
          return res.status(400).json({ error: 'Dosya verisi boş veya geçersiz' });
        }
        
        console.log('Dosya boyutu:', fileBuffer.length, 'bytes');
        
        // Resmi işle ve metadata'yı temizle
        // Sharp kütüphanesi ile resmi işleyerek tüm metadata bilgilerini kaldırıyoruz
        // Bu, EXIF verileri gibi potansiyel olarak hassas bilgileri temizler
        await sharp(fileBuffer)
          .withMetadata(false) // Tüm metadata'yı kaldır
          .toFile(filePath);
      } catch (err) {
        console.error('Resim işleme hatası:', err);
        // Hata durumunda işlemi sonlandır, dosyayı kaydetme
        return res.status(500).json({ error: 'Resim işlenirken bir hata oluştu' });
      }
    } else {
      try {
        // SVG içeriğini kontrol et ve base64 içeriğini engelle
        const svgContent = fileBuffer.toString('utf8');
        
        // Base64 içeriği ve data URI'leri daha kapsamlı kontrol et
        // Daha güçlü regex ile base64 ve data URI'leri tespit et
        // Daha kapsamlı regex desenleri ile base64 içeriğini tespit et
        if (svgContent.includes('base64') || 
            /data:[^\s]+;base64/.test(svgContent) || 
            /xlink:href\s*=\s*["']?\s*data:/.test(svgContent) || 
            /href\s*=\s*["']?\s*data:/.test(svgContent) ||
            /<image[^>]*>/.test(svgContent) ||
            /url\s*\([^)]*data:/.test(svgContent) ||
            /["']\s*data:/.test(svgContent)) {
          return res.status(400).json({ error: 'SVG dosyasında base64 kodlu içerik veya data URI tespit edildi' });
        }
        
        // SVG yapısını doğrula
        if (!svgContent.includes('<svg') || !svgContent.includes('</svg>') || 
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(svgContent)) {
          return res.status(400).json({ error: 'Geçersiz SVG yapısı veya tehlikeli içerik tespit edildi' });
        }
        
        // 1. SVGO ile optimize et ve tehlikeli özellikleri kaldır
        // SVGO, SVG dosyalarını optimize ederken aynı zamanda güvenlik açıklarını da temizler
        const optimizedSvg = optimize(svgContent, svgoConfig);
        
        // 2. DOMPurify ile XSS koruması uygula
        // DOMPurify, SVG içindeki potansiyel olarak tehlikeli HTML ve JavaScript kodlarını temizler
        let sanitizedSvg = DOMPurify.sanitize(optimizedSvg.data, domPurifyConfig);
        
        // 3. Ek güvenlik kontrolü - base64 içeriğini tekrar kontrol et
        // DOMPurify'dan sonra bile base64 içeriği kalabilir, bu yüzden ek kontrol yapıyoruz
        if (sanitizedSvg.includes('base64') || 
            /data:[^\s]+;base64/.test(sanitizedSvg) || 
            /xlink:href\s*=\s*["']?\s*data:/.test(sanitizedSvg) || 
            /href\s*=\s*["']?\s*data:/.test(sanitizedSvg) ||
            /<image[^>]*>/.test(sanitizedSvg)) {
          // Base64 içeriği tespit edilirse, tüm image etiketlerini ve data URI'leri kaldır
          sanitizedSvg = sanitizedSvg.replace(/<image[^>]*>/gi, '');
          sanitizedSvg = sanitizedSvg.replace(/xlink:href\s*=\s*["']?\s*data:[^\s>"']+/gi, '');
          sanitizedSvg = sanitizedSvg.replace(/href\s*=\s*["']?\s*data:[^\s>"']+/gi, '');
        }
        
        // Sanitize edilmiş SVG'yi kaydet
        // Temizlenmiş ve güvenli hale getirilmiş SVG dosyasını disk üzerine yazıyoruz
        fs.writeFileSync(filePath, sanitizedSvg);
        console.log('SVG dosyası sanitize edildi ve kaydedildi');
      } catch (err) {
        console.error('SVG sanitizasyon hatası:', err);
        return res.status(500).json({ error: 'SVG dosyası işlenirken bir hata oluştu' });
      }
    }

    // 8. Başarılı yanıt
    // Tüm güvenlik kontrollerinden geçen dosya başarıyla kaydedildi, kullanıcıya başarı mesajı dönüyoruz
    // Dosya yolunu da dönerek istemci tarafında görüntülenmesini sağlıyoruz
    res.status(200).json({
      message: 'Dosya başarıyla yüklendi',
      filePath: `/uploads/${uniqueFileName}`
    });

  } catch (error) {
    // Genel hata yakalama
    // Öngörülemeyen hatalar için genel bir hata yakalama mekanizması
    // Bu, uygulamanın beklenmedik durumlarda bile çökmeden devam etmesini sağlar
    console.error('Dosya yükleme hatası:', error);
    res.status(500).json({ error: 'Dosya yüklenirken bir hata oluştu' });
  }
});

// Yüklenen dosyalara erişim sağla
// Uploads dizinini statik dosya sunucusu olarak yapılandırarak yüklenen dosyalara web üzerinden erişim sağlıyoruz
// Bu, kullanıcıların yükledikleri dosyaları görüntüleyebilmesini sağlar
app.use('/uploads', express.static(uploadsDir));

// Ana sayfa
// Kök URL'ye gelen istekleri index.html dosyasına yönlendiriyoruz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Sunucuyu başlat
// Belirtilen port üzerinde HTTP sunucusunu başlatıyoruz
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} adresinde çalışıyor`);
});
