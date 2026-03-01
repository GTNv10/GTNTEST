// js/pdf-logic.js — Exportación PDF y Excel

import { state, saveData } from './state.js';
import { elements } from './elements.js';
import { showToast, parseDate, formatDate, getFormattedDateForFilename, getFormattedTimestampForFilename } from './utils.js';

// --- FLUJO DE GENERACIÓN PDF ---

export function generatePDF() {
    const template = state.selectedTemplateId ? state.appData.templates.find(t => t.id === state.selectedTemplateId) : null;
    const rowData = state.selectedRowId ? state.appData.mainData.find(r => r.id === state.selectedRowId) : null;
    if (!template || !rowData) return showToast('Debes seleccionar una fila y una plantilla.', 'error');

    state.pendingPDFGeneration = { template, rowData, uploadedImages: {} };
    const imageFields = template.imageFields || [];
    const manualVars = template.manualFields || [];

    if (imageFields.length > 0) promptForImages(imageFields);
    else if (manualVars.length > 0) promptForManualVars(manualVars);
    else processAndShowPreview();
}

function promptForImages(imageFields) {
    const form = elements.imageUploadModal.querySelector('#image-upload-form');
    form.innerHTML = '';
    imageFields.forEach(fieldName => {
        const fieldId = `image-input-${fieldName.replace(/\s/g, '-')}`;
        const container = document.createElement('div');
        container.className = 'p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center';
        container.innerHTML = `<label for="${fieldId}" class="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">${fieldName}<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Haz clic para seleccionar o arrastra una imagen aquí</p><img id="preview-${fieldId}" class="hidden max-h-24 mx-auto mt-2 rounded"/></label><input type="file" id="${fieldId}" name="${fieldName}" accept="image/png, image/jpeg" class="hidden">`;
        const input = container.querySelector('input[type="file"]');
        const preview = container.querySelector('img');
        const handleFile = (file) => {
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => { preview.src = e.target.result; preview.classList.remove('hidden'); state.pendingPDFGeneration.uploadedImages[fieldName] = e.target.result; };
                reader.readAsDataURL(file);
            }
        };
        input.onchange = (e) => handleFile(e.target.files[0]);
        container.ondragover = (e) => { e.preventDefault(); container.classList.add('border-sky-500', 'bg-sky-50', 'dark:bg-sky-900/50'); };
        container.ondragleave = () => container.classList.remove('border-sky-500', 'bg-sky-50', 'dark:bg-sky-900/50');
        container.ondrop = (e) => { e.preventDefault(); container.classList.remove('border-sky-500', 'bg-sky-50', 'dark:bg-sky-900/50'); handleFile(e.dataTransfer.files[0]); };
        form.appendChild(container);
    });
    elements.imageUploadModal.classList.add('active');
}

export function promptForManualVars(manualVars) {
    const manualVarsForm = document.getElementById('manual-vars-form');
    manualVarsForm.innerHTML = '';
    manualVars.forEach(varName => {
        const label = document.createElement('label');
        label.className = "block";
        label.innerHTML = `<span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${varName}</span><input type="text" name="${varName}" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200">`;
        manualVarsForm.appendChild(label);
    });
    elements.manualVarsModal.classList.add('active');
}

export function processAndShowPreview() {
    if (!state.pendingPDFGeneration) return;
    let { template, rowData } = state.pendingPDFGeneration;
    let content = template.content;
    const manualValues = {};
    const manualVarsForm = document.getElementById('manual-vars-form');
    if (elements.manualVarsModal.classList.contains('active')) {
        const formData = new FormData(manualVarsForm);
        for (let [key, value] of formData.entries()) manualValues[key] = value;
    }
    const finalContent = content.replace(/\{\{(IMAGEN:)?(.*?)\}\}/g, (_, isImage, key) => {
        key = key.trim();
        if (isImage) return '';
        if (manualValues.hasOwnProperty(key)) return manualValues[key];
        if (rowData.hasOwnProperty(key)) { const value = String(rowData[key] ?? ''); return value.trim() ? value : ''; }
        return `{{${key}}}`;
    });
    elements.manualVarsModal.classList.remove('active');
    elements.imageUploadModal.classList.remove('active');
    state.pendingPDFGeneration.finalContent = finalContent;
    showPreview(finalContent);
}

