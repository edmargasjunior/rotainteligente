/**
 * @file DashController.js
 * @description Controller da aba Dashboard, Histórico e ciclo de vida de viagens.
 * Exposto em window.RotaInteligente.DashController
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

  class DashController {
    constructor(manager, { showToast, onNavigate, onViagemEncerrada, onViagemIniciada, viagemMonitor }) {
      this.manager = manager;
      this.showToast = showToast;
      this.onNavigate = onNavigate;
      this.onViagemEncerrada = onViagemEncerrada || (() => {});
      this.onViagemIniciada = onViagemIniciada || (() => {});
      this.viagemMonitor = viagemMonitor;

      this._chartInstance = null;
      this._paradaAtiva = false;

      this._cacheDom();
      this._bindEvents();
      this._popularTagsPreferencia();
    }

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
        modalNovaViagem: document.getElementById('modal-nova-viagem'),
        formNovaViagem: document.getElementById('form-nova-viagem'),
        modalInstantanea: document.getElementById('modal-viagem-instantanea'),
        formInstantanea: document.getElementById('form-viagem-instantanea'),
        modalEncerrarViagem: document.getElementById('modal-encerrar-viagem'),
        formEncerrarViagem: document.getElementById('form-encerrar-viagem'),
        modalAlertaParada: document.getElementById('modal-alerta-parada'),
        cardTripMonitor: document.getElementById('card-trip-monitor'),
        tripStatusAtual: document.getElementById('trip-status-atual'),
        tripDuracao: document.getElementById('trip-duracao'),
        inputContatoSeguranca: document.getElementById('input-contato-seguranca'),
        cardPlanejamento: document.getElementById('card-planejamento'),
        planejamentoConteudo: document.getElementById('planejamento-conteudo'),
        previewRotaConforto: document.getElementById('preview-rota-curador'),
      };
    }

    _popularTagsPreferencia() {
      const container = document.getElementById('tags-preferencia');
      if (!container) return;

      const tags = this.manager.listarTagsPreferencia();
      container.innerHTML = tags.map((tag) => `
        <label class="tag-checkbox">
          <input type="checkbox" name="tag-pref" value="${escapeHtml(tag)}">
          <span>${escapeHtml(tag)}</span>
        </label>
      `).join('');
    }

    _obterTagsSelecionadas() {
      return [...document.querySelectorAll('#tags-preferencia input:checked')]
        .map((el) => el.value);
    }

    _popularSelectTrajetos() {
      const select = document.getElementById('select-trajeto-curado');
      if (!select) return;

      const trajetos = this.manager.listarTrajetosCurados();
      const valorAtual = select.value;

      select.innerHTML = '<option value="">Selecione um trajeto...</option>'
        + trajetos.map((t) => (
          `<option value="${t.id}">${escapeHtml(t.origem)} → ${escapeHtml(t.destino)}</option>`
        )).join('');

      if (valorAtual && trajetos.some((t) => t.id === valorAtual)) {
        select.value = valorAtual;
      }
    }

    _iconeTimeline(tipo) {
      const icones = {
        origem: '🏁',
        destino: '🎯',
        parada: '⛽',
        atracao: '📸',
        restaurante: '🍽️',
      };
      return icones[tipo] || '📍';
    }

    _renderTimelineHtml(timeline, compacto = false) {
      if (!timeline?.length) return '';

      const classe = compacto ? 'timeline-preview' : 'timeline-guia';
      const itens = timeline.map((p) => `
        <li class="timeline-item timeline-${p.tipo}">
          <span class="timeline-km">${p.km} km</span>
          <span class="timeline-icone" aria-hidden="true">${this._iconeTimeline(p.tipo)}</span>
          <div class="timeline-corpo">
            <div class="timeline-corpo-inner">
              <strong class="timeline-titulo">${escapeHtml(p.titulo)}</strong>
              <p class="timeline-descricao">${escapeHtml(p.descricao)}</p>
            </div>
          </div>
        </li>
      `).join('');

      return `<ol class="${classe}">${itens}</ol>`;
    }

    _bindEvents() {
      document.getElementById('btn-nova-viagem-empty')
        ?.addEventListener('click', () => this.openNovaViagemModal());
      document.getElementById('btn-instantanea-empty')
        ?.addEventListener('click', () => this._openModal(this.dom.modalInstantanea));
      document.getElementById('btn-nova-viagem')
        ?.addEventListener('click', () => this.openNovaViagemModal());
      document.getElementById('btn-cancelar-viagem')
        ?.addEventListener('click', () => this._closeModal(this.dom.modalNovaViagem));
      document.getElementById('btn-encerrar-viagem')
        ?.addEventListener('click', () => this._openModal(this.dom.modalEncerrarViagem));
      document.getElementById('btn-cancelar-encerrar')
        ?.addEventListener('click', () => this._closeModal(this.dom.modalEncerrarViagem));

      document.getElementById('btn-viagem-instantanea')
        ?.addEventListener('click', () => this._openModal(this.dom.modalInstantanea));
      document.getElementById('btn-cancelar-instantanea')
        ?.addEventListener('click', () => this._closeModal(this.dom.modalInstantanea));
      this.dom.formInstantanea?.addEventListener('submit', (e) => this._handleViagemInstantanea(e));

      document.getElementById('btn-iniciar-parada')
        ?.addEventListener('click', () => this._handleIniciarParada());
      document.getElementById('btn-enviar-rastreio')
        ?.addEventListener('click', () => this._handleEnviarRastreio());
      this.dom.inputContatoSeguranca?.addEventListener('change', (e) => {
        this.manager.salvarContatoSeguranca(e.target.value);
      });

      document.getElementById('btn-continuar-viagem')
        ?.addEventListener('click', () => this._handleContinuarViagem());
      document.getElementById('btn-encerrar-por-parada')
        ?.addEventListener('click', () => {
          this._closeModal(this.dom.modalAlertaParada);
          this._openModal(this.dom.modalEncerrarViagem);
        });

      this.dom.formNovaViagem?.addEventListener('submit', (e) => this._handleNovaViagem(e));
      this.dom.formEncerrarViagem?.addEventListener('submit', (e) => this._handleEncerrarViagem(e));

      this.dom.selectViagemAtiva?.addEventListener('change', () => {
        this.manager.definirViagemAtiva(this.dom.selectViagemAtiva.value);
        this.renderDashboard();
      });

      document.getElementById('select-tipo-rota')
        ?.addEventListener('change', () => this._atualizarPreviewRota());
      document.getElementById('select-trajeto-curado')
        ?.addEventListener('change', () => this._atualizarPreviewRota());
      document.getElementById('tags-preferencia')
        ?.addEventListener('change', () => this._atualizarPreviewRota());
    }

    openNovaViagemModal() {
      this._popularSelectTrajetos();
      this._openModal(this.dom.modalNovaViagem);
      this._atualizarPreviewRota();
    }

    _openModal(modal) {
      if (modal && typeof modal.showModal === 'function') modal.showModal();
    }

    _closeModal(modal) {
      if (modal && typeof modal.close === 'function') modal.close();
    }

    _atualizarPreviewRota() {
      const preview = this.dom.previewRotaConforto;
      if (!preview) return;

      const tipoRota = document.getElementById('select-tipo-rota')?.value || 'direta';
      const trajetoId = document.getElementById('select-trajeto-curado')?.value;

      if (!trajetoId) {
        preview.classList.add('hidden');
        preview.innerHTML = '';
        return;
      }

      const planejamento = this.manager.planejarRota(tipoRota, {
        trajetoId,
        preferenciasTags: this._obterTagsSelecionadas(),
      });
      const labelRota = tipoRota === 'conforto' ? 'Rota Conforto' : 'Rota Direta';

      preview.classList.remove('hidden');
      preview.innerHTML = `
        <p class="preview-rota-titulo">Preview — ${labelRota}</p>
        <p class="preview-rota-meta">
          ${escapeHtml(planejamento.origem)} → ${escapeHtml(planejamento.destino)}
          · ${escapeHtml(planejamento.distanciaTotal || '—')}
          · ${escapeHtml(planejamento.tempoEstimado || '—')}
        </p>
        ${planejamento.alerta ? `<p class="preview-rota-alerta">${escapeHtml(planejamento.alerta)}</p>` : ''}
        ${this._renderTimelineHtml(planejamento.timeline, true)}
      `;
    }

    _renderPlanejamento(planejamento) {
      const card = this.dom.cardPlanejamento;
      const conteudo = this.dom.planejamentoConteudo;
      if (!card || !conteudo) return;

      if (!planejamento || (!planejamento.timeline?.length && !planejamento.trajetoId)) {
        card.classList.add('hidden');
        return;
      }

      card.classList.remove('hidden');

      const isConforto = planejamento.tipoRota === 'conforto';
      const labelRota = isConforto ? 'Rota Conforto / Turística' : 'Rota Direta';
      const badgeClass = isConforto ? 'badge-conforto' : 'badge-direta';

      const metaHtml = (planejamento.distanciaTotal || planejamento.tempoEstimado)
        ? `<p class="planejamento-meta">
            ${planejamento.distanciaTotal ? `<span>${escapeHtml(planejamento.distanciaTotal)}</span>` : ''}
            ${planejamento.tempoEstimado ? `<span>${escapeHtml(planejamento.tempoEstimado)}</span>` : ''}
          </p>`
        : '';

      const alertaHtml = planejamento.alerta
        ? `<p class="planejamento-alerta">${escapeHtml(planejamento.alerta)}</p>`
        : '';

      const tempoExtra = planejamento.tempoEstimadoAdicionalMinutos > 0
        ? `<p class="planejamento-tempo">Tempo adicional vs. rota direta: +${planejamento.tempoEstimadoAdicionalMinutos} min</p>`
        : '';

      const rotaLabel = planejamento.origem && planejamento.destino
        ? `<p class="planejamento-rota">${escapeHtml(planejamento.origem)} → ${escapeHtml(planejamento.destino)}</p>`
        : '';

      conteudo.innerHTML = `
        <div class="planejamento-header">
          <span class="planejamento-badge ${badgeClass}">${labelRota}</span>
          ${planejamento.resumo?.foco ? `<span class="planejamento-foco">${escapeHtml(planejamento.resumo.foco)}</span>` : ''}
        </div>
        ${rotaLabel}
        ${metaHtml}
        ${alertaHtml}
        ${tempoExtra}
        ${this._renderTimelineHtml(planejamento.timeline)}
      `;
    }

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

      this._renderPlanejamento(resumo.planejamento);
      this._renderChart(resumo.distribuicao);
      this._renderMonitorViagem(viagem, resumo);
    }

    /**
     * Atualiza painel de monitoramento — duração via Date.now() - timestampInicio.
     * @private
     */
    _renderMonitorViagem(viagem, resumo) {
      if (this.dom.tripStatusAtual) {
        this.dom.tripStatusAtual.textContent = viagem.statusAtual || 'Em movimento';
      }
      if (this.dom.tripDuracao) {
        this.dom.tripDuracao.textContent = resumo.duracaoFormatada || this.manager.formatarDuracaoViagem(viagem);
      }
      if (this.dom.inputContatoSeguranca && !this.dom.inputContatoSeguranca.value) {
        const contato = this.manager.getContatoSeguranca();
        if (contato) this.dom.inputContatoSeguranca.value = contato;
      }

      const btnParada = document.getElementById('btn-iniciar-parada');
      if (btnParada) {
        const emParada = Boolean(viagem.paradaAtivaId);
        btnParada.textContent = emParada ? 'Finalizar Parada' : 'Iniciar Parada';
        this._paradaAtiva = emParada;
      }
    }

    /** Exibe modal de alerta após 5 min parado. */
    exibirAlertaParada() {
      this._openModal(this.dom.modalAlertaParada);
    }

    async _handleIniciarParada() {
      const viagem = this.manager.getViagemAtiva();
      if (!viagem) return;

      if (this._paradaAtiva) {
        this.manager.finalizarParada(viagem.id);
        this.showToast('Parada finalizada.');
        this.renderDashboard();
        return;
      }

      const motivo = prompt('Motivo da parada (ex: Almoço, Descanso):', 'Almoço') || 'Parada';
      let coords = null;
      try {
        coords = await this.viagemMonitor?.obterPosicaoAtual()
          || await global.RotaInteligente.geo.capturarCoordenadas();
      } catch { /* segue sem coords */ }

      const result = this.manager.iniciarParada(viagem.id, motivo, coords);
      if (result.sucesso) {
        this.showToast(`Parada iniciada: ${motivo}`);
        this.renderDashboard();
      }
    }

    async _handleEnviarRastreio() {
      const viagem = this.manager.getViagemAtiva();
      if (!viagem) return;

      const telefone = this.dom.inputContatoSeguranca?.value;
      if (telefone) this.manager.salvarContatoSeguranca(telefone);

      const pos = await this.viagemMonitor?.obterPosicaoAtual();
      const link = this.manager.gerarLinkRastreioWhatsapp(viagem.id, pos);

      if (!link.sucesso) {
        this.showToast(link.erro, 'error');
        return;
      }

      window.open(link.url, '_blank', 'noopener,noreferrer');
      this.showToast('WhatsApp aberto com atualização de rota!');
    }

    _handleContinuarViagem() {
      const viagem = this.manager.getViagemAtiva();
      if (viagem) this.manager.confirmarContinuarViagem(viagem.id);
      this._closeModal(this.dom.modalAlertaParada);
      this.showToast('Viagem continuada. Boa estrada!');
    }

    async _handleViagemInstantanea(e) {
      e.preventDefault();

      const nome = document.getElementById('input-nome-instantanea')?.value;
      const veiculo = document.getElementById('select-veiculo-instantanea')?.value;
      const destino = document.getElementById('input-destino-instantanea')?.value;
      const kmInicial = document.getElementById('input-km-instantanea')?.value;

      let coordenadaInicio = null;
      try {
        coordenadaInicio = await global.RotaInteligente.geo.capturarCoordenadas(true);
      } catch {
        coordenadaInicio = this.manager.getLocalFrequente('casa');
      }

      const result = this.manager.criarViagemInstantanea({
        nome,
        veiculo,
        kmInicial,
        destino,
        coordenadaInicio,
      });

      if (!result.sucesso) {
        this.showToast(result.erro, 'error');
        return;
      }

      this._closeModal(this.dom.modalInstantanea);
      this.dom.formInstantanea?.reset();

      result.avisos?.forEach((a) => this.showToast(a, 'error'));
      this.showToast(`Viagem instantânea "${result.viagem.nome}" iniciada!`);
      this.onViagemIniciada(result.viagem.id);
      this.onNavigate('lancamento');
    }

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

    renderHistorico() {
      /* delegado ao HistoricoController */
    }

    _handleNovaViagem(e) {
      e.preventDefault();

      const nome = document.getElementById('input-nome-viagem')?.value;
      const veiculo = document.getElementById('select-veiculo')?.value;
      const kmInicial = document.getElementById('input-km-inicial')?.value;
      const tanqueSaiuCheio = document.getElementById('input-tanque-saiu-cheio')?.checked ?? true;
      const tipoRota = document.getElementById('select-tipo-rota')?.value || 'direta';
      const trajetoId = document.getElementById('select-trajeto-curado')?.value;

      const result = this.manager.criarViagem({
        nome,
        veiculo,
        kmInicial,
        tanqueSaiuCheio,
        tipoRota,
        trajetoId,
        preferenciasTags: this._obterTagsSelecionadas(),
      });

      if (!result.sucesso) {
        this.showToast(result.erro, 'error');
        return;
      }

      this._closeModal(this.dom.modalNovaViagem);
      this.dom.formNovaViagem?.reset();
      if (document.getElementById('input-tanque-saiu-cheio')) {
        document.getElementById('input-tanque-saiu-cheio').checked = true;
      }

      const msgRota = result.viagem.planejamento?.timeline?.length
        ? `Guia de bordo ativo: ${result.viagem.destino}!`
        : `Viagem "${result.viagem.nome}" iniciada!`;
      this.showToast(msgRota);
      this.onViagemIniciada(result.viagem.id);
      this.onNavigate('lancamento');
    }

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
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.DashController = DashController;
})(window);
