/**
 * @file DashController.js
 * @description Controller da aba Dashboard, Histórico e ciclo de vida de viagens.
 *
 * Responsável por renderizar métricas inteligentes, gráfico Chart.js de rosca,
 * lista cronológica de gastos, seletores de viagem e modais de criar/encerrar viagem.
 *
 * @module controllers/DashController
 * @dependencies
 *   - ../models/ViagemManager.js (injetado via construtor)
 *   - ../utils/formatters.js
 */

import {
  formatarMoeda,
  formatarNumeroBR,
  formatarData,
  escapeHtml,
} from '../utils/formatters.js';

/** Paleta Chart.js alinhada ao design system. */
const CORES_CATEGORIA = {
  'Combustível': '#f97316',
  'Alimentação': '#22c55e',
  'Hospedagem': '#8b5cf6',
  'Pedágio': '#06b6d4',
  'Outros': '#64748b',
};

/** Ícones por categoria no histórico. */
const ICONES_CATEGORIA = {
  'Combustível': '⛽',
  'Alimentação': '🍽️',
  'Hospedagem': '🏨',
  'Pedágio': '🛣️',
  'Outros': '📦',
};

/** Classes CSS por categoria no histórico. */
const CLASSES_CATEGORIA = {
  'Combustível': 'combustivel',
  'Alimentação': 'alimentacao',
  'Hospedagem': 'hospedagem',
  'Pedágio': 'pedagio',
  'Outros': 'outros',
};

/**
 * Controller de Dashboard, Histórico e gestão de viagens.
 */
export class DashController {
  /**
   * @param {import('../models/ViagemManager.js').ViagemManager} manager - Singleton do Model.
   * @param {Object} callbacks - Callbacks de comunicação com app.js.
   * @param {function(string, 'success'|'error'=): void} callbacks.showToast - Exibe toast.
   * @param {function(string): void} callbacks.onNavigate - Navega para aba.
   * @param {function(): void} [callbacks.onViagemEncerrada] - Hook pós-encerramento.
   */
  constructor(manager, { showToast, onNavigate, onViagemEncerrada }) {
    this.manager = manager;
    this.showToast = showToast;
    this.onNavigate = onNavigate;
    this.onViagemEncerrada = onViagemEncerrada || (() => {});

    /** @type {import('chart.js').Chart|null} */
    this._chartInstance = null;

    this._cacheDom();
    this._bindEvents();
  }

  /**
   * Cacheia referências DOM utilizadas por este controller.
   * @private
   * @returns {void}
   */
  _cacheDom() {
    this.dom = {
      dashboardEmpty: document.getElementById('dashboard-empty'),
      dashboardContent: document.getElementById('dashboard-content'),
      selectViagemAtiva: document.getElementById('select-viagem-ativa'),
      selectViagemPostagem: document.getElementById('select-viagem-postagem'),
      totalGeral: document.getElementById('total-geral'),
      distanciaInfo: document.getElementById('distancia-info'),
      metricKml: document.getElementById('metric-kml'),
      metricDiaria: document.getElementById('metric-diaria'),
      metricKm: document.getElementById('metric-km'),
      metricAlimentacao: document.getElementById('metric-alimentacao'),
      chartCanvas: document.getElementById('chart-categorias'),
      chartEmpty: document.getElementById('chart-empty'),
      listaHistorico: document.getElementById('lista-historico'),
      historicoEmpty: document.getElementById('historico-empty'),
      modalNovaViagem: document.getElementById('modal-nova-viagem'),
      formNovaViagem: document.getElementById('form-nova-viagem'),
      modalEncerrarViagem: document.getElementById('modal-encerrar-viagem'),
      formEncerrarViagem: document.getElementById('form-encerrar-viagem'),
    };
  }

