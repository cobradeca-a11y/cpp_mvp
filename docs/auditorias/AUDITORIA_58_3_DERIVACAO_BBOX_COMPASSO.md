# Auditoria 58.3 — Detecção/derivação real de bbox por compasso

## Status

```txt
Validada localmente pelo usuário com pytest e teste funcional no frontend.
Correção v2 validada localmente pelo usuário.
```

## Validação local

```txt
pytest
18 passed, 5 warnings in 0.77s
```

Warnings observados:

```txt
DeprecationWarning relacionado a tipos SWIG/PyMuPDF durante testes existentes.
Não bloqueou a validação.
```

## Frontend build

```txt
audit-58-3-cache-v2
```

## Commits de implementação validados

```txt
cee1e45 Add audit 58.3 measure bbox derivation
19e12b3 Load audit 58.3 bbox derivation patch
d19f6f9 Update service worker cache for audit 58.3
394a404 Remove even split fallback from audit 58.3
0a83a2a Update service worker cache for audit 58.3 v2
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

### Auditoria 58.3 v2

```txt
Arquivo: BeetAnGeSample.pdf
Build: audit-58-3-cache-v2
Protocolo salvo: sim
Compassos: 15
Com bbox: 0
Reliable: 0
Approximate: 0
Pending: 15
Preservados existentes: 0
Derivados por barras explícitas: 0
Derivados por divisão aproximada do sistema: 0
Exigem revisão: 15
```

Derivações registradas:

```txt
m001–m015: pending_no_explicit_barline_or_measure_bbox
```

## Correção v2 — remoção de inferência geométrica por divisão uniforme

O usuário apontou corretamente que divisão uniforme por largura do sistema é inferência geométrica e pode errar em casos como:

```txt
- anacruse;
- compassos de mesma fórmula de compasso com larguras editoriais diferentes;
- densidade rítmica desigual;
- cabeças de nota, pausas, acidentes, ligaduras, letras e cifras;
- espaçamento editorial do PDF.
```

Por isso, a Auditoria 58.3 foi corrigida para remover o fallback `system_bbox_even_measure_distribution`.

A regra v2 passa a ser:

```txt
Preservar bbox de compasso já existente.
Derivar bbox apenas por barras explícitas existentes no protocolo.
Sem barras explícitas ou bbox existente, manter pending.
Não dividir sistemas em partes iguais.
```

## Análise do resultado

A Auditoria 58.3 v2 funcionou corretamente de forma conservadora.

Ela não criou coordenadas falsas e manteve todos os compassos como pendentes quando não havia evidência explícita de barras ou bbox de compasso.

Isso confirma que o caminho correto para o CPP não é geometria automática agressiva, mas:

```txt
- detecção conservadora;
- revisão humana pontual;
- registro auditável das correções;
- uso da geometria apenas como suporte/evidência, não como palpite musical.
```

## Contrato preservado

```txt
modifies_protocol: true
modification_scope: metadata_only_measure_geometry_bbox
modifies_ocr_raw_text: false
infers_lyrics: false
infers_harmony: false
uses_explicit_barline_or_existing_measure_bbox_only: true
disables_even_width_measure_inference: true
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
applies_human_review_without_user_action: false
```

## Conclusão

A Auditoria 58.3 v2 está validada.

Ela preserva a diretriz do CPP: não inventar geometria, não inferir letra, não inferir harmonia e não alinhar OCR a compasso sem evidência confiável.

## Próxima auditoria recomendada

```txt
Auditoria 58.4 — Ajuste manual rápido de barras/compassos
```

Objetivo:

```txt
Permitir correções humanas pontuais de barras/compassos, registrando source human_barline_review ou human_adjusted_bbox, sem depender de inferência geométrica agressiva.
```
