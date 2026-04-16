const RESPONSABLES_CSV_URL = 'https://docs.google.com/spreadsheets/d/1-4wvA_QGAFXGjrhC13WJujRlfw6N77p47OIuc9eYEAs/gviz/tq?tqx=out:csv&sheet=Hoja%201';
const GUARDIAS_CSV_URL = 'https://docs.google.com/spreadsheets/d/1jF7Eb-V9JOfzINAfywfRzhIl4nhVd39Az19VTWkDEOs/gviz/tq?tqx=out:csv&sheet=Hoja%201';

const MOVILES = [
  'Móvil N°3', 'Móvil N°5', 'Móvil N°6', 'Móvil N°8', 'Móvil N°11',
  'Móvil N°12', 'Móvil N°19', 'Móvil N°24', 'Móvil N°25', 'Móvil N°26', 'Móvil N°27'
];

const DEPENDENCIAS = [
  'Sala de máquinas', 'Baño femenino', 'Vestuario femenino', 'Vestuario masculino',
  'Baño masculino', 'Cocina', 'Patio', 'Casino', 'Jefatura', 'Vereda'
];

const PLANILLAS = [
  'Guardia diaria', 'Limpieza diaria', 'Check de ERA', 'Check de móviles'
];

const CHOFERES = [
  'Enviado por mail', 'Registrado en el libro'
];

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
const searchInputTemplate = document.getElementById('searchInputTemplate');

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

  return [
    `${dd}/${mm}/${yyyy}`,
    `${Number(dd)}/${Number(mm)}/${yyyy}`,
    `${yyyy}-${mm}-${dd}`
  ];
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

  tr.appendChild(tdName);
  tr.appendChild(tdStatus);
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
    const values = rows
      .map(r => (r[0] || '').trim())
      .filter(Boolean);

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

  await loadResponsables();
  await loadGuardiasHoy();
  renderTables();

  reloadDataBtn.disabled = false;
  reloadDataBtn.textContent = 'Actualizar datos';
}

function buildPdfFilename() {
  const parts = new Intl.DateTimeFormat('es-AR', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'America/Argentina/Buenos_Aires'
  }).formatToParts(new Date());

  const dd = parts.find(p => p.type === 'day')?.value ?? '00';
  const mm = parts.find(p => p.type === 'month')?.value ?? '00';
  const yyyy = parts.find(p => p.type === 'year')?.value ?? '0000';
  return `reporte-guardia-${yyyy}-${mm}-${dd}.pdf`;
}

async function downloadPdf() {
  const btnText = downloadPdfBtn.textContent;
  downloadPdfBtn.disabled = true;
  downloadPdfBtn.textContent = 'Generando PDF...';

  try {
    const target = document.getElementById('pdfContent');
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollY: -window.scrollY,
      windowWidth: Math.max(document.body.scrollWidth, target.scrollWidth)
    });

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const contentWidth = pageWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    let remainingHeight = contentHeight;
    let position = margin;

    pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
    remainingHeight -= (pageHeight - margin * 2);

    while (remainingHeight > 0) {
      position = remainingHeight - contentHeight + margin;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      remainingHeight -= (pageHeight - margin * 2);
    }

    pdf.save(buildPdfFilename());
  } catch (error) {
    console.error(error);
    alert('No se pudo generar el PDF.');
  } finally {
    downloadPdfBtn.disabled = false;
    downloadPdfBtn.textContent = btnText;
  }
}

reloadDataBtn.addEventListener('click', refreshAllData);
downloadPdfBtn.addEventListener('click', downloadPdf);

formatTodayDisplay();
populateDatalist(responsablesList, responsables);
refreshAllData();
