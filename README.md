# disnovic.github.io

Bio pessoal com perfil configurável, vídeo local em loop e controles de áudio.

## Vídeo de fundo

Coloque um vídeo MP4 ou WebM em `db/` e atualize `backgroundVideo` em `config.json`. Por exemplo:

```json
"backgroundVideo": "db/background.mp4"
```

O navegador inicia o vídeo sem som; o botão de volume ativa ou desativa o áudio após uma interação do visitante.

## Contador de visitas

O contador compartilhado é servido pelo backend Node.js e salvo em `data/views.json`. Para rodar o site e a API juntos, instale Node.js e execute na raiz:

```sh
node server.js
```

Abra `http://localhost:3000`. Para que o contador seja global na internet, publique a pasta em um host que execute Node.js e mantenha o diretório `data/` persistente. Hospedagem de arquivos estáticos, como GitHub Pages, não executa esse backend.
