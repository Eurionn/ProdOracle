// --- CONFIGURAÇÕES ---
const PALETTE = { navy: '#021a22', purple: '#9b59b6', tealDark: '#064044', tealLight: '#007672', orange: '#f28f00', yellow: '#ffb800', white: '#ffffff', textMuted: 'rgba(255,255,255,0.5)' };
Chart.defaults.color = PALETTE.textMuted;
Chart.defaults.borderColor = 'rgba(255,255,255,0.05)';
Chart.defaults.font.family = "'Outfit', sans-serif";

let chartPrevisao, chartDiario, chartRanking;
if (!localStorage.getItem('user_token')) window.location.href = 'login.html';

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('user-display').innerText = localStorage.getItem('user_name') || 'Admin';
    
    // Carrega a lista inicial
    carregarEstoque();
    carregarDashboardVendas(); // Se tiver essa função
    
    // --- CORREÇÃO AQUI ---
    const inputs = ['search-input', 'filter-category', 'filter-status'];
    
    inputs.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            // Usa 'input' para digitar e 'change' para selecionar opções
            elemento.addEventListener('input', () => carregarEstoque());
            elemento.addEventListener('change', () => carregarEstoque());
        }
    });
});

function logout() {
    if(confirm("Sair do sistema?")) {
        localStorage.removeItem('user_token');
        window.location.href = 'login.html';
    }
}

// --- SISTEMA DE TOASTS & MODAIS ---
function showToast(msg, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `custom-toast ${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
    toast.innerHTML = `<i class="fas ${icon} toast-icon"></i> <span>${msg}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function closeModal() {
    document.getElementById('genericModal').classList.remove('active');
}

// --- FUNÇÕES DE NEGÓCIO ---

// ABERTURA DE MODAL DE VENDA (COM DESCONTO)
function openVendaModal(id, nome, preco) {
    const modal = document.getElementById('genericModal');
    document.getElementById('modalTitle').innerText = "Nova Venda";
    
    document.getElementById('modalBody').innerHTML = `
        <div class="text-start mb-3">
            <label class="small text-muted">Produto</label>
            <div class="fw-bold fs-5 text-white">${nome}</div>
            <div class="small text-warning">Preço Unit: ${preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</div>
        </div>
        <input type="number" id="modalQtd" class="form-control mb-3" placeholder="Quantidade">
        <label class="small text-muted d-block text-start">Desconto (%)</label>
        <input type="number" id="modalDesc" class="form-control" placeholder="0%" value="0">
    `;

    document.getElementById('modalConfirmBtn').onclick = async () => {
        const qtd = document.getElementById('modalQtd').value;
        const desc = document.getElementById('modalDesc').value;
        if(!qtd) return showToast("Informe a quantidade!", "error");
        
        const res = await fetch('/api/vendas', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({produtoId: id, qtd: parseInt(qtd), descontoPorcento: parseInt(desc)})
        });

        if(res.ok) {
            showToast("Venda realizada com sucesso!", "success");
            closeModal();
            carregarEstoque();
            carregarDashboardVendas();
        } else {
            const err = await res.json();
            showToast(err.error || "Erro ao vender", "error");
        }
    };
    modal.classList.add('active');
}

// ABERTURA DE MODAL DE REPOSIÇÃO
function openReporModal(id, nome) {
    const modal = document.getElementById('genericModal');
    document.getElementById('modalTitle').innerText = "Repor Estoque";
    document.getElementById('modalBody').innerHTML = `
        <p class="text-white">Adicionar unidades ao produto: <br><strong>${nome}</strong></p>
        <input type="number" id="modalQtdRepor" class="form-control" placeholder="Quantidade a adicionar">
    `;

    document.getElementById('modalConfirmBtn').onclick = async () => {
        const qtd = document.getElementById('modalQtdRepor').value;
        if(!qtd) return showToast("Informe a quantidade!", "error");
        
        const res = await fetch('/api/estoque/repor', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({produtoId: id, qtd: parseInt(qtd)})
        });

        if(res.ok) {
            showToast("Estoque atualizado!", "success");
            closeModal();
            carregarEstoque();
        } else {
            showToast("Erro ao repor", "error");
        }
    };
    modal.classList.add('active');
}

