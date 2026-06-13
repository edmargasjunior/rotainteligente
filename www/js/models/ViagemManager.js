/**
 * @file ViagemManager.js
 * @description Camada Model — persistência localStorage e motor de regras de negócio.
 *
 * Gerencia o ciclo de vida de viagens e gastos, executa cálculos puros de métricas
 * (KM/L, custo por diária, custo por KM) e formata reviews para Google Maps.
 * Não possui dependência de DOM — apenas dados e localStorage.
 *
 * @module models/ViagemManager
 * @dependencies ../utils/formatters.js
 */

import { parseNumeroBR, parseInteiroBR } from '../utils/formatters.js';

/** @constant {string} Chave única no localStorage. */
export const STORAGE_KEY = 'rota_inteligente_data';

/** @constant {string[]} Categorias válidas de gasto. */
export const CATEGORIAS = ['Combustível', 'Alimentação', 'Hospedagem', 'Pedágio', 'Outros'];

/** @constant {string[]} Perfis válidos para avaliação de local. */
export const PERFIS_AVALIACAO = ['Família', 'Casal', 'Solo', 'Trabalho'];

/**
 * Classe Model responsável por persistência e regras de negócio de viagens.
 */
export class ViagemManager {
  /**
   * @param {string} [storageKey=STORAGE_KEY] - Chave do localStorage.
   */
  constructor(storageKey = STORAGE_KEY) {
    this.storageKey = storageKey;
    /** @type {{ viagens: Array<Object> }} */
    this._data = this._carregar();
  }

