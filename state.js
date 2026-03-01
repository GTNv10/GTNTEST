// js/state.js — Gestión de Estado Global y Persistencia

const STORAGE_KEY = 'gestorReclamosData_v43_generic';

// Estado mutable centralizado. Todos los módulos importan este objeto
// y lo mutan directamente para que los cambios sean visibles globalmente.
export const state = {
    appData: {},
    filteredData: [],
    selectedRowId: null,
    selectedTemplateId: null,
    selectedColumnNameForDeletion: null,
    pendingPDFGeneration: null,
    searchDebounceTimer: null,
    currentPage: 1,
};

// --- PERSISTENCIA ---

/**
 * Guarda appData en localStorage, a menos que el modo temporal esté activo.
 * @param {HTMLInputElement} temporalCheckbox - El checkbox del modo temporal.
 */
export function saveData(temporalCheckbox) {
    if (temporalCheckbox && temporalCheckbox.checked) return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.appData));
    } catch (e) {
        console.error("Error guardando datos:", e);
        // showToast se llamará desde el llamador si es necesario
    }
}

/**
 * Carga appData desde localStorage o inicializa el esquema por defecto.
 * @param {HTMLInputElement} temporalCheckbox - El checkbox del modo temporal.
 * @param {Function} addRowCallback - Función para añadir fila inicial si no hay datos.
 */
export function loadData(temporalCheckbox, addRowCallback) {
    const temporalModeActive = new URLSearchParams(window.location.search).get('temporal') === 'true';
    if (temporalCheckbox) temporalCheckbox.checked = temporalModeActive;

    const storedData = temporalModeActive ? null : localStorage.getItem(STORAGE_KEY);

    if (storedData) {
        try {
            const parsed = JSON.parse(storedData);
            if (parsed.headers && parsed.mainData) {
                state.appData = parsed;
                // --- Migración y valores por defecto ---
                if (!parsed.visualAlerts) state.appData.visualAlerts = [];
                state.appData.visualAlerts.forEach(alert => {
                    if (typeof alert.color === 'string') {
                        const mapping = { 'Rojo': '#fee2e2', 'Amarillo': '#fef9c3', 'Verde': '#dcfce7' };
                        const textMapping = { 'Rojo': '#991b1b', 'Amarillo': '#854d0e', 'Verde': '#166534' };
                        alert.color = { bg: mapping[alert.color] || '#ffffff', text: textMapping[alert.color] || '#000000' };
                    }
                });
                if (!Array.isArray(parsed.filters)) state.appData.filters = [];

                if (parsed.hiddenStatuses && !parsed.hideSettings) {
                    state.appData.hideSettings = {
                        column: parsed.colorCodingColumn || 'ESTADO',
                        hiddenValues: parsed.hiddenStatuses
                    };
                    delete state.appData.hiddenStatuses;
                } else if (!parsed.hideSettings) {
                    state.appData.hideSettings = { column: 'ESTADO', hiddenValues: [] };
                }

                if (!parsed.templates) state.appData.templates = [];
                parsed.templates.forEach(t => {
                    if (!t.manualFields) t.manualFields = [];
                    if (!t.imageFields) t.imageFields = [];
                    if (!t.fontFamily) t.fontFamily = 'Helvetica';
                });
                if (!parsed.columnFormats) state.appData.columnFormats = {};
                if (!parsed.lookupRelations) state.appData.lookupRelations = [];
                if (!parsed.referenceDB) state.appData.referenceDB = {};

                if (parsed.referenceDB && parsed.referenceDB.statuses && !parsed.colorCodingColumn) {
                    const listKey = '_list_ESTADO';
                    if (!state.appData.referenceDB[listKey]) {
                        state.appData.referenceDB[listKey] = parsed.referenceDB.statuses;
                    }
                    delete state.appData.referenceDB.statuses;
                    state.appData.colorCodingColumn = 'ESTADO';
                }
                if (!state.appData.referenceDB['_list_ESTADO']) {
                    state.appData.referenceDB['_list_ESTADO'] = {
                        '__DEFAULT__': { light: '#f9fafb', dark: '#111827', textLight: '#1f2937', textDark: '#f3f4f6' },
                        'EN TRÁMITE': { light: '#fef9c3', dark: '#422006', textLight: '#713f12', textDark: '#fef08a' },
                        'FINALIZADO': { light: '#dcfce7', dark: '#14532d', textLight: '#166534', textDark: '#bbf7d0' },
                    };
                }
                if (!parsed.columnWidths) state.appData.columnWidths = {};
                if (!parsed.pdfFilenameFormat) state.appData.pdfFilenameFormat = 'Documento_{{NOMBRE_APELLIDO}}_{{FECHA_INICIO}}';
                if (!parsed.columnMetadata) state.appData.columnMetadata = {};
                if (!parsed.sortBy) state.appData.sortBy = 'FECHA DE INICIO';
                if (!parsed.sortOrder) state.appData.sortOrder = 'desc';
                if (!parsed.tableFontSize) state.appData.tableFontSize = 14;
                if (!parsed.tableTextColor) state.appData.tableTextColor = 'inherit';
                if (!parsed.rowsPerPage) state.appData.rowsPerPage = 10;
                if (!parsed.colorCodingColumn) state.appData.colorCodingColumn = 'ESTADO';
                if (!parsed.bulkDeleteColumn) state.appData.bulkDeleteColumn = 'ESTADO';
                if (!parsed.selectedRowIdentifierColumn) state.appData.selectedRowIdentifierColumn = 'EXPEDIENTE';

                if (!parsed.keyColumns) {
                    state.appData.keyColumns = {};
                    const possibleDateCols = ['FECHA ULTIMA / PROXIMA ACCION', 'FECHA ULTIMA/ PROXIMA ACCION'];
                    const foundDateCol = possibleDateCols.find(name => state.appData.headers.includes(name));
                    const foundDaysCol = state.appData.headers.find(name => name === 'DIAS');
                    state.appData.keyColumns.dateForCalculation = foundDateCol || null;
                    state.appData.keyColumns.daysDisplay = foundDaysCol || null;
                }
                // --- Fin Migración ---
                return;
            }
        } catch (e) { console.error("Error cargando datos:", e); }
    }

    // --- ESTRUCTURA DE DATOS INICIAL ---
    state.appData = {
        mainData: [],
        templates: [],
        visualAlerts: [{ id: 1, enabled: true, color: { bg: '#fee2e2', text: '#991b1b' }, condition: '>=', value: '10' }],
        filters: [],
        hideSettings: { column: 'ESTADO', hiddenValues: [] },
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
        headers: ["FECHA DE INICIO", "EXPEDIENTE", "ESTADO", "FECHA ULTIMA/ PROXIMA ACCION", "DIAS", "N° EMPRESA", "NOMBRE EMPRESA", "CUIT EMPRESA"],
        keyColumns: {
            dateForCalculation: 'FECHA ULTIMA/ PROXIMA ACCION',
            daysDisplay: 'DIAS'
        },
        columnMetadata: { "DIAS": { isProtected: true } },
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

    if (state.appData.mainData.length === 0 && addRowCallback) {
        addRowCallback(false);
    }
}
