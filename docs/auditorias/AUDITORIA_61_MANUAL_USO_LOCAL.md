# Auditoria 61 — Manual de uso local

## Status

```txt
Implementada como documentação operacional local.
```

## Validação local recebida antes da implementação

```txt
pytest
18 passed
```

## Arquivo criado

```txt
docs/MANUAL_USO_LOCAL_CPP_PRO.md
```

## Escopo

A Auditoria 61 criou um manual operacional local para uso do CPP_PRO em ambiente Windows/CMD.

O manual cobre:

```txt
- atualização do repositório;
- validação com pytest;
- backend local;
- frontend/PWA;
- limpeza de cache;
- processamento de partitura;
- interpretação de OMR/OCR;
- revisão humana;
- geometria manual;
- revisão de cifras/letras/lacunas;
- liberação para cifra tocável;
- pacote final auditável;
- diagnóstico rápido;
- comandos rápidos.
```

## Regras preservadas

A Auditoria 61 é documentação apenas.

```txt
modifies_protocol: false
modifies_frontend_runtime: false
modifies_backend_runtime: false
modifies_ocr_raw_text: false
infers_lyrics: false
infers_harmony: false
aligns_ocr_to_measure_without_geometry: false
marks_playable_ready_automatically: false
```

## Comando de validação recomendado

```cmd
cd C:\HomeCloud\shared\Projetos\cpp_pro
git pull origin main
pytest
```

Resultado esperado:

```txt
18 passed
```

## Commit de implementação

```txt
5b8a965 Add local usage manual for audit 61
```

## Conclusão

A Auditoria 61 está implementada.

O CPP agora possui manual local para uso operacional do app, preservando o fluxo auditável e as regras permanentes do projeto.

## Próxima etapa

```txt
Auditoria 62 — Checklist de validação por louvor
```

Objetivo:

```txt
Criar checklist objetivo para validar uma partitura/louvor real do início ao pacote final.
```
