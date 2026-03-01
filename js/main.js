// js/main.js — Punto de Entrada y Orchestrador
import { state, saveData, loadData } from './state.js';
import { elements } from './elements.js';
import { showToast, formatDate, parseDate, formatCuitCuil, calculateDays, recalculateAllDays, createDateInputComponent, getFormattedDateForFilename } from './utils.js';
import { populateModals, renderTable, renderFilters, renderTemplates, sortAndApplyFilters, applyTheme, fullReloadUI, updateSelectionStatus, updateSelectedRowIdentifierDisplay, showConfirmModal, showPromptModal } from './ui-render.js';
import { generatePDF, downloadPDF, promptForManualVars, processAndShowPreview, exportFilteredToExcel, exportAllData, exportDb, importAllData, exportDataToExcel } from './pdf-logic.js';

// --- FILAS ---
function addRow(showToastNotification = true) {
    const newRow = { id: `row_${Date.now()}` };
    state.appData.headers.forEach(header => newRow[header] = '');
    const sortColumn = state.appData.sortBy;
    if (sortColumn && state.appData.columnFormats[sortColumn] === 'date') newRow[sortColumn] = formatDate(new Date());
    state.currentPage = 1;
    state.appData.mainData.unshift(newRow);
    saveData(elements.temporalModeCheckbox);
    sortAndApplyFilters(handleRowSelection, handleCellUpdate);
    if (showToastNotification) showToast('Nueva fila añadida.', 'success');
}

function deleteRow() {
    if (!state.selectedRowId) return;
    showConfirmModal('¿Seguro que quieres eliminar la fila seleccionada?', () => {
        state.appData.mainData = state.appData.mainData.filter(row => row.id !== state.selectedRowId);
        handleRowSelection(null);
        saveData(elements.temporalModeCheckbox);
        sortAndApplyFilters(handleRowSelection, handleCellUpdate);
        showToast('Fila eliminada.', 'success');
    });
}

function handleRowSelection(rowId) {
    state.selectedRowId = state.selectedRowId === rowId ? null : rowId;
    renderTable(handleRowSelection, handleCellUpdate);
    updateSelectionStatus();
}

function handleCellUpdate(rowId, column, value) {
    const rowIndex = state.appData.mainData.findIndex(r => r.id === rowId);
    if (rowIndex === -1) return;
    const row = state.appData.mainData[rowIndex];
    const cellElement = document.querySelector(`[data-row-id="${rowId}"] [data-column-header="${column}"] > *`);
    let finalValue = value;
    const columnFormat = state.appData.columnFormats[column];
    if (columnFormat === 'date') {
        const parsed = parseDate(value);
        if (value && !parsed) { showToast(`Formato de fecha inválido para '${value}'. Use DD/MM/YYYY.`, 'error'); if (cellElement) cellElement.classList.add('invalid-cell'); return; }
        if (cellElement) cellElement.classList.remove('invalid-cell');
        finalValue = parsed ? formatDate(parsed) : '';
    } else if (columnFormat === 'cuit') { finalValue = formatCuitCuil(value); }
    const dateCalcCol = state.appData.keyColumns?.dateForCalculation;
    const daysDisplayCol = state.appData.keyColumns?.daysDisplay;
    if (row[column] === finalValue && column !== dateCalcCol) return;
    row[column] = finalValue;
    let needsRerender = false;
    (state.appData.lookupRelations || []).forEach(relation => {
        if (relation.enabled && relation.keyColumn === column && relation.sourceDB) {
            const sourceData = state.appData.referenceDB[relation.sourceDB]?.[finalValue];
            if (sourceData) {
                Object.entries(relation.targetMap || {}).forEach(([sourceField, targetColumn]) => {
                    if (targetColumn && row.hasOwnProperty(targetColumn)) {
                        let valueToPopulate = sourceData[sourceField] || '';
                        const targetFormat = state.appData.columnFormats[targetColumn];
                        if (targetFormat === 'cuit') valueToPopulate = formatCuitCuil(valueToPopulate);
                        else if (targetFormat === 'date') { const pd = parseDate(valueToPopulate); valueToPopulate = pd ? formatDate(pd) : ''; }
                        row[targetColumn] = valueToPopulate; needsRerender = true;
                    }
                });
            }
        }
    });
    if (dateCalcCol && daysDisplayCol && column === dateCalcCol) { row[daysDisplayCol] = calculateDays(finalValue); needsRerender = true; }
    saveData(elements.temporalModeCheckbox);
    if (needsRerender || column === state.appData.colorCodingColumn || column === state.appData.selectedRowIdentifierColumn) { sortAndApplyFilters(handleRowSelection, handleCellUpdate); updateSelectedRowIdentifierDisplay(); }
}

// --- PLANTILLAS ---
function openTemplateModal(id = null) {
    let template = { name: '', content: '', manualFields: [], imageFields: [], fontFamily: 'Helvetica' };
    elements.templateModal.classList.add('active');
    const modalTitle = document.getElementById('modal-title');
    const templateIdInput = document.getElementById('template-id');
    const templateNameInput = document.getElementById('template-name');
    const templateContentInput = document.getElementById('template-content');
    const templateFontInput = document.getElementById('template-font');
    if (id) { template = state.appData.templates.find(t => t.id === id) || template; modalTitle.textContent = 'Editar Plantilla'; templateIdInput.value = id; }
    else { modalTitle.textContent = 'Crear Nueva Plantilla'; templateIdInput.value = ''; }
    templateNameInput.value = template.name; templateContentInput.value = template.content; templateFontInput.value = template.fontFamily || 'Helvetica';
    updatePlaceholders(template.manualFields, template.imageFields);
}

function updatePlaceholders(manualFields = [], imageFields = []) {
    const pc = document.getElementById('placeholders-container');
    pc.innerHTML = '';
    state.appData.headers.forEach(h => {
        const btn = document.createElement('button');
        btn.className = "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 text-xs font-mono font-semibold px-2 py-1 rounded-md hover:bg-sky-200 dark:hover:bg-sky-700";
        btn.textContent = h; btn.dataset.placeholder = h;
        btn.onclick = () => insertPlaceholderForTemplate(h);
        pc.appendChild(btn);
    });
    (manualFields || []).forEach((field, index) => {
        const container = document.createElement('div');
        container.className = "manual-field-container bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5";
        container.dataset.placeholder = field;
        const moveContainer = document.createElement('div'); moveContainer.className = "flex flex-col";
        const upBtn = document.createElement('button'); upBtn.innerHTML = '▲'; upBtn.type = 'button'; upBtn.className = 'move-manual-field-btn'; upBtn.dataset.field = field; upBtn.dataset.direction = '-1'; if (index === 0) upBtn.disabled = true;
        const downBtn = document.createElement('button'); downBtn.innerHTML = '▼'; downBtn.type = 'button'; downBtn.className = 'move-manual-field-btn'; downBtn.dataset.field = field; downBtn.dataset.direction = '1'; if (index === manualFields.length - 1) downBtn.disabled = true;
        moveContainer.appendChild(upBtn); moveContainer.appendChild(downBtn);
        const textSpan = document.createElement('span'); textSpan.textContent = field; textSpan.className = "px-1 cursor-pointer flex-grow text-center"; textSpan.onclick = () => insertPlaceholderForTemplate(field);
        const removeBtn = document.createElement('button'); removeBtn.innerHTML = '&times;'; removeBtn.title = "Eliminar campo"; removeBtn.className = "delete-manual-field font-bold text-red-500 cursor-pointer text-lg leading-none hover:text-red-700";
        removeBtn.onclick = (e) => { e.stopPropagation(); updatePlaceholders((manualFields || []).filter(f => f !== field), imageFields); };
        container.appendChild(moveContainer); container.appendChild(textSpan); container.appendChild(removeBtn);
        pc.appendChild(container);
    });
    (imageFields || []).forEach(field => {
        const container = document.createElement('div');
        container.className = "image-field-container bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-2";
        container.dataset.placeholder = field;
        const textSpan = document.createElement('span'); textSpan.textContent = `🖼️ ${field}`; textSpan.className = "px-1 cursor-pointer flex-grow text-center"; textSpan.onclick = () => insertPlaceholderForTemplate(field, 'image');
        const removeBtn = document.createElement('button'); removeBtn.innerHTML = '&times;'; removeBtn.className = "font-bold text-red-500 cursor-pointer text-lg leading-none hover:text-red-700";
        removeBtn.onclick = (e) => { e.stopPropagation(); updatePlaceholders(manualFields || [], (imageFields || []).filter(f => f !== field)); };
        container.appendChild(textSpan); container.appendChild(removeBtn);
        pc.appendChild(container);
    });
}

