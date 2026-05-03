# Auditoria 31 — Contrato conservador de associação OCR→sistema validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Criar uma camada explícita de associação OCR→sistema musical, sem inventar associação quando não houver geometria confiável de layout.

A Auditoria 31 não mapeia OCR para compasso e não usa aproximação visual sem bbox confiável.

## Implementação registrada

Commits da implementação e correção:

```txt
a8288f6 Add audit 31 OCR system association contract
0564eb2 Sync audit 31 OCR system associations in backend protocol
bbaf52c Add audit 31 OCR system association tests
f65fdba Fix audit 31 blocked OCR system association count test
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
ocr_system_associations.engine = cpp_ocr_system_association_contract
ocr_system_associations.version = audit-31
ocr_system_associations.status
ocr_system_associations.association_count
ocr_system_associations.assigned_count
ocr_system_associations.blocked_count
ocr_system_associations.unassigned_count
ocr_system_associations.associations[]
ocr_system_associations.warnings[]
```

## Bloqueio conservador

Quando não há geometria confiável de região OCR ou de sistema musical:

```txt
association_status = blocked_no_reliable_layout_geometry
candidate_system_id = null
confidence = none
```

Razão registrada:

```txt
OCR→sistema bloqueado: região OCR ou sistema musical sem bbox/layout confiável.
```

## Correção durante validação

A validação local indicou que o teste esperava `blocked_count = 1`, mas o mock OCR continha duas regiões úteis:

```txt
Am
Glória
```

Como ambas não possuem geometria de sistema confiável, o correto é:

```txt
blocked_count = 2
```

Correção aplicada:

```txt
f65fdba Fix audit 31 blocked OCR system association count test
```

## Regras preservadas

```txt
Não inventar geometria.
Não mapear OCR para sistema sem bbox confiável.
Não mapear OCR para compasso.
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
15 passed in 0.55s
```

## Resultado

A Auditoria 31 está validada:

```txt
ocr_system_associations.version: audit-31
bloqueio sem geometria confiável: OK
candidate_system_id null quando bloqueado: OK
blocked_count correto: OK
nenhuma associação inventada: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 32 — Mapear regiões OCR para compassos aproximados
```

Alvo conservador da próxima etapa:

- criar uma camada de associação OCR→compasso;
- bloquear associação quando OCR→sistema estiver bloqueado;
- bloquear associação quando não houver geometria confiável de compasso;
- não criar aproximação por ordem textual sem evidência geométrica;
- registrar motivo explícito do bloqueio no protocolo.

## Conclusão

Auditoria 31 aprovada. O CPP agora possui contrato explícito para associação OCR→sistema, bloqueando corretamente qualquer associação automática quando não há geometria confiável.