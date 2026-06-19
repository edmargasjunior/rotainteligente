/**
 * @file HistoricoController.js
 * @description Aba Histórico — cards de viagens e relatório profundo read-only.
 * Exposto em window.RotaInteligente.HistoricoController
 */

(function (global) {
  'use strict';

  const {
    formatarMoeda,
    formatarNumeroBR,
    formatarData,
    escapeHtml,
  } = global.RotaInteligente.formatters;

  const CORES_CATEGORIA = {
    'Combustível': '#f97316',
    'Alimentação': '#22c55e',
    'Hospedagem': '#8b5cf6',
    'Pedágio': '#06b6d4',
    'Outros': '#64748b',
  };

  const ICONES_CATEGORIA = {
    'Combustível': '⛽',
    'Alimentação': '🍽️',
    'Hospedagem': '🏨',
    'Pedágio': '🛣️',
    'Outros': '📦',
  };

  const CLASSES_CATEGORIA = {
    'Combustível': 'combustivel',
    'Alimentação': 'alimentacao',
    'Hospedagem': 'hospedagem',
    'Pedágio': 'pedagio',
    'Outros': 'outros',
  };

  class HistoricoController {
    /**
     * @param {import('../models/ViagemManager.js').ViagemManager} manager
     * @param {Object} callbacks
     * @param {function(string, 'success'|'error'=): void} callbacks.showToast
     * @param {function(): void} [callbacks.onGastosAlterados]
     */
    constructor(manager, { showToast, onGastosAlterados }) {
      this.manager = manager;
      this.showToast = showToast;
      this.onGastosAlterados = onGastosAlterados || (() => {});

      /** @type {import('chart.js').Chart|null} */
      this._chartDetalhe = null;

      this._cacheDom();
      this._bindEvents();
    }

    _cacheDom() {
      this.dom = {
        listaViagens: document.getElementById('lista-viagens-historico'),
        listaGastosAtivos: document.getElementById('lista-gastos-ativos'),
        historicoEmpty: document.getElementById('historico-empty'),
        secaoGastosAtivos: document.getElementById('secao-gastos-ativos'),
        modalDetalhe: document.getElementById('modal-detalhe-viagem'),
        detalheConteudo: document.getElementById('detalhe-viagem-conteudo'),
        chartDetalhe: document.getElementById('chart-detalhe-viagem'),
      };
    }

    _bindEvents() {
      this.dom.listaViagens?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ver-detalhe]');
        if (btn) this._abrirDetalhe(btn.dataset.verDetalhe);
      });

      this.dom.listaGastosAtivos?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-delete');
        if (!btn) return;
        this._excluirGastoAtivo(btn.dataset.gastoId);
      });

      document.getElementById('btn-fechar-detalhe')
        ?.addEventListener('click', () => this._fecharDetalhe());
    }

    /** Renderiza cards de todas as viagens + gastos da viagem ativa. */
    render() {
      this._renderCardsViagens();
      this._renderGastosViagemAtiva();
    }

    _renderCardsViagens() {
      const lista = this.dom.listaViagens;
      if (!lista) return;

      const viagens = this.manager.listarViagens()
        .sort((a, b) => (b.timestampInicio || 0) - (a.timestampInicio || 0));

      if (viagens.length === 0) {
        lista.innerHTML = '';
        this.dom.historicoEmpty?.classList.remove('hidden');
        return;
      }

      this.dom.historicoEmpty?.classList.add('hidden');
      lista.innerHTML = viagens.map((v) => {
        const card = this.manager.getResumoCardViagem(v);
        const badge = v.status === 'ativa'
          ? '<span class="viagem-badge ativa">Ativa</span>'
          : '<span class="viagem-badge encerrada">Encerrada</span>';
        const modo = v.modo === 'instantanea' ? ' · Instantânea' : '';

        return `
          <article class="viagem-card ${v.status}" data-viagem-id="${v.id}">
            <div class="viagem-card-header">
              <h3>${escapeHtml(card.nome)}</h3>
              ${badge}
            </div>
            <p class="viagem-card-meta">
              ${v.destino ? escapeHtml(v.destino) + ' · ' : ''}${card.veiculo}${modo}
            </p>
            <div class="viagem-card-stats">
              <span>${formatarMoeda(card.totalGeral)}</span>
              <span>${formatarNumeroBR(card.distancia, 1)} km</span>
              <span>${card.duracao}</span>
              <span>${card.gastosCount} gastos</span>
            </div>
            ${v.status === 'encerrada'
              ? `<button type="button" class="btn btn-secondary btn-sm btn-block" data-ver-detalhe="${v.id}">Ver Detalhes</button>`
              : '<p class="viagem-card-hint">Viagem em andamento</p>'}
          </article>
        `;
      }).join('');
    }

    _renderGastosViagemAtiva() {
      const viagem = this.manager.getViagemAtiva();
      const secao = this.dom.secaoGastosAtivos;
      const lista = this.dom.listaGastosAtivos;

      if (!secao || !lista) return;

      if (!viagem || viagem.gastos.length === 0) {
        secao.classList.add('hidden');
        lista.innerHTML = '';
        return;
      }

      secao.classList.remove('hidden');
      lista.innerHTML = '';

      const gastosOrdenados = [...viagem.gastos].sort(
        (a, b) => new Date(b.data) - new Date(a.data)
      );

      gastosOrdenados.forEach((gasto) => {
        const li = document.createElement('li');
        li.className = 'historico-item';
        li.innerHTML = `
          <div class="historico-icon ${CLASSES_CATEGORIA[gasto.categoria] || 'outros'}">
            ${ICONES_CATEGORIA[gasto.categoria] || '📦'}
          </div>
          <div class="historico-info">
            <h3>${escapeHtml(gasto.localizacao.nome)}</h3>
            <p>${gasto.categoria} · ${formatarData(gasto.data)}</p>
          </div>
          <span class="historico-valor">${formatarMoeda(gasto.valorTotal)}</span>
          <button type="button" class="btn-delete" data-gasto-id="${gasto.id}" aria-label="Excluir gasto">🗑️</button>
        `;
        lista.appendChild(li);
      });
    }

    _excluirGastoAtivo(gastoId) {
      const viagem = this.manager.getViagemAtiva();
      if (!viagem || !confirm('Deseja excluir este gasto?')) return;

      const result = this.manager.excluirGasto(viagem.id, gastoId);
      if (result.sucesso) {
        this.showToast('Gasto excluído.');
        this.render();
        this.onGastosAlterados();
      }
    }

    _abrirDetalhe(viagemId) {
      const viagem = this.manager.getViagemPorId(viagemId);
      if (!viagem || viagem.status !== 'encerrada') return;

      const resumo = this.manager.getResumoViagem(viagem);
      const diario = viagem.gastos
        .filter((g) => g.avaliacao?.comentario)
        .map((g) => `<blockquote>${escapeHtml(g.avaliacao.comentario)} <cite>— ${escapeHtml(g.localizacao.nome)}</cite></blockquote>`)
        .join('') || '<p class="text-muted">Nenhuma entrada no diário de bordo.</p>';

      const gastosHtml = [...viagem.gastos]
        .sort((a, b) => new Date(b.data) - new Date(a.data))
        .map((g) => `
          <li class="historico-item readonly">
            <div class="historico-info">
              <h3>${escapeHtml(g.localizacao.nome)}</h3>
              <p>${g.categoria} · ${formatarData(g.data)}</p>
            </div>
            <span class="historico-valor">${formatarMoeda(g.valorTotal)}</span>
          </li>
        `).join('');

      if (this.dom.detalheConteudo) {
        this.dom.detalheConteudo.innerHTML = `
          <h2>${escapeHtml(viagem.nome)}</h2>
          <p class="detalhe-meta">${viagem.destino ? escapeHtml(viagem.destino) + ' · ' : ''}${resumo.duracaoFormatada} · ${formatarNumeroBR(resumo.distanciaPercorrida, 1)} km</p>
          <div class="detalhe-metrics">
            <div><span>Total</span><strong>${formatarMoeda(resumo.totalGeral)}</strong></div>
            <div><span>Consumo</span><strong>${resumo.consumoMedio !== null ? formatarNumeroBR(resumo.consumoMedio, 2) + ' km/l' : '—'}</strong></div>
            <div><span>Custo/KM</span><strong>${resumo.custoPorKm !== null ? formatarMoeda(resumo.custoPorKm) : '—'}</strong></div>
          </div>
          <div class="chart-wrapper chart-detalhe">
            <canvas id="chart-detalhe-viagem-canvas"></canvas>
          </div>
          <h3 class="detalhe-subtitulo">Diário de Bordo</h3>
          <div class="diario-bordo-readonly">${diario}</div>
          <h3 class="detalhe-subtitulo">Gastos</h3>
          <ul class="historico-list">${gastosHtml || '<li class="text-muted">Sem gastos.</li>'}</ul>
        `;
      }

      this._renderChartDetalhe(resumo.distribuicao);
      this.dom.modalDetalhe?.showModal?.();
    }

    _renderChartDetalhe(distribuicao) {
      if (this._chartDetalhe) {
        this._chartDetalhe.destroy();
        this._chartDetalhe = null;
      }

      const canvas = document.getElementById('chart-detalhe-viagem-canvas');
      if (!canvas || typeof Chart === 'undefined') return;

      const labels = [];
      const data = [];
      const colors = [];

      Object.entries(distribuicao).forEach(([cat, valor]) => {
        if (valor > 0) {
          labels.push(cat);
          data.push(valor);
          colors.push(CORES_CATEGORIA[cat]);
        }
      });

      if (!data.length) return;

      this._chartDetalhe = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{ data, backgroundColor: colors, borderColor: '#1e293b', borderWidth: 2 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } },
        },
      });
    }

    _fecharDetalhe() {
      if (this._chartDetalhe) {
        this._chartDetalhe.destroy();
        this._chartDetalhe = null;
      }
      this.dom.modalDetalhe?.close?.();
    }
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.HistoricoController = HistoricoController;
})(window);