function addTemplatePlaceholder(fieldName, type) {
    const pc = document.getElementById('placeholders-container');
    const existingText = Array.from(pc.querySelectorAll('.manual-field-container')).map(c => c.dataset.placeholder);
    const existingImage = Array.from(pc.querySelectorAll('.image-field-container')).map(c => c.dataset.placeholder);
    if ([...state.appData.headers, ...existingText, ...existingImage].includes(fieldName)) return showToast('El campo ya existe.', 'warning');
    if (type === 'text') updatePlaceholders([...existingText, fieldName], existingImage);
    else updatePlaceholders(existingText, [...existingImage, fieldName]);
}

function moveManualField(fieldName, direction) {
    const pc = document.getElementById('placeholders-container');
    let manualFields = Array.from(pc.querySelectorAll('.manual-field-container')).map(c => c.dataset.placeholder);
    const imageFields = Array.from(pc.querySelectorAll('.image-field-container')).map(c => c.dataset.placeholder);
    const index = manualFields.indexOf(fieldName); const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= manualFields.length) return;
    [manualFields[index], manualFields[newIndex]] = [manualFields[newIndex], manualFields[index]];
    updatePlaceholders(manualFields, imageFields);
}

function insertPlaceholderForTemplate(text, type = 'text') {
    const textarea = document.getElementById('template-content');
    const placeholder = type === 'image' ? `{{IMAGEN:${text}}}` : `{{${text}}}`;
    const start = textarea.selectionStart; const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + placeholder + textarea.value.substring(end);
    textarea.focus(); textarea.selectionEnd = start + placeholder.length;
}

function applyTextFormat(format) {
    const textarea = document.getElementById('template-content');
    const start = textarea.selectionStart; const end = textarea.selectionEnd;
    if (start === end) return;
    const selectedText = textarea.value.substring(start, end);
    const wrapper = format === 'bold' ? '**' : format === 'italic' ? '*' : '';
    if (!wrapper) return;
    textarea.setRangeText(`${wrapper}${selectedText}${wrapper}`, start, end, 'end');
    textarea.focus();
}

function saveTemplate() {
    const id = document.getElementById('template-id').value;
    const name = document.getElementById('template-name').value.trim();
    if (!name) return showToast('El nombre de la plantilla es obligatorio.', 'warning');
    const content = document.getElementById('template-content').value;
    const fontFamily = document.getElementById('template-font').value;
    const pc = document.getElementById('placeholders-container');
    const manualFields = Array.from(pc.querySelectorAll('.manual-field-container')).map(c => c.dataset.placeholder);
    const imageFields = Array.from(pc.querySelectorAll('.image-field-container')).map(c => c.dataset.placeholder);
    if (id) { const idx = state.appData.templates.findIndex(t => t.id === id); if (idx > -1) state.appData.templates[idx] = { ...state.appData.templates[idx], name, content, manualFields, imageFields, fontFamily }; }
    else { state.appData.templates.push({ id: `template_${Date.now()}`, name, content, manualFields, imageFields, fontFamily }); }
    saveData(elements.temporalModeCheckbox); renderTemplates(); elements.templateModal.classList.remove('active'); showToast('Plantilla guardada.', 'success');
}

function deleteTemplate(id, name) {
    showConfirmModal(`¿Eliminar plantilla "${name}"?`, () => {
        state.appData.templates = state.appData.templates.filter(t => t.id !== id);
        if (state.selectedTemplateId === id) state.selectedTemplateId = null;
        saveData(elements.temporalModeCheckbox); renderTemplates(); updateSelectionStatus(); showToast('Plantilla eliminada.', 'success');
    });
}

