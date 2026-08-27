/**
 * SGA SETEG - Sistema de Solicitação de Peças Gráficas
 * Ano: 2026
 * Empresa: SETEG
 *
 * Camada de tela: header, cards, tabela, filtros, paginação, os três modais
 * e o tema claro/escuro.
 *
 * Nada aqui fala com o Supabase, com o Clockify ou com o Teams direto —
 * tudo passa pelos serviços em src/services e src/modules. As funções que o
 * index.html chama por `onclick` são expostas em `window` no fim do arquivo:
 * como o bundle é um módulo ES, elas não são globais por conta própria.
 */

import {
  garantirProjetosClockify,
  filtrarProjetosClockify,
  listaProjetosClockify,
} from "./services/clockifyService.js";
import { notificarTeams } from "./services/teamsService.js";
import {
  listarSolicitacoes,
  criarSolicitacao,
  atualizarStatus,
  excluirSolicitacao as excluirSolicitacaoNoBanco,
} from "./modules/solicitacoes/solicitacoesService.js";
import {
  autenticarUsuario,
  encerrarSessao,
  restaurarSessao,
} from "./modules/usuarios/usuariosService.js";
import { STATUS, getStatusLabel, getStatusClass, isFinalizado } from "./constants/status.js";

const FORMATO_ICONS = {
    instagram: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
    whatsapp: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>',
    email: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22 6 12 13 2 6"/></svg>',
    impressao: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>',
    site: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
};

const ACTION_ICONS = {
    ver: '<i class="fas fa-eye"></i>',
    processando: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
    ajuste: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
    finalizar: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
    excluir: '<i class="fas fa-trash"></i>'
};

function statusBadgeHTML(item) {
    return `<span class="status-badge ${getStatusClass(item.status)}">${getStatusLabel(item.status)}</span>`;
}

function acoesHTMLFor(item) {
    let html = `<div class="table-actions">
        <button class="btn" data-action="ver" onclick="verDetalhes('${item.id}')" title="Ver Detalhes">${ACTION_ICONS.ver}</button>`;
    if (usuarioLogado) {
        const atual = isFinalizado(item.status) ? STATUS.CONCLUIDO : item.status;
        html += `<button class="btn ${atual === STATUS.EM_ANDAMENTO ? 'is-current' : ''}" data-action="processando" onclick="mudarStatus('${item.id}','${STATUS.EM_ANDAMENTO}')" title="Marcar Em Andamento">${ACTION_ICONS.processando}</button>`;
        html += `<button class="btn ${atual === STATUS.AJUSTES ? 'is-current' : ''}" data-action="ajuste" onclick="mudarStatus('${item.id}','${STATUS.AJUSTES}')" title="Marcar Ajuste Pendente">${ACTION_ICONS.ajuste}</button>`;
        html += `<button class="btn ${atual === STATUS.CONCLUIDO ? 'is-current' : ''}" data-action="finalizar" onclick="mudarStatus('${item.id}','${STATUS.CONCLUIDO}')" title="Marcar Finalizado">${ACTION_ICONS.finalizar}</button>`;
        html += `<button class="btn" data-action="excluir" onclick="excluirSolicitacao('${item.id}')" title="Excluir">${ACTION_ICONS.excluir}</button>`;
    }
    html += `</div>`;
    return html;
}

