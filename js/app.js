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

  function bootstrap() {
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
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})(window);
