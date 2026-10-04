# Tempo · Previsão do tempo

App de previsão do tempo feito com HTML, CSS e JavaScript puros, consumindo a API pública [Open-Meteo](https://open-meteo.com/) (sem chave de API).

## Funcionalidades

- Busca de cidades com debounce e cancelamento de requisições antigas (`AbortController`)
- Geolocalização do navegador
- Condições atuais e previsão de 7 dias, com barras que mostram a faixa de temperatura de cada dia
- Alternância entre °C e °F, convertida só na exibição
- Cidades favoritas e última cidade salvas no `localStorage`
- Fundo que muda conforme o clima e o horário (dia, noite, chuva, neve, neblina, tempestade)
- Estados de carregamento, erro com botão "Tentar de novo" e busca sem resultados

## O que o projeto demonstra

- `fetch` com `async/await`, tratamento de erros e `URLSearchParams`
- Estado simples em JavaScript e renderização sem `innerHTML`
- CSS com variáveis trocadas por atributo (`data-clima`), Grid, Flexbox e layout responsivo
- Acessibilidade: `role="status"`, `aria-busy`, rótulos nos ícones, foco visível e `prefers-reduced-motion`

## Como rodar

Abra o `index.html` no navegador. A geolocalização só funciona em `https://` ou `localhost`, por exemplo no GitHub Pages.