// --- COLUMNAS ---
function openColumnsModal() {
    const columnsList = document.getElementById('columns-list');
    columnsList.innerHTML = ''; state.selectedColumnNameForDeletion = null;
    document.getElementById('delete-col-btn').disabled = true;
    const keySettingsContainer = document.getElementById('column-key-settings'); keySettingsContainer.innerHTML = '';
    const keyColLabel = document.createElement('label'); keyColLabel.className = 'flex items-center gap-2 text-sm';
    keyColLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Calcular "DIAS" a partir de la columna de fecha:</span>`;
    const keyColSelect = document.createElement('select'); keyColSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700';
    const dateColumns = state.appData.headers.filter(h => state.appData.columnFormats[h] === 'date');
    keyColSelect.innerHTML = `<option value="">-- No calcular --</option>` + dateColumns.map(h => `<option value="${h}" ${state.appData.keyColumns.dateForCalculation === h ? 'selected' : ''}>${h}</option>`).join('');
    keyColSelect.onchange = (e) => { state.appData.keyColumns.dateForCalculation = e.target.value || null; recalculateAllDays(elements.temporalModeCheckbox); saveData(elements.temporalModeCheckbox); sortAndApplyFilters(handleRowSelection, handleCellUpdate); showToast('Columna de cálculo actualizada.', 'success'); };
    keyColLabel.appendChild(keyColSelect); keySettingsContainer.appendChild(keyColLabel);
    state.appData.headers.forEach((header, index) => {
        const item = document.createElement('div'); item.className = 'column-manager-item flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent cursor-pointer'; item.dataset.headerName = header;
        const isProtected = state.appData.columnMetadata[header]?.isProtected || header === state.appData.keyColumns?.daysDisplay;
        item.onclick = (e) => { if (e.target.closest('input, select, button')) return; const cur = columnsList.querySelector('.border-sky-500'); if (cur) cur.classList.remove('border-sky-500', 'bg-sky-100', 'dark:bg-sky-800'); item.classList.add('border-sky-500', 'bg-sky-100', 'dark:bg-sky-800'); state.selectedColumnNameForDeletion = header; document.getElementById('delete-col-btn').disabled = isProtected; };
        const moveButtons = document.createElement('div'); moveButtons.className = 'flex items-center gap-1';
        moveButtons.innerHTML = `<button data-direction="-1" class="p-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" ${index === 0 ? 'disabled' : ''}>◀</button><button data-direction="1" class="p-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" ${index === state.appData.headers.length - 1 ? 'disabled' : ''}>▶</button>`;
        moveButtons.querySelectorAll('button').forEach(btn => btn.onclick = () => moveColumn(header, parseInt(btn.dataset.direction)));
        item.appendChild(moveButtons);
        const nameInput = document.createElement('input'); nameInput.type = 'text'; nameInput.value = header; nameInput.className = 'flex-grow font-semibold bg-transparent focus:outline-none focus:ring-0 border-0 p-2 text-gray-800 dark:text-gray-200'; nameInput.onblur = (e) => handleColumnRename(header, e.target.value); nameInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
        item.appendChild(nameInput);
        if (isProtected) { const lockIcon = document.createElement('span'); lockIcon.title = header === state.appData.keyColumns?.daysDisplay ? "Columna de DÍAS, protegida." : "Columna protegida"; lockIcon.innerHTML = `<svg class="w-5 h-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd"></path></svg>`; item.appendChild(lockIcon); }
        const widthInput = document.createElement('input'); widthInput.type = 'text'; widthInput.placeholder = 'auto'; widthInput.className = 'w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200'; widthInput.value = state.appData.columnWidths[header] || ''; widthInput.onblur = (e) => handleColumnWidthChange(header, e.target.value); widthInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
        item.appendChild(widthInput);
        const formatSelect = document.createElement('select'); formatSelect.className = 'w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200'; formatSelect.innerHTML = `<option value="text">Texto</option><option value="date">Fecha</option><option value="list">Lista</option><option value="cuit">CUIT/CUIL</option>`; formatSelect.value = state.appData.columnFormats[header] || 'text'; formatSelect.onchange = () => handleFormatChange(header, formatSelect.value);
        item.appendChild(formatSelect);
        columnsList.appendChild(item);
    });
    elements.columnsModal.classList.add('active');
}

function handleColumnWidthChange(header, width) {
    const trimmedWidth = width.trim();
    if (trimmedWidth === '' || trimmedWidth === 'auto') { delete state.appData.columnWidths[header]; }
    else { if (!/^\d+(\.\d+)?(px|%|em|rem|vw|ch)$/.test(trimmedWidth)) { showToast('Formato de ancho inválido. Use px, %, em, etc.', 'error'); return; } state.appData.columnWidths[header] = trimmedWidth; }
    saveData(elements.temporalModeCheckbox);
}

function handleFormatChange(header, newFormat) {
    if (newFormat === 'text') delete state.appData.columnFormats[header]; else state.appData.columnFormats[header] = newFormat;
    if (newFormat === 'list') { const listKey = `_list_${header}`; if (!state.appData.referenceDB[listKey]) { state.appData.referenceDB[listKey] = { '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' } }; showToast(`Se creó una nueva BD para la lista "${header}".`, 'info'); } }
    saveData(elements.temporalModeCheckbox); openColumnsModal();
}

function addColumn() {
    showPromptModal("Ingrese el nombre de la nueva columna:", (newColName) => {
        newColName = newColName.trim().toUpperCase();
        if (!state.appData.headers.includes(newColName)) { state.appData.headers.push(newColName); state.appData.columnMetadata[newColName] = { isProtected: false }; state.appData.mainData.forEach(row => row[newColName] = ''); saveData(elements.temporalModeCheckbox); openColumnsModal(); showToast(`Columna "${newColName}" añadida.`, 'success'); }
        else { showToast('Esa columna ya existe.', 'warning'); }
    });
}

function deleteColumn() {
    if (!state.selectedColumnNameForDeletion) return showToast('Seleccione una columna para eliminar.', 'warning');
    const colToDelete = state.selectedColumnNameForDeletion;
    if (state.appData.columnMetadata[colToDelete]?.isProtected || colToDelete === state.appData.keyColumns?.daysDisplay) return showToast(`La columna "${colToDelete}" está protegida.`, 'error');
    showConfirmModal(`¿Seguro que quiere eliminar la columna "${colToDelete}"? Se borrarán todos sus datos.`, () => {
        const index = state.appData.headers.indexOf(colToDelete);
        if (index > -1) {
            state.appData.headers.splice(index, 1); state.appData.mainData.forEach(row => delete row[colToDelete]);
            delete state.appData.columnMetadata[colToDelete]; delete state.appData.columnFormats[colToDelete]; delete state.appData.columnWidths[colToDelete];
            if (state.appData.colorCodingColumn === colToDelete) state.appData.colorCodingColumn = null;
            if (state.appData.bulkDeleteColumn === colToDelete) state.appData.bulkDeleteColumn = null;
            if (state.appData.hideSettings.column === colToDelete) state.appData.hideSettings.column = null;
            delete state.appData.referenceDB[`_list_${colToDelete}`];
            (state.appData.lookupRelations || []).forEach(rel => { if (rel.keyColumn === colToDelete) rel.keyColumn = ''; if (rel.targetMap) Object.keys(rel.targetMap).forEach(key => { if (rel.targetMap[key] === colToDelete) rel.targetMap[key] = ''; }); });
            if (state.appData.keyColumns.dateForCalculation === colToDelete) state.appData.keyColumns.dateForCalculation = null;
            saveData(elements.temporalModeCheckbox); openColumnsModal(); showToast(`Columna "${colToDelete}" eliminada.`, 'success');
        }
    });
}

function moveColumn(header, direction) {
    const index = state.appData.headers.indexOf(header); const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= state.appData.headers.length) return;
    [state.appData.headers[index], state.appData.headers[newIndex]] = [state.appData.headers[newIndex], state.appData.headers[index]];
    saveData(elements.temporalModeCheckbox); openColumnsModal();
}

function handleColumnRename(oldHeader, newHeader) {
    newHeader = newHeader.trim().toUpperCase();
    if (!newHeader) { showToast('El nombre no puede estar vacío.', 'warning'); openColumnsModal(); return; }
    if (newHeader !== oldHeader && state.appData.headers.includes(newHeader)) { showToast('La columna ya existe.', 'warning'); openColumnsModal(); return; }
    const index = state.appData.headers.indexOf(oldHeader); if (index === -1) return;
    state.appData.headers[index] = newHeader;
    state.appData.mainData.forEach(row => { if (row.hasOwnProperty(oldHeader)) { row[newHeader] = row[oldHeader]; delete row[oldHeader]; } });
    if (state.appData.keyColumns.dateForCalculation === oldHeader) state.appData.keyColumns.dateForCalculation = newHeader;
    if (state.appData.keyColumns.daysDisplay === oldHeader) state.appData.keyColumns.daysDisplay = newHeader;
    if (state.appData.columnMetadata.hasOwnProperty(oldHeader)) { state.appData.columnMetadata[newHeader] = state.appData.columnMetadata[oldHeader]; delete state.appData.columnMetadata[oldHeader]; }
    if (state.appData.columnFormats.hasOwnProperty(oldHeader)) { state.appData.columnFormats[newHeader] = state.appData.columnFormats[oldHeader]; delete state.appData.columnFormats[oldHeader]; }
    if (state.appData.columnWidths.hasOwnProperty(oldHeader)) { state.appData.columnWidths[newHeader] = state.appData.columnWidths[oldHeader]; delete state.appData.columnWidths[oldHeader]; }
    if (state.appData.sortBy === oldHeader) state.appData.sortBy = newHeader;
    if (state.appData.colorCodingColumn === oldHeader) state.appData.colorCodingColumn = newHeader;
    if (state.appData.bulkDeleteColumn === oldHeader) state.appData.bulkDeleteColumn = newHeader;
    if (state.appData.hideSettings.column === oldHeader) state.appData.hideSettings.column = newHeader;
    if (state.appData.selectedRowIdentifierColumn === oldHeader) state.appData.selectedRowIdentifierColumn = newHeader;
    const oldListKey = `_list_${oldHeader}`;
    if (state.appData.referenceDB.hasOwnProperty(oldListKey)) { state.appData.referenceDB[`_list_${newHeader}`] = state.appData.referenceDB[oldListKey]; delete state.appData.referenceDB[oldListKey]; }
    (state.appData.lookupRelations || []).forEach(rel => { if (rel.keyColumn === oldHeader) rel.keyColumn = newHeader; if (rel.targetMap) Object.keys(rel.targetMap).forEach(key => { if (rel.targetMap[key] === oldHeader) rel.targetMap[key] = newHeader; }); });
    saveData(elements.temporalModeCheckbox); state.selectedColumnNameForDeletion = newHeader; openColumnsModal(); showToast(`Columna renombrada a "${newHeader}".`, "info");
}

function changeFontSize(amount) {
    let currentSize = state.appData.tableFontSize || 14; currentSize += amount;
    if (currentSize < 10) currentSize = 10; if (currentSize > 24) currentSize = 24;
    state.appData.tableFontSize = currentSize; elements.tableContainer.style.setProperty('--table-font-size', `${currentSize}px`);
    saveData(elements.temporalModeCheckbox);
}


// --- BASE DE DATOS / AJUSTES ---
function openDbModal() { renderDbTables(); elements.dbModal.classList.add('active'); }

function renderDbTables() {
    const dbTablesContainer = document.getElementById('db-tables-container');
    dbTablesContainer.innerHTML = '';
    const createSection = (title, dbKey = null) => {
        const section = document.createElement('div'); section.className = `space-y-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border dark:border-gray-700`;
        const headerDiv = document.createElement('div'); headerDiv.className = 'flex justify-between items-center'; headerDiv.innerHTML = `<h4 class="font-bold text-lg text-gray-800 dark:text-gray-100">${title}</h4>`;
        if (dbKey && dbKey.startsWith('_list_')) {
            const deleteBtn = document.createElement('button'); deleteBtn.className = 'text-xs bg-red-500 text-white font-semibold py-1 px-2 rounded-lg hover:bg-red-600'; deleteBtn.textContent = 'Eliminar Lista';
            deleteBtn.onclick = () => { const headerName = dbKey.replace('_list_', ''); showConfirmModal(`¿Seguro que quieres eliminar la lista "${headerName}"?`, () => { delete state.appData.referenceDB[dbKey]; if (state.appData.columnFormats[headerName]) state.appData.columnFormats[headerName] = 'text'; if (state.appData.colorCodingColumn === headerName) state.appData.colorCodingColumn = null; if (state.appData.hideSettings.column === headerName) state.appData.hideSettings.column = null; if (state.appData.bulkDeleteColumn === headerName) state.appData.bulkDeleteColumn = null; saveData(elements.temporalModeCheckbox); renderDbTables(); showToast(`Lista "${headerName}" eliminada.`, 'success'); }); };
            headerDiv.appendChild(deleteBtn);
        }
        section.appendChild(headerDiv); return section;
    };
    const leftCol = document.createElement('div'); leftCol.className = "space-y-6";
    const rightCol = document.createElement('div'); rightCol.className = "space-y-6";
    const listColumns = state.appData.headers.filter(h => state.appData.columnFormats[h] === 'list');

    // Identificador
    const identifierSection = createSection('Identificador de Fila Seleccionada');
    const identifierLabel = document.createElement('label'); identifierLabel.className = 'flex items-center gap-3 text-sm'; identifierLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Usar valor de columna:</span>`;
    const identifierSelect = document.createElement('select'); identifierSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full'; identifierSelect.innerHTML = state.appData.headers.map(h => `<option value="${h}" ${state.appData.selectedRowIdentifierColumn === h ? 'selected' : ''}>${h}</option>`).join('');
    identifierSelect.onchange = (e) => { state.appData.selectedRowIdentifierColumn = e.target.value; saveData(elements.temporalModeCheckbox); updateSelectedRowIdentifierDisplay(); showToast('Columna de identificación actualizada.', 'success'); };
    identifierLabel.appendChild(identifierSelect); identifierSection.appendChild(identifierLabel); leftCol.appendChild(identifierSection);

    // Color coding
    const colorCodingSection = createSection('Codificación de Color por Columna');
    const colorCodingLabel = document.createElement('label'); colorCodingLabel.className = 'flex items-center gap-3 text-sm'; colorCodingLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Colorear filas según:</span>`;
    const colorCodingSelect = document.createElement('select'); colorCodingSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full'; colorCodingSelect.innerHTML = `<option value="">-- Ninguna --</option>` + listColumns.map(h => `<option value="${h}" ${state.appData.colorCodingColumn === h ? 'selected' : ''}>${h}</option>`).join('');
    colorCodingSelect.onchange = (e) => { state.appData.colorCodingColumn = e.target.value || null; saveData(elements.temporalModeCheckbox); renderDbTables(); fullReloadUI(handleRowSelection, handleCellUpdate); showToast('Columna de color actualizada.', 'success'); };
    colorCodingLabel.appendChild(colorCodingSelect); colorCodingSection.appendChild(colorCodingLabel);
    if (state.appData.colorCodingColumn) {
        const colorDbKey = `_list_${state.appData.colorCodingColumn}`; const colorDbData = state.appData.referenceDB[colorDbKey];
        if (colorDbData) {
            const colorTable = document.createElement('table'); colorTable.className = 'w-full text-sm mt-4'; colorTable.innerHTML = `<thead class="border-b dark:border-gray-700 text-gray-700 dark:text-gray-300 text-center"><th class="p-2 text-left">Valor</th><th class="p-2">Fondo Claro</th><th class="p-2">Texto Claro</th><th class="p-2">Fondo Oscuro</th><th class="p-2">Texto Oscuro</th></thead>`;
            const colorTbody = document.createElement('tbody');
            const entries = [['__DEFAULT__', colorDbData['__DEFAULT__']], ...Object.entries(colorDbData).filter(([k]) => k !== '__DEFAULT__')];
            entries.forEach(([key, values]) => {
                if (!values) return; const tr = document.createElement('tr'); tr.className = "border-b dark:border-gray-600";
                tr.innerHTML = `<td class="p-1 font-semibold text-gray-800 dark:text-gray-200">${key === '__DEFAULT__' ? 'Por Defecto' : key}</td><td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.light || '#ffffff'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="light"></td><td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.textLight || '#000000'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="textLight"></td><td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.dark || '#111827'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="dark"></td><td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.textDark || '#f3f4f6'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="textDark"></td>`;
                colorTbody.appendChild(tr);
            });
            colorTable.appendChild(colorTbody); colorCodingSection.appendChild(colorTable);
        }
    }
    leftCol.appendChild(colorCodingSection);

    // Bulk delete
    const bulkDeleteSection = createSection('Eliminación Rápida por Columna');
    const bulkDeleteLabel = document.createElement('label'); bulkDeleteLabel.className = 'flex items-center gap-3 text-sm'; bulkDeleteLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Eliminar filas según:</span>`;
    const bulkDeleteSelect = document.createElement('select'); bulkDeleteSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full'; bulkDeleteSelect.innerHTML = `<option value="">-- Seleccionar --</option>` + listColumns.map(h => `<option value="${h}" ${state.appData.bulkDeleteColumn === h ? 'selected' : ''}>${h}</option>`).join('');
    bulkDeleteSelect.onchange = (e) => { state.appData.bulkDeleteColumn = e.target.value || null; saveData(elements.temporalModeCheckbox); renderDbTables(); };
    bulkDeleteLabel.appendChild(bulkDeleteSelect); bulkDeleteSection.appendChild(bulkDeleteLabel);
    const deleteCol = state.appData.bulkDeleteColumn;
    if (deleteCol) {
        const statusCounts = {}; const listKey = `_list_${deleteCol}`; const statusesForDeletion = state.appData.referenceDB[listKey] ? Object.keys(state.appData.referenceDB[listKey]).filter(k => k !== '__DEFAULT__') : [];
        statusesForDeletion.forEach(status => statusCounts[status] = 0); state.appData.mainData.forEach(row => { if (row[deleteCol] && statusCounts.hasOwnProperty(row[deleteCol])) statusCounts[row[deleteCol]]++; });
        const listContainer = document.createElement('div'); listContainer.className = 'space-y-2 mt-2';
        statusesForDeletion.forEach(status => { const count = statusCounts[status]; const label = document.createElement('label'); label.className = 'flex items-center justify-between p-2 rounded-md bg-white dark:bg-gray-700/50 cursor-pointer'; label.innerHTML = `<div class="flex items-center gap-3"><input type="checkbox" value="${status}" class="status-delete-checkbox h-5 w-5 rounded text-sky-600 focus:ring-sky-500" ${count === 0 ? 'disabled' : ''}><span class="font-semibold">${status}</span></div><span class="text-sm font-mono bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">${count}</span>`; listContainer.appendChild(label); });
        bulkDeleteSection.appendChild(listContainer);
        const dateConditionContainer = document.createElement('div'); dateConditionContainer.id = 'bulk-delete-date-condition'; dateConditionContainer.className = 'mt-4 pt-4 border-t dark:border-gray-600 space-y-2 hidden';
        const dateColLabel = document.createElement('label'); dateColLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300'; dateColLabel.textContent = '... con fecha anterior a (opcional):';
        const dateFlexContainer = document.createElement('div'); dateFlexContainer.className = 'flex gap-2 mt-1';
        const dateColumns2 = state.appData.headers.filter(h => state.appData.columnFormats[h] === 'date');
        const dateColumnSelect = document.createElement('select'); dateColumnSelect.id = 'bulk-delete-date-column'; dateColumnSelect.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
        if (dateColumns2.length > 0) dateColumnSelect.innerHTML = dateColumns2.map(h => `<option value="${h}">${h}</option>`).join(''); else { dateColumnSelect.innerHTML = `<option value="">No hay columnas de fecha</option>`; dateColumnSelect.disabled = true; }
        dateFlexContainer.appendChild(dateColumnSelect);
        const dateInput = createDateInputComponent('', null); dateInput.id = 'bulk-delete-date-input'; dateInput.placeholder = 'DD/MM/YYYY'; dateInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
        dateFlexContainer.appendChild(dateInput); dateColLabel.appendChild(dateFlexContainer); dateConditionContainer.appendChild(dateColLabel); bulkDeleteSection.appendChild(dateConditionContainer);
        const bulkDeleteButton = document.createElement('button'); bulkDeleteButton.id = 'execute-bulk-delete-btn'; bulkDeleteButton.className = 'w-full mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed'; bulkDeleteButton.textContent = 'Archivar y Eliminar Seleccionados'; bulkDeleteButton.disabled = true; bulkDeleteSection.appendChild(bulkDeleteButton);
    } else { bulkDeleteSection.innerHTML += `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Seleccione una columna para habilitar esta función.</p>`; }
    leftCol.appendChild(bulkDeleteSection);

    // Valores ocultos
    const hideSettingsSection = createSection('Valores Ocultos por Defecto');
    const hideSettingsLabel = document.createElement('label'); hideSettingsLabel.className = 'flex items-center gap-3 text-sm'; hideSettingsLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Ocultar valores de:</span>`;
    const hideSettingsSelect = document.createElement('select'); hideSettingsSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full'; hideSettingsSelect.innerHTML = `<option value="">-- Seleccionar --</option>` + listColumns.map(h => `<option value="${h}" ${state.appData.hideSettings.column === h ? 'selected' : ''}>${h}</option>`).join('');
    hideSettingsSelect.onchange = (e) => { state.appData.hideSettings.column = e.target.value || null; state.appData.hideSettings.hiddenValues = []; saveData(elements.temporalModeCheckbox); renderDbTables(); fullReloadUI(handleRowSelection, handleCellUpdate); };
    hideSettingsLabel.appendChild(hideSettingsSelect); hideSettingsSection.appendChild(hideSettingsLabel);
    const hideCol = state.appData.hideSettings.column;
    if (hideCol) {
        const hiddenStatusesContainer = document.createElement('div'); hiddenStatusesContainer.className = "grid grid-cols-2 md:grid-cols-3 gap-2 mt-2";
        const valuesToHide = state.appData.referenceDB[`_list_${hideCol}`] ? Object.keys(state.appData.referenceDB[`_list_${hideCol}`]).filter(k => k !== '__DEFAULT__') : [];
        if (valuesToHide.length > 0) { valuesToHide.forEach(value => { const label = document.createElement('label'); label.className = 'flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-md'; const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = value; checkbox.checked = (state.appData.hideSettings.hiddenValues || []).includes(value); checkbox.className = 'h-5 w-5 rounded text-sky-600 focus:ring-sky-500'; checkbox.onchange = (e) => { if (!state.appData.hideSettings.hiddenValues) state.appData.hideSettings.hiddenValues = []; if (e.target.checked) { if (!state.appData.hideSettings.hiddenValues.includes(value)) state.appData.hideSettings.hiddenValues.push(value); } else { state.appData.hideSettings.hiddenValues = state.appData.hideSettings.hiddenValues.filter(s => s !== value); } saveData(elements.temporalModeCheckbox); fullReloadUI(handleRowSelection, handleCellUpdate); }; label.appendChild(checkbox); label.append(value); hiddenStatusesContainer.appendChild(label); }); }
        else { hiddenStatusesContainer.innerHTML = `<p class="text-sm text-gray-500 col-span-full">No hay valores definidos para "${hideCol}".</p>`; }
        hideSettingsSection.appendChild(hiddenStatusesContainer);
    } else { hideSettingsSection.innerHTML += `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Seleccione una columna para habilitar esta función.</p>`; }
    rightCol.appendChild(hideSettingsSection);

    // Alertas visuales
    const alertsSection = createSection('Alertas Visuales por Vencimiento (DIAS)');
    const alertsTable = document.createElement('table'); alertsTable.className = 'w-full text-sm'; alertsTable.innerHTML = `<thead class="border-b dark:border-gray-700 text-gray-700 dark:text-gray-300 text-center"><th class="p-2 text-left">Activo</th><th class="p-2">Fondo</th><th class="p-2">Texto</th><th class="p-2">Condición</th><th class="p-2">Valor</th><th class="p-2"></th></thead>`;
    const alertsTbody = document.createElement('tbody');
    (state.appData.visualAlerts || []).forEach(alert => { const tr = document.createElement('tr'); tr.className = "border-b dark:border-gray-600"; tr.innerHTML = `<td class="p-1"><input type="checkbox" class="alert-input h-5 w-5 rounded" ${alert.enabled ? 'checked' : ''} data-id="${alert.id}" data-field="enabled"></td><td class="p-1"><input type="color" class="alert-input-color w-full h-8 p-0 border-0 bg-transparent rounded" value="${alert.color.bg}" data-id="${alert.id}" data-field="bg"></td><td class="p-1"><input type="color" class="alert-input-color w-full h-8 p-0 border-0 bg-transparent rounded" value="${alert.color.text}" data-id="${alert.id}" data-field="text"></td><td class="p-1"><select class="alert-input w-full bg-gray-50 dark:bg-gray-700 p-2 border rounded dark:border-gray-600" data-id="${alert.id}" data-field="condition"><option value=">=" ${alert.condition === '>=' ? 'selected' : ''}>&gt;=</option><option value="<=" ${alert.condition === '<=' ? 'selected' : ''}>&lt;=</option><option value="=" ${alert.condition === '=' ? 'selected' : ''}>=</option></select></td><td class="p-1"><input type="number" class="alert-input w-full bg-gray-50 dark:bg-gray-700 p-2 border rounded dark:border-gray-600" value="${alert.value}" data-id="${alert.id}" data-field="value"></td><td class="p-1 text-center"><button class="alert-delete-btn text-red-500 hover:text-red-700 font-bold" data-id="${alert.id}">X</button></td>`; alertsTbody.appendChild(tr); });
    alertsTable.appendChild(alertsTbody); alertsSection.appendChild(alertsTable);
    const addAlertBtn = document.createElement('button'); addAlertBtn.className = "mt-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800"; addAlertBtn.textContent = '+ Añadir Alerta'; addAlertBtn.onclick = () => { if (!state.appData.visualAlerts) state.appData.visualAlerts = []; state.appData.visualAlerts.push({ id: Date.now(), enabled: true, color: { bg: '#fee2e2', text: '#991b1b' }, condition: '>=', value: '15' }); renderDbTables(); saveData(elements.temporalModeCheckbox); }; alertsSection.appendChild(addAlertBtn);
    rightCol.appendChild(alertsSection);

    // Rows per page
    const visualSettingsSection = createSection('Ajustes de Visualización');
    const rowsPerPageLabel = document.createElement('label'); rowsPerPageLabel.className = 'flex items-center gap-3 text-sm'; rowsPerPageLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Filas por página:</span>`;
    const rowsPerPageSelect = document.createElement('select'); rowsPerPageSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700';
    [3, 10, 15].forEach(num => { const option = document.createElement('option'); option.value = num; option.textContent = num; if (state.appData.rowsPerPage == num) option.selected = true; rowsPerPageSelect.appendChild(option); });
    rowsPerPageSelect.onchange = (e) => { state.appData.rowsPerPage = parseInt(e.target.value, 10); state.currentPage = 1; saveData(elements.temporalModeCheckbox); fullReloadUI(handleRowSelection, handleCellUpdate); showToast('Ajuste de filas guardado.', 'success'); };
    rowsPerPageLabel.appendChild(rowsPerPageSelect); visualSettingsSection.appendChild(rowsPerPageLabel); leftCol.appendChild(visualSettingsSection);

    // PDF filename
    const pdfFilenameSection = createSection('Formato de Nombre para Archivos PDF');
    pdfFilenameSection.innerHTML += `<p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">Define cómo se nombrarán los archivos PDF.</p>`;
    const filenameInput = document.createElement('input'); filenameInput.type = 'text'; filenameInput.id = 'pdf-filename-format-input'; filenameInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm'; filenameInput.value = state.appData.pdfFilenameFormat || ''; filenameInput.oninput = (e) => { state.appData.pdfFilenameFormat = e.target.value; saveData(elements.temporalModeCheckbox); };
    pdfFilenameSection.appendChild(filenameInput);
    const filenamePlaceholders = document.createElement('div'); filenamePlaceholders.className = 'flex flex-wrap gap-2 pt-2';
    [...state.appData.headers, 'fecha_actual', 'nombre_plantilla'].forEach(h => { const btn = document.createElement('button'); btn.className = "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 text-xs font-mono font-semibold px-2 py-1 rounded-md hover:bg-sky-200"; btn.textContent = h; btn.onclick = () => { const inp = document.getElementById('pdf-filename-format-input'); const placeholder = `{{${h}}}`; const start = inp.selectionStart; const end = inp.selectionEnd; inp.value = inp.value.substring(0, start) + placeholder + inp.value.substring(end); inp.focus(); inp.selectionEnd = start + placeholder.length; state.appData.pdfFilenameFormat = inp.value; saveData(elements.temporalModeCheckbox); }; filenamePlaceholders.appendChild(btn); });
    pdfFilenameSection.appendChild(filenamePlaceholders); leftCol.appendChild(pdfFilenameSection);

    // Lookups
    const lookupSection = createSection('Búsquedas Automáticas (VLOOKUP)');
    (state.appData.lookupRelations || []).forEach(rel => {
        const relContainer = document.createElement('div'); relContainer.className = 'p-3 my-2 bg-white dark:bg-gray-700 rounded-lg border dark:border-gray-600';
        const relHeader = document.createElement('div'); relHeader.className = 'flex justify-between items-center mb-2'; relHeader.innerHTML = `<h5 class="font-bold">${rel.name}</h5><button class="lookup-delete-btn text-red-500 hover:text-red-700 text-xl" data-id="${rel.id}">&times;</button>`;
        relContainer.appendChild(relHeader);
        const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3 text-sm';
        const keyColLabel2 = document.createElement('label'); keyColLabel2.className = 'block space-y-1 col-span-full'; keyColLabel2.innerHTML = `<span>Cuando se edite la columna:</span>`;
        const keyColSelect2 = document.createElement('select'); keyColSelect2.className = 'w-full bg-gray-50 dark:bg-gray-800 p-2 border rounded dark:border-gray-500'; keyColSelect2.innerHTML = `<option value="">-- Seleccionar --</option>${state.appData.headers.map(h => `<option value="${h}" ${rel.keyColumn === h ? 'selected' : ''}>${h}</option>`).join('')}`; keyColSelect2.onchange = (e) => { rel.keyColumn = e.target.value; saveData(elements.temporalModeCheckbox); }; keyColLabel2.appendChild(keyColSelect2); grid.appendChild(keyColLabel2);
        const sourceDbFields = Object.keys(state.appData.referenceDB[rel.sourceDB]?.['__FIELDS__'] || {});
        sourceDbFields.forEach(sourceField => { const targetColLabel = document.createElement('label'); targetColLabel.className = 'block space-y-1'; targetColLabel.innerHTML = `<span>Poblar la columna (con <b>${sourceField}</b>):</span>`; const targetColSelect = document.createElement('select'); targetColSelect.className = 'w-full bg-gray-50 dark:bg-gray-800 p-2 border rounded dark:border-gray-500'; targetColSelect.innerHTML = `<option value="">-- No Poblar --</option>${state.appData.headers.map(h => `<option value="${h}" ${rel.targetMap[sourceField] === h ? 'selected' : ''}>${h}</option>`).join('')}`; targetColSelect.onchange = (e) => { rel.targetMap[sourceField] = e.target.value; saveData(elements.temporalModeCheckbox); }; targetColLabel.appendChild(targetColSelect); grid.appendChild(targetColLabel); });
        relContainer.appendChild(grid); lookupSection.appendChild(relContainer);
    });
    const addLookupBtn = document.createElement('button'); addLookupBtn.className = "mt-2 text-sm text-sky-600 dark:text-sky-400"; addLookupBtn.textContent = '+ Añadir Búsqueda Automática'; addLookupBtn.onclick = addLookupRelation; lookupSection.appendChild(addLookupBtn); rightCol.appendChild(lookupSection);

    // Reference DB tables
    Object.entries(state.appData.referenceDB).forEach(([dbKey, data]) => {
        let config;
        if (dbKey.startsWith('_list_')) { const listName = dbKey.replace('_list_', ''); config = { title: `Valores para Lista: ${listName}`, fields: [{ name: 'key', isKey: true, placeholder: `Valor de ${listName}` }] }; data = Object.keys(data).reduce((acc, key) => { acc[key] = { value: key }; return acc; }, {}); }
        else if (dbKey.startsWith('_lookup_')) { const relation = (state.appData.lookupRelations || []).find(r => r.sourceDB === dbKey); const fieldData = data['__FIELDS__'] || {}; config = { isLookup: true, title: `Datos para: ${relation ? relation.name : dbKey}`, fields: [{ name: 'code', isKey: true, placeholder: 'Código' }, ...Object.keys(fieldData).map(f => ({ name: f, placeholder: f, type: fieldData[f] }))] }; }
        else { return; }
        const section = createSection(config.title, dbKey);
        const table = document.createElement('table'); table.className = 'w-full text-sm';
        const thead2 = document.createElement('thead'); thead2.className = 'border-b dark:border-gray-700 text-gray-700 dark:text-gray-300';
        let headerCells = config.fields.map(f => { let content = f.placeholder; if (config.isLookup && !f.isKey) content = `<input class="w-full bg-transparent font-bold text-center" value="${f.placeholder}" data-db-key="${dbKey}" data-field-rename="${f.placeholder}">`; return `<th class="p-2 text-center">${content}</th>`; }).join('');
        thead2.innerHTML = `<tr>${headerCells}<th class="p-2"></th></tr>`; table.appendChild(thead2);
        const tbody2 = document.createElement('tbody');
        Object.entries(data).forEach(([key, values]) => {
            if (key === '__FIELDS__' || !values) return;
            const isDefaultRow = key === '__DEFAULT__'; const tr = document.createElement('tr'); tr.className = "border-b dark:border-gray-600";
            let cells = config.fields.map(field => { let valueForField = ''; if (field.isKey) valueForField = isDefaultRow ? 'Valor Vacío / Por Defecto' : key; else valueForField = values[field.name] || ''; const inputHtml = `<input class="w-full bg-gray-50 dark:bg-gray-700 p-2 border rounded dark:border-gray-600 text-center" value="${valueForField}" data-db-key="${dbKey}" data-entry-key="${key}" data-field="${field.name}" ${field.isKey ? 'data-is-key="true"' : ''} ${isDefaultRow && field.isKey ? 'disabled' : ''}>`; return `<td class="p-1 align-middle">${inputHtml}</td>`; }).join('');
            const deleteButton = isDefaultRow ? '' : `<button class="db-delete-btn text-red-500 hover:text-red-700 font-bold" data-db-key="${dbKey}" data-entry-key="${key}">X</button>`;
            tr.innerHTML = `${cells}<td class="p-1 text-center">${deleteButton}</td>`; tbody2.appendChild(tr);
        });
        table.appendChild(tbody2); section.appendChild(table);
        const addBtn = document.createElement('button'); addBtn.className = "mt-2 text-sm text-sky-600 dark:text-sky-400"; addBtn.textContent = `+ Añadir a ${config.title}`; addBtn.onclick = () => addDbEntry(dbKey, config); section.appendChild(addBtn);
        if (dbKey.startsWith('_lookup_')) rightCol.appendChild(section); else leftCol.appendChild(section);
    });
    dbTablesContainer.appendChild(leftCol); dbTablesContainer.appendChild(rightCol);
}

