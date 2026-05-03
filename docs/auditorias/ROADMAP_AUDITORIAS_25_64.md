# Roadmap de Auditorias CPP — 25 a 64

Este documento registra o andamento planejado do CPP após a validação das Auditorias 25 e 26.

Objetivo geral: evoluir o Conversor Profissional de Partituras de um núcleo OCR/Fusion textual conservador até um fluxo profissional auditável com revisão humana, geometria, cifra técnica confiável, multipágina, robustez operacional e validação assistida.

## Estado confirmado antes deste roadmap

```txt
Auditoria 25 — validada
Auditoria 26 — validada
Frontend build: audit-26-cache-v1
pytest: 11 passed
```

## BLOCO A — OCR/Fusion textual

```txt
Auditoria 25 — Classificação avançada de text_blocks OCR
Auditoria 26 — Agrupamento OCR por linha visual
Auditoria 27 — Agrupamento OCR por região: instrumentos / pauta / letra / rodapé / editorial
Auditoria 28 — Normalização de sílabas e fragmentos OCR
Auditoria 29 — Detecção de possíveis cifras sem inferência harmônica
```

Observação de execução: neste repositório, as Auditorias 25 e 26 já foram executadas com escopo inicial ajustado:

```txt
Auditoria 25 — Classificação conservadora de text_blocks OCR — validada
Auditoria 26 — Exposição de classification_counts no frontend e relatórios — validada
```

O conteúdo listado acima permanece como macro-roadmap do Bloco A; a numeração operacional pode ser ajustada em registros futuros sem perder o objetivo técnico.

## BLOCO B — Geometria e layout musical

```txt
Auditoria 30 — Extrair/registrar geometria de página e sistema
Auditoria 31 — Mapear regiões OCR para sistemas musicais
Auditoria 32 — Mapear regiões OCR para compassos aproximados
Auditoria 33 — Calcular confiança de associação OCR→compasso
Auditoria 34 — Relatório visual de alinhamento OCR/MusicXML
```

## BLOCO C — Revisão humana profissional

```txt
Auditoria 35 — Painel de revisão de OCR por bloco
Auditoria 36 — Aprovar/rejeitar classificação OCR
Auditoria 37 — Revisão de associação texto→sistema
Auditoria 38 — Revisão de associação texto→compasso
Auditoria 39 — Histórico de decisões humanas no protocolo
```

## BLOCO D — Cifra técnica confiável

```txt
Auditoria 40 — Inserir letra aprovada na cifra técnica
Auditoria 41 — Inserir cifras candidatas aprovadas
Auditoria 42 — Separar cifra detectada, cifra aprovada e cifra tocável
Auditoria 43 — Marcar lacunas por compasso
Auditoria 44 — Gerar relatório de confiança musical
```

## BLOCO E — PDF e múltiplas páginas

```txt
Auditoria 45 — OCR de PDF por conversão página→imagem
Auditoria 46 — Cache OCR por hash de arquivo/página
Auditoria 47 — Processamento multipágina
Auditoria 48 — Associação página→sistema→compasso
Auditoria 49 — Exportação multipágina auditável
```

## BLOCO F — Qualidade, produto e robustez

```txt
Auditoria 50 — Tratamento de erros profissional no frontend
Auditoria 51 — Fila/estado de processamento
Auditoria 52 — Cancelamento seguro de processamento preso
Auditoria 53 — Logs técnicos exportáveis
Auditoria 54 — Modo diagnóstico completo
```

## BLOCO G — Validação musical assistida

```txt
Auditoria 55 — IA validadora estrutural sem alterar protocolo
Auditoria 56 — IA sugere correções, mas não aplica automaticamente
Auditoria 57 — Comparação entre OMR, OCR e revisão humana
Auditoria 58 — Score final de confiança por compasso
Auditoria 59 — Modo “pronto para cifra tocável”
```

## BLOCO H — Fechamento de consolidação profissional inicial

```txt
Auditoria 60 — Pacote de exportação final
Auditoria 61 — Manual de uso local
Auditoria 62 — Checklist de validação por louvor
Auditoria 63 — Validação profissional com repertório real inicial
Auditoria 64 — Correções finais do cpp-pro
```

## Marcos

### Marco 1 — Núcleo OCR/Fusion textual profissional

```txt
Auditorias 25–29
```

### Marco 2 — Núcleo geométrico MusicXML + OCR

```txt
Auditorias 30–34
```

### Marco 3 — Núcleo de revisão humana auditável

```txt
Auditorias 35–39
```

### Marco 4 — Núcleo de cifra técnica confiável

```txt
Auditorias 40–44
```

### Marco 5 — Núcleo PDF/multipágina/cache/custo

```txt
Auditorias 45–49
```

### Marco 6 — Núcleo operacional robusto

```txt
Auditorias 50–54
```

### Marco 7 — Núcleo de validação musical assistida

```txt
Auditorias 55–59
```

### Marco 8 — Consolidação profissional com repertório real

```txt
Auditorias 60–64
```

## Regra permanente de execução

Toda auditoria deve preservar os princípios de segurança do CPP:

```txt
Não inventar harmonia.
Não inventar letra.
Não alinhar por compasso sem geometria confiável.
Toda evidência incerta deve permanecer pendente para revisão humana.
```

## Critério de fechamento de cada auditoria

Cada auditoria deve terminar com:

```txt
1. implementação incremental;
2. testes automatizados quando aplicável;
3. validação local;
4. registro em docs/auditorias;
5. commit de validação;
6. indicação da próxima auditoria.
```
