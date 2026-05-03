# Auditoria 24 — Validação frontend, OCR/Fusion e problema de cache

## Status

Validação visual aprovada após recarregamento limpo do frontend.

## Sintoma observado

Após atualizar o código da Auditoria 24, o protocolo exportado já continha os campos corretos:

```txt
ocr.status = success
fusion.status = evidence_indexed_needs_layout_mapping
fusion.inputs.text_blocks_count = 77
fusion.inputs.measures_count = 35
```

Mas o `outputs.detection_report` ainda exibia texto antigo:

```txt
Nenhum texto/cifra complementar registrado ainda. OCR/fusão ainda não executados.
```

Isso indicou que o navegador/PWA ainda estava executando JavaScript antigo, mesmo com backend e protocolo atualizados.

## Causa técnica

O problema não era o backend nem o JSON.

A causa foi cache de frontend / Service Worker / cache HTTP local, mantendo módulos JS antigos, especialmente:

```txt
src/app.js
src/modules/feedback-engine.js
```

Como o relatório é gerado no frontend, se o navegador carrega uma versão antiga desses arquivos, o JSON pode estar correto e a saída textual ainda ficar errada.

## Validação final após limpeza/reload

Depois de limpar/recarregar o frontend, a tela passou a exibir corretamente:

```txt
Processamento concluído.
Motor OMR: Audiveris/MusicXML
Status OMR: success
Compassos importados: 35
Motor OCR: google_vision
Status OCR: success
Blocos OCR: 77
Fusion: evidence_indexed_needs_layout_mapping
Motor Fusion: initial_musicxml_ocr_fusion
Candidatos OCR: 0 cifra(s), 27 texto(s)/sílaba(s).
Avisos Fusion:
- Blocos OCR indexados. Relação com sistema/compasso permanece pendente até existir geometria MusicXML/layout confiável.
Avisos OCR:
- Google Vision executado via Application Default Credentials local.
```

## Interpretação profissional

Em PWA/frontend com Service Worker, não basta atualizar o repositório. É necessário ter uma política explícita de invalidação de cache.

Sem isso, o app pode ficar em um estado híbrido:

```txt
backend novo
protocolo novo
frontend antigo
relatórios antigos
```

Esse é um risco real para auditorias, porque pode parecer que a correção falhou quando, na verdade, o navegador está servindo assets antigos.

## Prática profissional recomendada

Para evitar repetição do problema, o CPP deve implementar uma camada de controle de versão frontend:

### 1. Versão explícita do cache

O `service-worker.js` deve ter uma constante de versão, por exemplo:

```js
const CACHE_NAME = "cpp-pro-v24";
```

A cada auditoria que altera frontend, essa versão deve ser incrementada:

```js
const CACHE_NAME = "cpp-pro-v25";
```

### 2. Limpeza de caches antigos no activate

O Service Worker deve apagar caches que não correspondem à versão atual:

```js
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
});
```

### 3. Estratégia network-first para JS em desenvolvimento

Durante desenvolvimento/auditorias, arquivos críticos devem priorizar rede:

```txt
index.html
src/app.js
src/modules/*.js
service-worker.js
```

Evitar que eles fiquem presos em cache antigo.

### 4. Cache busting por versão

O `index.html` pode carregar o app com versão explícita:

```html
<script type="module" src="./src/app.js?v=24"></script>
```

Quando o frontend muda:

```html
<script type="module" src="./src/app.js?v=25"></script>
```

### 5. Versão/build visível no app

A interface deve mostrar uma versão do frontend, por exemplo:

```txt
CPP Frontend build: audit-24
```

Assim fica claro se o navegador carregou a versão nova ou antiga.

### 6. Botão de reset local para desenvolvimento

Adicionar ferramenta de desenvolvimento:

```txt
Limpar cache local / Recarregar app
```

Essa ação pode:

- apagar caches do Service Worker;
- limpar storage local se autorizado;
- recarregar a página.

## Próxima correção recomendada

```txt
Auditoria 24.1 — Invalidação profissional de cache frontend/PWA
```

Objetivos:

- versionar cache do Service Worker;
- invalidar caches antigos automaticamente;
- garantir que `src/app.js` e módulos sejam atualizados após `git pull`;
- mostrar versão/build no frontend;
- reduzir necessidade de `Ctrl+F5` manual.

## Conclusão

Auditoria 24 foi validada, mas revelou uma pendência de infraestrutura:

```txt
O frontend precisa de política profissional de cache/versionamento para auditorias futuras.
```

Esse ponto deve ser tratado antes de avançar para classificações mais complexas, porque relatórios e comportamento visual dependem diretamente dos módulos JS carregados pelo navegador.
