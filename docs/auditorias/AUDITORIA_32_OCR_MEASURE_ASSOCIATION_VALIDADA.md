# Auditoria 32 — Contrato conservador de associação OCR→compasso validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Criar uma camada explícita de associação OCR→compasso, sem inventar vínculo quando OCR→sistema ainda estiver bloqueado ou quando não houver geometria confiável de compasso.

A Auditoria 32 não cria aproximação por ordem textual e não associa OCR a compasso sem evidência geométrica confiável.

## Implementação registrada

Commits da implementação:

```txt
cd3970e Add audit 32 OCR measure association contract
5cdb786 Sync audit 32 OCR measure associations in backend protocol
cf90f75 Add audit 32 OCR measure association tests
```

## Arquivos alterados

```txt
backend/association_engine.py
backend/main.py
backend/test_backend.py
```

## Comportamento implementado

O protocolo agora inclui:

```txt
ocr_measure_associations.engine = cpp_ocr_measure_association_contract
ocr_measure_associations.version = audit-32
ocr_measure_associations.status
ocr_measure_associations.association_count
ocr_measure_associations.assigned_count
ocr_measure_associations.blocked_count
ocr_measure_associations.unassigned_count
ocr_measure_associations.associations[]
ocr_measure_associations.warnings[]
```

## Bloqueio conservador

Quando OCR→sistema ainda não possui associação confiável:

```txt
association_status = blocked_no_system_association
candidate_system_id = null
candidate_measure_id = null
candidate_measure_number = null
confidence = none
```

Razão registrada:

```txt
OCR→compasso bloqueado: região OCR ainda não possui associação confiável com sistema musical.
```

Quando o sistema estiver disponível, mas os compassos não possuírem geometria confiável:

```txt
association_status = blocked_no_reliable_measure_geometry
```

## Regras preservadas

```txt
Não inventar geometria.
Não mapear OCR para compasso sem sistema confiável.
Não mapear OCR para compasso sem bbox confiável de compasso.
Não criar aproximação por ordem textual.
Não inferir letra.
Não inferir harmonia.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed in 0.54s
```

## Resultado

A Auditoria 32 está validada:

```txt
ocr_measure_associations.version: audit-32
bloqueio quando OCR→sistema está bloqueado: OK
candidate_measure_id null quando bloqueado: OK
candidate_measure_number null quando bloqueado: OK
nenhum compasso inventado: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 33 — Calcular confiança de associação OCR→compasso
```

Alvo conservador da próxima etapa:

- adicionar score/nível de confiança para OCR→compasso;
- confiança deve ser 0 quando associação estiver bloqueada;
- registrar fatores de bloqueio como evidência;
- não criar associação nova;
- não inferir compasso.

## Conclusão

Auditoria 32 aprovada. O CPP agora possui contrato explícito de OCR→compasso, bloqueando associação enquanto não houver sistema e geometria de compasso confiáveis.