  /**
   * Registra event listeners de viagem e histórico.
   * @private
   * @returns {void}
   */
  _bindEvents() {
    document.getElementById('btn-nova-viagem-empty')
      ?.addEventListener('click', () => this._openModal(this.dom.modalNovaViagem));
    document.getElementById('btn-nova-viagem')
      ?.addEventListener('click', () => this._openModal(this.dom.modalNovaViagem));
    document.getElementById('btn-cancelar-viagem')
      ?.addEventListener('click', () => this._closeModal(this.dom.modalNovaViagem));
    document.getElementById('btn-encerrar-viagem')
      ?.addEventListener('click', () => this._openModal(this.dom.modalEncerrarViagem));
    document.getElementById('btn-cancelar-encerrar')
      ?.addEventListener('click', () => this._closeModal(this.dom.modalEncerrarViagem));

    this.dom.formNovaViagem?.addEventListener('submit', (e) => this._handleNovaViagem(e));
    this.dom.formEncerrarViagem?.addEventListener('submit', (e) => this._handleEncerrarViagem(e));

    this.dom.selectViagemAtiva?.addEventListener('change', () => {
      this.manager.definirViagemAtiva(this.dom.selectViagemAtiva.value);
      this.renderDashboard();
    });

    this.dom.listaHistorico?.addEventListener('click', (e) => this._handleDeleteGasto(e));
  }

  /**
   * Abre modal nativo `<dialog>`.
   * @param {HTMLDialogElement} modal - Elemento dialog.
   * @returns {void}
   */
  openNovaViagemModal() {
    this._openModal(this.dom.modalNovaViagem);
  }

  /**
   * @private
   * @param {HTMLDialogElement} modal
   */
  _openModal(modal) {
    if (modal && typeof modal.showModal === 'function') modal.showModal();
  }

  /**
   * @private
   * @param {HTMLDialogElement} modal
   */
  _closeModal(modal) {
    if (modal && typeof modal.close === 'function') modal.close();
  }

  /**
   * Popula selects de viagem ativa e encerrada.
   * @returns {void}
   */
  renderTripSelectors() {
    const viagens = this.manager.listarViagens();
    const ativas = viagens.filter((v) => v.status === 'ativa');
    const encerradas = viagens.filter((v) => v.status === 'encerrada');

    if (this.dom.selectViagemAtiva) {
      this.dom.selectViagemAtiva.innerHTML = ativas
        .map((v) => `<option value="${v.id}">${escapeHtml(v.nome)} (${v.veiculo})</option>`)
        .join('');
    }

    if (this.dom.selectViagemPostagem) {
      this.dom.selectViagemPostagem.innerHTML = encerradas.length
        ? encerradas.map((v) => `<option value="${v.id}">${escapeHtml(v.nome)}</option>`).join('')
        : '<option value="">Nenhuma viagem encerrada</option>';
    }
  }

  /**
   * Renderiza Dashboard completo: métricas + gráfico.
   * @returns {void}
   */
  renderDashboard() {
    const viagem = this.manager.getViagemAtiva();

    if (!viagem) {
      this.dom.dashboardEmpty?.classList.remove('hidden');
      this.dom.dashboardContent?.classList.add('hidden');
      return;
    }

    this.dom.dashboardEmpty?.classList.add('hidden');
    this.dom.dashboardContent?.classList.remove('hidden');

    this.renderTripSelectors();
    const resumo = this.manager.getResumoViagem(viagem);

    this.dom.totalGeral.textContent = formatarMoeda(resumo.totalGeral);
    this.dom.distanciaInfo.textContent =
      `${formatarNumeroBR(resumo.distanciaPercorrida, 1)} km percorridos`;

    this.dom.metricKml.textContent = resumo.consumoMedio !== null
      ? formatarNumeroBR(resumo.consumoMedio, 2) : '—';

    this.dom.metricDiaria.textContent = resumo.custoDiaria !== null
      ? formatarMoeda(resumo.custoDiaria) : '—';

    this.dom.metricKm.textContent = resumo.custoPorKm !== null
      ? formatarMoeda(resumo.custoPorKm) : '—';

    this.dom.metricAlimentacao.textContent = resumo.alimentacaoPerCapita !== null
      ? formatarMoeda(resumo.alimentacaoPerCapita) : '—';

    this._renderChart(resumo.distribuicao);
  }

