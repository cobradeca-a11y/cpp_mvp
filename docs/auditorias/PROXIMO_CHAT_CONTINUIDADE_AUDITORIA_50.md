# Próximo chat — Continuidade CPP_PRO / Auditoria 50

## Projeto

```txt
CPP_PRO — Conversor Profissional de Partituras
Repositório: cobradeca-a11y/cpp_pro
Branch: main
```

## Regra permanente do projeto

```txt
Não inventar harmonia.
Não inventar letra.
Não alinhar OCR a sistema ou compasso sem geometria confiável.
Preservar OCR bruto.
Toda evidência incerta fica pendente para revisão humana.
Quando houver alteração frontend/PWA, atualizar build/cache.
Quando houver validação local do usuário, registrar em docs/auditorias.
```

## Estado consolidado antes da Auditoria 50

```txt
Auditorias 25–49 validadas e registradas.
Marcos 1–5 fechados.
Último marco fechado: Marco 5 — Núcleo PDF/multipágina/cache/custo.
Frontend anterior: audit-49-cache-v1.
```

## Auditoria atual

```txt
Auditoria 50 — Tratamento de erros profissional no frontend
Status: em validação manual de frontend
Backend pytest informado anteriormente: 18 passed in 0.61s
```

## Regressão identificada na Auditoria 50

Durante a Auditoria 50, os botões do frontend deixaram de funcionar apesar de a página exibir o build atualizado. O problema foi tratado como regressão de hidratação JS/cache.

Sintoma relatado:

```txt
A página mostrava audit-50-cache-v2/v3, mas os botões não executavam ação.
```

Causa provável tratada:

```txt
Conflito entre index.html, service-worker.js, src/app.js antigo e controlador audit50.
Imports estáticos podiam impedir hidratação de todos os botões caso um módulo falhasse.
```

## Correção aplicada

Commits relevantes da correção final:

```txt
1483f04 Make audit 50 controller robust without static imports
f9842d3 Use audit 50 cache v4 controller
16ac0a3 Update service worker cache for audit 50 v4
```

Estado final do frontend após correção:

```txt
Frontend build: audit-50-cache-v4
Controlador principal: src/app-audit50.js
index.html aponta para: ./src/app-audit50.js?v=audit-50-cache-v4
service-worker.js usa: audit-50-cache-v4
```

## Decisão técnica importante

O controlador `src/app-audit50.js` foi tornado robusto sem imports estáticos. Ele usa importação dinâmica com fallback, para evitar que erro de um módulo impeça todos os botões de receberem handlers.

Objetivo:

```txt
Mesmo se algum módulo falhar, os botões básicos continuam hidratados.
Erros de módulo aparecem em frontendErrorLog.
```

## Validação visual informada pelo usuário

Após a correção para `audit-50-cache-v4`, o usuário informou:

```txt
aparentemente foi.
```

A tela registrada mostrou:

```txt
Frontend build: audit-50-cache-v4
Arquivo processado: BeetAnGeSample.musicxml
Status OMR: musicxml_parsed
Status OCR: not_applicable
Blocos OCR: 0
Compassos importados: 15
```

Também foram observados:

```txt
Seção 2 — revisão de compassos funcionando com 15 compassos.
Seção 2B — histórico de decisões humanas preenchido.
Seção 3 — saídas geradas.
Seção 3A — log de erros operacional sem erros registrados.
```

## Ponto importante sobre OCR

O usuário observou que OCR ainda não aparece.

Isso é esperado para o teste feito com `.musicxml`:

```txt
Entrada MusicXML/MXL direta → OCR status not_applicable.
Entrada MusicXML/MXL direta → Blocos OCR = 0.
Entrada MusicXML/MXL direta → Fusion = no_ocr_text.
```

MusicXML importa estrutura musical, compassos, notas e letras já codificadas no arquivo. Ele não passa por OCR.

Para validar OCR de fato, usar:

```txt
.pdf
.png
.jpg
.jpeg
.webp
```

com backend rodando e OCR configurado.

## Validação pendente

A Auditoria 50 ainda NÃO deve ser registrada como fechada até validar pelo menos:

```txt
1. Backend pytest continua passando.
2. Frontend build mostra audit-50-cache-v4.
3. Verificar backend funciona.
4. Limpar cache do app funciona.
5. Selecionar arquivo atualiza fileInfo.
6. Processar com OMR Profissional funciona com MusicXML.
7. Processar com OMR Profissional é testado com PDF ou PNG.
8. Se PDF/PNG não gerar OCR, frontendErrorLog e relatório OCR mostram motivo.
9. Exportar JSON funciona.
10. Exportar log de erros funciona.
```

## Comandos para o próximo chat

Atualizar local:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro
git pull origin main
```

Rodar backend:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Esperado atual:

```txt
18 passed
```

Rodar frontend:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro
python -m http.server 8080
```

Abrir:

```txt
http://localhost:8080
```

## Checklist frontend imediato

```txt
1. Confirmar Frontend build: audit-50-cache-v4.
2. Clicar Limpar cache do app.
3. Confirmar recarregamento mantendo audit-50-cache-v4.
4. Clicar Verificar backend.
5. Selecionar .musicxml e processar.
6. Confirmar compassos importados.
7. Selecionar PDF ou PNG e processar.
8. Conferir Status OCR.
9. Conferir Blocos OCR.
10. Conferir painel 3A — Erros operacionais.
11. Exportar JSON.
12. Exportar log de erros.
```

## Interpretação esperada dos testes

### Com `.musicxml` ou `.mxl`

```txt
Status OMR: musicxml_parsed
Status OCR: not_applicable
Blocos OCR: 0
Isso é OK.
```

### Com `.pdf` ou imagem

```txt
OCR deve tentar executar conforme configuração do backend.
Se OCR_ENGINE não estiver configurado, credenciais ausentes ou dependência ausente, o sistema deve mostrar erro/aviso controlado.
Se OCR funcionar, ocr.text_blocks[] deve aparecer e a seção 2A deve listar blocos OCR.
```

## Próxima ação recomendada

No próximo chat, começar por:

```txt
1. Confirmar git log --oneline -5.
2. Confirmar pytest.
3. Testar PDF/PNG para OCR.
4. Se OCR não aparecer, inspecionar o JSON exportado em:
   - source.ocr_status
   - ocr.status
   - ocr.engine
   - ocr.warnings
   - ocr.text_blocks
   - fusion.status
   - fusion.warnings
5. Corrigir apenas OCR/frontend se necessário.
6. Só depois registrar Auditoria 50 como validada.
```

## Proibição para o próximo chat

```txt
Não registrar Auditoria 50 como validada apenas porque MusicXML funcionou.
Não considerar OCR ausente em MusicXML como erro.
Não mexer no backend se o problema for apenas visual/frontend.
Não mexer em contratos 25–49 sem necessidade.
Não promover letra/cifra detectada para aprovada automaticamente.
```

## Resumo curto para colar no próximo chat

```txt
Estamos no CPP_PRO, Auditoria 50 aberta. Auditorias 25–49 validadas. A regressão dos botões foi corrigida com audit-50-cache-v4 usando src/app-audit50.js sem imports estáticos. MusicXML foi processado com sucesso: musicxml_parsed, 15 compassos, OCR not_applicable, Blocos OCR 0 — isso é esperado para MusicXML. Falta validar PDF/PNG para OCR real. Não registrar Auditoria 50 como validada até pytest + frontend + teste OCR PDF/PNG passarem.
```
