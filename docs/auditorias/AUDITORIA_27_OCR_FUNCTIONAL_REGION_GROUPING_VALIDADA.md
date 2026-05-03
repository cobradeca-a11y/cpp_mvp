# Auditoria 27 — Agrupamento OCR por região funcional validado

## Status

Aprovada em validação local automatizada.

## Objetivo

Agrupar linhas visuais OCR em regiões funcionais conservadoras, como instrumento, letra, cifra, editorial, ruído e desconhecido, sem criar associação com sistema musical ou compasso.

## Implementação registrada

Commits da implementação:

```txt
e258239 Add audit 27 OCR functional region grouping
42d6b89 Update fusion contract tests for audit 27
5f2d577 Add audit 27 OCR region grouping tests
```

## Arquivos alterados

```txt
backend/fusion_engine.py
backend/test_backend.py
backend/test_audit25_ocr_classification.py
```

## Comportamento implementado

A fusão inicial passou a usar:

```txt
fusion.version = audit-27
```

O bloco `fusion` agora inclui:

```txt
text_region_groups
region_counts
```

## Regiões funcionais reconhecidas

```txt
instrument_region
lyric_region
chord_region
editorial_region
noise_region
unknown_text_region
unknown_region
```

## Exemplo de região funcional

```json
{
  "region_id": "fr0001",
  "region_type": "lyric_region",
  "confidence": "conservative",
  "reason": "predominant_lyric_text_or_fragments",
  "page": 1,
  "line_ids": ["fl0004"],
  "text": "Was ist",
  "classifications": {
    "possible_lyric": 2
  },
  "bbox": {
    "x_min": 50.0,
    "y_min": 130.0,
    "x_max": 108.0,
    "y_max": 143.0,
    "width": 58.0,
    "height": 13.0
  },
  "assignment": {
    "system_id": null,
    "measure_id": null,
    "status": "unassigned_no_musicxml_layout"
  }
}
```

## Critério conservador

A classificação da região é feita a partir das classificações OCR/Fusion já existentes em cada linha visual.

Exemplos:

```txt
instrument_label predominante -> instrument_region
possible_chord predominante -> chord_region
possible_lyric / lyric_syllable_fragment predominante -> lyric_region
editorial_text / possible_navigation predominante -> editorial_region
punctuation / music_symbol_noise / continuation predominante -> noise_region
mistura insuficiente -> unknown_text_region
linha vazia/não classificada -> unknown_region
```

## Contrato de segurança preservado

A Auditoria 27 não cria alinhamento musical.

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
13 passed in 1.90s
```

## Resultado

A Auditoria 27 está validada:

```txt
fusion.version: audit-27
text_region_groups: OK
region_counts: OK
instrument_region: OK
lyric_region: OK
chord_region: OK
editorial_region: OK
noise_region: OK
assignment pendente: OK
pytest: 13 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 28 — Normalização de sílabas e fragmentos OCR
```

Alvo da próxima etapa:

- normalizar fragmentos de sílaba OCR;
- preservar texto original;
- criar campo normalizado sem substituir evidência bruta;
- tratar hífen/continuação de forma conservadora;
- não gerar letra final;
- não alinhar a compasso;
- não inferir conteúdo musical.

## Conclusão

Auditoria 27 aprovada. O CPP agora possui uma camada funcional conservadora sobre linhas OCR, preparando o caminho para normalização textual e revisão humana futura.