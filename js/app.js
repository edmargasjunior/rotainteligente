/**
 * @file app.js
 * @description Inicializador da SPA RotaInteligente — roteamento, monitor GPS e injeção de dependências.
 * Exposto em window.RotaInteligente.app
 */

(function (global) {
  'use strict';

  const {
    ViagemManager,
    FormController,
    DashController,
    PostController,
    HistoricoController,
    ViagemMonitorController,
  } = global.RotaInteligente;

  const THEME_STORAGE_KEY = 'ri_theme_prefs';
  const TEMA_SOLAR = 'theme-viva-solar';
  const TEMA_NOITE = 'theme-asfalto-night';
  const TEMAS_VALIDOS = [TEMA_SOLAR, TEMA_NOITE];

  /**
   * Lê preferências de tema do localStorage.
   * @returns {{ auto: boolean, manual: string }}
   */
  function getThemePrefs() {
    try {
      const raw = localStorage.getItem(THEME_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          auto: parsed.auto !== false,
          manual: TEMAS_VALIDOS.includes(parsed.manual) ? parsed.manual : TEMA_SOLAR,
        };
      }
    } catch { /* fallback */ }
    return { auto: true, manual: TEMA_SOLAR };
  }

  /**
   * Persiste preferências de tema.
   * @param {{ auto: boolean, manual: string }} prefs
   */
  function saveThemePrefs(prefs) {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(prefs));
  }

  /**
   * Aplica classe de tema no body e atualiza theme-color.
   * @param {string} nomeTema
   */
  function aplicarTema(nomeTema) {
    const tema = TEMAS_VALIDOS.includes(nomeTema) ? nomeTema : TEMA_SOLAR;
    document.body.className = tema;

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = tema === TEMA_SOLAR ? '#EBF3FA' : '#0f172a';
    }
  }

  /**
   * Ciclo solar automático — 06h–17h Viva Solar; 18h–05h Asfalto Night.
   * Respeita preferência manual quando "auto" está desmarcado.
   */
  function verificarCicloSolarTema() {
    const prefs = getThemePrefs();

    if (prefs.auto) {
      const hora = new Date().getHours();
      const tema = (hora >= 6 && hora <= 17) ? TEMA_SOLAR : TEMA_NOITE;
      aplicarTema(tema);
      return;
    }

    aplicarTema(prefs.manual);
  }

  /**
   * Vincula controles de aparência no Dashboard.
   */
  function initThemeSettings() {
    const chkAuto = document.getElementById('input-tema-automatico');
    const selectManual = document.getElementById('select-tema-manual');
    if (!chkAuto || !selectManual) return;

    const prefs = getThemePrefs();
    chkAuto.checked = prefs.auto;
    selectManual.value = prefs.manual;
    selectManual.disabled = prefs.auto;

    chkAuto.addEventListener('change', () => {
      const auto = chkAuto.checked;
      selectManual.disabled = auto;
      saveThemePrefs({ auto, manual: selectManual.value });
      verificarCicloSolarTema();
    });

    selectManual.addEventListener('change', () => {
      chkAuto.checked = false;
      selectManual.disabled = false;
      saveThemePrefs({ auto: false, manual: selectManual.value });
      verificarCicloSolarTema();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && getThemePrefs().auto) {
        verificarCicloSolarTema();
      }
    });
  }

  let viagemManager = null;
  let formController = null;
  let dashController = null;
  let postController = null;
  let historicoController = null;
  let viagemMonitor = null;

  function showToast(msg, tipo = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = msg;
    toast.className = `toast show ${tipo}`;
    toast.hidden = false;

    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
      toast.classList.remove('show');
      toast.hidden = true;
    }, 3000);
  }

  function navigateTo(tabId) {
    document.querySelectorAll('.tab-panel').forEach((panel) => {
      const isActive = panel.id === `tab-${tabId}`;
      panel.classList.toggle('active', isActive);
      panel.hidden = !isActive;
    });

    document.querySelectorAll('.nav-item').forEach((btn) => {
      const isActive = btn.dataset.tab === tabId;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-current', isActive ? 'page' : 'false');
    });

    switch (tabId) {
      case 'dashboard':
        dashController?.renderDashboard();
        break;
      case 'lancamento':
        formController?.renderEstado();
        break;
      case 'historico':
        historicoController?.render();
        break;
      case 'postagem':
        postController?.render();
        break;
      default:
        break;
    }
  }

  function onGastoSalvo() {
    dashController?.renderDashboard();
    historicoController?.render();
  }

  function onViagemEncerrada(viagemId) {
    viagemMonitor?.parar();
    dashController?.renderTripSelectors();
    historicoController?.render();
    postController?.selecionarViagem(viagemId);
  }

  function onViagemIniciada(viagemId) {
    viagemMonitor?.iniciar(viagemId);
    dashController?.renderDashboard();
    historicoController?.render();
  }

  function onAlertaParada() {
    dashController?.exibirAlertaParada();
  }

  function onAutoEncerrar(viagemId) {
    const result = viagemManager.encerrarViagemAutomatica(viagemId);
    if (result.sucesso) {
      showToast('Viagem encerrada automaticamente (inatividade detectada).', 'error');
      onViagemEncerrada(viagemId);
      navigateTo('historico');
    }
  }

  function bindNavigation() {
    document.querySelectorAll('.nav-item').forEach((btn) => {
      btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
    });
  }

  /**
   * Oculta a splash nativa do Capacitor com fade suave quando a UI estiver pronta.
   */
  function esconderSplashNativo() {
    const splash = global.Capacitor?.Plugins?.SplashScreen;
    if (!splash) return;
    splash.hide({ fadeOutDuration: 500 }).catch(function () { /* Web / file:// */ });
  }

  function bootstrap() {
    verificarCicloSolarTema();
    initThemeSettings();

    viagemManager = new ViagemManager();

    viagemMonitor = new ViagemMonitorController(viagemManager, {
      showToast,
      onAlertaParada,
      onAutoEncerrar,
    });

    dashController = new DashController(viagemManager, {
      showToast,
      onNavigate: navigateTo,
      onViagemEncerrada,
      onViagemIniciada,
      viagemMonitor,
    });

    formController = new FormController(viagemManager, {
      showToast,
      onGastoSalvo,
      onAbrirNovaViagem: () => dashController.openNovaViagemModal(),
      viagemMonitor,
    });

    historicoController = new HistoricoController(viagemManager, {
      showToast,
      onGastosAlterados: () => dashController?.renderDashboard(),
    });

    postController = new PostController(viagemManager, { showToast });

    bindNavigation();

    dashController.renderDashboard();
    formController.renderEstado();
    historicoController.render();
    postController.render();

    esconderSplashNativo();

    const viagemAtiva = viagemManager.getViagemAtiva();
    if (viagemAtiva) {
      viagemMonitor.iniciar(viagemAtiva.id);
    }
  }

  global.RotaInteligente = global.RotaInteligente || {};
  global.RotaInteligente.app = {
    get viagemManager() { return viagemManager; },
    get viagemMonitor() { return viagemMonitor; },
    navigateTo,
    showToast,
    bootstrap,
    verificarCicloSolarTema,
    aplicarTema,
    getThemePrefs,
    saveThemePrefs,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