function showPreview(content) {
    state.pendingPDFGeneration.finalContent = content;
    const previewText = document.getElementById('preview-text');
    previewText.innerHTML = content.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>').replace(/\n/g, '<br>');
    elements.previewModal.classList.add('active');
}

function generatePdfFilename() {
    const { rowData, template } = state.pendingPDFGeneration;
    let filename = state.appData.pdfFilenameFormat || 'Documento.pdf';
    const manualValues = {};
    const formElement = document.getElementById('manual-vars-form');
    if (formElement && formElement.elements.length > 0) {
        const formData = new FormData(formElement);
        for (let [key, value] of formData.entries()) manualValues[key] = value;
    }
    filename = filename.replace(/\{\{(.*?)\}\}/g, (_, key) => {
        key = key.trim();
        if (manualValues.hasOwnProperty(key)) return manualValues[key];
        if (rowData.hasOwnProperty(key)) { const value = String(rowData[key] ?? ''); return value.trim() ? value : ''; }
        if (key.toLowerCase() === 'fecha_actual') return getFormattedDateForFilename();
        if (key.toLowerCase() === 'nombre_plantilla') return template.name;
        return '';
    });
    filename = filename.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');
    return `${filename}.pdf`;
}

export async function downloadPDF() {
    if (!state.pendingPDFGeneration) return;
    const { template, uploadedImages } = state.pendingPDFGeneration;
    const initialFilename = generatePdfFilename();
    // Use native prompt to avoid circular dependency with ui-render.js
    const finalFilename = window.prompt('Confirmar nombre del archivo PDF:', initialFilename);
    if (!finalFilename) return;
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const margin = 20;
        const usableWidth = doc.internal.pageSize.getWidth() - (2 * margin);
        const pageHeight = doc.internal.pageSize.getHeight();
        const fontSize = 12;
        const lineHeight = (fontSize * 1.3) * 0.352778;
        let cursorY = margin;
        const addPageIfNeeded = (requiredHeight) => { if (cursorY + requiredHeight > pageHeight - margin) { doc.addPage(); cursorY = margin; return true; } return false; };
        const parseStyledText = (text) => {
            const parts = [];
            text.split('**').forEach((segment, boldIndex) => {
                const isBold = boldIndex % 2 !== 0;
                segment.split('*').forEach((subSegment, italicIndex) => {
                    const isItalic = italicIndex % 2 !== 0;
                    if (subSegment.length > 0) parts.push({ text: subSegment, bold: isBold, italic: isItalic });
                });
            });
            return parts;
        };
        const getFontStyle = (bold, italic) => { if (bold && italic) return 'bolditalic'; if (bold) return 'bold'; if (italic) return 'italic'; return 'normal'; };
        const writeLineWithMarkdown = (line, x) => {
            let currentX = x;
            const segments = parseStyledText(line);
            for (const segment of segments) {
                doc.setFont(template.fontFamily || 'Helvetica', getFontStyle(segment.bold, segment.italic));
                const tokens = segment.text.split(/(\s+)/);
                for (const token of tokens) {
                    if (token.length === 0) continue;
                    const tokenWidth = doc.getStringUnitWidth(token) * fontSize / doc.internal.scaleFactor;
                    if (currentX + tokenWidth > x + usableWidth) { cursorY += lineHeight; addPageIfNeeded(lineHeight); currentX = x; }
                    doc.text(token, currentX, cursorY);
                    currentX += tokenWidth;
                }
            }
            doc.setFont(template.fontFamily || 'Helvetica', 'normal');
        };
        doc.setFont(template.fontFamily || 'Helvetica', 'normal');
        doc.setFontSize(fontSize);
        const contentWithPlaceholders = state.pendingPDFGeneration.template.content;
        const finalRenderableContent = contentWithPlaceholders.replace(/\{\{(?!IMAGEN:)(.*?)\}\}/g, (_, key) => {
            const manualValues = {};
            const manualVarsForm = document.getElementById('manual-vars-form');
            if (manualVarsForm && manualVarsForm.elements.length > 0) { const fd = new FormData(manualVarsForm); for (let [k, v] of fd.entries()) manualValues[k] = v; }
            key = key.trim();
            if (manualValues.hasOwnProperty(key)) return manualValues[key];
            if (state.pendingPDFGeneration.rowData.hasOwnProperty(key)) { const value = String(state.pendingPDFGeneration.rowData[key] ?? ''); return value.trim() ? value : ''; }
            return '';
        });
        const parts = finalRenderableContent.split(/(\{\{IMAGEN:.*?\}\})/g);
        for (const part of parts) {
            if (part.startsWith('{{IMAGEN:')) {
                const imageName = part.slice(9, -2).trim();
                const base64Image = uploadedImages[imageName];
                if (base64Image) {
                    const imgProps = doc.getImageProperties(base64Image);
                    const aspectRatio = imgProps.width / imgProps.height;
                    let imgWidth = usableWidth;
                    let imgHeight = imgWidth / aspectRatio;
                    const maxImgHeight = pageHeight / 2;
                    if (imgHeight > maxImgHeight) { imgHeight = maxImgHeight; imgWidth = imgHeight * aspectRatio; }
                    addPageIfNeeded(imgHeight + lineHeight);
                    doc.addImage(base64Image, 'JPEG', margin, cursorY, imgWidth, imgHeight);
                    cursorY += imgHeight + lineHeight;
                }
            } else {
                const paragraphs = part.split('\n');
                paragraphs.forEach((paragraph, pIndex) => {
                    if (paragraph.trim() === '') { if (pIndex < paragraphs.length - 1) { cursorY += lineHeight; addPageIfNeeded(lineHeight); } return; }
                    addPageIfNeeded(lineHeight);
                    writeLineWithMarkdown(paragraph, margin);
                    cursorY += lineHeight;
                });
            }
        }
        doc.save(finalFilename);
        showToast('PDF generado correctamente.', 'success');
    } catch (e) {
        console.error("Error al generar PDF:", e);
        showToast('Hubo un error inesperado al generar el PDF.', 'error');
    } finally {
        elements.previewModal.classList.remove('active');
        state.pendingPDFGeneration = null;
    }
}

