# Validação profissional com repertório real inicial — CPP_PRO

## Objetivo

Registrar a validação profissional inicial do CPP_PRO com partituras/louvores reais, usando o checklist da Auditoria 62 e o pacote final da Auditoria 60.

Este documento não valida musicalmente uma cifra por si só. Ele organiza evidências, resultados e pendências por arquivo processado.

## Regras permanentes

```txt
Não inventar harmonia.
Não inventar letra.
Não alinhar OCR a sistema ou compasso sem geometria confiável.
Preservar sempre o texto OCR bruto.
Toda evidência incerta deve ficar pendente para revisão humana.
Não marcar pronto para cifra tocável automaticamente.
```

## Critério de entrada no repertório real inicial

Um arquivo pode entrar neste registro quando:

```txt
[ ] Foi processado no CPP local.
[ ] Tem pacote final exportado.
[ ] Possui build registrado.
[ ] Possui OMR/OCR registrado.
[ ] Possui resumo de compassos/blocos OCR.
[ ] Possui safety_contract no pacote final.
[ ] Não teve promoção automática para cifra tocável.
```

## Tabela de repertório inicial

| ID | Louvor/Arquivo | Formato | Build | OMR | OCR | Compassos | OCR/Fusion | Pacote final | Status | Observações |
|---|---|---:|---|---|---|---:|---:|---|---|---|
| R001 | BeetAnGeSample.pdf | PDF | audit-60-cache-v1 | success | success | 15 | 102 | cpp_pacote_final_audit60_202605041740.json | validado operacionalmente | Pacote final exportado; sem revisão humana aplicada no protocolo limpo; geometria pending; prontidão tocável não liberada. |

## Registro R001 — BeetAnGeSample.pdf

### Identificação

```txt
ID: R001
Arquivo: BeetAnGeSample.pdf
Formato: PDF
Frontend build: audit-60-cache-v1
Pacote final: cpp_pacote_final_audit60_202605041740.json
```

### Resultado técnico validado

```txt
export_type: cpp_final_export_package
audit: audit-60
OMR: success
OCR: success
Páginas: 1
Sistemas: 1
Compassos: 15
Blocos OCR/Fusion: 102
Revisões humanas no pacote limpo: 0
Geometria de compassos: pending 15
Prontidão tocável: not_released 15
Liberações tocáveis automáticas: 0
```

### Contrato preservado

```txt
modifies_protocol: false
preserves_ocr_raw_text: true
infers_lyrics: false
infers_harmony: false
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
applies_human_review_without_user_action: false
```

### Decisão de validação

```txt
Status: validado operacionalmente
```

Significado:

```txt
O CPP processou o arquivo, consolidou pacote final auditável e preservou o contrato de segurança.
```

Não significa:

```txt
- cifra musical final aprovada;
- letra aprovada por compasso;
- harmonia validada;
- prontidão tocável liberada;
- geometria resolvida.
```

### Pendências do arquivo R001

```txt
[ ] Revisão visual de geometria, se necessária.
[ ] Revisão OCR por bloco, se o objetivo for gerar cifra técnica.
[ ] Revisão de cifras/letras/lacunas por compasso.
[ ] Liberação humana explícita para cifra tocável, se aplicável.
```

## Modelo para novos arquivos

Copiar este bloco para cada novo louvor/partitura real validado.

```txt
ID:
Louvor/Arquivo:
Formato:
Frontend build:
Pacote final:
OMR status:
OCR status:
Páginas:
Sistemas:
Compassos:
Blocos OCR/Fusion:
Revisões humanas:
Geometria:
Prontidão tocável:
Liberações automáticas:
Status: validado operacionalmente / pendente / não validado
Observações:
Pendências:
```

## Critério de status

### Validado operacionalmente

Usar quando:

```txt
[ ] O arquivo foi processado.
[ ] O pacote final foi exportado.
[ ] O contrato de segurança foi preservado.
[ ] O resultado é auditável.
```

### Pendente

Usar quando:

```txt
[ ] O pacote foi exportado, mas há etapa operacional necessária antes de considerar o arquivo utilizável.
[ ] Há falha parcial de OCR/OMR.
[ ] Há necessidade de revisão humana ainda não feita.
```

### Não validado

Usar quando:

```txt
[ ] O arquivo errado foi processado.
[ ] O build estava antigo.
[ ] O pacote final não contém protocol_snapshot.
[ ] O OCR bruto foi perdido.
[ ] Houve inferência indevida de letra/harmonia.
[ ] Houve liberação tocável automática.
```

## Próximo uso esperado

Para cada nova partitura/louvor real:

```txt
1. Usar docs/CHECKLIST_VALIDACAO_LOUVOR_CPP_PRO.md.
2. Processar no CPP local.
3. Exportar pacote final.
4. Registrar resultado neste documento.
5. Manter pendências explícitas sem inventar música.
```
