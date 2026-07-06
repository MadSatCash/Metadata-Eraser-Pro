let currentLang = 'es';
let translations = { en: null };

async function loadTranslations() {
  try {
    const res = await fetch('i18n/en.json');
    translations.en = await res.json();
  } catch(e) {
    console.error("No se pudo cargar el diccionario:", e);
  }
}

function t(key) {
  if (currentLang === 'es' || !translations.en) return key;
  return translations.en[key] || key;
}

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    // Para el caso mixto del footer
    if (el.tagName === 'FOOTER-TEXT') {
       el.innerHTML = t(key);
    } else {
       el.innerText = t(key);
    }
  });
  document.getElementById('lang-es').classList.toggle('active', currentLang === 'es');
  document.getElementById('lang-en').classList.toggle('active', currentLang === 'en');
}

loadTranslations();

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const resultsList = document.getElementById('results-list');

// Trigger file input on click
dropZone.addEventListener('click', () => {
  fileInput.click();
});

document.addEventListener('dragover', preventDefaults, false);
document.addEventListener('drop', preventDefaults, false);

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change', (e) => handleFiles(e.target.files), false);

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles(files);
}

document.getElementById('lang-es').addEventListener('click', () => { currentLang = 'es'; updateUI(); });
document.getElementById('lang-en').addEventListener('click', () => { currentLang = 'en'; updateUI(); });

async function handleFiles(files) {
  try {
    const validFiles = [...files].filter(file => {
      const ext = file.name.toLowerCase();
      return ext.endsWith('.jpg') || ext.endsWith('.jpeg') || ext.endsWith('.png');
    });

    if (validFiles.length === 0) {
      alert(t("No se detectaron archivos vÃ¡lidos (.jpg, .png). Archivos recibidos: ") + files.length);
      return;
    }

    const filePaths = validFiles.map(file => window.api.getPath(file));
    if (!filePaths[0]) {
      alert(t("Error: La ruta del archivo estÃ¡ oculta (vacÃ­a). Esto suele ocurrir al arrastrar directamente desde la barra de descargas de Chrome o carpetas virtuales. Por favor, usa el clic para seleccionar la imagen, o muÃ©vela al Escritorio primero y arrÃ¡strala desde allÃ­."));
      return;
    }
    
    const results = await window.api.cleanImages(filePaths);
    
    renderResults(results);
  } catch (error) {
    alert(t("Error crÃ­tico de UI: ") + error.message);
  }
}

function renderResults(results) {
  results.forEach(res => {
    const li = document.createElement('li');
    li.className = 'result-item';
    
    // Extract file name from original path
    const fileName = res.path.split(/[\\/]/).pop();
    
    if (res.success) {
      let metaHtml;
      if (res.removedTags && res.removedTags.length > 0) {
        const tagItems = res.removedTags.map(tag => `<li class="meta-tag-item">${tag}</li>`).join('');
        metaHtml = `<div class="removed-meta">
          <span class="meta-label">${t("Metadatos eliminados")} (${res.removedTags.length}):</span>
          <ul class="meta-tag-list">${tagItems}</ul>
        </div>`;
      } else {
        metaHtml = `<div class="removed-meta"><span class="meta-label-none">${t("No se encontraron metadatos ocultos.")}</span></div>`;
      }

      li.innerHTML = `
        <div class="result-info">
          <span class="result-name">${fileName}</span>
          <span class="result-path" title="${res.resultPath}">${t("Guardado: ")}${res.resultPath}</span>
          ${metaHtml}
        </div>
        <span class="status-badge status-success">${t("Limpio")}</span>
      `;
    } else {
      li.innerHTML = `
        <div class="result-info">
          <span class="result-name">${fileName}</span>
          <span class="result-path" style="color: var(--error);">${res.error}</span>
        </div>
        <span class="status-badge status-error">${t("Error")}</span>
      `;
    }
    
    // Prepend so newest is on top
    resultsList.prepend(li);
  });
}
