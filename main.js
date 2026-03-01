document.addEventListener('DOMContentLoaded', () => {
    // ### CORE STATE AND REFERENCES ###
    const { jsPDF } = window.jspdf;
    let appData = {};
    let filteredData = [];
    let selectedRowId = null;
    let selectedTemplateId = null;
    let selectedColumnNameForDeletion = null;
    let pendingPDFGeneration = null;
    let searchDebounceTimer;
    
    let currentPage = 1;

    const elements = {
        htmlTag: document.documentElement,
        tableContainer: document.getElementById('table-container'),
        paginationControlsBottom: document.getElementById('pagination-controls-bottom'),
        rowCount: document.getElementById('row-count'),
        searchInput: document.getElementById('search-input'),
        addRowBtn: document.getElementById('add-row-btn'),
        deleteRowBtn: document.getElementById('delete-row-btn'),
        manageColsBtn: document.getElementById('manage-cols-btn'),
        exportExcelBtn: document.getElementById('export-excel-btn'),
        importAllBtn: document.getElementById('import-all-btn'),
        importAllInput: document.getElementById('import-all-input'),
        exportAllBtn: document.getElementById('export-all-btn'),
        themeToggle: document.getElementById('theme-toggle'),
        themeToggleDarkIcon: document.getElementById('theme-toggle-dark-icon'),
        themeToggleLightIcon: document.getElementById('theme-toggle-light-icon'),
        templateSelectDropdown: document.getElementById('template-select-dropdown'),
        createTemplateBtn: document.getElementById('create-template-btn'),
        editSelectedTemplateBtn: document.getElementById('edit-selected-template-btn'),
        deleteSelectedTemplateBtn: document.getElementById('delete-selected-template-btn'),
        generatePdfBtn: document.getElementById('generate-pdf-btn'),
        summaryBar: document.getElementById('summary-bar'),
        filtersContainer: document.getElementById('filters-container'),
        toastContainer: document.getElementById('toast-container'),
        templateModal: document.getElementById('template-modal'),
        manualVarsModal: document.getElementById('manual-vars-modal'),
        previewModal: document.getElementById('preview-modal'),
        manageDbBtn: document.getElementById('manage-db-btn'),
        dbModal: document.getElementById('db-modal'),
        columnsModal: document.getElementById('columns-modal'),
        imageUploadModal: document.getElementById('image-upload-modal'),
        temporalModeCheckbox: document.getElementById('temporal-mode-checkbox'),
        loadingOverlay: document.getElementById('loading-overlay'),
        increaseFontSizeBtn: document.getElementById('increase-font-size'),
        decreaseFontSizeBtn: document.getElementById('decrease-font-size'),
        tableFontColorPicker: document.getElementById('table-font-color-picker'),
        selectedRowIdentifierDisplay: document.getElementById('selected-row-identifier-display'),
        promptModal: null,
        confirmModal: null,
    };

    function populateModals() {
        const createAndAppend = (id, html) => {
            let container = document.getElementById(id);
            if (!container) {
                container = document.createElement('div');
                container.id = id;
                document.body.appendChild(container);
            }
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

    // ### UTILITY & FORMATTING FUNCTIONS ###
    function showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-400 text-black', info: 'bg-sky-500' };
        toast.className = `toast text-white ${colors[type]} p-3 rounded-lg shadow-2xl text-sm font-semibold`;
        toast.textContent = message;
        elements.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, duration);
    }
    const parseDate = (str) => { if (!str || typeof str !== 'string' || !str.includes('/')) return null; const parts = str.split('/'); if (parts.length !== 3) return null; let [day, month, year] = parts.map(p => parseInt(p, 10)); if (isNaN(day) || isNaN(month) || isNaN(year)) return null; const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year; const date = new Date(Date.UTC(fullYear, month - 1, day)); if (date && date.getUTCMonth() === month - 1) return date; return null; };
    const formatDate = (date) => { if (!date || !(date instanceof Date) || isNaN(date)) return ''; const day = String(date.getUTCDate()).padStart(2, '0'); const month = String(date.getUTCMonth() + 1).padStart(2, '0'); const year = date.getUTCFullYear(); return `${day}/${month}/${year}`; };
    const getFormattedDateForFilename = (date = new Date()) => { const day = String(date.getDate()).padStart(2, '0'); const month = String(date.getMonth() + 1).padStart(2, '0'); const year = date.getFullYear(); return `${day}-${month}-${year}`; };
    const getFormattedTimestampForFilename = (date = new Date()) => {
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${d}-${m}-${y}_${h}-${min}`;
    };
    const calculateDays = (dateStr) => { const date = parseDate(dateStr); if (!date) return ''; const today = new Date(); const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())); return Math.ceil((date - todayUTC) / (1000 * 60 * 60 * 24)) * -1; };
    function formatCuitCuil(value) { if (!value) return ''; const cleaned = String(value).replace(/[^0-9]/g, ''); if (cleaned.length !== 11) return value; return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 10)}-${cleaned.substring(10)}`; }
    
    // ### DATA MANAGEMENT ###
    function saveData() { 
        if (elements.temporalModeCheckbox.checked) return; 
        try { 
            localStorage.setItem('gestorReclamosData_v43_generic', JSON.stringify(appData)); 
        } catch (e) { 
            console.error("Error guardando datos:", e); 
            showToast("Error al guardar datos.", "error"); 
        } 
    }

    function loadData() {
        const temporalModeActive = new URLSearchParams(window.location.search).get('temporal') === 'true';
        elements.temporalModeCheckbox.checked = temporalModeActive;
        const storedData = temporalModeActive ? null : localStorage.getItem('gestorReclamosData_v43_generic');

        if (storedData) {
            try {
                const parsed = JSON.parse(storedData);
                if(parsed.headers && parsed.mainData) { 
                    appData = parsed;
                    // --- Start Data Migration & Defaulting ---
                    if (!parsed.visualAlerts) appData.visualAlerts = [];
                    appData.visualAlerts.forEach(alert => {
                        if (typeof alert.color === 'string') {
                            const mapping = { 'Rojo': '#fee2e2', 'Amarillo': '#fef9c3', 'Verde': '#dcfce7' };
                            const textMapping = { 'Rojo': '#991b1b', 'Amarillo': '#854d0e', 'Verde': '#166534' };
                            alert.color = { bg: mapping[alert.color] || '#ffffff', text: textMapping[alert.color] || '#000000' };
                        }
                    });
                    if (!Array.isArray(parsed.filters)) appData.filters = [];
                    
                    if (parsed.hiddenStatuses && !parsed.hideSettings) {
                        appData.hideSettings = {
                            column: parsed.colorCodingColumn || 'ESTADO', // Usa la columna de color como un default razonable
                            hiddenValues: parsed.hiddenStatuses
                        };
                        delete appData.hiddenStatuses; // Elimina la propiedad antigua
                        showToast('Configuración de ocultar por defecto actualizada.', 'info');
                    } else if (!parsed.hideSettings) {
                         appData.hideSettings = { column: 'ESTADO', hiddenValues: [] };
                    }
                    
                    if (!parsed.templates) appData.templates = [];
                    parsed.templates.forEach(t => { 
                        if (!t.manualFields) t.manualFields = []; 
                        if (!t.imageFields) t.imageFields = [];
                        if (!t.fontFamily) t.fontFamily = 'Helvetica';
                    });
                    if (!parsed.columnFormats) appData.columnFormats = {};
                    if (!parsed.lookupRelations) appData.lookupRelations = [];
                    
                    if (!parsed.referenceDB) appData.referenceDB = {};
                    if (parsed.referenceDB.statuses && !parsed.colorCodingColumn) {
                        const listKey = '_list_ESTADO';
                        if (!appData.referenceDB[listKey]) {
                            appData.referenceDB[listKey] = parsed.referenceDB.statuses;
                        }
                        delete appData.referenceDB.statuses;
                        appData.colorCodingColumn = 'ESTADO';
                        showToast('Configuración de colores actualizada al nuevo sistema.', 'info');
                    }
                    if (!appData.referenceDB['_list_ESTADO']) {
                         appData.referenceDB['_list_ESTADO'] = {
                            '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' },
                            'EN TRÁMITE': { light: '#fef9c3', dark: '#422006', textLight: '#713f12', textDark: '#fef08a' },
                            'FINALIZADO': { light: '#dcfce7', dark: '#14532d', textLight: '#166534', textDark: '#bbf7d0' },
                         };
                    }

                    if (!parsed.columnWidths) appData.columnWidths = {};
                    if (!parsed.pdfFilenameFormat) appData.pdfFilenameFormat = 'Documento_{{NOMBRE_APELLIDO}}_{{FECHA_INICIO}}';
                    if (!parsed.columnMetadata) appData.columnMetadata = {};
                    if (!parsed.sortBy) appData.sortBy = 'FECHA DE INICIO';
                    if (!parsed.sortOrder) appData.sortOrder = 'desc';
                    if (!parsed.tableFontSize) appData.tableFontSize = 14;
                    if (!parsed.tableTextColor) appData.tableTextColor = 'inherit';
                    if (!parsed.rowsPerPage) appData.rowsPerPage = 10;
                    if (!parsed.colorCodingColumn) appData.colorCodingColumn = 'ESTADO';
                    if (!parsed.bulkDeleteColumn) appData.bulkDeleteColumn = 'ESTADO'; 
                    if (!parsed.selectedRowIdentifierColumn) appData.selectedRowIdentifierColumn = 'EXPEDIENTE';
                    
                    if (!parsed.keyColumns) {
                        appData.keyColumns = {};
                        const possibleDateCols = ['FECHA ULTIMA / PROXIMA ACCION', 'FECHA ULTIMA/ PROXIMA ACCION'];
                        const foundDateCol = possibleDateCols.find(name => appData.headers.includes(name));
                        const foundDaysCol = appData.headers.find(name => name === 'DIAS');
                        appData.keyColumns.dateForCalculation = foundDateCol || null;
                        appData.keyColumns.daysDisplay = foundDaysCol || null;
                    }
                    // --- End Data Migration ---
                    return;
                }
            } catch(e) { console.error("Error cargando datos:", e); }
        }
        
        // --- INITIAL DATA STRUCTURE ---
        appData = {
            mainData: [],
            templates: [],
            visualAlerts: [{ id: 1, enabled: true, color: { bg: '#fee2e2', text: '#991b1b'}, condition: '>=', value: '10' }],
            filters: [],
            hideSettings: {
                column: 'ESTADO',
                hiddenValues: []
            },
            lookupRelations: [],
            referenceDB: {
                '_list_ESTADO': {
                    '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' },
                    'EN TRÁMITE': { light: '#fef9c3', dark: '#422006', textLight: '#713f12', textDark: '#fef08a' },
                    'FINALIZADO': { light: '#dcfce7', dark: '#14532d', textLight: '#166534', textDark: '#bbf7d0' },
                    'PENDIENTE': { light: '#e0e7ff', dark: '#312e81', textLight: '#3730a3', textDark: '#c7d2fe' },
                    'RECHAZADO': { light: '#fee2e2', dark: '#7f1d1d', textLight: '#991b1b', textDark: '#fecaca' }
                }
            },
            headers: [ "FECHA DE INICIO", "EXPEDIENTE", "ESTADO", "FECHA ULTIMA/ PROXIMA ACCION", "DIAS", "N° EMPRESA", "NOMBRE EMPRESA", "CUIT EMPRESA" ],
            keyColumns: {
                dateForCalculation: 'FECHA ULTIMA/ PROXIMA ACCION',
                daysDisplay: 'DIAS'
            },
            columnMetadata: {
                "DIAS": { isProtected: true }
            },
            columnFormats: { 
                'FECHA DE INICIO': 'date', 
                'FECHA ULTIMA/ PROXIMA ACCION': 'date', 
                'ESTADO': 'list',
                'CUIT EMPRESA': 'cuit'
            },
            columnWidths: {},
            pdfFilenameFormat: 'Documento_{{NOMBRE EMPRESA}}_{{FECHA DE INICIO}}',
            sortBy: 'FECHA DE INICIO',
            sortOrder: 'desc',
            tableFontSize: 14,
            tableTextColor: 'inherit',
            rowsPerPage: 10,
            colorCodingColumn: 'ESTADO',
            bulkDeleteColumn: 'ESTADO',
            selectedRowIdentifierColumn: 'EXPEDIENTE',
        };
        if (appData.mainData.length === 0) addRow(false);
    }

    // ### CORE LOGIC ###
    function recalculateAllDays() {
        let hasChanges = false;
        const dateCol = appData.keyColumns?.dateForCalculation;
        const daysCol = appData.keyColumns?.daysDisplay;
        
        if (!dateCol || !daysCol || !appData.headers.includes(dateCol) || !appData.headers.includes(daysCol)) {
            return;
        }
        
        appData.mainData.forEach(row => {
            const newDays = calculateDays(row[dateCol]);
            if (String(row[daysCol] || '') !== String(newDays || '')) {
                row[daysCol] = newDays;
                hasChanges = true;
            }
        });
        if (hasChanges) saveData();
    }

    function sortAndApplyFilters() {
        const generalQuery = elements.searchInput.value.toLowerCase().trim();
        let data = [...appData.mainData];
        
        const hideSettings = appData.hideSettings;
        if (hideSettings && hideSettings.column && hideSettings.hiddenValues && hideSettings.hiddenValues.length > 0 && !generalQuery) {
            data = data.filter(row => !hideSettings.hiddenValues.includes(row[hideSettings.column]));
        }

        if (generalQuery) {
            data = data.filter(row => 
                appData.headers.some(header => String(row[header] || '').toLowerCase().includes(generalQuery))
            );
        }

        if (appData.filters && appData.filters.length > 0) {
            appData.filters.forEach(filter => {
                if (!filter.column || filter.value === undefined || filter.value === '') return;
                
                data = data.filter(row => {
                    const rowValue = row[filter.column];
                    const filterValue = filter.value;
                    const format = appData.columnFormats[filter.column] || 'text';

                    if (rowValue === undefined || rowValue === null || rowValue === '') return false;

                    if (format === 'list') {
                        return String(rowValue) === String(filterValue);
                    } else if (format === 'date') {
                        const rowDate = parseDate(rowValue);
                        const filterDate = parseDate(filterValue);
                        if (!rowDate || !filterDate) return false;
                        
                        rowDate.setUTCHours(0,0,0,0);
                        filterDate.setUTCHours(0,0,0,0);

                        if (filter.condition === '>=') return rowDate >= filterDate;
                        if (filter.condition === '<=') return rowDate <= filterDate;
                        if (filter.condition === '=') return rowDate.getTime() === filterDate.getTime();
                        return false;
                    } else if (!isNaN(parseFloat(rowValue)) && !isNaN(parseFloat(filterValue))) {
                         const rowValNum = parseFloat(rowValue);
                         const filterValNum = parseFloat(filterValue);
                         if (filter.condition === '>=') return rowValNum >= filterValNum;
                         if (filter.condition === '<=') return rowValNum <= filterValNum;
                         if (filter.condition === '=') return rowValNum === filterValNum;
                         return false;
                    } else {
                        return String(rowValue).toLowerCase().includes(String(filterValue).toLowerCase());
                    }
                });
            });
        }

        if (appData.sortBy && appData.headers.includes(appData.sortBy)) {
            const sortBy = appData.sortBy;
            const sortOrder = appData.sortOrder === 'asc' ? 1 : -1;
            const format = appData.columnFormats[sortBy];

            data.sort((a, b) => {
                let valA = a[sortBy] || '';
                let valB = b[sortBy] || '';

                if (format === 'date') {
                    valA = parseDate(valA) || 0;
                    valB = parseDate(valB) || 0;
                } else if (!isNaN(parseFloat(valA)) && !isNaN(parseFloat(valB))) {
                    valA = parseFloat(valA);
                    valB = parseFloat(valB);
                } else if (typeof valA === 'string' && typeof valB === 'string') {
                    valA = valA.toLowerCase();
                    valB = valB.toLowerCase();
        }

                if (valA < valB) return -1 * sortOrder;
                if (valA > valB) return 1 * sortOrder;
                return 0;
            });
        }

        filteredData = data;
        
        if (currentPage > Math.ceil(filteredData.length / appData.rowsPerPage) && filteredData.length > 0) {
            currentPage = Math.ceil(filteredData.length / appData.rowsPerPage);
        } else if (filteredData.length === 0) {
            currentPage = 1;
        }

        renderTable();
        updateSummaryBar();
    }
    
    function handleCellUpdate(rowId, column, value) {
        const rowIndex = appData.mainData.findIndex(r => r.id === rowId);
        if (rowIndex === -1) return;
        const row = appData.mainData[rowIndex];
        
        const cellElement = document.querySelector(`[data-row-id="${rowId}"] [data-column-header="${column}"] > *`);
        let finalValue = value;
        const columnFormat = appData.columnFormats[column];

        if (columnFormat === 'date') {
            const parsed = parseDate(value);
            if (value && !parsed) {
                showToast(`Formato de fecha inválido para '${value}'. Use DD/MM/YYYY.`, 'error');
                if (cellElement) cellElement.classList.add('invalid-cell');
                return; 
            }
            if (cellElement) cellElement.classList.remove('invalid-cell');
            finalValue = parsed ? formatDate(parsed) : '';
        } else if (columnFormat === 'cuit') {
            finalValue = formatCuitCuil(value);
        }
        
        const dateCalcCol = appData.keyColumns?.dateForCalculation;
        const daysDisplayCol = appData.keyColumns?.daysDisplay;

        if (row[column] === finalValue && column !== dateCalcCol) return;
        
        row[column] = finalValue;
        let needsRerender = false;
        
        (appData.lookupRelations || []).forEach(relation => {
            if (relation.enabled && relation.keyColumn === column && relation.sourceDB) {
                const sourceData = appData.referenceDB[relation.sourceDB]?.[finalValue];
                if (sourceData) {
                    Object.entries(relation.targetMap || {}).forEach(([sourceField, targetColumn]) => {
                        if (targetColumn && row.hasOwnProperty(targetColumn)) {
                            let valueToPopulate = sourceData[sourceField] || '';
                            const targetFormat = appData.columnFormats[targetColumn];

                            if (targetFormat === 'cuit') {
                                valueToPopulate = formatCuitCuil(valueToPopulate);
                            } else if (targetFormat === 'date') {
                                const parsedDate = parseDate(valueToPopulate);
                                valueToPopulate = parsedDate ? formatDate(parsedDate) : '';
                            }

                            row[targetColumn] = valueToPopulate;
                            needsRerender = true;
                        }
                    });
                }
            }
        });
        
        if (dateCalcCol && daysDisplayCol && column === dateCalcCol) {
            row[daysDisplayCol] = calculateDays(finalValue);
            needsRerender = true;
        } 
        
        saveData();
        if(needsRerender || column === appData.colorCodingColumn || column === appData.selectedRowIdentifierColumn) {
            sortAndApplyFilters();
            updateSelectedRowIdentifierDisplay();
        }
        updateSummaryBar();
    }

    function addRow(showToastNotification = true) {
        const newRow = { id: `row_${Date.now()}` };
        appData.headers.forEach(header => newRow[header] = '');
        
        const sortColumn = appData.sortBy;
        if (sortColumn && appData.columnFormats[sortColumn] === 'date') {
            newRow[sortColumn] = formatDate(new Date());
        }

        currentPage = 1; 

        appData.mainData.unshift(newRow); 
        
        saveData();
        sortAndApplyFilters(); 
        
        if (showToastNotification) {
            showToast('Nueva fila añadida.', 'success');
        }
    }
    function deleteRow() {
        if (!selectedRowId) return;
        showConfirmModal('¿Seguro que quieres eliminar la fila seleccionada?', () => {
            appData.mainData = appData.mainData.filter(row => row.id !== selectedRowId);
            handleRowSelection(null);
            saveData();
            sortAndApplyFilters();
            showToast('Fila eliminada.', 'success');
        });
    }
    
    // ### RENDERING & UI ###
    function renderTable() {
        elements.tableContainer.style.setProperty('--table-font-size', `${appData.tableFontSize || 14}px`);
        elements.tableContainer.style.setProperty('--table-text-color', appData.tableTextColor || 'inherit');


        const table = document.createElement('table');
        table.id = "data-table";
        const thead = document.createElement('thead');
        
        const headersHtml = `<th class="sticky-col p-1 w-12 bg-gray-100 dark:bg-gray-800 border-b-2 dark:border-gray-600"></th>` + 
            appData.headers.map(h => {
                const width = appData.columnWidths[h] || 'auto';
                const headerStyle = `style="width: ${width}; min-width: ${width === 'auto' ? '120px' : width};"`;
                const sortIndicator = appData.sortBy === h ? (appData.sortOrder === 'asc' ? ' 🔼' : ' 🔽') : '';
                return `<th ${headerStyle} data-header-sort="${h}">${h.replace(/_/g, ' ')}${sortIndicator}</th>`;
            }).join('');

        thead.innerHTML = `<tr class="sticky-header text-xs text-gray-700 dark:text-gray-400 uppercase bg-gray-100 dark:bg-gray-800 shadow-sm">${headersHtml}</tr>`;
        table.appendChild(thead);
        
        const tbody = document.createElement('tbody');
        const paginatedData = filteredData.slice((currentPage - 1) * appData.rowsPerPage, currentPage * appData.rowsPerPage);

        if (paginatedData.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${appData.headers.length + 1}" class="text-center p-8 text-gray-500 dark:text-gray-400">No hay datos que coincidan con la búsqueda o filtros.</td></tr>`;
        } else {
            const theme = elements.htmlTag.classList.contains('dark') ? 'dark' : 'light';
            const daysDisplayCol = appData.keyColumns?.daysDisplay;
            
            const colorColumn = appData.colorCodingColumn;
            const colorDbKey = colorColumn ? `_list_${colorColumn}` : null;
            const colorDb = colorDbKey ? appData.referenceDB[colorDbKey] : null;

            paginatedData.forEach((row, rowIndex) => {
                const tr = document.createElement('tr');
                tr.className = `transition-colors duration-150`;
                tr.dataset.rowId = row.id;

                const isSelected = selectedRowId === row.id;
                if (isSelected) tr.classList.add('selected-row');

                if (colorDb && colorColumn && !isSelected) {
                    const valueForColor = row[colorColumn];
                    const colorConfig = colorDb[valueForColor] || colorDb['__DEFAULT__'];
                    if (colorConfig) {
                        tr.style.backgroundColor = theme === 'dark' ? colorConfig.dark : colorConfig.light;
                        const isDefaultCase = !valueForColor || !colorDb[valueForColor];
                        let textColor;

                        if (isDefaultCase) {
                            textColor = appData.tableTextColor;
                        } else {
                            textColor = theme === 'dark' ? colorConfig.textDark : colorConfig.textLight;
                        }

                        if (textColor && textColor !== 'inherit') {
                            tr.style.color = textColor;
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
                     if(theme === 'dark') {
                       rowBgColor = isEven ? '#1f2937' : '#111827';
                    } else {
                       rowBgColor = isEven ? '#ffffff' : '#f9fafb';
                    }
                }
                selectionTd.style.backgroundColor = isSelected ? '' : rowBgColor;
                
                const selectButton = document.createElement('button');
                selectButton.className = `selection-button flex items-center justify-center w-8 h-8 rounded-md transition-colors ${isSelected ? 'bg-sky-600 text-white' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'}`;
                selectButton.innerHTML = isSelected ? `<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>` : '';
                selectButton.onclick = () => handleRowSelection(row.id);
                selectionTd.appendChild(selectButton);
                tr.appendChild(selectionTd);
                
                appData.headers.forEach(header => {
                    const value = row[header] ?? '';
                    const td = document.createElement('td');
                    td.className = "p-0 text-center align-middle";
                    td.dataset.columnHeader = header;
                    
                    if (header === daysDisplayCol) {
                        const diasValue = parseInt(value, 10);
                        const sortedAlerts = appData.visualAlerts ? [...appData.visualAlerts].sort((a, b) => b.value - a.value) : [];
                        if (!isNaN(diasValue)) {
                            for (const alert of sortedAlerts) {
                                if (!alert.enabled) continue;
                                const alertValue = parseInt(alert.value, 10);
                                let conditionMet = false;
                                if (alert.condition === '>=') conditionMet = diasValue >= alertValue;
                                else if (alert.condition === '<=') conditionMet = diasValue <= alertValue;
                                else conditionMet = diasValue === alertValue;

                                if (conditionMet) {
                                    td.style.backgroundColor = alert.color.bg;
                                    td.style.color = alert.color.text;
                                    break;
                                }
                            }
                        }
                    }
                    
                    const format = appData.columnFormats[header];
                    if (format === 'list') {
                        const listKey = `_list_${header}`;
                        const optionsData = appData.referenceDB[listKey];
                        const options = optionsData ? Object.keys(optionsData).filter(k => k !== '__DEFAULT__') : [];
                        const select = document.createElement('select');
                        select.className = "w-full h-full p-3 bg-transparent border-0 focus:ring-0 text-center";
                        select.innerHTML = `<option value=""></option>` + options.map(opt => `<option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                        select.onchange = (e) => handleCellUpdate(row.id, header, e.target.value);
                        select.style.color = 'inherit';
                        td.appendChild(select);
                    } else if (format === 'date') {
                        const input = createDateInputComponent(value, (newValue) => {
                            handleCellUpdate(row.id, header, newValue);
                        });
                        input.style.color = 'inherit';
                        td.appendChild(input);
                    } else {
                        const div = document.createElement('div');
                        div.className = "data-cell w-full h-full p-3";
                        div.setAttribute('contenteditable', 'true');
                        div.textContent = value;
                        div.onblur = (e) => handleCellUpdate(row.id, header, e.target.textContent);
                        div.onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); e.target.blur(); }};
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
                if (appData.sortBy === header) {
                    appData.sortOrder = appData.sortOrder === 'asc' ? 'desc' : 'asc';
                } else {
                    appData.sortBy = header;
                    appData.sortOrder = 'asc';
                }
                saveData();
                sortAndApplyFilters();
            });
        });

        elements.rowCount.textContent = `${filteredData.length} de ${appData.mainData.length} registros`;
        renderPagination();
    }
    
    function createDateInputComponent(initialValue, onUpdateCallback) {
        const input = document.createElement('input');
        input.type = "text";
        input.className = "w-full h-full p-3 bg-transparent border-0 focus:ring-0 text-center date-cell";
        input.value = initialValue;
        let valueOnFocus = initialValue;

        input.onfocus = (e) => {
            valueOnFocus = e.target.value; 
            e.target.type = 'date';
            const date = parseDate(valueOnFocus);
            if (date) {
                e.target.value = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
            } else {
                e.target.value = '';
            }
        };

        input.onblur = (e) => {
            e.target.type = 'text';
            let finalValue = '';
            if (e.target.value) { // Value is YYYY-MM-DD from date picker
                const dateObj = new Date(e.target.value + 'T00:00:00Z');
                if (!isNaN(dateObj)) {
                    finalValue = formatDate(dateObj);
                }
            }
            e.target.value = finalValue;

            if (finalValue !== valueOnFocus) {
                if (onUpdateCallback) {
                    onUpdateCallback(finalValue);
                }
            } else {
                e.target.value = valueOnFocus;
            }
        };
        return input;
    }

    function renderPagination() {
        const totalPages = Math.ceil(filteredData.length / appData.rowsPerPage);
        const container = elements.paginationControlsBottom;
        container.innerHTML = '';
        if (totalPages <= 1) return;

        const prevBtn = document.createElement('button');
        prevBtn.textContent = 'Anterior';
        prevBtn.className = "px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50";
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => { if (currentPage > 1) { currentPage--; renderTable(); } };
        container.appendChild(prevBtn);

        const pageInfo = document.createElement('span');
        pageInfo.className = "font-semibold";
        pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
        container.appendChild(pageInfo);

        const nextBtn = document.createElement('button');
        nextBtn.textContent = 'Siguiente';
        nextBtn.className = "px-3 py-1 bg-gray-200 dark:bg-gray-600 rounded-md disabled:opacity-50";
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.onclick = () => { if (currentPage < totalPages) { currentPage++; renderTable(); } };
        container.appendChild(nextBtn);
    }
    
    function renderFilters() {
        elements.filtersContainer.innerHTML = '';
        const activeFiltersContainer = document.createElement('div');
        activeFiltersContainer.id = 'active-filters-list';
        activeFiltersContainer.className = 'space-y-2 w-full';
        
        appData.filters.forEach((filter, index) => {
            const filterEl = createFilterUI(filter, index);
            activeFiltersContainer.appendChild(filterEl);
        });

        elements.filtersContainer.appendChild(activeFiltersContainer);
        
        const controlsContainer = document.createElement('div');
        controlsContainer.className = 'flex items-center gap-2 mt-2';

        const addFilterBtn = document.createElement('button');
        addFilterBtn.textContent = 'Añadir Filtro';
        addFilterBtn.className = 'text-sm bg-sky-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-sky-600';
        addFilterBtn.onclick = () => {
            appData.filters.push({ column: '', condition: '=', value: '' });
            saveData();
            renderFilters();
        };
        controlsContainer.appendChild(addFilterBtn);

        const applyBtn = document.createElement('button');
        applyBtn.textContent = 'Aplicar';
        applyBtn.className = 'text-sm bg-green-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-green-600';
        applyBtn.onclick = () => {
            currentPage = 1;
            sortAndApplyFilters();
            showToast('Filtros aplicados.', 'info');
        };
        controlsContainer.appendChild(applyBtn);

        if (appData.filters.length > 0) {
            const clearBtn = document.createElement('button');
            clearBtn.textContent = 'Limpiar';
            clearBtn.className = 'text-sm bg-gray-500 text-white font-semibold py-2 px-3 rounded-lg hover:bg-gray-600';
            clearBtn.onclick = () => {
                appData.filters = [];
                saveData();
                renderFilters();
                sortAndApplyFilters();
            };
            controlsContainer.appendChild(clearBtn);
        }
        elements.filtersContainer.appendChild(controlsContainer);
    }

    function createFilterUI(filter, index) {
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg w-full';
        
        const columnSelect = document.createElement('select');
        columnSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm w-40';
        columnSelect.innerHTML = `<option value="">-- Columna --</option>` + appData.headers.map(h => `<option value="${h}" ${filter.column === h ? 'selected' : ''}>${h}</option>`).join('');
        columnSelect.onchange = (e) => {
            filter.column = e.target.value;
            filter.value = '';
            const newFilterUI = createFilterUI(filter, index);
            wrapper.replaceWith(newFilterUI);
            saveData();
        };
        wrapper.appendChild(columnSelect);

        if (filter.column) {
            const format = appData.columnFormats[filter.column] || 'text';
            
            const conditionSelect = document.createElement('select');
            conditionSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            if (format === 'date' || !isNaN(parseFloat(appData.mainData[0]?.[filter.column]))) {
                 conditionSelect.innerHTML = `<option value=">=" ${filter.condition === '>=' ? 'selected':''}> >= </option><option value="<=" ${filter.condition === '<=' ? 'selected':''}> <= </option><option value="=" ${filter.condition === '=' ? 'selected':''}> = </option>`;
            } else { 
                 conditionSelect.innerHTML = `<option value="=" ${filter.condition === '=' ? 'selected':''}>Es igual a</option>`;
                 filter.condition = '=';
            }
            conditionSelect.onchange = (e) => { filter.condition = e.target.value; saveData(); };
            wrapper.appendChild(conditionSelect);

            if (format === 'list') {
                const listKey = `_list_${filter.column}`;
                const optionsData = appData.referenceDB[listKey];
                const options = optionsData ? Object.keys(optionsData).filter(k => k !== '__DEFAULT__') : [];
                const valueSelect = document.createElement('select');
                valueSelect.className = 'flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
                valueSelect.innerHTML = `<option value="">Todos</option>` + options.map(opt => `<option value="${opt}" ${filter.value === opt ? 'selected' : ''}>${opt}</option>`).join('');
                valueSelect.onchange = (e) => { filter.value = e.target.value; saveData(); };
                wrapper.appendChild(valueSelect);
            } else if (format === 'date') {
                 const valueInput = createDateInputComponent(filter.value || '', (newValue) => {
                    filter.value = newValue;
                    saveData();
                });
                valueInput.placeholder = "DD/MM/YYYY";
                valueInput.className = 'flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
                wrapper.appendChild(valueInput);
            } else { 
                const valueInput = document.createElement('input');
                valueInput.type = 'text';
                valueInput.placeholder = 'Valor...';
                valueInput.className = 'flex-grow p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
                valueInput.value = filter.value || '';
                valueInput.oninput = () => { filter.value = valueInput.value; saveData(); };
                wrapper.appendChild(valueInput);
            }
        }
        
        const removeBtn = document.createElement('button');
        removeBtn.innerHTML = '&times;';
        removeBtn.title = 'Quitar Filtro';
        removeBtn.className = 'text-xl text-red-500 hover:text-red-700 font-bold px-2';
        removeBtn.onclick = () => {
            appData.filters.splice(index, 1);
            saveData();
            renderFilters();
            sortAndApplyFilters();
        };
        wrapper.appendChild(removeBtn);

        return wrapper;
    }

    function updateSummaryBar() {
        const bar = elements.summaryBar;
        bar.innerHTML = '';

        const colorCol = appData.colorCodingColumn;
        if (!colorCol) return;

        const counts = filteredData.reduce((acc, row) => {
            const value = row[colorCol] || `Sin ${colorCol}`;
            acc[value] = (acc[value] || 0) + 1;
            return acc;
        }, {});

        const theme = elements.htmlTag.classList.contains('dark') ? 'dark' : 'light';
        const colorDbKey = `_list_${colorCol}`;
        const colorDb = appData.referenceDB[colorDbKey];

        Object.entries(counts).forEach(([value, count]) => {
            const span = document.createElement('span');
            span.className = 'text-xs px-2 py-1 rounded-full font-bold';
            
            const colorConfig = colorDb ? (colorDb[value] || colorDb['__DEFAULT__']) : null;
            if(colorConfig) {
                span.style.backgroundColor = theme === 'dark' ? colorConfig.dark : colorConfig.light;
                span.style.color = theme === 'dark' ? colorConfig.textDark : colorConfig.textLight;
            } else {
                 span.style.backgroundColor = theme === 'dark' ? '#374151' : '#e5e7eb';
                 span.style.color = theme === 'dark' ? '#d1d5db' : '#374151';
            }
            span.textContent = `${value}: ${count}`;
            bar.appendChild(span);
        });
    }
    
    function updateSelectionStatus() {
        elements.deleteRowBtn.disabled = !selectedRowId;
        elements.generatePdfBtn.disabled = !(selectedRowId && selectedTemplateId);
        elements.editSelectedTemplateBtn.disabled = !selectedTemplateId;
        elements.deleteSelectedTemplateBtn.disabled = !selectedTemplateId;
        updateSelectedRowIdentifierDisplay();
    }

    function handleRowSelection(rowId) {
        selectedRowId = selectedRowId === rowId ? null : rowId;
        renderTable();
        updateSelectionStatus();
    }

    function updateSelectedRowIdentifierDisplay() {
        const display = elements.selectedRowIdentifierDisplay;
        if (!display) return;
        
        const idColumn = appData.selectedRowIdentifierColumn;

        if (selectedRowId && idColumn && appData.headers.includes(idColumn)) {
            const rowData = appData.mainData.find(r => r.id === selectedRowId);
            if (rowData) {
                const identifierValue = rowData[idColumn] || 'N/A';
                display.innerHTML = `<span class="font-medium">Seleccionado:</span> <span class="font-extrabold">${identifierValue}</span>`;
                display.title = `${idColumn}: ${identifierValue}`;
                display.style.display = 'block';
            } else {
                display.style.display = 'none';
            }
        } else {
            display.style.display = 'none';
        }
    }
    
    function applyTheme(theme) {
        localStorage.setItem('theme', theme);
        elements.htmlTag.className = theme;
        elements.themeToggleDarkIcon.classList.toggle('hidden', theme === 'dark');
        elements.themeToggleLightIcon.classList.toggle('hidden', theme !== 'dark');
        fullReloadUI();
    }

    function fullReloadUI() {
        sortAndApplyFilters();
        renderFilters();
        renderTemplates();
        updateSelectionStatus();
    }
    
    function renderTemplates() {
        const select = elements.templateSelectDropdown;
        select.innerHTML = '';
        const hasTemplates = appData.templates && appData.templates.length > 0;
        const noneOption = document.createElement('option');
        noneOption.value = "";
        noneOption.textContent = hasTemplates ? 'Seleccionar plantilla...' : 'Crea una plantilla';
        select.appendChild(noneOption);

        if (hasTemplates) {
            const sortedTemplates = [...appData.templates].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
            sortedTemplates.forEach(template => {
                select.innerHTML += `<option value="${template.id}">${template.name}</option>`;
            });
        }
        select.value = selectedTemplateId || '';
    }

    // ### MODALS & FEATURE LOGIC ###

    function showConfirmModal(message, onConfirm, title = 'Confirmar Acción') {
        elements.confirmModal.classList.add('active');
        document.getElementById('confirm-title').textContent = title;
        document.getElementById('confirm-message').textContent = message;

        const confirmBtn = document.getElementById('confirm-submit-btn');
        const cancelBtn = document.getElementById('confirm-cancel-btn');
        let confirmHandler, cleanup;

        confirmHandler = () => {
            onConfirm();
            cleanup();
        };

        cleanup = () => {
            elements.confirmModal.classList.remove('active');
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cleanup);
        };

        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cleanup);
    }

    function showPromptModal(title, onConfirm, defaultValue = '') {
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
                if (value.trim()) {
                    if(onConfirm) onConfirm(value);
                    resolve(value);
                    cleanup();
                } else {
                    showToast('El valor no puede estar vacío.', 'warning');
                }
            };

            cleanup = () => {
                elements.promptModal.classList.remove('active');
                form.removeEventListener('submit', submitHandler);
                cancelBtn.removeEventListener('click', cleanup);
            };

            form.addEventListener('submit', submitHandler);
            cancelBtn.addEventListener('click', cleanup);
        });
    }

    function openTemplateModal(id = null) {
        let template = { name: '', content: '', manualFields: [], imageFields: [], fontFamily: 'Helvetica' };
        elements.templateModal.classList.add('active');
        
        const modalTitle = document.getElementById('modal-title');
        const templateIdInput = document.getElementById('template-id');
        const templateNameInput = document.getElementById('template-name');
        const templateContentInput = document.getElementById('template-content');
        const templateFontInput = document.getElementById('template-font');

        if (id) {
            template = appData.templates.find(t => t.id === id) || template;
            modalTitle.textContent = 'Editar Plantilla';
            templateIdInput.value = id;
        } else {
            modalTitle.textContent = 'Crear Nueva Plantilla';
            templateIdInput.value = '';
        }
        templateNameInput.value = template.name;
        templateContentInput.value = template.content;
        templateFontInput.value = template.fontFamily || 'Helvetica';
        updatePlaceholders(template.manualFields, template.imageFields);
    }
    
    function addTemplatePlaceholder(fieldName, type) {
        const placeholdersContainer = document.getElementById('placeholders-container');
        const existingTextFields = Array.from(placeholdersContainer.querySelectorAll('.manual-field-container')).map(c => c.dataset.placeholder);
        const existingImageFields = Array.from(placeholdersContainer.querySelectorAll('.image-field-container')).map(c => c.dataset.placeholder);
        
        const allExistingFields = appData.headers.concat(existingTextFields, existingImageFields);

        if (allExistingFields.includes(fieldName)) {
            return showToast('El campo ya existe.', 'warning');
        }

        if (type === 'text') {
            updatePlaceholders([...existingTextFields, fieldName], existingImageFields);
        } else { // type === 'image'
            updatePlaceholders(existingTextFields, [...existingImageFields, fieldName]);
        }
    }

    function moveManualField(fieldName, direction) {
        const placeholdersContainer = document.getElementById('placeholders-container');
        let manualFields = Array.from(placeholdersContainer.querySelectorAll('.manual-field-container')).map(c => c.dataset.placeholder);
        const imageFields = Array.from(placeholdersContainer.querySelectorAll('.image-field-container')).map(c => c.dataset.placeholder);

        const index = manualFields.indexOf(fieldName);
        const newIndex = index + direction;

        if (newIndex < 0 || newIndex >= manualFields.length) {
            return;
        }

        [manualFields[index], manualFields[newIndex]] = [manualFields[newIndex], manualFields[index]];

        updatePlaceholders(manualFields, imageFields);
    }

    function saveTemplate() {
        const templateIdInput = document.getElementById('template-id');
        const templateNameInput = document.getElementById('template-name');
        const templateContentInput = document.getElementById('template-content');
        const templateFontInput = document.getElementById('template-font');
        const placeholdersContainer = document.getElementById('placeholders-container');

        const id = templateIdInput.value;
        const name = templateNameInput.value.trim();
        if (!name) return showToast('El nombre de la plantilla es obligatorio.', 'warning');
        const content = templateContentInput.value;
        const fontFamily = templateFontInput.value;
        const manualFields = Array.from(placeholdersContainer.querySelectorAll('.manual-field-container')).map(container => container.dataset.placeholder);
        const imageFields = Array.from(placeholdersContainer.querySelectorAll('.image-field-container')).map(container => container.dataset.placeholder);

        if (id) {
            const index = appData.templates.findIndex(t => t.id === id);
            if (index > -1) appData.templates[index] = { ...appData.templates[index], name, content, manualFields, imageFields, fontFamily };
        } else {
            appData.templates.push({ id: `template_${Date.now()}`, name, content, manualFields, imageFields, fontFamily });
        }
        saveData();
        renderTemplates();
        elements.templateModal.classList.remove('active');
        showToast('Plantilla guardada.', 'success');
    }
    
    function deleteTemplate(id, name) {
        showConfirmModal(`¿Eliminar plantilla "${name}"?`, () => {
            appData.templates = appData.templates.filter(t => t.id !== id);
            if (selectedTemplateId === id) {
                selectedTemplateId = null;
            }
            saveData();
            renderTemplates();
            updateSelectionStatus();
            showToast('Plantilla eliminada.', 'success');
        });
    }
    
    function updatePlaceholders(manualFields = [], imageFields = []) {
        const placeholdersContainer = document.getElementById('placeholders-container');
        placeholdersContainer.innerHTML = '';
        appData.headers.forEach(h => {
            const btn = document.createElement('button');
            btn.className = "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 text-xs font-mono font-semibold px-2 py-1 rounded-md hover:bg-sky-200 dark:hover:bg-sky-700";
            btn.textContent = h; btn.dataset.placeholder = h;
            btn.onclick = () => insertPlaceholderForTemplate(h);
            placeholdersContainer.appendChild(btn);
        });
        
        (manualFields || []).forEach((field, index) => {
            const container = document.createElement('div');
            container.className = "manual-field-container bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1.5 hover:bg-purple-200 dark:hover:bg-purple-700";
            container.dataset.placeholder = field;
            
            const moveContainer = document.createElement('div');
            moveContainer.className = "flex flex-col";

            const upBtn = document.createElement('button');
            upBtn.innerHTML = '▲';
            upBtn.type = 'button';
            upBtn.className = 'move-manual-field-btn';
            upBtn.title = 'Mover arriba';
            upBtn.dataset.field = field;
            upBtn.dataset.direction = '-1';
            if (index === 0) upBtn.disabled = true;

            const downBtn = document.createElement('button');
            downBtn.innerHTML = '▼';
            downBtn.type = 'button';
            downBtn.className = 'move-manual-field-btn';
            downBtn.title = 'Mover abajo';
            downBtn.dataset.field = field;
            downBtn.dataset.direction = '1';
            if (index === manualFields.length - 1) downBtn.disabled = true;

            moveContainer.appendChild(upBtn);
            moveContainer.appendChild(downBtn);

            const textSpan = document.createElement('span');
            textSpan.textContent = field;
            textSpan.className = "px-1 cursor-pointer flex-grow text-center";
            textSpan.onclick = () => insertPlaceholderForTemplate(field);
    
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.title = "Eliminar campo";
            removeBtn.className = "delete-manual-field font-bold text-red-500 cursor-pointer text-lg leading-none hover:text-red-700";
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                const currentManuals = (manualFields || []).filter(f => f !== field);
                updatePlaceholders(currentManuals, imageFields);
            };
            
            container.appendChild(moveContainer);
            container.appendChild(textSpan);
            container.appendChild(removeBtn);
            placeholdersContainer.appendChild(container);
        });

        (imageFields || []).forEach(field => {
            const container = document.createElement('div');
            container.className = "image-field-container bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200 text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-2 hover:bg-teal-200 dark:hover:bg-teal-700";
            container.dataset.placeholder = field;

            const textSpan = document.createElement('span');
            textSpan.textContent = `🖼️ ${field}`;
            textSpan.className = "px-1 cursor-pointer flex-grow text-center";
            textSpan.onclick = () => insertPlaceholderForTemplate(field, 'image');

            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '&times;';
            removeBtn.title = "Eliminar campo de imagen";
            removeBtn.className = "font-bold text-red-500 cursor-pointer text-lg leading-none hover:text-red-700";
            removeBtn.onclick = (e) => {
                e.stopPropagation();
                const currentManualFields = (manualFields || []);
                const currentImageFields = (imageFields || []).filter(f => f !== field);
                updatePlaceholders(currentManualFields, currentImageFields);
            };
            
            container.appendChild(textSpan);
            container.appendChild(removeBtn);
            placeholdersContainer.appendChild(container);
        });
    }
    
    function insertPlaceholderForTemplate(text, type = 'text') {
        const templateContentInput = document.getElementById('template-content');
        const placeholder = type === 'image' ? `{{IMAGEN:${text}}}` : `{{${text}}}`;
        const start = templateContentInput.selectionStart;
        const end = templateContentInput.selectionEnd;
        templateContentInput.value = templateContentInput.value.substring(0, start) + placeholder + templateContentInput.value.substring(end);
        templateContentInput.focus();
        templateContentInput.selectionEnd = start + placeholder.length;
    }

    function applyTextFormat(format) {
        const textarea = document.getElementById('template-content');
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        if (start === end) return;
        
        const selectedText = textarea.value.substring(start, end);
        let replacement;
        let wrapper = '';

        switch (format) {
            case 'bold': wrapper = '**'; break;
            case 'italic': wrapper = '*'; break;
            default: return;
        }

        replacement = `${wrapper}${selectedText}${wrapper}`;
        textarea.setRangeText(replacement, start, end, 'end');
        textarea.focus();
    }
    
    function generatePDF() {
        const template = selectedTemplateId ? appData.templates.find(t => t.id === selectedTemplateId) : null;
        const rowData = selectedRowId ? appData.mainData.find(r => r.id === selectedRowId) : null;
        if (!template || !rowData) return showToast('Debes seleccionar una fila y una plantilla.', 'error');

        pendingPDFGeneration = { template, rowData, uploadedImages: {} };

        const imageFields = template.imageFields || [];
        const manualVars = template.manualFields || [];

        if (imageFields.length > 0) {
            promptForImages(imageFields);
        } else if (manualVars.length > 0) {
            promptForManualVars(manualVars);
        } else {
            processAndShowPreview();
        }
    }

    function promptForImages(imageFields) {
        const form = elements.imageUploadModal.querySelector('#image-upload-form');
        form.innerHTML = ''; 

        imageFields.forEach(fieldName => {
            const fieldId = `image-input-${fieldName.replace(/\s/g, '-')}`;
            const container = document.createElement('div');
            container.className = 'p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center';
            container.innerHTML = `
                <label for="${fieldId}" class="font-semibold text-gray-700 dark:text-gray-300 cursor-pointer">
                    ${fieldName}
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Haz clic para seleccionar o arrastra una imagen aquí</p>
                    <img id="preview-${fieldId}" class="hidden max-h-24 mx-auto mt-2 rounded"/>
                </label>
                <input type="file" id="${fieldId}" name="${fieldName}" accept="image/png, image/jpeg" class="hidden">
            `;
            
            const input = container.querySelector('input[type="file"]');
            const preview = container.querySelector('img');

            const handleFile = (file) => {
                if (file && file.type.startsWith('image/')) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        preview.src = e.target.result;
                        preview.classList.remove('hidden');
                        pendingPDFGeneration.uploadedImages[fieldName] = e.target.result; // Guardar Base64
                    };
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

    function promptForManualVars(manualVars) {
        const manualVarsForm = document.getElementById('manual-vars-form');
        manualVarsForm.innerHTML = '';
        manualVars.forEach(varName => {
            const label = document.createElement('label');
            label.className = "block";
            label.innerHTML = `<span class="text-sm font-semibold text-gray-700 dark:text-gray-300">${varName}</span>
                               <input type="text" name="${varName}" class="mt-1 w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-200">`;
            manualVarsForm.appendChild(label);
        });
        elements.manualVarsModal.classList.add('active');
    }

    function processAndShowPreview() {
        if (!pendingPDFGeneration) return;
        let { template, rowData } = pendingPDFGeneration;
        let content = template.content;
        const manualValues = {};
        const manualVarsForm = document.getElementById('manual-vars-form');

        if (elements.manualVarsModal.classList.contains('active')) {
            const formData = new FormData(manualVarsForm);
            for (let [key, value] of formData.entries()) manualValues[key] = value;
        }
        
        const finalContent = content.replace(/\{\{(IMAGEN:)?(.*?)\}\}/g, (_, isImage, key) => {
            key = key.trim();
            if (isImage) return ''; // Los placeholders de imagen se eliminan del texto, se manejarán por separado
            if (manualValues.hasOwnProperty(key)) return manualValues[key];
            if (rowData.hasOwnProperty(key)) {
                const value = String(rowData[key] ?? '');
                return value.trim() ? value : '';
            }
            return `{{${key}}}`;
        });
        
        elements.manualVarsModal.classList.remove('active');
        elements.imageUploadModal.classList.remove('active');

        pendingPDFGeneration.finalContent = finalContent;
        showPreview(finalContent);
    }


    function showPreview(content) {
        pendingPDFGeneration.finalContent = content;
        const previewText = document.getElementById('preview-text');
        previewText.innerHTML = content
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.*?)\*/g, '<i>$1</i>')
            .replace(/\n/g, '<br>');
        elements.previewModal.classList.add('active');
    }

    function generatePdfFilename() {
        const { rowData, template } = pendingPDFGeneration;
        let filename = appData.pdfFilenameFormat || 'Documento.pdf';
        const manualValues = {};

        const formElement = document.getElementById('manual-vars-form');
        if (formElement.elements.length > 0) {
            const formData = new FormData(formElement);
            for (let [key, value] of formData.entries()) {
                 manualValues[key] = value;
            }
        }
       
        filename = filename.replace(/\{\{(.*?)\}\}/g, (_, key) => {
            key = key.trim();
            if (manualValues.hasOwnProperty(key)) return manualValues[key];
            
            if (rowData.hasOwnProperty(key)) {
                const value = String(rowData[key] ?? '');
                return value.trim() ? value : '';
            }

            if (key.toLowerCase() === 'fecha_actual') return getFormattedDateForFilename();
            if (key.toLowerCase() === 'nombre_plantilla') return template.name;
            return '';
        });

        filename = filename.replace(/[\\/:*?"<>|]/g, '_').replace(/\s+/g, ' ');
        
        return `${filename}.pdf`;
    }

    // REEMPLAZA TU FUNCIÓN "downloadPDF" CON ESTA VERSIÓN COMPLETA Y CORREGIDA

// REEMPLAZA TU FUNCIÓN "downloadPDF" CON ESTA VERSIÓN MEJORADA Y OPTIMIZADA
    async function downloadPDF() {
        if (!pendingPDFGeneration) return;
        const { template, uploadedImages } = pendingPDFGeneration;

        const initialFilename = generatePdfFilename();
        const finalFilename = await showPromptModal('Confirmar nombre del archivo PDF', null, initialFilename);

        if (!finalFilename) return;

        try {
            const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
            const margin = 20;
            const usableWidth = doc.internal.pageSize.getWidth() - (2 * margin);
            const pageHeight = doc.internal.pageSize.getHeight();
            const fontSize = 12;
            const lineHeight = (fontSize * 1.3) * 0.352778; // Conversión aproximada pt a mm
            let cursorY = margin;

            const addPageIfNeeded = (requiredHeight) => {
                if (cursorY + requiredHeight > pageHeight - margin) {
                    doc.addPage();
                    cursorY = margin;
                    return true;
                }
                return false;
            };

            // Función auxiliar para parsear Markdown por capas (MUCHO MÁS ROBUSTA)
            const parseStyledText = (text) => {
                const parts = [];
                // 1. Cortamos por Negrita (**)
                const boldSegments = text.split('**');
                
                boldSegments.forEach((segment, boldIndex) => {
                    // Si el índice es impar (1, 3, 5...), es Negrita. Si es par (0, 2...), es normal.
                    const isBold = boldIndex % 2 !== 0;
                    
                    // 2. Cortamos por Cursiva (*) lo que ya tenemos
                    const italicSegments = segment.split('*');
                    
                    italicSegments.forEach((subSegment, italicIndex) => {
                        // Si el índice es impar, es Cursiva.
                        const isItalic = italicIndex % 2 !== 0;
                        
                        if (subSegment.length > 0) {
                            parts.push({
                                text: subSegment,
                                bold: isBold,
                                italic: isItalic
                            });
                        }
                    });
                });
                return parts;
            };

            // Función para elegir el estilo de fuente correcto
            const getFontStyle = (bold, italic) => {
                if (bold && italic) return 'bolditalic';
                if (bold) return 'bold';
                if (italic) return 'italic';
                return 'normal';
            };

            // Escritor inteligente que envuelve palabras
            const writeLineWithMarkdown = (line, x) => {
                let currentX = x;
                
                // Obtenemos los segmentos ya procesados (Ej: {text: "hola", bold: true...})
                const segments = parseStyledText(line);

                for (const segment of segments) {
                    // Configuramos la fuente para este segmento
                    const styleName = getFontStyle(segment.bold, segment.italic);
                    doc.setFont(template.fontFamily || 'Helvetica', styleName);

                    // Dividimos por palabras para poder hacer salto de línea si es necesario
                    // El regex (\s+) mantiene los espacios como tokens separados
                    const tokens = segment.text.split(/(\s+)/);

                    for (const token of tokens) {
                        if (token.length === 0) continue;

                        const tokenWidth = doc.getStringUnitWidth(token) * fontSize / doc.internal.scaleFactor;

                        // Si la palabra no entra, bajamos de renglón
                        if (currentX + tokenWidth > x + usableWidth) {
                            cursorY += lineHeight;
                            addPageIfNeeded(lineHeight);
                            currentX = x;
                        }

                        doc.text(token, currentX, cursorY);
                        currentX += tokenWidth;
                    }
                }
                
                // Reseteamos a normal por seguridad
                doc.setFont(template.fontFamily || 'Helvetica', 'normal');
            };

            doc.setFont(template.fontFamily || 'Helvetica', 'normal');
            doc.setFontSize(fontSize);

            // Reemplazo de variables (Lógica original mantenida y limpia)
            const contentWithPlaceholders = pendingPDFGeneration.template.content;
            const finalRenderableContent = contentWithPlaceholders.replace(/\{\{(?!IMAGEN:)(.*?)\}\}/g, (_, key) => {
                 const manualValues = {};
                 const manualVarsForm = document.getElementById('manual-vars-form');
                 if (manualVarsForm && manualVarsForm.elements.length > 0) {
                     const formData = new FormData(manualVarsForm);
                     for (let [k, value] of formData.entries()) manualValues[k] = value;
                 }
                 key = key.trim();
                 if (manualValues.hasOwnProperty(key)) return manualValues[key];
                 if (pendingPDFGeneration.rowData.hasOwnProperty(key)) {
                     const value = String(pendingPDFGeneration.rowData[key] ?? '');
                     return value.trim() ? value : '';
                 }
                 return ``;
            });

            // División por imágenes
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
                        if (imgHeight > maxImgHeight) {
                            imgHeight = maxImgHeight;
                            imgWidth = imgHeight * aspectRatio;
                        }

                        addPageIfNeeded(imgHeight + lineHeight);
                        doc.addImage(base64Image, 'JPEG', margin, cursorY, imgWidth, imgHeight);
                        cursorY += imgHeight + lineHeight;
                    }
                } else {
                    // Procesamiento de texto párrafo por párrafo
                    const paragraphs = part.split('\n');
                    paragraphs.forEach((paragraph, pIndex) => {
                        // Si el párrafo está vacío (salto de línea manual del usuario)
                        if (paragraph.trim() === '') {
                             if (pIndex < paragraphs.length - 1) { // Solo si no es el último
                                cursorY += lineHeight;
                                addPageIfNeeded(lineHeight);
                             }
                             return;
                        }

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
            pendingPDFGeneration = null;
        }
    }

    
    function openColumnsModal() {
        const columnsList = document.getElementById('columns-list');
        columnsList.innerHTML = '';
        selectedColumnNameForDeletion = null;
        document.getElementById('delete-col-btn').disabled = true;

        const keySettingsContainer = document.getElementById('column-key-settings');
        keySettingsContainer.innerHTML = '';
        const keyColLabel = document.createElement('label');
        keyColLabel.className = 'flex items-center gap-2 text-sm';
        keyColLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Calcular "DIAS" a partir de la columna de fecha:</span>`;
        
        const keyColSelect = document.createElement('select');
        keyColSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700';
        
        const dateColumns = appData.headers.filter(h => appData.columnFormats[h] === 'date');
        keyColSelect.innerHTML = `<option value="">-- No calcular --</option>` + 
            dateColumns.map(h => `<option value="${h}" ${appData.keyColumns.dateForCalculation === h ? 'selected' : ''}>${h}</option>`).join('');
        
        keyColSelect.onchange = (e) => {
            appData.keyColumns.dateForCalculation = e.target.value || null;
            recalculateAllDays();
            saveData();
            sortAndApplyFilters();
            showToast('Columna de cálculo actualizada.', 'success');
        };
        
        keyColLabel.appendChild(keyColSelect);
        keySettingsContainer.appendChild(keyColLabel);

        appData.headers.forEach((header, index) => {
            const item = document.createElement('div');
            item.className = 'column-manager-item flex items-center gap-3 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg border border-transparent cursor-pointer';
            item.dataset.headerName = header;

            const isProtected = appData.columnMetadata[header]?.isProtected || header === appData.keyColumns?.daysDisplay;

            item.onclick = (e) => {
                if(e.target.closest('input, select, button')) return;
                const currentSelected = columnsList.querySelector('.border-sky-500');
                if (currentSelected) currentSelected.classList.remove('border-sky-500', 'bg-sky-100', 'dark:bg-sky-800');
                item.classList.add('border-sky-500', 'bg-sky-100', 'dark:bg-sky-800');
                selectedColumnNameForDeletion = header;
                document.getElementById('delete-col-btn').disabled = isProtected;
            };
            
            const moveButtons = document.createElement('div');
            moveButtons.className = 'flex items-center gap-1';
            const upBtn = `<button data-direction="-1" class="p-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" ${index === 0 ? 'disabled' : ''}>◀</button>`;
            const downBtn = `<button data-direction="1" class="p-2 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600" ${index === appData.headers.length - 1 ? 'disabled' : ''}>▶</button>`;
            moveButtons.innerHTML = upBtn + downBtn;
            moveButtons.querySelectorAll('button').forEach(btn => btn.onclick = () => moveColumn(header, parseInt(btn.dataset.direction)));
            item.appendChild(moveButtons);

            const nameInput = document.createElement('input');
            nameInput.type = 'text';
            nameInput.value = header;
            nameInput.className = 'flex-grow font-semibold bg-transparent focus:outline-none focus:ring-0 border-0 p-2 text-gray-800 dark:text-gray-200';
            nameInput.onblur = (e) => handleColumnRename(header, e.target.value);
            nameInput.onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); e.target.blur(); }};
            item.appendChild(nameInput);

            if (isProtected) {
                const lockIcon = document.createElement('span');
                lockIcon.title = header === appData.keyColumns?.daysDisplay ? "Columna de DÍAS, protegida." : "Columna protegida";
                lockIcon.innerHTML = `<svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 1 1 0 000-2z" clip-rule="evenodd"></path></svg>`;
                item.appendChild(lockIcon);
            }
            
            const widthInput = document.createElement('input');
            widthInput.type = 'text';
            widthInput.placeholder = 'auto';
            widthInput.className = 'w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200';
            widthInput.value = appData.columnWidths[header] || '';
            widthInput.onblur = (e) => handleColumnWidthChange(header, e.target.value);
            widthInput.onkeydown = (e) => { if(e.key === 'Enter') { e.preventDefault(); e.target.blur(); }};
            item.appendChild(widthInput);

            const formatSelect = document.createElement('select');
            formatSelect.className = 'w-28 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200';
            formatSelect.innerHTML = `<option value="text">Texto</option><option value="date">Fecha</option><option value="list">Lista</option><option value="cuit">CUIT/CUIL</option>`;
            formatSelect.value = appData.columnFormats[header] || 'text';
            formatSelect.onchange = () => handleFormatChange(header, formatSelect.value);
            item.appendChild(formatSelect);
            
            columnsList.appendChild(item);
        });
        
        elements.columnsModal.classList.add('active');
    }

    function handleColumnWidthChange(header, width) {
        const trimmedWidth = width.trim();
        if (trimmedWidth === '' || trimmedWidth === 'auto') {
            delete appData.columnWidths[header];
        } else {
            if (!/^\d+(\.\d+)?(px|%|em|rem|vw|ch)$/.test(trimmedWidth)) {
               showToast('Formato de ancho inválido. Use px, %, em, etc.', 'error');
               const input = document.querySelector(`.column-manager-item[data-header-name="${header}"] input[type="text"]:not([class*="font-semibold"])`);
               if(input) input.value = appData.columnWidths[header] || '';
               return;
            }
            appData.columnWidths[header] = trimmedWidth;
        }
        saveData();
    }

    function handleFormatChange(header, newFormat) {
        if(newFormat === 'text') {
            delete appData.columnFormats[header];
        } else {
            appData.columnFormats[header] = newFormat;
        }

        if (newFormat === 'list') {
            const listKey = `_list_${header}`;
            if (!appData.referenceDB[listKey]) {
                appData.referenceDB[listKey] = {
                    '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' }
                };
                showToast(`Se creó una nueva BD para la lista "${header}". Gestionala en "BD/Ajustes".`, 'info');
            }
        }
        saveData();
        openColumnsModal();
    }

    function addColumn() {
        showPromptModal("Ingrese el nombre de la nueva columna:", (newColName) => {
            newColName = newColName.trim().toUpperCase();
            if (!appData.headers.includes(newColName)) {
                appData.headers.push(newColName);
                appData.columnMetadata[newColName] = { isProtected: false };
                appData.mainData.forEach(row => row[newColName] = '');
                saveData();
                openColumnsModal();
                showToast(`Columna "${newColName}" añadida.`, 'success');
            } else {
                showToast('Esa columna ya existe.', 'warning');
            }
        });
    }

    function deleteColumn() {
        if (!selectedColumnNameForDeletion) return showToast('Seleccione una columna para eliminar.', 'warning');
        const colToDelete = selectedColumnNameForDeletion;

        if (appData.columnMetadata[colToDelete]?.isProtected || colToDelete === appData.keyColumns?.daysDisplay) {
            return showToast(`La columna "${colToDelete}" está protegida y no puede ser eliminada.`, 'error');
        }

        showConfirmModal(`¿Seguro que quiere eliminar la columna "${colToDelete}"? Se borrarán todos sus datos.`, () => {
            const index = appData.headers.indexOf(colToDelete);
            if (index > -1) {
                appData.headers.splice(index, 1);
                appData.mainData.forEach(row => delete row[colToDelete]);
                delete appData.columnMetadata[colToDelete];
                delete appData.columnFormats[colToDelete];
                delete appData.columnWidths[colToDelete];
                
                if (appData.colorCodingColumn === colToDelete) appData.colorCodingColumn = null;
                if (appData.bulkDeleteColumn === colToDelete) appData.bulkDeleteColumn = null;
                if (appData.hideSettings.column === colToDelete) appData.hideSettings.column = null;

                const listKey = `_list_${colToDelete}`;
                delete appData.referenceDB[listKey];

                (appData.lookupRelations || []).forEach(rel => {
                    if (rel.keyColumn === colToDelete) rel.keyColumn = '';
                    if (rel.targetMap) {
                        Object.keys(rel.targetMap).forEach(key => {
                            if (rel.targetMap[key] === colToDelete) rel.targetMap[key] = '';
                        });
                    }
                });
                
                if (appData.keyColumns.dateForCalculation === colToDelete) {
                    appData.keyColumns.dateForCalculation = null;
                }

                saveData();
                openColumnsModal();
                showToast(`Columna "${colToDelete}" eliminada.`, 'success');
            }
        });
    }

    function moveColumn(header, direction) {
        const index = appData.headers.indexOf(header);
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= appData.headers.length) return;
        [appData.headers[index], appData.headers[newIndex]] = [appData.headers[newIndex], appData.headers[index]];
        saveData();
        openColumnsModal();
    }
    
    function handleColumnRename(oldHeader, newHeader) {
        newHeader = newHeader.trim().toUpperCase();
        if (!newHeader) { showToast('El nombre no puede estar vacío.', 'warning'); openColumnsModal(); return; }
        if (newHeader !== oldHeader && appData.headers.includes(newHeader)) { showToast('La columna ya existe.', 'warning'); openColumnsModal(); return; }
        const index = appData.headers.indexOf(oldHeader);
        if (index === -1) return;
        
        appData.headers[index] = newHeader;
        appData.mainData.forEach(row => { if (row.hasOwnProperty(oldHeader)) { row[newHeader] = row[oldHeader]; delete row[oldHeader]; }});
        
        if (appData.keyColumns.dateForCalculation === oldHeader) appData.keyColumns.dateForCalculation = newHeader;
        if (appData.keyColumns.daysDisplay === oldHeader) appData.keyColumns.daysDisplay = newHeader;
        if (appData.columnMetadata.hasOwnProperty(oldHeader)) { appData.columnMetadata[newHeader] = appData.columnMetadata[oldHeader]; delete appData.columnMetadata[oldHeader]; }
        if (appData.columnFormats.hasOwnProperty(oldHeader)) { appData.columnFormats[newHeader] = appData.columnFormats[oldHeader]; delete appData.columnFormats[oldHeader]; }
        if (appData.columnWidths.hasOwnProperty(oldHeader)) { appData.columnWidths[newHeader] = appData.columnWidths[oldHeader]; delete appData.columnWidths[oldHeader]; }
        if (appData.sortBy === oldHeader) appData.sortBy = newHeader;
        
        if (appData.colorCodingColumn === oldHeader) appData.colorCodingColumn = newHeader;
        if (appData.bulkDeleteColumn === oldHeader) appData.bulkDeleteColumn = newHeader;
        if (appData.hideSettings.column === oldHeader) appData.hideSettings.column = newHeader;
        if (appData.selectedRowIdentifierColumn === oldHeader) appData.selectedRowIdentifierColumn = newHeader;

        const oldListKey = `_list_${oldHeader}`;
        if(appData.referenceDB.hasOwnProperty(oldListKey)) { appData.referenceDB[`_list_${newHeader}`] = appData.referenceDB[oldListKey]; delete appData.referenceDB[oldListKey]; }
        
        (appData.lookupRelations || []).forEach(rel => { if (rel.keyColumn === oldHeader) rel.keyColumn = newHeader; if (rel.targetMap) { Object.keys(rel.targetMap).forEach(key => { if (rel.targetMap[key] === oldHeader) rel.targetMap[key] = newHeader; }); } });
        
        saveData();
        selectedColumnNameForDeletion = newHeader;
        openColumnsModal();
        showToast(`Columna renombrada a "${newHeader}".`, "info");
    }
    
    function openDbModal() { renderDbTables(); elements.dbModal.classList.add('active'); }
    function renderDbTables() {
        const dbTablesContainer = document.getElementById('db-tables-container');
        dbTablesContainer.innerHTML = '';

        const createSection = (title, dbKey = null) => {
            const section = document.createElement('div');
            section.className = `space-y-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-900/50 border dark:border-gray-700`;
            const headerDiv = document.createElement('div');
            headerDiv.className = 'flex justify-between items-center';
            headerDiv.innerHTML = `<h4 class="font-bold text-lg text-gray-800 dark:text-gray-100">${title}</h4>`;
            
            if (dbKey && dbKey.startsWith('_list_')) {
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'text-xs bg-red-500 text-white font-semibold py-1 px-2 rounded-lg hover:bg-red-600';
                deleteBtn.textContent = 'Eliminar Lista';
                deleteBtn.onclick = () => {
                    const headerName = dbKey.replace('_list_', '');
                    showConfirmModal(`¿Seguro que quieres eliminar la lista "${headerName}"? Se cambiará el formato de la columna a "Texto".`, () => {
                        delete appData.referenceDB[dbKey];
                        if(appData.columnFormats[headerName]) appData.columnFormats[headerName] = 'text';
                        if(appData.colorCodingColumn === headerName) appData.colorCodingColumn = null;
                        if(appData.hideSettings.column === headerName) appData.hideSettings.column = null;
                        if(appData.bulkDeleteColumn === headerName) appData.bulkDeleteColumn = null;
                        saveData(); renderDbTables(); showToast(`Lista "${headerName}" eliminada.`, 'success');
                    });
                };
                headerDiv.appendChild(deleteBtn);
            }
            
            section.appendChild(headerDiv);
            return section;
        };
        
        const leftCol = document.createElement('div'); leftCol.className = "space-y-6";
        const rightCol = document.createElement('div'); rightCol.className = "space-y-6";
        const listColumns = appData.headers.filter(h => appData.columnFormats[h] === 'list');
        
        // --- SECCIÓN: Identificador de Fila ---
        const identifierSection = createSection('Identificador de Fila Seleccionada');
        const identifierLabel = document.createElement('label');
        identifierLabel.className = 'flex items-center gap-3 text-sm';
        identifierLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Usar valor de columna:</span>`;
        const identifierSelect = document.createElement('select');
        identifierSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full';
        identifierSelect.innerHTML = appData.headers.map(h => `<option value="${h}" ${appData.selectedRowIdentifierColumn === h ? 'selected' : ''}>${h}</option>`).join('');
        identifierSelect.onchange = (e) => {
            appData.selectedRowIdentifierColumn = e.target.value;
            saveData();
            updateSelectedRowIdentifierDisplay(); // Update display immediately
            showToast('Columna de identificación actualizada.', 'success');
        };
        identifierLabel.appendChild(identifierSelect);
        identifierSection.appendChild(identifierLabel);
        leftCol.appendChild(identifierSection);

        // --- SECCIÓN: Codificación de Color ---
        const colorCodingSection = createSection('Codificación de Color por Columna (solo listas)');
        const colorCodingLabel = document.createElement('label');
        colorCodingLabel.className = 'flex items-center gap-3 text-sm';
        colorCodingLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Colorear filas según:</span>`;
        const colorCodingSelect = document.createElement('select');
        colorCodingSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full';
        colorCodingSelect.innerHTML = `<option value="">-- Ninguna --</option>` + 
            listColumns.map(h => `<option value="${h}" ${appData.colorCodingColumn === h ? 'selected' : ''}>${h}</option>`).join('');
        colorCodingSelect.onchange = (e) => {
            appData.colorCodingColumn = e.target.value || null;
            saveData(); renderDbTables(); fullReloadUI();
            showToast('Columna de color actualizada.', 'success');
        };
        colorCodingLabel.appendChild(colorCodingSelect);
        colorCodingSection.appendChild(colorCodingLabel);

        if (appData.colorCodingColumn) {
            const colorDbKey = `_list_${appData.colorCodingColumn}`;
            const colorDbData = appData.referenceDB[colorDbKey];
            if (colorDbData) {
                const colorTable = document.createElement('table');
                colorTable.className = 'w-full text-sm mt-4';
                colorTable.innerHTML = `<thead class="border-b dark:border-gray-700 text-gray-700 dark:text-gray-300 text-center"><th class="p-2 text-left">Valor</th><th class="p-2">Fondo Claro</th><th class="p-2">Texto Claro</th><th class="p-2">Fondo Oscuro</th><th class="p-2">Texto Oscuro</th></thead>`;
                const colorTbody = document.createElement('tbody');
                const entries = [['__DEFAULT__', colorDbData['__DEFAULT__']], ...Object.entries(colorDbData).filter(([k]) => k !== '__DEFAULT__')];
                entries.forEach(([key, values]) => {
                    if (!values) return;
                    const tr = document.createElement('tr'); tr.className = "border-b dark:border-gray-600";
                    tr.innerHTML = `
                        <td class="p-1 font-semibold text-gray-800 dark:text-gray-200">${key === '__DEFAULT__' ? 'Por Defecto' : key}</td>
                        <td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.light || '#ffffff'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="light"></td>
                        <td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.textLight || '#000000'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="textLight"></td>
                        <td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.dark || '#111827'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="dark"></td>
                        <td class="p-1"><input type="color" class="db-color-input w-full h-8 p-0 border-0 bg-transparent rounded" value="${values.textDark || '#f3f4f6'}" data-db-key="${colorDbKey}" data-entry-key="${key}" data-field="textDark"></td>
                    `;
                    colorTbody.appendChild(tr);
                });
                colorTable.appendChild(colorTbody);
                colorCodingSection.appendChild(colorTable);
            }
        }
        leftCol.appendChild(colorCodingSection);

        // --- SECCIÓN: Eliminación Rápida ---
        const bulkDeleteSection = createSection('Eliminación Rápida por Columna (solo listas)');
        const bulkDeleteLabel = document.createElement('label');
        bulkDeleteLabel.className = 'flex items-center gap-3 text-sm';
        bulkDeleteLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Eliminar filas según:</span>`;
        const bulkDeleteSelect = document.createElement('select');
        bulkDeleteSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full';
        bulkDeleteSelect.innerHTML = `<option value="">-- Seleccionar --</option>` +
            listColumns.map(h => `<option value="${h}" ${appData.bulkDeleteColumn === h ? 'selected' : ''}>${h}</option>`).join('');
        bulkDeleteSelect.onchange = (e) => {
            appData.bulkDeleteColumn = e.target.value || null;
            saveData(); renderDbTables();
        };
        bulkDeleteLabel.appendChild(bulkDeleteSelect);
        bulkDeleteSection.appendChild(bulkDeleteLabel);

        const deleteCol = appData.bulkDeleteColumn;
        if (deleteCol) {
            const statusCounts = {};
            const listKey = `_list_${deleteCol}`;
            const statusesForDeletion = appData.referenceDB[listKey] ? Object.keys(appData.referenceDB[listKey]).filter(k => k !== '__DEFAULT__') : [];
            
            statusesForDeletion.forEach(status => statusCounts[status] = 0);
            appData.mainData.forEach(row => { if (row[deleteCol] && statusCounts.hasOwnProperty(row[deleteCol])) statusCounts[row[deleteCol]]++; });

            const listContainer = document.createElement('div'); listContainer.className = 'space-y-2 mt-2';
            if (statusesForDeletion.length > 0) {
                statusesForDeletion.forEach(status => {
                    const count = statusCounts[status];
                    const label = document.createElement('label');
                    label.className = 'flex items-center justify-between p-2 rounded-md bg-white dark:bg-gray-700/50 cursor-pointer';
                    label.innerHTML = `<div class="flex items-center gap-3"><input type="checkbox" value="${status}" class="status-delete-checkbox h-5 w-5 rounded text-sky-600 focus:ring-sky-500 border-gray-300 dark:border-gray-500 bg-gray-100 dark:bg-gray-800" ${count === 0 ? 'disabled' : ''}><span class="font-semibold">${status}</span></div><span class="text-sm font-mono bg-gray-200 dark:bg-gray-600 px-2 py-0.5 rounded-full">${count}</span>`;
                    listContainer.appendChild(label);
                });
            }
            bulkDeleteSection.appendChild(listContainer);
        
            const dateConditionContainer = document.createElement('div');
            dateConditionContainer.id = 'bulk-delete-date-condition';
            dateConditionContainer.className = 'mt-4 pt-4 border-t dark:border-gray-600 space-y-2 hidden';
            const dateColumnLabel = document.createElement('label');
            dateColumnLabel.className = 'block text-sm font-medium text-gray-700 dark:text-gray-300';
            dateColumnLabel.textContent = '... con fecha anterior a (opcional):';
            const dateFlexContainer = document.createElement('div');
            dateFlexContainer.className = 'flex gap-2 mt-1';
            const dateColumns = appData.headers.filter(h => appData.columnFormats[h] === 'date');
            const dateColumnSelect = document.createElement('select');
            dateColumnSelect.id = 'bulk-delete-date-column';
            dateColumnSelect.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            if (dateColumns.length > 0) { dateColumnSelect.innerHTML = dateColumns.map(h => `<option value="${h}">${h}</option>`).join(''); } 
            else { dateColumnSelect.innerHTML = `<option value="">No hay columnas de fecha</option>`; dateColumnSelect.disabled = true; }
            dateFlexContainer.appendChild(dateColumnSelect);
            const dateInput = createDateInputComponent('', null);
            dateInput.id = 'bulk-delete-date-input';
            dateInput.placeholder = 'DD/MM/YYYY';
            dateInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm';
            dateFlexContainer.appendChild(dateInput);
            dateColumnLabel.appendChild(dateFlexContainer);
            dateConditionContainer.appendChild(dateColumnLabel);
            bulkDeleteSection.appendChild(dateConditionContainer);

            const bulkDeleteButton = document.createElement('button');
            bulkDeleteButton.id = 'execute-bulk-delete-btn';
            bulkDeleteButton.className = 'w-full mt-4 bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed';
            bulkDeleteButton.textContent = 'Archivar y Eliminar Seleccionados';
            bulkDeleteButton.disabled = true;
            bulkDeleteSection.appendChild(bulkDeleteButton);
        } else {
             bulkDeleteSection.innerHTML += `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Seleccione una columna para habilitar esta función.</p>`;
        }
        leftCol.appendChild(bulkDeleteSection);
        
        // --- SECCIÓN: Valores Ocultos ---
        const hideSettingsSection = createSection('Valores Ocultos por Defecto (solo listas)');
        const hideSettingsLabel = document.createElement('label');
        hideSettingsLabel.className = 'flex items-center gap-3 text-sm';
        hideSettingsLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Ocultar valores de:</span>`;
        const hideSettingsSelect = document.createElement('select');
        hideSettingsSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 w-full';
        hideSettingsSelect.innerHTML = `<option value="">-- Seleccionar --</option>` +
            listColumns.map(h => `<option value="${h}" ${appData.hideSettings.column === h ? 'selected' : ''}>${h}</option>`).join('');
        hideSettingsSelect.onchange = (e) => {
            appData.hideSettings.column = e.target.value || null;
            appData.hideSettings.hiddenValues = []; // Reset hidden values when changing column
            saveData(); renderDbTables(); fullReloadUI();
        };
        hideSettingsLabel.appendChild(hideSettingsSelect);
        hideSettingsSection.appendChild(hideSettingsLabel);

        const hideCol = appData.hideSettings.column;
        if(hideCol) {
            const hiddenStatusesContainer = document.createElement('div'); hiddenStatusesContainer.className = "grid grid-cols-2 md:grid-cols-3 gap-2 mt-2";
            const listKey = `_list_${hideCol}`;
            const valuesToHide = appData.referenceDB[listKey] ? Object.keys(appData.referenceDB[listKey]).filter(k => k !== '__DEFAULT__') : [];
            
            if (valuesToHide.length > 0) {
                valuesToHide.forEach(value => {
                    const label = document.createElement('label'); label.className = 'flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded-md';
                    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = value; 
                    checkbox.checked = (appData.hideSettings.hiddenValues || []).includes(value);
                    checkbox.className = 'h-5 w-5 rounded text-sky-600 focus:ring-sky-500';
                    checkbox.onchange = (e) => {
                        if (!appData.hideSettings.hiddenValues) appData.hideSettings.hiddenValues = [];
                        if (e.target.checked) { if (!appData.hideSettings.hiddenValues.includes(value)) appData.hideSettings.hiddenValues.push(value); } 
                        else { appData.hideSettings.hiddenValues = appData.hideSettings.hiddenValues.filter(s => s !== value); }
                        saveData(); fullReloadUI();
                    };
                    label.appendChild(checkbox); label.append(value); hiddenStatusesContainer.appendChild(label);
                });
            } else {
                 hiddenStatusesContainer.innerHTML = `<p class="text-sm text-gray-500 dark:text-gray-400 col-span-full">No hay valores definidos para la columna "${hideCol}".</p>`;
            }
            hideSettingsSection.appendChild(hiddenStatusesContainer);
        } else {
            hideSettingsSection.innerHTML += `<p class="text-sm text-gray-500 dark:text-gray-400 mt-2">Seleccione una columna para habilitar esta función.</p>`;
        }
        rightCol.appendChild(hideSettingsSection);

        // --- SECCIÓN: Alertas Visuales ---
        const alertsSection = createSection('Alertas Visuales por Vencimiento (DIAS)');
        const alertsTable = document.createElement('table'); alertsTable.className = 'w-full text-sm';
        alertsTable.innerHTML = `<thead class="border-b dark:border-gray-700 text-gray-700 dark:text-gray-300 text-center"><th class="p-2 text-left">Activo</th><th class="p-2">Fondo</th><th class="p-2">Texto</th><th class="p-2">Condición</th><th class="p-2">Valor</th><th class="p-2"></th></thead>`;
        const alertsTbody = document.createElement('tbody');
        (appData.visualAlerts || []).forEach(alert => {
            const tr = document.createElement('tr'); tr.className = "border-b dark:border-gray-600";
            tr.innerHTML = `
                <td class="p-1"><input type="checkbox" class="alert-input h-5 w-5 rounded" ${alert.enabled ? 'checked' : ''} data-id="${alert.id}" data-field="enabled"></td>
                <td class="p-1"><input type="color" class="alert-input-color w-full h-8 p-0 border-0 bg-transparent rounded" value="${alert.color.bg}" data-id="${alert.id}" data-field="bg"></td>
                <td class="p-1"><input type="color" class="alert-input-color w-full h-8 p-0 border-0 bg-transparent rounded" value="${alert.color.text}" data-id="${alert.id}" data-field="text"></td>
                <td class="p-1"><select class="alert-input w-full bg-gray-50 dark:bg-gray-700 p-2 border rounded dark:border-gray-600" data-id="${alert.id}" data-field="condition"><option value=">=" ${alert.condition === '>=' ? 'selected':''}> >= </option><option value="<=" ${alert.condition === '<=' ? 'selected':''}> <= </option><option value="=" ${alert.condition === '=' ? 'selected':''}> = </option></select></td>
                <td class="p-1"><input type="number" class="alert-input w-full bg-gray-50 dark:bg-gray-700 p-2 border rounded dark:border-gray-600" value="${alert.value}" data-id="${alert.id}" data-field="value"></td>
                <td class="p-1 text-center"><button class="alert-delete-btn text-red-500 hover:text-red-700 font-bold" data-id="${alert.id}">X</button></td>
            `;
            alertsTbody.appendChild(tr);
        });
        alertsTable.appendChild(alertsTbody);
        alertsSection.appendChild(alertsTable);
        const addAlertBtn = document.createElement('button');
        addAlertBtn.className = "mt-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300";
        addAlertBtn.textContent = '+ Añadir Alerta';
        addAlertBtn.onclick = () => { if(!appData.visualAlerts) appData.visualAlerts = []; appData.visualAlerts.push({ id: Date.now(), enabled: true, color: { bg: '#fee2e2', text: '#991b1b' }, condition: '>=', value: '15'}); renderDbTables(); saveData(); };
        alertsSection.appendChild(addAlertBtn);
        rightCol.appendChild(alertsSection);
        
        // --- Otras secciones (visualización, pdf, lookups, etc.) ---
        const visualSettingsSection = createSection('Ajustes de Visualización');
        const rowsPerPageLabel = document.createElement('label');
        rowsPerPageLabel.className = 'flex items-center gap-3 text-sm';
        rowsPerPageLabel.innerHTML = `<span class="font-semibold text-gray-700 dark:text-gray-300">Filas por página:</span>`;
        const rowsPerPageSelect = document.createElement('select');
        rowsPerPageSelect.className = 'p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700';
        [3, 10, 15].forEach(num => {
            const option = document.createElement('option');
            option.value = num;
            option.textContent = num;
            if (appData.rowsPerPage == num) option.selected = true;
            rowsPerPageSelect.appendChild(option);
        });
        rowsPerPageSelect.onchange = (e) => {
            appData.rowsPerPage = parseInt(e.target.value, 10);
            currentPage = 1; saveData(); fullReloadUI();
            showToast('Ajuste de filas guardado.', 'success');
        };
        rowsPerPageLabel.appendChild(rowsPerPageSelect);
        visualSettingsSection.appendChild(rowsPerPageLabel);
        leftCol.appendChild(visualSettingsSection);

        const pdfFilenameSection = createSection('Formato de Nombre para Archivos PDF');
        pdfFilenameSection.innerHTML += `<p class="text-xs text-gray-500 dark:text-gray-400 -mt-2">Define cómo se nombrarán los archivos PDF. Usa las variables de abajo.</p>`;
        const filenameInput = document.createElement('input');
        filenameInput.type = 'text'; filenameInput.id = 'pdf-filename-format-input';
        filenameInput.className = 'w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 font-mono text-sm';
        filenameInput.value = appData.pdfFilenameFormat || '';
        filenameInput.oninput = (e) => { appData.pdfFilenameFormat = e.target.value; saveData(); };
        pdfFilenameSection.appendChild(filenameInput);
        const filenamePlaceholders = document.createElement('div');
        filenamePlaceholders.className = 'flex flex-wrap gap-2 pt-2';
        const specialPlaceholders = [{name: 'fecha_actual', desc: 'Fecha de hoy'}, {name: 'nombre_plantilla', desc: 'Nombre de la plantilla usada'}];
        [...appData.headers, ...specialPlaceholders.map(p => p.name)].forEach(h => {
            const btn = document.createElement('button');
            btn.className = "bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200 text-xs font-mono font-semibold px-2 py-1 rounded-md hover:bg-sky-200 dark:hover:bg-sky-700";
            btn.textContent = h;
            btn.onclick = () => {
                const input = document.getElementById('pdf-filename-format-input');
                const placeholder = `{{${h}}}`;
                const start = input.selectionStart; const end = input.selectionEnd;
                input.value = input.value.substring(0, start) + placeholder + input.value.substring(end);
                input.focus(); input.selectionEnd = start + placeholder.length;
                appData.pdfFilenameFormat = input.value; saveData();
            };
            filenamePlaceholders.appendChild(btn);
        });
        pdfFilenameSection.appendChild(filenamePlaceholders);
        leftCol.appendChild(pdfFilenameSection);

        const lookupSection = createSection('Búsquedas Automáticas (VLOOKUP)');
        (appData.lookupRelations || []).forEach(rel => {
            const relContainer = document.createElement('div'); relContainer.className = 'p-3 my-2 bg-white dark:bg-gray-700 rounded-lg border dark:border-gray-600';
            const relHeader = document.createElement('div'); relHeader.className = 'flex justify-between items-center mb-2';
            relHeader.innerHTML = `<h5 class="font-bold">${rel.name}</h5><button class="lookup-delete-btn text-red-500 hover:text-red-700 text-xl" data-id="${rel.id}">&times;</button>`;
            relContainer.appendChild(relHeader);
            const grid = document.createElement('div'); grid.className = 'grid grid-cols-1 md:grid-cols-2 gap-3 text-sm';
            const keyColLabel = document.createElement('label'); keyColLabel.className = 'block space-y-1 col-span-full';
            keyColLabel.innerHTML = `<span>Cuando se edite la columna:</span>`;
            const keyColSelect = document.createElement('select'); keyColSelect.className = 'w-full bg-gray-50 dark:bg-gray-800 p-2 border rounded dark:border-gray-500';
            keyColSelect.innerHTML = `<option value="">-- Seleccionar --</option>${appData.headers.map(h => `<option value="${h}" ${rel.keyColumn === h ? 'selected' : ''}>${h}</option>`).join('')}`;
            keyColSelect.onchange = (e) => { rel.keyColumn = e.target.value; saveData(); };
            keyColLabel.appendChild(keyColSelect); grid.appendChild(keyColLabel);
            const sourceDbFields = Object.keys(appData.referenceDB[rel.sourceDB]?.['__FIELDS__'] || {});
            sourceDbFields.forEach(sourceField => {
                const targetColLabel = document.createElement('label'); targetColLabel.className = 'block space-y-1';
                targetColLabel.innerHTML = `<span>Poblar la columna (con <b>${sourceField}</b>):</span>`;
                const targetColSelect = document.createElement('select'); targetColSelect.className = 'w-full bg-gray-50 dark:bg-gray-800 p-2 border rounded dark:border-gray-500';
                targetColSelect.innerHTML = `<option value="">-- No Poblar --</option>${appData.headers.map(h => `<option value="${h}" ${rel.targetMap[sourceField] === h ? 'selected' : ''}>${h}</option>`).join('')}`;
                targetColSelect.onchange = (e) => { rel.targetMap[sourceField] = e.target.value; saveData(); };
                targetColLabel.appendChild(targetColSelect); grid.appendChild(targetColLabel);
            });
            relContainer.appendChild(grid); lookupSection.appendChild(relContainer);
        });
        const addLookupBtn = document.createElement('button'); addLookupBtn.className = "mt-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300"; addLookupBtn.textContent = '+ Añadir Búsqueda Automática';
        addLookupBtn.onclick = addLookupRelation; lookupSection.appendChild(addLookupBtn);
        rightCol.appendChild(lookupSection);
        
        Object.entries(appData.referenceDB).forEach(([dbKey, data]) => {
            let config;
            if (dbKey.startsWith('_list_')) { 
                const listName = dbKey.replace('_list_', '');
                config = { 
                    title: `Valores para Lista: ${listName}`, 
                    fields: [{name: 'key', isKey: true, placeholder: `Valor de ${listName}`}] 
                };
                data = Object.keys(data).reduce((acc, key) => { acc[key] = {value: key}; return acc; }, {});
            } 
            else if (dbKey.startsWith('_lookup_')) { 
                const relation = (appData.lookupRelations || []).find(r => r.sourceDB === dbKey); 
                const fieldData = data['__FIELDS__'] || { 'Dato 1': 'text', 'Dato 2': 'text' }; 
                config = { 
                    isLookup: true, 
                    title: `Datos para: ${relation ? relation.name : dbKey}`, 
                    fields: [{ name: 'code', isKey: true, placeholder: 'Código' }, ...Object.keys(fieldData).map(f => ({ name: f, placeholder: f, type: fieldData[f] }))] 
                }; 
            } 
            else { return; }

            const section = createSection(config.title, dbKey);
            const table = document.createElement('table'); table.className = 'w-full text-sm';
            const thead = document.createElement('thead'); thead.className = 'border-b dark:border-gray-700 text-gray-700 dark:text-gray-300';
            let headerCells = config.fields.map(f => {
                let content = f.placeholder;
                if(config.isLookup && !f.isKey) {
                    content = `<input class="w-full bg-transparent font-bold text-center" value="${f.placeholder}" data-db-key="${dbKey}" data-field-rename="${f.placeholder}">`;
                }
                return `<th class="p-2 text-center">${content}</th>`;
            }).join('');
            thead.innerHTML = `<tr>${headerCells}<th class="p-2"></th></tr>`;
            table.appendChild(thead);
            const tbody = document.createElement('tbody');
            const entries = Object.entries(data);
            entries.forEach(([key, values]) => {
                if (key === '__FIELDS__' || !values) return;
                const isDefaultRow = key === '__DEFAULT__';
                const tr = document.createElement('tr'); tr.className = "border-b dark:border-gray-600";
                let cells = config.fields.map(field => {
                    let inputHtml;
                    let valueForField = '';
                    if (field.isKey) {
                        valueForField = isDefaultRow ? 'Valor Vacío / Por Defecto' : key;
                    } else {
                        valueForField = values[field.name] || (field.type === 'color' ? '#ffffff' : '');
                    }
                    inputHtml = `<input class="w-full bg-gray-50 dark:bg-gray-700 p-2 border rounded dark:border-gray-600 text-center" value="${valueForField}" data-db-key="${dbKey}" data-entry-key="${key}" data-field="${field.name}" ${field.isKey ? 'data-is-key="true"' : ''} ${isDefaultRow && field.isKey ? 'disabled' : ''}>`;
                    return `<td class="p-1 align-middle">${inputHtml}</td>`;
                }).join('');
                const deleteButton = isDefaultRow ? '' : `<button class="db-delete-btn text-red-500 hover:text-red-700 font-bold" data-db-key="${dbKey}" data-entry-key="${key}">X</button>`;
                tr.innerHTML = `${cells}<td class="p-1 text-center">${deleteButton}</td>`;
                tbody.appendChild(tr);
            });
            table.appendChild(tbody); section.appendChild(table);
            const addBtn = document.createElement('button'); 
            addBtn.className = "mt-2 text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300"; 
            addBtn.textContent = `+ Añadir a ${config.title}`;
            addBtn.onclick = () => addDbEntry(dbKey, config); 
            section.appendChild(addBtn);
            
            if (dbKey.startsWith('_lookup_')) { rightCol.appendChild(section); } 
            else { leftCol.appendChild(section); }
        });
        dbTablesContainer.appendChild(leftCol); dbTablesContainer.appendChild(rightCol);
    }

    function addLookupRelation() {
        showPromptModal("Ingrese un nombre para la nueva búsqueda (ej: EMPRESA):", (name) => {
            const id = `rel_${Date.now()}`;
            const sourceDB = `_lookup_${name.replace(/[^a-z0-9]/gi, '').toLowerCase()}_${Date.now()}`;
            if (appData.referenceDB[sourceDB]) return showToast('Error: ya existe una base de datos con un nombre similar.', 'error');
            appData.lookupRelations.push({ id: id, name: name, enabled: true, keyColumn: '', sourceDB: sourceDB, targetMap: { 'Dato 1': '', 'Dato 2': '' } });
            appData.referenceDB[sourceDB] = { '__FIELDS__': { 'Dato 1': 'text', 'Dato 2': 'text' } };
            saveData(); renderDbTables();
        });
    }

    function addDbEntry(dbKey, config) {
        showPromptModal(`Ingrese el nuevo valor para la lista "${config.title}":`, (newKey) => {
            if (!appData.referenceDB[dbKey][newKey]) {
                const newEntry = {};
                if (dbKey.startsWith('_list_')) {
                     newEntry.light = '#ffffff';
                     newEntry.textLight = '#000000';
                     newEntry.dark = '#1f2937';
                     newEntry.textDark = '#f3f4f6';
                }
                (config.fields || []).forEach(field => { if(!field.isKey) { newEntry[field.name] = ''; } });
                appData.referenceDB[dbKey][newKey] = newEntry;
                renderDbTables(); saveData();
            } else {
                showToast('Ese identificador ya existe.', 'warning');
            }
        });
    }

    function handleDbUpdate(e) {
        const input = e.target;
        const { dbKey, entryKey, field, isKey: isKeyStr, fieldRename } = input.dataset;
        if (!dbKey) return;
    
        const value = input.value;
        const isKey = isKeyStr === "true";
    
        if (fieldRename) {
            const newFieldName = value.trim();
            if (!newFieldName || newFieldName === fieldRename) return;
            const fields = appData.referenceDB[dbKey]['__FIELDS__'];
            if (fields && fields[newFieldName]) {
                showToast('Ese nombre de campo ya existe.', 'warning');
                input.value = fieldRename;
                return;
            }
            const oldType = fields[fieldRename];
            delete fields[fieldRename];
            fields[newFieldName] = oldType;
            Object.keys(appData.referenceDB[dbKey]).forEach(key => {
                if (key !== '__FIELDS__') {
                    appData.referenceDB[dbKey][key][newFieldName] = appData.referenceDB[dbKey][key][fieldRename];
                    delete appData.referenceDB[dbKey][key][fieldRename];
                }
            });
            (appData.lookupRelations || []).forEach(rel => {
                if (rel.sourceDB === dbKey && rel.targetMap[fieldRename]) {
                    rel.targetMap[newFieldName] = rel.targetMap[fieldRename];
                    delete rel.targetMap[fieldRename];
                }
            });
            saveData();
            renderDbTables();
            return;
        }
    
        if (isKey) {
            if (value && value !== entryKey && !appData.referenceDB[dbKey][value]) {
                const oldData = { ...appData.referenceDB[dbKey][entryKey] };
                delete appData.referenceDB[dbKey][entryKey];
                appData.referenceDB[dbKey][value] = oldData;
                if (dbKey.startsWith('_list_')) {
                    const listColumn = dbKey.replace('_list_', '');
                    appData.mainData.forEach(row => {
                        if (row[listColumn] === entryKey) row[listColumn] = value;
                    });
                }
                renderDbTables();
            } else if (value !== entryKey) {
                showToast('El nuevo código ya existe o está vacío.', 'warning');
                input.value = entryKey;
                return;
            }
        } else {
            if (appData.referenceDB[dbKey]?.[entryKey] && typeof field !== 'undefined') {
                appData.referenceDB[dbKey][entryKey][field] = value;
            }
        }
    
        saveData();
        fullReloadUI();
    }
    
    function handleColorDbUpdate(e) {
        const input = e.target;
        const { dbKey, entryKey, field } = input.dataset;
        if(!dbKey || !entryKey || !field) return;

        if (appData.referenceDB[dbKey] && appData.referenceDB[dbKey][entryKey]) {
            appData.referenceDB[dbKey][entryKey][field] = input.value;
            saveData();
            fullReloadUI();
        }
    }


    function handleDbDelete(e) {
        const button = e.target.closest('.db-delete-btn, .lookup-delete-btn');
        if(!button) return;
        if (button.classList.contains('lookup-delete-btn')) {
            const { id } = button.dataset;
            const relation = (appData.lookupRelations || []).find(r => r.id === id);
            if (relation) {
                showConfirmModal(`¿Eliminar la búsqueda "${relation.name}"? También se borrará su base de datos de referencia.`, () => {
                    delete appData.referenceDB[relation.sourceDB]; 
                    appData.lookupRelations = appData.lookupRelations.filter(r => r.id !== id); 
                    saveData(); 
                    renderDbTables();
                });
            }
            return;
        }
        if(button.classList.contains('db-delete-btn') && button.dataset.dbKey) {
            const {dbKey, entryKey} = button.dataset;
            showConfirmModal(`¿Eliminar la entrada "${entryKey}"?`, () => {
                 delete appData.referenceDB[dbKey][entryKey];
                 renderDbTables(); 
                 saveData(); 
                 fullReloadUI();
            });
        }
    }
    
    function handleAlertsDbUpdate(e) {
        const input = e.target.closest('.alert-input, .alert-input-color');
        if (!input) return;

        const { id, field } = input.dataset;
        if (!id || !field) return;

        const alert = (appData.visualAlerts || []).find(a => a.id == id);
        if (!alert) return;

        if (input.type === 'checkbox') {
            alert[field] = input.checked;
        } else if (field === 'bg' || field === 'text') {
            alert.color[field] = input.value;
        } else {
            alert[field] = input.value;
        }
        saveData();
        sortAndApplyFilters();
    }

    function handleAlertsDbDelete(e) {
        const button = e.target.closest('.alert-delete-btn');
        if (button && button.dataset.id) {
            showConfirmModal('¿Eliminar esta alerta visual?', () => {
                appData.visualAlerts = (appData.visualAlerts || []).filter(a => a.id != button.dataset.id); 
                saveData(); 
                renderDbTables(); 
                sortAndApplyFilters();
            });
        }
    }

    function exportDb() {
        const dataStr = JSON.stringify(appData.referenceDB, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = 'gtn_db_backup.json';
        document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        showToast('Base de datos de referencia exportada.', 'success');
    }

    function exportAllData() {
        elements.loadingOverlay.classList.add('active');
        setTimeout(() => {
            const dataStr = JSON.stringify(appData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `gtn_v10_backup_completo_${getFormattedTimestampForFilename()}.json`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
            showToast('Copia de seguridad completa exportada.', 'success');
            elements.loadingOverlay.classList.remove('active');
        }, 50);
    }

    function importAllData(event) {
        const file = event.target.files[0]; 
        if (!file) return;

        elements.loadingOverlay.classList.add('active');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target.result);
                if (parsed.headers && parsed.mainData) {
                    showConfirmModal('Esto reemplazará TODOS los datos y ajustes actuales con el contenido del archivo. ¿Continuar?', () => {
                        appData = parsed; 
                        saveData(); 
                        showToast('Copia de seguridad restaurada. La página se recargará.', 'success'); 
                        setTimeout(() => location.reload(), 1500);
                    }, 'Restaurar Copia de Seguridad');
                } else { 
                    showToast('Archivo de copia de seguridad no válido.', 'error'); 
                }
            } catch (err) { 
                showToast('Error al leer el archivo. No parece ser un backup válido.', 'error'); 
                console.error(err); 
            } finally {
                elements.loadingOverlay.classList.remove('active');
            }
        };
        reader.onerror = () => {
             showToast('Error al leer el archivo.', 'error'); 
             elements.loadingOverlay.classList.remove('active');
        };
        reader.readAsText(file);
        event.target.value = '';
    }

    function exportDataToExcel(data, filename) {
        if (data.length === 0) { showToast("No hay datos para exportar.", "warning"); return false; }
        const dataToExport = data.map(row => { const exportRow = {}; appData.headers.forEach(h => { exportRow[h] = row[h]; }); return exportRow; });
        const worksheet = XLSX.utils.json_to_sheet(dataToExport, { header: appData.headers });
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Datos");
        XLSX.writeFile(workbook, filename);
        return true;
    }

    function exportFilteredToExcel() {
        elements.loadingOverlay.classList.add('active');
        setTimeout(() => {
            const filename = `gtn_datos_filtrados_${getFormattedDateForFilename()}.xlsx`;
            const success = exportDataToExcel(filteredData, filename);
            if(success) showToast('Datos exportados a Excel.', 'success');
            elements.loadingOverlay.classList.remove('active');
        }, 50);
    }
    
    async function handleBulkDelete() {
        const checkedBoxes = document.querySelectorAll('.status-delete-checkbox:checked');
        if (checkedBoxes.length === 0) return;
        
        const deleteCol = appData.bulkDeleteColumn;
        if (!deleteCol) {
            showToast('No se ha seleccionado una columna para la eliminación rápida.', 'error');
            return;
        }
        
        const selectedValues = Array.from(checkedBoxes).map(cb => cb.value);
        const dateColumn = document.getElementById('bulk-delete-date-column').value;
        const dateLimitStr = document.getElementById('bulk-delete-date-input').value;
        const dateLimit = dateLimitStr ? parseDate(dateLimitStr) : null;
        if (dateLimit) {
            dateLimit.setUTCHours(0, 0, 0, 0);
        }

        let rowsToDeleteQuery = appData.mainData.filter(row => selectedValues.includes(row[deleteCol]));

        if (dateLimit && dateColumn) {
            rowsToDeleteQuery = rowsToDeleteQuery.filter(row => {
                const rowDate = parseDate(row[dateColumn]);
                if (!rowDate) return false;
                rowDate.setUTCHours(0, 0, 0, 0);
                return rowDate < dateLimit;
            });
        }
        
        const rowsToDelete = rowsToDeleteQuery;
        if (rowsToDelete.length === 0) {
            showToast('No se encontraron filas que coincidan con los criterios seleccionados.', 'info');
            return;
        }
        const idsToDelete = new Set(rowsToDelete.map(r => r.id));
        const rowsToKeep = appData.mainData.filter(row => !idsToDelete.has(row.id));

        let confirmationMessage = `Se encontraron ${rowsToDelete.length} filas para los valores [${selectedValues.join(', ')}] en la columna "${deleteCol}"`;
        if (dateLimitStr && dateColumn) {
            confirmationMessage += ` con fecha en "${dateColumn}" anterior a ${dateLimitStr}`;
        }
        confirmationMessage += '.\n\nSe generará un respaldo en Excel de estas filas antes de eliminarlas. ¿Continuar?';

        showConfirmModal(confirmationMessage, () => {
            const filename = `gtn_respaldo_eliminados_${getFormattedDateForFilename()}.xlsx`;
            const exported = exportDataToExcel(rowsToDelete, filename);

            if(exported) {
                showToast('Respaldo en Excel generado.', 'info');
                setTimeout(() => {
                     showConfirmModal(`ADVERTENCIA: Está a punto de eliminar permanentemente ${rowsToDelete.length} filas. Esta acción no se puede deshacer.\n\n¿Desea continuar?`, () => {
                        appData.mainData = rowsToKeep; 
                        saveData();
                        showToast(`${rowsToDelete.length} filas eliminadas y archivadas correctamente.`, 'success');
                        renderDbTables(); 
                        fullReloadUI();
                    }, 'Confirmación Final');
                }, 1000);
            }
        }, 'Respaldar y Continuar');
    }
    
    function changeFontSize(amount) {
        let currentSize = appData.tableFontSize || 14;
        currentSize += amount;
        if (currentSize < 10) currentSize = 10;
        if (currentSize > 24) currentSize = 24;
        appData.tableFontSize = currentSize;
        elements.tableContainer.style.setProperty('--table-font-size', `${currentSize}px`);
        saveData();
    }

    // ### EVENT LISTENERS ###
    function setupEventListeners() {
        elements.searchInput.addEventListener('input', () => {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = setTimeout(() => { currentPage = 1; sortAndApplyFilters(); }, 300);
        });
        elements.addRowBtn.addEventListener('click', () => addRow());
        elements.deleteRowBtn.addEventListener('click', deleteRow);
        
        elements.increaseFontSizeBtn.addEventListener('click', () => changeFontSize(1));
        elements.decreaseFontSizeBtn.addEventListener('click', () => changeFontSize(-1));

        elements.tableFontColorPicker.addEventListener('input', (e) => {
            appData.tableTextColor = e.target.value;
            elements.tableContainer.style.setProperty('--table-text-color', appData.tableTextColor);
            saveData();
        });


        elements.manageColsBtn.addEventListener('click', openColumnsModal);
        elements.columnsModal.addEventListener('click', (e) => { 
            if(e.target.id === 'add-col-btn') addColumn();
            if(e.target.id === 'delete-col-btn') deleteColumn();
            if(e.target.id === 'close-columns-btn') { elements.columnsModal.classList.remove('active'); fullReloadUI(); }
        });

        elements.exportAllBtn.addEventListener('click', exportAllData);
        elements.exportExcelBtn.addEventListener('click', exportFilteredToExcel);
        elements.importAllBtn.addEventListener('click', () => elements.importAllInput.click());
        elements.importAllInput.addEventListener('change', importAllData);
        
        elements.templateSelectDropdown.addEventListener('change', (e) => { selectedTemplateId = e.target.value || null; updateSelectionStatus(); });
        elements.createTemplateBtn.addEventListener('click', () => openTemplateModal());
        elements.editSelectedTemplateBtn.addEventListener('click', () => selectedTemplateId && openTemplateModal(selectedTemplateId));
        elements.deleteSelectedTemplateBtn.addEventListener('click', () => { if (selectedTemplateId) { const t = appData.templates.find(x => x.id === selectedTemplateId); if(t) deleteTemplate(t.id, t.name); }});

        elements.templateModal.addEventListener('click', (e) => {
            if(e.target.id === 'save-template-btn') saveTemplate();
            if(e.target.id === 'cancel-template-btn') elements.templateModal.classList.remove('active');
            
            const moveBtn = e.target.closest('.move-manual-field-btn');
            if (moveBtn && !moveBtn.disabled) {
                const fieldName = moveBtn.dataset.field;
                const direction = parseInt(moveBtn.dataset.direction, 10);
                moveManualField(fieldName, direction);
            }

            if(e.target.id === 'add-manual-field-btn') {
                const manualFieldInput = document.getElementById('manual-field-input');
                const fieldName = manualFieldInput.value.trim();
                if(!fieldName) return;

                showConfirmModal(
                    `¿Qué tipo de campo es "${fieldName}"?\n\n- Confirmar: Campo de Texto (se preguntará al escribir).\n- Cancelar: Campo de Imagen (se pedirá un archivo).`,
                    () => { 
                        addTemplatePlaceholder(fieldName, 'text');
                        manualFieldInput.value = '';
                    },
                    'Tipo de Campo'
                );
                
                const confirmBtn = document.getElementById('confirm-submit-btn');
                const cancelBtn = document.getElementById('confirm-cancel-btn');
                confirmBtn.textContent = 'Texto';
                confirmBtn.className = 'bg-sky-600 text-white font-bold py-2 px-5 rounded-lg';
                cancelBtn.textContent = 'Imagen';
                cancelBtn.className = 'bg-purple-600 text-white font-bold py-2 px-5 rounded-lg';
                
                const originalCancelHandler = () => {
                    elements.confirmModal.classList.remove('active');
                };
                
                let customCancelHandler;
                customCancelHandler = () => {
                    addTemplatePlaceholder(fieldName, 'image');
                    manualFieldInput.value = '';
                    elements.confirmModal.classList.remove('active');
                    cancelBtn.removeEventListener('click', customCancelHandler);
                    confirmBtn.removeEventListener('click', confirmBtn.onclick); // Clean up confirm as well
                };
                
                // We need to manage listeners carefully
                const confirmHandler = confirmBtn.onclick; // Get the default handler
                confirmBtn.onclick = (event) => {
                     confirmHandler(event); // Run default logic
                     cancelBtn.removeEventListener('click', customCancelHandler); // Clean up other listener
                };
                cancelBtn.addEventListener('click', customCancelHandler, { once: true }); // Use once to auto-cleanup
            }
            if(e.target.id === 'format-bold-btn') applyTextFormat('bold');
            if(e.target.id === 'format-italic-btn') applyTextFormat('italic');
        });

        elements.generatePdfBtn.addEventListener('click', generatePDF);
        elements.manualVarsModal.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            processAndShowPreview();
        });
        elements.manualVarsModal.addEventListener('click', (e) => {
            if (e.target.id === 'submit-manual-vars-btn') processAndShowPreview();
            if (e.target.id === 'cancel-manual-vars-btn') elements.manualVarsModal.classList.remove('active');
        });
        elements.previewModal.addEventListener('click', (e) => {
            if (e.target.id === 'download-pdf-btn') downloadPDF();
            if (e.target.id === 'cancel-preview-btn') elements.previewModal.classList.remove('active');
        });
        
        elements.imageUploadModal.addEventListener('click', (e) => {
            if (e.target.id === 'cancel-image-upload-btn') {
                elements.imageUploadModal.classList.remove('active');
                pendingPDFGeneration = null;
            }
            if (e.target.id === 'submit-image-upload-btn') {
                const form = document.getElementById('image-upload-form');
                if (form.checkValidity()) {
                    const manualVars = pendingPDFGeneration.template.manualFields || [];
                    if (manualVars.length > 0) {
                        elements.imageUploadModal.classList.remove('active');
                        promptForManualVars(manualVars);
                    } else {
                        processAndShowPreview();
                    }
                } else {
                    showToast('Por favor, adjunta todas las imágenes requeridas.', 'warning');
                }
            }
        });

        elements.manageDbBtn.addEventListener('click', openDbModal);
        elements.dbModal.addEventListener('click', (e) => {
            if (e.target.id === 'close-db-btn') { elements.dbModal.classList.remove('active'); fullReloadUI(); }
            if (e.target.id === 'export-db-btn') exportDb();
            if (e.target.closest('.alert-delete-btn')) handleAlertsDbDelete(e);
            else if (e.target.id === 'execute-bulk-delete-btn') handleBulkDelete();
            else handleDbDelete(e);
        });
         elements.dbModal.addEventListener('focusout', e => { 
            if(e.target.tagName === 'INPUT' && e.target.dataset.dbKey && e.target.dataset.isKey === 'true') handleDbUpdate(e); 
         });
         elements.dbModal.addEventListener('change', e => { 
            if (e.target.classList.contains('alert-input') || e.target.classList.contains('alert-input-color')) {
                 handleAlertsDbUpdate(e);
            } else if (e.target.classList.contains('db-color-input')) {
                 handleColorDbUpdate(e);
            } else if (e.target.dataset.dbKey) {
                 handleDbUpdate(e);
            } else if (e.target.classList.contains('status-delete-checkbox')) {
                const checkedBoxes = document.querySelectorAll('.status-delete-checkbox:checked');
                document.getElementById('execute-bulk-delete-btn').disabled = checkedBoxes.length === 0;
                const dateConditionContainer = document.getElementById('bulk-delete-date-condition');
                if (dateConditionContainer) {
                    dateConditionContainer.classList.toggle('hidden', checkedBoxes.length === 0);
                }
            }
        });

        elements.themeToggle.addEventListener('click', () => {
            const newTheme = elements.htmlTag.classList.contains('dark') ? 'light' : 'dark';
            applyTheme(newTheme);
        });
        
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                elements.loadingOverlay.classList.add('active');
                setTimeout(() => {
                    recalculateAllDays();
                    fullReloadUI();
                    elements.loadingOverlay.classList.remove('active');
                }, 100);
            }
        });

        elements.temporalModeCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            const url = new URL(window.location);
            const action = isChecked ? 'activar' : 'desactivar';
            const message = `¿${action.charAt(0).toUpperCase() + action.slice(1)} el modo temporal? La página se recargará y los cambios no se guardarán.`;
            
            showConfirmModal(message, () => {
                if (isChecked) {
                    url.searchParams.set('temporal', 'true');
                } else {
                    url.searchParams.delete('temporal');
                }
                window.location.href = url.href;
            }, 'Cambiar Modo');

            const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
            const cancelHandler = () => {
                e.target.checked = !isChecked;
                confirmCancelBtn.removeEventListener('click', cancelHandler);
            }
            confirmCancelBtn.addEventListener('click', cancelHandler)
        });
    }
    
    // ### INITIALIZATION ###
    function init() {
        elements.loadingOverlay.classList.add('active');
        populateModals();
        loadData();
        setupEventListeners();
        recalculateAllDays(); 
        const savedTheme = localStorage.getItem('theme');
        applyTheme(savedTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
        elements.tableFontColorPicker.value = appData.tableTextColor === 'inherit' ? '#000000' : appData.tableTextColor;
        updateSelectedRowIdentifierDisplay();
        console.log("GTN v10 (Modificado) inicializado.");
        
        setTimeout(() => {
            elements.loadingOverlay.classList.remove('active');
        }, 250);
    }

    init();
});
