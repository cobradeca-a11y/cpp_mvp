# Auditoria 41 — Inserção conservadora de cifras candidatas aprovadas validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Inserir na cifra técnica apenas cifras candidatas OCR aprovadas por revisão humana, sem transformar detecção automática em cifra final e sem inferir harmonia.

## Implementação registrada

Commit da implementação:

```txt
095d192 Add audit 41 approved chord candidates to technical chord sheet
```

## Arquivo alterado

```txt
src/modules/chord-sheet-technical.js
```

## Comportamento implementado

A cifra técnica agora inclui a seção:

```txt
CIFRAS APROVADAS — AUDITORIA 41
Fonte: somente cifras candidatas OCR aprovadas por revisão humana.
```

A cifra é extraída apenas de blocos OCR com:

```txt
fusion.text_blocks_index[].human_review.status = classification_approved
fusion.text_blocks_index[].classification = possible_chord
```

## Lacuna conservadora

Quando não houver cifra aprovada, a cifra técnica registra:

```txt
[lacuna] Nenhuma cifra OCR aprovada para uso técnico.
Obs.: harmonia não será inferida; cifra detectada não vira cifra final sem aprovação humana.
```

## Análise permitida

A saída pode exibir apenas análise estrutural já registrada, por exemplo:

```txt
tipo=slash_bass_chord_candidate, raiz=A, extensão=7, baixo=G
```

Isso não representa função harmônica nem inferência musical nova.

## Regras preservadas

```txt
Não inferir harmonia.
Não transformar cifra detectada em cifra aprovada sem revisão humana.
Não transformar cifra aprovada em cifra tocável.
Não alinhar cifra a compasso sem evidência/revisão suficiente.
Não alterar texto OCR bruto.
Não alterar chord_analysis.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed in 0.61s
```

## Resultado

A Auditoria 41 está validada:

```txt
Seção de cifras aprovadas na cifra técnica: OK
Uso apenas de OCR aprovado: OK
Filtro por possible_chord: OK
Lacuna quando não há aprovação: OK
Sem inferência harmônica: OK
Sem promoção automática para cifra tocável: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 42 — Separar cifra detectada, cifra aprovada e cifra tocável
```

Alvo conservador da próxima etapa:

- deixar explícitas três camadas separadas;
- cifra detectada = evidência OCR/Fusion;
- cifra aprovada = decisão humana;
- cifra tocável = ainda não gerada quando faltar alinhamento/validação;
- não promover automaticamente entre camadas.

## Conclusão

Auditoria 41 aprovada. O CPP agora inclui cifras aprovadas na cifra técnica apenas quando houver aprovação humana explícita, preservando lacunas e evitando inferência harmônica.