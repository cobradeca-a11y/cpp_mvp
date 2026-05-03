# Auditoria 22 — Google Vision OCR real validado

## Status

Aprovada em validação local.

## Escopo validado

Validação do fluxo profissional com os dois motores atuando no mesmo protocolo:

```txt
PNG de partitura
↓
Audiveris / MusicXML
↓
Google Cloud Vision OCR
↓
cpp_protocol.json
```

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

O arquivo foi processado pelo Audiveris, convertido para MusicXML e importado pelo parser CPP com 35 compassos.

## Resultado OCR

```txt
Motor OCR: google_vision
Status OCR: success
Autenticação: Application Default Credentials local
```

O bloco `ocr.text_blocks` foi preenchido pelo Google Vision com textos e coordenadas. Foram capturados textos como indicações instrumentais e letras, incluindo exemplos como:

```txt
Ob.
Viol.
Viola
Liebe
Was ist schöner als die Liebe
was schmeckt süßer
```

## Configuração validada

Ambiente local configurado sem chave JSON de conta de serviço, usando ADC local:

```env
OCR_ENGINE=google_vision
OCR_FEATURE=DOCUMENT_TEXT_DETECTION
```

Credenciais ADC configuradas por:

```bat
gcloud auth application-default login
gcloud auth application-default set-quota-project cpp-pro-495201
```

Projeto Google Cloud usado:

```txt
cpp-pro-495201
```

Condições externas resolvidas:

```txt
Cloud Vision API ativada
Billing vinculado ao projeto
ADC local validado
```

## Evidência do protocolo

Campos confirmados no `cpp_protocol.json` exportado:

```json
"source": {
  "file_name": "Telemann.png",
  "file_type": "png",
  "omr_status": "success",
  "omr_engine": "Audiveris/MusicXML",
  "ocr_status": "success",
  "ocr_engine": "google_vision"
}
```

```json
"ocr": {
  "status": "success",
  "engine": "google_vision",
  "text_blocks": [...],
  "warnings": [
    "Google Vision executado via Application Default Credentials local."
  ]
}
```

## Interpretação técnica

A Auditoria 22 comprovou que:

- o backend executa Audiveris sobre imagem PNG;
- o Audiveris gera MusicXML estrutural aproveitável;
- o parser CPP importa a estrutura musical;
- o Google Vision executa OCR real no mesmo fluxo;
- o protocolo preserva status OMR e OCR separadamente;
- o OCR registra evidências textuais e coordenadas sem alterar `measures`;
- não há fusão MusicXML + OCR ainda;
- a cifra tocável permanece corretamente provisória.

## Limites preservados

Não foi implementado nesta auditoria:

- fusão entre `ocr.text_blocks` e compassos MusicXML;
- classificação definitiva de letras/cifras;
- alinhamento textual por compasso;
- inferência de acordes;
- conversão PDF → imagem para OCR Google Vision direto.

## Próximo passo recomendado

```txt
Auditoria 23 — fusão inicial MusicXML + OCR
```

Objetivo da próxima etapa:

- relacionar blocos OCR a regiões/sistemas importados;
- separar texto editorial, instrumentos, letra e possíveis cifras;
- preservar tudo como evidência, sem inventar harmonia;
- preparar o caminho para alinhamento por compasso/tempo.

## Conclusão

Auditoria 22 e 22.1 aprovadas:

```txt
Google Vision OCR real: validado
ADC local sem chave JSON: validado
Audiveris + Google Vision no mesmo protocolo: validado
```
