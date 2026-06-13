/**
 * @file PostController.js
 * @description Controller da Central de Postagem — fluxo pós-viagem e geração de reviews.
 *
 * Renderiza gastos avaliados de viagens encerradas, prepara texto polido para
 * Google Maps, copia para clipboard e abre link de compartilhamento.
 *
 * @module controllers/PostController
 * @dependencies
 *   - ../models/ViagemManager.js (injetado via construtor)
 *   - ../utils/formatters.js
 */

import { escapeHtml } from '../utils/formatters.js';

/**
 * Controller da aba Central de Postagem.
 */
export class PostController {
  /**
   * @param {import('../models/ViagemManager.js').ViagemManager} manager - Singleton do Model.
   * @param {Object} callbacks - Callbacks de comunicação com app.js.
   * @param {function(string, 'success'|'error'='success'): void} callbacks.showToast - Exibe toast.
   */
  constructor(manager, { showToast }) {
    this.manager = manager;
    this.showToast = showToast;

    this._cacheDom();
    this._bindEvents();
  }

  /**
   * Cacheia referências DOM da aba postagem.
   * @private
   * @returns {void}
   */
  _cacheDom() {
    this.dom = {
      selectViagemPostagem: document.getElementById('select-viagem-postagem'),
      postagemEmpty: document.getElementById('postagem-empty'),
      listaReviews: document.getElementById('lista-reviews'),
    };
  }

  /**
   * Registra event listeners da central de postagem.
   * @private
   * @returns {void}
   */
  _bindEvents() {
    this.dom.selectViagemPostagem?.addEventListener('change', () => this.render());
    this.dom.listaReviews?.addEventListener('click', (e) => {
      this._handlePrepararReview(e);
      this._handleCopiarReview(e);
    });
  }

  /**
   * Renderiza lista de reviews da viagem encerrada selecionada.
   * @returns {void}
   */
  render() {
    const viagemId = this.dom.selectViagemPostagem?.value;
    const items = viagemId ? this.manager.getGastosComAvaliacao(viagemId) : [];

    if (items.length === 0) {
      this.dom.postagemEmpty?.classList.remove('hidden');
      if (this.dom.listaReviews) {
        this.dom.listaReviews.hidden = true;
        this.dom.listaReviews.innerHTML = '';
      }
      return;
    }

    this.dom.postagemEmpty?.classList.add('hidden');
    if (!this.dom.listaReviews) return;

    this.dom.listaReviews.hidden = false;
    this.dom.listaReviews.innerHTML = '';

    items.forEach(({ viagem, gasto }) => {
      const card = document.createElement('div');
      card.className = 'review-card';
      card.dataset.viagemId = viagem.id;
      card.dataset.gastoId = gasto.id;

      const estrelasVis = '★'.repeat(gasto.avaliacao.estrelas) +
        '☆'.repeat(5 - gasto.avaliacao.estrelas);

      card.innerHTML = `
        <div class="review-header">
          <h3>${escapeHtml(gasto.localizacao.nome)}</h3>
          <span class="review-stars">${estrelasVis}</span>
        </div>
        <p class="review-meta">
          ${gasto.categoria} · ${gasto.avaliacao.perfil}
          ${gasto.avaliacao.revisado ? '<span class="badge-revisado">Revisado</span>' : ''}
        </p>
        ${gasto.avaliacao.comentario
          ? `<p class="review-comentario">"${escapeHtml(gasto.avaliacao.comentario)}"</p>`
          : ''}
        <div class="review-preview" id="preview-${gasto.id}"></div>
        <div class="review-actions">
          <button type="button" class="btn btn-primary btn-preparar-review">Preparar Review</button>
        </div>
      `;

      this.dom.listaReviews.appendChild(card);
    });
  }

  /**
   * Seleciona viagem encerrada no dropdown (útil após encerrar viagem).
   * @param {string} viagemId - ID da viagem encerrada.
   * @returns {void}
   */
  selecionarViagem(viagemId) {
    if (this.dom.selectViagemPostagem) {
      this.dom.selectViagemPostagem.value = viagemId;
    }
    this.render();
  }

  /**
   * Handler: prepara texto de review formatado para Google Maps.
   * @private
   * @param {MouseEvent} e - Evento de clique.
   * @returns {void}
   */
  _handlePrepararReview(e) {
    const btn = e.target.closest('.btn-preparar-review');
    if (!btn) return;

    const card = btn.closest('.review-card');
    const viagemId = card.dataset.viagemId;
    const gastoId = card.dataset.gastoId;
    const viagem = this.manager.getViagemPorId(viagemId);
    const gasto = viagem?.gastos.find((g) => g.id === gastoId);

    if (!gasto) return;

    const texto = this.manager.formatarReviewGoogleMaps(gasto);
    const preview = card.querySelector('.review-preview');

    if (preview) {
      preview.textContent = texto;
      preview.classList.add('visible');
    }

    const actions = card.querySelector('.review-actions');
    if (actions) {
      actions.innerHTML = `
        <button type="button" class="btn btn-primary btn-copiar" data-texto="${encodeURIComponent(texto)}">Copiar Texto</button>
        <a href="https://www.google.com/maps/search/?api=1&query=${gasto.localizacao.lat},${gasto.localizacao.lng}"
           target="_blank" rel="noopener noreferrer" class="btn btn-secondary">Abrir no Maps</a>
      `;
    }

    this.manager.marcarAvaliacaoRevisada(viagemId, gastoId);
  }

  /**
   * Handler: copia texto do review para clipboard.
   * @private
   * @param {MouseEvent} e - Evento de clique.
   * @returns {void}
   */
  _handleCopiarReview(e) {
    const btn = e.target.closest('.btn-copiar');
    if (!btn) return;

    const texto = decodeURIComponent(btn.dataset.texto);

    navigator.clipboard.writeText(texto).then(() => {
      this.showToast('Texto copiado! Cole no Google Maps.');
    }).catch(() => {
      this.showToast('Não foi possível copiar. Selecione o texto manualmente.', 'error');
    });
  }
}
