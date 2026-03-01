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
    const modal = elements.imageUploadModal || document.getElementById('image-upload-modal');
    const modalContent = modal.querySelector('.modal-content');
    let uploadedImagesData = [];

    const updateModalUI = () => {
        modalContent.innerHTML = `
            <div class="flex flex-col h-full max-h-[85vh]">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <h3 class="text-2xl font-bold text-gray-800 dark:text-white">Gestión de Imágenes</h3>
                        <p class="text-sm text-gray-500">Arrastra para ordenar. Los primeros ${imageFields.length} se usarán en el PDF.</p>
                    </div>
                    <button id="clear-all-images" class="text-xs font-bold text-red-500 hover:text-red-700 transition-colors bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-xl">
                        LIMPIAR TODO
                    </button>
                </div>
                
                <div id="drop-zone" class="drop-zone flex flex-col items-center justify-center p-6 mb-4 border-2 border-dashed border-sky-200">
                    <svg class="w-10 h-10 text-sky-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                    <p class="text-gray-500 font-medium">Suelta imágenes o haz clic aquí</p>
                    <input type="file" id="multi-image-input" multiple accept="image/*" class="hidden">
                </div>

                <div id="preview-grid" class="preview-grid overflow-y-auto pr-2 pb-4"></div>

                <div class="mt-6 flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
                    <button id="cancel-upload" class="px-6 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold">Cancelar</button>
                    <button id="confirm-upload" class="px-8 py-3 rounded-2xl bg-sky-500 text-white font-bold shadow-lg shadow-sky-500/30">Confirmar Orden</button>
                </div>
            </div>
        `;

        const dropZone = document.getElementById('drop-zone');
        const fileInput = document.getElementById('multi-image-input');
        const previewGrid = document.getElementById('preview-grid');

        const renderPreviews = () => {
            previewGrid.innerHTML = '';
            uploadedImagesData.forEach((src, index) => {
                const container = document.createElement('div');
                container.className = 'preview-item group';
                container.draggable = true;

                // Si hay más fotos que campos, las sobrantes se ven diferentes
                const isExtra = index >= imageFields.length;
                const label = imageFields[index] || `Extra ${index - imageFields.length + 1}`;

                container.innerHTML = `
                    <div class="delete-img-btn" data-index="${index}">×</div>
                    <img src="${src}" class="${isExtra ? 'opacity-50 grayscale' : ''}">
                    <div class="field-label ${isExtra ? 'bg-gray-500' : 'bg-sky-600'}">${label}</div>
                `;

                // Borrar individual
                container.querySelector('.delete-img-btn').onclick = (e) => {
                    e.stopPropagation();
                    uploadedImagesData.splice(index, 1);
                    renderPreviews();
                };

                // Lógica Drag & Drop para reordenar
                container.ondragstart = (e) => {
                    container.classList.add('dragging');
                    e.dataTransfer.setData('text/plain', index);
                };
                container.ondragend = () => container.classList.remove('dragging');
                container.ondragover = (e) => {
                    e.preventDefault();
                    const draggingItem = document.querySelector('.dragging');
                    if (draggingItem && draggingItem !== container) {
                        const items = [...previewGrid.querySelectorAll('.preview-item')];
                        const dIdx = items.indexOf(draggingItem);
                        const tIdx = items.indexOf(container);
                        if (dIdx > tIdx) previewGrid.insertBefore(draggingItem, container);
                        else previewGrid.insertBefore(draggingItem, container.nextSibling);
                    }
                };
                previewGrid.appendChild(container);
            });
        };

        // Handlers
        dropZone.onclick = () => fileInput.click();
        fileInput.onchange = (e) => handleFiles(e.target.files);
        dropZone.ondrop = (e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); };
        dropZone.ondragover = (e) => e.preventDefault();

        document.getElementById('clear-all-images').onclick = () => {
            uploadedImagesData = [];
            renderPreviews();
        };

        const handleFiles = (files) => {
            Array.from(files).forEach(file => {
                const reader = new FileReader();
                reader.onload = (e) => { uploadedImagesData.push(e.target.result); renderPreviews(); };
                reader.readAsDataURL(file);
            });
        };

        document.getElementById('cancel-upload').onclick = () => modal.classList.remove('active');

        document.getElementById('confirm-upload').onclick = () => {
            // Capturar el orden final desde el DOM
            const currentOrder = [...previewGrid.querySelectorAll('img')].map(img => img.src);
            imageFields.forEach((name, idx) => {
                if (currentOrder[idx]) state.pendingPDFGeneration.uploadedImages[name] = currentOrder[idx];
            });
            modal.classList.remove('active');
            const manualVars = state.pendingPDFGeneration.template.manualFields || [];
            if (manualVars.length > 0) promptForManualVars(manualVars);
            else processAndShowPreview();
        };

        renderPreviews();
    };

    modal.classList.add('active');
    updateModalUI();
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