function addLookupRelation() {
    showPromptModal("Ingrese un nombre para la nueva búsqueda:", (name) => {
        const id = `rel_${Date.now()}`; const sourceDB = `_lookup_${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${Date.now()}`;
        if (state.appData.referenceDB[sourceDB]) return showToast('Error: ya existe una BD similar.', 'error');
        state.appData.lookupRelations.push({ id, name, enabled: true, keyColumn: '', sourceDB, targetMap: { 'Dato 1': '', 'Dato 2': '' } });
        state.appData.referenceDB[sourceDB] = { '__FIELDS__': { 'Dato 1': 'text', 'Dato 2': 'text' } };
        saveData(elements.temporalModeCheckbox); renderDbTables();
    });
}

function addDbEntry(dbKey, config) {
    showPromptModal(`Ingrese el nuevo valor para la lista "${config.title}":`, (newKey) => {
        if (!state.appData.referenceDB[dbKey][newKey]) {
            const newEntry = {};
            if (dbKey.startsWith('_list_')) { newEntry.light = '#ffffff'; newEntry.textLight = '#000000'; newEntry.dark = '#1f2937'; newEntry.textDark = '#f3f4f6'; }
            (config.fields || []).forEach(field => { if (!field.isKey) newEntry[field.name] = ''; });
            state.appData.referenceDB[dbKey][newKey] = newEntry; renderDbTables(); saveData(elements.temporalModeCheckbox);
        } else { showToast('Ese identificador ya existe.', 'warning'); }
    });
}

