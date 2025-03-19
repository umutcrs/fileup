document.addEventListener('DOMContentLoaded', () => {
  const dropArea = document.getElementById('drop-area');
  const fileInput = document.getElementById('file-input');
  const uploadForm = document.getElementById('upload-form');
  const fileInfo = document.getElementById('file-info');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const fileType = document.getElementById('file-type');
  const errorMessage = document.getElementById('error-message');
  const uploadButton = document.getElementById('upload-button');
  const uploadResult = document.getElementById('upload-result');
  const uploadedImage = document.getElementById('uploaded-image');

  // Dosya seçme olayını dinle
  dropArea.addEventListener('click', () => {
    fileInput.click();
  });

  // Sürükle-bırak olaylarını dinle
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  ['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
      dropArea.classList.add('highlight');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, () => {
      dropArea.classList.remove('highlight');
    }, false);
  });

  // Dosya bırakıldığında
  dropArea.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length) {
      handleFiles(files[0]);
    }
  });

  // Dosya seçildiğinde
  fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
      handleFiles(fileInput.files[0]);
    }
  });

  // Dosya işleme
  function handleFiles(file) {
    // Dosya türü kontrolü
    if (!file.type.match('image.*')) {
      showError('Lütfen sadece resim dosyası yükleyin (JPEG, PNG, GIF, vb.)');
      return;
    }

    // Dosya boyutu kontrolü (10MB)
    if (file.size > 10 * 1024 * 1024) {
      showError('Dosya boyutu 10MB\'dan küçük olmalıdır');
      return;
    }

    // Dosya bilgilerini göster
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    fileType.textContent = file.type;
    fileInfo.style.display = 'block';
    uploadButton.style.display = 'block';
    errorMessage.style.display = 'none';
  }

  // Dosya boyutunu formatla
  function formatFileSize(bytes) {
    if (bytes < 1024) {
      return bytes + ' bytes';
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(2) + ' KB';
    } else {
      return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
  }

  // Hata mesajı göster
  function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    fileInfo.style.display = 'none';
    uploadButton.style.display = 'none';
    dropArea.classList.add('error');
    setTimeout(() => {
      dropArea.classList.remove('error');
    }, 2000);
  }

  // Form gönderimi
  uploadForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!fileInput.files.length) {
      showError('Lütfen bir dosya seçin');
      return;
    }

    const formData = new FormData();
    formData.append('image', fileInput.files[0]);

    try {
      // Yükleme sırasında UI güncellemeleri
      uploadButton.textContent = 'Yükleniyor...';
      uploadButton.disabled = true;
      
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Dosya yükleme hatası');
      }

      const data = await response.json();
      
      // Başarılı yükleme sonrası UI güncellemeleri
      uploadForm.reset();
      fileInfo.style.display = 'none';
      uploadButton.style.display = 'none';
      uploadButton.textContent = 'Yükle';
      uploadButton.disabled = false;
      
      // Yüklenen resmi göster
      uploadedImage.src = data.filePath;
      uploadResult.style.display = 'block';
      
    } catch (error) {
      uploadButton.textContent = 'Yükle';
      uploadButton.disabled = false;
      showError(error.message);
    }
  });
});