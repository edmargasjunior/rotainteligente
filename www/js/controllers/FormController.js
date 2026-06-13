/**
 * @file FormController.js
 * @description Controller da aba Lançamento — formulário dinâmico e persistência de gastos.
 *
 * Gerencia campos condicionais por categoria, validação de inputs, captura GPS,
 * lançamento rápido de pedágios, seção de avaliação e submissão ao Model.
 *
 * @module controllers/FormController
 * @dependencies
 *   - ../models/ViagemManager.js (injetado via construtor)
 *   - ../utils/formatters.js
 *   - ../utils/geo.js
 */

import { parseNumeroBR, formatarNumeroBR } from '../utils/formatters.js';
import { capturarCoordenadas, formatarCoordenadas } from '../utils/geo.js';

/**
 * Controller do formulário de lançamento de gastos.
 */
export class FormController {
  /**
   * @param {import('../models/ViagemManager.js').ViagemManager} manager - Singleton do Model.
   * @param {Object} callbacks - Callbacks de comunicação com app.js.
   * @param {function(string, 'success'|'error'=): void} callbacks.showToast - Exibe toast.
   * @param {function(): void} callbacks.onGastoSalvo - Hook após salvar gasto com sucesso.
   * @param {function(): void} callbacks.onAbrirNovaViagem - Abre modal de nova viagem.
   */
  constructor(manager, { showToast, onGastoSalvo, onAbrirNovaViagem }) {
    this.manager = manager;
    this.showToast = showToast;
    this.onGastoSalvo = onGastoSalvo;
    this.onAbrirNovaViagem = onAbrirNovaViagem;

    /** @type {{ lat: number|null, lng: number|null }} */
    this.gpsCoords = { lat: null, lng: null };

    /** @type {number} Contador visual de praças de pedágio. */
    this.pedagioPracas = 0;

    /** @type {number} Estrelas selecionadas (1-5). */
    this.estrelasSelecionadas = 5;

    /** @type {string} Perfil de avaliação selecionado. */
    this.perfilSelecionado = 'Família';

    this._cacheDom();
    this._bindEvents();
    this._initEstado();
  }

  /**
   * Cacheia referências DOM do formulário.
   * @private
   * @returns {void}
   */
  _cacheDom() {
    this.dom = {
      lancamentoSemViagem: document.getElementById('lancamento-sem-viagem'),
      formGasto: document.getElementById('form-gasto'),
      inputValor: document.getElementById('input-valor'),
      inputLocal: document.getElementById('input-local'),
      btnGps: document.getElementById('btn-gps'),
      gpsStatus: document.getElementById('gps-status'),
      selectCategoria: document.getElementById('select-categoria'),
      fieldsCombustivel: document.getElementById('fields-combustivel'),
      fieldsHospedagem: document.getElementById('fields-hospedagem'),
      fieldsAlimentacao: document.getElementById('fields-alimentacao'),
      fieldsPedagio: document.getElementById('fields-pedagio'),
      pedagioContador: document.getElementById('pedagio-contador'),
      avaliacaoSection: document.getElementById('avaliacao-section'),
      inputAvaliar: document.getElementById('input-avaliar'),
      starRating: document.getElementById('star-rating'),
      perfilButtons: document.getElementById('perfil-buttons'),
      inputComentario: document.getElementById('input-comentario'),
    };
  }

  /**
   * Registra event listeners do formulário.
   * @private
   * @returns {void}
   */
  _bindEvents() {
    document.getElementById('btn-nova-viagem-lancamento')
      ?.addEventListener('click', () => this.onAbrirNovaViagem());

    this.dom.formGasto?.addEventListener('submit', (e) => this._handleSalvarGasto(e));
    this.dom.selectCategoria?.addEventListener('change', () => this._toggleDynamicFields());
    this.dom.btnGps?.addEventListener('click', () => this._handleGpsCapture());

    document.getElementById('input-litros')
      ?.addEventListener('input', () => this._autoCalcCombustivel());
    document.getElementById('input-preco-litro')
      ?.addEventListener('input', () => this._autoCalcCombustivel());

    this.dom.fieldsPedagio?.addEventListener('click', (e) => this._handlePedagioQuick(e));

    this.dom.inputAvaliar?.addEventListener('change', () => {
      if (this.dom.avaliacaoSection) {
        this.dom.avaliacaoSection.open = this.dom.inputAvaliar.checked;
      }
    });

    this.dom.starRating?.addEventListener('click', (e) => {
      const star = e.target.closest('.star');
      if (star) this._updateStars(parseInt(star.dataset.value, 10));
    });

    this.dom.perfilButtons?.addEventListener('click', (e) => {
      const btn = e.target.closest('.btn-perfil');
      if (!btn) return;
      this.perfilSelecionado = btn.dataset.perfil;
      this.dom.perfilButtons.querySelectorAll('.btn-perfil').forEach((b) => {
        b.classList.toggle('active', b === btn);
      });
    });
  }

