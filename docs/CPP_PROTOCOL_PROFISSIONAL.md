# CPP — Protocolo Profissional Oficial

## 1. Decisão arquitetural

O CPP não usa heurísticas visuais como motor principal de leitura.

O CPP não deve tentar “adivinhar” barras, acordes, sílabas, notas ou alinhamentos por pixel, região visual ou distância horizontal como fonte primária.

A arquitetura oficial é:

```txt
PDF / imagem
↓
OMR profissional
↓
MusicXML
↓
OCR profissional de texto/layout
↓
Motor de fusão estrutural
↓
cpp_protocol.json
↓
IA validadora
↓
Revisão humana
↓
Exportação
```

## 2. Papel de cada camada

### 2.1 OMR profissional

Responsável por extrair estrutura musical.

Fonte preferencial:

```txt
Audiveris → MusicXML
```

Deve fornecer, quando possível:

- páginas;
- sistemas;
- compassos;
- claves;
- armadura;
- fórmula de compasso;
- notas;
- pausas;
- durações;
- vozes;
- barras;
- repetições;
- navegação estrutural;
- exportação MusicXML/MXL.

### 2.2 OCR profissional

Responsável por extrair texto e layout que o OMR musical pode não preservar bem.

Deve ler:

- cifras/acordes escritos;
- letra cantada;
- sílabas;
- D.S.;
- D.C.;
- Coda;
- Fine;
- Al Coda;
- andamento;
- títulos;
- textos editoriais.

O OCR não substitui o OMR. Ele complementa o MusicXML.

### 2.3 Parser MusicXML

Converte o MusicXML para o formato interno do CPP.

O parser não deve inventar dados ausentes.

Ele deve apenas transformar estrutura confiável em JSON CPP.

### 2.4 Motor de fusão estrutural

Une:

```txt
MusicXML estrutural
+
OCR textual/layout
```

O motor de fusão deve relacionar:

- compasso musical;
- tempo/posição musical;
- nota ou pausa;
- sílaba;
- acorde;
- navegação;
- incertezas.

Quando não houver evidência suficiente, deve marcar como `needs_review`.

### 2.5 IA validadora

A IA validadora não é fonte primária.

Ela não lê a imagem para inventar cifra.

Ela audita o JSON CPP, o MusicXML resumido e o OCR extraído.

A função da IA é apontar inconsistências, como:

- compasso com duração incoerente;
- acorde sem posição musical clara;
- sílaba sem nota associável;
- D.S./Coda/Fine detectado mas não resolvido;
- anacruse sem fechamento;
- repetição ambígua;
- conflito entre OCR e MusicXML;
- baixa confiança em determinado trecho.

A saída da IA deve ser JSON estruturado, não texto livre.

### 2.6 Revisão humana

A revisão humana corrige apenas pendências.

O usuário não deve reconstruir a partitura manualmente.

A revisão deve operar sobre:

- compassos;
- acordes;
- sílabas;
- navegação;
- alinhamentos;
- pendências apontadas pelo validador.

## 3. Proibições do protocolo profissional

O CPP profissional não deve usar como motor principal:

- detecção de barra por pixel;
- detecção de nota por blob escuro;
- detecção de acorde por região visual simples;
- detecção de sílaba por região visual simples;
- alinhamento por distância horizontal como decisão final;
- classificação musical baseada apenas em canvas;
- heurística local como substituta do OMR.

Essas técnicas não fazem parte do fluxo profissional oficial.

## 4. Estrutura do `cpp_protocol.json`

O JSON oficial deve registrar origem, motor, evidências e revisão.

Estrutura base:

```json
{
  "cpp_version": "professional-omr-1.0",
  "source": {
    "file_name": "",
    "file_type": "pdf|image|musicxml|mxl",
    "pages": 0,
    "omr_status": "pending|success|failed|unavailable",
    "omr_engine": "Audiveris",
    "ocr_status": "pending|success|failed|unavailable",
    "ocr_engine": "",
    "validation_status": "pending|passed|needs_review|failed"
  },
  "music": {
    "title": "",
    "key": "",
    "meter_default": "",
    "tempo": "",
    "composer": "",
    "arranger": ""
  },
  "pages": [],
  "systems": [],
  "measures": [],
  "navigation": {
    "visual_markers": [],
    "execution_order": [],
    "status": "visual_only|auto_resolved|manual_confirmed|needs_review"
  },
  "validation": {
    "overall_confidence": 0,
    "issues": []
  },
  "review": [],
  "outputs": {
    "technical_chord_sheet": "",
    "playable_chord_sheet": "",
    "uncertainty_report": "",
    "detection_report": ""
  }
}
```

## 5. Regras de confiança

A confiança deve vir de evidências, não de aparência.

Fontes aceitáveis:

- `musicxml`;
- `ocr`;
- `fusion`;
- `ai_validation`;
- `human_review`.

Fontes não oficiais:

- `heuristic`;
- `pixel_detection`;
- `canvas_guess`;
- `visual_region_guess`.

## 6. Fluxo oficial do app

O fluxo principal do CPP é:

```txt
1. Upload do PDF/imagem
2. Processar com OMR profissional
3. Gerar MusicXML
4. Rodar OCR profissional
5. Fundir MusicXML + OCR
6. Gerar cpp_protocol.json
7. Validar inconsistências com IA
8. Revisar pendências
9. Exportar cifra técnica
10. Exportar cifra tocável
```

## 7. Critério de sucesso

O CPP profissional não promete acerto absoluto automático.

O objetivo é gerar uma leitura inicial estruturalmente confiável e reduzir a revisão humana ao mínimo necessário.

Sucesso =

```txt
partitura processada
+
MusicXML/estrutura musical importada
+
texto/cifras capturados por OCR
+
pendências apontadas claramente
+
usuário revisa apenas o necessário
+
cifra final exportável
```

## 8. Estado canônico

Este documento substitui qualquer protocolo anterior baseado em MVP semiautomático, heurísticas visuais, recorte manual de sistema, geração manual de compassos ou detecção por canvas.
