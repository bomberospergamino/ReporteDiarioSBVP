const RESPONSABLES_CSV_URL = 'https://docs.google.com/spreadsheets/d/1-4wvA_QGAFXGjrhC13WJujRlfw6N77p47OIuc9eYEAs/gviz/tq?tqx=out:csv&sheet=Hoja%201';
const GUARDIAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1jF7Eb-V9JOfzINAfywfRzhIl4nhVd39Az19VTWkDEOs/gviz/tq?tqx=out:csv&sheet=Hoja%201';
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwEw-qxvU1pvSnnp39s4LD8x45iai9YkHpaiqzY5q4DkCKOsFdPMDW0x8oC0MkUhADx/exec';

const MOVILES = [
  'Móvil N°3', 'Móvil N°5', 'Móvil N°6', 'Móvil N°8', 'Móvil N°11',
  'Móvil N°12', 'Móvil N°19', 'Móvil N°24', 'Móvil N°25', 'Móvil N°26', 'Móvil N°27'
];

const DEPENDENCIAS = [
  'Sala de máquinas', 'Baño femenino', 'Vestuario femenino', 'Vestuario masculino',
  'Baño masculino', 'Cocina', 'Patio', 'Casino', 'Jefatura', 'Vereda'
];

const PLANILLAS = ['Guardia diaria', 'Limpieza diaria', 'Check de ERA', 'Check de móviles'];
const CHOFERES = ['Enviado por mail', 'Registrado en el libro'];
const ESTADOS_CONTROL = ['Bien', 'Mal', 'Fuera de servicio', 'N/A'];
const ESTADOS_DEPENDENCIA = ['Bien', 'Mal', 'N/A'];
const ESTADOS_PLANILLAS = ['Completa', 'Incompleta'];
const ESTADOS_ASISTENCIA = ['Presente', 'Ausente'];
const ACTIVIDADES = [
  '',
  'Móvil N°3', 'Móvil N°5', 'Móvil N°6', 'Móvil N°8', 'Móvil N°11', 'Móvil N°12',
  'Móvil N°19', 'Móvil N°24', 'Móvil N°25', 'Móvil N°26', 'Móvil N°27',
  'Control de ERA', 'Mandados', 'Cocinar', 'Reporte diario'
];

const FALLBACK_RESPONSABLES = [
  'PUIG, R.', 'VIOLANTE, F.', 'LEIDE, M.', 'AVILÉS F., M.',
  'CHAVERO, S.', 'DE ANGELIS, D.'
];

let responsables = [...FALLBACK_RESPONSABLES];
let guardiasHoy = [];

const todayLabel = document.getElementById('todayLabel');
const responsablesList = document.getElementById('responsablesList');
const responsableInput = document.getElementById('responsableInput');
const movilesTableBody = document.querySelector('#movilesTable tbody');
const dependenciasTableBody = document.querySelector('#dependenciasTable tbody');
const planillasTableBody = document.querySelector('#planillasTable tbody');
const choferesTableBody = document.querySelector('#choferesTable tbody');
const guardiaTableBody = document.querySelector('#guardiaTable tbody');
const reloadDataBtn = document.getElementById('reloadDataBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');
const saveDriveBtn = document.getElementById('saveDriveBtn');
const statusBar = document.getElementById('statusBar');
const searchInputTemplate = document.getElementById('searchInputTemplate');

function setStatus(message, type = '') {
  statusBar.textContent = message;
  statusBar.className = `status-bar ${type}`.trim();
}

function formatTodayDisplay() {
  const formatter = new Intl.DateTimeFormat('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/Argentina/Buenos_Aires'
  });
  const label = formatter.format(new Date());
  todayLabel.textContent = label.charAt(0).toUpperCase() + label.slice(1);
}

function getTodayVariants() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('es-AR', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
  }).formatToParts(now);

  const dd = parts.find(p => p.type === 'day')?.value ?? '';
  const mm = parts.find(p => p.type === 'month')?.value ?? '';
  const yyyy = parts.find(p => p.type === 'year')?.value ?? '';

  return [`${dd}/${mm}/${yyyy}`, `${Number(dd)}/${Number(mm)}/${yyyy}`, `${yyyy}-${mm}-${dd}`];
}

function getTodayIso() {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('es-AR', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
  }).formatToParts(now);
  const dd = parts.find(p => p.type === 'day')?.value ?? '00';
  const mm = parts.find(p => p.type === 'month')?.value ?? '00';
  const yyyy = parts.find(p => p.type === 'year')?.value ?? '0000';
  return `${yyyy}-${mm}-${dd}`;
}

