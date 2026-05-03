# Auditoria 37 — Revisão auditável de associação OCR→sistema validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Permitir que a revisão humana confirme ou rejeite o estado atual da associação OCR→sistema, registrando a decisão de forma auditável no protocolo, sem alterar automaticamente a associação calculada/bloqueada.

## Implementação registrada

Commits da implementação:

```txt
cf8e529 Add audit 37 OCR system review controls
f079e95 Add audit 37 OCR system association review decisions
2f0bf62 Update service worker cache for audit 37
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
Confirmar estado OCR→sistema
Rejeitar estado OCR→sistema
```

A decisão humana é registrada em:

```txt
protocol.review[]
```

com:

```txt
review_id
audit = audit-37
type = ocr_system_association_review
target_type = fusion_text_region
target_id
source_block_id
decision
original_text
normalized_text
original_region_type
original_association_status
original_candidate_system_id
original_reason
reviewed_by
reviewed_at
effects
```

Também é gravado um resumo no bloco OCR:

```txt
fusion.text_blocks_index[].system_human_review
```

## Contrato de segurança preservado

A decisão humana da Auditoria 37 não altera associação automática.

```txt
text_changed = false
normalized_text_changed = false
classification_changed = false
system_assignment_changed = false
measure_assignment_changed = false
candidate_system_id_changed = false
```

A Auditoria 37:

```txt
Não altera texto OCR bruto.
Não altera texto normalizado.
Não altera classificação original.
Não cria candidate_system_id.
Não altera association_status automático.
Não associa OCR a compasso.
Não infere letra.
Não infere harmonia.
```

## Cache/frontend

O frontend e o service worker foram atualizados para:

```txt
audit-37-cache-v1
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed in 0.56s
```

## Resultado

A Auditoria 37 está validada:

```txt
Confirmar estado OCR→sistema: OK
Rejeitar estado OCR→sistema: OK
Registro em protocol.review[]: OK
Resumo em text_blocks_index[].system_human_review: OK
candidate_system_id preservado: OK
association_status automático preservado: OK
Sem associação OCR→compasso: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 38 — Revisão de associação texto→compasso
```

Alvo conservador da próxima etapa:

- permitir revisão humana do estado OCR→compasso;
- registrar se o humano confirmou ou rejeitou o estado de associação/bloqueio;
- não inventar `candidate_measure_id`;
- não alterar `candidate_measure_number`;
- não alterar associação automática;
- não inferir compasso.

## Conclusão

Auditoria 37 aprovada. O CPP agora registra decisões humanas auditáveis sobre o estado OCR→sistema sem modificar a evidência original nem criar associação automática.