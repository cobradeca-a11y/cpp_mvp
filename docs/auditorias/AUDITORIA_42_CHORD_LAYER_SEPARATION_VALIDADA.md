# Auditoria 42 — Separação entre cifra detectada, cifra aprovada e cifra tocável validada

## Status

Aprovada em validação local automatizada.

## Objetivo

Separar explicitamente as camadas de cifra no output técnico, impedindo promoção automática entre cifra detectada, cifra aprovada e cifra tocável.

## Implementação registrada

Commit da implementação:

```txt
8a54356 Add audit 42 chord layer separation to technical output
```

## Arquivo alterado

```txt
src/modules/chord-sheet-technical.js
```

## Comportamento implementado

A cifra técnica agora inclui a seção:

```txt
CAMADAS DE CIFRA — AUDITORIA 42
Regra: cifra detectada ≠ cifra aprovada ≠ cifra tocável.
```

A seção apresenta explicitamente:

```txt
Cifra detectada: candidatos OCR/Fusion classificados como possible_chord.
Cifra aprovada: candidatos possible_chord aprovados por revisão humana.
Cifra tocável: bloqueada quando faltar cifra aprovada ou alinhamento OCR→compasso confiável.
```

## Definições preservadas

```txt
Cifra detectada = evidência OCR/Fusion.
Cifra aprovada = decisão humana sobre cifra candidata.
Cifra tocável = camada posterior, dependente de aprovação e alinhamento confiável.
```

## Bloqueio conservador

Quando não houver cifra aprovada:

```txt
Cifra tocável: bloqueada — sem cifra aprovada
```

Quando houver cifra aprovada, mas não houver associação OCR→compasso confiável:

```txt
Cifra tocável: bloqueada — sem alinhamento OCR→compasso confiável
```

## Regras preservadas

```txt
Não promover cifra detectada para cifra aprovada.
Não promover cifra aprovada para cifra tocável.
Não inferir harmonia.
Não alinhar cifra a compasso sem evidência confiável.
Não alterar texto OCR bruto.
Não alterar chord_analysis.
Não alterar decisões humanas.
```

## Validação automatizada local

Executado localmente:

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro\backend
pytest
```

Resultado confirmado:

```txt
15 passed in 0.58s
```

## Resultado

A Auditoria 42 está validada:

```txt
Separação detectada/aprovada/tocável: OK
Cifra detectada não promovida: OK
Cifra aprovada não promovida: OK
Cifra tocável bloqueada sem aprovação/alinhamento: OK
Sem inferência harmônica: OK
pytest: 15 passed
```

## Próxima auditoria recomendada

```txt
Auditoria 43 — Marcar lacunas por compasso
```

Alvo conservador da próxima etapa:

- registrar lacunas por compasso;
- marcar ausência de letra aprovada;
- marcar ausência de cifra aprovada;
- marcar ausência de alinhamento confiável;
- não preencher lacunas automaticamente.

## Conclusão

Auditoria 42 aprovada. O CPP agora distingue claramente cifra detectada, cifra aprovada e cifra tocável, impedindo promoção automática entre camadas.