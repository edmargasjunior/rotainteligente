/**
 * @file geo.js
 * @description Geolocalização, cálculo de distância e monitoramento GPS econômico.
 * Timestamps absolutos (Date.now()) — sem setInterval para lógica crítica.
 * Exposto em window.RotaInteligente.geo
 */

(function (global) {
  'use strict';

  /** Intervalo mínimo entre registros GPS em segundo plano (30 min). */
  const GPS_INTERVALO_MS = 30 * 60 * 1000;

  /** Distância mínima entre registros GPS em segundo plano (10 km). */
  const GPS_DISTANCIA_KM = 10;

  function isNativePlatform() {
    return Boolean(global.Capacitor?.isNativePlatform?.());
  }

  function simularCoordenadas() {
    return {
      lat: -19.91668 + (Math.random() * 0.02 - 0.01),
      lng: -43.93449 + (Math.random() * 0.02 - 0.01),
      simulado: true,
      timestamp: Date.now(),
      velocidadeKmh: 0,
    };
  }

  /**
   * Distância Haversine entre dois pontos em metros.
   * @param {number} lat1
   * @param {number} lng1
   * @param {number} lat2
   * @param {number} lng2
   * @returns {number}
   */
  function haversineMetros(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Converte m/s para km/h.
   * @param {number|null} ms
   * @returns {number}
   */
  function msParaKmh(ms) {
    if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return 0;
    return ms * 3.6;
  }

  async function capturarViaCapacitor() {
    const Geolocation = global.Capacitor?.Plugins?.Geolocation;
    if (!Geolocation) throw new Error('Plugin Geolocation indisponível.');

    const perm = await Geolocation.requestPermissions();
    if (perm.location === 'denied' || perm.coarseLocation === 'denied') {
      throw new Error('Permissão de localização negada.');
    }

    const pos = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      simulado: false,
      timestamp: Date.now(),
      velocidadeKmh: msParaKmh(pos.coords.speed),
    };
  }

  function capturarViaWeb() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocalização não suportada.'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          simulado: false,
          timestamp: Date.now(),
          velocidadeKmh: msParaKmh(pos.coords.speed),
        }),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  /**
   * Captura posição única com cadeia de fallback.
   * @param {boolean} [semSimulacao=false] - Se true, rejeita em vez de simular.
   * @returns {Promise<Object>}
   */
  async function capturarCoordenadas(semSimulacao = false) {
    if (isNativePlatform() && global.Capacitor?.Plugins?.Geolocation) {
      try {
        return await capturarViaCapacitor();
      } catch {
        /* fallback */
      }
    }

    try {
      return await capturarViaWeb();
    } catch {
      if (semSimulacao) throw new Error('GPS indisponível.');
      return simularCoordenadas();
    }
  }

  function formatarCoordenadas(coords) {
    const sufixo = coords.simulado ? ' (simulado)' : '';
    return `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${sufixo}`;
  }

  /**
   * Monitor GPS com watchPosition — callbacks orientados a eventos (sem setInterval).
   */
  class GpsMonitor {
    constructor() {
      /** @type {number|null} */
      this._watchId = null;
      /** @type {function(Object): void|null} */
      this._onUpdate = null;
      this._ultimaPosicao = null;
    }

    /**
     * @param {function(Object): void} onUpdate
     * @returns {boolean}
     */
    iniciar(onUpdate) {
      this.parar();
      if (!navigator.geolocation) return false;

      this._onUpdate = onUpdate;
      this._watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const atual = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            timestamp: Date.now(),
            velocidadeKmh: msParaKmh(pos.coords.speed),
            simulado: false,
          };
          this._ultimaPosicao = atual;
          this._onUpdate?.(atual);
        },
        () => { /* silencioso — fallback no manager */ },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
      );
      return true;
    }

    parar() {
      if (this._watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(this._watchId);
        this._watchId = null;
      }
      this._onUpdate = null;
    }

    /** @returns {Object|null} */
    getUltimaPosicao() {
      return this._ultimaPosicao;
    }
  }

  /**
   * Verifica se deve registrar GPS em segundo plano (30 min OU 10 km).
   * @param {Object} estado - { ultimoRegistroTimestamp, distanciaDesdeUltimoRegistroKm }
   * @param {number} [agora=Date.now()]
   * @returns {boolean}
   */
  function deveRegistrarGpsBackground(estado, agora = Date.now()) {
    if (!estado?.ultimoRegistroTimestamp) return true;
    const tempoOk = (agora - estado.ultimoRegistroTimestamp) >= GPS_INTERVALO_MS;
    const distOk = (estado.distanciaDesdeUltimoRegistroKm || 0) >= GPS_DISTANCIA_KM;
    return tempoOk || distOk;
  }

  /**
   * Ponto de extensão futura — plugin Capacitor Background Geolocation no Android.
   * Mantido comentado como referência arquitetural.
   */
  function configurarServicoBackground() {
    /*
    // FUTURO: Capacitor Background Geolocation
    // import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';
    //
    // await BackgroundGeolocation.configure({
    //   notificationTitle: 'RotaInteligente',
    //   notificationText: 'Monitorando sua viagem em segundo plano',
    //   distanceFilter: 100,
    //   stopOnTerminate: false,
    //   startOnBoot: false,
    // });
    //
    // BackgroundGeolocation.addListener('location', (location) => {
    //   global.RotaInteligente.app?.viagemManager?.processarAtualizacaoGps(
    //     viagemIdAtiva,
    //     { lat: location.latitude, lng: location.longitude, timestamp: Date.now(), velocidadeKmh: location.speed * 3.6 }
    //   );
    // });
    //
    // await BackgroundGeolocation.start();
    */
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.geo = {
    isNativePlatform,
    simularCoordenadas,
    capturarCoordenadas,
    formatarCoordenadas,
    haversineMetros,
    msParaKmh,
    GpsMonitor,
    deveRegistrarGpsBackground,
    configurarServicoBackground,
    GPS_INTERVALO_MS,
    GPS_DISTANCIA_KM,
  };
})(window);
