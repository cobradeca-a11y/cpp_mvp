# Auditoria 24.1 — Invalidação profissional de cache frontend/PWA validada

## Status

Aprovada em validação local visual.

## Objetivo

Evitar que o navegador/PWA continue executando arquivos JavaScript antigos após `git pull`, especialmente em auditorias que alteram:

```txt
index.html
service-worker.js
src/app.js
src/modules/*.js
```

## Implementação registrada

Commits da implementação:

```txt
d000e93 Version frontend service worker cache
b07af9f Add frontend build marker and cache clear control
8e97947 Wire frontend cache clear action
```

## Comportamento implementado

### Service Worker

O cache passou a ter versão explícita:

```txt
audit-24-1-cache-v1
```

O `service-worker.js` agora:

- usa `CACHE_NAME` versionado;
- apaga caches antigos `cpp-professional-omr-*` no `activate`;
- usa `networkFirst` para assets críticos de frontend;
- aplica cache busting com `?v=audit-24-1-cache-v1`;
- permite mensagem interna para limpeza de cache.

### HTML

O `index.html` agora:

- carrega `manifest.json`, `styles.css` e `app.js` com query versionada;
- mostra a versão do frontend na interface;
- exibe o botão `Limpar cache do app`.

### App JS

O `src/app.js` agora:

- define `FRONTEND_BUILD = "audit-24-1-cache-v1"`;
- injeta/atualiza o build visível na tela;
- registra o Service Worker com versão;
- liga o botão `Limpar cache do app`;
- remove Service Workers/caches do CPP e recarrega a página.

## Validação local

Após `git pull origin main`, a tela do app exibiu corretamente:

```txt
cpp_pro
Conversor Profissional de Partituras — OMR, MusicXML, Revisão e Cifra Tocável

Frontend build: audit-24-1-cache-v1

1. Processamento profissional
Fluxo principal: PDF/imagem → OMR profissional → MusicXML → CPP JSON → revisão → cifra.

Backend OMR
http://localhost:8787
Verificar backend
Limpar cache do app
```

## Testes automatizados

Executado localmente:

```bat
cd backend
pytest
```

Resultado:

```txt
8 passed
```

## Resultado

A Auditoria 24.1 está validada:

```txt
Frontend build visível: OK
Botão Limpar cache do app visível: OK
Backend URL preservado: OK
pytest: 8 passed
```

## Importância para as próximas auditorias

Essa auditoria reduz risco de falso negativo em testes futuros, evitando cenários em que:

```txt
backend novo
protocolo novo
frontend antigo em cache
relatório antigo
```

## Próxima auditoria recomendada

```txt
Auditoria 25 — classificar melhor text_blocks OCR
```

Alvo da próxima etapa:

- instrumentos;
- letra;
- sílabas quebradas;
- pontuação;
- ruídos OCR;
- símbolos musicais confundidos;
- possíveis cifras;
- separação entre evidência textual e evidência musical.

## Conclusão

Auditoria 24.1 aprovada e pronta para servir como base segura para as próximas alterações de frontend/PWA.
