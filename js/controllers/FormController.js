/**
 * @file FormController.js
 * @description Controller da aba Lançamento — formulário dinâmico e persistência de gastos.
 * Exposto em window.RotaInteligente.FormController
 */

(function (global) {
  'use strict';

  const { parseNumeroBR, formatarNumeroBR } = global.RotaInteligente.formatters;
  const { capturarCoordenadas, formatarCoordenadas } = global.RotaInteligente.geo;

  class FormController {
    constructor(manager, { showToast, onGastoSalvo, onAbrirNovaViagem, viagemMonitor }) {
      this.manager = manager;
      this.showToast = showToast;
      this.onGastoSalvo = onGastoSalvo;
      this.onAbrirNovaViagem = onAbrirNovaViagem;
      this.viagemMonitor = viagemMonitor;

      this.gpsCoords = { lat: null, lng: null };
      this.pedagioPracas = 0;
      this.estrelasSelecionadas = 5;
      this.perfilSelecionado = 'Família';

      this._cacheDom();
      this._bindEvents();
      this._initEstado();
    }

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

    _initEstado() {
      this._updateStars(5);
      this._toggleDynamicFields();
      this._updatePedagioContador();
    }

    renderEstado() {
      const semViagem = !this.manager.getViagemAtiva();
      this.dom.lancamentoSemViagem?.classList.toggle('hidden', !semViagem);
      this.dom.formGasto?.classList.toggle('hidden', semViagem);
    }

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

    _updatePedagioContador() {
      if (this.dom.pedagioContador) {
        this.dom.pedagioContador.textContent = `Praças acumuladas: ${this.pedagioPracas}`;
      }
    }

    _autoCalcCombustivel() {
      const litros = parseNumeroBR(document.getElementById('input-litros')?.value);
      const preco = parseNumeroBR(document.getElementById('input-preco-litro')?.value);

      if (litros !== null && preco !== null && litros > 0 && preco > 0 && this.dom.inputValor) {
        this.dom.inputValor.value = formatarNumeroBR(litros * preco);
      }
    }

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

    _updateStars(val) {
      this.estrelasSelecionadas = val;
      this.dom.starRating?.querySelectorAll('.star').forEach((star) => {
        star.classList.toggle('active', parseInt(star.dataset.value, 10) <= val);
      });
    }

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

      this._salvarGastoAsync(categoria);
    }

    /**
     * Salva gasto capturando GPS no momento do registro (gatilho de economia de bateria).
     * @private
     */
    async _salvarGastoAsync(categoria) {
      let coords = null;
      try {
        coords = await global.RotaInteligente.geo.capturarCoordenadas();
        this.gpsCoords.lat = coords.lat;
        this.gpsCoords.lng = coords.lng;
        if (this.dom.gpsStatus) {
          this.dom.gpsStatus.textContent = global.RotaInteligente.geo.formatarCoordenadas(coords);
          this.dom.gpsStatus.classList.add('captured');
        }
      } catch {
        /* usa coords já capturadas manualmente, se houver */
      }

      const gasto = {
        valorTotal: this.dom.inputValor?.value,
        categoria,
        localizacao: {
          nome: this.dom.inputLocal?.value,
          lat: this.gpsCoords.lat,
          lng: this.gpsCoords.lng,
        },
        detalhes: {},
        coordenadasGps: coords || (this.gpsCoords.lat ? {
          lat: this.gpsCoords.lat,
          lng: this.gpsCoords.lng,
          timestamp: Date.now(),
          velocidadeKmh: 0,
        } : null),
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

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.FormController = FormController;
})(window);
