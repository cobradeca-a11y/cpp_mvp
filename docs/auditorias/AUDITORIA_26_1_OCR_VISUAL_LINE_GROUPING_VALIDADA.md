# Auditoria 26.1 — Agrupamento OCR por linha visual validado

## Status

Aprovada em validação local automatizada.

## Justificativa da numeração 26.1

A Auditoria 26 originalmente executada no repositório teve o escopo real de expor `classification_counts` no frontend e nos relatórios.

O roadmap macro, porém, previa para a Auditoria 26 o agrupamento OCR por linha visual.

Para não sobrescrever o que já foi validado e para preservar a intenção do roadmap, esta etapa foi registrada como:

```txt
Auditoria 26.1 — Agrupamento OCR por linha visual
```

## Objetivo

Agrupar blocos OCR próximos verticalmente em linhas visuais, preservando evidência textual e geometria agregada, sem criar associação musical com sistema ou compasso.

## Implementação registrada

Commits da implementação:

```txt
1e00270 Add audit 26.1 OCR visual line grouping
7c7b921 Update fusion contract tests for audit 26.1
88963fd Add audit 26.1 visual line grouping tests
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
fusion.version = audit-26.1
```

O bloco `fusion` agora inclui:

```txt
text_line_groups
```

Cada linha visual contém:

```json
{
  "line_id": "fl0001",
  "page": 1,
  "text": "Was ist",
  "text_block_ids": ["fx0001", "fx0002"],
  "classifications": {
    "possible_lyric": 2
  },
  "bbox": {
    "x_min": 10.0,
    "y_min": 100.0,
    "x_max": 70.0,
    "y_max": 113.0,
    "width": 60.0,
    "height": 13.0
  },
  "assignment": {
    "system_id": null,
    "measure_id": null,
    "status": "unassigned_no_musicxml_layout"
  }
}
```

## Regras de agrupamento

A implementação atual:

```txt
1. usa bbox dos blocos OCR quando disponível;
2. calcula centro vertical de cada bloco;
3. usa tolerância baseada na altura mediana dos blocos;
4. agrupa blocos da mesma página em linhas visuais próximas;
5. ordena blocos da linha por posição X;
6. concatena texto da linha;
7. agrega bbox da linha;
8. preserva classificações por contagem;
9. mantém assignment pendente.
```

## Contrato de segurança preservado

A Auditoria 26.1 não cria alinhamento musical.

Todo bloco OCR e toda linha visual continuam com:

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
12 passed
```

## Resultado

A Auditoria 26.1 está validada:

```txt
fusion.version: audit-26.1
text_line_groups: OK
bbox agregado por linha: OK
ordenação horizontal dos blocos: OK
classificações por linha: OK
assignment pendente: OK
pytest: 12 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 27 — Agrupamento OCR por região: instrumentos / pauta / letra / rodapé / editorial
```

Alvo da próxima etapa:

- classificar linhas visuais por região funcional aproximada;
- separar zonas como instrumentos, pauta, letra, rodapé e editorial;
- manter tudo como evidência;
- não alinhar ainda a sistema ou compasso;
- não gerar letra final;
- não inferir harmonia.

## Conclusão

Auditoria 26.1 aprovada. O CPP agora possui agrupamento OCR por linha visual como camada intermediária entre blocos OCR individuais e futuras regiões funcionais/layout musical.