function populateDatalist(listElement, items) {
  listElement.innerHTML = '';
  items.forEach(item => {
    const option = document.createElement('option');
    option.value = item;
    listElement.appendChild(option);
  });
}

function createSelect(options, defaultValue = '', placeholder = '') {
  const select = document.createElement('select');
  select.className = 'select-field';

  if (placeholder) {
    const placeholderOption = document.createElement('option');
    placeholderOption.value = '';
    placeholderOption.textContent = placeholder;
    placeholderOption.selected = defaultValue === '';
    select.appendChild(placeholderOption);
  }

  options.forEach(optionText => {
    if (placeholder && optionText === '') return;
    const option = document.createElement('option');
    option.value = optionText;
    option.textContent = optionText || '—';
    if (optionText === defaultValue) option.selected = true;
    select.appendChild(option);
  });

  return select;
}

function createSearchableBomberoInput(defaultValue = '') {
  const wrapper = searchInputTemplate.content.firstElementChild.cloneNode(true);
  const input = wrapper.querySelector('input');
  const listId = `bomberosList_${crypto.randomUUID()}`;
  const datalist = document.createElement('datalist');
  datalist.id = listId;
  input.setAttribute('list', listId);
  populateDatalist(datalist, responsables);
  if (defaultValue) input.value = defaultValue;
  wrapper.appendChild(datalist);
  return wrapper;
}

function renderSimpleTableRow(tbody, name, selectOptions, defaultValue) {
  const tr = document.createElement('tr');
  const tdName = document.createElement('td');
  tdName.className = 'item-name';
  tdName.textContent = name;

  const tdStatus = document.createElement('td');
  tdStatus.appendChild(createSelect(selectOptions, defaultValue));

  tr.append(tdName, tdStatus);
  tbody.appendChild(tr);
}

function isBomberoComplete(value) {
  return Boolean(value && value.trim());
}

function syncGuardRowState(tr) {
  const bomberoInput = tr.querySelector('.table-search-input');
  const guardiaSelect = tr.querySelector('[data-role="guardia"]');
  const limpiezaSelect = tr.querySelector('[data-role="limpieza"]');
  const hasBombero = isBomberoComplete(bomberoInput.value);

  guardiaSelect.disabled = !hasBombero;
  limpiezaSelect.disabled = !hasBombero;

  if (!hasBombero) {
    guardiaSelect.value = '';
    limpiezaSelect.value = '';
  } else {
    if (!guardiaSelect.value) guardiaSelect.value = 'Presente';
    if (!limpiezaSelect.value) limpiezaSelect.value = 'Presente';
  }
}

function buildGuardiaRow(index, bombero = '') {
  const tr = document.createElement('tr');

  const tdIndex = document.createElement('td');
  tdIndex.className = 'row-index';
  tdIndex.textContent = String(index + 1);

  const tdBombero = document.createElement('td');
  const bomberoField = createSearchableBomberoInput(bombero);
  tdBombero.appendChild(bomberoField);

  const tdGuardia = document.createElement('td');
  const guardiaSelect = createSelect(ESTADOS_ASISTENCIA, '', '');
  guardiaSelect.dataset.role = 'guardia';
  tdGuardia.appendChild(guardiaSelect);

  const tdLimpieza = document.createElement('td');
  const limpiezaSelect = createSelect(ESTADOS_ASISTENCIA, '', '');
  limpiezaSelect.dataset.role = 'limpieza';
  tdLimpieza.appendChild(limpiezaSelect);

  const tdActividad1 = document.createElement('td');
  tdActividad1.appendChild(createSelect(ACTIVIDADES, '', 'Seleccionar'));

  const tdActividad2 = document.createElement('td');
  tdActividad2.appendChild(createSelect(ACTIVIDADES, '', 'Seleccionar'));

  tr.append(tdIndex, tdBombero, tdGuardia, tdLimpieza, tdActividad1, tdActividad2);

  const bomberoInput = bomberoField.querySelector('.table-search-input');
  bomberoInput.addEventListener('input', () => syncGuardRowState(tr));
  bomberoInput.addEventListener('change', () => syncGuardRowState(tr));
  syncGuardRowState(tr);

  return tr;
}

