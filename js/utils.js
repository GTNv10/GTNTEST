// js/utils.js — Utilidades, Formateo y Funciones Puras

import { state, saveData } from './state.js';

// --- TOAST ---

/**
 * Muestra una notificación toast.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} type
 * @param {number} duration
 */
export function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const colors = { success: 'bg-green-500', error: 'bg-red-500', warning: 'bg-yellow-400 text-black', info: 'bg-sky-500' };
    toast.className = `toast text-white ${colors[type] || colors.info} p-3 rounded-lg shadow-2xl text-sm font-semibold`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, duration);
}

// --- FORMATEO DE FECHAS ---

/**
 * Parsea una cadena de fecha en formato DD/MM/YYYY a un objeto Date UTC.
 * @param {string} str
 * @returns {Date|null}
 */
export const parseDate = (str) => {
    if (!str || typeof str !== 'string' || !str.includes('/')) return null;
    const parts = str.split('/');
    if (parts.length !== 3) return null;
    let [day, month, year] = parts.map(p => parseInt(p, 10));
    if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
    const fullYear = year < 100 ? (year > 50 ? 1900 + year : 2000 + year) : year;
    const date = new Date(Date.UTC(fullYear, month - 1, day));
    if (date && date.getUTCMonth() === month - 1) return date;
    return null;
};

/**
 * Formatea un objeto Date a cadena DD/MM/YYYY.
 * @param {Date} date
 * @returns {string}
 */
export const formatDate = (date) => {
    if (!date || !(date instanceof Date) || isNaN(date)) return '';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
};

/**
 * Formatea la fecha actual como DD-MM-YYYY para nombres de archivo.
 * @param {Date} date
 * @returns {string}
 */
export const getFormattedDateForFilename = (date = new Date()) => {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
};

/**
 * Formatea la fecha y hora actuales como DD-MM-YYYY_HH-MM para nombres de archivo.
 * @param {Date} date
 * @returns {string}
 */
export const getFormattedTimestampForFilename = (date = new Date()) => {
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    const h = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${d}-${m}-${y}_${h}-${min}`;
};

/**
 * Calcula los días transcurridos desde hoy hasta la fecha dada.
 * @param {string} dateStr - Fecha en formato DD/MM/YYYY
 * @returns {number|string}
 */
export const calculateDays = (dateStr) => {
    const date = parseDate(dateStr);
    if (!date) return '';
    const today = new Date();
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
    return Math.ceil((date - todayUTC) / (1000 * 60 * 60 * 24)) * -1;
};

// --- FORMATEO ---

/**
 * Formatea un número de 11 dígitos como CUIT/CUIL (XX-XXXXXXXX-X).
 * @param {string|number} value
 * @returns {string}
 */
export function formatCuitCuil(value) {
    if (!value) return '';
    const cleaned = String(value).replace(/[^0-9]/g, '');
    if (cleaned.length !== 11) return value;
    return `${cleaned.substring(0, 2)}-${cleaned.substring(2, 10)}-${cleaned.substring(10)}`;
}

// --- RECÁLCULO ---

/**
 * Recalcula la columna DIAS para todas las filas según la columna de fecha configurada.
 * @param {HTMLInputElement} temporalCheckbox
 */
export function recalculateAllDays(temporalCheckbox) {
    let hasChanges = false;
    const dateCol = state.appData.keyColumns?.dateForCalculation;
    const daysCol = state.appData.keyColumns?.daysDisplay;

    if (!dateCol || !daysCol || !state.appData.headers.includes(dateCol) || !state.appData.headers.includes(daysCol)) {
        return;
    }

    state.appData.mainData.forEach(row => {
        const newDays = calculateDays(row[dateCol]);
        if (String(row[daysCol] || '') !== String(newDays || '')) {
            row[daysCol] = newDays;
            hasChanges = true;
        }
    });
    if (hasChanges) saveData(temporalCheckbox);
}

// --- COMPONENTES DOM REUTILIZABLES ---

/**
 * Crea un input de texto que se convierte en input[type=date] al hacer foco,
 * almacenando el valor en formato DD/MM/YYYY.
 * @param {string} initialValue
 * @param {Function|null} onUpdateCallback
 * @returns {HTMLInputElement}
 */
export function createDateInputComponent(initialValue, onUpdateCallback) {
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
        if (e.target.value) {
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