  /**
   * Carrega JSON do localStorage ou retorna estrutura vazia.
   * @private
   * @returns {{ viagens: Array<Object> }}
   */
  _carregar() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return { viagens: [] };
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.viagens)) return { viagens: [] };
      return parsed;
    } catch {
      return { viagens: [] };
    }
  }

  /**
   * Persiste estado atual no localStorage.
   * @private
   * @returns {void}
   */
  _salvar() {
    localStorage.setItem(this.storageKey, JSON.stringify(this._data));
  }

  /**
   * Gera identificador único.
   * @private
   * @returns {string}
   */
  _gerarId() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * @returns {Array<Object>} Cópia da lista de viagens.
   */
  listarViagens() {
    return [...this._data.viagens];
  }

  /**
   * @returns {Object|null} Primeira viagem com status `"ativa"`.
   */
  getViagemAtiva() {
    return this._data.viagens.find((v) => v.status === 'ativa') || null;
  }

  /**
   * @param {string} id - ID da viagem.
   * @returns {Object|null} Viagem encontrada ou null.
   */
  getViagemPorId(id) {
    return this._data.viagens.find((v) => v.id === id) || null;
  }

  /**
   * Define viagem ativa como contexto principal.
   * @param {string} id - ID da viagem ativa.
   * @returns {boolean} Sucesso da operação.
   */
  definirViagemAtiva(id) {
    const alvo = this.getViagemPorId(id);
    if (!alvo || alvo.status !== 'ativa') return false;

    this._data.viagens.forEach((v) => {
      if (v.status === 'ativa' && v.id !== id) v.status = 'encerrada';
    });
    this._salvar();
    return true;
  }

  /**
   * Cria nova viagem ativa (encerra outras ativas automaticamente).
   *
   * @param {Object} dados - Dados da viagem.
   * @param {string} dados.nome - Nome da viagem.
   * @param {'carro'|'moto'} dados.veiculo - Tipo de veículo.
   * @param {string|number} dados.kmInicial - KM inicial (aceita formato BR).
   * @returns {{ sucesso: boolean, viagem?: Object, erro?: string }}
   */
  criarViagem({ nome, veiculo, kmInicial }) {
    const km = parseNumeroBR(kmInicial);
    if (!nome?.trim()) return { sucesso: false, erro: 'Informe o nome da viagem.' };
    if (!['carro', 'moto'].includes(veiculo)) return { sucesso: false, erro: 'Veículo inválido.' };
    if (km === null || km < 0) return { sucesso: false, erro: 'KM inicial inválido.' };

    this._data.viagens.forEach((v) => {
      if (v.status === 'ativa') v.status = 'encerrada';
    });

    const viagem = {
      id: this._gerarId(),
      nome: nome.trim(),
      veiculo,
      status: 'ativa',
      kmInicial: km,
      kmFinal: null,
      gastos: [],
    };

    this._data.viagens.push(viagem);
    this._salvar();
    return { sucesso: true, viagem };
  }

  /**
   * Encerra viagem informando KM final da garagem.
   *
   * @param {string} viagemId - ID da viagem.
   * @param {string|number} kmFinal - KM final (aceita formato BR).
   * @returns {{ sucesso: boolean, viagem?: Object, erro?: string }}
   */
  encerrarViagem(viagemId, kmFinal) {
    const viagem = this.getViagemPorId(viagemId);
    if (!viagem) return { sucesso: false, erro: 'Viagem não encontrada.' };
    if (viagem.status !== 'ativa') return { sucesso: false, erro: 'Viagem já encerrada.' };

    const km = parseNumeroBR(kmFinal);
    if (km === null || km < viagem.kmInicial) {
      return { sucesso: false, erro: 'KM final deve ser maior ou igual ao KM inicial.' };
    }

    viagem.kmFinal = km;
    viagem.status = 'encerrada';
    this._salvar();
    return { sucesso: true, viagem };
  }

  /**
   * Adiciona gasto à viagem ativa ou à viagem informada.
   *
   * @param {Object} gasto - Payload do gasto (valores ainda em string BR).
   * @param {string} [viagemId=null] - ID opcional da viagem alvo.
   * @returns {{ sucesso: boolean, gasto?: Object, erro?: string }}
   */
  adicionarGasto(gasto, viagemId = null) {
    const viagem = viagemId ? this.getViagemPorId(viagemId) : this.getViagemAtiva();
    if (!viagem) return { sucesso: false, erro: 'Nenhuma viagem ativa encontrada.' };
    if (viagem.status !== 'ativa') return { sucesso: false, erro: 'Viagem encerrada não aceita novos gastos.' };

    const valorTotal = parseNumeroBR(gasto.valorTotal);
    if (valorTotal === null || valorTotal <= 0) {
      return { sucesso: false, erro: 'Valor total inválido.' };
    }
    if (!CATEGORIAS.includes(gasto.categoria)) {
      return { sucesso: false, erro: 'Categoria inválida.' };
    }

    const novoGasto = {
      id: this._gerarId(),
      categoria: gasto.categoria,
      valorTotal,
      data: gasto.data || new Date().toISOString(),
      localizacao: {
        nome: gasto.localizacao?.nome?.trim() || 'Local não informado',
        lat: parseNumeroBR(gasto.localizacao?.lat) ?? 0,
        lng: parseNumeroBR(gasto.localizacao?.lng) ?? 0,
      },
      detalhes: this._montarDetalhes(gasto.categoria, gasto.detalhes || {}),
    };

    if (gasto.avaliacao) {
      novoGasto.avaliacao = this._montarAvaliacao(gasto.avaliacao);
    }

    viagem.gastos.push(novoGasto);
    this._salvar();
    return { sucesso: true, gasto: novoGasto };
  }

  /**
   * Remove gasto de uma viagem.
   *
   * @param {string} viagemId - ID da viagem.
   * @param {string} gastoId - ID do gasto.
   * @returns {{ sucesso: boolean, erro?: string }}
   */
  excluirGasto(viagemId, gastoId) {
    const viagem = this.getViagemPorId(viagemId);
    if (!viagem) return { sucesso: false, erro: 'Viagem não encontrada.' };

    const idx = viagem.gastos.findIndex((g) => g.id === gastoId);
    if (idx === -1) return { sucesso: false, erro: 'Gasto não encontrado.' };

    viagem.gastos.splice(idx, 1);
    this._salvar();
    return { sucesso: true };
  }

  /**
   * Monta nó `detalhes` conforme categoria do gasto.
   * @private
   * @param {string} categoria - Categoria do gasto.
   * @param {Object} detalhes - Detalhes brutos do formulário.
   * @returns {Object} Detalhes normalizados com floats/inteiros.
   */
  _montarDetalhes(categoria, detalhes) {
    const base = {};

    if (categoria === 'Combustível') {
      if (detalhes.tipoCombustivel) base.tipoCombustivel = String(detalhes.tipoCombustivel);
      const litros = parseNumeroBR(detalhes.litros);
      const precoLitro = parseNumeroBR(detalhes.precoLitro);
      const kmAtual = parseNumeroBR(detalhes.kmAtual);
      if (litros !== null) base.litros = litros;
      if (precoLitro !== null) base.precoLitro = precoLitro;
      if (kmAtual !== null) base.kmAtual = kmAtual;
      if (typeof detalhes.tanqueCheio === 'boolean') base.tanqueCheio = detalhes.tanqueCheio;
    }

    if (categoria === 'Hospedagem') {
      const diarias = parseInteiroBR(detalhes.diarias);
      if (diarias !== null && diarias > 0) base.diarias = diarias;
    }

    if (categoria === 'Alimentação') {
      const pessoas = parseInteiroBR(detalhes.quantidadePessoas);
      if (pessoas !== null && pessoas > 0) base.quantidadePessoas = pessoas;
    }

    return base;
  }

  /**
   * Monta e valida nó `avaliacao`.
   * @private
   * @param {Object} avaliacao - Dados de avaliação do formulário.
   * @returns {Object} Avaliação normalizada.
   */
  _montarAvaliacao(avaliacao) {
    const estrelas = parseInteiroBR(avaliacao.estrelas);
    return {
      estrelas: estrelas !== null ? Math.min(5, Math.max(1, estrelas)) : 5,
      perfil: PERFIS_AVALIACAO.includes(avaliacao.perfil) ? avaliacao.perfil : 'Solo',
      comentario: String(avaliacao.comentario || '').trim(),
      revisado: false,
    };
  }

  /**
   * Filtra gastos por categoria.
   * @param {Object} viagem - Objeto viagem.
   * @param {string} categoria - Nome da categoria.
   * @returns {Array<Object>} Gastos filtrados.
   */
  getGastosPorCategoria(viagem, categoria) {
    if (!viagem?.gastos) return [];
    return viagem.gastos.filter((g) => g.categoria === categoria);
  }

  /**
   * Total geral: soma de todos os gastos.
   * @param {Object} viagem - Objeto viagem.
   * @returns {number} Soma total.
   */
  calcularTotalGeral(viagem) {
    if (!viagem?.gastos?.length) return 0;
    return viagem.gastos.reduce((acc, g) => acc + (g.valorTotal || 0), 0);
  }

  /**
   * Consumo médio KM/L — (kmFinal - kmInicial) / Σ litros.
   * @param {Object} viagem - Objeto viagem.
   * @returns {number|null} KM/L ou null se indeterminável.
   */
  calcularConsumoMedio(viagem) {
    if (!viagem) return null;

    const kmFinal = viagem.kmFinal ?? this._inferirKmFinal(viagem);
    const distancia = kmFinal - viagem.kmInicial;
    if (distancia <= 0) return null;

    const litrosTotal = this.getGastosPorCategoria(viagem, 'Combustível').reduce(
      (acc, g) => acc + (g.detalhes?.litros || 0),
      0
    );

    if (litrosTotal <= 0) return null;
    return distancia / litrosTotal;
  }

  /**
   * Custo por diária — Σ hospedagem / Σ diárias.
   * @param {Object} viagem - Objeto viagem.
   * @returns {number|null} Custo médio por diária.
   */
  calcularCustoDiaria(viagem) {
    const hospedagens = this.getGastosPorCategoria(viagem, 'Hospedagem');
    const totalValor = hospedagens.reduce((acc, g) => acc + g.valorTotal, 0);
    const totalDiarias = hospedagens.reduce((acc, g) => acc + (g.detalhes?.diarias || 0), 0);
    if (totalDiarias <= 0) return null;
    return totalValor / totalDiarias;
  }

  /**
   * Alimentação per capita — Σ alimentação / Σ pessoas.
   * @param {Object} viagem - Objeto viagem.
   * @returns {number|null} Custo médio per capita.
   */
  calcularAlimentacaoPerCapita(viagem) {
    const alimentacao = this.getGastosPorCategoria(viagem, 'Alimentação');
    const totalValor = alimentacao.reduce((acc, g) => acc + g.valorTotal, 0);
    const totalPessoas = alimentacao.reduce(
      (acc, g) => acc + (g.detalhes?.quantidadePessoas || 0),
      0
    );
    if (totalPessoas <= 0) return null;
    return totalValor / totalPessoas;
  }

  /**
   * Custo de deslocamento por KM — (combustível + pedágios) / distância.
   * @param {Object} viagem - Objeto viagem.
   * @returns {number|null} Custo por KM.
   */
  calcularCustoPorKm(viagem) {
    if (!viagem) return null;

    const kmFinal = viagem.kmFinal ?? this._inferirKmFinal(viagem);
    const distancia = kmFinal - viagem.kmInicial;
    if (distancia <= 0) return null;

    const combustivel = this.getGastosPorCategoria(viagem, 'Combustível').reduce(
      (acc, g) => acc + g.valorTotal,
      0
    );
    const pedagios = this.getGastosPorCategoria(viagem, 'Pedágio').reduce(
      (acc, g) => acc + g.valorTotal,
      0
    );

    return (combustivel + pedagios) / distancia;
  }

  /**
   * Infere KM final pelo maior kmAtual em abastecimentos.
   * @private
   * @param {Object} viagem - Objeto viagem.
   * @returns {number} KM final inferido.
   */
  _inferirKmFinal(viagem) {
    const kms = this.getGastosPorCategoria(viagem, 'Combustível')
      .map((g) => g.detalhes?.kmAtual)
      .filter((km) => typeof km === 'number' && km > 0);

    if (kms.length === 0) return viagem.kmInicial;
    return Math.max(...kms);
  }

  /**
   * Agrupa valores totais por categoria (gráfico de rosca).
   * @param {Object} viagem - Objeto viagem.
   * @returns {Object<string, number>} Mapa categoria → valor.
   */
  getDistribuicaoPorCategoria(viagem) {
    const mapa = {};
    CATEGORIAS.forEach((cat) => { mapa[cat] = 0; });

    if (!viagem?.gastos) return mapa;

    viagem.gastos.forEach((g) => {
      if (mapa[g.categoria] !== undefined) {
        mapa[g.categoria] += g.valorTotal;
      }
    });

    return mapa;
  }

  /**
   * Resumo consolidado da viagem para o Dashboard.
   * @param {Object|null} viagem - Viagem ativa ou null.
   * @returns {Object} Objeto com todas as métricas calculadas.
   */
  getResumoViagem(viagem) {
    if (!viagem) {
      return {
        totalGeral: 0,
        consumoMedio: null,
        custoDiaria: null,
        alimentacaoPerCapita: null,
        custoPorKm: null,
        distanciaPercorrida: 0,
        distribuicao: {},
      };
    }

    const kmFinal = viagem.kmFinal ?? this._inferirKmFinal(viagem);

    return {
      totalGeral: this.calcularTotalGeral(viagem),
      consumoMedio: this.calcularConsumoMedio(viagem),
      custoDiaria: this.calcularCustoDiaria(viagem),
      alimentacaoPerCapita: this.calcularAlimentacaoPerCapita(viagem),
      custoPorKm: this.calcularCustoPorKm(viagem),
      distanciaPercorrida: Math.max(0, kmFinal - viagem.kmInicial),
      distribuicao: this.getDistribuicaoPorCategoria(viagem),
    };
  }

  /**
   * Retorna gastos com avaliação de viagens encerradas.
   * @param {string|null} [viagemId=null] - Filtrar por viagem específica.
   * @returns {Array<{ viagem: Object, gasto: Object }>} Lista ordenada por data desc.
   */
  getGastosComAvaliacao(viagemId = null) {
    const viagens = viagemId
      ? [this.getViagemPorId(viagemId)].filter(Boolean)
      : this._data.viagens.filter((v) => v.status === 'encerrada');

    const resultado = [];

    viagens.forEach((viagem) => {
      viagem.gastos
        .filter((g) => g.avaliacao)
        .forEach((gasto) => resultado.push({ viagem, gasto }));
    });

    return resultado.sort(
      (a, b) => new Date(b.gasto.data) - new Date(a.gasto.data)
    );
  }

  /**
   * Formata avaliação polida para colar no Google Maps.
   * @param {Object} gasto - Objeto gasto com nó avaliacao.
   * @returns {string} Texto formatado para review.
   */
  formatarReviewGoogleMaps(gasto) {
    const { avaliacao, localizacao, categoria } = gasto;
    if (!avaliacao) return '';

    const estrelas = '★'.repeat(avaliacao.estrelas) + '☆'.repeat(5 - avaliacao.estrelas);
    const linhas = [
      `${estrelas} (${avaliacao.estrelas}/5)`,
      `Local: ${localizacao?.nome || 'Não informado'}`,
      `Categoria: ${categoria}`,
      `Perfil da viagem: ${avaliacao.perfil}`,
    ];

    if (avaliacao.comentario) {
      linhas.push('', avaliacao.comentario);
    }

    linhas.push('', '— Avaliação via RotaInteligente 🧭');
    return linhas.join('\n');
  }

  /**
   * Marca avaliação como revisada/publicada.
   * @param {string} viagemId - ID da viagem.
   * @param {string} gastoId - ID do gasto.
   * @returns {void}
   */
  marcarAvaliacaoRevisada(viagemId, gastoId) {
    const viagem = this.getViagemPorId(viagemId);
    const gasto = viagem?.gastos.find((g) => g.id === gastoId);
    if (gasto?.avaliacao) {
      gasto.avaliacao.revisado = true;
      this._salvar();
    }
  }
}
