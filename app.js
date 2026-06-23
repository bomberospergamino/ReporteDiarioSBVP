const CONFIG = {
  spreadsheetId: "1fkfiSwjaFuysUVHaTTaHziDee0Atmrpo-cbH_iqrCuw",
  personnelGid: "0",
  signaturesGid: "1632175139",
  historyDays: 60,
  appsScriptUrl: "",
};

const PLACE_ITEMS = [
  "Sala de maquinas",
  "Baño femenino",
  "Vestuario femenino",
  "Vestuario masculino",
  "Baño Masculino",
  "Cocina",
  "Patio",
  "Casino",
  "Jefatura",
  "Vereda",
];

const VEHICLE_ITEMS = [
  "Móvil N°3",
  "Móvil N°5",
  "Móvil N°6",
  "Móvil N°8",
  "Móvil N°9",
  "Móvil N°11",
  "Móvil N°12",
  "Móvil N°19",
  "Móvil N°24",
  "Móvil N°26",
  "Móvil N°27",
];

const CONDITION_OPTIONS = ["Bueno", "N/A", "Malo"];
const SHEET_STATUS_OPTIONS = ["Completa", "Incompleta"];
const GUARDIA_OPTIONS = ["Presente", "Ausente"];
const LIMPIEZA_OPTIONS = ["Realizo", "No realizo"];
const TASK_OPTIONS = ["Cocinar", "Mandados", "ERA", "Control de móvil"];

const PLANILLA_ITEMS = [
  "Guardia diaria",
  "Limpieza diaria",
  "Check de ERA",
  "Check de móviles",
];

const DRIVER_CHECK_ITEMS = [
  "Check de choferes",
  "Enviado por mail",
  "Registrado en el libro",
];

const STORAGE_KEYS = {
  draft: "sbvp-control-diario-draft-v2",
  history: "sbvp-control-diario-history-v1",
  pendingSignatureUpdates: "sbvp-control-firmas-pending-v1",
};

const state = {
  personnel: [],
  signatures: [],
  draftResponsible: "",
  checks: {
    lugares: PLACE_ITEMS.map((name) => ({ name, condition: "Bueno", note: "" })),
    moviles: VEHICLE_ITEMS.map((name) => ({ name, condition: "Bueno", note: "" })),
    planillas: PLANILLA_ITEMS.map((name) => ({ name, condition: "Completa", note: "" })),
    choferes: DRIVER_CHECK_ITEMS.map((name) => ({ name, condition: "Completa", note: "" })),
  },
  attendance: [],
  signatureControl: {},
};

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", init);

async function init() {
  $("#controlDate").value = new Date().toISOString().slice(0, 10);
  bindTabs();
  bindActions();
  loadDraft();
  pruneHistory();
  renderChecks("lugares");
  renderChecks("moviles");
  renderChecks("planillas");
  renderChecks("choferes");
  renderAttendance();
  renderHistory();
  await loadRemoteData();
  await flushPendingSignatureUpdates();
  updateProgress();
}

function bindTabs() {
  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => openTab(button.dataset.tab));
  });
}

function openTab(tabName) {
  document.querySelectorAll(".tab, .tab-panel").forEach((el) => el.classList.remove("active"));
  const button = document.querySelector(`.tab[data-tab="${tabName}"]`);
  if (button) button.classList.add("active");
  $(`#tab-${tabName}`).classList.add("active");
}

function bindActions() {
  $("#openHistoryTop").addEventListener("click", () => openTab("historico"));
  $("#setAttendanceAmount").addEventListener("click", setAttendanceAmount);
  $("#saveDraft").addEventListener("click", () => {
    saveDraft();
    setStatus("Borrador guardado", "ok");
  });
  $("#finishControl").addEventListener("click", finishControl);
  $("#clearHistory").addEventListener("click", () => {
    localStorage.removeItem(STORAGE_KEYS.history);
    renderHistory();
  });
  ["controlDate", "responsibleSearch"].forEach((id) => {
    $(`#${id}`).addEventListener("change", saveDraft);
  });
}

