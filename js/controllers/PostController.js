/**
 * @file PostController.js
 * @description Controller da Central de Postagem — fluxo pós-viagem e geração de reviews.
 * Exposto em window.RotaInteligente.PostController
 */

(function (global) {
  'use strict';

  const { escapeHtml } = global.RotaInteligente.formatters;

  class PostController {
    constructor(manager, { showToast }) {
      this.manager = manager;
      this.showToast = showToast;

      this._cacheDom();
      this._bindEvents();
    }

    _cacheDom() {
      this.dom = {
        selectViagemPostagem: document.getElementById('select-viagem-postagem'),
        postagemEmpty: document.getElementById('postagem-empty'),
        listaReviews: document.getElementById('lista-reviews'),
      };
    }

    _bindEvents() {
      this.dom.selectViagemPostagem?.addEventListener('change', () => this.render());
      this.dom.listaReviews?.addEventListener('click', (e) => {
        this._handlePrepararReview(e);
        this._handleCopiarReview(e);
      });
    }

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

    selecionarViagem(viagemId) {
      if (this.dom.selectViagemPostagem) {
        this.dom.selectViagemPostagem.value = viagemId;
      }
      this.render();
    }

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

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.PostController = PostController;
})(window);
