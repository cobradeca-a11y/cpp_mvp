# Auditoria 23 — Fusão inicial MusicXML + OCR validada

## Status

Aprovada em validação local real.

## Objetivo

Criar uma primeira camada conservadora de fusão entre a estrutura MusicXML importada pelo Audiveris e os blocos textuais detectados pelo Google Vision OCR.

Esta auditoria não deveria:

- inventar cifras;
- inventar letras;
- alterar compassos;
- atribuir texto a compasso sem geometria confiável;
- substituir o MusicXML como fonte estrutural.

## Arquivo testado

```txt
Telemann.png
```

## Resultado OMR

```txt
Motor OMR: Audiveris/MusicXML
Status OMR: success
Compassos importados: 35
Tom detectado: D
Fórmula de compasso: 3/8
```

## Resultado OCR

```txt
Motor OCR: google_vision
Status OCR: success
Blocos OCR detectados: 77
```

## Resultado da fusão inicial

O protocolo exportado incluiu o bloco:

```json
"fusion": {
  "status": "evidence_indexed_needs_layout_mapping",
  "engine": "initial_musicxml_ocr_fusion",
  "version": "audit-23"
}
```

Entradas registradas:

```json
"inputs": {
  "omr_status": "success",
  "ocr_status": "success",
  "systems_count": 1,
  "measures_count": 35,
  "text_blocks_count": 77
}
```

## Comportamento validado

Os 77 blocos OCR foram indexados em `fusion.text_blocks_index`.

Classificações observadas:

```txt
instrument_label
possible_lyric
unknown
```

Exemplos de `instrument_label`:

```txt
Ob
Viol
Viola
Bc
u.Cemb
```

Exemplos de `possible_lyric`:

```txt
Lie_be
Lie
be
Was
ist
schö
ner
als
die
Liebe
was
schmeckt
süßer
```

Não foram detectadas cifras candidatas neste arquivo:

```json
"possible_chords": []
```

## Regra conservadora preservada

Como o protocolo ainda não possui geometria confiável de sistema/compasso vinda do MusicXML/Audiveris, todos os blocos OCR permaneceram sem atribuição espacial definitiva:

```json
"assignment": {
  "system_id": null,
  "measure_id": null,
  "status": "unassigned_no_musicxml_layout"
}
```

Essa decisão está correta para a Auditoria 23.

## Warning esperado

O protocolo registrou corretamente:

```txt
Blocos OCR indexados. Relação com sistema/compasso permanece pendente até existir geometria MusicXML/layout confiável.
```

## Testes executados

Validação automatizada local:

```txt
cd backend
pytest
8 passed
```

## Commits da implementação

```txt
b0a070e Add initial MusicXML OCR fusion engine
05b4ea4 Attach initial fusion block to backend protocol
7b87054 Test initial MusicXML OCR fusion contract
```

## Limite detectado para próxima auditoria

O `detection_report` ainda informa que OCR/fusão não foram executados, mesmo quando `ocr.status = success` e `fusion.status = evidence_indexed_needs_layout_mapping`.

Esse problema não invalida a Auditoria 23, pois o protocolo está correto, mas exige atualização das saídas e da interface.

## Próxima auditoria

```txt
Auditoria 24 — atualizar relatórios/frontend para reconhecer OCR e fusion
```

Objetivos da próxima etapa:

- exibir OMR, OCR e Fusion no resumo da tela;
- atualizar `detection_report` para mostrar `ocr.status`, `fusion.status` e quantidade de blocos OCR;
- remover mensagens obsoletas como “OCR/fusão ainda não executados” quando o bloco `fusion` já existir;
- manter a cifra tocável como provisória até haver alinhamento por compasso.

## Conclusão

Auditoria 23 aprovada:

```txt
Fusão inicial MusicXML + OCR: validada
Indexação OCR: validada
Classificação conservadora: validada
Atribuição a compasso: corretamente pendente
```