  /**
   * Inicializa estado padrão do formulário.
   * @private
   * @returns {void}
   */
  _initEstado() {
    this._updateStars(5);
    this._toggleDynamicFields();
    this._updatePedagioContador();
  }

  /**
   * Atualiza visibilidade do formulário conforme existência de viagem ativa.
   * @returns {void}
   */
  renderEstado() {
    const semViagem = !this.manager.getViagemAtiva();
    this.dom.lancamentoSemViagem?.classList.toggle('hidden', !semViagem);
    this.dom.formGasto?.classList.toggle('hidden', semViagem);
  }

  /**
   * Alterna campos dinâmicos conforme categoria selecionada.
   * @private
   * @returns {void}
   */
  _toggleDynamicFields() {
    const cat = this.dom.selectCategoria?.value || '';

    this.dom.fieldsCombustivel?.classList.toggle('hidden', cat !== 'Combustível');
    this.dom.fieldsHospedagem?.classList.toggle('hidden', cat !== 'Hospedagem');
    this.dom.fieldsAlimentacao?.classList.toggle('hidden', cat !== 'Alimentação');
    this.dom.fieldsPedagio?.classList.toggle('hidden', cat !== 'Pedágio');

    if (cat !== 'Pedágio') {
      this.pedagioPracas = 0;
      this._updatePedagioContador();
    }
  }

  /**
   * Atualiza contador visual de praças de pedágio.
   * @private
   * @returns {void}
   */
  _updatePedagioContador() {
    if (this.dom.pedagioContador) {
      this.dom.pedagioContador.textContent = `Praças acumuladas: ${this.pedagioPracas}`;
    }
  }

  /**
   * Auto-preenche valor total = litros × preço/litro.
   * @private
   * @returns {void}
   */
  _autoCalcCombustivel() {
    const litros = parseNumeroBR(document.getElementById('input-litros')?.value);
    const preco = parseNumeroBR(document.getElementById('input-preco-litro')?.value);

    if (litros !== null && preco !== null && litros > 0 && preco > 0 && this.dom.inputValor) {
      this.dom.inputValor.value = formatarNumeroBR(litros * preco);
    }
  }

  /**
   * Captura coordenadas GPS via helper geo.js.
   * @private
   * @returns {Promise<void>}
   */
  async _handleGpsCapture() {
    if (this.dom.btnGps) this.dom.btnGps.disabled = true;
    if (this.dom.gpsStatus) this.dom.gpsStatus.textContent = 'Capturando coordenadas...';

    try {
      const coords = await capturarCoordenadas();
      this.gpsCoords.lat = coords.lat;
      this.gpsCoords.lng = coords.lng;

      if (this.dom.gpsStatus) {
        this.dom.gpsStatus.textContent = formatarCoordenadas(coords);
        this.dom.gpsStatus.classList.add('captured');
      }

      const msg = coords.simulado
        ? 'Coordenadas simuladas capturadas!'
        : 'Coordenadas GPS capturadas!';
      this.showToast(msg);
    } catch {
      this.showToast('Falha ao capturar coordenadas.', 'error');
      if (this.dom.gpsStatus) this.dom.gpsStatus.textContent = 'Coordenadas não capturadas';
    } finally {
      if (this.dom.btnGps) this.dom.btnGps.disabled = false;
    }
  }