async function loadRemoteData() {
  setStatus("Leyendo planilla...", "");
  try {
    const [personnel, signatures] = await Promise.all([
      fetchSheet(CONFIG.personnelGid),
      fetchSheet(CONFIG.signaturesGid),
    ]);
    state.personnel = personnel
      .filter((row) => row.apellido_nombre || row.BOMBERO || row.NOMBRE)
      .map((row) => ({
        id: row.persona_id || "",
        label: row.apellido_nombre || row.BOMBERO || `${row.APELLIDO || ""}, ${row.NOMBRE || ""}`.trim(),
        section: row.SECCION || "",
        grade: row.grado || "",
      }))
      .sort((a, b) => a.label.localeCompare(b.label, "es"));
    state.signatures = signatures.filter((row) => !isCompleteSignatureRow(row));
    renderPersonnel();
    renderSignatures();
    setStatus(`Planilla actualizada: ${state.personnel.length} personas`, "ok");
  } catch (error) {
    console.error(error);
    renderSignatures();
    setStatus("No se pudo leer la planilla", "warn");
  }
}

function fetchSheet(gid) {
  return new Promise((resolve, reject) => {
    const callback = `sbvpSheetCallback_${gid}_${Date.now()}`;
    const script = document.createElement("script");
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Tiempo agotado leyendo hoja ${gid}`));
    }, 15000);

    function cleanup() {
      window.clearTimeout(timeout);
      delete window[callback];
      script.remove();
    }

    window[callback] = (payload) => {
      cleanup();
      if (payload.status !== "ok") {
        reject(new Error(payload.errors?.[0]?.detailed_message || `Error leyendo hoja ${gid}`));
        return;
      }
      resolve(parseGviz(payload));
    };

    script.onerror = () => {
      cleanup();
      reject(new Error(`No se pudo cargar hoja ${gid}`));
    };
    script.src = `https://docs.google.com/spreadsheets/d/${CONFIG.spreadsheetId}/gviz/tq?gid=${gid}&headers=1&tqx=responseHandler:${callback};out:json`;
    document.head.appendChild(script);
  });
}

function parseGviz(payload) {
  const table = payload.table;
  const headers = table.cols.map((col, index) => normalizeHeader(col.label || `col_${index}`));
  return table.rows.map((row) => {
    const item = {};
    headers.forEach((header, index) => {
      item[header] = row.c[index]?.f ?? row.c[index]?.v ?? "";
    });
    return item;
  });
}

function normalizeHeader(value) {
  return String(value)
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "_");
}

function renderPersonnel() {
  const responsible = $("#responsibleSearch");
  const datalist = $("#personnelList");
  const current = responsible.value || state.draftResponsible;
  responsible.innerHTML = `<option value="">Seleccionar persona</option>`;
  datalist.innerHTML = "";
  state.personnel.forEach((person) => {
    const option = document.createElement("option");
    option.value = person.label;
    option.textContent = person.label;
    responsible.appendChild(option);

    const dataOption = document.createElement("option");
    dataOption.value = person.label;
    dataOption.label = [person.grade, person.section].filter(Boolean).join(" - ");
    datalist.appendChild(dataOption);
  });
  responsible.value = current;
  state.draftResponsible = "";
}

