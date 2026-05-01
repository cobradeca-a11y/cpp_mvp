# CPP — Conversor Profissional de Partituras

O CPP é uma aplicação para converter partituras em PDF/imagem em cifra técnica e cifra tocável, usando uma arquitetura profissional baseada em OMR, MusicXML, revisão humana e exportação.

## Decisão arquitetural

O CPP não usa heurísticas visuais como motor principal de leitura.

O fluxo oficial é:

```txt
PDF / imagem
↓
OMR profissional
↓
MusicXML
↓
OCR profissional de texto/layout
↓
Motor de fusão estrutural
↓
cpp_protocol.json
↓
IA validadora
↓
Revisão humana
↓
Exportação
```

O protocolo oficial está em:

```txt
docs/CPP_PROTOCOL_PROFISSIONAL.md
```

## Estrutura atual

```txt
backend/
  main.py
  musicxml_parser.py
  requirements.txt
  README.md

src/
  app.js
  styles.css
  modules/
    cpp-json.js
    file-input.js
    professional-omr-client.js
    feedback-engine.js
    measure-review.js
    chord-sheet-technical.js
    chord-sheet-playable.js
    confidence-engine.js
    export-output.js

docs/
  CPP_PROTOCOL_PROFISSIONAL.md

index.html
manifest.json
service-worker.js
.env.example
docker-compose.yml
```

## Requisitos

Para o frontend:

- navegador moderno;
- GitHub Pages ou servidor estático local.

Para o backend profissional:

- Python 3.11+;
- Java 17+;
- Audiveris instalado/configurado;
- FastAPI/Uvicorn.

## Configuração

Crie um `.env` baseado em `.env.example`.

Variáveis principais:

```txt
AUDIVERIS_CMD=audiveris
CPP_BACKEND_HOST=0.0.0.0
CPP_BACKEND_PORT=8787
```

No Windows, `AUDIVERIS_CMD` pode apontar para o `.bat` do Audiveris.

Exemplo:

```txt
AUDIVERIS_CMD=C:\\Audiveris\\bin\\audiveris.bat
```

## Rodando backend localmente

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8787
```

No Windows PowerShell:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8787
```

## Verificando backend

Abra:

```txt
http://localhost:8787/health
```

A resposta deve indicar se o Audiveris está disponível.

## Rodando frontend

O frontend pode ser aberto pelo GitHub Pages ou servido localmente:

```bash
python -m http.server 8080
```

Depois acesse:

```txt
http://localhost:8080
```

No app, configure o backend como:

```txt
http://localhost:8787
```

## Fluxo de uso

1. Abra o CPP.
2. Verifique o backend.
3. Envie PDF/imagem/MusicXML.
4. Clique em `Processar com OMR Profissional`.
5. Revise os compassos importados.
6. Gere saídas.
7. Exporte JSON/TXT.

## Saídas

O CPP gera:

- `cpp_protocol.json`;
- cifra técnica;
- cifra tocável;
- relatório de incertezas;
- relatório de detecção.

## Estado do projeto

Estado atual:

```txt
Frontend profissional: iniciado
Backend OMR: iniciado
Parser MusicXML: iniciado
OCR profissional: pendente
Motor de fusão MusicXML + OCR: pendente
IA validadora: pendente
Testes com PDF real: pendente
```

## Próximas etapas

1. Integrar OCR profissional.
2. Criar motor de fusão MusicXML + OCR.
3. Adicionar IA validadora estruturada.
4. Criar testes com PDF real.
5. Refinar geração de cifra tocável.