function handleDbUpdate(e) {
    const input = e.target; const { dbKey, entryKey, field, isKey: isKeyStr, fieldRename } = input.dataset;
    if (!dbKey) return;
    const value = input.value; const isKey = isKeyStr === "true";
    if (fieldRename) {
        const newFieldName = value.trim(); if (!newFieldName || newFieldName === fieldRename) return;
        const fields = state.appData.referenceDB[dbKey]['__FIELDS__'];
        if (fields && fields[newFieldName]) { showToast('Ese nombre de campo ya existe.', 'warning'); input.value = fieldRename; return; }
        const oldType = fields[fieldRename]; delete fields[fieldRename]; fields[newFieldName] = oldType;
        Object.keys(state.appData.referenceDB[dbKey]).forEach(key => { if (key !== '__FIELDS__') { state.appData.referenceDB[dbKey][key][newFieldName] = state.appData.referenceDB[dbKey][key][fieldRename]; delete state.appData.referenceDB[dbKey][key][fieldRename]; } });
        (state.appData.lookupRelations || []).forEach(rel => { if (rel.sourceDB === dbKey && rel.targetMap[fieldRename]) { rel.targetMap[newFieldName] = rel.targetMap[fieldRename]; delete rel.targetMap[fieldRename]; } });
        saveData(elements.temporalModeCheckbox); renderDbTables(); return;
    }
    if (isKey) {
        if (value && value !== entryKey && !state.appData.referenceDB[dbKey][value]) {
            const oldData = { ...state.appData.referenceDB[dbKey][entryKey] }; delete state.appData.referenceDB[dbKey][entryKey]; state.appData.referenceDB[dbKey][value] = oldData;
            if (dbKey.startsWith('_list_')) { const listColumn = dbKey.replace('_list_', ''); state.appData.mainData.forEach(row => { if (row[listColumn] === entryKey) row[listColumn] = value; }); }
            renderDbTables();
        } else if (value !== entryKey) { showToast('El nuevo código ya existe o está vacío.', 'warning'); input.value = entryKey; return; }
    } else { if (state.appData.referenceDB[dbKey]?.[entryKey] && typeof field !== 'undefined') state.appData.referenceDB[dbKey][entryKey][field] = value; }
    saveData(elements.temporalModeCheckbox); fullReloadUI(handleRowSelection, handleCellUpdate);
}