function renderChecks(kind) {
  const containers = {
    lugares: $("#placeChecks"),
    moviles: $("#vehicleChecks"),
    planillas: $("#sheetChecks"),
    choferes: $("#driverChecks"),
  };
  const options = kind === "lugares" || kind === "moviles" ? CONDITION_OPTIONS : SHEET_STATUS_OPTIONS;
  const container = containers[kind];
  container.innerHTML = "";
  state.checks[kind].forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${escapeHtml(item.name)}</strong></td>
      <td>
        <select aria-label="Condicion de ${escapeAttr(item.name)}">
          ${options.map((condition) => `<option value="${condition}" ${item.condition === condition ? "selected" : ""}>${condition}</option>`).join("")}
        </select>
      </td>
      <td><input type="text" value="${escapeAttr(item.note)}" placeholder="Sin observaciones" /></td>
    `;
    row.querySelector("select").addEventListener("change", (event) => {
      state.checks[kind][index].condition = event.target.value;
      saveDraft();
      updateProgress();
    });
    row.querySelector("input").addEventListener("input", (event) => {
      state.checks[kind][index].note = event.target.value;
      saveDraft();
    });
    container.appendChild(row);
  });
  updateCounts();
}

function setAttendanceAmount() {
  const amount = Math.max(0, Math.min(80, Number($("#attendanceAmount").value) || 0));
  const current = state.attendance.slice(0, amount);
  while (current.length < amount) {
    current.push({
      name: "",
      guardia: "Presente",
      limpieza: "Realizo",
      tasks: [],
      note: "",
    });
  }
  state.attendance = current;
  $("#attendanceAmount").value = String(amount);
  renderAttendance();
  saveDraft();
}

function renderAttendance() {
  const container = $("#attendanceRows");
  $("#attendanceAmount").value = String(state.attendance.length);
  if (!state.attendance.length) {
    container.innerHTML = `<tr><td colspan="5" class="empty-cell">Todavia no se agregaron personas a asistencia.</td></tr>`;
    return;
  }
  container.innerHTML = "";
  state.attendance.forEach((item, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><input list="personnelList" value="${escapeAttr(item.name)}" placeholder="Buscar persona" /></td>
      <td>
        <select>
          ${GUARDIA_OPTIONS.map((status) => `<option value="${status}" ${item.guardia === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td>
        <select>
          ${LIMPIEZA_OPTIONS.map((status) => `<option value="${status}" ${item.limpieza === status ? "selected" : ""}>${status}</option>`).join("")}
        </select>
      </td>
      <td>
        <select multiple size="4">
          ${TASK_OPTIONS.map((task) => `<option value="${task}" ${(item.tasks || []).includes(task) ? "selected" : ""}>${task}</option>`).join("")}
        </select>
      </td>
      <td><input value="${escapeAttr(item.note)}" placeholder="Sin observaciones" /></td>
    `;
    const inputs = row.querySelectorAll("input");
    const selects = row.querySelectorAll("select");
    inputs[0].addEventListener("input", (event) => {
      state.attendance[index].name = event.target.value;
      saveDraft();
    });
    selects[0].addEventListener("change", (event) => {
      state.attendance[index].guardia = event.target.value;
      saveDraft();
    });
    selects[1].addEventListener("change", (event) => {
      state.attendance[index].limpieza = event.target.value;
      saveDraft();
    });
    selects[2].addEventListener("change", (event) => {
      state.attendance[index].tasks = Array.from(event.target.selectedOptions).map((option) => option.value);
      saveDraft();
    });
    inputs[1].addEventListener("input", (event) => {
      state.attendance[index].note = event.target.value;
      saveDraft();
    });
    container.appendChild(row);
  });
}

function renderSignatures() {
  const container = $("#signatureRows");
  const rows = state.signatures;
  renderSignatureSummary(rows);
  if (!rows.length) {
    container.innerHTML = `<tr><td colspan="7" class="empty-cell">No hay partes pendientes para controlar.</td></tr>`;
    return;
  }
  container.innerHTML = "";
  rows.forEach((item) => {
    const id = signatureId(item);
    if (!state.signatureControl[id]) {
      state.signatureControl[id] = {
        firmaPersonaACargo: toBool(item.firma_persona_a_cargo),
        firmaOperador: toBool(item.firma_operador),
      };
    }
    const control = state.signatureControl[id];
    const complete = control.firmaPersonaACargo && control.firmaOperador;
    const row = document.createElement("tr");
    row.className = complete ? "complete-row" : "";
    row.innerHTML = `
      <td><strong>${escapeHtml(item.parte_servicio || "-")}</strong></td>
      <td>${escapeHtml(item.fecha_servicio || "-")}</td>
      <td>${escapeHtml(item.persona_a_cargo || "-")}</td>
      <td class="check-cell"><input type="checkbox" ${control.firmaPersonaACargo ? "checked" : ""} aria-label="Firma persona a cargo" /></td>
      <td>${escapeHtml(item.operador || "-")}</td>
      <td class="check-cell"><input type="checkbox" ${control.firmaOperador ? "checked" : ""} aria-label="Firma operador" /></td>
      <td><span class="badge ${complete ? "" : "missing"}">${complete ? "Completo" : "Pendiente"}</span></td>
    `;
    const boxes = row.querySelectorAll("input[type='checkbox']");
    boxes[0].addEventListener("change", () => updateSignature(item, { firmaPersonaACargo: boxes[0].checked }));
    boxes[1].addEventListener("change", () => updateSignature(item, { firmaOperador: boxes[1].checked }));
    container.appendChild(row);
  });
}

function updateSignature(row, patch) {
  const id = signatureId(row);
  state.signatureControl[id] = {
    firmaPersonaACargo: toBool(row.firma_persona_a_cargo),
    firmaOperador: toBool(row.firma_operador),
    ...state.signatureControl[id],
    ...patch,
  };
  const control = state.signatureControl[id];
  const payload = {
    action: "updateSignature",
    control_id: row.control_id,
    firma_persona_a_cargo: control.firmaPersonaACargo,
    firma_operador: control.firmaOperador,
    controlado: control.firmaPersonaACargo && control.firmaOperador,
    controlado_en: new Date().toISOString(),
    controlado_por: $("#responsibleSearch").value,
  };
  queueSignatureUpdate(payload);
  sendSignatureUpdate(payload);
  renderSignatures();
  saveDraft();
  updateProgress();
}

function renderSignatureSummary(rows) {
  const missingA = rows.filter((row) => !(state.signatureControl[signatureId(row)]?.firmaPersonaACargo ?? toBool(row.firma_persona_a_cargo))).length;
  const missingO = rows.filter((row) => !(state.signatureControl[signatureId(row)]?.firmaOperador ?? toBool(row.firma_operador))).length;
  const pending = rows.filter((row) => {
    const control = state.signatureControl[signatureId(row)] || {};
    return !((control.firmaPersonaACargo ?? toBool(row.firma_persona_a_cargo)) && (control.firmaOperador ?? toBool(row.firma_operador)));
  }).length;
  $("#signatureSummary").innerHTML = `
    <div class="metric"><strong>${pending}</strong><span>Partes pendientes</span></div>
    <div class="metric"><strong>${missingA}</strong><span>Sin firma a cargo</span></div>
    <div class="metric"><strong>${missingO}</strong><span>Sin firma operador</span></div>
    <div class="metric"><strong>${getPendingSignatureUpdates().length}</strong><span>Actualizaciones pendientes</span></div>
  `;
}

function queueSignatureUpdate(payload) {
  const pending = getPendingSignatureUpdates().filter((item) => item.control_id !== payload.control_id);
  pending.push(payload);
  localStorage.setItem(STORAGE_KEYS.pendingSignatureUpdates, JSON.stringify(pending));
}

function getPendingSignatureUpdates() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.pendingSignatureUpdates) || "[]");
  } catch {
    return [];
  }
}

async function flushPendingSignatureUpdates() {
  if (!CONFIG.appsScriptUrl) return;
  const pending = getPendingSignatureUpdates();
  for (const payload of pending) {
    await sendSignatureUpdate(payload, false);
  }
}

async function sendSignatureUpdate(payload, showWarning = true) {
  if (!CONFIG.appsScriptUrl) {
    if (showWarning) setStatus("Firma guardada localmente: falta URL de Apps Script", "warn");
    return;
  }
  try {
    await fetch(CONFIG.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const pending = getPendingSignatureUpdates().filter((item) => item.control_id !== payload.control_id);
    localStorage.setItem(STORAGE_KEYS.pendingSignatureUpdates, JSON.stringify(pending));
    setStatus("Firma enviada a CONTROL_FIRMAS", "ok");
  } catch (error) {
    console.error(error);
    if (showWarning) setStatus("No se pudo enviar la firma, queda pendiente", "warn");
  }
}

function updateCounts() {
  ["lugares", "moviles", "planillas", "choferes"].forEach((kind) => {
    const done = state.checks[kind].filter((item) => item.condition).length;
    const total = state.checks[kind].length;
    $(`#${kind}Count`).textContent = `${done}/${total}`;
  });
}

