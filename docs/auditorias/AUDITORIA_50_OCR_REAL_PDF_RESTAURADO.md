# Auditoria 50 — OCR real em PDF restaurado e validado

## Status

Validação complementar aprovada após o fechamento da Auditoria 50 em `audit-50-cache-v5`.

## Contexto

Durante a validação da Auditoria 50, o frontend passou a exibir corretamente avisos de OCR quando o backend retornava:

```txt
Status OCR: unavailable
Blocos OCR: 0
```

O aviso inicialmente validado foi:

```txt
OCR_ENGINE não configurado. OCR real ainda não foi executado.
```

Depois, a configuração local da Auditoria 22 foi restaurada para Google Vision OCR real:

```env
OCR_ENGINE=google_vision
OCR_FEATURE=DOCUMENT_TEXT_DETECTION
GOOGLE_CLOUD_PROJECT=cpp-pro-495201
```

Também foi adicionada a dependência necessária para conversão local de PDF em imagens:

```txt
PyMuPDF==1.24.14
```

## Commits relacionados

```txt
37eac71 Add PyMuPDF dependency for PDF OCR conversion
ab5949b Allow OCR contract validation when OMR unavailable
0bc0260 Normalize PDF OCR failure when OMR unavailable
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro
pytest
```

Resultado confirmado:

```txt
18 passed, 5 warnings in 0.71s
```

Os warnings são depreciações vindas de PyMuPDF/fitz e não bloqueiam a validação.

## Validação funcional do frontend

Confirmado pelo usuário:

```txt
Frontend build: audit-50-cache-v5 — OK
Verificar backend — OK
```

## Validação funcional com PDF real

Arquivo testado:

```txt
MozaChloSample.pdf
```

Resultado confirmado no app:

```txt
Processamento concluído.
Arquivo: MozaChloSample.pdf
Status OMR: success
Status OCR: success
Blocos OCR: 76
Compassos importados: 18
```

## Interpretação

O fluxo PDF real foi restaurado:

```txt
PDF real
↓
Audiveris / OMR
↓
MusicXML
↓
PyMuPDF converte PDF em imagens por página
↓
Google Vision OCR
↓
ocr.text_blocks
↓
cpp_protocol.json
```

## Regras preservadas

```txt
Não inventa harmonia.
Não inventa letra.
Não alinha OCR a sistema ou compasso sem geometria confiável.
Preserva OCR bruto.
Toda evidência incerta permanece pendente para revisão humana.
```

## Resultado

```txt
OMR em PDF real: OK
OCR real em PDF: OK
Blocos OCR gerados: OK
Frontend exibe estado operacional: OK
pytest: 18 passed
```

## Próxima auditoria

```txt
Auditoria 51 — Fila/estado de processamento
```

## Conclusão

A restauração do OCR real em PDF está validada. A Auditoria 50 fica consolidada com tratamento profissional de erro/estado e com confirmação funcional de OCR real em PNG e PDF.
