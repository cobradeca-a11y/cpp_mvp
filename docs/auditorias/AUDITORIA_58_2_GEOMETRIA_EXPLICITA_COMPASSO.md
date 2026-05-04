# Auditoria 58.2 — Geometria explícita por compasso

## Status

```txt
Validada localmente pelo usuário com pytest.
```

## Validação local

```txt
pytest
18 passed, 5 warnings in 0.92s
```

Warnings observados:

```txt
DeprecationWarning relacionado a tipos SWIG/PyMuPDF durante testes existentes.
Não bloqueou a validação.
```

## Frontend build

```txt
audit-58-2-cache-v1
```

## Commits de implementação validados

```txt
6b536dc Add audit 58.2 explicit measure geometry contract
b63966b Wire audit 58.2 explicit geometry frontend
f743692 Update service worker cache for audit 58.2
```

## Escopo implementado

A Auditoria 58.2 adicionou um contrato explícito de geometria por página, sistema, compasso e bloco OCR.

O módulo novo foi criado em:

```txt
src/modules/audit58-2-explicit-measure-geometry.js
```

O frontend passou a carregar o painel:

```txt
3I. Geometria explícita por compasso
```

Botões adicionados:

```txt
Aplicar geometria explícita segura
Exportar relatório JSON
```

## Comportamento implementado

A Auditoria 58.2 normaliza o protocolo salvo para incluir objetos `geometry` explícitos em:

```txt
pages[]
systems[]
measures[]
fusion.text_blocks_index[]
```

Cada objeto `geometry` pode registrar:

```txt
page
system_id
bbox
source
confidence
status
review_required
audit
```

## Regra de segurança geométrica

```txt
A Auditoria 58.2 não inventa coordenadas.
```

Quando já existe evidência geométrica no protocolo, a auditoria preserva/normaliza o `bbox`.

Quando não existe evidência geométrica suficiente, a auditoria registra:

```txt
bbox: null
status: pending
source: missing_no_reliable_geometry_available
confidence: 0
review_required: true
```

## Contrato preservado

```txt
modifies_protocol: true
modification_scope: metadata_only_geometry_contract
modifies_ocr_raw_text: false
infers_lyrics: false
infers_harmony: false
invents_geometry_coordinates: false
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
applies_human_review_without_user_action: false
```

## Conclusão

A Auditoria 58.2 está validada por teste local automatizado.

Ela fecha o contrato de metadados geométricos explícitos sem criar falsa precisão.

Importante:

```txt
A Auditoria 58.2 não implementa ainda a detecção real melhorada de barras/compassos.
Ela prepara o protocolo para receber e auditar essa geometria real.
```

## Próxima auditoria

```txt
Auditoria 58.3 — Detecção/derivação real de bbox por compasso
```

Objetivo da 58.3:

```txt
Usar sistemas, barras verticais e limites horizontais para preencher bbox real por compasso com source, confidence, status e review_required, sem inferir letra, cifra ou harmonia.
```
