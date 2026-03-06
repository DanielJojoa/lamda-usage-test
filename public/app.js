const form = document.getElementById('uploadForm');
const fileInput = document.getElementById('fileInput');
const statusBox = document.getElementById('status');
const filesList = document.getElementById('filesList');
const filesStatusBox = document.getElementById('filesStatus');
const refreshFilesBtn = document.getElementById('refreshFilesBtn');

function setStatus(message, type = '') {
  statusBox.textContent = message;
  statusBox.className = `status ${type}`.trim();
}

function setFilesStatus(message, type = '') {
  filesStatusBox.textContent = message;
  filesStatusBox.className = `status ${type}`.trim();
}

function renderFiles(items) {
  filesList.innerHTML = '';

  if (!items.length) {
    const emptyItem = document.createElement('li');
    emptyItem.className = 'file-item empty';
    emptyItem.textContent = 'No hay archivos registrados.';
    filesList.appendChild(emptyItem);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement('li');
    li.className = 'file-item';

    const fileName = item.fileName || 'Sin nombre';
    const size = item.size || '0';
    const bucket = item.bucket || 'N/A';
    const uploadTime = item.uploadTime || 'N/A';

    li.innerHTML = `
      <div class="file-name">${fileName}</div>
      <div class="file-meta">Tamaño: ${size} bytes</div>
      <div class="file-meta">Bucket: ${bucket}</div>
      <div class="file-meta">Subido: ${uploadTime}</div>
    `;

    filesList.appendChild(li);
  });
}

async function loadFiles() {
  setFilesStatus('Cargando listado...');
  refreshFilesBtn.disabled = true;

  try {
    const response = await fetch('/files');
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Error consultando archivos');
    }

    renderFiles(Array.isArray(data) ? data : []);
    setFilesStatus(`Registros: ${Array.isArray(data) ? data.length : 0}`, 'success');
  } catch (error) {
    renderFiles([]);
    setFilesStatus(`Error: ${error.message}`, 'error');
  } finally {
    refreshFilesBtn.disabled = false;
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    setStatus('Selecciona un archivo antes de enviar.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', file);

  setStatus('Subiendo archivo...');

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      throw new Error(data.message || 'Error al subir archivo');
    }

    setStatus(`Listo: ${data.key}`, 'success');
    form.reset();
    await loadFiles();
  } catch (error) {
    setStatus(`Error: ${error.message}`, 'error');
  }
});

refreshFilesBtn.addEventListener('click', loadFiles);
loadFiles();