function handleColorDbUpdate(e) {
    const input = e.target; const { dbKey, entryKey, field } = input.dataset; if (!dbKey || !entryKey || !field) return;
    if (state.appData.referenceDB[dbKey]?.[entryKey]) { state.appData.referenceDB[dbKey][entryKey][field] = input.value; saveData(elements.temporalModeCheckbox); fullReloadUI(handleRowSelection, handleCellUpdate); }
}

function handleDbDelete(e) {
    const button = e.target.closest('.db-delete-btn, .lookup-delete-btn'); if (!button) return;
    if (button.classList.contains('lookup-delete-btn')) {
        const { id } = button.dataset; const relation = (state.appData.lookupRelations || []).find(r => r.id === id);
        if (relation) showConfirmModal(`¿Eliminar la búsqueda "${relation.name}"?`, () => { delete state.appData.referenceDB[relation.sourceDB]; state.appData.lookupRelations = state.appData.lookupRelations.filter(r => r.id !== id); saveData(elements.temporalModeCheckbox); renderDbTables(); });
        return;
    }
    if (button.classList.contains('db-delete-btn') && button.dataset.dbKey) {
        const { dbKey, entryKey } = button.dataset;
        showConfirmModal(`¿Eliminar la entrada "${entryKey}"?`, () => { delete state.appData.referenceDB[dbKey][entryKey]; renderDbTables(); saveData(elements.temporalModeCheckbox); fullReloadUI(handleRowSelection, handleCellUpdate); });
    }
}