function escapeHtml(str) {
    if (typeof str !== 'string') return str;
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return str.replace(/[&<>"']/g, m => map[m]);
}

function debounce(fn, ms) {
    let timer;
    return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

// ========== AUTOCOMPLETE DO CLOCKIFY (TELA) ==========
function mostrarSugestoesClockify(projetos, estado) {
    const box = document.getElementById('clockifySuggestions');
    if (!box) return;
    if (estado === 'loading') {
        box.innerHTML = `<div class="clockify-suggestion-msg">Buscando projetos...</div>`;
    } else if (estado === 'empty') {
        box.innerHTML = `<div class="clockify-suggestion-msg">Nenhum projeto encontrado</div>`;
    } else {
        box.innerHTML = projetos.map(p => {
            const nome = escapeHtml(p._nome);
            const code = escapeHtml(p._code);
            return `<div class="clockify-suggestion-item" data-code="${code}">
                <span class="suggestion-nome">${nome}</span>
                <span class="suggestion-code">${code}</span>
            </div>`;
        }).join('');
    }
    box.classList.add('active');
}

function esconderSugestoesClockify() {
    const box = document.getElementById('clockifySuggestions');
    if (box) box.classList.remove('active');
}

function configurarClockifyAutocomplete() {
    const input = document.getElementById('clienteInput');
    const box = document.getElementById('clockifySuggestions');
    if (!input || !box) return;

    const buscarComDebounce = debounce(async (texto) => {
        if (!texto.trim() || texto.trim().length < 2) { esconderSugestoesClockify(); return; }
        // Se os projetos ainda não chegaram, mostra "Buscando projetos..." e
        // espera — antes daqui saía direto "Nenhum projeto encontrado", que
        // era mentira enquanto a lista estava a caminho.
        if (!listaProjetosClockify().length) {
            mostrarSugestoesClockify([], 'loading');
            await garantirProjetosClockify();
        }
        // Relê o campo em vez de confiar no texto capturado antes da espera:
        // a pessoa pode ter continuado digitando.
        const atual = input.value.trim();
        if (atual.length < 2) { esconderSugestoesClockify(); return; }
        const resultados = filtrarProjetosClockify(atual);
        mostrarSugestoesClockify(resultados, resultados.length ? 'list' : 'empty');
    }, 400);

    input.addEventListener('input', () => {
        mostrarSugestoesClockify([], 'loading');
        buscarComDebounce(input.value);
    });

    box.addEventListener('mousedown', (e) => {
        const item = e.target.closest('.clockify-suggestion-item');
        if (!item) return;
        e.preventDefault();
        input.value = item.dataset.code.replace(/^#/, '');
        esconderSugestoesClockify();
    });

    input.addEventListener('blur', () => setTimeout(esconderSugestoesClockify, 200));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') esconderSugestoesClockify(); });
}

// ========== TEMA CLARO / ESCURO ==========
function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    // A logo não troca com o tema: a barra do topo é azul-marinho nos dois,
    // então a versão negativa (logo-seteg.svg) serve sempre.
    const slider = document.getElementById('themeSlider');
    if (!slider) return;
    if (theme === 'light') {
        slider.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="12" y1="21" x2="12" y2="23" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="1" y1="12" x2="3" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="21" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`;
    } else {
        slider.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
    }
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    localStorage.setItem('sga_theme', next);
}

// ========== ESTADO ==========
let dadosTabela = [];
let usuarioLogado = false;
let usuarioNome = '';
let filtroAtual = 'todos';
let formAberto = false;
let carregandoDados = false;
let paginaAtual = 1;
let itensPorPagina = 10;
let totalPaginas = 1;
let setorFiltro = '';

document.addEventListener('DOMContentLoaded', async () => {
    applyTheme(localStorage.getItem('sga_theme') || 'light'); // claro é o padrão
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);

    configurarClockifyAutocomplete();
    // Os projetos do Clockify não são buscados aqui: vêm sob demanda
    // (ver garantirProjetosClockify), fora do carregamento inicial.

    // A sessão de quem gerencia fica salva no dispositivo: se o token guardado
    // ainda valer, a página abre já logada, sem pedir o código de novo. Quem
    // não tem token não paga round-trip nenhum — restaurarSessao devolve null
    // sem falar com o banco.
    //
    // O restore vem ANTES de carregarDados de propósito: a tabela desenha os
    // botões de ação conforme usuarioLogado, então na ordem inversa a
    // primeira renderização sairia sem eles.
    const sessao = await restaurarSessao();
    if (sessao) {
        usuarioLogado = true;
        usuarioNome = sessao.nome || 'Gestor';
        atualizarHeader(true);
    }

    carregarDados();
});

// O formulário é um diálogo: "Nova Solicitação" abre o modal
// #modalFormOverlay. Quem fecha é o X, o Esc ou o clique fora dele.
function toggleFormulario() {
    const overlay = document.getElementById('modalFormOverlay');
    if (!overlay) return;
    formAberto = !formAberto;
    if (formAberto) {
        overlay.classList.add('active');
        const body = document.getElementById('formBody');
        if (body) body.scrollTop = 0;
        setTimeout(() => {
            const primeiro = overlay.querySelector('input:not([type="radio"]), select, textarea');
            if (primeiro) primeiro.focus();
        }, 60);
        // Aquece a lista de projetos do Clockify: quem abriu o formulário
        // provavelmente vai digitar o projeto em seguida. Sem await — o
        // formulário abre na hora, a busca corre por fora.
        garantirProjetosClockify();
    } else {
        overlay.classList.remove('active');
        limparFormulario();
    }
}

function toggleField(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) {
        el.classList.remove('hidden');
        const input = el.querySelector('input, textarea, select');
        if (input) setTimeout(() => input.focus(), 50);
    } else {
        el.classList.add('hidden');
    }
}

function toggleEye() {
    const input = document.getElementById('codigoAcesso');
    const icon = document.getElementById('toggleEye');
    if (input.type === 'password') {
        input.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        input.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function limparFormulario() {
    const form = document.getElementById('requestForm');
    if (form) form.reset();
    document.querySelectorAll('.conditional').forEach(el => el.classList.add('hidden'));
    const clienteInput = document.getElementById('clienteInput');
    if (clienteInput) clienteInput.value = '';
}

// ========== ACESSO ==========
function abrirModalLogin() {
    document.getElementById('modalLoginOverlay').classList.add('active');
    setTimeout(() => {
        const input = document.getElementById('codigoAcesso');
        if (input) input.focus();
    }, 50);
}

function fecharModalLogin() {
    document.getElementById('modalLoginOverlay').classList.remove('active');
    document.getElementById('loginErro').classList.add('hidden');
    document.getElementById('codigoAcesso').value = '';
}

async function logar() {
    const btn = document.getElementById('btnLogin');
    const codigo = document.getElementById('codigoAcesso').value.trim();
    const erroMsg = document.getElementById('loginErro');
    if (!codigo) {
        erroMsg.textContent = 'Digite o código.';
        erroMsg.classList.remove('hidden');
        return;
    }
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Entrando...';
    try {
        // O login_sga espera meio segundo antes de negar um código errado,
        // então o timeout precisa de folga sobre esse atraso proposital.
        const promise = autenticarUsuario(codigo);
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000));
        const resultado = await Promise.race([promise, timeout]);
        if (!resultado.sucesso) {
            erroMsg.textContent = resultado.mensagem;
            erroMsg.classList.remove('hidden');
        } else {
            usuarioLogado = true;
            usuarioNome = resultado.usuario.nome || 'Gestor';
            fecharModalLogin();
            atualizarHeader(true);
            mostrarToast(`Acesso liberado — ${usuarioNome}`, 'success');
            await carregarDados();
        }
    } catch (err) {
        console.error(err);
        erroMsg.textContent = 'Erro de conexão.';
        erroMsg.classList.remove('hidden');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Entrar';
    }
}

function atualizarHeader(logado) {
    const actions = document.getElementById('headerActions');
    if (!actions) return;
    const themeToggleHTML = `
        <button class="theme-toggle" id="themeToggle" title="Alternar tema claro/escuro">
            <div class="theme-toggle-slider" id="themeSlider"></div>
        </button>
    `;
    if (logado) {
        // Padrão dos outros sistemas: o perfil em tipo miúdo, caixa alta e
        // laranja, e Sair como botão de ícone só, sem moldura. O código de
        // acesso agora é individual, então dá para saudar pelo nome.
        actions.innerHTML = `
            <span class="header-perfil">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                ${escapeHtml(usuarioNome)}
            </span>
            <button class="btn-icone-topo" onclick="sair()" title="Sair">
                <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
            ${themeToggleHTML}
        `;
    } else {
        actions.innerHTML = `
            <button class="btn btn-ghost" onclick="abrirModalLogin()">
                <i class="fas fa-shield-alt"></i> Gestor
            </button>
            ${themeToggleHTML}
        `;
    }
    document.getElementById('themeToggle')?.addEventListener('click', toggleTheme);
    applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    atualizarVisibilidadeNovaSolicitacao();
}

function atualizarVisibilidadeNovaSolicitacao() {
    const card = document.getElementById('cardNovaSolicitacao');
    if (!card) return;
    if (usuarioLogado) {
        if (formAberto) toggleFormulario();
        card.classList.add('hidden');
    } else {
        card.classList.remove('hidden');
    }
}

async function sair() {
    usuarioLogado = false;
    usuarioNome = '';
    await encerrarSessao();
    atualizarHeader(false);
    mostrarToast('Logout realizado', 'info');
    dadosTabela = [];
    renderizarTabela();
    atualizarMetricas();
}

// ========== DADOS ==========
async function carregarDados() {
    if (carregandoDados) return;
    carregandoDados = true;
    try {
        dadosTabela = await listarSolicitacoes();
        console.log('✅ Dados carregados:', dadosTabela.length);
        renderizarTabela();
        atualizarMetricas();
    } catch (e) {
        console.error('❌ Erro ao carregar:', e);
    } finally {
        carregandoDados = false;
    }
}

function renderizarTabela() {
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    if (!tbody) return;

    let filtrados = dadosTabela;
    if (filtroAtual !== 'todos') {
        if (filtroAtual === 'finalizado') {
            filtrados = filtrados.filter(r => isFinalizado(r.status));
        } else {
            filtrados = filtrados.filter(r => r.status === filtroAtual);
        }
    }
    if (setorFiltro) {
        filtrados = filtrados.filter(r => r.solicitante_setor && r.solicitante_setor.toLowerCase().includes(setorFiltro.toLowerCase()));
    }

    if (filtrados.length === 0) {
        tbody.style.display = 'none';
        if (paginationContainer) paginationContainer.style.display = 'none';
        if (emptyState) { emptyState.classList.add('visible'); emptyState.style.display = 'block'; }
        atualizarPaginacao(0);
        return;
    }

    if (emptyState) { emptyState.classList.remove('visible'); emptyState.style.display = 'none'; }
    tbody.style.display = 'table-row-group';
    tbody.innerHTML = '';

    totalPaginas = Math.ceil(filtrados.length / itensPorPagina);
    if (paginaAtual > totalPaginas) paginaAtual = totalPaginas;
    if (paginaAtual < 1) paginaAtual = 1;

    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = inicio + itensPorPagina;
    const itensPagina = filtrados.slice(inicio, fim);
    const fragment = document.createDocumentFragment();

    itensPagina.forEach(item => {
        const tr = document.createElement('tr');

        let tipoMaterial = item.tipo_material_outro || item.tipo_material || '-';
        tipoMaterial = tipoMaterial.charAt(0).toUpperCase() + tipoMaterial.slice(1);

        let formatoHTML = '-';
        if (item.formatos && Array.isArray(item.formatos) && item.formatos.length > 0) {
            const fmts = item.formatos.filter(f => f && f !== 'outros');
            if (fmts.length <= 2) {
                formatoHTML = fmts.map(f => `<span class="formato-badge">${FORMATO_ICONS[f]||''} ${escapeHtml(f)}</span>`).join('');
            } else {
                formatoHTML = `<span class="formato-badge">${fmts.length} canais</span>`;
            }
            if (item.formato_outros) formatoHTML += `<span class="formato-badge-outros">${escapeHtml(item.formato_outros)}</span>`;
        }

        let prazoDisplay = '-';
        if (item.prazo_ideal) {
            prazoDisplay = new Date(item.prazo_ideal).toLocaleDateString('pt-BR');
            if (item.urgente) prazoDisplay = `<span style="color:#e74c3c;font-weight:600;"><i class="fas fa-exclamation-circle"></i> ${prazoDisplay}</span>`;
        }

        tr.innerHTML = `
            <td style="white-space:nowrap"><strong class="protocolo-text">${escapeHtml(item.protocolo || item.id)}</strong></td>
            <td class="td-texto" title="${escapeHtml(item.solicitante_nome || '-')}">${escapeHtml(item.solicitante_nome || '-')}</td>
            <td class="td-texto" title="${escapeHtml(item.solicitante_setor || '-')}">${escapeHtml(item.solicitante_setor || '-')}</td>
            <td class="td-texto" title="${escapeHtml(String(tipoMaterial).replace(/<[^>]*>/g, ''))}">${escapeHtml(tipoMaterial)}</td>
            <td class="td-texto">${formatoHTML}</td>
            <td>${prazoDisplay}</td>
            <td>${statusBadgeHTML(item)}</td>
            <td>${acoesHTMLFor(item)}</td>
        `;
        fragment.appendChild(tr);
    });

    tbody.appendChild(fragment);
    if (paginationContainer) paginationContainer.style.display = 'flex';
    atualizarPaginacao(filtrados.length);
}

function filtrarPorSetor() {
    setorFiltro = document.getElementById('filtroSetor').value;
    paginaAtual = 1;
    renderizarTabela();
}

function atualizarPaginacao(totalItens) {
    const infoEl = document.getElementById('paginationInfo');
    const container = document.getElementById('paginationContainer');
    const numbersEl = document.getElementById('paginationNumbers');
    if (!container || totalItens === 0) { if (container) container.style.display = 'none'; return; }
    container.style.display = 'flex';
    const inicio = (paginaAtual - 1) * itensPorPagina + 1;
    const fim = Math.min(paginaAtual * itensPorPagina, totalItens);
    if (infoEl) infoEl.textContent = `${inicio}-${fim} de ${totalItens}`;

    ['btnFirst','btnPrev','btnNext','btnLast'].forEach((id, i) => {
        const btn = document.getElementById(id);
        if (btn) {
            if (i === 0 || i === 1) btn.disabled = paginaAtual === 1;
            else btn.disabled = paginaAtual === totalPaginas;
        }
    });

    if (numbersEl) {
        numbersEl.innerHTML = '';
        let startPage = Math.max(1, paginaAtual - 2);
        let endPage = Math.min(totalPaginas, startPage + 4);
        if (endPage - startPage < 4) startPage = Math.max(1, endPage - 4);
        for (let i = startPage; i <= endPage; i++) {
            const btn = document.createElement('button');
            btn.className = `page-number ${i === paginaAtual ? 'active' : ''}`;
            btn.textContent = i;
            btn.onclick = () => mudarPagina(i);
            numbersEl.appendChild(btn);
        }
    }
}

function mudarPagina(p) { if (p < 1 || p > totalPaginas) return; paginaAtual = p; renderizarTabela(); }
function mudarItensPorPagina(v) { itensPorPagina = parseInt(v); paginaAtual = 1; renderizarTabela(); }
function filtrar(status, btn) { filtroAtual = status; paginaAtual = 1; document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active')); btn.classList.add('active'); renderizarTabela(); }

function buscar() {
    const termo = document.getElementById('searchInput').value.toLowerCase().trim();
    if (!termo) { renderizarTabela(); return; }
    const filtrados = dadosTabela.filter(item =>
        (item.solicitante_nome && item.solicitante_nome.toLowerCase().includes(termo)) ||
        (item.solicitante_cliente && item.solicitante_cliente.toLowerCase().includes(termo)) ||
        (item.protocolo && item.protocolo.toLowerCase().includes(termo)) ||
        (item.solicitante_setor && item.solicitante_setor.toLowerCase().includes(termo))
    );
    const tbody = document.getElementById('tableBody');
    const emptyState = document.getElementById('emptyState');
    const paginationContainer = document.getElementById('paginationContainer');
    if (filtrados.length === 0) {
        tbody.style.display = 'none'; if (paginationContainer) paginationContainer.style.display = 'none';
        if (emptyState) { emptyState.classList.add('visible'); emptyState.style.display = 'block'; }
        return;
    }
    if (emptyState) { emptyState.classList.remove('visible'); emptyState.style.display = 'none'; }
    tbody.style.display = 'table-row-group'; tbody.innerHTML = '';
    const fragment = document.createDocumentFragment();
    filtrados.forEach(item => {
        const tr = document.createElement('tr');
        let tipo = (item.tipo_material_outro || item.tipo_material || '-').charAt(0).toUpperCase() + (item.tipo_material_outro || item.tipo_material || '-').slice(1);
        tr.innerHTML = `
            <td><strong class="protocolo-text">${escapeHtml(item.protocolo || item.id)}</strong></td>
            <td>${escapeHtml(item.solicitante_nome || '-')}</td><td>${escapeHtml(item.solicitante_setor || '-')}</td><td>${escapeHtml(tipo)}</td><td>-</td>
            <td>${item.prazo_ideal ? new Date(item.prazo_ideal).toLocaleDateString('pt-BR') : '-'}</td>
            <td>${statusBadgeHTML(item)}</td>
            <td>${acoesHTMLFor(item)}</td>
        `;
        fragment.appendChild(tr);
    });
    tbody.appendChild(fragment); if (paginationContainer) paginationContainer.style.display = 'none';
}

async function salvarSolicitacao(e) {
    e.preventDefault();
    const form = e.target;
    let valido = true, primeiro = null;
    form.querySelectorAll('[required]').forEach(c => {
        if (!c.value.trim()) {
            if (c.type === 'radio') {
                const radios = form.querySelectorAll(`input[name="${c.name}"]`);
                if (!Array.from(radios).some(r => r.checked)) { valido = false; if (!primeiro) primeiro = radios[0]; }
            } else { valido = false; if (!primeiro) primeiro = c; }
        }
    });
    if (form.querySelectorAll('input[name="formato[]"]:checked').length === 0) {
        valido = false; if (!primeiro) primeiro = form.querySelector('input[name="formato[]"]');
    }
    if (!valido) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error');
        if (primeiro) { primeiro.scrollIntoView({ behavior: 'smooth', block: 'center' }); primeiro.focus(); }
        return;
    }

    const btn = document.getElementById('btnSubmit');
    const oldHTML = btn.innerHTML;
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    try {
        const fd = new FormData(form);
        const formatos = []; form.querySelectorAll('input[name="formato[]"]:checked').forEach(cb => formatos.push(cb.value));
        let cliente = document.getElementById('clienteInput').value.trim();
        if (cliente.startsWith('#')) cliente = cliente.substring(1);

        const payload = {
            solicitante_nome: fd.get('solicitante_nome'), solicitante_setor: fd.get('solicitante_setor'),
            solicitante_cliente: cliente || null,
            prazo_ideal: fd.get('prazo_ideal'), prazo_limite: fd.get('prazo_limite'),
            urgente: fd.get('urgente') === 'sim', urgencia_justificativa: fd.get('urgencia_justificativa') || null,
            tipo_material: fd.get('tipo_material'),
            tipo_material_outro: fd.get('tipo_material') === 'outro' ? fd.get('tipo_material_outro') : null,
            objetivo: fd.get('objetivo'), conteudo: fd.get('conteudo'), info_obrigatorias: fd.get('info_obrigatorias'),
            formatos, formato_outros: formatos.includes('outros') ? fd.get('formato_outros') : null,
            dimensoes: fd.get('dimensoes') || null, paginas: fd.get('paginas') ? parseInt(fd.get('paginas')) : null,
            identidade_visual: fd.get('identidade_visual') === 'sim', identidade_diretorio: fd.get('identidade_diretorio') || null,
            referencias_diretorio: fd.get('referencias_diretorio') || null, materiais_diretorio: fd.get('materiais_diretorio') || null,
            observacoes: fd.get('observacoes') || null, status: STATUS.NA_FILA, criado_em: new Date().toISOString()
        };
        const criada = await criarSolicitacao(payload);
        mostrarToast('Solicitação salva com sucesso!', 'success');
        toggleFormulario(); await carregarDados();
        const s = criada || payload;
        notificarTeams(
            `📋 Nova Solicitação — ${s.protocolo || 'SGA'}`,
            [
                { title: 'Solicitante', value: s.solicitante_nome },
                { title: 'Setor', value: s.solicitante_setor },
                { title: 'Tipo de Material', value: s.tipo_material },
                { title: 'Prazo Ideal', value: s.prazo_ideal || '—' },
                { title: 'Prazo Limite', value: s.prazo_limite || '—' },
                { title: 'Urgente', value: s.urgente ? '⚠️ Sim' : 'Não' },
            ],
            s.objetivo || null
        );
    } catch (err) { console.error(err); mostrarToast('Erro ao salvar: ' + err.message, 'error'); }
    finally { btn.disabled = false; btn.innerHTML = oldHTML; }
}

async function mudarStatus(id, novoStatus) {
    if (!usuarioLogado) { mostrarToast('Faça login como gestor', 'error'); return; }
    console.log('🔄 Mudando status:', { id, novoStatus });
    try {
        const atualizada = await atualizarStatus(id, novoStatus);

        const idx = dadosTabela.findIndex(d => d.id === id);
        if (idx !== -1) {
            dadosTabela[idx] = { ...dadosTabela[idx], ...atualizada };
        }

        renderizarTabela(); atualizarMetricas();
        mostrarToast('Status atualizado!', 'success');
        const item = dadosTabela.find(d => d.id === id);
        if (item) {
            notificarTeams(
                `🔄 Status Atualizado — ${item.protocolo || id}`,
                [
                    { title: 'Solicitante', value: item.solicitante_nome },
                    { title: 'Tipo de Material', value: item.tipo_material },
                    { title: 'Novo Status', value: getStatusLabel(novoStatus) },
                ],
                null
            );
        }
    } catch (err) {
        console.error('❌ Erro mudarStatus:', err);
        mostrarToast('Erro ao atualizar: ' + err.message, 'error');
        await carregarDados();
    }
}

async function excluirSolicitacao(id) {
    if (!usuarioLogado || !confirm('Excluir esta solicitação?')) return;
    try {
        await excluirSolicitacaoNoBanco(id);
        const idx = dadosTabela.findIndex(d => d.id === id);
        if (idx !== -1) { dadosTabela.splice(idx, 1); renderizarTabela(); atualizarMetricas(); }
        mostrarToast('Excluído com sucesso', 'success');
    } catch (err) { console.error(err); mostrarToast('Erro ao excluir: ' + err.message, 'error'); await carregarDados(); }
}

function verDetalhes(id) {
    const item = dadosTabela.find(d => d.id === id || d.protocolo === id);
    if (!item) return;
    const d = item;
    let html = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;padding:16px;background:linear-gradient(135deg,rgba(58,101,176,0.12),rgba(30,41,59,0.5));border-radius:var(--radius-lg);border:1px solid var(--border-color);">
        <div><span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;font-weight:600;">Protocolo</span><div class="protocolo-text" style="font-size:1.2rem;font-weight:700;margin-top:3px;">${escapeHtml(d.protocolo || d.id)}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;font-weight:600;">Status</span><div style="margin-top:6px;">${statusBadgeHTML(d)}</div></div>
        <div><span style="color:var(--text-muted);font-size:0.75rem;text-transform:uppercase;font-weight:600;">Data</span><div style="font-size:1rem;font-weight:600;margin-top:3px;">${d.criado_em ? new Date(d.criado_em).toLocaleDateString('pt-BR') : '-'}</div></div>
    </div>`;
    const sec = (i,t,c) => `<div style="margin-bottom:12px;border:1px solid var(--border-color);border-radius:var(--radius-md);overflow:hidden;"><div style="padding:10px 14px;background:rgba(58,101,176,0.06);border-bottom:1px solid var(--border-color);display:flex;align-items:center;gap:8px;"><i class="fas fa-${i}" style="color:var(--blue);"></i><span style="font-weight:600;font-size:0.85rem;">${t}</span></div><div style="padding:12px;">${c}</div></div>`;
    const fld = (l,v) => !v ? `<div style="margin-bottom:10px;min-width:0;"><strong style="color:var(--text-muted);font-size:0.75rem;">${l}</strong><div style="color:var(--text-muted);font-style:italic;font-size:0.85rem;">Não informado</div></div>` : `<div style="margin-bottom:10px;min-width:0;"><strong style="color:var(--text-muted);font-size:0.75rem;">${l}</strong><div style="background:var(--bg-input);padding:8px 12px;border-radius:var(--radius-sm);font-size:0.85rem;word-break:break-word;overflow-wrap:anywhere;white-space:pre-wrap;">${v}</div></div>`;

    html += sec('user','1. Solicitante',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;min-width:0;">${fld('Nome',escapeHtml(d.solicitante_nome))}${fld('Setor',escapeHtml(d.solicitante_setor))}${fld('Cliente',d.solicitante_cliente?`#${escapeHtml(d.solicitante_cliente)}`:null)}</div>`);
    html += sec('calendar-alt','2. Prazo',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;min-width:0;">${fld('Data Ideal',d.prazo_ideal?new Date(d.prazo_ideal).toLocaleDateString('pt-BR'):null)}${fld('Data Limite',d.prazo_limite?new Date(d.prazo_limite).toLocaleDateString('pt-BR'):null)}</div>${d.urgente?`<div style="background:rgba(231,76,60,0.1);padding:12px;border-radius:var(--radius-sm);border:1px solid rgba(231,76,60,0.3);margin-top:10px;word-break:break-word;overflow-wrap:anywhere;"><p style="color:#e74c3c;font-weight:700;margin-bottom:4px;">⚠️ URGENTE</p><p style="margin:0;">${escapeHtml(d.urgencia_justificativa||'-')}</p></div>`:''}`);
    html += sec('shapes','3. Tipo',`<p style="word-break:break-word;overflow-wrap:anywhere;"><strong>Tipo:</strong> <span style="background:var(--bg-input);padding:4px 10px;border-radius:var(--radius-sm);margin-left:6px;">${escapeHtml(d.tipo_material_outro||d.tipo_material||'-')}</span></p>`);
    html += sec('bullseye','4. Objetivo',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(d.objetivo||'-')}</p>`);
    html += sec('file-word','5. Conteúdo',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(d.conteudo||'-')}</p>`);
    html += sec('exclamation-circle','6. Obrigatórias',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(d.info_obrigatorias||'-')}</p>`);
    let fmts = ''; if(d.formatos) fmts = d.formatos.map(f=>`<span style="display:inline-block;padding:3px 8px;background:rgba(100,116,139,0.2);border-radius:var(--radius-sm);font-size:0.75rem;margin:2px;">${escapeHtml(f)}</span>`).join('');
    html += sec('expand','7. Formato',`<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;min-width:0;"><div style="min-width:0;">${fld('Canais',fmts||'-')}</div>${d.dimensoes?fld('Dimensões',escapeHtml(d.dimensoes)):''}${d.paginas?fld('Páginas',d.paginas.toString()):''}</div>`);
    if(d.identidade_visual) html += sec('palette','8. Identidade',`${fld('Diretório',escapeHtml(d.identidade_diretorio))}`);
    if(d.referencias_diretorio) html += sec('images','9. Referências',`${fld('Diretório',escapeHtml(d.referencias_diretorio))}`);
    if(d.materiais_diretorio) html += sec('folder-open','10. Materiais',`${fld('Diretório',escapeHtml(d.materiais_diretorio))}`);
    if(d.observacoes) html += sec('sticky-note','11. Observações',`<p style="background:var(--bg-input);padding:12px;border-radius:var(--radius-sm);white-space:pre-wrap;word-break:break-word;overflow-wrap:anywhere;">${escapeHtml(d.observacoes)}</p>`);
    document.getElementById('modalViewContent').innerHTML = html;
    document.getElementById('modalViewOverlay').classList.add('active');
}

function atualizarMetricas() {
    document.getElementById('metricTotal').textContent = dadosTabela.length;
    document.getElementById('metricFila').textContent = dadosTabela.filter(d => d.status === STATUS.NA_FILA).length;
    document.getElementById('metricProc').textContent = dadosTabela.filter(d => d.status === STATUS.EM_ANDAMENTO).length;
    document.getElementById('metricAjuste').textContent = dadosTabela.filter(d => d.status === STATUS.AJUSTES).length;
    // Conta tanto 'concluido' quanto 'finalizado' para o dashboard
    document.getElementById('metricDone').textContent = dadosTabela.filter(d => isFinalizado(d.status)).length;
}

function mostrarToast(msg, tipo='success') {
    const ex = document.querySelector('.toast-notification'); if(ex) ex.remove();
    const t = document.createElement('div'); t.className = `toast-notification ${tipo}`;
    t.innerHTML = `<i class="fas ${tipo==='success'?'fa-check-circle':tipo==='error'?'fa-exclamation-circle':'fa-info-circle'}"></i><span>${escapeHtml(msg)}</span>`;
    t.style.cssText = `position:fixed;top:70px;right:20px;padding:12px 18px;border-radius:8px;color:white;font-weight:600;z-index:9999;display:flex;align-items:center;gap:8px;font-size:0.85rem;box-shadow:0 8px 24px rgba(0,0,0,0.5);transform:translateX(400px);transition:transform 0.3s cubic-bezier(0.68,-0.55,0.265,1.55);background:${tipo==='success'?'#6CC24A':tipo==='error'?'#e74c3c':'#3A65B0'};`;
    document.body.appendChild(t); requestAnimationFrame(()=>t.style.transform='translateX(0)');
    setTimeout(()=>{ t.style.transform='translateX(400px)'; setTimeout(()=>t.remove(),300); },3000);
}

document.addEventListener('click', e => {
    if(e.target.id==='modalLoginOverlay') fecharModalLogin();
    if(e.target.id==='modalViewOverlay') e.target.classList.remove('active');
    if(e.target.id==='modalFormOverlay' && formAberto) toggleFormulario();
});
document.addEventListener('keydown', e => {
    if(e.key==='Escape') { if(formAberto) toggleFormulario(); else { fecharModalLogin(); document.getElementById('modalViewOverlay').classList.remove('active'); } }
});

// ========== PONTE COM O HTML ==========
// O index.html chama estas funções por `onclick`/`onchange`/`onkeyup`, e o
// mesmo vale para os botões que a tabela monta em tempo de execução. Como
// este arquivo é um módulo ES, nada aqui é global por padrão — a ponte é
// explícita.
window.toggleFormulario = toggleFormulario;
window.toggleField = toggleField;
window.limparFormulario = limparFormulario;
window.salvarSolicitacao = salvarSolicitacao;

window.abrirModalLogin = abrirModalLogin;
window.fecharModalLogin = fecharModalLogin;
window.logar = logar;
window.sair = sair;
window.toggleEye = toggleEye;

window.filtrar = filtrar;
window.filtrarPorSetor = filtrarPorSetor;
window.buscar = buscar;
window.mudarPagina = mudarPagina;
window.mudarItensPorPagina = mudarItensPorPagina;

window.verDetalhes = verDetalhes;
window.mudarStatus = mudarStatus;
window.excluirSolicitacao = excluirSolicitacao;
