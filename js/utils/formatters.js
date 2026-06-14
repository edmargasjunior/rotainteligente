/**
 * @file formatters.js
 * @description Utilitários de formatação e parsing numérico no padrão brasileiro.
 *
 * Responsável por interceptar strings como `"1.099,90"` ou `"80,54"`, remover
 * caracteres inválidos via regex e convertê-las em floats JavaScript válidos
 * (`1099.90`, `80.54`) antes que controllers repassem dados ao Model.
 *
 * @module utils/formatters
 * @dependencies Nenhuma (módulo puro, sem side-effects).
 */

/** Regex para remover tudo exceto dígitos, vírgula, ponto e sinal negativo. */
const REGEX_LIMPEZA_NUMERO = /[^\d,.-]/g;

/** Regex para detectar string vazia ou inválida após limpeza. */
const REGEX_NUMERO_INVALIDO = /^-$|^,$|^\.$|^$/;

/**
 * Converte string numérica brasileira em float.
 *
 * Exemplos de entrada válida:
 * - `"1.099,90"` → `1099.90`
 * - `"80,54"` → `80.54`
 * - `"1234.56"` → `1234.56` (formato internacional também aceito)
 *
 * @param {string|number|null|undefined} valor - Valor bruto do input.
 * @returns {number|null} Float parseado ou `null` se inválido/vazio.
 */
export function parseNumeroBR(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;

  const str = String(valor).trim();
  if (!str) return null;

  const limpo = str.replace(REGEX_LIMPEZA_NUMERO, '');
  if (REGEX_NUMERO_INVALIDO.test(limpo)) return null;

  let normalizado;
  if (limpo.includes(',')) {
    normalizado = limpo.replace(/\./g, '').replace(',', '.');
  } else {
    normalizado = limpo;
  }

  const num = parseFloat(normalizado);
  return Number.isFinite(num) ? num : null;
}

/**
 * Converte string numérica brasileira em inteiro arredondado.
 *
 * @param {string|number|null|undefined} valor - Valor bruto do input.
 * @returns {number|null} Inteiro ou `null` se inválido.
 */
export function parseInteiroBR(valor) {
  const num = parseNumeroBR(valor);
  if (num === null) return null;
  return Math.round(num);
}

/**
 * Formata número para exibição no padrão pt-BR.
 *
 * @param {number|null|undefined} valor - Valor numérico.
 * @param {number} [decimais=2] - Casas decimais.
 * @returns {string} Texto formatado ou `"—"` se inválido.
 */
export function formatarNumeroBR(valor, decimais = 2) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  });
}

/**
 * Formata valor monetário em Real (BRL).
 *
 * @param {number|null|undefined} valor - Valor numérico.
 * @returns {string} Ex.: `"R$ 1.099,90"` ou `"R$ 0,00"` se inválido.
 */
export function formatarMoeda(valor) {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'R$ 0,00';
  return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Formata quilometragem com sufixo opcional.
 *
 * @param {number|null|undefined} km - Distância em quilômetros.
 * @param {number} [decimais=1] - Casas decimais.
 * @returns {string} Ex.: `"1.850,5 km"`.
 */
export function formatarKm(km, decimais = 1) {
  if (km === null || km === undefined || !Number.isFinite(km)) return '0 km';
  return `${formatarNumeroBR(km, decimais)} km`;
}

/**
 * Formata data ISO-8601 para exibição legível em pt-BR.
 *
 * @param {string} iso - Data em formato ISO string.
 * @returns {string} Ex.: `"13 de jun. de 2026, 14:30"`.
 */
export function formatarData(iso) {
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Escapa HTML para prevenir XSS em renderização dinâmica.
 *
 * @param {string} str - Texto potencialmente inseguro.
 * @returns {string} Texto escapado seguro para innerHTML.
 */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