// EXPORTAR RELATÓRIO (CSV)
async function exportarRelatorio() {
    const res = await fetch('/api/dashboard-vendas');
    const dados = await res.json();
    
    // Cabeçalho do CSV
    let csvContent = "data:text/csv;charset=utf-8,Data,Hora,Produto,Qtd,Total(R$)\n";
    
    // Linhas
    dados.ultimasTransacoes.forEach(t => {
        const d = new Date(t.data);
        const dataStr = d.toLocaleDateString();
        const horaStr = d.toLocaleTimeString();
        csvContent += `${dataStr},${horaStr},${t.nomeProduto},${t.qtd},${t.total}\n`;
    });

    // Download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "relatorio_vendas_prodoracle.csv");
    document.body.appendChild(link);
    link.click();
    showToast("Relatório baixado com sucesso!", "success");
}

// --- FUNÇÕES DE CARREGAMENTO (Estoque e Vendas) ---
async function carregarEstoque(filterText = '') {
    const res = await fetch('/api/produtos');
    const produtos = await res.json();
    
    // KPIs
    document.getElementById('kpi-total-itens').innerText = produtos.length;
    document.getElementById('kpi-estoque-total').innerText = produtos.reduce((acc,p)=>acc+p.estoque,0);
    document.getElementById('kpi-valor-total').innerText = produtos.reduce((acc,p)=>acc+(p.estoque*p.preco),0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    // [NOVO] LEITURA DOS FILTROS
    const termo = document.getElementById('search-input').value.toLowerCase();
    const categoria = document.getElementById('filter-category').value;
    const status = document.getElementById('filter-status').value;

    const lista = document.getElementById('lista-produtos');
    lista.innerHTML = '';

    // [NOVO] LÓGICA DE FILTRAGEM
    const filtrados = produtos.filter(p => {
        const matchNome = p.nome.toLowerCase().includes(termo);
        const matchCat = categoria === "" || p.categoria === categoria;
        let matchStatus = true;
        if (status === 'critical') matchStatus = p.estoque < 10;
        if (status === 'ok') matchStatus = p.estoque >= 10;
        return matchNome && matchCat && matchStatus;
    });

    if (filtrados.length === 0) {
        lista.innerHTML = '<li class="list-group-item text-center text-muted">Nenhum produto encontrado.</li>';
        return;
    }

    filtrados.forEach(p => {
        let badgeClass = p.estoque < 10 ? 'badge-danger' : (p.estoque < 20 ? 'badge-warning' : 'badge-success');
        let badgeText = p.estoque < 10 ? 'Crítico' : (p.estoque < 20 ? 'Baixo' : 'OK');
        
        lista.innerHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold text-white mb-1">${p.nome} <span class="badge ${badgeClass} ms-2" style="font-size: 0.7em;">${badgeText}</span></div>
                    <div class="small" style="color: var(--vibrant-teal)">
                        <i class="fas fa-box me-1"></i> ${p.estoque} un. | <span class="text-white opacity-50">${p.preco.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</span>
                    </div>
                </div>
<div class="d-flex justify-content-end">
    <button class="btn btn-vender-glow btn-sm me-1 rounded-circle d-flex align-items-center justify-content-center p-0" 
            style="width: 32px; height: 32px;" 
            onclick="openVendaModal(${p.id}, '${p.nome}', ${p.preco})" 
            title="Realizar Venda">
        <i class="fas fa-dollar-sign"></i>
    </button>

    <button class="btn btn-outline-success btn-sm me-1 rounded-circle d-flex align-items-center justify-content-center p-0" 
            style="width: 32px; height: 32px;" 
            onclick="openReporModal(${p.id}, '${p.nome}')" 
            title="Repor Estoque">
        <i class="fas fa-plus"></i>
    </button>

    <button class="btn btn-outline-light btn-sm me-1 rounded-circle d-flex align-items-center justify-content-center p-0" 
            style="width: 32px; height: 32px;" 
            onclick="prever(${p.id})" 
            title="Análise de IA">
        <i class="fas fa-chart-line"></i>
    </button>

    <button class="btn btn-outline-danger btn-sm rounded-circle d-flex align-items-center justify-content-center p-0" 
            style="width: 32px; height: 32px;" 
            onclick="deletar(${p.id})" 
            title="Excluir Produto">
        <i class="fas fa-trash"></i>
    </button>
</div>
            </li>
        `;
    });
}

async function adicionarProduto() {
    // Captura os elementos
    const nomeInput = document.getElementById('novo-prod-nome');
    const catInput = document.getElementById('novo-prod-categoria'); // Novo
    const estInput = document.getElementById('novo-prod-estoque');
    const precInput = document.getElementById('novo-prod-preco');

    const nome = nomeInput.value;
    const categoria = catInput.value; // Novo valor
    const estoque = Number(estInput.value);
    const preco = Number(precInput.value);

    // Validação
    if(!nome || !categoria || !estoque || !preco) {
        return showToast("Preencha todos os campos, incluindo a categoria!", "error");
    }

    // Envia ao Backend
    await fetch('/api/produtos', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            nome, 
            categoria, // Envia a categoria selecionada
            estoque, 
            preco
        })
    });
    
    // Limpa os campos
    nomeInput.value = '';
    catInput.value = ''; // Reseta o select
    estInput.value = '';
    precInput.value = '';
    
    showToast("Produto adicionado com sucesso!", "success");
    carregarEstoque();
}

async function deletar(id) {
    // Usamos confirm nativo aqui por segurança rápida, mas poderia ser modal também
    if(confirm("Remover este produto permanentemente?")) {
        await fetch(`/api/produtos/${id}`, {method: 'DELETE'});
        showToast("Produto removido.", "info");
        carregarEstoque();
    }
}

async function prever(id) {
    try {
        const res = await fetch(`/api/previsao/${id}`);
        const data = await res.json();

        if(!res.ok) return showToast("Dados insuficientes para IA", "error");

        document.getElementById('msg-inicial').style.display = 'none';
        document.getElementById('conteudo-analise').style.display = 'block';
        document.getElementById('titulo-produto').innerText = data.nome;
        document.getElementById('valor-previsao').innerText = data.previsaoProximoMes;
        
        const insightBox = document.getElementById('insight-box');
        const isGrowth = data.insight.includes("CRESCIMENTO");
        insightBox.innerHTML = isGrowth 
            ? `<i class="fas fa-arrow-trend-up me-2"></i> ${data.insight}` 
            : `<i class="fas fa-arrow-trend-down me-2"></i> ${data.insight}`;
        insightBox.style.background = isGrowth ? 'rgba(25, 135, 84, 0.2)' : 'rgba(255, 193, 7, 0.1)';
        insightBox.style.color = isGrowth ? '#2ecc71' : PALETTE.yellow;

        const ctx = document.getElementById('graficoPrevisao').getContext('2d');
        const nomesMeses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        
        // 1. CORREÇÃO DE LABEL: Mapeia os meses do histórico
        const grafLabels = data.historico.map(h => nomesMeses[(h.mes - 1) % 12]);
        
        // 2. PREVISÃO DINÂMICA: Calcula o próximo mês
        // Se o último foi Jan (13), o próximo é Fev (1)
        const ultimoMesNumero = data.historico.length > 0 ? data.historico[data.historico.length-1].mes : 12;
        const nomeProximoMes = nomesMeses[(ultimoMesNumero) % 12];
        grafLabels.push(`${nomeProximoMes} (Prev)`);
        
        const grafData = data.historico.map(h => h.qtd);
        grafData.push(data.previsaoProximoMes);

        // 3. CORREÇÃO DE COR: Roxo para IA, Laranja para Real
        const pointColors = data.historico.map(h => {
            return h.tipo === 'ESTIMADO' ? PALETTE.purple : PALETTE.orange;
        });
        pointColors.push(PALETTE.yellow); // Futuro

        if(chartPrevisao) chartPrevisao.destroy();
        
        // Gradiente de Fundo
        let gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(242, 143, 0, 0.5)'); 
        gradient.addColorStop(1, 'rgba(242, 143, 0, 0.0)'); 

        chartPrevisao = new Chart(ctx, {
            type: 'line',
            data: {
                labels: grafLabels,
                datasets: [{
                    label: 'Demanda',
                    data: grafData,
                    borderColor: PALETTE.orange,
                    backgroundColor: gradient,
                    borderWidth: 2,
                    tension: 0.4,
                    pointBackgroundColor: pointColors,
                    pointRadius: 6
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) {
        console.error(e);
        alert("Erro ao gerar gráfico");
    }
}

async function carregarDashboardVendas() {
    const res = await fetch('/api/dashboard-vendas');
    const dados = await res.json();

    document.getElementById('dash-faturamento').innerText = dados.kpis.totalVendas.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
    document.getElementById('dash-qtd').innerText = dados.kpis.qtdVendas;
    document.getElementById('dash-ticket').innerText = dados.kpis.ticketMedio.toLocaleString('pt-BR',{style:'currency',currency:'BRL'});

    const tbody = document.getElementById('tabela-transacoes');
    tbody.innerHTML = '';
    dados.ultimasTransacoes.forEach(t => {
        const d = new Date(t.data);
        tbody.innerHTML += `<tr><td class="ps-4 text-muted small">${d.toLocaleDateString()} ${d.toLocaleTimeString().slice(0,5)}</td><td class="fw-bold text-dark">${t.nomeProduto}</td><td class="text-center"><span class="badge bg-secondary">${t.qtd}</span></td><td class="text-end pe-4" style="color: var(--vibrant-teal)">+ ${t.total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</td></tr>`;
    });

    // Gráficos de Venda (Diário e Ranking) - Código simplificado para brevidade (mantém o mesmo visual)
    const ctxDiario = document.getElementById('graficoDiario').getContext('2d');
    let gradVerde = ctxDiario.createLinearGradient(0, 0, 0, 400);
    gradVerde.addColorStop(0, 'rgba(0, 118, 114, 0.6)'); gradVerde.addColorStop(1, 'rgba(0, 118, 114, 0)');
    if(chartDiario) chartDiario.destroy();
    chartDiario = new Chart(ctxDiario, { type: 'line', data: { labels: Object.keys(dados.graficoDiario), datasets: [{ label: 'Vendas (R$)', data: Object.values(dados.graficoDiario), borderColor: PALETTE.tealLight, backgroundColor: gradVerde, fill: true, tension: 0.4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false } }, y: { grid: { color: 'rgba(255,255,255,0.05)' } } } } });

    const ctxRanking = document.getElementById('graficoRanking').getContext('2d');
    if(chartRanking) chartRanking.destroy();
    chartRanking = new Chart(ctxRanking, { type: 'bar', indexAxis: 'y', data: { labels: dados.rankingProdutos.map(r => r.nome), datasets: [{ label: 'Faturamento', data: dados.rankingProdutos.map(r => r.total), backgroundColor: [PALETTE.orange, PALETTE.yellow, PALETTE.gold, PALETTE.tealLight, PALETTE.tealDark], borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { display: false }, y: { grid: { display: false }, ticks: { color: 'white' } } } } });
}