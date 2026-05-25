========================================
  SKY HOPPER — Jogo 2D Espacial
========================================

Sky Hopper é um jogo 2D inspirado na mecânica do Flappy Bird,
com visual original e temática espacial. Desenvolvido com
HTML5 + CSS3 + JavaScript puro, sem dependências externas.

----------------------------------------
  COMO ABRIR O JOGO
----------------------------------------
1. Extraia a pasta flappy-original (ou sky-hopper) do arquivo ZIP.
2. Abra o arquivo index.html em qualquer navegador moderno:
   - Google Chrome, Firefox, Edge, Safari, Opera.
3. Clique em INICIAR e jogue!

OBS: Não é necessário servidor ou internet.
     Funciona 100% offline.

----------------------------------------
  COMO JOGAR
----------------------------------------
- Um foguete cai pela gravidade constantemente.
- Você deve mantê-lo voando pelos buracos entre
  os cristais (obstáculos) que aparecem da direita.
- A velocidade aumenta progressivamente.
- Passe pelos obstáculos para marcar pontos.
- O jogo termina ao colidir com um cristal ou o chão.

----------------------------------------
  CONTROLES
----------------------------------------
Computador:
  - Barra de Espaço     → Impulsionar
  - Seta para cima (↑)  → Impulsionar
  - Clique do mouse     → Impulsionar
  - P ou Esc            → Pausar/Retomar

Celular / Tablet:
  - Toque na tela       → Impulsionar

----------------------------------------
  FUNCIONALIDADES
----------------------------------------
- Tela inicial com melhor pontuação
- Jogo responsivo (celular e computador)
- Efeitos sonoros por Web Audio API
- Partículas ao marcar ponto e ao colidir
- Paralaxe de estrelas no fundo
- Dificuldade progressiva
- Botão de pausa
- Melhor pontuação salva no navegador (localStorage)
- Visual espacial original

----------------------------------------
  COMO COMPACTAR EM ZIP
----------------------------------------
Windows:
  1. Selecione todos os arquivos da pasta.
  2. Clique com o botão direito.
  3. "Compactar para arquivo ZIP".

macOS:
  1. Selecione a pasta sky-hopper.
  2. Clique com o botão direito → "Comprimir".

Linux:
  zip -r sky-hopper.zip sky-hopper/

----------------------------------------
  COMO TESTAR NO CELULAR
----------------------------------------
Opção 1 — Mesma rede Wi-Fi:
  1. Instale o "Live Server" no VS Code ou use:
     npx serve .
  2. Acesse pelo IP da sua máquina no celular.
     Exemplo: http://192.168.1.10:5000

Opção 2 — Arquivo local:
  Copie a pasta para o celular e abra index.html
  com um navegador de arquivos que suporte HTML local
  (ex: via aplicativo de gerenciador de arquivos → abrir com Chrome).

Opção 3 — Hospedagem gratuita:
  Suba os arquivos no GitHub Pages, Vercel ou Netlify
  e acesse o link gerado no celular.

----------------------------------------
  COMO ENVIAR PARA OUTRA PESSOA
----------------------------------------
1. Compacte em ZIP conforme instruções acima.
2. Envie o .zip por e-mail, WhatsApp, Google Drive,
   Dropbox ou qualquer outro meio.
3. A pessoa extrai e abre o index.html.

----------------------------------------
  ARQUIVOS DO PROJETO
----------------------------------------
index.html  → Estrutura HTML do jogo
style.css   → Estilos visuais e layout
script.js   → Lógica do jogo, física e desenho
README.txt  → Este arquivo

----------------------------------------
  TECNOLOGIA UTILIZADA
----------------------------------------
- HTML5 Canvas (renderização 2D)
- CSS3 (telas, responsividade, animações)
- JavaScript ES6+ puro (sem frameworks)
- Web Audio API (sons sem arquivos externos)
- localStorage (melhor pontuação persistente)

========================================
  Desenvolvido como projeto educacional
  Mecânica inspirada em Flappy Bird (2013)
  Visual e código 100% originais
========================================
