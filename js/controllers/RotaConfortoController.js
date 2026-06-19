/**
 * @file RotaConfortoController.js
 * @description Fachada UI do módulo Slow Travel — delega ao Curador de Trajetos no ViagemManager.
 * Exposto em window.RotaInteligente.RotaConfortoController
 */

(function (global) {
  'use strict';

  const TIPOS_ROTA = {
    DIRETA: 'direta',
    CONFORTO: 'conforto',
  };

  class RotaConfortoController {
    static _curador() {
      return global.RotaInteligente.CuradorTrajetos;
    }

    static listarTiposRota() {
      return [TIPOS_ROTA.DIRETA, TIPOS_ROTA.CONFORTO];
    }

    static listarTrajetosCurados() {
      return RotaConfortoController._curador()?.listar() || [];
    }

    /**
     * Gera planejamento com timeline via Curador de Trajetos.
     *
     * @param {'direta'|'conforto'} tipoRota
     * @param {Object} [params]
     * @param {string} [params.trajetoId]
     * @param {string} [params.origem]
     * @param {string} [params.destino]
     */
    static gerarPlanejamento(tipoRota, params = {}) {
      const curador = RotaConfortoController._curador();
      if (!curador) {
        return {
          tipoRota: tipoRota === TIPOS_ROTA.CONFORTO ? TIPOS_ROTA.CONFORTO : TIPOS_ROTA.DIRETA,
          tempoEstimadoAdicionalMinutos: 0,
          timeline: [],
          paradasSugeridas: [],
        };
      }

      const planejamento = curador.planejar(tipoRota, params);
      if (planejamento) return planejamento;

      const tipo = tipoRota === TIPOS_ROTA.CONFORTO ? TIPOS_ROTA.CONFORTO : TIPOS_ROTA.DIRETA;
      return {
        tipoRota: tipo,
        tempoEstimadoAdicionalMinutos: 0,
        timeline: [],
        paradasSugeridas: [],
        resumo: {
          foco: tipo === TIPOS_ROTA.CONFORTO ? 'Slow Travel' : 'Menor tempo e distância',
          origem: params.origem || 'Origem não informada',
          destino: params.destino || 'Destino não informado',
        },
      };
    }

    static compararOpcoes(trajetoId) {
      const curador = RotaConfortoController._curador();
      if (!curador) return null;
      return curador.comparar(trajetoId);
    }
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.RotaConfortoController = RotaConfortoController;
  global.RotaInteligente.TIPOS_ROTA = TIPOS_ROTA;
})(window);