function updateProgress() {
  updateCounts();
  const allChecks = [...state.checks.lugares, ...state.checks.moviles];
  const allAdminChecks = [...state.checks.planillas, ...state.checks.choferes];
  const checkDone = allChecks.filter((item) => item.condition).length;
  const adminDone = allAdminChecks.filter((item) => item.condition).length;
  const signatureDone = state.signatures.filter((row) => {
    const control = state.signatureControl[signatureId(row)] || {};
    return (control.firmaPersonaACargo ?? toBool(row.firma_persona_a_cargo)) && (control.firmaOperador ?? toBool(row.firma_operador));
  }).length;
  const total = allChecks.length + allAdminChecks.length + state.signatures.length;
  const done = checkDone + adminDone + signatureDone;
  const percent = total ? Math.round((done / total) * 100) : 100;
  $("#overallProgress").textContent = `${percent}% completo`;
  $("#overallDetail").textContent = `${done} de ${total} items controlados.`;
}

function saveDraft() {
  const payload = {
    date: $("#controlDate").value,
    responsible: $("#responsibleSearch").value,
    checks: state.checks,
    attendance: state.attendance,
    signatureControl: state.signatureControl,
    savedAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEYS.draft, JSON.stringify(payload));
}

function loadDraft() {
  const raw = localStorage.getItem(STORAGE_KEYS.draft);
  if (!raw) return;
  try {
    const draft = JSON.parse(raw);
    $("#controlDate").value = draft.date || $("#controlDate").value;
    if (draft.checks) state.checks = migrateChecks(draft.checks);
    if (draft.attendance) state.attendance = migrateAttendance(draft.attendance);
    if (draft.signatureControl) state.signatureControl = draft.signatureControl;
    state.draftResponsible = draft.responsible || "";
    $("#responsibleSearch").value = state.draftResponsible;
  } catch (error) {
    console.warn("No se pudo cargar el borrador", error);
  }
}

