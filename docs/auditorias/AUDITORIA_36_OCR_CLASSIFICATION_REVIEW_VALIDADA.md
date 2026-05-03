# Auditoria 36 — Aprovação/rejeição auditável de classificação OCR validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Permitir que a revisão humana aprove ou rejeite a classificação OCR de um bloco, registrando a decisão de forma auditável no protocolo, sem alterar automaticamente texto, classificação, sistema ou compasso.

## Implementação registrada

Commits da implementação:

```txt
eec148d Add audit 36 OCR classification review controls
1d7c72f Add audit 36 OCR classification review decisions
de5a883 Update service worker cache for audit 36
```

## Arquivos alterados

```txt
index.html
src/app.js
service-worker.js
```

## Comportamento implementado

O frontend agora exibe, na seção de revisão OCR por bloco:

```txt
Aprovar classificação OCR
Rejeitar classificação OCR
```

A decisão humana é registrada em:

```txt
protocol.review[]
```

com:

```txt
review_id
audit = audit-36
type = ocr_classification_review
target_type = fusion_text_block
target_id
decision
original_text
normalized_text
original_classification
reviewed_by
reviewed_at
effects
```

Também é gravado um resumo no bloco OCR:

```txt
fusion.text_blocks_index[].human_review
```

## Contrato de segurança preservado

A decisão humana da Auditoria 36 não altera evidência automaticamente.

```txt
text_changed = false
normalized_text_changed = false
classification_changed = false
system_assignment_changed = false
measure_assignment_changed = false
```

A Auditoria 36:

```txt
Não altera texto OCR bruto.
Não altera texto normalizado.
Não altera classificação original.
Não associa OCR a sistema.
Não associa OCR a compasso.
Não infere letra.
Não infere harmonia.
```

## Cache/frontend

O frontend e o service worker foram atualizados para:

```txt
audit-36-cache-v1
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed in 0.60s
```

## Resultado

A Auditoria 36 está validada:

```txt
Aprovar classificação OCR: OK
Rejeitar classificação OCR: OK
Registro em protocol.review[]: OK
Resumo em text_blocks_index[].human_review: OK
Texto bruto preservado: OK
Texto normalizado preservado: OK
Classificação original preservada: OK
Sem associação OCR→sistema: OK
Sem associação OCR→compasso: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 37 — Revisão de associação texto→sistema
```

Alvo conservador da próxima etapa:

- permitir revisão humana do estado OCR→sistema;
- registrar se o humano confirmou ou rejeitou o estado de associação/bloqueio;
- não inventar `candidate_system_id`;
- não alterar associação automática;
- não mapear OCR para compasso.

## Conclusão

Auditoria 36 aprovada. O CPP agora registra decisões humanas auditáveis sobre classificação OCR sem modificar a evidência original.