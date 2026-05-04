# Checklist de validação por louvor — CPP_PRO

## Objetivo

Este checklist orienta a validação de uma partitura/louvor real no CPP_PRO, do arquivo original até o pacote final auditável.

Ele deve ser usado para garantir que o CPP não promova evidências automaticamente e que toda decisão musical relevante passe por revisão humana.

## Identificação do louvor

Preencher antes de iniciar:

```txt
Título:
Arquivo original:
Formato: PDF / PNG / JPG / WEBP / MusicXML / MXL / XML
Data da validação:
Validador humano:
Backend local:
Frontend build:
Pacote final exportado:
```

## 1. Preparação local

```txt
[ ] Abrir CMD.
[ ] Entrar na pasta do projeto.
[ ] Atualizar repositório.
[ ] Rodar pytest.
[ ] Confirmar 18 passed.
[ ] Subir backend local.
[ ] Verificar backend no frontend.
[ ] Limpar cache do app.
[ ] Confirmar build atual.
[ ] Confirmar campo “Compasso padrão” vazio, com placeholder “Ex.: 3/4”.
```

Comandos:

```cmd
cd C:\HomeCloud\shared\Projetos\cpp_pro
git pull origin main
pytest
```

Resultado esperado:

```txt
18 passed
```

## 2. Entrada da partitura

```txt
[ ] Selecionar arquivo correto.
[ ] Conferir nome do arquivo exibido.
[ ] Preencher título somente se necessário.
[ ] Preencher tom somente se estiver explícito/conhecido pelo usuário.
[ ] Preencher compasso padrão somente se estiver explícito/conhecido pelo usuário.
[ ] Preencher andamento somente se estiver explícito na partitura ou informado pelo usuário.
[ ] Não preencher metadados por palpite.
```

## 3. Processamento OMR/OCR

```txt
[ ] Clicar em Processar com OMR Profissional.
[ ] Aguardar fim do processamento.
[ ] Confirmar status OMR.
[ ] Confirmar status OCR.
[ ] Anotar quantidade de páginas.
[ ] Anotar quantidade de sistemas.
[ ] Anotar quantidade de compassos.
[ ] Anotar quantidade de blocos OCR/Fusion.
```

Campos para registro:

```txt
OMR status:
OCR status:
Páginas:
Sistemas:
Compassos:
Blocos OCR/Fusion:
```

## 4. Conferência inicial do contrato

```txt
[ ] OCR bruto preservado.
[ ] Nenhuma letra inferida.
[ ] Nenhuma harmonia inferida.
[ ] Nenhum OCR alinhado a compasso sem geometria confiável.
[ ] Nenhum trecho marcado automaticamente como pronto para cifra tocável.
[ ] Evidências incertas permanecem pendentes.
```

## 5. Revisão estrutural de compassos

```txt
[ ] Navegar pelos compassos.
[ ] Confirmar se a quantidade de compassos importada parece compatível com a partitura.
[ ] Marcar incertos os compassos duvidosos.
[ ] Não aceitar compasso como final se a região visual ainda não foi conferida.
[ ] Registrar qualquer problema de divisão, ausência ou duplicidade de compasso.
```

Observações:

```txt
Compassos com problema:
Compassos ausentes:
Compassos duplicados:
Comentários:
```

## 6. Revisão OCR por bloco

```txt
[ ] Conferir blocos OCR principais.
[ ] Preservar texto OCR bruto.
[ ] Diferenciar texto editorial, título, instrumento, cifra candidata e letra candidata.
[ ] Não corrigir OCR bruto destrutivamente.
[ ] Registrar aprovação/rejeição apenas quando houver conferência visual.
```

Campos críticos:

```txt
Cifras candidatas claras:
Cifras candidatas duvidosas:
Letras candidatas claras:
Letras candidatas duvidosas:
Textos editoriais/títulos/instrumentos:
```

## 7. Geometria manual, se necessária

Usar somente se houver confirmação visual.

```txt
[ ] Verificar se há geometria confiável automática.
[ ] Se não houver, manter pending.
[ ] Só aplicar bbox/barras manualmente se o usuário confirmar visualmente.
[ ] Não usar divisão uniforme de sistema como verdade geométrica.
[ ] Registrar source human_barline_review quando aplicar geometria manual.
```

Campos:

```txt
Sistemas ajustados manualmente:
Compassos com bbox manual:
Compassos ainda pending:
Comentários:
```