function migrateChecks(checks) {
  return {
    lugares: migrateCheckGroup(checks.lugares, PLACE_ITEMS, "Bueno"),
    moviles: migrateCheckGroup(checks.moviles, VEHICLE_ITEMS, "Bueno"),
    planillas: migrateCheckGroup(checks.planillas, PLANILLA_ITEMS, "Completa"),
    choferes: migrateCheckGroup(checks.choferes, DRIVER_CHECK_ITEMS, "Completa"),
  };
}

function migrateCheckGroup(saved = [], sourceItems, defaultCondition) {
  return sourceItems.map((name) => {
    const previous = saved.find((item) => item.name === name);
    return {
      name,
      condition: previous?.condition || statusToCondition(previous?.status) || defaultCondition,
      note: previous?.note || "",
    };
  });
}

function migrateAttendance(attendance) {
  return attendance.map((item) => ({
    name: item.name || "",
    guardia: item.guardia || item.status || "Presente",
    limpieza: item.limpieza || "Realizo",
    tasks: item.tasks || [],
    note: item.note || "",
  }));
}

function statusToCondition(status) {
  if (status === "issue") return "Malo";
  return "Bueno";
}

async function finishControl() {
  const responsible = $("#responsibleSearch").value.trim();
  if (!responsible) {
    setStatus("Falta seleccionar responsable", "warn");
    $("#responsibleSearch").focus();
    return;
  }
  saveDraft();
  const record = buildRecord();
  const pdfBlob = generatePdf(record);
  saveHistory(record);
  renderHistory();
  state.signatures = state.signatures.filter((row) => {
    const control = state.signatureControl[signatureId(row)] || {};
    return !((control.firmaPersonaACargo ?? toBool(row.firma_persona_a_cargo)) && (control.firmaOperador ?? toBool(row.firma_operador)));
  });
  renderSignatures();
  localStorage.removeItem(STORAGE_KEYS.draft);
  setStatus("PDF generado y control archivado", "ok");
  await shareOrDownload(pdfBlob, record);
}

function buildRecord() {
  return {
    id: crypto.randomUUID(),
    date: $("#controlDate").value,
    responsible: $("#responsibleSearch").value.trim(),
    createdAt: new Date().toISOString(),
    checks: JSON.parse(JSON.stringify(state.checks)),
    attendance: JSON.parse(JSON.stringify(state.attendance)),
    signatures: state.signatures.map((row) => {
      const control = state.signatureControl[signatureId(row)] || {};
      return {
        parte: row.parte_servicio,
        fecha: row.fecha_servicio,
        aCargo: row.persona_a_cargo,
        operador: row.operador,
        firmaACargo: control.firmaPersonaACargo ?? toBool(row.firma_persona_a_cargo),
        firmaOperador: control.firmaOperador ?? toBool(row.firma_operador),
      };
    }),
  };
}

