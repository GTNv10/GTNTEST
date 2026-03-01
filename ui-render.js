// js/ui-render.js — Manipulación del DOM y Renderizado de la Interfaz

import { state, saveData } from './state.js';
import { elements } from './elements.js';
import { showToast, parseDate, formatDate, calculateDays, createDateInputComponent } from './utils.js';

// --- MODALES ESTRUCTURALES ---

export function populateModals() {
    const createAndAppend = (id, html) => {
        let container = document.getElementById(id);
        if (!container) { container = document.createElement('div'); container.id = id; document.body.appendChild(container); }
        container.className = "modal fixed inset-0 bg-black bg-opacity-50 items-center justify-center p-4 z-50";
        container.innerHTML = html;
        return container;
    };

    elements.templateModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-4xl max-h-[90vh] overflow-y-auto"><h3 id="modal-title" class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">Crear/Editar Plantilla</h3><div class="space-y-6"><input type="hidden" id="template-id"><div class="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label for="template-name" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nombre</label><input type="text" id="template-name" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Ej: Notificación de Vencimiento"></div><div><label for="template-font" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Tipo de Letra (PDF)</label><select id="template-font" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200"><option value="Helvetica">Helvetica (Normal)</option><option value="Times">Times (Serif)</option><option value="Courier">Courier (Monoespaciada)</option></select></div></div><div><label class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Variables (clic para insertar)</label><div id="placeholders-container" class="flex flex-wrap gap-2 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600 min-h-[60px]"></div></div><div><label for="manual-field-input" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">Añadir Campo de Pregunta (Manual)</label><div class="flex gap-2"><input type="text" id="manual-field-input" class="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Nombre del campo, ej: Fecha de Notificación"><button id="add-manual-field-btn" type="button" class="bg-purple-500 text-white font-semibold px-4 py-2 rounded-lg hover:bg-purple-600 text-nowrap">Añadir</button></div></div><div><label for="template-content" class="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Contenido</label><div class="flex items-center gap-2 mb-2"><button id="format-bold-btn" type="button" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-3 py-1 rounded-md text-sm font-bold hover:bg-gray-300 dark:hover:bg-gray-500" title="Negrita">B</button><button id="format-italic-btn" type="button" class="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-100 px-3 py-1 rounded-md text-sm italic hover:bg-gray-300 dark:hover:bg-gray-500" title="Cursiva">C</button></div><textarea id="template-content" rows="12" class="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" placeholder="Escribe aquí... Usa {{Variable}} para insertar datos."></textarea></div></div><div class="mt-8 flex justify-end space-x-3"><button id="cancel-template-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cancelar</button><button id="save-template-btn" class="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg">Guardar</button></div></div>`;
    elements.manualVarsModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md max-h-[90vh] overflow-y-auto"><h3 class="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Completar Datos Manuales</h3><form id="manual-vars-form" class="space-y-4"></form><div class="mt-8 flex justify-end space-x-3"><button id="cancel-manual-vars-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cancelar</button><button id="submit-manual-vars-btn" class="bg-sky-600 text-white font-bold py-3 px-6 rounded-lg">Continuar</button></div></div>`;
    elements.previewModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-3xl max-h-[90vh] overflow-y-auto"><h3 class="text-3xl font-bold mb-6 text-gray-900 dark:text-gray-100">Previsualizar y Generar PDF</h3><pre id="preview-text" class="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 max-h-72 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 rounded border dark:border-gray-600 font-sans leading-relaxed"></pre><div class="mt-8 flex justify-end space-x-3"><button id="cancel-preview-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cancelar</button><button id="download-pdf-btn" class="bg-green-500 text-white font-bold py-3 px-6 rounded-lg">Descargar PDF</button></div></div>`;
    elements.dbModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 w-screen h-screen max-w-none max-h-none rounded-none shadow-2xl p-6 flex flex-col"><div class="flex justify-between items-center mb-4 pb-4 border-b dark:border-gray-700"><h3 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestionar Bases de Datos y Ajustes</h3><div class="flex items-center gap-4"><button id="export-db-btn" class="bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600">Exportar BD (JSON)</button><button id="close-db-btn" class="text-4xl text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400">&times;</button></div></div><div id="db-tables-container" class="flex-grow overflow-y-auto pr-4 grid grid-cols-1 lg:grid-cols-2 gap-8"></div></div>`;
    elements.columnsModal.innerHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-5xl max-h-[90vh] flex flex-col"><div class="flex justify-between items-center mb-6"><h3 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Gestionar Columnas</h3><div><button id="add-col-btn" class="bg-sky-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-sky-600 mr-2">Añadir Columna</button><button id="delete-col-btn" class="bg-red-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-red-600 disabled:bg-gray-400" disabled>Eliminar Seleccionada</button></div></div><div id="column-key-settings" class="mb-4 p-3 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg"></div><div class="flex-grow overflow-y-auto pr-4 space-y-2" id="columns-list"></div><div class="mt-8 pt-4 border-t dark:border-gray-700 flex justify-end"><button id="close-columns-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-3 px-6 rounded-lg">Cerrar</button></div></div>`;

    const promptModalHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"><form id="prompt-form"><h3 id="prompt-title" class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4"></h3><input type="text" id="prompt-input" class="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200" required><div class="mt-6 flex justify-end space-x-3"><button type="button" id="prompt-cancel-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-2 px-5 rounded-lg">Cancelar</button><button type="submit" id="prompt-submit-btn" class="bg-sky-600 text-white font-bold py-2 px-5 rounded-lg">Aceptar</button></div></form></div>`;
    elements.promptModal = createAndAppend('prompt-modal', promptModalHTML);

    const confirmModalHTML = `<div class="modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md"><h3 id="confirm-title" class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Confirmar Acción</h3><p id="confirm-message" class="text-gray-600 dark:text-gray-300 whitespace-pre-wrap"></p><div class="mt-6 flex justify-end space-x-3"><button id="confirm-cancel-btn" class="bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-200 font-bold py-2 px-5 rounded-lg">Cancelar</button><button id="confirm-submit-btn" class="bg-red-600 text-white font-bold py-2 px-5 rounded-lg">Confirmar</button></div></div>`;
    elements.confirmModal = createAndAppend('confirm-modal', confirmModalHTML);
}

// --- TABLA ---

export function renderTable(handleRowSelectionCb, handleCellUpdateCb) {
    elements.tableContainer.style.setProperty('--table-font-size', `${state.appData.tableFontSize || 14}px`);
    elements.tableContainer.style.setProperty('--table-text-color', state.appData.tableTextColor || 'inherit');

    const table = document.createElement('table');
    table.id = "data-table";
    const thead = document.createElement('thead');

    const headersHtml = `<th class="sticky-col p-1 w-12 bg-transparent border-b-2 dark:border-gray-600"></th>` +
        state.appData.headers.map(h => {
            const width = state.appData.columnWidths[h] || 'auto';
            const headerStyle = `style="width: ${width}; min-width: ${width === 'auto' ? '120px' : width};"`;
            const sortIndicator = state.appData.sortBy === h ? (state.appData.sortOrder === 'asc' ? ' 🔼' : ' 🔽') : '';
            return `<th ${headerStyle} data-header-sort="${h}">${h.replace(/_/g, ' ')}${sortIndicator}</th>`;
        }).join('');

    thead.innerHTML = `<tr class="sticky-header text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-transparent shadow-sm">${headersHtml}</tr>`;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const paginatedData = state.filteredData.slice((state.currentPage - 1) * state.appData.rowsPerPage, state.currentPage * state.appData.rowsPerPage);

    if (paginatedData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${state.appData.headers.length + 1}" class="text-center p-8 text-gray-500 dark:text-gray-400">No hay datos que coincidan con la búsqueda o filtros.</td></tr>`;
    } else {
        const theme = elements.htmlTag.classList.contains('dark') ? 'dark' : 'light';
        const daysDisplayCol = state.appData.keyColumns?.daysDisplay;
        const colorColumn = state.appData.colorCodingColumn;
        const colorDbKey = colorColumn ? `_list_${colorColumn}` : null;
        const colorDb = colorDbKey ? state.appData.referenceDB[colorDbKey] : null;

        paginatedData.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            tr.className = "group border-b border-gray-100 dark:border-gray-800/50 transition-all duration-200";
            tr.dataset.rowId = row.id;
            const isSelected = state.selectedRowId === row.id;
            if (isSelected) tr.classList.add('selected-row');

            let alertColorBg = null;
            let alertColorText = null;

            if (daysDisplayCol && row[daysDisplayCol] !== undefined) {
                const diasValue = parseInt(row[daysDisplayCol], 10);
                const sortedAlerts = state.appData.visualAlerts ? [...state.appData.visualAlerts].sort((a, b) => b.value - a.value) : [];
                if (!isNaN(diasValue)) {
                    for (const alert of sortedAlerts) {
                        if (!alert.enabled) continue;
                        const alertValue = parseInt(alert.value, 10);
                        let conditionMet = false;
                        if (alert.condition === '>=') conditionMet = diasValue >= alertValue;
                        else if (alert.condition === '<=') conditionMet = diasValue <= alertValue;
                        else conditionMet = diasValue === alertValue;
                        if (conditionMet) {
                            alertColorBg = alert.color.bg;
                            alertColorText = alert.color.text;
                            break;
                        }
                    }
                }
            }

            if (!isSelected) {
                if (alertColorBg) {
                    tr.style.backgroundColor = alertColorBg;
                    if (alertColorText) tr.style.color = alertColorText;
                } else if (colorDb && colorColumn) {
                    const valueForColor = row[colorColumn];
                    const colorConfig = colorDb[valueForColor] || colorDb['__DEFAULT__'];
                    if (colorConfig) {
                        tr.style.backgroundColor = theme === 'dark' ? colorConfig.dark : colorConfig.light;
                        const isDefaultCase = !valueForColor || !colorDb[valueForColor];
                        let textColor = isDefaultCase ? state.appData.tableTextColor : (theme === 'dark' ? colorConfig.textDark : colorConfig.textLight);
                        if (textColor && textColor !== 'inherit') tr.style.color = textColor;
                    }
                }
            }

            const selectionTd = document.createElement('td');
            selectionTd.className = "sticky-col p-1 text-center";
            let rowBgColor = 'inherit';
            if (tr.style.backgroundColor) {
                rowBgColor = tr.style.backgroundColor;
            } else {
                const isEven = rowIndex % 2 === 1;
                rowBgColor = theme === 'dark' ? (isEven ? '#1f2937' : '#111827') : (isEven ? '#ffffff' : '#f9fafb');
                if (!isSelected) {
                    tr.style.backgroundColor = rowBgColor;
                }
            }
            selectionTd.style.backgroundColor = isSelected ? '' : rowBgColor;

            const selectButton = document.createElement('button');
            selectButton.className = `selection-button flex items-center justify-center w-8 h-8 rounded-md transition-colors ${isSelected ? 'bg-sky-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`;
            selectButton.innerHTML = isSelected ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` : '';
            selectButton.onclick = () => handleRowSelectionCb(row.id);
            selectionTd.appendChild(selectButton);
            tr.appendChild(selectionTd);

            state.appData.headers.forEach(header => {
                const value = row[header] ?? '';
                const td = document.createElement('td');
                td.className = "p-0 text-center align-middle";
                td.dataset.columnHeader = header;

                const format = state.appData.columnFormats[header];
                if (format === 'list') {
                    const listKey = `_list_${header}`;
                    const optionsData = state.appData.referenceDB[listKey];
                    const options = optionsData ? Object.keys(optionsData).filter(k => k !== '__DEFAULT__') : [];
                    const select = document.createElement('select');
                    select.className = "w-full h-full p-3 bg-transparent border-0 focus:ring-0 text-center";
                    select.innerHTML = `<option value=""></option>` + options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                    select.onchange = (e) => handleCellUpdateCb(row.id, header, e.target.value);
                    select.style.color = 'inherit';
                    td.appendChild(select);
                } else if (format === 'date') {
                    const input = createDateInputComponent(value, (newValue) => handleCellUpdateCb(row.id, header, newValue));
                    input.style.color = 'inherit';
                    td.appendChild(input);
                } else {
                    const div = document.createElement('div');
                    div.className = "data-cell w-full h-full p-3";
                    div.setAttribute('contenteditable', 'true');
                    div.textContent = value;
                    div.onblur = (e) => handleCellUpdateCb(row.id, header, e.target.textContent);
                    div.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } };
                    div.style.color = 'inherit';
                    td.appendChild(div);
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    }
    table.appendChild(tbody);
    elements.tableContainer.innerHTML = '';
    elements.tableContainer.appendChild(table);

    table.querySelectorAll('th[data-header-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const header = th.dataset.headerSort;
            if (state.appData.sortBy === header) {
                state.appData.sortOrder = state.appData.sortOrder === 'asc' ? 'desc' : 'asc';
            } else {
                state.appData.sortBy = header;
                state.appData.sortOrder = 'asc';
            }
            saveData(elements.temporalModeCheckbox);
            sortAndApplyFilters(handleRowSelectionCb, handleCellUpdateCb);
        });
    });

    elements.rowCount.textContent = `${state.filteredData.length} de ${state.appData.mainData.length} registros`;
    renderPagination(handleRowSelectionCb, handleCellUpdateCb);
}

export function renderPagination(handleRowSelectionCb, handleCellUpdateCb) {
    const totalPages = Math.ceil(state.filteredData.length / state.appData.rowsPerPage);
    const container = elements.paginationControlsBottom;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    const prevBtn = document.createElement('button');
    prevBtn.textContent = 'Anterior';
    prevBtn.className = "px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50";
    prevBtn.disabled = state.currentPage === 1;
    prevBtn.onclick = () => { if (state.currentPage > 1) { state.currentPage--; renderTable(handleRowSelectionCb, handleCellUpdateCb); } };
    container.appendChild(prevBtn);

    const pageInfo = document.createElement('span');
    pageInfo.className = "font-semibold";
    pageInfo.textContent = `Página ${state.currentPage} de ${totalPages}`;
    container.appendChild(pageInfo);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = 'Siguiente';
    nextBtn.className = "px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50";
    nextBtn.disabled = state.currentPage >= totalPages;
    nextBtn.onclick = () => { if (state.currentPage < totalPages) { state.currentPage++; renderTable(handleRowSelectionCb, handleCellUpdateCb); } };
    container.appendChild(nextBtn);
}

// --- FILTROS ---

export function renderFilters(handleRowSelectionCb, handleCellUpdateCb) {
    elements.filtersContainer.innerHTML = '';
    const activeFiltersContainer = document.createElement('div');
    activeFiltersContainer.id = 'active-filters-list';
    activeFiltersContainer.className = 'space-y-2 w-full';

    state.appData.filters.forEach((filter, index) => {
        activeFiltersContainer.appendChild(createFilterUI(filter, index, handleRowSelectionCb, handleCellUpdateCb));
    });
    elements.filtersContainer.appendChild(activeFiltersContainer);

    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'flex items-center gap-2 mt-2';

    const addFilterBtn = document.createElement('button');
    addFilterBtn.textContent = 'Añadir Filtro';
    addFilterBtn.className = 'text-sm bg-sky-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-sky-600';
    addFilterBtn.onclick = () => { state.appData.filters.push({ column: '', condition: '=', value: '' }); saveData(elements.temporalModeCheckbox); renderFilters(handleRowSelectionCb, handleCellUpdateCb); };
    controlsContainer.appendChild(addFilterBtn);

    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Aplicar';
    applyBtn.className = 'text-sm bg-green-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-600';
    applyBtn.onclick = () => { state.currentPage = 1; sortAndApplyFilters(handleRowSelectionCb, handleCellUpdateCb); showToast('Filtros aplicados.', 'info'); };
    controlsContainer.appendChild(applyBtn);

    if (state.appData.filters.length > 0) {
        const clearBtn = document.createElement('button');
        clearBtn.textContent = 'Limpiar';
        clearBtn.className = 'text-sm bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-600';
        clearBtn.onclick = () => { state.appData.filters = []; saveData(elements.temporalModeCheckbox); renderFilters(handleRowSelectionCb, handleCellUpdateCb); sortAndApplyFilters(handleRowSelectionCb, handleCellUpdateCb); };
        controlsContainer.appendChild(clearBtn);
    }
    elements.filtersContainer.appendChild(controlsContainer);
}

function createFilterUI(filter, index, handleRowSelectionCb, handleCellUpdateCb) {
    const wrapper = document.createElement('div');
    wrapper.className = 'flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg w-full';

    const columnSelect = document.createElement('select');
    columnSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm w-40';
    columnSelect.innerHTML = `<option value="">-- Columna --</option>` + state.appData.headers.map(h => `<option value="${h}" ${filter.column === h ? 'selected' : ''}>${h}</option>`).join('');
    columnSelect.onchange = (e) => { filter.column = e.target.value; filter.value = ''; const nf = createFilterUI(filter, index, handleRowSelectionCb, handleCellUpdateCb); wrapper.replaceWith(nf); saveData(elements.temporalModeCheckbox); };
    wrapper.appendChild(columnSelect);

    if (filter.column) {
        const format = state.appData.columnFormats[filter.column] || 'text';
        const conditionSelect = document.createElement('select');
        conditionSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
        if (format === 'date' || !isNaN(parseFloat(state.appData.mainData[0]?.[filter.column]))) {
            conditionSelect.innerHTML = `<option value=">=" ${filter.condition === '>=' ? 'selected' : ''}>&gt;=</option><option value="<=" ${filter.condition === '<=' ? 'selected' : ''}>&lt;=</option><option value="=" ${filter.condition === '=' ? 'selected' : ''}>=</option>`;
        } else {
            conditionSelect.innerHTML = `<option value="=" ${filter.condition === '=' ? 'selected' : ''}>Es igual a</option>`;
            filter.condition = '=';
        }
        conditionSelect.onchange = (e) => { filter.condition = e.target.value; saveData(elements.temporalModeCheckbox); };
        wrapper.appendChild(conditionSelect);

        if (format === 'list') {
            const listKey = `_list_${filter.column}`;
            const optionsData = state.appData.referenceDB[listKey];
            const options = optionsData ? Object.keys(optionsData).filter(k => k !== '__DEFAULT__') : [];
            const valueSelect = document.createElement('select');
            valueSelect.className = 'flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            valueSelect.innerHTML = `<option value="">Todos</option>` + options.map(opt => `<option value="${opt}" ${filter.value === opt ? 'selected' : ''}>${opt}</option>`).join('');
            valueSelect.onchange = (e) => { filter.value = e.target.value; saveData(elements.temporalModeCheckbox); };
            wrapper.appendChild(valueSelect);
        } else if (format === 'date') {
            const valueInput = createDateInputComponent(filter.value || '', (newValue) => { filter.value = newValue; saveData(elements.temporalModeCheckbox); });
            valueInput.placeholder = "DD/MM/YYYY";
            valueInput.className = 'flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            wrapper.appendChild(valueInput);
        } else {
            const valueInput = document.createElement('input');
            valueInput.type = 'text'; valueInput.placeholder = 'Valor...';
            valueInput.className = 'flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            valueInput.value = filter.value || '';
            valueInput.oninput = () => { filter.value = valueInput.value; saveData(elements.temporalModeCheckbox); };
            wrapper.appendChild(valueInput);
        }
    }

    const removeBtn = document.createElement('button');
    removeBtn.innerHTML = '&times;'; removeBtn.title = 'Quitar Filtro';
    removeBtn.className = 'text-xl text-red-500 hover:text-red-700 font-bold px-2';
    removeBtn.onclick = () => { state.appData.filters.splice(index, 1); saveData(elements.temporalModeCheckbox); renderFilters(handleRowSelectionCb, handleCellUpdateCb); sortAndApplyFilters(handleRowSelectionCb, handleCellUpdateCb); };
    wrapper.appendChild(removeBtn);
    return wrapper;
}

export function sortAndApplyFilters(handleRowSelectionCb, handleCellUpdateCb) {
    const generalQuery = elements.searchInput.value.toLowerCase().trim();
    let data = [...state.appData.mainData];

    const hideSettings = state.appData.hideSettings;
    if (hideSettings && hideSettings.column && hideSettings.hiddenValues && hideSettings.hiddenValues.length > 0 && !generalQuery) {
        data = data.filter(row => !hideSettings.hiddenValues.includes(row[hideSettings.column]));
    }
    if (generalQuery) {
        data = data.filter(row => state.appData.headers.some(header => String(row[header] || '').toLowerCase().includes(generalQuery)));
    }
    if (state.appData.filters && state.appData.filters.length > 0) {
        state.appData.filters.forEach(filter => {
            if (!filter.column || filter.value === undefined || filter.value === '') return;
            data = data.filter(row => {
                const rowValue = row[filter.column];
                const filterValue = filter.value;
                const format = state.appData.columnFormats[filter.column] || 'text';
                if (rowValue === undefined || rowValue === null || rowValue === '') return false;
                if (format === 'list') return String(rowValue) === String(filterValue);
                else if (format === 'date') {
                    const rowDate = parseDate(rowValue); const filterDate = parseDate(filterValue);
                    if (!rowDate || !filterDate) return false;
                    rowDate.setUTCHours(0, 0, 0, 0); filterDate.setUTCHours(0, 0, 0, 0);
                    if (filter.condition === '>=') return rowDate >= filterDate;
                    if (filter.condition === '<=') return rowDate <= filterDate;
                    if (filter.condition === '=') return rowDate.getTime() === filterDate.getTime();
                    return false;
                } else if (!isNaN(parseFloat(rowValue)) && !isNaN(parseFloat(filterValue))) {
                    const rn = parseFloat(rowValue); const fn = parseFloat(filterValue);
                    if (filter.condition === '>=') return rn >= fn;
                    if (filter.condition === '<=') return rn <= fn;
                    if (filter.condition === '=') return rn === fn;
                    return false;
                } else return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
            });
        });
    }
    if (state.appData.sortBy && state.appData.headers.includes(state.appData.sortBy)) {
        const sortBy = state.appData.sortBy;
        const sortOrder = state.appData.sortOrder === 'asc' ? 1 : -1;
        const format = state.appData.columnFormats[sortBy];
        data.sort((a, b) => {
            let valA = a[sortBy] || '', valB = b[sortBy] || '';
            if (format === 'date') { valA = parseDate(valA) || 0; valB = parseDate(valB) || 0; }
            else if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) { valA = parseFloat(valA); valB = parseFloat(valB); }
            else if (typeof valA === 'string' && typeof valB === 'string') { valA = valA.toLowerCase(); valB = valB.toLowerCase(); }
            if (valA < valB) return -1 * sortOrder;
            if (valA > valB) return 1 * sortOrder;
            return 0;
        });
    }
    state.filteredData = data;
    if (state.currentPage > Math.ceil(state.filteredData.length / state.appData.rowsPerPage) && state.filteredData.length > 0) {
        state.currentPage = Math.ceil(state.filteredData.length / state.appData.rowsPerPage);
    } else if (state.filteredData.length === 0) { state.currentPage = 1; }
    renderTable(handleRowSelectionCb, handleCellUpdateCb);
    updateSummaryBar();
}

// --- SUMMARY BAR ---

export function updateSummaryBar() {
    const bar = elements.summaryBar;
    bar.innerHTML = '';
    const colorCol = state.appData.colorCodingColumn;
    if (!colorCol) return;
    const counts = state.filteredData.reduce((acc, row) => { const value = row[colorCol] || `Sin ${colorCol}`; acc[value] = (acc[value] || 0) + 1; return acc; }, {});
    const theme = elements.htmlTag.classList.contains('dark') ? 'dark' : 'light';
    const colorDb = state.appData.referenceDB[`_list_${colorCol}`];
    Object.entries(counts).forEach(([value, count]) => {
        const span = document.createElement('span');
        span.className = 'text-xs px-2 py-1 rounded-full font-bold';
        const colorConfig = colorDb ? (colorDb[value] || colorDb['__DEFAULT__']) : null;
        if (colorConfig) { span.style.backgroundColor = theme === 'dark' ? colorConfig.dark : colorConfig.light; span.style.color = theme === 'dark' ? colorConfig.textDark : colorConfig.textLight; }
        else { span.style.backgroundColor = theme === 'dark' ? '#374151' : '#e5e7eb'; span.style.color = theme === 'dark' ? '#d1d5db' : '#374151'; }
        span.textContent = `${value}: ${count}`;
        bar.appendChild(span);
    });
}

// --- SELECCIÓN Y ESTADO DE BOTONES ---

export function updateSelectionStatus() {
    elements.deleteRowBtn.disabled = !state.selectedRowId;
    elements.generatePdfBtn.disabled = !(state.selectedRowId && state.selectedTemplateId);
    elements.editSelectedTemplateBtn.disabled = !state.selectedTemplateId;
    elements.deleteSelectedTemplateBtn.disabled = !state.selectedTemplateId;
    updateSelectedRowIdentifierDisplay();
}

export function updateSelectedRowIdentifierDisplay() {
    const display = elements.selectedRowIdentifierDisplay;
    if (!display) return;
    const idColumn = state.appData.selectedRowIdentifierColumn;
    if (state.selectedRowId && idColumn && state.appData.headers.includes(idColumn)) {
        const rowData = state.appData.mainData.find(r => r.id === state.selectedRowId);
        if (rowData) {
            const identifierValue = rowData[idColumn] || 'N/A';
            display.innerHTML = `<span class="font-medium">Seleccionado:</span> <span class="font-extrabold">${identifierValue}</span>`;
            display.title = `${idColumn}: ${identifierValue}`;
            display.style.display = 'block';
            return;
        }
    }
    display.style.display = 'none';
}

// --- TEMA ---

export function applyTheme(theme, handleRowSelectionCb, handleCellUpdateCb) {
    localStorage.setItem('theme', theme);
    elements.htmlTag.className = theme;
    elements.themeToggleDarkIcon.classList.toggle('hidden', theme === 'dark');
    elements.themeToggleLightIcon.classList.toggle('hidden', theme !== 'dark');
    fullReloadUI(handleRowSelectionCb, handleCellUpdateCb);
}

export function fullReloadUI(handleRowSelectionCb, handleCellUpdateCb) {
    sortAndApplyFilters(handleRowSelectionCb, handleCellUpdateCb);
    renderFilters(handleRowSelectionCb, handleCellUpdateCb);
    renderTemplates();
    updateSelectionStatus();
}

// --- PLANTILLAS (DROPDOWN) ---

export function renderTemplates() {
    const select = elements.templateSelectDropdown;
    select.innerHTML = '';
    const hasTemplates = state.appData.templates && state.appData.templates.length > 0;
    const noneOption = document.createElement('option');
    noneOption.value = "";
    noneOption.textContent = hasTemplates ? 'Seleccionar plantilla...' : 'Crea una plantilla';
    select.appendChild(noneOption);
    if (hasTemplates) {
        const sorted = [...state.appData.templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        sorted.forEach(template => { select.innerHTML += `<option value="${template.id}">${template.name}</option>`; });
    }
    select.value = state.selectedTemplateId || '';
}

// --- MODALES CONFIRM / PROMPT ---

export function showConfirmModal(message, onConfirm, title = 'Confirmar Acción') {
    elements.confirmModal.classList.add('active');
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = message;
    const confirmBtn = document.getElementById('confirm-submit-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    let confirmHandler, cleanup;
    confirmHandler = () => { onConfirm(); cleanup(); };
    cleanup = () => { elements.confirmModal.classList.remove('active'); confirmBtn.removeEventListener('click', confirmHandler); cancelBtn.removeEventListener('click', cleanup); };
    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cleanup);
}

export function showPromptModal(title, onConfirm, defaultValue = '') {
    return new Promise((resolve) => {
        elements.promptModal.classList.add('active');
        document.getElementById('prompt-title').textContent = title;
        const input = document.getElementById('prompt-input');
        const form = document.getElementById('prompt-form');
        const cancelBtn = document.getElementById('prompt-cancel-btn');
        input.value = defaultValue;
        input.focus();
        let submitHandler, cleanup;
        submitHandler = (e) => {
            e.preventDefault();
            const value = input.value;
            if (value.trim()) { if (onConfirm) onConfirm(value); resolve(value); cleanup(); }
            else { showToast('El valor no puede estar vacío.', 'warning'); }
        };
        cleanup = () => { elements.promptModal.classList.remove('active'); form.removeEventListener('submit', submitHandler); cancelBtn.removeEventListener('click', cleanup); };
        form.addEventListener('submit', submitHandler);
        cancelBtn.addEventListener('click', cleanup);
    });
}
