# Auditoria 29 — Detecção estruturada de possíveis cifras sem inferência harmônica validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Enriquecer candidatos de cifra detectados pelo OCR com análise estrutural conservadora, sem inferir harmonia, sem preencher cifras ausentes e sem alinhar OCR a sistema ou compasso.

## Implementação registrada

Commits da implementação:

```txt
f87c259 Add audit 29 structured chord candidate detection
385df37 Update fusion contract tests for audit 29
9505880 Add audit 29 chord candidate analysis tests
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
fusion.version = audit-29
```

O bloco `fusion` agora inclui:

```txt
chord_candidate_counts
```

Candidatos de cifra agora podem incluir:

```txt
chord_analysis
```

em:

```txt
possible_chords[]
text_blocks_index[]
```

## Exemplo de análise estrutural

```json
{
  "pattern_status": "slash_bass_chord_candidate",
  "normalized_chord": "A7/G",
  "root": "A",
  "accidental": null,
  "quality": null,
  "extension": "7",
  "alterations": null,
  "bass": "G",
  "has_slash_bass": true,
  "confidence": "conservative",
  "notes": ["ocr_chord_candidate_only_no_harmonic_inference"]
}
```

## Padrões estruturais reconhecidos

```txt
root_only_chord_candidate
qualified_chord_candidate
altered_or_added_tone_chord_candidate
slash_bass_chord_candidate
unparsed_chord_candidate
```

## O que a auditoria não faz

```txt
Não infere função harmônica.
Não corrige cifra musicalmente.
Não completa cifra ausente.
Não cria progressão harmônica.
Não alinha cifra OCR a compasso.
Não alinha cifra OCR a sistema.
```

## Contrato de segurança preservado

Todo bloco OCR, linha visual, região funcional e candidato de cifra continuam com status pendente:

```json
{
  "system_id": null,
  "measure_id": null,
  "status": "unassigned_no_musicxml_layout"
}
```

Para candidatos de cifra:

```txt
assignment_status = unassigned_no_musicxml_layout
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed
```

## Resultado

A Auditoria 29 está validada:

```txt
fusion.version: audit-29
chord_candidate_counts: OK
possible_chords[].chord_analysis: OK
text_blocks_index[].chord_analysis: OK
root_only_chord_candidate: OK
slash_bass_chord_candidate: OK
altered_or_added_tone_chord_candidate: OK
sem inferência harmônica: OK
assignment pendente: OK
pytest: 15 passed
```

## Fechamento do Marco 1

Com a Auditoria 29, o Marco 1 fica funcionalmente fechado:

```txt
Marco 1 — Núcleo OCR/Fusion textual profissional
Auditorias 25–29
```

## Próxima auditoria recomendada

```txt
Auditoria 30 — Extrair/registrar geometria de página e sistema
```

Alvo da próxima etapa:

- criar camada explícita de geometria de página/layout;
- registrar sistemas MusicXML/layout quando houver evidência confiável;
- preservar ausência de geometria como dado explícito;
- não mapear OCR para sistema ainda;
- não mapear OCR para compasso ainda.

## Conclusão

Auditoria 29 aprovada. O CPP agora encerra o núcleo OCR/Fusion textual profissional com classificação, agrupamento visual, regiões funcionais, normalização textual e análise estrutural conservadora de cifras candidatas.