function renderTables() {
  movilesTableBody.innerHTML = '';
  dependenciasTableBody.innerHTML = '';
  planillasTableBody.innerHTML = '';
  choferesTableBody.innerHTML = '';
  guardiaTableBody.innerHTML = '';

  MOVILES.forEach(item => renderSimpleTableRow(movilesTableBody, item, ESTADOS_CONTROL, 'Bien'));
  DEPENDENCIAS.forEach(item => renderSimpleTableRow(dependenciasTableBody, item, ESTADOS_DEPENDENCIA, 'Bien'));
  PLANILLAS.forEach(item => renderSimpleTableRow(planillasTableBody, item, ESTADOS_PLANILLAS, 'Completa'));
  CHOFERES.forEach(item => renderSimpleTableRow(choferesTableBody, item, ESTADOS_PLANILLAS, 'Completa'));

  const defaultRows = Math.max(8, guardiasHoy.length || 0);
  for (let i = 0; i < defaultRows; i++) {
    guardiaTableBody.appendChild(buildGuardiaRow(i, guardiasHoy[i] || ''));
  }
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value);
      if (row.some(cell => cell !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += char;
    }
  }

  if (value.length > 0 || row.length > 0) {
    row.push(value);
    if (row.some(cell => cell !== '')) rows.push(row);
  }

  return rows;
}

async function fetchCsvRows(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`No se pudo leer: ${url}`);
  const text = await response.text();
  return parseCsv(text);
}

async function loadResponsables() {
  try {
    const rows = await fetchCsvRows(RESPONSABLES_CSV_URL);
    const values = rows.map(r => (r[0] || '').trim()).filter(Boolean);
    if (values.length) {
      responsables = values;
      populateDatalist(responsablesList, responsables);
      if (!responsableInput.value) responsableInput.value = responsables[0];
      return true;
    }
  } catch (error) {
    console.warn('No se pudieron cargar responsables desde Google Sheets.', error);
  }

  responsables = [...FALLBACK_RESPONSABLES];
  populateDatalist(responsablesList, responsables);
  if (!responsableInput.value) responsableInput.value = responsables[0] || '';
  return false;
}

async function loadGuardiasHoy() {
  guardiasHoy = [];
  try {
    const rows = await fetchCsvRows(GUARDIAS_CSV_URL);
    const todayVariants = getTodayVariants();
    guardiasHoy = rows
      .slice(1)
      .filter(row => todayVariants.includes((row[0] || '').trim()))
      .map(row => (row[1] || '').trim())
      .filter(Boolean);
    return true;
  } catch (error) {
    console.warn('No se pudieron cargar guardias del día.', error);
    return false;
  }
}

async function refreshAllData() {
  reloadDataBtn.disabled = true;
  reloadDataBtn.textContent = 'Actualizando...';
  setStatus('Actualizando datos desde Google Sheets...', 'working');

  await loadResponsables();
  await loadGuardiasHoy();
  renderTables();

  reloadDataBtn.disabled = false;
  reloadDataBtn.textContent = 'Actualizar datos';
  setStatus('Datos actualizados.', 'success');
}

function collectSimpleTable(tableId) {
  return [...document.querySelectorAll(`#${tableId} tbody tr`)].map(tr => ({
    item: tr.children[0]?.textContent.trim() || '',
    estado: tr.querySelector('select')?.value || ''
  }));
}

function collectGuardiaTable() {
  return [...document.querySelectorAll('#guardiaTable tbody tr')].map(tr => ({
    orden: tr.children[0]?.textContent.trim() || '',
    bombero: tr.querySelector('.table-search-input')?.value.trim() || '',
    guardia: tr.querySelector('[data-role="guardia"]')?.value || '',
    limpieza: tr.querySelector('[data-role="limpieza"]')?.value || '',
    actividad1: tr.children[4]?.querySelector('select')?.value || '',
    actividad2: tr.children[5]?.querySelector('select')?.value || ''
  }));
}

function collectReportData() {
  return {
    fechaLabel: todayLabel.textContent.trim(),
    fechaIso: getTodayIso(),
    responsable: responsableInput.value.trim(),
    moviles: collectSimpleTable('movilesTable'),
    dependencias: collectSimpleTable('dependenciasTable'),
    planillas: collectSimpleTable('planillasTable'),
    choferes: collectSimpleTable('choferesTable'),
    guardia: collectGuardiaTable()
  };
}

function buildPdfFilename() {
  return `reporte-guardia-${getTodayIso()}.pdf`;
}

