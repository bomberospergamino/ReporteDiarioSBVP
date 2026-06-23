const SPREADSHEET_ID = "1fkfiSwjaFuysUVHaTTaHziDee0Atmrpo-cbH_iqrCuw";
const SHEET_NAME = "CONTROL_FIRMAS";

function doPost(e) {
  const payload = JSON.parse(e.postData.contents || "{}");
  if (payload.action !== "updateSignature") {
    return json({ ok: false, error: "Accion no soportada" });
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SHEET_NAME);
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const controlIdCol = headers.indexOf("control_id");
  const targetRowIndex = values.findIndex((row, index) => index > 0 && row[controlIdCol] === payload.control_id);

  if (targetRowIndex < 1) {
    return json({ ok: false, error: "control_id no encontrado" });
  }

  setByHeader(sheet, headers, targetRowIndex + 1, "firma_persona_a_cargo", payload.firma_persona_a_cargo);
  setByHeader(sheet, headers, targetRowIndex + 1, "firma_operador", payload.firma_operador);
  setByHeader(sheet, headers, targetRowIndex + 1, "controlado", payload.controlado);
  setByHeader(sheet, headers, targetRowIndex + 1, "controlado_en", payload.controlado_en);
  setByHeader(sheet, headers, targetRowIndex + 1, "controlado_por", payload.controlado_por);

  return json({ ok: true });
}

function setByHeader(sheet, headers, row, header, value) {
  const col = headers.indexOf(header);
  if (col >= 0) sheet.getRange(row, col + 1).setValue(value);
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
