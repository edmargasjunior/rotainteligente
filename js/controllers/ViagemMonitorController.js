/**
 * @file ViagemMonitorController.js
 * @description Monitoramento GPS em segundo plano — velocidade, breakpoint e auto-close.
 * Usa watchPosition + timestamps absolutos (sem setInterval para lógica crítica).
 * Exposto em window.RotaInteligente.ViagemMonitorController
 */

(function (global) {
  'use strict';

  class ViagemMonitorController {
    /**
     * @param {import('../models/ViagemManager.js').ViagemManager} manager
     * @param {Object} callbacks
     * @param {function(string, 'success'|'error'=): void} callbacks.showToast
     * @param {function(): void} callbacks.onAlertaParada
     * @param {function(string): void} callbacks.onAutoEncerrar
     */
    constructor(manager, { showToast, onAlertaParada, onAutoEncerrar }) {
      this.manager = manager;
      this.showToast = showToast;
      this.onAlertaParada = onAlertaParada || (() => {});
      this.onAutoEncerrar = onAutoEncerrar || (() => {});

      this._gps = new global.RotaInteligente.geo.GpsMonitor();
      this._viagemIdAtiva = null;

      this._onVisibility = () => this._revalidarEstado();
      this._onFocus = () => this._revalidarEstado();
    }

    /**
     * Inicia monitoramento da viagem ativa.
     * @param {string} [viagemId]
     */
    iniciar(viagemId) {
      const viagem = viagemId
        ? this.manager.getViagemPorId(viagemId)
        : this.manager.getViagemAtiva();

      if (!viagem || viagem.status !== 'ativa') {
        this.parar();
        return;
      }

      this._viagemIdAtiva = viagem.id;

      const ok = this._gps.iniciar((pos) => this._processarPosicao(pos));
      if (!ok) {
        this.showToast('GPS indisponível — monitoramento de parada limitado.', 'error');
      }

      document.addEventListener('visibilitychange', this._onVisibility);
      window.addEventListener('focus', this._onFocus);

      this.manager.configurarServicoBackground();
    }

    /** Para watchPosition e listeners. */
    parar() {
      this._gps.parar();
      this._viagemIdAtiva = null;
      document.removeEventListener('visibilitychange', this._onVisibility);
      window.removeEventListener('focus', this._onFocus);
    }

    /**
     * Revalida breakpoints ao retornar do background (tela bloqueada).
     * @private
     */
    _revalidarEstado() {
      if (!this._viagemIdAtiva) return;

      const pos = this._gps.getUltimaPosicao();
      const velocidade = pos?.velocidadeKmh ?? 0;
      this._avaliarBreakpoint(velocidade);
    }

    /**
     * @private
     * @param {Object} pos
     */
    _processarPosicao(pos) {
      if (!this._viagemIdAtiva) return;

      this.manager.processarAtualizacaoGps(this._viagemIdAtiva, pos, false);
      this._avaliarBreakpoint(pos.velocidadeKmh ?? 0);
    }

    /**
     * @private
     * @param {number} velocidadeKmh
     */
    _avaliarBreakpoint(velocidadeKmh) {
      const estado = this.manager.verificarBreakpointInatividade(
        this._viagemIdAtiva,
        velocidadeKmh
      );

      if (estado.precisaAlerta) {
        this._emitirAlertaSonoro();
        this.onAlertaParada(this._viagemIdAtiva);
      }

      if (estado.precisaAutoEncerrar) {
        this.onAutoEncerrar(this._viagemIdAtiva);
        this.parar();
      }
    }

    /** Alerta sonoro simples via Web Audio API. */
    _emitirAlertaSonoro() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = 440;
        gain.gain.value = 0.15;
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      } catch {
        /* silencioso se áudio bloqueado */
      }
    }

    /**
     * Obtém posição atual para compartilhamento (sem throttle).
     * @returns {Promise<Object|null>}
     */
    async obterPosicaoAtual() {
      const ultima = this._gps.getUltimaPosicao();
      if (ultima) return ultima;

      try {
        return await global.RotaInteligente.geo.capturarCoordenadas();
      } catch {
        return null;
      }
    }
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.ViagemMonitorController = ViagemMonitorController;
})(window);
