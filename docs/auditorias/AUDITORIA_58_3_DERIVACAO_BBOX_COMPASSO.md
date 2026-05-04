# Auditoria 58.3 — Detecção/derivação real de bbox por compasso

## Status

```txt
Validada localmente pelo usuário com pytest e teste funcional no frontend.
```

## Validação local

```txt
pytest
18 passed
```

## Frontend build

```txt
audit-58-3-cache-v1
```

## Commits de implementação validados

```txt
cee1e45 Add audit 58.3 measure bbox derivation
19e12b3 Load audit 58.3 bbox derivation patch
d19f6f9 Update service worker cache for audit 58.3
```

## Evidência funcional — BeetAnGeSample.pdf

### Auditoria 58.2 executada antes da 58.3

```txt
Arquivo: BeetAnGeSample.pdf
Build: audit-58-2-cache-v1
Protocolo salvo: sim
Compassos: 15
Compassos com objeto geometry explícito: 15
Compassos com bbox confiável: 0
Compassos pendentes de geometria confiável: 15
page_geometry.pending: 1
system_geometry.pending: 1
measure_geometry.pending: 15
ocr_geometry.pending: 102
```

### Auditoria 58.3

```txt
Arquivo: BeetAnGeSample.pdf
Build: audit-58-3-cache-v1
Protocolo salvo: sim
Compassos: 15
Com bbox: 0
Reliable: 0
Approximate: 0
Pending: 15
Preservados existentes: 0
Derivados por barras: 0
Derivados por divisão aproximada do sistema: 0
Exigem revisão: 15
```

Derivações registradas:

```txt
m001–m015: pending_no_geometry_evidence
```

## Análise do resultado

A Auditoria 58.3 funcionou corretamente de forma conservadora.

Ela tentou derivar bbox por compasso usando apenas evidências geométricas existentes:

```txt
- bbox de compasso já existente;
- posições de barras existentes no protocolo;
- bbox de sistema para fallback aproximado por divisão uniforme.
```

Como o protocolo testado não tinha geometria de página, sistema, compasso ou OCR, a 58.3 manteve todos os compassos como pendentes.

Isso confirma que a causa raiz atual não está na derivação por compasso em si, mas na ausência anterior de geometria de sistema/página/OCR no protocolo.

## Observação técnica sobre divisão uniforme

O usuário observou corretamente que dividir a largura do sistema em partes iguais não é musicalmente ideal.

Em uma partitura real, mesmo em compassos 4/4, os compassos podem ter larguras visuais diferentes por causa de:

```txt
- quantidade de notas;
- cabeças de nota;
- acidentes;
- pausas;
- letras/cifras/elementos gráficos;
- espaçamento editorial.
```

Por isso, a regra da Auditoria 58.3 permanece conservadora:

```txt
system_bbox_even_measure_distribution
confidence: 0.45
status: approximate
review_required: true
```

Ela só serve como fallback temporário de navegação/revisão, não como geometria confiável final.

## Contrato preservado

```txt
modifies_protocol: true
modification_scope: metadata_only_measure_geometry_bbox
modifies_ocr_raw_text: false
infers_lyrics: false
infers_harmony: false
uses_existing_barline_or_system_geometry_only: true
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
applies_human_review_without_user_action: false
```

## Conclusão

A Auditoria 58.3 está validada.

Ela não criou coordenadas falsas e manteve `pending` quando não havia evidência geométrica suficiente.

## Próxima auditoria recomendada

```txt
Auditoria 58.3.1 — Extração/derivação de bbox de página e sistema
```

Objetivo:

```txt
Criar a geometria-base necessária para que a 58.3 consiga derivar bbox por compasso:
- page.geometry.bbox;
- system.geometry.bbox;
- source;
- confidence;
- status;
- review_required.
```

Essa etapa deve continuar sem inferir letra, cifra ou harmonia.
