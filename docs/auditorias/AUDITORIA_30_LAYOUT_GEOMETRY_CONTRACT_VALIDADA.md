# Auditoria 30 — Contrato de geometria de página e sistema validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Criar uma camada explícita de geometria/layout no protocolo CPP para registrar páginas e sistemas quando houver evidência confiável, e registrar ausência de geometria quando ela não estiver disponível.

Esta auditoria inaugura o Marco 2 sem criar mapeamento OCR→sistema ou OCR→compasso.

## Implementação registrada

Commits da implementação:

```txt
0e99586 Add audit 30 layout geometry contract
741ee66 Sync audit 30 layout geometry in backend protocol
8822dd2 Add audit 30 layout contract tests
```

## Arquivos alterados

```txt
backend/geometry_engine.py
backend/main.py
backend/test_backend.py
```

## Comportamento implementado

O protocolo agora inclui:

```txt
layout.engine = cpp_layout_geometry_contract
layout.version = audit-30
layout.status
layout.page_count
layout.system_count
layout.page_geometry_status_counts
layout.system_geometry_status_counts
layout.pages[]
layout.systems[]
layout.warnings[]
```

## Status de ausência de geometria

Quando não há bbox confiável de página ou sistema, o protocolo registra explicitamente:

```txt
geometry_status = unavailable_no_reliable_layout_geometry
bbox = null
confidence = none
```

com nota:

```txt
MusicXML/OMR protocol does not provide reliable page or system bounding boxes yet.
```

## Regras preservadas

```txt
Não inventar geometria.
Não inferir bbox ausente.
Não mapear OCR para sistema.
Não mapear OCR para compasso.
Não alterar harmonia.
Não alterar letra.
```

## Exemplo de geometria indisponível

```json
{
  "geometry_status": "unavailable_no_reliable_layout_geometry",
  "bbox": null,
  "source": "musicxml_or_omr_without_layout_bbox",
  "confidence": "none"
}
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed in 0.59s
```

Observação: a Auditoria 30 adicionou novas validações dentro de testes existentes, por isso o total permaneceu em 15 testes.

## Resultado

A Auditoria 30 está validada:

```txt
layout.version: audit-30
layout contract: OK
page geometry absence explicitada: OK
system geometry absence explicitada: OK
bbox não inventado: OK
OCR não mapeado para sistema: OK
OCR não mapeado para compasso: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 31 — Mapear regiões OCR para sistemas musicais
```

Alvo conservador da próxima etapa:

- criar uma camada de associação OCR→sistema;
- bloquear associação quando `layout` não possuir bbox confiável;
- registrar razão do bloqueio no protocolo;
- não criar associação por aproximação sem geometria;
- não mapear ainda OCR para compasso.

## Conclusão

Auditoria 30 aprovada. O CPP agora possui contrato explícito de geometria/layout, distinguindo geometria ausente de geometria não processada, sem inventar coordenadas.