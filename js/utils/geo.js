/**
 * @file geo.js
 * @description Helper de geolocalização para captura de coordenadas GPS.
 *
 * Prioriza o plugin Capacitor Geolocation em apps Android nativas e faz
 * fallback para a API Web `navigator.geolocation`. Quando indisponível,
 * simula coordenadas (útil em desktop/desenvolvimento).
 *
 * @module utils/geo
 * @dependencies Capacitor (opcional, injetado globalmente no WebView nativo).
 */

/**
 * @typedef {Object} Coordenadas
 * @property {number} lat - Latitude.
 * @property {number} lng - Longitude.
 * @property {boolean} simulado - Indica se as coordenadas foram simuladas.
 */

/**
 * Verifica se a aplicação está rodando em plataforma nativa Capacitor.
 *
 * @returns {boolean} `true` se Android/iOS via Capacitor.
 */
export function isNativePlatform() {
  return Boolean(window.Capacitor?.isNativePlatform?.());
}

/**
 * Simula coordenadas próximas a São Paulo (fallback de desenvolvimento).
 *
 * @returns {Coordenadas} Coordenadas simuladas com flag `simulado: true`.
 */
export function simularCoordenadas() {
  return {
    lat: -23.55052 + (Math.random() * 0.1 - 0.05),
    lng: -46.633308 + (Math.random() * 0.1 - 0.05),
    simulado: true,
  };
}

/**
 * Captura coordenadas via Capacitor Geolocation (Android/iOS nativo).
 *
 * @returns {Promise<Coordenadas>} Coordenadas reais do dispositivo.
 * @throws {Error} Se permissão negada ou falha na captura.
 */
async function capturarViaCapacitor() {
  const Geolocation = window.Capacitor?.Plugins?.Geolocation;
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
  };
}

/**
 * Captura coordenadas via API Web Geolocation do navegador.
 *
 * @returns {Promise<Coordenadas>} Coordenadas reais do navegador.
 * @throws {Error} Se API indisponível ou usuário negou permissão.
 */
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
      }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });
}

/**
 * Obtém coordenadas GPS do dispositivo com cadeia de fallback inteligente.
 *
 * Ordem de tentativa:
 * 1. Capacitor Geolocation (app nativo)
 * 2. navigator.geolocation (navegador)
 * 3. Simulação (desktop/dev)
 *
 * @returns {Promise<Coordenadas>} Coordenadas capturadas ou simuladas.
 */
export async function capturarCoordenadas() {
  if (isNativePlatform() && window.Capacitor?.Plugins?.Geolocation) {
    try {
      return await capturarViaCapacitor();
    } catch {
      /* fallback para web ou simulação */
    }
  }

  try {
    return await capturarViaWeb();
  } catch {
    return simularCoordenadas();
  }
}

/**
 * Formata coordenadas para exibição na UI.
 *
 * @param {Coordenadas} coords - Objeto de coordenadas.
 * @returns {string} Texto formatado para o status GPS.
 */
export function formatarCoordenadas(coords) {
  const sufixo = coords.simulado ? ' (simulado)' : '';
  return `📍 ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}${sufixo}`;
}