  /**
   * Atualiza estrelas selecionadas na UI.
   * @private
   * @param {number} val - Quantidade de estrelas (1-5).
   * @returns {void}
   */
  _updateStars(val) {
    this.estrelasSelecionadas = val;
    this.dom.starRating?.querySelectorAll('.star').forEach((star) => {
      star.classList.toggle('active', parseInt(star.dataset.value, 10) <= val);
    });
  }

  /**
   * Reseta formulário ao estado inicial.
   * @private
   * @returns {void}
   */
  _resetForm() {
    this.dom.formGasto?.reset();
    this.gpsCoords = { lat: null, lng: null };
    this.pedagioPracas = 0;
    this.estrelasSelecionadas = 5;
    this.perfilSelecionado = 'Família';

    if (this.dom.gpsStatus) {
      this.dom.gpsStatus.textContent = 'Coordenadas não capturadas';
      this.dom.gpsStatus.classList.remove('captured');
    }

    if (this.dom.avaliacaoSection) this.dom.avaliacaoSection.open = false;
    if (this.dom.inputAvaliar) this.dom.inputAvaliar.checked = false;

    this.dom.perfilButtons?.querySelectorAll('.btn-perfil').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.perfil === 'Família');
    });

    this._updateStars(5);
    this._toggleDynamicFields();
    this._updatePedagioContador();
  }

  /**
   * Handler: botões rápidos de pedágio (+praças / ×valor).
   * @private
   * @param {MouseEvent} e - Evento de clique.
   * @returns {void}
   */
  _handlePedagioQuick(e) {
    const btn = e.target.closest('[data-pedagio]');
    if (!btn || !this.dom.inputValor) return;

    const action = btn.dataset.pedagio;
    const val = parseInt(btn.dataset.valor, 10);
    const valorAtual = parseNumeroBR(this.dom.inputValor.value) || 0;

    if (action === 'add') {
      this.pedagioPracas += val;
      const valorPadrao = parseNumeroBR('12,50') || 12.5;
      this.dom.inputValor.value = formatarNumeroBR(valorAtual + valorPadrao * val);
    } else if (action === 'mul') {
      this.dom.inputValor.value = formatarNumeroBR(valorAtual * val);
    }

    this._updatePedagioContador();
  }

  /**
   * Handler: submissão do formulário de gasto.
   * @private
   * @param {SubmitEvent} e - Evento de submit.
   * @returns {void}
   */
  _handleSalvarGasto(e) {
    e.preventDefault();

    if (!this.manager.getViagemAtiva()) {
      this.showToast('Inicie uma viagem antes de lançar gastos.', 'error');
      return;
    }

    const categoria = this.dom.selectCategoria?.value;
    if (!categoria) {
      this.showToast('Selecione uma categoria.', 'error');
      return;
    }

    /** @type {Object} */
    const gasto = {
      valorTotal: this.dom.inputValor?.value,
      categoria,
      localizacao: {
        nome: this.dom.inputLocal?.value,
        lat: this.gpsCoords.lat,
        lng: this.gpsCoords.lng,
      },
      detalhes: {},
    };

    if (categoria === 'Combustível') {
      gasto.detalhes = {
        tipoCombustivel: document.getElementById('input-tipo-combustivel')?.value,
        litros: document.getElementById('input-litros')?.value,
        precoLitro: document.getElementById('input-preco-litro')?.value,
        kmAtual: document.getElementById('input-km-atual')?.value,
        tanqueCheio: document.getElementById('input-tanque-cheio')?.checked,
      };
    }

    if (categoria === 'Hospedagem') {
      gasto.detalhes = { diarias: document.getElementById('input-diarias')?.value };
    }

    if (categoria === 'Alimentação') {
      gasto.detalhes = { quantidadePessoas: document.getElementById('input-pessoas')?.value };
    }

    if (this.dom.inputAvaliar?.checked) {
      gasto.avaliacao = {
        estrelas: this.estrelasSelecionadas,
        perfil: this.perfilSelecionado,
        comentario: this.dom.inputComentario?.value,
      };
    }

    const result = this.manager.adicionarGasto(gasto);

    if (!result.sucesso) {
      this.showToast(result.erro, 'error');
      return;
    }

    this.showToast('Gasto registrado com sucesso!');
    this._resetForm();
    this.onGastoSalvo();
  }
}
