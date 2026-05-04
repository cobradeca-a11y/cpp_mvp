# Auditoria 47 — Processamento multipágina com metadados OCR validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Consolidar metadados explícitos de processamento multipágina no contrato OCR, preservando blocos OCR por página e preparando o fluxo para exportação/associação multipágina futura, sem criar associação musical automática entre página, sistema e compasso.

## Implementação registrada

Commits da implementação:

```txt
bb119c7 Add audit 47 multipage OCR metadata
efe2ea3 Add audit 47 multipage OCR metadata tests
```

Registro anterior necessário para continuidade do marco:

```txt
4fead62 Record audit 46 OCR cache validation
```

## Arquivos alterados

```txt
backend/ocr_engine.py
backend/test_backend.py
```

## Comportamento implementado

O contrato OCR agora inclui:

```txt
ocr.multipage_status
ocr.page_count
ocr.pages[]
```

Exemplo de saída multipágina:

```json
{
  "multipage_status": "multipage_processed",
  "page_count": 2,
  "pages": [
    { "page": 1, "ocr_status": "success", "text_block_count": 1 },
    { "page": 2, "ocr_status": "success", "text_block_count": 1 }
  ]
}
```

## Estados suportados

```txt
not_processed
single_page_processed
multipage_processed
```

## Fonte dos metadados

Os metadados são derivados de:

```txt
ocr.text_blocks[].page
páginas esperadas do PDF convertido
```

## Regras preservadas

```txt
Não inventar OCR.
Não criar página sem evidência/processamento.
Não associar página a sistema automaticamente.
Não associar página a compasso automaticamente.
Não inferir letra.
Não inferir harmonia.
Preservar text_blocks[].page.
```

## Testes cobertos

A auditoria cobre:

```txt
Contrato OCR sempre contém multipage_status, page_count e pages.
Imagem isolada gera single_page_processed.
PDF com duas páginas gera multipage_processed.
Páginas registram text_block_count.
Cenários sem OCR permanecem not_processed.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
18 passed in 0.87s
```

## Resultado

A Auditoria 47 está validada:

```txt
ocr.multipage_status: OK
ocr.page_count: OK
ocr.pages[]: OK
Preservação de page: OK
Sem associação musical automática: OK
pytest: 18 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 48 — Associação página→sistema→compasso
```

Alvo conservador da próxima etapa:

- registrar o estado da associação página→sistema→compasso;
- bloquear associação quando não houver geometria confiável;
- contabilizar páginas, sistemas e compassos sem vínculo confiável;
- não criar associação automática sem evidência geométrica suficiente.

## Conclusão

Auditoria 47 aprovada. O CPP agora expõe metadados multipágina no contrato OCR e preserva a origem de página sem inferir relações musicais automáticas.