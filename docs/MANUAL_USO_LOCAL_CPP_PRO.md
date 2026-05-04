# Manual de uso local — CPP_PRO

## Escopo

Este manual descreve o uso local do CPP_PRO — Conversor Profissional de Partituras.

O fluxo local cobre:

```txt
- atualização do repositório;
- validação com pytest;
- subida do backend OMR;
- abertura do frontend/PWA;
- limpeza de cache;
- processamento de partitura;
- revisão humana;
- exportação final auditável;
- diagnóstico básico.
```

## Regras permanentes do CPP

```txt
Não inventar harmonia.
Não inventar letra.
Não alinhar OCR a sistema ou compasso sem geometria confiável.
Preservar sempre o texto OCR bruto.
Toda evidência incerta deve ficar pendente para revisão humana.
Nenhum trecho deve ser marcado como pronto para cifra tocável automaticamente.
```

## Ambiente esperado

```txt
Sistema operacional usado na validação: Windows
Terminal recomendado: CMD
Repositório local: C:\HomeCloud\shared\Projetos\cpp_pro
Branch: main
Frontend build validado: audit-60-cache-v1
Backend: FastAPI/local em http://localhost:8787
OMR: Audiveris/MusicXML quando disponível
OCR: Google Vision via credenciais locais quando configurado
```

## 1. Atualizar o repositório

No CMD:

```cmd
cd C:\HomeCloud\shared\Projetos\cpp_pro
git pull origin main
```

## 2. Validar o estado local

```cmd
pytest
```

Resultado esperado atual:

```txt
18 passed
```

Podem aparecer warnings do tipo `DeprecationWarning` relacionados a tipos SWIG. Eles não invalidam a execução se o resultado final continuar sendo `18 passed`.

## 3. Subir o backend local

Use o comando local configurado no projeto para iniciar o backend OMR em:

```txt
http://localhost:8787
```

Validação no frontend:

```txt
Backend OMR → Verificar backend
```

Resultado esperado:

```txt
status: ok
Audiveris: disponível ou indisponível, conforme ambiente local
```

Se o backend não responder, verificar:

```txt
- se o processo do backend está rodando;
- se a porta 8787 está livre;
- se o terminal foi aberto na pasta correta;
- se as dependências Python estão instaladas;
- se as credenciais OCR locais foram configuradas quando necessárias.
```

## 4. Abrir o frontend local

Abra o app pelo modo local já usado no projeto.

Ao abrir a interface, confirme no topo:

```txt
Frontend build: audit-60-cache-v1
```

Se aparecer build antigo, execute a limpeza de cache pelo próprio app.

## 5. Limpar cache do app

Na interface:

```txt
Limpar cache do app
```

A limpeza deve remover:

```txt
- service worker;
- cache PWA;
- localStorage;
- sessionStorage;
- protocolo salvo cpp_professional_omr_protocol_v1;
- campos Título/Tom/Compasso/Andamento;
- listas visuais de compassos/OCR/revisões;
- saídas antigas.
```

Após recarregar, confirmar:

```txt
Compasso padrão: vazio
Placeholder: Ex.: 3/4
```

## 6. Processar uma partitura

Formatos aceitos pelo frontend:

```txt
PDF
PNG
JPG/JPEG
WEBP
MusicXML/XML/MXL
```

Fluxo:

```txt
1. Escolher arquivo.
2. Conferir Título/Tom/Compasso/Andamento.
3. Clicar em Processar com OMR Profissional.
4. Aguardar status de conclusão.
```

Exemplo de validação usada:

```txt
Arquivo: BeetAnGeSample.pdf
OMR: success
OCR: success
Compassos: 15
Blocos OCR: 102
```

## 7. Interpretação do resultado inicial

O CPP pode importar estrutura via MusicXML/OMR e OCR textual separadamente.

Quando não houver geometria confiável, o estado correto é manter OCR sem associação a sistema/compasso:

```txt
assignment.status: unassigned_no_musicxml_layout
```

Isso é intencional e preserva a regra:

```txt
Não alinhar OCR a sistema ou compasso sem geometria confiável.
```

## 8. Painéis principais

### 2. Revisão de compassos

Permite navegar entre compassos importados e marcar revisão estrutural básica.

Uso conservador:

```txt
- aceitar leitura somente quando conferida;
- marcar incerto quando houver dúvida;
- não usar aceitação como aprovação musical final.
```

### 2A. Revisão OCR por bloco

Mostra blocos OCR e texto bruto.

Regra:

```txt
O texto OCR bruto deve permanecer preservado.
```

