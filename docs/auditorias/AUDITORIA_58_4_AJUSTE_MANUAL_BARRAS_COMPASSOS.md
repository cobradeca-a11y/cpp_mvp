# Auditoria 58.4 — Ajuste manual rápido de barras/compassos

## Status

```txt
Validada localmente pelo usuário com pytest e validação visual do frontend.
```

## Validação local

```txt
pytest
18 passed
```

## Frontend validado

```txt
Frontend build: audit-58-4-cache-v1
```

Observação:

```txt
O service worker foi atualizado para audit-58-4-cache-v2 para forçar renovação de cache.
O shell do frontend exibido e validado pelo usuário ficou em audit-58-4-cache-v1.
```

## Validação visual informada pelo usuário

O campo “Compasso padrão” passou a iniciar vazio, preservando apenas o placeholder:

```txt
Compasso padrão
Ex.: 3/4
```

O painel da Auditoria 58.4 apareceu corretamente:

```txt
3K. Ajuste manual rápido de barras/compassos
Auditoria 58.4: registra barras e bbox de sistema confirmados manualmente. Não faz inferência geométrica automática.

Gerar template
Aplicar ajuste manual
Exportar relatório JSON
```

Placeholder de entrada manual validado:

```txt
Cole JSON manual: {"systems":[{"system_id":"s001","page":1,"system_bbox":{"x":0,"y":0,"w":0,"h":0},"barline_x_positions":[0,100,200]}]}
```

## Commits de implementação/correção validados

```txt
77232e8 Add audit 58.4 manual barline adjustment
f8b4047 Load audit 58.4 manual barline adjustment patch
6e21b32 Update service worker cache for audit 58.4
b704c20 Keep default meter empty in protocol
5a3e319 Use audit 58.4 build in frontend shell
42309d8 Fix audit 58.4 build and clear stale meter state
a120093 Update service worker cache for audit 58.4 v2
```

## Escopo implementado

A Auditoria 58.4 adiciona um painel para ajuste manual rápido de barras/compassos.

O módulo criado foi:

```txt
src/modules/audit58-4-manual-barline-adjustment.js
```

O painel permite:

```txt
- gerar template JSON para sistemas detectados;
- informar system_bbox manualmente;
- informar barline_x_positions manualmente;
- aplicar ajuste manual;
- gerar bbox dos compassos entre barras confirmadas;
- exportar relatório JSON.
```

## Comportamento conservador

A Auditoria 58.4 usa somente coordenadas fornecidas/confirmadas manualmente.

Quando aplicado corretamente, o protocolo recebe:

```txt
system.geometry.source: human_barline_review
measure.geometry.source: human_barline_review
measure.geometry.status: human_reviewed
measure.geometry.confidence: 0.95
```

Também registra decisão humana em:

```txt
protocol.review[]
```

## Correção adicional validada — Compasso padrão vazio

Foi corrigido o comportamento legado em que o protocolo inicial nascia com:

```txt
meter_default: "3/4"
```

A partir desta auditoria, o protocolo inicial usa:

```txt
meter_default: ""
```

O campo visual deve iniciar vazio e exibir apenas o placeholder:

```txt
Ex.: 3/4
```

## Contrato preservado

```txt
modifies_protocol: true
modification_scope: human_geometry_metadata_only
modifies_ocr_raw_text: false
infers_lyrics: false
infers_harmony: false
uses_automatic_geometry_inference: false
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
applies_human_review_without_user_action: false
```

## Conclusão

A Auditoria 58.4 está validada.

Ela segue a nova diretriz operacional decidida após os testes experimentais:

```txt
Melhor geometria conservadora com ajuste pontual humano
do que geometria automática agressiva exigindo revisão total.
```

## Próxima auditoria recomendada

```txt
Auditoria 58.5 — Revisão dedicada de cifras/letras/lacunas por compasso
```

Objetivo:

```txt
Criar uma etapa de revisão por compasso que mostre candidatos OCR/OMR/lacunas e permita aprovar/rejeitar evidências, sem inferir letra, harmonia ou alinhamento sem confirmação.
```
