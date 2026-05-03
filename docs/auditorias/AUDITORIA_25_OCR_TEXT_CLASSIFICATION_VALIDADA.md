# Auditoria 25 — Classificação conservadora de text_blocks OCR validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Melhorar a classificação dos blocos OCR sem ainda alinhar a sistema, compasso ou posição musical.

A auditoria separa melhor evidências OCR em categorias úteis para revisão humana e para futuras etapas de fusão, mantendo o princípio de segurança do CPP:

```txt
Não inventar harmonia.
Não inventar letra.
Não alinhar por compasso sem geometria confiável.
Preservar evidências OCR com classificação e status de confiança.
```

## Implementação registrada

Commits da implementação e correção:

```txt
8b95954 Expand conservative OCR text classification
91ae2f9 Add audit 25 OCR classification tests
0d99fd3 Fix audit 25 OCR classification contract
0eee419 Update backend fusion contract to audit 25
7875da9 Prioritize chord OCR classification before editorial text
```

## Arquivos alterados

```txt
backend/fusion_engine.py
backend/test_audit25_ocr_classification.py
backend/test_backend.py
```

## Comportamento implementado

A fusão inicial passou a usar:

```txt
fusion.version = audit-25
```

O bloco `fusion` agora inclui:

```txt
classification_counts
```

As classificações conservadoras reconhecidas incluem:

```txt
instrument_label
possible_lyric
lyric_syllable_fragment
lyric_hyphen_or_continuation
punctuation
music_symbol_noise
possible_chord
editorial_text
unknown
```

## Exemplos cobertos pelos testes

### Ruídos e pontuação

```txt
.   -> punctuation
!   -> punctuation
(   -> punctuation
)   -> punctuation
-   -> lyric_hyphen_or_continuation
_   -> lyric_hyphen_or_continuation
។   -> music_symbol_noise
```

### Texto editorial e instrumentos

```txt
tr       -> editorial_text
( a 2 )  -> editorial_text
u.Ob.    -> instrument_label
u.Cemb.  -> instrument_label
Ob       -> instrument_label
Viol     -> instrument_label
Viola    -> instrument_label
Bc       -> instrument_label
```

### Letras, sílabas e cifras

```txt
Was          -> possible_lyric
ist          -> possible_lyric
schöner      -> possible_lyric
Liebe        -> possible_lyric
süßer        -> possible_lyric
Kuẞ          -> lyric_syllable_fragment
Lie          -> lyric_syllable_fragment
be           -> lyric_syllable_fragment
D            -> possible_chord
A7/G         -> possible_chord
Em7(add11)   -> possible_chord
```

## Contrato de segurança preservado

Mesmo com classificação mais rica, a Auditoria 25 não introduz alinhamento espacial ou musical.

Todo bloco OCR indexado permanece com:

```json
{
  "system_id": null,
  "measure_id": null,
  "status": "unassigned_no_musicxml_layout"
}
```

## Validação local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
11 passed in 1.22s
```

## Resultado

A Auditoria 25 está validada:

```txt
fusion.version: audit-25
classification_counts: OK
instrument_label: OK
possible_lyric: OK
lyric_syllable_fragment: OK
lyric_hyphen_or_continuation: OK
punctuation: OK
music_symbol_noise: OK
possible_chord: OK
editorial_text: OK
unknown: preservado como fallback
pytest: 11 passed
```

## Importância para as próximas auditorias

Esta auditoria cria uma camada mais limpa entre OCR bruto e fusão musical.

Ela permite que próximas etapas exibam, auditem e filtrem evidências OCR com mais precisão antes de qualquer tentativa de mapeamento para sistemas, compassos ou sílabas reais da partitura.

## Próxima auditoria recomendada

```txt
Auditoria 26 — expor classification_counts e categorias OCR/Fusion no frontend e relatórios
```

Alvo da próxima etapa:

- mostrar resumo por categoria na tela principal;
- incluir `classification_counts` no relatório de detecção;
- não criar alinhamento por compasso;
- não inferir harmonia;
- não gerar letra final;
- apenas tornar a evidência da Auditoria 25 visível para revisão humana.

## Conclusão

Auditoria 25 aprovada e pronta para servir como base da próxima etapa de transparência visual no frontend e nos relatórios.