function handleAlertsDbUpdate(e) {
    const input = e.target.closest('.alert-input, .alert-input-color'); if (!input) return;
    const { id, field } = input.dataset; if (!id || !field) return;
    const alert = (state.appData.visualAlerts || []).find(a => a.id == id); if (!alert) return;
    if (input.type === 'checkbox') alert[field] = input.checked;
    else if (field === 'bg' || field === 'text') alert.color[field] = input.value;
    else alert[field] = input.value;
    saveData(elements.temporalModeCheckbox); sortAndApplyFilters(handleRowSelection, handleCellUpdate);
}

function handleAlertsDbDelete(e) {
    const button = e.target.closest('.alert-delete-btn');
    if (button && button.dataset.id) showConfirmModal('¿Eliminar esta alerta visual?', () => { state.appData.visualAlerts = (state.appData.visualAlerts || []).filter(a => a.id != button.dataset.id); saveData(elements.temporalModeCheckbox); renderDbTables(); sortAndApplyFilters(handleRowSelection, handleCellUpdate); });
}

async function handleBulkDelete() {
    const checkedBoxes = document.querySelectorAll('.status-delete-checkbox:checked'); if (checkedBoxes.length === 0) return;
    const deleteCol = state.appData.bulkDeleteColumn; if (!deleteCol) { showToast('No se ha seleccionado una columna.', 'error'); return; }
    const selectedValues = Array.from(checkedBoxes).map(cb => cb.value);
    const dateColumn = document.getElementById('bulk-delete-date-column').value;
    const dateLimitStr = document.getElementById('bulk-delete-date-input').value;
    const dateLimit = dateLimitStr ? parseDate(dateLimitStr) : null; if (dateLimit) dateLimit.setUTCHours(0, 0, 0, 0);
    let rowsToDeleteQuery = state.appData.mainData.filter(row => selectedValues.includes(row[deleteCol]));
    if (dateLimit && dateColumn) { rowsToDeleteQuery = rowsToDeleteQuery.filter(row => { const rowDate = parseDate(row[dateColumn]); if (!rowDate) return false; rowDate.setUTCHours(0, 0, 0, 0); return rowDate < dateLimit; }); }
    if (rowsToDeleteQuery.length === 0) { showToast('No se encontraron filas que coincidan.', 'info'); return; }
    const idsToDelete = new Set(rowsToDeleteQuery.map(r => r.id)); const rowsToKeep = state.appData.mainData.filter(row => !idsToDelete.has(row.id));
    let confirmationMessage = `Se encontraron ${rowsToDeleteQuery.length} filas para [${selectedValues.join(', ')}] en "${deleteCol}"`;
    if (dateLimitStr && dateColumn) confirmationMessage += ` con fecha en "${dateColumn}" anterior a ${dateLimitStr}`;
    confirmationMessage += '.\n\nSe generará un respaldo en Excel antes de eliminarlas. ¿Continuar?';
    showConfirmModal(confirmationMessage, () => {
        const filename = `gtn_respaldo_eliminados_${getFormattedDateForFilename()}.xlsx`;
        const exported = exportDataToExcel(rowsToDeleteQuery, filename);
        if (exported) { showToast('Respaldo en Excel generado.', 'info'); setTimeout(() => { showConfirmModal(`ADVERTENCIA: Está a punto de eliminar permanentemente ${rowsToDeleteQuery.length} filas. ¿Confirmar?`, () => { state.appData.mainData = rowsToKeep; saveData(elements.temporalModeCheckbox); showToast(`${rowsToDeleteQuery.length} filas eliminadas.`, 'success'); renderDbTables(); fullReloadUI(handleRowSelection, handleCellUpdate); }, 'Confirmación Final'); }, 1000); }
    }, 'Respaldar y Continuar');
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
    let searchDebounceTimer;
    elements.searchInput.addEventListener('input', () => { clearTimeout(searchDebounceTimer); searchDebounceTimer = setTimeout(() => { state.currentPage = 1; sortAndApplyFilters(handleRowSelection, handleCellUpdate); }, 300); });
    elements.addRowBtn.addEventListener('click', () => addRow());
    elements.deleteRowBtn.addEventListener('click', deleteRow);
    elements.increaseFontSizeBtn.addEventListener('click', () => changeFontSize(1));
    elements.decreaseFontSizeBtn.addEventListener('click', () => changeFontSize(-1));
    elements.tableFontColorPicker.addEventListener('input', (e) => { state.appData.tableTextColor = e.target.value; elements.tableContainer.style.setProperty('--table-text-color', state.appData.tableTextColor); saveData(elements.temporalModeCheckbox); });

    elements.manageColsBtn.addEventListener('click', openColumnsModal);
    elements.columnsModal.addEventListener('click', (e) => {
        if (e.target.id === 'add-col-btn') addColumn();
        if (e.target.id === 'delete-col-btn') deleteColumn();
        if (e.target.id === 'close-columns-btn') { elements.columnsModal.classList.remove('active'); fullReloadUI(handleRowSelection, handleCellUpdate); }
    });

    elements.exportAllBtn.addEventListener('click', exportAllData);
    elements.exportExcelBtn.addEventListener('click', exportFilteredToExcel);
    elements.importAllBtn.addEventListener('click', () => elements.importAllInput.click());
    elements.importAllInput.addEventListener('change', importAllData);

    elements.templateSelectDropdown.addEventListener('change', (e) => { state.selectedTemplateId = e.target.value || null; updateSelectionStatus(); });
    elements.createTemplateBtn.addEventListener('click', () => openTemplateModal());
    elements.editSelectedTemplateBtn.addEventListener('click', () => state.selectedTemplateId && openTemplateModal(state.selectedTemplateId));
    elements.deleteSelectedTemplateBtn.addEventListener('click', () => { if (state.selectedTemplateId) { const t = state.appData.templates.find(x => x.id === state.selectedTemplateId); if (t) deleteTemplate(t.id, t.name); } });

    elements.templateModal.addEventListener('click', (e) => {
        if (e.target.id === 'save-template-btn') saveTemplate();
        if (e.target.id === 'cancel-template-btn') elements.templateModal.classList.remove('active');
        const moveBtn = e.target.closest('.move-manual-field-btn');
        if (moveBtn && !moveBtn.disabled) moveManualField(moveBtn.dataset.field, parseInt(moveBtn.dataset.direction, 10));
        if (e.target.id === 'add-manual-field-btn') {
            const manualFieldInput = document.getElementById('manual-field-input'); const fieldName = manualFieldInput.value.trim(); if (!fieldName) return;
            showConfirmModal(`¿Qué tipo de campo es "${fieldName}"?\n\n- Confirmar: Campo de Texto.\n- Cancelar: Campo de Imagen.`, () => { addTemplatePlaceholder(fieldName, 'text'); manualFieldInput.value = ''; }, 'Tipo de Campo');
            const confirmBtn = document.getElementById('confirm-submit-btn'); const cancelBtn = document.getElementById('confirm-cancel-btn');
            confirmBtn.textContent = 'Texto'; confirmBtn.className = 'bg-sky-600 text-white font-bold py-2 px-5 rounded-lg';
            cancelBtn.textContent = 'Imagen'; cancelBtn.className = 'bg-purple-600 text-white font-bold py-2 px-5 rounded-lg';
            const customCancelHandler = () => { addTemplatePlaceholder(fieldName, 'image'); manualFieldInput.value = ''; elements.confirmModal.classList.remove('active'); cancelBtn.removeEventListener('click', customCancelHandler); };
            const originalOnclick = confirmBtn.onclick;
            confirmBtn.onclick = (event) => { if (originalOnclick) originalOnclick(event); cancelBtn.removeEventListener('click', customCancelHandler); };
            cancelBtn.addEventListener('click', customCancelHandler, { once: true });
        }
        if (e.target.id === 'format-bold-btn') applyTextFormat('bold');
        if (e.target.id === 'format-italic-btn') applyTextFormat('italic');
    });

    elements.generatePdfBtn.addEventListener('click', generatePDF);
    elements.manualVarsModal.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); processAndShowPreview(); });
    elements.manualVarsModal.addEventListener('click', (e) => { if (e.target.id === 'submit-manual-vars-btn') processAndShowPreview(); if (e.target.id === 'cancel-manual-vars-btn') elements.manualVarsModal.classList.remove('active'); });
    elements.previewModal.addEventListener('click', (e) => { if (e.target.id === 'download-pdf-btn') downloadPDF(); if (e.target.id === 'cancel-preview-btn') elements.previewModal.classList.remove('active'); });
    elements.imageUploadModal.addEventListener('click', (e) => {
        if (e.target.id === 'cancel-image-upload-btn') { elements.imageUploadModal.classList.remove('active'); state.pendingPDFGeneration = null; }
        if (e.target.id === 'submit-image-upload-btn') {
            const form = document.getElementById('image-upload-form');
            if (form.checkValidity()) { const manualVars = state.pendingPDFGeneration.template.manualFields || []; if (manualVars.length > 0) { elements.imageUploadModal.classList.remove('active'); promptForManualVars(manualVars); } else { processAndShowPreview(); } }
            else { showToast('Por favor, adjunta todas las imágenes requeridas.', 'warning'); }
        }
    });

    elements.manageDbBtn.addEventListener('click', openDbModal);
    elements.dbModal.addEventListener('click', (e) => {
        if (e.target.id === 'close-db-btn') { elements.dbModal.classList.remove('active'); fullReloadUI(handleRowSelection, handleCellUpdate); }
        if (e.target.id === 'export-db-btn') exportDb();
        if (e.target.closest('.alert-delete-btn')) handleAlertsDbDelete(e);
        else if (e.target.id === 'execute-bulk-delete-btn') handleBulkDelete();
        else handleDbDelete(e);
    });
    elements.dbModal.addEventListener('focusout', e => { if (e.target.tagName === 'INPUT' && e.target.dataset.dbKey && e.target.dataset.isKey === 'true') handleDbUpdate(e); });
    elements.dbModal.addEventListener('change', e => {
        if (e.target.classList.contains('alert-input') || e.target.classList.contains('alert-input-color')) handleAlertsDbUpdate(e);
        else if (e.target.classList.contains('db-color-input')) handleColorDbUpdate(e);
        else if (e.target.dataset.dbKey) handleDbUpdate(e);
        else if (e.target.classList.contains('status-delete-checkbox')) {
            const checkedBoxes = document.querySelectorAll('.status-delete-checkbox:checked');
            document.getElementById('execute-bulk-delete-btn').disabled = checkedBoxes.length === 0;
            const dateConditionContainer = document.getElementById('bulk-delete-date-condition');
            if (dateConditionContainer) dateConditionContainer.classList.toggle('hidden', checkedBoxes.length === 0);
        }
    });

    elements.themeToggle.addEventListener('click', () => { const newTheme = elements.htmlTag.classList.contains('dark') ? 'light' : 'dark'; applyTheme(newTheme, handleRowSelection, handleCellUpdate); });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            elements.loadingOverlay.classList.add('active');
            setTimeout(() => { recalculateAllDays(elements.temporalModeCheckbox); fullReloadUI(handleRowSelection, handleCellUpdate); elements.loadingOverlay.classList.remove('active'); }, 100);
        }
    });

    elements.temporalModeCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked; const url = new URL(window.location); const action = isChecked ? 'activar' : 'desactivar';
        showConfirmModal(`¿${action.charAt(0).toUpperCase() + action.slice(1)} el modo temporal? La página se recargará.`, () => { if (isChecked) url.searchParams.set('temporal', 'true'); else url.searchParams.delete('temporal'); window.location.href = url.href; }, 'Cambiar Modo');
        const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
        const cancelHandler = () => { e.target.checked = !isChecked; confirmCancelBtn.removeEventListener('click', cancelHandler); };
        confirmCancelBtn.addEventListener('click', cancelHandler);
    });
}

// --- INICIALIZACIÓN ---
function init() {
    elements.loadingOverlay.classList.add('active');
    populateModals();
    loadData(elements.temporalModeCheckbox, addRow);
    setupEventListeners();
    recalculateAllDays(elements.temporalModeCheckbox);
    const savedTheme = localStorage.getItem('theme');
    applyTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), handleRowSelection, handleCellUpdate);
    elements.tableFontColorPicker.value = state.appData.tableTextColor === 'inherit' ? '#000000' : state.appData.tableTextColor;
    updateSelectedRowIdentifierDisplay();
    console.log("GTN v12 (Modular) inicializado.");
    setTimeout(() => { elements.loadingOverlay.classList.remove('active'); }, 250);
}

init();