const LOGO_CANDIDATES = [
  './logo-sbvp.png',
  './logo%20SBVP.png',
  'logo-sbvp.png',
  'logo%20SBVP.png',
  './assets/logo-sbvp.png',
  'assets/logo-sbvp.png'
];

async function loadImageAsDataUrl(srcCandidates) {
  const candidates = Array.isArray(srcCandidates) ? srcCandidates : [srcCandidates];

  for (const src of candidates) {
    try {
      const response = await fetch(src, { cache: 'no-store' });
      if (!response.ok) continue;
      const blob = await response.blob();
      return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.warn('No se pudo cargar el logo desde', src, error);
    }
  }

  return null;
}

function sanitizeRows(rows, includeEmpty = false) {
  return rows
    .filter(row => includeEmpty || Object.values(row).some(value => String(value || '').trim()))
    .map(row => Object.values(row).map(value => value || ''));
}

async function generatePdfBlob(reportData) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentWidth = pageWidth - margin * 2;
  const blue = [11, 44, 76];
  const red = [214, 48, 49];
  const light = [246, 248, 250];
  const line = [208, 214, 220];
  const text = [30, 34, 41];
  const muted = [88, 100, 112];

  const logoDataUrl = await loadImageAsDataUrl(LOGO_CANDIDATES);
  doc.setFillColor(...blue);
  doc.roundedRect(margin, 10, contentWidth, 24, 3, 3, 'F');
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, 'PNG', margin + 3, 12.2, 14, 14);
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REGISTRO DIARIO DE CUMPLIMIENTO', margin + 20, 16);
  doc.setFontSize(18);
  doc.text('REPORTE DE GUARDIA', margin + 20, 23.5);

  doc.setFillColor(...light);
  doc.setDrawColor(...line);
  doc.roundedRect(margin, 37, 92, 10, 2, 2, 'FD');
  doc.roundedRect(pageWidth - margin - 92, 37, 92, 10, 2, 2, 'FD');
  doc.setTextColor(...muted);
  doc.setFontSize(8);
  doc.text('FECHA', margin + 3, 43.2);
  doc.text('RESPONSABLE', pageWidth - margin - 89, 43.2);
  doc.setTextColor(...text);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(reportData.fechaLabel || '—', margin + 20, 43.2);
  doc.text(reportData.responsable || '—', pageWidth - margin - 60, 43.2);

  const commonHead = {
    fillColor: blue,
    textColor: 255,
    fontStyle: 'bold',
    lineColor: line,
    lineWidth: 0.1,
    halign: 'left',
    valign: 'middle'
  };

  const commonBody = {
    textColor: text,
    lineColor: line,
    lineWidth: 0.1,
    fontSize: 9,
    cellPadding: 1.8,
    valign: 'middle'
  };

  doc.autoTable({
    startY: 52,
    margin: { left: margin },
    tableWidth: 92,
    head: [['Móvil', 'Estado']],
    body: reportData.moviles.map(r => [r.item, r.estado || '—']),
    theme: 'grid',
    headStyles: commonHead,
    bodyStyles: commonBody,
    styles: { font: 'helvetica', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 30 } },
    didDrawPage: () => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...blue);
      doc.setFontSize(11);
      doc.text('Control de acondicionamiento de los móviles', margin, 49.5);
    }
  });

  doc.autoTable({
    startY: 52,
    margin: { left: pageWidth - margin - 92 },
    tableWidth: 92,
    head: [['Dependencia', 'Estado']],
    body: reportData.dependencias.map(r => [r.item, r.estado || '—']),
    theme: 'grid',
    headStyles: commonHead,
    bodyStyles: commonBody,
    styles: { font: 'helvetica', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 62 }, 1: { cellWidth: 30 } },
    didDrawPage: () => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...blue);
      doc.setFontSize(11);
      doc.text('Control de dependencias', pageWidth - margin - 92, 49.5);
    }
  });

  let nextY = Math.max(doc.lastAutoTable.finalY || 52, doc.previousAutoTable?.finalY || 52) + 10;
  // Better compute based on plugin tables:
  const tables = doc.lastAutoTable ? [doc.lastAutoTable] : [];
  nextY = Math.max(
    doc.autoTable.previous?.finalY || 0,
    126
  );

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blue);
  doc.setFontSize(11);
  doc.text('Control de planillas', margin, nextY);
  doc.autoTable({
    startY: nextY + 2,
    margin: { left: margin },
    tableWidth: 96,
    head: [['Planilla', 'Estado']],
    body: reportData.planillas.map(r => [r.item, r.estado || '—']),
    theme: 'grid',
    headStyles: commonHead,
    bodyStyles: commonBody,
    styles: { font: 'helvetica', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 30 } }
  });

  let afterPlanillas = doc.lastAutoTable.finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blue);
  doc.setFontSize(11);
  doc.text('Check de choferes', margin, afterPlanillas);
  doc.autoTable({
    startY: afterPlanillas + 2,
    margin: { left: margin },
    tableWidth: 96,
    head: [['Control', 'Estado']],
    body: reportData.choferes.map(r => [r.item, r.estado || '—']),
    theme: 'grid',
    headStyles: commonHead,
    bodyStyles: commonBody,
    styles: { font: 'helvetica', overflow: 'linebreak' },
    columnStyles: { 0: { cellWidth: 66 }, 1: { cellWidth: 30 } }
  });

  let guardiaY = doc.lastAutoTable.finalY + 10;
  if (guardiaY > 230) {
    doc.addPage();
    guardiaY = 14;
  }

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...blue);
  doc.setFontSize(11);
  doc.text('Reporte de guardia', margin, guardiaY);

  const guardiaBody = reportData.guardia.map(r => [
    r.orden,
    r.bombero || '—',
    r.guardia || '—',
    r.limpieza || '—',
    r.actividad1 || '—',
    r.actividad2 || '—'
  ]);

  doc.autoTable({
    startY: guardiaY + 2,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    head: [['#', 'Bombero', 'Guardia', 'Limpieza', 'Actividad 1', 'Actividad 2']],
    body: guardiaBody,
    theme: 'grid',
    headStyles: commonHead,
    bodyStyles: commonBody,
    styles: { font: 'helvetica', overflow: 'linebreak' },
    columnStyles: {
      0: { cellWidth: 8, halign: 'center' },
      1: { cellWidth: 52 },
      2: { cellWidth: 23 },
      3: { cellWidth: 23 },
      4: { cellWidth: 41 },
      5: { cellWidth: 41 }
    },
    didDrawPage: data => {
      const str = `Página ${doc.getNumberOfPages()}`;
      doc.setFontSize(8);
      doc.setTextColor(...muted);
      doc.text(str, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
  });

  return doc.output('blob');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function downloadPdf() {
  const originalText = downloadPdfBtn.textContent;
  downloadPdfBtn.disabled = true;
  downloadPdfBtn.textContent = 'Generando PDF...';
  setStatus('Generando PDF profesional...', 'working');

  try {
    const reportData = collectReportData();
    const blob = await generatePdfBlob(reportData);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildPdfFilename();
    a.click();
    URL.revokeObjectURL(url);
    setStatus('PDF generado correctamente.', 'success');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo generar el PDF.', 'error');
    alert('No se pudo generar el PDF. Revisá la consola del navegador.');
  } finally {
    downloadPdfBtn.disabled = false;
    downloadPdfBtn.textContent = originalText;
  }
}

async function saveToDrive() {
  if (!APPS_SCRIPT_URL || APPS_SCRIPT_URL.includes('PEGAR_AQUI')) {
    alert('Primero pegá la URL del Web App de Apps Script en app.js');
    return;
  }

  const originalText = saveDriveBtn.textContent;
  saveDriveBtn.disabled = true;
  saveDriveBtn.textContent = 'Guardando...';
  setStatus('Generando PDF y enviando a Drive...', 'working');

  try {
    const reportData = collectReportData();
    const blob = await generatePdfBlob(reportData);
    const pdfBase64 = await blobToBase64(blob);

    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        fileName: buildPdfFilename(),
        pdfBase64,
        reportData
      })
    });

    setStatus('Reporte enviado. Verificá Drive y la hoja Historial.', 'success');
    alert('Reporte enviado a Apps Script. Como el Web App responde en modo no-cors, la confirmación final se valida revisando Drive y Sheets.');
  } catch (error) {
    console.error(error);
    setStatus('No se pudo enviar el reporte a Drive.', 'error');
    alert('No se pudo enviar el reporte. Revisá la consola del navegador.');
  } finally {
    saveDriveBtn.disabled = false;
    saveDriveBtn.textContent = originalText;
  }
}

reloadDataBtn.addEventListener('click', refreshAllData);
downloadPdfBtn.addEventListener('click', downloadPdf);
saveDriveBtn.addEventListener('click', saveToDrive);

formatTodayDisplay();
populateDatalist(responsablesList, responsables);
refreshAllData();
