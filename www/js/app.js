/**
 * @file app.js
 * @description Inicializador da SPA RotaInteligente — roteamento de abas e injeção de dependências.
 *
 * Responsabilidades:
 * - Instanciar o Singleton `ViagemManager` (Model).
 * - Injetar o Model nos Controllers (Form, Dash, Post).
 * - Gerenciar navegação Bottom Nav (roteador de abas).
 * - Exibir toasts globais de feedback.
 *
 * @module app
 * @dependencies
 *   - ./models/ViagemManager.js
 *   - ./controllers/FormController.js
 *   - ./controllers/DashController.js
 *   - ./controllers/PostController.js
 */

import { ViagemManager } from './models/ViagemManager.js';
import { FormController } from './controllers/FormController.js';
import { DashController } from './controllers/DashController.js';
import { PostController } from './controllers/PostController.js';

/** @type {ViagemManager|null} Singleton do Model — estado único do localStorage. */
let viagemManager = null;

/** @type {FormController|null} */
let formController = null;

/** @type {DashController|null} */
let dashController = null;

/** @type {PostController|null} */
let postController = null;

/**
 * Exibe toast temporário de feedback na UI.
 *
 * @param {string} msg - Mensagem a exibir.
 * @param {'success'|'error'} [tipo='success'] - Variante visual.
 * @returns {void}
 */
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

/**
 * Roteador de abas — alterna painéis visíveis e dispara renderização dos controllers.
 *
 * @param {string} tabId - Identificador da aba: `dashboard` | `lancamento` | `historico` | `postagem`.
 * @returns {void}
 */
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
      dashController?.renderHistorico();
      break;
    case 'postagem':
      postController?.render();
      break;
    default:
      break;
  }
}

/**
 * Callback executado após salvar gasto — atualiza dashboard e histórico.
 * @returns {void}
 */
function onGastoSalvo() {
  dashController?.renderDashboard();
}

/**
 * Callback executado após encerrar viagem — prepara aba de postagem.
 *
 * @param {string} viagemId - ID da viagem recém-encerrada.
 * @returns {void}
 */
function onViagemEncerrada(viagemId) {
  dashController?.renderTripSelectors();
  postController?.selecionarViagem(viagemId);
}

/**
 * Registra listeners da Bottom Navigation.
 * @returns {void}
 */
function bindNavigation() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('click', () => navigateTo(btn.dataset.tab));
  });
}

/**
 * Inicializa a aplicação SPA.
 * Cria Singleton do Model e injeta nos Controllers.
 *
 * @returns {void}
 */
function bootstrap() {
  viagemManager = new ViagemManager();

  dashController = new DashController(viagemManager, {
    showToast,
    onNavigate: navigateTo,
    onViagemEncerrada,
  });

  formController = new FormController(viagemManager, {
    showToast,
    onGastoSalvo,
    onAbrirNovaViagem: () => dashController.openNovaViagemModal(),
  });

  postController = new PostController(viagemManager, { showToast });

  bindNavigation();

  dashController.renderDashboard();
  formController.renderEstado();
  dashController.renderHistorico();
  postController.render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}

export { viagemManager, navigateTo, showToast };
