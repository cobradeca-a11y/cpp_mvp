# Auditoria 57 — Comparação entre OMR, OCR e revisão humana validada

## Status

Aprovada com validação local e validação funcional do frontend em `audit-57-cache-v2`.

## Objetivo

Adicionar uma camada de comparação entre OMR/MusicXML, OCR/Fusion e revisão humana, mantendo o fluxo apenas leitura e sem promover OCR para compasso, letra ou harmonia.

## Implementação registrada

Commits da implementação e ajustes associados:

```txt
a95d06a Add audit 57 OMR OCR review comparison module
8dcf5b0 Wire audit 57 OMR OCR review comparison frontend
df5e99c Update service worker cache for audit 57
782010e Add audit 57 saved state cache clearing patch
2f48a4a Wire audit 57 saved state clearing patch
3fe13a5 Update service worker cache for audit 57 v2
4e57548 Use audit 57 v2 build in comparison export
```

## Arquivos alterados

```txt
src/modules/audit57-omr-ocr-review-comparison.js
src/modules/audit57-clear-saved-state-patch.js
index.html
service-worker.js
```

## Comportamento implementado

O frontend agora exibe:

```txt
Frontend build: audit-57-cache-v2
Seção: 3F. Comparação OMR × OCR × revisão humana
Botões: Gerar comparação / Exportar comparação JSON
```

A comparação consolida:

```txt
- camada OMR/MusicXML;
- camada OCR/Fusion;
- camada de revisão humana;
- achados comparativos;
- contrato de segurança apenas leitura.
```

## Correção pré-validação

Durante a validação cruzada, foi identificado que `Limpar cache do app` limpava cache/PWA, mas ainda deixava o protocolo salvo no navegador.

Foi adicionado patch para limpar:

```txt
- service worker;
- cache do PWA;
- protocolo salvo em localStorage;
- protocolo salvo em sessionStorage;
- campos Título/Tom/Compasso/Andamento;
- listas visuais de compassos/OCR/revisões;
- saídas geradas na tela.
```

Resultado confirmado após limpar:

```txt
Título: vazio / placeholder
Tom: vazio / placeholder
Compasso padrão: vazio / placeholder
Andamento: vazio / placeholder
Compasso atual: Nenhum compasso carregado.
Bloco OCR atual: Nenhum bloco OCR carregado.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro
pytest
```

Resultado confirmado pelo usuário:

```txt
18 passed
```

## Validação funcional — BeetAnGeSample.pdf

Arquivo validado:

```txt
BeetAnGeSample.pdf
```

Resumo confirmado pelo JSON exportado:

```json
{
  "export_type": "cpp_omr_ocr_review_comparison",
  "audit": "audit-57",
  "frontend": {
    "build": "audit-57-cache-v2"
  },
  "source": {
    "file_name": "BeetAnGeSample.pdf",
    "file_type": "pdf"
  }
}
```

Camada OMR/MusicXML:

```txt
Status: success
Engine: Audiveris/MusicXML
Páginas: 1
Sistemas: 1
Compassos: 15
Compasso padrão: 3/4
Tom: Eb
Andamento: pendente
```

Camada OCR/Fusion:

```txt
Status OCR: success
Engine OCR: google_vision
Blocos OCR: 102
Blocos Fusion: 102
Cifras candidatas: 0
Textos/letras candidatos: 67
OCR→sistema atribuídos: 0
OCR→compasso atribuídos: 0
Mapping status: evidence_indexed_needs_layout_mapping
```

Camada revisão humana:

```txt
Decisões totais: 0
Revisões de compasso: 0
Revisões OCR classificação: 0
Revisões OCR→sistema: 0
Revisões OCR→compasso: 0
```

## Validação funcional — Telemann.png

Arquivo validado:

```txt
Telemann.png
```

Resumo confirmado pelo JSON exportado:

```json
{
  "export_type": "cpp_omr_ocr_review_comparison",
  "audit": "audit-57",
  "frontend": {
    "build": "audit-57-cache-v2"
  },
  "source": {
    "file_name": "Telemann.png",
    "file_type": "png"
  }
}
```

Camada OMR/MusicXML:

```txt
Status: success
Engine: Audiveris/MusicXML
Páginas: 1
Sistemas: 1
Compassos: 35
Compasso padrão: 3/8
Tom: D
Andamento: pendente
```

Camada OCR/Fusion:

```txt
Status OCR: success
Engine OCR: google_vision
Blocos OCR: 77
Blocos Fusion: 77
Cifras candidatas: 0
Textos/letras candidatos: 25
OCR→sistema atribuídos: 0
OCR→compasso atribuídos: 0
Mapping status: evidence_indexed_needs_layout_mapping
```

Camada revisão humana:

```txt
Decisões totais: 0
Revisões de compasso: 0
Revisões OCR classificação: 0
Revisões OCR→sistema: 0
Revisões OCR→compasso: 0
```

## Achados comparativos validados

Achados confirmados nos arquivos testados:

```txt
omr_and_ocr_available — OMR/MusicXML e OCR/Fusion possuem evidências disponíveis para comparação.
ocr_fusion_counts_match — Quantidade de blocos OCR e blocos indexados no Fusion coincide.
ocr_measure_mapping_pending — OCR ainda não está atribuído a compassos, preservando a regra de não alinhar sem geometria confiável.
human_review_absent — Ainda não há revisão humana para comparar contra OMR/OCR.
tempo_not_available — Andamento não está disponível no protocolo e não será inferido.
```

## Contrato preservado

O JSON confirmou:

```json
{
  "modifies_protocol": false,
  "modifies_ocr_raw_text": false,
  "infers_lyrics": false,
  "infers_harmony": false,
  "aligns_ocr_to_measure_without_geometry": false,
  "comparison_only": true
}
```

## Regras preservadas

```txt
Não altera OMR.
Não altera OCR bruto.
Não altera MusicXML.
Não altera protocolo musical.
Não cria alinhamento OCR→sistema.
Não cria alinhamento OCR→compasso.
Não infere letra.
Não infere harmonia.
Toda evidência incerta permanece pendente para revisão humana.
```

## Resultado

A Auditoria 57 está validada:

```txt
Frontend build audit-57-cache-v2: OK
Exportação JSON com build v2: OK
Comparação OMR/MusicXML: OK
Comparação OCR/Fusion: OK
Camada revisão humana: OK
Achados comparativos: OK
Contrato apenas leitura: OK
pytest: 18 passed
```

## Próxima auditoria

```txt
Auditoria 58 — Score final de confiança por compasso
```

## Conclusão

Auditoria 57 aprovada. O CPP agora compara OMR/MusicXML, OCR/Fusion e revisão humana sem alterar o protocolo e sem promover evidências automaticamente.
