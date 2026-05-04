# Auditoria 45 — OCR de PDF por conversão página→imagem validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Permitir OCR local de PDF com Google Vision por meio da conversão conservadora de cada página do PDF em imagem, preservando a página de origem em cada bloco OCR e sem inventar texto quando a conversão ou o OCR falhar.

Esta auditoria inicia o Marco 5 — Núcleo PDF/multipágina/cache/custo.

## Implementação registrada

Commits da implementação:

```txt
1736ece Add audit 45 PDF page image OCR conversion
4912517 Add audit 45 PDF page OCR conversion tests
8ef1057 Preserve PDF page origin during audit 45 OCR
```

## Arquivos alterados

```txt
backend/ocr_engine.py
backend/test_backend.py
```

## Comportamento implementado

O OCR de PDF local com Google Vision agora segue este fluxo:

```txt
PDF → imagens por página → OCR por imagem → text_blocks com page preservado
```

Cada bloco OCR gerado a partir de PDF convertido recebe:

```txt
text_blocks[].page = número real da página do PDF
```

## Dependência de conversão

A conversão local usa:

```txt
PyMuPDF / fitz
```

Se a dependência não estiver disponível, o contrato OCR retorna falha conservadora:

```txt
ocr.status = unavailable
ocr.text_blocks = []
```

sem inventar texto.

## Correção aplicada após teste local

Durante a validação, foi identificado que o OCR de imagem retornava `page = 1` para cada imagem, o que quebrava a preservação da página real do PDF.

Correção aplicada:

```txt
normalize_ocr_pages(..., force_page=True)
```

Resultado esperado:

```txt
página 1 do PDF → text_blocks[].page = 1
página 2 do PDF → text_blocks[].page = 2
```

## Testes cobertos

A auditoria cobre:

```txt
PDF com dependência de conversão ausente → unavailable, sem OCR inventado
PDF convertido em páginas → OCR por página, page preservado
```

## Regras preservadas

```txt
Não inventar texto OCR.
Não criar OCR quando a conversão falha.
Não associar OCR a sistema automaticamente.
Não associar OCR a compasso automaticamente.
Não inferir letra.
Não inferir harmonia.
Preservar página de origem do OCR.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
16 passed in 0.59s
```

## Observação sobre contagem de testes

A contagem esperada passou de 15 para 16 porque um teste antigo de PDF sem conversão foi atualizado para o novo comportamento conservador da Auditoria 45, e um novo teste positivo de conversão página→imagem foi acrescentado.

```txt
15 testes anteriores
- 1 teste antigo substituído
+ 2 testes da Auditoria 45
= 16 testes
```

## Resultado

A Auditoria 45 está validada:

```txt
PDF→imagem por página: OK
OCR por página convertida: OK
text_blocks[].page preservado: OK
falha conservadora sem dependência: OK
sem texto inventado: OK
pytest: 16 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 46 — Cache OCR por hash de arquivo/página
```

Alvo conservador da próxima etapa:

- gerar hash de arquivo/página;
- reutilizar OCR quando o conteúdo da página não mudou;
- evitar custo repetido de OCR;
- preservar text_blocks e página de origem;
- não alterar evidência OCR em cache.

## Conclusão

Auditoria 45 aprovada. O CPP agora possui base para OCR local de PDF multipágina por conversão página→imagem, preservando a origem de página e mantendo falhas explícitas quando OCR/conversão não estiver disponível.