function generatePdf(record) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 16;
  const margin = 14;
  const width = 182;

  const section = (title) => {
    if (y > 260) {
      doc.addPage();
      y = 16;
    }
    doc.setFillColor(181, 31, 45);
    doc.rect(margin, y, width, 8, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text(title, margin + 3, y + 5.5);
    y += 13;
    doc.setTextColor(24, 32, 42);
  };

  const line = (text, indent = 0) => {
    const chunks = doc.splitTextToSize(text, width - indent);
    chunks.forEach((chunk) => {
      if (y > 282) {
        doc.addPage();
        y = 16;
      }
      doc.text(chunk, margin + indent, y);
      y += 5.2;
    });
  };

  doc.setTextColor(24, 32, 42);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("SBVP - Control Diario", margin, y);
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  line(`Fecha: ${record.date} | Responsable: ${record.responsible}`);
  line(`Generado: ${new Date(record.createdAt).toLocaleString("es-AR")}`);
  y += 3;

  section("Limpieza de lugares");
  record.checks.lugares.forEach((item) => line(`${item.name}: ${item.condition}${item.note ? ` - ${item.note}` : ""}`));

  section("Limpieza de moviles");
  record.checks.moviles.forEach((item) => line(`${item.name}: ${item.condition}${item.note ? ` - ${item.note}` : ""}`));

  section("Control de planillas");
  record.checks.planillas.forEach((item) => line(`${item.name}: ${item.condition}${item.note ? ` - ${item.note}` : ""}`));

  section("Check de choferes");
  record.checks.choferes.forEach((item) => line(`${item.name}: ${item.condition}${item.note ? ` - ${item.note}` : ""}`));

  section("Asistencia");
  if (!record.attendance.length) line("Sin personas cargadas.");
  record.attendance.forEach((item) => {
    const tasks = item.tasks?.length ? item.tasks.join(", ") : "Sin tareas";
    line(`${item.name || "Sin nombre"} | Guardia: ${item.guardia} | Limpieza: ${item.limpieza} | Tareas: ${tasks}${item.note ? ` - ${item.note}` : ""}`);
  });

  section("Control de partes sin firmar");
  const pending = record.signatures.filter((item) => !(item.firmaACargo && item.firmaOperador));
  if (!pending.length) line("Sin partes pendientes en CONTROL_FIRMAS.");
  pending.forEach((item) => {
    line(`Parte ${item.parte || "-"} (${item.fecha || "sin fecha"})`);
    line(`A cargo: ${item.aCargo || "-"} | Firma: ${item.firmaACargo ? "Si" : "No"}`, 4);
    line(`Operador: ${item.operador || "-"} | Firma: ${item.firmaOperador ? "Si" : "No"}`, 4);
    y += 1.5;
  });

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(9);
    doc.setTextColor(101, 112, 128);
    doc.text(`Pagina ${page} de ${pages}`, 166, 290);
  }
  return doc.output("blob");
}

async function shareOrDownload(blob, record) {
  const fileName = `SBVP-control-diario-${record.date}.pdf`;
  const file = new File([blob], fileName, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: "SBVP Control Diario",
      text: `Control diario ${record.date} - ${record.responsible}`,
      files: [file],
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
  const message = encodeURIComponent(`Control diario ${record.date} generado. Archivo: ${fileName}`);
  window.open(`https://wa.me/?text=${message}`, "_blank", "noopener");
}

function saveHistory(record) {
  const history = getHistory();
  history.unshift(record);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
  pruneHistory();
}

function getHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
  } catch {
    return [];
  }
}

function pruneHistory() {
  const cutoff = Date.now() - CONFIG.historyDays * 24 * 60 * 60 * 1000;
  const filtered = getHistory().filter((item) => new Date(item.createdAt).getTime() >= cutoff);
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(filtered));
}

function renderHistory() {
  const rows = getHistory();
  const container = $("#historyRows");
  if (!rows.length) {
    container.innerHTML = `<div class="empty-state">Todavia no hay controles finalizados.</div>`;
    return;
  }
  container.innerHTML = "";
  rows.forEach((item) => {
    const checked = [...item.checks.lugares, ...item.checks.moviles, ...item.checks.planillas, ...item.checks.choferes].filter((row) => row.condition).length;
    const pending = item.signatures.filter((row) => !(row.firmaACargo && row.firmaOperador)).length;
    const row = document.createElement("article");
    row.className = "history-row";
    row.innerHTML = `
      <strong>${escapeHtml(item.date)} - ${escapeHtml(item.responsible)}</strong>
      <span>Limpieza: ${checked} items | Partes pendientes: ${pending}</span>
    `;
    container.appendChild(row);
  });
}

function isCompleteSignatureRow(row) {
  return toBool(row.firma_persona_a_cargo) && toBool(row.firma_operador);
}

function signatureId(row) {
  return row.control_id || `${row.servicio_id}-${row.parte_servicio}`;
}

function toBool(value) {
  return value === true || String(value).toUpperCase() === "TRUE" || String(value).toLowerCase() === "si";
}

function setStatus(text, kind) {
  const el = $("#syncStatus");
  el.textContent = text;
  el.className = `status-pill ${kind || ""}`.trim();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}