### 2B. Histórico de decisões humanas

Lista entradas em:

```txt
protocol.review[]
```

## 9. Painéis de auditoria avançada

### 3K. Ajuste manual rápido de barras/compassos — Auditoria 58.4

Usa JSON manual para registrar bbox de sistema e barras confirmadas.

Não faz inferência automática de barras.

### 3L. Revisão de cifras/letras/lacunas por compasso — Auditoria 58.5

Permite ações manuais:

```txt
approve_chord_for_measure
reject_chord_for_measure
approve_lyric_for_measure
reject_lyric_for_measure
mark_gap
```

Uso seguro inicial:

```json
{
  "actions": [
    {
      "action": "mark_gap",
      "measure_id": "m001",
      "gap_type": "measure_needs_visual_review",
      "note": "pendente de revisão visual"
    }
  ]
}
```

### 3M. Pronto para cifra tocável — Auditoria 59

Liberação final para cifra tocável.

A liberação exige confirmação explícita:

```json
{
  "actions": [
    {
      "action": "release_measure_for_playable",
      "measure_id": "m001",
      "explicit_confirmation": true,
      "reason": "revisado visualmente e musicalmente pelo usuário"
    }
  ]
}
```

Bloqueio seguro:

```json
{
  "actions": [
    {
      "action": "block_measure_playable",
      "measure_id": "m001",
      "reason": "pendente de revisão humana suficiente"
    }
  ]
}
```

### 3N. Pacote de exportação final — Auditoria 60

Gera pacote final auditável.

Botões:

```txt
Pré-visualizar pacote
Exportar pacote final JSON
```

O pacote final deve conter:

```txt
export_type: cpp_final_export_package
audit: audit-60
protocol_snapshot
reports
safety_contract
```

Contrato esperado:

```txt
modifies_protocol: false
preserves_ocr_raw_text: true
infers_lyrics: false
infers_harmony: false
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
```

## 10. Fluxo completo recomendado por partitura

```txt
1. git pull origin main
2. pytest
3. subir backend local
4. abrir frontend
5. limpar cache do app
6. confirmar build atual
7. processar partitura
8. conferir OMR/OCR
9. revisar compassos visualmente
10. revisar OCR por bloco quando necessário
11. aplicar geometria manual se houver bbox/barras confirmadas
12. revisar cifras/letras/lacunas por compasso
13. bloquear ou liberar trechos para cifra tocável explicitamente
14. exportar pacote final auditável
15. guardar JSON final junto da partitura original
```

## 11. Quando usar geometria manual

Use somente quando o usuário tiver confirmado visualmente:

```txt
- bbox de sistema;
- posições reais de barras;
- divisão correta de compassos.
```

Não usar divisão uniforme do sistema como verdade geométrica.

Motivo:

```txt
Anacruse, compassos com densidade visual diferente e espaçamento editorial podem causar inferência geométrica incorreta.
```

## 12. Diagnóstico rápido

### Build antigo aparece

```txt
1. Clicar em Limpar cache do app.
2. Recarregar.
3. Conferir Frontend build.
```

### Partitura anterior reaparece

```txt
1. Clicar em Limpar cache do app.
2. Confirmar que o protocolo salvo foi removido.
3. Processar novamente o arquivo correto.
```

### Backend indisponível

```txt
1. Verificar se o backend está rodando.
2. Confirmar porta 8787.
3. Rodar novamente Verificar backend.
```

### OMR/OCR retorna success, mas OCR não associa a compassos

Isso pode estar correto se não houver geometria confiável.

Estado esperado:

```txt
OCR preservado
Fusion indexado
assignment sem compasso
revisão humana pendente
```

### Cifra tocável vazia ou bloqueada

Isso é esperado até existir liberação humana explícita.

## 13. Comandos rápidos

```cmd
cd C:\HomeCloud\shared\Projetos\cpp_pro
git pull origin main
pytest
```

Resultado esperado:

```txt
18 passed
```

## 14. Critério de pacote final válido

Um pacote final é válido quando:

```txt
- export_type = cpp_final_export_package;
- audit = audit-60 ou superior;
- protocol_snapshot existe;
- OCR bruto está preservado;
- safety_contract está presente;
- automatic_playable_releases = 0, salvo se alguma futura auditoria mudar explicitamente essa regra;
- evidências incertas permanecem pendentes.
```

## 15. Próxima etapa após este manual

```txt
Auditoria 62 — Checklist de validação por louvor
```

Objetivo:

```txt
Criar checklist objetivo para validar uma partitura/louvor real do início ao pacote final.
```
