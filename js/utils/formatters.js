/**
 * @file formatters.js
 * @description Utilitários de formatação e parsing numérico no padrão brasileiro.
 * Exposto em window.RotaInteligente.formatters para execução via file://
 */

(function (global) {
  'use strict';

  const REGEX_LIMPEZA_NUMERO = /[^\d,.-]/g;
  const REGEX_NUMERO_INVALIDO = /^-$|^,$|^\.$|^$/;

  function parseNumeroBR(valor) {
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

  function parseInteiroBR(valor) {
    const num = parseNumeroBR(valor);
    if (num === null) return null;
    return Math.round(num);
  }

  function formatarNumeroBR(valor, decimais = 2) {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: decimais,
      maximumFractionDigits: decimais,
    });
  }

  function formatarMoeda(valor) {
    if (valor === null || valor === undefined || !Number.isFinite(valor)) return 'R$ 0,00';
    return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatarKm(km, decimais = 1) {
    if (km === null || km === undefined || !Number.isFinite(km)) return '0 km';
    return `${formatarNumeroBR(km, decimais)} km`;
  }

  function formatarData(iso) {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.formatters = {
    parseNumeroBR,
    parseInteiroBR,
    formatarNumeroBR,
    formatarMoeda,
    formatarKm,
    formatarData,
    escapeHtml,
  };
})(window);
