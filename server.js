const express = require('express');
const cors = require('cors');
const ss = require('simple-statistics'); 
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// --- DADOS ---
let users = [{ name: "Admin", email: "admin@prodoracle.com", password: "123" }];
let produtos = [
    { id: 1, nome: "Placa de Vídeo RTX 4060", categoria: "Hardware", estoque: 12, preco: 2100 },
    { id: 2, nome: "Processador Ryzen 7 5700X", categoria: "Hardware", estoque: 25, preco: 1300 },
    { id: 3, nome: "Monitor 144Hz IPS 24'", categoria: "Monitores", estoque: 40, preco: 950 },
    { id: 4, nome: "Cadeira Gamer Ergô", categoria: "Cadeiras", estoque: 8, preco: 1200 },
    { id: 5, nome: "Teclado Mecânico RGB", categoria: "Periféricos", estoque: 60, preco: 250 },
    { id: 6, nome: "Mouse Gamer 12000DPI", categoria: "Periféricos", estoque: 85, preco: 120 },
    { id: 7, nome: "Headset 7.1 Surround", categoria: "Periféricos", estoque: 30, preco: 350 },
    { id: 8, nome: "SSD NVMe 1TB", categoria: "Hardware", estoque: 50, preco: 400 }
];
let vendas = [];
let transacoes = [];

// --- GERADORES (MANTIDOS) ---
const gerarHistoricoIA = (prod) => {
    let baseVendas = prod.preco > 1000 ? 5 : 20; 
    if (prod.preco > 3000) baseVendas = 2;
    for (let mes = 1; mes <= 12; mes++) {
        let fatorSazonal = mes === 11 ? 2.5 : 1.0; 
        let variacao = (Math.random() * 0.4) + 0.8;
        let qtdCalculada = Math.floor(baseVendas * fatorSazonal * variacao);
        if (qtdCalculada < 1) qtdCalculada = 1;
        vendas.push({ produtoId: prod.id, mes: mes, qtd: qtdCalculada, tipo: 'ESTIMADO' });
    }
};

const gerarTransacoesMesAtual = () => {
    const hoje = new Date();
    for (let i = 15; i >= 0; i--) {
        const dataSimulada = new Date();
        dataSimulada.setDate(hoje.getDate() - i);
        const numVendasDia = Math.floor(Math.random() * 5) + 3;
        for (let v = 0; v < numVendasDia; v++) {
            const prod = produtos[Math.floor(Math.random() * produtos.length)];
            const qtd = Math.floor(Math.random() * 3) + 1;
            transacoes.push({
                id: Date.now() + Math.random(),
                produtoId: prod.id,
                nomeProduto: prod.nome,
                qtd: qtd,
                total: qtd * prod.preco,
                desconto: 0, // Mockado sem desconto
                valorFinal: qtd * prod.preco,
                data: dataSimulada
            });
            vendas.push({ produtoId: prod.id, mes: 13, qtd: qtd, tipo: 'REAL' });
        }
    }
};

produtos.forEach(p => gerarHistoricoIA(p));
gerarTransacoesMesAtual();

// --- ROTAS AUTH (MANTIDAS) ---
app.post('/api/auth/register', (req, res) => {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: "Preencha todos os campos." });
    if (users.find(u => u.email === email)) return res.status(400).json({ error: "Email já cadastrado." });
    users.push({ name, email, password });
    res.json({ msg: "Criado com sucesso!" });
});

app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    const user = users.find(u => u.email === email && u.password === password);
    user ? res.json({ success: true, user: { name: user.name, email: user.email } }) 
         : res.status(401).json({ error: "Dados incorretos." });
});

// --- ROTAS SISTEMA ---
app.get('/api/produtos', (req, res) => res.json(produtos));

app.post('/api/produtos', (req, res) => {
    const novoProduto = { id: Date.now(), ...req.body };
    produtos.push(novoProduto);
    gerarHistoricoIA(novoProduto);
    res.json(novoProduto);
});

