(() => {
  'use strict';

  /* ---------- Configuração ---------- */
  const API_GEO = 'https://geocoding-api.open-meteo.com/v1/search';
  const API_PREVISAO = 'https://api.open-meteo.com/v1/forecast';
  const CHAVES = { favoritos: 'tempo:favoritos', ultimo: 'tempo:ultimo', unidade: 'tempo:unidade' };
  const LOCAL_PADRAO = { nome: 'São Paulo', regiao: 'São Paulo, Brasil', lat: -23.55, lon: -46.63 };

  // Códigos WMO retornados pela API: [códigos, texto, ícone, categoria do fundo]
  const CODIGOS = [
    [[0], 'Céu limpo', '☀️', 'limpo'],
    [[1], 'Poucas nuvens', '🌤️', 'limpo'],
    [[2], 'Parcialmente nublado', '⛅', 'nublado'],
    [[3], 'Nublado', '☁️', 'nublado'],
    [[45, 48], 'Neblina', '🌫️', 'neblina'],
    [[51, 53, 55, 56, 57], 'Garoa', '🌦️', 'chuva'],
    [[61, 63, 65, 66, 67, 80, 81, 82], 'Chuva', '🌧️', 'chuva'],
    [[71, 73, 75, 77, 85, 86], 'Neve', '🌨️', 'neve'],
    [[95, 96, 99], 'Trovoada', '⛈️', 'tempestade'],
  ];
  const descrever = (codigo) => CODIGOS.find(([codigos]) => codigos.includes(codigo)) ?? [[], 'Indisponível', '❔', 'nublado'];

  /* ---------- Elementos e estado ---------- */
  const $ = (seletor) => document.querySelector(seletor);
  const campo = $('#cidade');
  const sugestoes = $('#sugestoes');
  const statusEl = $('#status');
  const painel = $('#painel');

  let local = lerArmazenado(CHAVES.ultimo, LOCAL_PADRAO);
  let favoritos = lerArmazenado(CHAVES.favoritos, []);
  let unidade = lerArmazenado(CHAVES.unidade, 'C');
  let dados = null;
  let controladorPrevisao;
  let controladorBusca;
  let timerBusca;

  /* ---------- Utilitários ---------- */
  function lerArmazenado(chave, padrao) {
    try { return JSON.parse(localStorage.getItem(chave)) ?? padrao; } catch { return padrao; }
  }
  function gravar(chave, valor) {
    try { localStorage.setItem(chave, JSON.stringify(valor)); } catch { /* storage indisponível */ }
  }

  // Cria elementos com textContent, sem innerHTML
  function el(tag, { classe, texto, ...atributos } = {}, ...filhos) {
    const no = document.createElement(tag);
    if (classe) no.className = classe;
    if (texto != null) no.textContent = texto;
    for (const [chave, valor] of Object.entries(atributos)) no.setAttribute(chave, valor);
    no.append(...filhos);
    return no;
  }

  // Os dados chegam sempre em °C; a conversão acontece só na exibição
  const temperatura = (c) => `${Math.round(unidade === 'C' ? c : (c * 9) / 5 + 32)}°`;
  const mesmoLocal = (a, b) => a.lat === b.lat && a.lon === b.lon;

  async function buscarJSON(url, signal) {
    const resposta = await fetch(url, { signal });
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
    return resposta.json();
  }

  function avisar(mensagem, tentarNovamente) {
    statusEl.replaceChildren(mensagem);
    if (tentarNovamente) {
      const botao = el('button', { type: 'button', classe: 'btn', texto: 'Tentar de novo' });
      botao.addEventListener('click', tentarNovamente);
      statusEl.append(botao);
    }
  }

  /* ---------- Previsão ---------- */
  async function carregarPrevisao(novoLocal) {
    local = novoLocal;
    gravar(CHAVES.ultimo, local);
    controladorPrevisao?.abort(); // cancela requisição anterior ainda em andamento
    controladorPrevisao = new AbortController();
    painel.setAttribute('aria-busy', 'true');
    avisar('Carregando previsão…');

    const parametros = new URLSearchParams({
      latitude: local.lat,
      longitude: local.lon,
      current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: 'auto',
      forecast_days: 7,
    });

    try {
      dados = await buscarJSON(`${API_PREVISAO}?${parametros}`, controladorPrevisao.signal);
      renderizar();
      avisar('');
    } catch (erro) {
      if (erro.name === 'AbortError') return;
      avisar('Não foi possível carregar a previsão. Verifique sua conexão.', () => carregarPrevisao(local));
    } finally {
      painel.removeAttribute('aria-busy');
    }
  }

  function renderizar() {
    const atual = dados.current;
    const diario = dados.daily;
    const [, texto, icone, categoria] = descrever(atual.weather_code);
    const noite = atual.is_day === 0;

    // Fundo: à noite, céu limpo/nublado/neblina usam o tema "noite"
    document.documentElement.dataset.clima =
      noite && ['limpo', 'nublado', 'neblina'].includes(categoria) ? 'noite' : categoria;

    $('#local').textContent = local.nome;
    $('#regiao').textContent = local.regiao;
    $('#icone').textContent = noite && atual.weather_code <= 1 ? '🌙' : icone;
    $('#temp').textContent = temperatura(atual.temperature_2m);
    $('#descricao').textContent = texto;
    $('#sensacao').textContent = temperatura(atual.apparent_temperature);
    $('#umidade').textContent = `${atual.relative_humidity_2m}%`;
    $('#vento').textContent = `${Math.round(atual.wind_speed_10m)} km/h`;
    $('#chuva').textContent = `${diario.precipitation_probability_max[0] ?? 0}%`;
    $('#hora').textContent = `Atualizado às ${atual.time.slice(11)} (horário local)`;
    $('#btn-unidade').textContent = unidade === 'C' ? 'Ver em °F' : 'Ver em °C';

    renderizarDias(diario);
    renderizarFavoritos();
    painel.hidden = false;
  }

  function renderizarDias(diario) {
    const minimo = Math.min(...diario.temperature_2m_min);
    const maximo = Math.max(...diario.temperature_2m_max);
    const amplitude = maximo - minimo || 1;

    $('#dias').replaceChildren(...diario.time.map((data, i) => {
      const [, descricao, icone] = descrever(diario.weather_code[i]);
      const min = diario.temperature_2m_min[i];
      const max = diario.temperature_2m_max[i];
      const nome = i === 0
        ? 'Hoje'
        : new Date(`${data}T12:00`).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');

      // A barra mostra onde a faixa do dia fica dentro da amplitude da semana
      const largura = Math.max(((max - min) / amplitude) * 100, 8);
      const esquerda = Math.min(((min - minimo) / amplitude) * 100, 100 - largura);
      const probabilidade = diario.precipitation_probability_max[i] ?? 0;

      return el('li', { classe: 'dia' },
        el('span', { classe: 'dia-nome', texto: nome }),
        el('span', { role: 'img', 'aria-label': descricao, texto: icone }),
        el('span', { classe: 'min', texto: temperatura(min) }),
        el('span', { classe: 'faixa', 'aria-hidden': 'true' }, el('i', { style: `left:${esquerda}%;width:${largura}%` })),
        el('span', { classe: 'max', texto: temperatura(max) }),
        el('span', { classe: 'prob', texto: `${probabilidade}%`, 'aria-label': `Chance de chuva: ${probabilidade}%` }));
    }));
  }

  /* ---------- Busca de cidades ---------- */
  async function buscarCidades(termo) {
    controladorBusca?.abort();
    if (termo.trim().length < 2) { sugestoes.replaceChildren(); return; }
    controladorBusca = new AbortController();

    try {
      const parametros = new URLSearchParams({ name: termo.trim(), count: 5, language: 'pt', format: 'json' });
      const resposta = await buscarJSON(`${API_GEO}?${parametros}`, controladorBusca.signal);
      const cidades = resposta.results ?? []; // a API omite "results" quando não acha nada

      sugestoes.replaceChildren(...(cidades.length
        ? cidades.map(criarSugestao)
        : [el('li', { classe: 'vazio', texto: 'Nenhuma cidade encontrada. Confira a grafia.' })]));
    } catch (erro) {
      if (erro.name !== 'AbortError') {
        sugestoes.replaceChildren(el('li', { classe: 'vazio', texto: 'A busca falhou. Tente de novo em instantes.' }));
      }
    }
  }

  function criarSugestao(cidade) {
    const regiao = [cidade.admin1, cidade.country].filter(Boolean).join(', ');
    const botao = el('button', { type: 'button', texto: cidade.name }, el('small', { texto: regiao }));
    botao.addEventListener('click', () => {
      escolher({ nome: cidade.name, regiao, lat: cidade.latitude, lon: cidade.longitude });
    });
    return el('li', {}, botao);
  }

  function escolher(novoLocal) {
    sugestoes.replaceChildren();
    campo.value = '';
    carregarPrevisao(novoLocal);
  }

  /* ---------- Favoritos ---------- */
  function renderizarFavoritos() {
    const salva = favoritos.some((f) => mesmoLocal(f, local));
    $('#btn-fav').textContent = salva ? 'Remover dos favoritos' : 'Salvar cidade';

    const nav = $('#favoritos');
    nav.hidden = favoritos.length === 0;
    nav.replaceChildren(...favoritos.map((fav) => {
      const botao = el('button', { type: 'button', texto: fav.nome });
      if (mesmoLocal(fav, local)) botao.setAttribute('aria-current', 'true');
      botao.addEventListener('click', () => carregarPrevisao(fav));
      return botao;
    }));
  }

  /* ---------- Eventos ---------- */
  campo.addEventListener('input', () => {
    clearTimeout(timerBusca); // debounce: espera o usuário parar de digitar
    timerBusca = setTimeout(() => buscarCidades(campo.value), 350);
  });

  $('#form-busca').addEventListener('submit', (e) => {
    e.preventDefault();
    clearTimeout(timerBusca);
    buscarCidades(campo.value);
  });

  $('#form-busca').addEventListener('keydown', (e) => {
    if (e.key === 'Escape') sugestoes.replaceChildren();
  });

  $('#btn-local').addEventListener('click', () => {
    if (!('geolocation' in navigator)) { avisar('Seu navegador não oferece geolocalização.'); return; }
    avisar('Obtendo sua localização…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => carregarPrevisao({
        nome: 'Minha localização',
        regiao: '',
        lat: +coords.latitude.toFixed(2),
        lon: +coords.longitude.toFixed(2),
      }),
      () => avisar('Não foi possível acessar sua localização. Permita o acesso ou busque pelo nome da cidade.'),
      { timeout: 10000 },
    );
  });

  $('#btn-fav').addEventListener('click', () => {
    favoritos = favoritos.some((f) => mesmoLocal(f, local))
      ? favoritos.filter((f) => !mesmoLocal(f, local))
      : [...favoritos, local];
    gravar(CHAVES.favoritos, favoritos);
    renderizarFavoritos();
  });

  $('#btn-unidade').addEventListener('click', () => {
    unidade = unidade === 'C' ? 'F' : 'C';
    gravar(CHAVES.unidade, unidade);
    if (dados) renderizar();
  });

  /* ---------- Início ---------- */
  carregarPrevisao(local);
})();
