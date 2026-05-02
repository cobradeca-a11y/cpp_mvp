# CPP Backend Profissional — OMR/MusicXML

Este backend transforma o CPP de um MVP apenas heurístico em uma arquitetura profissional baseada em motor OMR externo.

## Papel do backend

O frontend continua sendo a interface de revisão, correção e exportação. O backend passa a ser responsável por:

1. receber PDF/imagem;
2. executar pré-processamento quando necessário;
3. chamar um motor OMR profissional, preferencialmente Audiveris;
4. obter MusicXML/MXL;
5. converter MusicXML para `cpp_protocol.json`;
6. retornar ao frontend compassos, notas, tempos, armadura, fórmula de compasso e navegação quando disponíveis.

## Requisitos

- Python 3.11+
- Java 17+
- Audiveris instalado ou caminho configurado em `AUDIVERIS_CMD`

Exemplo:

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

## Endpoints

### `GET /health`

Verifica se o backend está ativo e se o comando do Audiveris foi encontrado.

### `POST /api/omr/analyze`

Recebe arquivo PDF/imagem e retorna um JSON CPP.

Campo multipart:

- `file`: PDF/JPG/PNG/WEBP

## Audiveris

Configure o comando via variável de ambiente:

```bash
export AUDIVERIS_CMD="audiveris"
```

Ou no Windows:

```powershell
$env:AUDIVERIS_CMD="C:\\caminho\\para\\audiveris.bat"
```

O backend executa o Audiveris em diretório temporário. Se Audiveris não estiver disponível, o retorno informa que o OMR profissional não foi executado e entrega um protocolo com `omr_status: unavailable`.

## Importante

Este backend não tenta reinventar OMR em JavaScript. O caminho profissional do CPP é:

```txt
PDF/imagem
↓
Audiveris / OMR
↓
MusicXML
↓
CPP JSON
↓
Frontend de revisão
↓
Cifra técnica/tocável
```