  /**
   * Renderiza gráfico de rosca Chart.js.
   * @private
   * @param {Object<string, number>} distribuicao - Mapa categoria → valor.
   * @returns {void}
   */
  _renderChart(distribuicao) {
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

    if (data.length === 0) {
      this.dom.chartEmpty?.classList.remove('hidden');
      if (this.dom.chartCanvas) this.dom.chartCanvas.style.display = 'none';
      if (this._chartInstance) {
        this._chartInstance.destroy();
        this._chartInstance = null;
      }
      return;
    }

    this.dom.chartEmpty?.classList.add('hidden');
    if (this.dom.chartCanvas) this.dom.chartCanvas.style.display = 'block';

    if (this._chartInstance) this._chartInstance.destroy();

    if (typeof Chart !== 'undefined' && this.dom.chartCanvas) {
      this._chartInstance = new Chart(this.dom.chartCanvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: colors,
            borderColor: '#1e293b',
            borderWidth: 2,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#94a3b8', padding: 12, font: { size: 11 } },
            },
          },
        },
      });
    }
  }

  /**
   * Renderiza lista cronológica de gastos da viagem ativa.
   * @returns {void}
   */
  renderHistorico() {
    const viagem = this.manager.getViagemAtiva();
    if (!this.dom.listaHistorico) return;

    this.dom.listaHistorico.innerHTML = '';

    if (!viagem || viagem.gastos.length === 0) {
      this.dom.historicoEmpty?.classList.remove('hidden');
      return;
    }

    this.dom.historicoEmpty?.classList.add('hidden');

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
      this.dom.listaHistorico.appendChild(li);
    });
  }

  /**
   * Handler: criar nova viagem via modal.
   * @private
   * @param {SubmitEvent} e - Evento de submit do formulário.
   * @returns {void}
   */
  _handleNovaViagem(e) {
    e.preventDefault();

    const nome = document.getElementById('input-nome-viagem')?.value;
    const veiculo = document.getElementById('select-veiculo')?.value;
    const kmInicial = document.getElementById('input-km-inicial')?.value;

    const result = this.manager.criarViagem({ nome, veiculo, kmInicial });

    if (!result.sucesso) {
      this.showToast(result.erro, 'error');
      return;
    }

    this._closeModal(this.dom.modalNovaViagem);
    this.dom.formNovaViagem?.reset();
    this.showToast(`Viagem "${result.viagem.nome}" iniciada!`);
    this.renderDashboard();
    this.onNavigate('lancamento');
  }

  /**
   * Handler: encerrar viagem via modal.
   * @private
   * @param {SubmitEvent} e - Evento de submit.
   * @returns {void}
   */
  _handleEncerrarViagem(e) {
    e.preventDefault();

    const viagem = this.manager.getViagemAtiva();
    if (!viagem) return;

    const kmFinal = document.getElementById('input-km-final')?.value;
    const result = this.manager.encerrarViagem(viagem.id, kmFinal);

    if (!result.sucesso) {
      this.showToast(result.erro, 'error');
      return;
    }

    this._closeModal(this.dom.modalEncerrarViagem);
    this.dom.formEncerrarViagem?.reset();
    this.showToast('Viagem encerrada! Confira a Central de Postagem.');

    this.renderTripSelectors();
    if (this.dom.selectViagemPostagem) {
      this.dom.selectViagemPostagem.value = result.viagem.id;
    }

    this.onViagemEncerrada(result.viagem.id);
    this.onNavigate('postagem');
  }

  /**
   * Handler: excluir gasto do histórico.
   * @private
   * @param {MouseEvent} e - Evento de clique.
   * @returns {void}
   */
  _handleDeleteGasto(e) {
    const btn = e.target.closest('.btn-delete');
    if (!btn) return;

    const viagem = this.manager.getViagemAtiva();
    if (!viagem) return;

    if (!confirm('Deseja excluir este gasto?')) return;

    const result = this.manager.excluirGasto(viagem.id, btn.dataset.gastoId);

    if (result.sucesso) {
      this.showToast('Gasto excluído.');
      this.renderHistorico();
      this.renderDashboard();
    } else {
      this.showToast(result.erro, 'error');
    }
  }
}
