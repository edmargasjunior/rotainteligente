/**
 * @file ViagemManager.js
 * @description Camada Model — persistência localStorage e motor de regras de negócio.
 * Exposto em window.RotaInteligente.ViagemManager
 */

(function (global) {
  'use strict';

  const { parseNumeroBR, parseInteiroBR } = global.RotaInteligente.formatters;

  const STORAGE_KEY = 'rota_inteligente_data';
  const CATEGORIAS = ['Combustível', 'Alimentação', 'Hospedagem', 'Pedágio', 'Outros'];
  const PERFIS_AVALIACAO = ['Família', 'Casal', 'Solo', 'Trabalho'];

  /** Tags de preferência para filtro do Curador de Trajetos. */
  const TAGS_PREFERENCIA = [
    'Espaço Recreativo Infantil',
    'Lareira/Conforto',
    'Pet Friendly',
    'Banheiros Premium',
    'Estacionamento Amplo',
    'Café Especial',
  ];

  /** 5 minutos parado — dispara alerta de breakpoint. */
  const MS_PARADA_ALERTA = 5 * 60 * 1000;

  /** 1 hora após alerta ignorado — encerramento automático. */
  const MS_AUTO_ENCERRAR = 60 * 60 * 1000;

  /** URL base para links de rastreio (GitHub Pages). */
  const TRACKING_BASE_URL = (typeof document !== 'undefined'
    && document.querySelector('meta[name="ri-tracking-base"]')?.content)
    || 'https://usuario.github.io/rotainteligente/';

  /**
   * Banco de dados simulado — Curador de Trajetos (Slow Travel).
   * Rotas consagradas com timeline quilométrica para guia de bordo pré-viagem.
   */
  const CURADOR_TRAJETOS = [
    {
      id: 'bh-juiz-de-fora',
      origem: 'Belo Horizonte',
      destino: 'Juiz de Fora',
      rotas: {
        direta: {
          tipo: 'direta',
          tempoEstimado: '3h 40min',
          distanciaTotal: '260km',
          tempoEstimadoAdicionalMinutos: 0,
          alerta: 'Rota mais rápida via BR-040. Poucas paradas — abasteça antes de sair.',
          timeline: [
            { km: 0, tipo: 'origem', titulo: 'Saída de Belo Horizonte', descricao: 'Pegue a BR-040 sentido Juiz de Fora. Marque o Check-in de Tanque Cheio no app!' },
            { km: 130, tipo: 'parada', titulo: 'Posto Ipiranga Matozinhos', descricao: '⛽ Única parada recomendada na rota direta. Abastecimento rápido e café expresso.' },
            { km: 260, tipo: 'destino', titulo: 'Chegada em Juiz de Fora', descricao: 'Fim do trajeto! Registre sua hospedagem no app.' },
          ],
        },
        conforto: {
          tipo: 'conforto',
          tempoEstimado: '4h 15min',
          distanciaTotal: '280km',
          tempoEstimadoAdicionalMinutos: 35,
          alerta: 'Pista segura, asfalto excelente. Adiciona 35 minutos ao trajeto padrão.',
          timeline: [
            { km: 0, tipo: 'origem', titulo: 'Saída de Belo Horizonte', descricao: 'Garanta que marcou o Check-in de Tanque Cheio no app!' },
            { km: 82, tipo: 'parada', titulo: 'Posto Graal Itambé', descricao: '☕ Recomendado para o 1º descanso. Banheiros limpos e excelente pão de queijo (Nota 4.6).', tags: ['Banheiros Premium', 'Café Especial'] },
            { km: 145, tipo: 'atracao', titulo: 'Mirante da Serra da Mantiqueira', descricao: '📸 Parada de 10 minutos para fotos da cordilheira. Vista espetacular.', tags: ['Estacionamento Amplo'] },
            { km: 210, tipo: 'restaurante', titulo: 'Restaurante Panela de Pedra', descricao: '🍽️ Almoço típico mineiro (Nota 4.7). Pratos fartos e preço justo.', tags: ['Espaço Recreativo Infantil', 'Estacionamento Amplo'] },
            { km: 280, tipo: 'destino', titulo: 'Chegada em Juiz de Fora', descricao: 'Fim do trajeto! Não esqueça de registrar sua hospedagem.' },
          ],
        },
      },
    },
    {
      id: 'bh-porto-seguro',
      origem: 'Belo Horizonte',
      destino: 'Porto Seguro',
      rotas: {
        direta: {
          tipo: 'direta',
          tempoEstimado: '10h 30min',
          distanciaTotal: '720km',
          tempoEstimadoAdicionalMinutos: 0,
          alerta: 'Trecho longo via BR-116 e BR-101. Planeje 2 abastecimentos e evite dirigir à noite na serra.',
          timeline: [
            { km: 0, tipo: 'origem', titulo: 'Saída de Belo Horizonte', descricao: 'BR-116 sentido Rio → BR-101 sul. Tanque cheio obrigatório!' },
            { km: 180, tipo: 'parada', titulo: 'Posto Shell Pedro Leopoldo', descricao: '⛽ 1ª parada estratégica. Café, banheiro e calibragem de pneus.' },
            { km: 420, tipo: 'parada', titulo: 'Graal Rio das Ostras', descricao: '⛽ 2ª parada antes do trecho litorâneo. Abasteça e descanse 20 min.' },
            { km: 720, tipo: 'destino', titulo: 'Chegada em Porto Seguro', descricao: 'Fim do trajeto! Aproveite a Bahia e registre os gastos da viagem.' },
          ],
        },
        conforto: {
          tipo: 'conforto',
          tempoEstimado: '12h 45min',
          distanciaTotal: '780km',
          tempoEstimadoAdicionalMinutos: 135,
          alerta: 'Slow Travel pelo Vale do Aço e costa histórica. Desvia de trechos com histórico de sinistros na BR-116 noturna.',
          timeline: [
            { km: 0, tipo: 'origem', titulo: 'Saída de Belo Horizonte', descricao: 'Saia cedo! Marque o Tanque Cheio e ative o guia de bordo no Dashboard.' },
            { km: 95, tipo: 'atracao', titulo: 'Inhotim (desvio opcional)', descricao: '🎨 Um dos maiores museus a céu aberto do mundo. Reserve 2h se for visitar (Nota 4.9).' },
            { km: 210, tipo: 'parada', titulo: 'Café da Estrada — Santana do Paraíso', descricao: '☕ Pausa premium com vista para o Vale do Aço (Nota 4.6).', tags: ['Café Especial', 'Banheiros Premium'] },
            { km: 340, tipo: 'restaurante', titulo: 'Restaurante Sabor do Campo', descricao: '🍽️ Almoço colonial mineiro (Nota 4.8). Ambiente familiar e estacionamento amplo.', tags: ['Espaço Recreativo Infantil', 'Estacionamento Amplo'] },
            { km: 480, tipo: 'atracao', titulo: 'Praia de Guarapari', descricao: '🏖️ Parada de 30 min na orla. Areias monazíticas e águas calmas — ótimo para crianças.' },
            { km: 590, tipo: 'parada', titulo: 'Pousada Recanto Verde — Linhares', descricao: '🏨 Hospedagem recomendada para pernoite (Nota 4.8). Jardim arborizado e café da manhã premiado.', tags: ['Lareira/Conforto', 'Pet Friendly'] },
            { km: 700, tipo: 'atracao', titulo: 'Trancoso — Centro Histórico', descricao: '📸 Quadrado mais charmoso do litoral sul da Bahia. Pôr do sol imperdível.' },
            { km: 780, tipo: 'destino', titulo: 'Chegada em Porto Seguro', descricao: 'Fim do trajeto curado! Registre hospedagem e avalie os locais visitados.' },
          ],
        },
      },
    },
  ];

  /**
   * Motor do Curador de Trajetos — resolve rotas curadas offline.
   */
  const CuradorTrajetos = {
    listar() {
      return CURADOR_TRAJETOS.map(({ id, origem, destino }) => ({ id, origem, destino }));
    },

    obterPorId(trajetoId) {
      return CURADOR_TRAJETOS.find((t) => t.id === trajetoId) || null;
    },

    _normalizar(texto) {
      return String(texto || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
    },

    resolver(trajetoId, origem, destino) {
      if (trajetoId) {
        const porId = this.obterPorId(trajetoId);
        if (porId) return porId;
      }

      const origemNorm = this._normalizar(origem);
      const destinoNorm = this._normalizar(destino);
      if (!origemNorm && !destinoNorm) return null;

      return CURADOR_TRAJETOS.find((t) => {
        const matchOrigem = !origemNorm || this._normalizar(t.origem).includes(origemNorm)
          || origemNorm.includes(this._normalizar(t.origem));
        const matchDestino = !destinoNorm || this._normalizar(t.destino).includes(destinoNorm)
          || destinoNorm.includes(this._normalizar(t.destino));
        return matchOrigem && matchDestino;
      }) || null;
    },

    _extrairParadasSugeridas(timeline) {
      return (timeline || [])
        .filter((p) => !['origem', 'destino'].includes(p.tipo))
        .map((p) => ({
          nome: p.titulo,
          tipo: CuradorTrajetos._labelTipo(p.tipo),
          km: p.km,
        }));
    },

    _labelTipo(tipo) {
      const mapa = {
        parada: 'Parada Recomendada',
        atracao: 'Atração Turística',
        restaurante: 'Restaurante Recomendado',
        origem: 'Origem',
        destino: 'Destino',
      };
      return mapa[tipo] || tipo;
    },

    montarPlanejamento(trajeto, tipoRota, preferenciasTags = []) {
      const tipo = tipoRota === 'conforto' ? 'conforto' : 'direta';
      const rota = trajeto?.rotas?.[tipo];
      if (!rota) return null;

      const timelineFiltrada = CuradorTrajetos.filtrarTimelinePorTags(
        rota.timeline.map((p) => ({ ...p })),
        preferenciasTags
      );

      return {
        trajetoId: trajeto.id,
        origem: trajeto.origem,
        destino: trajeto.destino,
        tipoRota: tipo,
        tempoEstimado: rota.tempoEstimado,
        distanciaTotal: rota.distanciaTotal,
        tempoEstimadoAdicionalMinutos: rota.tempoEstimadoAdicionalMinutos || 0,
        alerta: rota.alerta,
        preferenciasTags: [...preferenciasTags],
        timeline: timelineFiltrada,
        paradasSugeridas: CuradorTrajetos._extrairParadasSugeridas(timelineFiltrada),
        resumo: {
          foco: tipo === 'conforto'
            ? 'Slow Travel — asfalto, segurança e turismo'
            : 'Menor tempo e distância',
          origem: trajeto.origem,
          destino: trajeto.destino,
          distanciaEstimadaKm: parseInt(rota.distanciaTotal, 10) || 0,
        },
      };
    },

    /**
     * Filtra timeline mantendo origem/destino e paradas com tags compatíveis.
     * @param {Array<Object>} timeline
     * @param {string[]} tagsSelecionadas
     */
    filtrarTimelinePorTags(timeline, tagsSelecionadas) {
      if (!tagsSelecionadas?.length) return timeline;
      return timeline.filter((p) => {
        if (['origem', 'destino'].includes(p.tipo)) return true;
        if (!p.tags?.length) return false;
        return tagsSelecionadas.some((t) => p.tags.includes(t));
      });
    },

    planejar(tipoRota, params = {}) {
      const trajeto = this.resolver(params.trajetoId, params.origem, params.destino);
      if (!trajeto) return null;
      return this.montarPlanejamento(trajeto, tipoRota, params.preferenciasTags || []);
    },

    comparar(trajetoId) {
      const trajeto = this.obterPorId(trajetoId);
      if (!trajeto) return null;
      return {
        direta: this.montarPlanejamento(trajeto, 'direta'),
        conforto: this.montarPlanejamento(trajeto, 'conforto'),
      };
    },
  };

  class ViagemManager {
    constructor(storageKey = STORAGE_KEY) {
      this.storageKey = storageKey;
      this._data = this._carregar();
    }

    _carregar() {
      try {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return { viagens: [], perfil: this._perfilPadrao() };
        const parsed = JSON.parse(raw);
        if (!parsed || !Array.isArray(parsed.viagens)) {
          return { viagens: [], perfil: this._perfilPadrao() };
        }
        if (!parsed.perfil) parsed.perfil = this._perfilPadrao();
        parsed.viagens.forEach((v) => this._migrarViagem(v));
        return parsed;
      } catch {
        return { viagens: [], perfil: this._perfilPadrao() };
      }
    }

    /**
     * Perfil do usuário com locais frequentes e contato de segurança.
     * @private
     */
    _perfilPadrao() {
      return {
        contatoSeguranca: '',
        locaisFrequentes: {
          casa: {
            nome: 'Residência',
            lat: -19.91668,
            lng: -43.93449,
          },
        },
      };
    }

    /**
     * Garante campos de viagens antigas no localStorage.
     * @private
     * @param {Object} viagem
     */
    _migrarViagem(viagem) {
      if (!viagem.timestampInicio) {
        viagem.timestampInicio = viagem.gastos?.[0]?.data
          ? new Date(viagem.gastos[0].data).getTime()
          : Date.now();
      }
      if (!viagem.monitoramento) {
        viagem.monitoramento = {
          timestampParadaInicio: null,
          timestampAlertaParada: null,
          alertaParadaExibido: false,
        };
      }
      if (!viagem.paradas) viagem.paradas = [];
      if (viagem.distanciaGpsKm === undefined) viagem.distanciaGpsKm = 0;
      if (!viagem.gpsRegistro) {
        viagem.gpsRegistro = { ultimoRegistroTimestamp: 0, distanciaDesdeUltimoRegistroKm: 0 };
      }
      if (!viagem.statusAtual) viagem.statusAtual = 'Em movimento';
      if (!viagem.modo) viagem.modo = viagem.trajetoId ? 'planejada' : 'planejada';
    }

    /**
     * Campos base de monitoramento/timestamps para nova viagem.
     * @private
     */
    _camposMonitoramentoViagem() {
      const agora = Date.now();
      return {
        timestampInicio: agora,
        timestampFim: null,
        timestampBreakpoint: null,
        distanciaGpsKm: 0,
        coordenadaInicio: null,
        ultimaPosicaoGps: null,
        gpsRegistro: { ultimoRegistroTimestamp: agora, distanciaDesdeUltimoRegistroKm: 0 },
        paradas: [],
        paradaAtivaId: null,
        monitoramento: {
          timestampParadaInicio: null,
          timestampAlertaParada: null,
          alertaParadaExibido: false,
        },
        statusAtual: 'Em movimento',
        contatoSeguranca: this._data.perfil?.contatoSeguranca || '',
        preferenciasTags: [],
        kmInicialEstimado: false,
        kmInicialFonte: 'manual',
        diarioBordo: [],
      };
    }

    _salvar() {
      localStorage.setItem(this.storageKey, JSON.stringify(this._data));
    }

    _gerarId() {
      return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }

    listarViagens() {
      return [...this._data.viagens];
    }

    getViagemAtiva() {
      return this._data.viagens.find((v) => v.status === 'ativa') || null;
    }

    getViagemPorId(id) {
      return this._data.viagens.find((v) => v.id === id) || null;
    }

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
     * Cria nova viagem ativa com planejamento de rota opcional.
     *
     * @param {Object} dados
     * @param {string} dados.nome
     * @param {'carro'|'moto'} dados.veiculo
     * @param {string|number} dados.kmInicial
     * @param {boolean} [dados.tanqueSaiuCheio=true] - Tanque cheio na saída da garagem.
     * @param {'direta'|'conforto'} [dados.tipoRota='direta'] - Tipo de planejamento.
     * @param {string} [dados.trajetoId] - ID do trajeto curado (Curador de Trajetos).
     * @param {string} [dados.origem] - Origem para resolver trajeto curado.
     * @param {string} [dados.destino] - Destino para resolver trajeto curado.
     */
    criarViagem({ nome, veiculo, kmInicial, tanqueSaiuCheio = true, tipoRota = 'direta', trajetoId, origem, destino, preferenciasTags = [] }) {
      const km = parseNumeroBR(kmInicial);
      if (!nome?.trim()) return { sucesso: false, erro: 'Informe o nome da viagem.' };
      if (!['carro', 'moto'].includes(veiculo)) return { sucesso: false, erro: 'Veículo inválido.' };
      if (km === null || km < 0) return { sucesso: false, erro: 'KM inicial inválido.' };

      this._data.viagens.forEach((v) => {
        if (v.status === 'ativa') v.status = 'encerrada';
      });

      const planejamento = this.planejarRota(tipoRota, { trajetoId, origem, destino, preferenciasTags });

      const viagem = {
        id: this._gerarId(),
        nome: nome.trim(),
        veiculo,
        modo: 'planejada',
        status: 'ativa',
        kmInicial: km,
        kmFinal: null,
        tanqueSaiuCheio: Boolean(tanqueSaiuCheio),
        trajetoId: planejamento?.trajetoId || trajetoId || null,
        origem: planejamento?.origem || origem?.trim() || null,
        destino: planejamento?.destino || destino?.trim() || null,
        gastos: [],
        planejamento,
        preferenciasTags: [...preferenciasTags],
        ...this._camposMonitoramentoViagem(),
      };

      this._data.viagens.push(viagem);
      this._salvar();
      return { sucesso: true, viagem };
    }

    /**
     * Viagem Instantânea — destino e KM inicial opcionais.
     *
     * @param {Object} dados
     * @param {string} dados.nome
     * @param {'carro'|'moto'} dados.veiculo
     * @param {string|number} [dados.kmInicial] - Opcional.
     * @param {string} [dados.destino] - Opcional.
     * @param {Object} [dados.coordenadaInicio] - Fallback GPS/Casa.
     * @returns {{ sucesso: boolean, viagem?: Object, avisos?: string[], erro?: string }}
     */
    criarViagemInstantanea({ nome, veiculo, kmInicial, destino, coordenadaInicio }) {
      if (!nome?.trim()) return { sucesso: false, erro: 'Informe o nome da viagem.' };
      if (!['carro', 'moto'].includes(veiculo)) return { sucesso: false, erro: 'Veículo inválido.' };

      const avisos = [];
      const kmInformado = kmInicial !== null && kmInicial !== undefined && String(kmInicial).trim() !== '';
      const destinoInformado = Boolean(destino?.trim());

      if (!kmInformado || !destinoInformado) {
        avisos.push(
          'Sem KM inicial ou destino, os relatórios de consumo e distância podem ficar imprecisos até você encerrar a viagem com o KM final do painel.'
        );
      }

      this._data.viagens.forEach((v) => {
        if (v.status === 'ativa') v.status = 'encerrada';
      });

      let km = kmInformado ? parseNumeroBR(kmInicial) : null;
      let kmInicialFonte = 'manual';
      let kmInicialEstimado = false;

      if (km === null) {
        const fallback = this.resolverKmInicialFallback(coordenadaInicio);
        km = fallback.km;
        kmInicialFonte = fallback.fonte;
        kmInicialEstimado = fallback.estimado;
        if (fallback.aviso) avisos.push(fallback.aviso);
      }

      const viagem = {
        id: this._gerarId(),
        nome: nome.trim(),
        veiculo,
        modo: 'instantanea',
        status: 'ativa',
        kmInicial: km,
        kmFinal: null,
        tanqueSaiuCheio: true,
        trajetoId: null,
        origem: null,
        destino: destino?.trim() || null,
        destinoInformado,
        kmInformado,
        gastos: [],
        planejamento: null,
        coordenadaInicio: coordenadaInicio || null,
        ...this._camposMonitoramentoViagem(),
        kmInicialFonte,
        kmInicialEstimado,
      };

      this._data.viagens.push(viagem);
      this._salvar();
      return { sucesso: true, viagem, avisos };
    }

    /**
     * Fallback de KM inicial: última viagem encerrada.
     * Coordenada de início vem do GPS ou da Residência (Casa).
     *
     * @param {Object|null} coordenadaGps - Coordenada capturada ou null.
     * @returns {{ km: number|null, fonte: string, estimado: boolean, coordenada: Object|null, aviso?: string }}
     */
    resolverKmInicialFallback(coordenadaGps) {
      let coordenada = coordenadaGps;
      let fonteCoord = 'gps';

      if (!coordenada) {
        coordenada = this.getLocalFrequente('casa');
        fonteCoord = 'casa';
      }

      const ultima = this.getUltimaViagemEncerrada();
      if (ultima?.kmFinal !== null && ultima?.kmFinal !== undefined) {
        return {
          km: ultima.kmFinal,
          fonte: fonteCoord === 'gps' ? 'ultima_viagem_gps' : 'ultima_viagem_casa',
          estimado: true,
          coordenada,
          aviso: `KM inicial assumido do encerramento da viagem "${ultima.nome}" (${ultima.kmFinal} km).`,
        };
      }

      return {
        km: null,
        fonte: fonteCoord,
        estimado: true,
        coordenada,
        aviso: 'Nenhum KM inicial disponível — a distância será medida pelo GPS até o encerramento.',
      };
    }

    /**
     * @returns {Object|null} Última viagem encerrada por timestampFim ou ordem.
     */
    getUltimaViagemEncerrada() {
      const encerradas = this._data.viagens
        .filter((v) => v.status === 'encerrada')
        .sort((a, b) => (b.timestampFim || 0) - (a.timestampFim || 0));
      return encerradas[0] || null;
    }

    /**
     * @param {'casa'} tipo
     * @returns {{ nome: string, lat: number, lng: number }|null}
     */
    getLocalFrequente(tipo) {
      return this._data.perfil?.locaisFrequentes?.[tipo] || null;
    }

    /**
     * @returns {string[]}
     */
    listarTagsPreferencia() {
      return [...TAGS_PREFERENCIA];
    }

    /**
     * Calcula duração em ms via timestamps absolutos (resiliente a tela bloqueada).
     * @param {number} timestampInicio
     * @param {number|null} [timestampFim]
     * @returns {number}
     */
    calcularDuracaoMs(timestampInicio, timestampFim = null) {
      if (!timestampInicio) return 0;
      const fim = timestampFim ?? Date.now();
      return Math.max(0, fim - timestampInicio);
    }

    /**
     * Duração efetiva da viagem — desconta período após breakpoint se auto-encerrada.
     * @param {Object} viagem
     * @returns {number} ms
     */
    calcularDuracaoViagem(viagem) {
      if (!viagem?.timestampInicio) return 0;
      const fim = viagem.timestampFim ?? Date.now();
      return this.calcularDuracaoMs(viagem.timestampInicio, fim);
    }

    /**
     * @param {Object} viagem
     * @returns {string}
     */
    formatarDuracaoViagem(viagem) {
      const ms = this.calcularDuracaoViagem(viagem);
      const min = Math.floor(ms / 60000);
      const h = Math.floor(min / 60);
      const m = min % 60;
      return h > 0 ? `${h}h ${m}min` : `${m}min`;
    }

    /**
     * Lista trajetos curados disponíveis no Curador de Trajetos.
     * @returns {Array<{ id: string, origem: string, destino: string }>}
     */
    listarTrajetosCurados() {
      return CuradorTrajetos.listar();
    }

    /**
     * Compara Rota Direta vs Conforto de um trajeto curado.
     * @param {string} trajetoId
     * @returns {{ direta: Object, conforto: Object }|null}
     */
    compararRotasCuradas(trajetoId) {
      return CuradorTrajetos.comparar(trajetoId);
    }

    /**
     * Gera planejamento via Curador de Trajetos (mock offline com timeline).
     *
     * @param {'direta'|'conforto'} tipoRota
     * @param {Object} [params]
     * @param {string} [params.trajetoId]
     * @param {string} [params.origem]
     * @param {string} [params.destino]
     * @returns {Object} Objeto planejamento com timeline.
     */
    planejarRota(tipoRota, params = {}) {
      const curado = CuradorTrajetos.planejar(tipoRota, params);
      if (curado) return curado;

      const tipo = tipoRota === 'conforto' ? 'conforto' : 'direta';
      return {
        tipoRota: tipo,
        origem: params.origem || null,
        destino: params.destino || null,
        tempoEstimado: null,
        distanciaTotal: null,
        tempoEstimadoAdicionalMinutos: 0,
        preferenciasTags: params.preferenciasTags || [],
        alerta: 'Trajeto personalizado — selecione uma rota curada para o guia de bordo completo.',
        timeline: [],
        paradasSugeridas: [],
        resumo: {
          foco: tipo === 'conforto' ? 'Slow Travel' : 'Menor tempo e distância',
          origem: params.origem || 'Origem não informada',
          destino: params.destino || 'Destino não informado',
        },
      };
    }

    /**
     * Atualiza planejamento de rota de uma viagem existente.
     *
     * @param {string} viagemId
     * @param {'direta'|'conforto'} tipoRota
     * @param {Object} [params]
     * @returns {{ sucesso: boolean, planejamento?: Object, erro?: string }}
     */
    atualizarPlanejamento(viagemId, tipoRota, params = {}) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem) return { sucesso: false, erro: 'Viagem não encontrada.' };

      const merged = {
        trajetoId: params.trajetoId || viagem.trajetoId,
        origem: params.origem || viagem.origem,
        destino: params.destino || viagem.destino,
      };

      viagem.planejamento = this.planejarRota(tipoRota, merged);
      if (viagem.planejamento.trajetoId) viagem.trajetoId = viagem.planejamento.trajetoId;
      this._salvar();
      return { sucesso: true, planejamento: viagem.planejamento };
    }

    encerrarViagem(viagemId, kmFinal, opcoes = {}) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem) return { sucesso: false, erro: 'Viagem não encontrada.' };
      if (viagem.status !== 'ativa') return { sucesso: false, erro: 'Viagem já encerrada.' };

      const km = parseNumeroBR(kmFinal);
      if (km === null) return { sucesso: false, erro: 'KM final inválido.' };

      if (viagem.paradaAtivaId) {
        this.finalizarParada(viagemId);
      }

      const engenhariaReversa = viagem.modo === 'instantanea'
        && (!viagem.kmInformado || viagem.kmInicialEstimado || viagem.kmInicial === null);

      if (engenhariaReversa && viagem.distanciaGpsKm > 0) {
        viagem.kmInicial = Math.max(0, km - viagem.distanciaGpsKm);
        viagem.kmInicialFonte = 'reversa_gps';
        viagem.kmInicialEstimado = false;
        viagem.kmInicialCorrigidoRetroativo = true;
      }

      if (viagem.kmInicial !== null && km < viagem.kmInicial) {
        return { sucesso: false, erro: 'KM final deve ser maior ou igual ao KM inicial.' };
      }

      viagem.kmFinal = km;
      viagem.status = 'encerrada';

      const agora = Date.now();
      if (opcoes.timestampFim) {
        viagem.timestampFim = opcoes.timestampFim;
        viagem.encerramentoAutomatico = Boolean(opcoes.automatico);
      } else {
        viagem.timestampFim = agora;
      }

      if (opcoes.timestampBreakpoint) {
        viagem.timestampBreakpoint = opcoes.timestampBreakpoint;
      }

      this._salvar();
      return { sucesso: true, viagem };
    }

    /**
     * Encerramento automático após 1h de inatividade pós-alerta.
     * Horário de término = timestampBreakpoint (descarta esquecimento na garagem).
     *
     * @param {string} viagemId
     * @returns {{ sucesso: boolean, viagem?: Object, erro?: string }}
     */
    encerrarViagemAutomatica(viagemId) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem || viagem.status !== 'ativa') {
        return { sucesso: false, erro: 'Viagem não encontrada ou já encerrada.' };
      }

      const breakpoint = viagem.timestampBreakpoint
        || viagem.monitoramento?.timestampParadaInicio
        || Date.now();

      const kmEstimado = viagem.kmInicial !== null && viagem.kmInicial !== undefined
        ? viagem.kmInicial + (viagem.distanciaGpsKm || 0)
        : Math.max(viagem.distanciaGpsKm || 0, this.getUltimaViagemEncerrada()?.kmFinal || 0);

      return this.encerrarViagem(viagemId, kmEstimado ?? viagem.kmInicial ?? 0, {
        timestampFim: breakpoint,
        timestampBreakpoint: breakpoint,
        automatico: true,
      });
    }

    /**
     * Processa atualização GPS — acumula distância e registra com throttle (30min/10km).
     * @param {string} viagemId
     * @param {Object} pos - { lat, lng, timestamp, velocidadeKmh }
     * @param {boolean} [forcar=false] - Ignora throttle (gasto, parada).
     */
    processarAtualizacaoGps(viagemId, pos, forcar = false) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem || viagem.status !== 'ativa' || !pos) return;

      const geo = global.RotaInteligente.geo;
      const anterior = viagem.ultimaPosicaoGps;

      if (anterior && geo?.haversineMetros) {
        const metros = geo.haversineMetros(anterior.lat, anterior.lng, pos.lat, pos.lng);
        if (metros > 5 && metros < 5000) {
          const km = metros / 1000;
          viagem.distanciaGpsKm = (viagem.distanciaGpsKm || 0) + km;
          viagem.gpsRegistro.distanciaDesdeUltimoRegistroKm =
            (viagem.gpsRegistro.distanciaDesdeUltimoRegistroKm || 0) + km;
        }
      }

      viagem.ultimaPosicaoGps = { lat: pos.lat, lng: pos.lng, timestamp: pos.timestamp || Date.now() };

      const deveRegistrar = forcar || geo?.deveRegistrarGpsBackground(
        viagem.gpsRegistro,
        pos.timestamp || Date.now()
      );

      if (deveRegistrar) {
        viagem.gpsRegistro.ultimoRegistroTimestamp = pos.timestamp || Date.now();
        viagem.gpsRegistro.distanciaDesdeUltimoRegistroKm = 0;
        if (!viagem.coordenadaInicio) {
          viagem.coordenadaInicio = { lat: pos.lat, lng: pos.lng };
        }
        this._salvar();
      }
    }

    /**
     * Verifica breakpoint de inatividade — usa Date.now() (sem setInterval).
     * @param {string} viagemId
     * @param {number} velocidadeKmh
     * @returns {{ precisaAlerta: boolean, precisaAutoEncerrar: boolean }}
     */
    verificarBreakpointInatividade(viagemId, velocidadeKmh) {
      const viagem = this.getViagemPorId(viagemId);
      const resultado = { precisaAlerta: false, precisaAutoEncerrar: false };
      if (!viagem || viagem.status !== 'ativa') return resultado;

      const agora = Date.now();
      const mon = viagem.monitoramento;
      const parado = velocidadeKmh < 1;

      if (!parado) {
        mon.timestampParadaInicio = null;
        mon.timestampAlertaParada = null;
        mon.alertaParadaExibido = false;
        viagem.timestampBreakpoint = null;
        return resultado;
      }

      if (!mon.timestampParadaInicio) {
        mon.timestampParadaInicio = agora;
        return resultado;
      }

      const tempoParado = agora - mon.timestampParadaInicio;

      if (tempoParado >= MS_PARADA_ALERTA && !mon.alertaParadaExibido) {
        mon.alertaParadaExibido = true;
        mon.timestampAlertaParada = agora;
        viagem.timestampBreakpoint = mon.timestampParadaInicio;
        resultado.precisaAlerta = true;
        this._salvar();
      }

      if (mon.timestampAlertaParada && (agora - mon.timestampAlertaParada) >= MS_AUTO_ENCERRAR) {
        resultado.precisaAutoEncerrar = true;
      }

      return resultado;
    }

    /**
     * Usuário confirmou que deseja continuar após alerta de parada.
     * @param {string} viagemId
     */
    confirmarContinuarViagem(viagemId) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem) return;

      viagem.monitoramento.timestampParadaInicio = null;
      viagem.monitoramento.timestampAlertaParada = null;
      viagem.monitoramento.alertaParadaExibido = false;
      viagem.timestampBreakpoint = null;
      this._salvar();
    }

    /**
     * Inicia parada manual com timestamp absoluto e captura GPS.
     * @param {string} viagemId
     * @param {string} [motivo='Parada']
     * @param {Object} [coordenadas]
     */
    iniciarParada(viagemId, motivo = 'Parada', coordenadas = null) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem || viagem.status !== 'ativa') {
        return { sucesso: false, erro: 'Viagem não encontrada.' };
      }

      if (viagem.paradaAtivaId) {
        return { sucesso: false, erro: 'Já existe uma parada ativa.' };
      }

      const parada = {
        id: this._gerarId(),
        motivo,
        timestampInicio: Date.now(),
        timestampFim: null,
        localizacao: coordenadas
          ? { lat: coordenadas.lat, lng: coordenadas.lng }
          : null,
      };

      viagem.paradas.push(parada);
      viagem.paradaAtivaId = parada.id;
      viagem.statusAtual = motivo;

      if (coordenadas) {
        this.processarAtualizacaoGps(viagemId, coordenadas, true);
      }

      this._salvar();
      return { sucesso: true, parada };
    }

    /**
     * Finaliza parada ativa — duração via timestamps.
     * @param {string} viagemId
     */
    finalizarParada(viagemId) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem?.paradaAtivaId) return { sucesso: false };

      const parada = viagem.paradas.find((p) => p.id === viagem.paradaAtivaId);
      if (parada) {
        parada.timestampFim = Date.now();
      }

      viagem.paradaAtivaId = null;
      viagem.statusAtual = 'Em movimento';
      this._salvar();
      return { sucesso: true, parada };
    }

    /**
     * Gera link WhatsApp com rastreio codificado na URL do GitHub Pages.
     * @param {string} viagemId
     * @param {Object} [posAtual]
     * @returns {{ sucesso: boolean, url?: string, erro?: string }}
     */
    gerarLinkRastreioWhatsapp(viagemId, posAtual = null) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem) return { sucesso: false, erro: 'Viagem não encontrada.' };

      const pos = posAtual || viagem.ultimaPosicaoGps;
      if (!pos) return { sucesso: false, erro: 'Sem localização GPS disponível.' };

      const nomeEnc = encodeURIComponent(viagem.nome);
      const statusEnc = encodeURIComponent(viagem.statusAtual || 'Em movimento');
      const paginaUrl = `${TRACKING_BASE_URL}?viagem=${nomeEnc}&status=${statusEnc}&lat=${pos.lat}&lng=${pos.lng}`;
      const texto = encodeURIComponent(
        `🧭 RotaInteligente — Atualização de rota\n`
        + `Viagem: ${viagem.nome}\n`
        + `Status: ${viagem.statusAtual || 'Em movimento'}\n`
        + `Localização: ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}\n`
        + `Acompanhe: ${paginaUrl}`
      );

      const telefone = (this._data.perfil?.contatoSeguranca || '').replace(/\D/g, '');
      const url = telefone
        ? `https://wa.me/${telefone}?text=${texto}`
        : `https://wa.me/?text=${texto}`;

      return { sucesso: true, url, paginaUrl };
    }

    /**
     * Define contato de segurança para links WhatsApp.
     * @param {string} telefone
     */
    salvarContatoSeguranca(telefone) {
      if (!this._data.perfil) this._data.perfil = this._perfilPadrao();
      this._data.perfil.contatoSeguranca = String(telefone || '').trim();
      this._salvar();
    }

    getContatoSeguranca() {
      return this._data.perfil?.contatoSeguranca || '';
    }

    /**
     * Resumo compacto para cards do Histórico.
     * @param {Object} viagem
     */
    getResumoCardViagem(viagem) {
      const resumo = this.getResumoViagem(viagem);
      return {
        id: viagem.id,
        nome: viagem.nome,
        status: viagem.status,
        modo: viagem.modo,
        destino: viagem.destino,
        veiculo: viagem.veiculo,
        duracao: this.formatarDuracaoViagem(viagem),
        totalGeral: resumo.totalGeral,
        distancia: resumo.distanciaPercorrida,
        gastosCount: viagem.gastos?.length || 0,
        timestampInicio: viagem.timestampInicio,
        timestampFim: viagem.timestampFim,
      };
    }

    /**
     * Ponto de extensão — serviço background Capacitor (Android).
     * @see geo.configurarServicoBackground
     */
    configurarServicoBackground() {
      global.RotaInteligente.geo?.configurarServicoBackground?.();
    }

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
      if (gasto.coordenadasGps) {
        this.processarAtualizacaoGps(viagem.id, gasto.coordenadasGps, true);
      }
      this._salvar();
      return { sucesso: true, gasto: novoGasto };
    }

    excluirGasto(viagemId, gastoId) {
      const viagem = this.getViagemPorId(viagemId);
      if (!viagem) return { sucesso: false, erro: 'Viagem não encontrada.' };

      const idx = viagem.gastos.findIndex((g) => g.id === gastoId);
      if (idx === -1) return { sucesso: false, erro: 'Gasto não encontrado.' };

      viagem.gastos.splice(idx, 1);
      this._salvar();
      return { sucesso: true };
    }

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

    _montarAvaliacao(avaliacao) {
      const estrelas = parseInteiroBR(avaliacao.estrelas);
      return {
        estrelas: estrelas !== null ? Math.min(5, Math.max(1, estrelas)) : 5,
        perfil: PERFIS_AVALIACAO.includes(avaliacao.perfil) ? avaliacao.perfil : 'Solo',
        comentario: String(avaliacao.comentario || '').trim(),
        revisado: false,
      };
    }

    getGastosPorCategoria(viagem, categoria) {
      if (!viagem?.gastos) return [];
      return viagem.gastos.filter((g) => g.categoria === categoria);
    }

    /**
     * Abastecimentos ordenados cronologicamente.
     * @private
     */
    _getAbastecimentosOrdenados(viagem) {
      return this.getGastosPorCategoria(viagem, 'Combustível')
        .slice()
        .sort((a, b) => new Date(a.data) - new Date(b.data));
    }

    /**
     * Soma litros para método Tanque Cheio.
     * Ignora o primeiro abastecimento se o tanque saiu cheio da garagem.
     * @private
     */
    _somarLitrosTanqueCheio(viagem) {
      const abastecimentos = this._getAbastecimentosOrdenados(viagem);
      if (abastecimentos.length === 0) return 0;

      const tanqueSaiuCheio = viagem.tanqueSaiuCheio !== false;
      const inicio = tanqueSaiuCheio ? 1 : 0;

      return abastecimentos
        .slice(inicio)
        .reduce((acc, g) => acc + (g.detalhes?.litros || 0), 0);
    }

    /**
     * KM final para cálculo de consumo.
     * Prioriza kmFinal da garagem; senão, maior kmAtual de abastecimentos com tanque cheio.
     * Ignora KMs intermediários de abastecimentos parciais (tanque não completo).
     * @private
     */
    _obterKmFinalConsumo(viagem) {
      if (viagem.kmFinal !== null && viagem.kmFinal !== undefined) {
        return viagem.kmFinal;
      }

      const kmsTanqueCheio = this._getAbastecimentosOrdenados(viagem)
        .filter((g) => g.detalhes?.tanqueCheio === true)
        .map((g) => g.detalhes?.kmAtual)
        .filter((km) => typeof km === 'number' && km > 0);

      if (kmsTanqueCheio.length === 0) return null;
      return Math.max(...kmsTanqueCheio);
    }

    /**
     * Consumo médio KM/L — (kmFinal - kmInicial) / Σ litros (método Tanque Cheio).
     * Ignora KMs de abastecimentos parciais e o 1º abastecimento se tanque saiu cheio.
     */
    calcularConsumoMedio(viagem) {
      if (!viagem) return null;

      const kmFinal = this._obterKmFinalConsumo(viagem);
      if (kmFinal === null) return null;

      let distancia = 0;
      if (viagem.kmInicial !== null && viagem.kmInicial !== undefined) {
        distancia = kmFinal - viagem.kmInicial;
      } else {
        distancia = viagem.distanciaGpsKm || 0;
      }
      if (distancia <= 0) return null;

      const litrosTotal = this._somarLitrosTanqueCheio(viagem);
      if (litrosTotal <= 0) return null;

      return distancia / litrosTotal;
    }

    calcularCustoDiaria(viagem) {
      const hospedagens = this.getGastosPorCategoria(viagem, 'Hospedagem');
      const totalValor = hospedagens.reduce((acc, g) => acc + g.valorTotal, 0);
      const totalDiarias = hospedagens.reduce((acc, g) => acc + (g.detalhes?.diarias || 0), 0);
      if (totalDiarias <= 0) return null;
      return totalValor / totalDiarias;
    }

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

    calcularCustoPorKm(viagem) {
      if (!viagem) return null;

      const kmFinal = this._obterKmFinalConsumo(viagem);
      if (kmFinal === null) return null;

      let distancia = 0;
      if (viagem.kmInicial !== null && viagem.kmInicial !== undefined) {
        distancia = kmFinal - viagem.kmInicial;
      } else {
        distancia = viagem.distanciaGpsKm || 0;
      }
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

    /** @deprecated Use _obterKmFinalConsumo — mantido para compatibilidade interna. */
    _inferirKmFinal(viagem) {
      return this._obterKmFinalConsumo(viagem) ?? viagem.kmInicial;
    }

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

    getResumoViagem(viagem) {
      if (!viagem) {
        return {
          totalGeral: 0,
          consumoMedio: null,
          custoDiaria: null,
          alimentacaoPerCapita: null,
          custoPorKm: null,
          distanciaPercorrida: 0,
          duracaoFormatada: '0min',
          distribuicao: {},
          planejamento: null,
        };
      }

      const kmFinal = this._obterKmFinalConsumo(viagem);
      const kmInicial = viagem.kmInicial ?? 0;
      let distancia = 0;

      if (kmFinal !== null && viagem.kmInicial !== null) {
        distancia = Math.max(0, kmFinal - kmInicial);
      } else if (viagem.distanciaGpsKm > 0) {
        distancia = viagem.distanciaGpsKm;
      }

      return {
        totalGeral: this.calcularTotalGeral(viagem),
        consumoMedio: this.calcularConsumoMedio(viagem),
        custoDiaria: this.calcularCustoDiaria(viagem),
        alimentacaoPerCapita: this.calcularAlimentacaoPerCapita(viagem),
        custoPorKm: this.calcularCustoPorKm(viagem),
        distanciaPercorrida: distancia,
        duracaoFormatada: this.formatarDuracaoViagem(viagem),
        distribuicao: this.getDistribuicaoPorCategoria(viagem),
        planejamento: viagem.planejamento || null,
      };
    }

    calcularTotalGeral(viagem) {
      if (!viagem?.gastos?.length) return 0;
      return viagem.gastos.reduce((acc, g) => acc + (g.valorTotal || 0), 0);
    }

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

    marcarAvaliacaoRevisada(viagemId, gastoId) {
      const viagem = this.getViagemPorId(viagemId);
      const gasto = viagem?.gastos.find((g) => g.id === gastoId);
      if (gasto?.avaliacao) {
        gasto.avaliacao.revisado = true;
        this._salvar();
      }
    }
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.TAGS_PREFERENCIA = TAGS_PREFERENCIA;
  global.RotaInteligente.MS_PARADA_ALERTA = MS_PARADA_ALERTA;
  global.RotaInteligente.MS_AUTO_ENCERRAR = MS_AUTO_ENCERRAR;
  global.RotaInteligente.CATEGORIAS = CATEGORIAS;
  global.RotaInteligente.PERFIS_AVALIACAO = PERFIS_AVALIACAO;
  global.RotaInteligente.CURADOR_TRAJETOS = CURADOR_TRAJETOS;
  global.RotaInteligente.CuradorTrajetos = CuradorTrajetos;
  global.RotaInteligente.ViagemManager = ViagemManager;
})(window);
