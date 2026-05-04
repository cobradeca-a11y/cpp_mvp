# Auditoria 50 — Checklist de validação funcional do frontend

## Status

Pendente de validação manual dos botões no navegador.

## Contexto

Até a Auditoria 49, a validação automatizada local com `pytest` cobria principalmente o backend, contratos JSON, OCR/Fusion, geometria, associações, relatórios e exportações de dados.

A Auditoria 50 passou a alterar diretamente o comportamento de frontend:

```txt
botões
handlers do index.html
scripts do navegador
service worker/cache
exportação de logs
painel de erros operacionais
```

Esses comportamentos não são validados pelo `pytest` do backend.

## Correção de processo

A partir da Auditoria 50, qualquer alteração de frontend/PWA deve ser validada em duas camadas:

```txt
1. Backend/contrato: pytest
2. Frontend funcional: checklist de botões no navegador
```

A Auditoria 50 não deve ser registrada como validada apenas com `pytest`.

## Comando backend obrigatório

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro
 git pull origin main
cd backend
pytest
```

Resultado esperado atual:

```txt
18 passed
```

## Comando frontend obrigatório

```bat
cd C:\HomeCloud\shared\Projetos\cpp_pro
python -m http.server 8080
```

Abrir:

```txt
http://localhost:8080
```

Antes de validar, clicar em:

```txt
Limpar cache do app
```

Depois recarregar a página e conferir:

```txt
Frontend build: audit-50-cache-v1
```

## Checklist funcional mínimo — Auditoria 50

### 1. Verificar backend

Condição: backend ligado.

Ação:

```txt
Clicar em Verificar backend
```

Esperado:

```txt
backendStatus deixa de mostrar "Backend ainda não verificado."
backendStatus mostra JSON com ok=true
Toast: Backend verificado.
```

Condição: backend desligado.

Esperado:

```txt
backendStatus mostra Backend indisponível
Painel 3A registra erro operacional
```

### 2. Limpar cache do app

Ação:

```txt
Clicar em Limpar cache do app
```

Esperado:

```txt
Service worker/cache antigo removido
Página recarrega
Build audit-50-cache-v1 permanece visível
```

### 3. Selecionar arquivo aceito

Testar arquivos:

```txt
.musicxml
.mxl
.pdf
.png
```

Esperado:

```txt
fileInfo mostra nome do arquivo
fileInfo informa arquivo aceito
Título é preenchido pelo nome-base do arquivo
Compasso padrão permanece vazio antes do processamento/importação
```

### 4. Selecionar arquivo inválido

Esperado:

```txt
fileInfo informa tipo não aceito
Painel 3A deve registrar erro apenas se houver exceção operacional real
```

### 5. Processar com OMR Profissional

Com backend ligado:

```txt
Clicar em Processar com OMR Profissional
```

Esperado:

```txt
Botão muda para Processando...
Status do processamento é atualizado
Protocolo é salvo
Saídas são geradas
Botão volta para Processar com OMR Profissional
```

Com backend desligado:

```txt
Status mostra erro de processamento
Painel 3A registra erro operacional
Botão volta ao estado normal
```

### 6. Gerar saídas

Ação:

```txt
Clicar em Gerar saídas
```

Esperado:

```txt
Cifra técnica preenchida
Cifra tocável preenchida ou bloqueada conservadoramente
Relatório de incertezas preenchido
Relatório de detecção preenchido
```

### 7. Exportar JSON

Esperado:

```txt
Download de JSON do protocolo
Sem alteração do protocolo
```

### 8. Exportar cifra técnica

Esperado:

```txt
Download TXT da cifra técnica
Sem inventar letra
Sem inferir harmonia
```

### 9. Exportar cifra tocável

Esperado:

```txt
Download TXT da cifra tocável ou saída bloqueada/conservadora
Sem promover cifra detectada para tocável automaticamente
```

### 10. Exportar incertezas

Esperado:

```txt
Download TXT do relatório de incertezas
```

### 11. Exportar detecção

Esperado:

```txt
Download TXT do relatório de detecção
```

### 12. Exportar multipágina auditável

Esperado:

```txt
Download JSON cpp_multipage_audit_export
version audit-49
Inclui ocr.pages[]
Inclui text_blocks por página
Inclui page_system_measure_associations
```

### 13. Exportar log de erros

Esperado:

```txt
Download TXT do log de erros operacionais
Se não houver erros: texto informa que nenhum erro foi registrado
```

### 14. Limpar log visual

Esperado:

```txt
Painel 3A volta para Nenhum erro operacional registrado nesta sessão.
```

## Critério de fechamento da Auditoria 50

A Auditoria 50 só pode ser registrada como validada se ambos forem verdadeiros:

```txt
pytest: 18 passed
Checklist funcional frontend: aprovado manualmente
```

## Regra permanente adicionada

Para alterações de frontend/PWA:

```txt
Sempre atualizar build/cache quando necessário.
Sempre validar botões alterados ou adicionados.
Sempre registrar checklist funcional quando pytest não cobrir o comportamento.
```

## Conclusão

Este checklist corrige a lacuna identificada: o backend podia passar em todos os testes enquanto um botão do frontend permanecia quebrado. A partir da Auditoria 50, validação de frontend passa a ser obrigatória para fechamento de auditorias que mexem na interface.