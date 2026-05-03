# Auditoria 28 — Normalização conservadora de texto OCR validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Adicionar uma camada de normalização textual conservadora para evidências OCR, preservando sempre o texto bruto original.

A normalização deve facilitar revisão humana e etapas futuras, mas sem gerar letra final, sem inferir harmonia e sem alinhar OCR a compasso.

## Implementação registrada

Commits da implementação e correções:

```txt
ff2eead Add audit 28 conservative OCR text normalization
61dd864 Update fusion contract tests for audit 28
3437605 Add audit 28 OCR normalization tests
bed50b1 Fix audit 28 lyric normalization classification
d60cb6f Leave default meter field empty on startup
4923a5a Bump frontend build for audit 28 UI fix
5d58476 Update service worker cache for audit 28
```

## Arquivos alterados

```txt
backend/fusion_engine.py
backend/test_backend.py
backend/test_audit25_ocr_classification.py
index.html
src/app.js
service-worker.js
```

## Comportamento implementado

A fusão inicial passou a usar:

```txt
fusion.version = audit-28
```

O bloco `fusion` agora inclui:

```txt
normalization_counts
```

Cada bloco OCR indexado passou a incluir:

```txt
normalized_text
normalization_status
normalization_notes
```

As linhas visuais e regiões funcionais também propagam:

```txt
normalized_text
```

## Exemplos de normalização

```txt
Raw OCR: "Kuẞ,"
normalized_text: "Kuß"
status: normalized_text_candidate
```

```txt
Raw OCR: "—"
normalized_text: "-"
status: continuation_token
```

```txt
Raw OCR: "A7 / G"
normalized_text: "A7/G"
status: normalized_chord_candidate
```

## Correção aplicada durante validação

Durante a validação local, o teste da Auditoria 28 revelou que:

```txt
" Kuẞ, "
```

estava sendo classificado como `unknown` antes da normalização textual, porque a pontuação externa impedia sua leitura como fragmento de sílaba.

Correção aplicada:

```txt
bed50b1 Fix audit 28 lyric normalization classification
```

A normalização agora consegue tratar candidatos textuais com pontuação externa preservando o raw OCR.

## Ajuste de frontend incluído

Também foi corrigido o campo `Compasso padrão` para iniciar vazio, exibindo apenas o placeholder:

```txt
Ex.: 3/4
```

O cache/frontend foi atualizado para:

```txt
audit-28-cache-v1
```

## Contrato de segurança preservado

A Auditoria 28 não cria alinhamento musical.

Todo bloco OCR, linha visual e região funcional continuam com:

```json
{
  "system_id": null,
  "measure_id": null,
  "status": "unassigned_no_musicxml_layout"
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
14 passed in 0.72s
```

## Resultado

A Auditoria 28 está validada:

```txt
fusion.version: audit-28
normalization_counts: OK
normalized_text em blocos OCR: OK
normalized_text em linhas visuais: OK
normalized_text em regiões funcionais: OK
texto OCR bruto preservado: OK
assignment pendente: OK
pytest: 14 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 29 — Detecção de possíveis cifras sem inferência harmônica
```

Alvo da próxima etapa:

- enriquecer candidatos de cifra detectados por OCR;
- registrar detalhes estruturais da cifra candidata;
- separar texto bruto, texto normalizado e análise do padrão de cifra;
- não inferir progressão harmônica;
- não preencher cifras ausentes;
- não alinhar cifras a compasso.

## Conclusão

Auditoria 28 aprovada. O CPP agora preserva evidência OCR bruta e cria uma camada normalizada conservadora, preparando o fechamento do Marco 1 com detecção estruturada de possíveis cifras.