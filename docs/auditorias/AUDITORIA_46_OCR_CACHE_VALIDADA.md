# Auditoria 46 — Cache OCR por hash de arquivo/página validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Implementar cache OCR por hash para evitar custo repetido de OCR em imagens e páginas de PDF convertidas, preservando os blocos OCR e a origem de página, sem inventar texto e sem alterar evidências automaticamente.

## Implementação registrada

Commits da implementação:

```txt
59fc6c4 Add audit 46 OCR cache helpers
e20a98e Use audit 46 OCR cache for images and PDF pages
06906bb Add audit 46 OCR cache tests
```

Registro anterior necessário para continuidade do marco:

```txt
e03cc1f Record audit 45 PDF page OCR validation
```

## Arquivos alterados

```txt
backend/ocr_cache.py
backend/ocr_engine.py
backend/test_backend.py
```

## Comportamento implementado

Foi criado o módulo:

```txt
backend/ocr_cache.py
```

com suporte a:

```txt
cache por hash SHA-256
cache por engine OCR
cache por OCR_FEATURE
cache por página quando aplicável
cache versionado em audit-46
```

O cache é usado em:

```txt
imagens isoladas
páginas de PDF convertidas em imagem
```

## Configuração

Diretório padrão:

```txt
.cpp_ocr_cache
```

Variável para configurar diretório:

```txt
CPP_OCR_CACHE_DIR
```

Variável para desativar cache:

```txt
CPP_OCR_CACHE=0
```

## Regras de reutilização

O OCR é reutilizado apenas quando coincidem:

```txt
cache_version
engine
OCR_FEATURE
hash do conteúdo da imagem/página
número da página quando aplicável
```

## Contrato de segurança preservado

```txt
Cache não inventa OCR.
Cache não altera texto OCR bruto.
Cache não altera bbox.
Cache não altera confidence.
Cache preserva page no PDF.
Cache não cria associação OCR→sistema.
Cache não cria associação OCR→compasso.
Cache não infere letra.
Cache não infere harmonia.
```

## Testes cobertos

A auditoria cobre:

```txt
Imagem isolada usa cache sem repetir OCR.
Página de PDF usa cache sem repetir OCR.
Cache mantém text_blocks.
Cache preserva page em PDF.
Cache reporta hit/miss em warnings.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
18 passed in 0.84s
```

## Resultado

A Auditoria 46 está validada:

```txt
Cache OCR por hash: OK
Cache de imagem: OK
Cache de página PDF: OK
Preservação de page: OK
Sem repetição de OCR quando há hit: OK
Sem texto inventado: OK
pytest: 18 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 47 — Processamento multipágina
```

Alvo conservador da próxima etapa:

- consolidar processamento multipágina no contrato;
- registrar contagem de páginas processadas;
- preservar OCR por página;
- preparar exportação multipágina;
- não associar automaticamente página/sistema/compasso sem geometria confiável.

## Conclusão

Auditoria 46 aprovada. O CPP agora evita custo repetido de OCR por hash de imagem/página, mantendo evidência OCR preservada e auditável.