app.delete('/api/produtos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    produtos = produtos.filter(p => p.id !== id);
    res.json({ msg: "Deletado" });
});

// ROTA DE VENDA ATUALIZADA (Com Desconto)
app.post('/api/vendas', (req, res) => {
    const { produtoId, qtd, descontoPorcento } = req.body; // Recebe desconto
    const produtoIndex = produtos.findIndex(p => p.id == produtoId);
    
    if (produtoIndex > -1) {
        if (produtos[produtoIndex].estoque < qtd) return res.status(400).json({ error: "Estoque insuficiente!" });
        
        const prod = produtos[produtoIndex];
        prod.estoque -= qtd;
        
        const valorOriginal = parseInt(qtd) * prod.preco;
        const valorDesconto = valorOriginal * (descontoPorcento / 100);
        const valorFinal = valorOriginal - valorDesconto;

        const novaTransacao = {
            id: Date.now(),
            produtoId: prod.id,
            nomeProduto: prod.nome,
            qtd: parseInt(qtd),
            total: valorFinal, // Salva o valor já com desconto
            desconto: descontoPorcento,
            data: new Date()
        };
        transacoes.unshift(novaTransacao);
        vendas.push({ produtoId: prod.id, mes: 13, qtd: parseInt(qtd), tipo: 'REAL' });
        
        res.json({ msg: "Venda registrada!" });
    } else {
        res.status(404).json({ error: "Produto não encontrado" });
    }
});

app.post('/api/estoque/repor', (req, res) => {
    const { produtoId, qtd } = req.body;
    const produtoIndex = produtos.findIndex(p => p.id == produtoId);
    if (produtoIndex > -1) {
        produtos[produtoIndex].estoque += parseInt(qtd);
        res.json({ msg: "Estoque atualizado!" });
    } else {
        res.status(404).json({ error: "Produto não encontrado" });
    }
});

app.get('/api/dashboard-vendas', (req, res) => {
    const totalVendas = transacoes.reduce((acc, t) => acc + t.total, 0);
    const qtdVendas = transacoes.length;
    const ticketMedio = qtdVendas > 0 ? totalVendas / qtdVendas : 0;
    
    const vendasPorDia = {};
    transacoes.forEach(t => {
        const d = new Date(t.data);
        const dia = `${d.getDate()}/${d.getMonth() + 1}`;
        if (!vendasPorDia[dia]) vendasPorDia[dia] = 0;
        vendasPorDia[dia] += t.total;
    });

    const ranking = {};
    transacoes.forEach(t => {
        if (!ranking[t.nomeProduto]) ranking[t.nomeProduto] = 0;
        ranking[t.nomeProduto] += t.total;
    });
    
    const rankingArray = Object.entries(ranking)
        .map(([nome, total]) => ({ nome, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

    res.json({
        kpis: { totalVendas, qtdVendas, ticketMedio },
        graficoDiario: vendasPorDia,
        rankingProdutos: rankingArray,
        ultimasTransacoes: transacoes.slice(0, 10)
    });
});

app.get('/api/previsao/:produtoId', (req, res) => {
    const id = parseInt(req.params.produtoId);
    const produto = produtos.find(p => p.id === id);
    const historico = vendas.filter(v => v.produtoId === id);
    if (historico.length < 2) return res.status(400).json({ error: "Dados insuficientes" });

    const dados = historico.map(v => [v.mes, v.qtd]);
    const linha = ss.linearRegressionLine(ss.linearRegression(dados));
    const prev = Math.ceil(linha(14));
    
    res.json({
        produtoId: id,
        nome: produto?.nome,
        preco: produto?.preco,
        historico: historico,
        previsaoProximoMes: prev < 0 ? 0 : prev,
        insight: prev > historico[historico.length-1].qtd ? "📈 Tendência de CRESCIMENTO" : "📉 Tendência de ESTABILIDADE"
    });
});

app.listen(3000, () => console.log("ProdOracle Ultimate rodando na porta 3000"));