## 8. Revisão de cifras/letras/lacunas por compasso

Usar o painel 3L.

Ações permitidas:

```txt
approve_chord_for_measure
reject_chord_for_measure
approve_lyric_for_measure
reject_lyric_for_measure
mark_gap
```

Checklist:

```txt
[ ] Aprovar cifra somente se o texto foi conferido visualmente.
[ ] Aprovar letra somente se o texto foi conferido visualmente.
[ ] Rejeitar evidência OCR errada ou fora de contexto.
[ ] Marcar lacuna quando faltar informação confiável.
[ ] Marcar “sem cifra visível” quando aplicável.
[ ] Marcar “OCR ilegível” quando aplicável.
[ ] Marcar “compasso sem associação segura” quando aplicável.
```

Campos:

```txt
Compassos com cifra aprovada:
Compassos com letra aprovada:
Compassos com evidência rejeitada:
Compassos com lacunas:
```

## 9. Pronto para cifra tocável

Usar o painel 3M.

Regra central:

```txt
Nenhum compasso ou trecho deve ser liberado para cifra tocável automaticamente.
```

Checklist:

```txt
[ ] Bloquear compassos pendentes.
[ ] Liberar somente compassos revisados visualmente.
[ ] Usar explicit_confirmation: true para liberar.
[ ] Registrar reason clara.
[ ] Revogar liberação se surgir dúvida.
[ ] Confirmar automatic_releases = 0 no relatório.
```

Exemplo de bloqueio:

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

Exemplo de liberação explícita:

```json
{
  "actions": [
    {
      "action": "release_measure_for_playable",
      "measure_id": "m001",
      "explicit_confirmation": true,
      "reason": "cifra/letra/lacuna revisadas visualmente pelo usuário"
    }
  ]
}
```

Campos:

```txt
Compassos liberados:
Compassos bloqueados:
Liberações revogadas:
Automatic releases:
```

## 10. Exportação final

Usar painel 3N.

```txt
[ ] Pré-visualizar pacote final.
[ ] Confirmar export_type cpp_final_export_package.
[ ] Confirmar audit audit-60 ou superior.
[ ] Confirmar protocol_snapshot presente.
[ ] Confirmar safety_contract presente.
[ ] Confirmar preserves_ocr_raw_text true.
[ ] Confirmar infers_lyrics false.
[ ] Confirmar infers_harmony false.
[ ] Confirmar marks_playable_ready_automatically false.
[ ] Exportar pacote final JSON.
[ ] Guardar JSON junto da partitura original.
```

Campos do pacote:

```txt
Arquivo exportado:
export_type:
audit:
frontend.build:
measures_total:
ocr_blocks_total:
review_total:
lacunae_total:
automatic_playable_releases:
```

## 11. Critério mínimo de validação do louvor

Um louvor é considerado validado operacionalmente quando:

```txt
[ ] O arquivo correto foi processado.
[ ] O pacote final foi exportado.
[ ] O OCR bruto foi preservado.
[ ] O safety_contract está presente.
[ ] Toda evidência incerta está pendente ou marcada como lacuna.
[ ] Nenhuma harmonia foi inventada.
[ ] Nenhuma letra foi inventada.
[ ] Nenhum OCR foi alinhado a compasso sem geometria/revisão.
[ ] Nenhuma prontidão tocável foi marcada automaticamente.
```

## 12. Critério para “não validado”

Marcar o louvor como não validado se qualquer item abaixo ocorrer:

```txt
[ ] O arquivo processado não é o arquivo esperado.
[ ] O app carregou build antigo.
[ ] A partitura anterior reapareceu após limpar cache.
[ ] O pacote final não contém protocol_snapshot.
[ ] O OCR bruto foi perdido ou sobrescrito.
[ ] Houve cifra/letra aprovada sem revisão humana.
[ ] Houve liberação tocável automática.
[ ] O relatório não informa safety_contract.
```

## 13. Registro final manual

```txt
Louvor:
Arquivo original:
Pacote final JSON:
Resultado: validado / não validado / pendente
Motivo se pendente ou não validado:
Próximas correções necessárias:
Data:
Responsável:
```

## 14. Comando final recomendado

Após exportar e salvar o pacote final, rodar novamente:

```cmd
cd C:\HomeCloud\shared\Projetos\cpp_pro
pytest
```

Resultado esperado:

```txt
18 passed
```