// --- EXCEL ---

export function exportDataToExcel(data, filename) {
    if (data.length === 0) { showToast("No hay datos para exportar.", "warning"); return false; }
    const XLSX = window.XLSX;
    const dataToExport = data.map(row => { const exportRow = {}; state.appData.headers.forEach(h => { exportRow[h] = row[h]; }); return exportRow; });
    const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: state.appData.headers });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
    XLSX.writeFile(workbook, filename);
    return true;
}

export function exportFilteredToExcel() {
    elements.loadingOverlay.classList.add('active');
    setTimeout(() => {
        const filename = `gtn_datos_filtrados_${getFormattedDateForFilename()}.xlsx`;
        const success = exportDataToExcel(state.filteredData, filename);
        if (success) showToast('Datos exportados a Excel.', 'success');
        elements.loadingOverlay.classList.remove('active');
    }, 50);
}

export function exportDb() {
    const dataStr = JSON.stringify(state.appData.referenceDB, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'gtn_db_backup.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    showToast('Base de datos de referencia exportada.', 'success');
}

export function exportAllData() {
    elements.loadingOverlay.classList.add('active');
    setTimeout(() => {
        const dataStr = JSON.stringify(state.appData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `gtn_v10_backup_completo_${getFormattedTimestampForFilename()}.json`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast('Copia de seguridad completa exportada.', 'success');
        elements.loadingOverlay.classList.remove('active');
    }, 50);
}

export function importAllData(event) {
    const file = event.target.files[0];
    if (!file) return;
    elements.loadingOverlay.classList.add('active');
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (parsed.headers && parsed.mainData) {
                // Import showConfirmModal dynamically to avoid circular dep at module load time
                import('./ui-render.js').then(({ showConfirmModal }) => {
                    showConfirmModal('Esto reemplazará TODOS los datos y ajustes actuales con el contenido del archivo. ¿Continuar?', () => {
                        state.appData = parsed;
                        saveData(elements.temporalModeCheckbox);
                        showToast('Copia de seguridad restaurada. La página se recargará.', 'success');
                        setTimeout(() => location.reload(), 1500);
                    }, 'Restaurar Copia de Seguridad');
                });
            } else { showToast('Archivo de copia de seguridad no válido.', 'error'); }
        } catch (err) { showToast('Error al leer el archivo. No parece ser un backup válido.', 'error'); console.error(err); }
        finally { elements.loadingOverlay.classList.remove('active'); }
    };
    reader.onerror = () => { showToast('Error al leer el archivo.', 'error'); elements.loadingOverlay.classList.remove('active'); };
    reader.readAsText(file);
    event.target.value = '';
}
