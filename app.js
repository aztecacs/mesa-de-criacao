import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// Configuração do projeto Firebase (irmaos-dovakins)
const firebaseConfig = {
  apiKey: "AIzaSyBrjONccGOeQ28JP5fmLkd4yI7sSWEUAv4",
  authDomain: "irmaos-dovakins.firebaseapp.com",
  projectId: "irmaos-dovakins",
  storageBucket: "irmaos-dovakins.firebasestorage.app",
  messagingSenderId: "634987461665",
  appId: "1:634987461665:web:8df3befc7fa9205aadb760",
  measurementId: "G-2ZRS44E7NL"
};

// Hash SHA-256 da chave de acesso combinada (não armazena a senha em texto puro)
const EXPECTED_PIN_HASH = "a09d1c0617fd0ec735cea350467c3ff28c9a7c7acbd2bda57076cca0d1c96c5e";
const SESSION_KEY = "mesa_criacao_pin_hash_v1";
const CACHE_KEY = "mesa_criacao_cache_v1";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Fallback determinístico SHA-256 para ambientes sem crypto.subtle (ex: file://)
function sha256Fallback(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }
  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  let result = "";
  const words = [];
  const asciiBitLength = ascii.length * 8;
  const hash = [];
  const k = [];
  let primeCounter = 0;
  const isComposite = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (let i = 0; i < 313; i += candidate) isComposite[i] = candidate;
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }
  ascii += "\x80";
  while ((ascii.length % 64) - 56) ascii += "\x00";
  for (let i = 0; i < ascii.length; i++) {
    const j = ascii.charCodeAt(i);
    words[i >> 2] |= j << (((3 - i) % 4) * 8);
  }
  words[words.length] = (asciiBitLength / maxWord) | 0;
  words[words.length] = asciiBitLength;
  for (let j = 0; j < words.length; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash.slice(0);
    for (let i = 0; i < 64; i++) {
      const w15 = w[i - 15];
      const w2 = w[i - 2];
      const a = hash[0];
      const e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
      hash.unshift((temp1 + temp2) | 0);
      hash[4] = (hash[4] + temp1) | 0;
      hash.pop();
    }
    for (let i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
  }
  for (let i = 0; i < 8; i++) {
    for (let j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : "") + b.toString(16);
    }
  }
  return result;
}

async function hashPin(pin) {
  const normalized = pin.trim().toLowerCase();
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(normalized);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  return sha256Fallback(unescape(encodeURIComponent(normalized)));
}

function nowFormatted() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function uid(prefix = "item") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function createDefaultChecklist() {
  return [
    {
      id: "step-01",
      num: "01",
      shortTitle: "Universo",
      title: "Universo e referências",
      intro: "Antes das regras, imaginem o mundo que vocês querem explorar.",
      tip: "Escolham referências pelo que elas inspiram. Misturar universos é permitido; descrevam o que torna a combinação coerente.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "Qual é o universo do nosso jogo?",
          answer: "",
          chips: ["Cyberpunk", "Fantasia medieval", "Apocalipse zumbi", "Contemporâneo", "Ficção científica"],
          hint: "Use as sugestões ou escreva outra ideia. Vocês podem combinar opções."
        },
        {
          id: "q2",
          label: "Qual será o tom da experiência?",
          answer: "",
          chips: ["Sombrio", "Sério", "Divertido", "Acolhedor", "Misterioso"],
          hint: "Use as sugestões ou escreva outra ideia. Vocês podem combinar opções."
        },
        {
          id: "q3",
          label: "Quais duas referências nos inspiram e o que queremos aproveitar de cada uma?",
          answer: "",
          chips: [],
          hint: ""
        }
      ]
    },
    {
      id: "step-02",
      num: "02",
      shortTitle: "Propósito",
      title: "Propósito e dedicação",
      intro: "Definam por que estão criando este projeto e qual compromisso cabe na rotina de vocês.",
      tip: "Propósito e tamanho vêm antes de aprofundar mecânicas para evitar que o escopo cresça sem controle.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "Queremos aprender, testar uma mecânica, terminar um pequeno jogo ou criar algo para vender?",
          answer: "",
          chips: ["Aprender C# e Unity", "Testar uma mecânica", "Terminar um pequeno jogo", "Publicar/vender"],
          hint: "Alinhem o objetivo principal desta primeira versão."
        },
        {
          id: "q2",
          label: "Quem deve jogar: apenas nós, amigos convidados ou público em geral?",
          answer: "",
          chips: ["Apenas nós dois", "Amigos convidados", "Público em geral"],
          hint: ""
        },
        {
          id: "q3",
          label: "Quanto tempo por semana podemos dedicar e por quantos meses queremos trabalhar antes de revisar o plano?",
          answer: "",
          chips: ["2 a 4h por semana", "5 a 8h por semana", "Revisão em 1 mês", "Revisão em 3 meses"],
          hint: ""
        }
      ]
    },
    {
      id: "step-03",
      num: "03",
      shortTitle: "Experiência",
      title: "Experiência do jogador",
      intro: "Descrevam o que torna jogar este projeto interessante na prática.",
      tip: "Escolham uma experiência central para orientar as decisões. Outras ações entram como apoio.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "O que o jogador fará na maior parte do tempo?",
          answer: "",
          chips: ["Explorar ambientes", "Agir em furtividade", "Coordenar comandos com o cão", "Gerenciar recursos"],
          hint: ""
        },
        {
          id: "q2",
          label: "Qual será o foco: sobrevivência, combate tático, furtividade, exploração, puzzles ou outro?",
          answer: "",
          chips: ["Sobrevivência", "Combate tático", "Furtividade", "Exploração", "Puzzles"],
          hint: ""
        },
        {
          id: "q3",
          label: "Qual será a atividade principal e quais serão apenas complementares?",
          answer: "",
          chips: ["Furtividade + cão no centro", "Combate como último recurso", "Exploração como base"],
          hint: ""
        }
      ]
    },
    {
      id: "step-04",
      num: "04",
      shortTitle: "Formato",
      title: "Formato e controle",
      intro: "Combinem como o jogo será visto, controlado e executado.",
      tip: "A câmera e a perspectiva devem favorecer aquilo que o jogador precisa enxergar para tomar decisões.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "Será 2D, 2.5D ou 3D?",
          answer: "",
          chips: ["2D", "2.5D", "3D"],
          hint: ""
        },
        {
          id: "q2",
          label: "A câmera será lateral, de cima, isométrica, primeira ou terceira pessoa?",
          answer: "",
          chips: ["De cima (top-down)", "Isométrica", "Lateral", "Primeira pessoa", "Terceira pessoa"],
          hint: ""
        },
        {
          id: "q3",
          label: "O jogador controlará o quê? Será uma experiência solo ou multiplayer?",
          answer: "",
          chips: ["Soldado + comandos ao cão", "Solo (1 jogador)", "Cooperativo"],
          hint: ""
        },
        {
          id: "q4",
          label: "Em qual plataforma queremos que funcione primeiro?",
          answer: "",
          chips: ["PC (Windows)", "Navegador (WebGL)", "Celular"],
          hint: ""
        }
      ]
    },
    {
      id: "step-05",
      num: "05",
      shortTitle: "Tamanho",
      title: "Tamanho da primeira experiência",
      intro: "Delimitem o espaço e a duração da primeira entrega jogável.",
      tip: "Uma experiência curta e bem resolvida vale mais do que um mundo grande inacabado.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "Teremos uma arena, fases, missões, áreas conectadas ou um mundo aberto?",
          answer: "",
          chips: ["Mapa pequeno de teste", "Missões curtas", "Áreas conectadas", "Mundo aberto"],
          hint: ""
        },
        {
          id: "q2",
          label: "Nossa primeira entrega terá quanto conteúdo e aproximadamente quanto tempo de jogo?",
          answer: "",
          chips: ["5 a 10 minutos", "15 a 30 minutos", "1 área jogável"],
          hint: ""
        },
        {
          id: "q3",
          label: "Ela terá começo e fim ou será uma experiência de partidas repetidas?",
          answer: "",
          chips: ["Começo e fim", "Partidas repetidas", "Sandbox exploratório"],
          hint: ""
        }
      ]
    },
    {
      id: "step-06",
      num: "06",
      shortTitle: "Limites",
      title: "O que realmente precisa existir",
      intro: "Separem o essencial da primeira versão daquilo que ficará para depois.",
      tip: "Novas ideias vão para 'Ideias para depois'. Para entrar agora, avaliem o impacto no prazo.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "Quais são as três mecânicas mais importantes?",
          answer: "",
          chips: ["Movimento e mira", "Seguir e comandar cão", "Detecção de perigos/inimigos", "Furtividade"],
          hint: ""
        },
        {
          id: "q2",
          label: "Qual delas faz essa ideia valer a pena?",
          answer: "",
          chips: ["Sincronia soldado-cão", "Atmosfera e exploração"],
          hint: ""
        },
        {
          id: "q3",
          label: "Quais ideias legais deixaremos explicitamente para depois?",
          answer: "",
          chips: ["Sistema de lealdade/skills", "Múltiplas armas", "Campanha longa", "Rotinas complexas de NPCs"],
          hint: ""
        }
      ]
    },
    {
      id: "step-07",
      num: "07",
      shortTitle: "Primeiro teste",
      title: "Primeiro teste jogável",
      intro: "Definam o menor experimento prático para validar a ideia no Unity.",
      tip: "Usem formas provisórias no início. O objetivo é testar se a interação central funciona e diverte.",
      agreed: false,
      opinionGabriel: "",
      opinionJeferson: "",
      questions: [
        {
          id: "q1",
          label: "Qual é a menor situação jogável capaz de mostrar a experiência principal?",
          answer: "",
          chips: ["1 mapa pequeno + soldado + cão + 1 perigo + objetivo"],
          hint: ""
        },
        {
          id: "q2",
          label: "O que queremos descobrir com esse teste?",
          answer: "",
          chips: ["Se comandar o cão é intuitivo", "Se a furtividade é clara"],
          hint: ""
        },
        {
          id: "q3",
          label: "O que precisa acontecer para decidirmos continuar, ajustar ou simplificar?",
          answer: "",
          chips: ["Alguém jogar sem precisar de explicação", "Comandos responderem sem travar"],
          hint: ""
        }
      ]
    }
  ];
}

// Dados completos migrados fielmente da Mesa de Criação original
function createInitialData() {
  const dovakinsChecklist = createDefaultChecklist();
  dovakinsChecklist[0].questions[0].answer = "Favela / Pós – apocalíptico";
  dovakinsChecklist[0].questions[1].answer = "Tática, companion cachorro, construindo sua história, mundo aberto, eventos aleatórios, apocalíptico. Misterioso, suspense.";
  dovakinsChecklist[0].questions[2].answer = "Project Zomboid";

  return {
    version: "2.0",
    updatedAt: "17/11/2026, 21:45:00",
    projects: [
      {
        id: "dovakins-brasileiros",
        name: "Dovakins Brasileiros",
        description: "Uma ideia em construção. Abram o projeto para começar a definir a direção.",
        stage: "Em exploração",
        archived: false,
        tone: 0,
        duplaNotes: "Dupla: Gabriel e Jeferson.\nFerramentas: Unity, C#, VS Code e GitHub (repositório DovakinsBrasileiros).\nRegra de organização: exercícios de estudo ficam na pasta Laboratorio, fora de Assets, até serem validados para entrar no jogo.",
        checklist: dovakinsChecklist,
        references: [
          {
            id: "ref-pz",
            title: "Project Zomboid",
            type: "Jogo",
            tags: ["visual", "atmosfera", "exploração"],
            link: "",
            attention: "Referência citada para a aparência do jogo e para os estudos de uma favela pós-apocalíptica, com perspectiva isométrica e atmosfera sombria.",
            contribution: "Orientar a exploração visual da favela, a sensação de abandono e a leitura do ambiente. A inspiração não define automaticamente câmera final ou todas as mecânicas de sobrevivência.",
            excerpt: "",
            connections: ["idea-favela"],
            blocks: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:31:57"
          },
          {
            id: "ref-skyrim",
            title: "Skyrim",
            type: "Jogo",
            tags: ["NPCs", "mundo vivo"],
            link: "",
            attention: "Nas conversas, foi citado como inspiração para NPCs com casas, ocupações, relações e rotinas, tornando o mundo mais vivo.",
            contribution: "Explorar como habitantes e suas reações podem dar continuidade e personalidade ao mundo. A escala e os sistemas concretos permanecem em discussão.",
            excerpt: "",
            connections: ["idea-mundo-vivo"],
            blocks: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:32:24"
          },
          {
            id: "ref-mgsv",
            title: "Metal Gear Solid V — D-Dog",
            type: "Jogo",
            tags: ["cão", "tática", "furtividade"],
            link: "",
            attention: "Na proposta inicial, o cão foi lembrado por atacar e identificar inimigos no ambiente, apoiando a abordagem tática.",
            contribution: "Investigar uma parceria soldado–cão mais sincronizada, com comandos acessíveis e identificação de itens e armadilhas. A lealdade foi levantada como possibilidade própria do projeto.",
            excerpt: "",
            connections: ["idea-soldado-cao"],
            blocks: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:32:35"
          },
          {
            id: "ref-hotline",
            title: "Hotline Miami",
            type: "Jogo",
            tags: ["concepção inicial", "câmera", "visual"],
            link: "",
            attention: "Citado na ideia inicial como referência de jogo de tiro com câmera de cima e visual simples, com possibilidade de pixel art.",
            contribution: "Servir como ponto de partida visual para imaginar o jogo. A proposta própria enfatiza planejamento, furtividade e coordenação com o cão; não houve decisão de reproduzir o ritmo ou todos os sistemas dessa referência.",
            excerpt: "",
            connections: ["idea-soldado-cao"],
            blocks: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:32:44"
          }
        ],
        ideas: [
          {
            id: "idea-favela",
            title: "Favela pós-apocalíptica: identidade e atmosfera",
            tags: ["em exploração", "universo", "direção visual"],
            blocks: [
              {
                id: "b-fav-1",
                type: "text",
                content: "Síntese das conversas do projeto.\n\nA ambientação explorada é uma favela brasileira em um cenário pós-apocalíptico, com mistério e suspense. Nos estudos visuais, foram usadas vielas e estruturas de uma favela do Rio, preservando sua identidade e transformando a atmosfera.",
                url: "",
                checked: false
              }
            ],
            questions: "Qual aspecto da favela deve tornar o mundo reconhecível? Qual será a causa do colapso? Haverá zumbis ou outros perigos? Qual câmera favorece exploração e comando do cão?",
            connections: ["ref-pz"],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 19:23:13"
          },
          {
            id: "idea-soldado-cao",
            title: "Soldado e cão: parceria tática",
            tags: ["em exploração", "cão", "combate", "furtividade"],
            blocks: [
              {
                id: "b-cao-1",
                type: "text",
                content: "Síntese da proposta inicial discutida na pasta Programar um Jogo; ainda em exploração.\n\nO jogador controla um soldado acompanhado por um cão de combate. O diferencial imaginado é a sincronia entre os dois, com comandos fáceis de aprender e ações coordenadas.",
                url: "",
                checked: false
              }
            ],
            questions: "Quais comandos realmente tornam a dupla interessante? O que o cão percebe sozinho e o que depende de uma ordem? Como comunicar perigos de forma clara? A lealdade acrescenta escolhas ou apenas progressão?",
            connections: ["ref-mgsv", "ref-hotline"],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:31:10"
          },
          {
            id: "idea-mundo-vivo",
            title: "Mundo vivo, NPCs e histórias do jogador",
            tags: ["em exploração", "NPCs", "exploração"],
            blocks: [
              {
                id: "b-npc-1",
                type: "text",
                content: "Propostas recuperadas das conversas, sem compromisso de escopo.\n\nExplorar um mundo aberto em que o jogador constrói sua história, com eventos variados e aleatórios. Skyrim apareceu como referência para dar vida aos NPCs: casas, ocupações, relações e rotinas, com reações persistentes ao que acontece.",
                url: "",
                checked: false
              }
            ],
            questions: "Que acontecimentos podem dar vida ao mundo? Quais relações e rotinas têm impacto na experiência? Quanto de mundo aberto cabe no projeto? Que modificações geram escolhas interessantes?",
            connections: ["ref-skyrim"],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:31:37"
          },
          {
            id: "idea-lancamento",
            title: "Intenção de lançamento e alcance do projeto",
            tags: ["em exploração", "propósito", "publicação"],
            blocks: [
              {
                id: "b-lan-1",
                type: "text",
                content: "Registro da intenção inicial: desenvolver um jogo em dupla com auxílio de IA, com vontade de um dia publicá-lo na Steam. Foi citado informalmente um preço na faixa de R$ 20 e divulgação em grupos, WhatsApp, cartazes e adesivos.\n\nSão aspirações da conversa inicial, não preço, orçamento, prazo ou estratégia comercial aprovados. O propósito e o tamanho do projeto devem ser combinados antes de aprofundar todas as mecânicas.",
                url: "",
                checked: false
              }
            ],
            questions: "O primeiro resultado será uma demonstração de mecânicas ou um jogo para outras pessoas jogarem? Qual tempo a dupla pode dedicar? O que precisa existir para considerar a primeira versão concluída?",
            connections: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 19:23:13"
          }
        ]
      },
      {
        id: "apocalipse-z",
        name: "Apocalipse Z",
        description: "# Ideia de jogo — Apocalipse desde o início\n\nPodemos criar uma experiência de apocalipse desde o início.\n\nPor exemplo, na maior parte dos jogos, quando você começa a história, tudo já aconteceu, os zumbis já existem.\n\nA ideia seria criar uma experiência desde o momento em que anunciam um surto na televisão.\n\nA partir daí, começa uma contagem de dias. Durante esse período, o jogador precisa escolher o que vai fazer no mapa, quais lugares vai visitar e como vai se preparar.\n\nPor exemplo, o governo começa a dar orientações para a população: estocar comida, água e outros suprimentos. O jogador terá esse tempo de preparação.\n\nDepois de alguns dias, começa um toque de recolher. O exército sai às ruas e ordena que todos permaneçam dentro de suas casas.\n\nEnquanto isso, o jogador acompanha os ataques que estão acontecendo e recebe informações pela televisão.\n\nAté que, em determinado momento, a televisão para de funcionar. Todas as comunicações são interrompidas: internet, televisão e outros meios de comunicação.\n\nOs suprimentos começam a acabar, mas os toques de recolher não terminam.\n\nA atmosfera mudou completamente.\n\nAntes havia movimento nas ruas, carros circulando e pessoas caminhando. Agora está tudo parado, silencioso e fechado.\n\nVocê não sabe se seus vizinhos ainda estão dentro de casa, se fugiram ou se aconteceu alguma coisa com eles.\n\nSeus suprimentos continuam acabando.\n\nÉ nesse momento que começa uma nova experiência de sobrevivência: **o jogador precisa sair de casa pela primeira vez.**\n\nO que vai utilizar como ferramenta? O que vai utilizar como armadura? O que vai procurar suprimentos? Vai começar invadindo a casa dos vizinhos? Para onde vai?\n\nComo será a interação com aquilo que o governo, o exército e as autoridades determinaram? Quais serão os impactos das decisões e ações do jogador?\n\nE, a partir desse ponto zero, como a experiência de sobrevivência vai se desenvolver?\n\n**Conceito central:** viver a transformação gradual de uma sociedade funcional em um cenário de sobrevivência.",
        stage: "Ideia",
        archived: false,
        tone: 1,
        duplaNotes: "Conceito exploratório separado para avaliação da dupla.",
        checklist: createDefaultChecklist(),
        references: [],
        ideas: [
          {
            id: "apoc-01",
            title: "01 — O surto e os dias de preparação",
            tags: ["em exploração", "início do surto", "preparação"],
            blocks: [
              {
                id: "b-apoc-1",
                type: "text",
                content: "Síntese da proposta de Apocalipse Z, já descrita na apresentação deste projeto.\n\nConceito central: viver a transformação gradual de uma sociedade funcional em um cenário de sobrevivência a partir do anúncio inicial do surto na televisão e da contagem de dias para estocar comida, água e suprimentos.",
                url: "",
                checked: false
              }
            ],
            questions: "Como o jogador escolhe quais lugares visitar no mapa durante os dias de preparação? Como as orientações do governo influenciam as escolhas iniciais?",
            connections: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:33:11"
          },
          {
            id: "apoc-02",
            title: "02 — Toque de recolher e silêncio das comunicações",
            tags: ["em exploração", "atmosfera", "colapso"],
            blocks: [
              {
                id: "b-apoc-2",
                type: "text",
                content: "Síntese da proposta de Apocalipse Z.\n\nDepois de alguns dias, começa um toque de recolher. O exército ocupa as ruas e orienta as pessoas a permanecer em casa. A televisão continua transmitindo informações até o momento em que todas as comunicações são interrompidas e o silêncio toma conta da vizinhança.",
                url: "",
                checked: false
              }
            ],
            questions: "Como transmitir a passagem do tempo e a mudança de atmosfera dentro de casa? O que o jogador pode observar pelas janelas e pela TV antes do corte total?",
            connections: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:33:12"
          },
          {
            id: "apoc-03",
            title: "03 — A primeira saída de casa",
            tags: ["em exploração", "sobrevivência", "escolhas"],
            blocks: [
              {
                id: "b-apoc-3",
                type: "text",
                content: "Síntese da proposta de Apocalipse Z.\n\nQuando os suprimentos ficam escassos e a comunicação desaparece, o jogador precisa sair de casa pela primeira vez. A vizinhança conhecida agora é incerta, exigindo improvisar ferramentas, decidir se entra na casa dos vizinhos e lidar com as determinações das autoridades.",
                url: "",
                checked: false
              }
            ],
            questions: "O que o jogador pode improvisar dentro de casa antes de sair? Quais consequências surgem ao invadir casas vizinhas ou desobedecer ordens do exército?",
            connections: [],
            comments: [],
            favorite: false,
            status: "active",
            updatedAt: "13/11/2026, 02:33:30"
          }
        ]
      }
    ]
  };
}

// Estado da interface
const state = {
  unlocked: false,
  syncStatus: "connecting", // connecting | synced | saving | offline
  data: null,
  // Hub state
  hubTab: "active", // active | archived
  hubSearch: "",
  // Project state
  projectId: null,
  projectTab: "checklist", // checklist | references | ideas | archived | trash | search
  checklistView: "step", // step | later | summary | dupla
  stepIndex: 0,
  // Filters
  refSearch: "",
  refType: "all",
  refTag: "all",
  refFavOnly: false,
  ideaSearch: "",
  ideaTag: "all",
  ideaFavOnly: false,
  projectSearch: "",
  // Active editor
  editingRefId: null,
  editingIdeaId: null
};

let saveTimer = null;
let isSaving = false;
let unsubscribeSnapshot = null;

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(msg) {
  const root = document.getElementById("toast-root");
  if (!root) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 200);
  }, 2600);
}

function saveLocalCache() {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state.data));
  } catch (e) {
    console.warn("Cache local indisponível:", e);
  }
}

function loadLocalCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function scheduleSave(immediate = false) {
  if (!state.data) return;
  state.data.updatedAt = nowFormatted();
  saveLocalCache();
  state.syncStatus = "saving";
  updateSyncIndicator();

  clearTimeout(saveTimer);
  const runSave = async () => {
    isSaving = true;
    try {
      const mesaRef = doc(db, "mesas", EXPECTED_PIN_HASH);
      await setDoc(mesaRef, state.data);
      state.syncStatus = "synced";
    } catch (err) {
      console.error("Erro ao sincronizar com Firebase:", err);
      state.syncStatus = "offline";
    } finally {
      isSaving = false;
      updateSyncIndicator();
    }
  };

  if (immediate) {
    runSave();
  } else {
    saveTimer = setTimeout(runSave, 550);
  }
}

function updateSyncIndicator() {
  document.querySelectorAll("[data-sync-pill]").forEach((pill) => {
    pill.className = "sync-pill";
    let label = "Sincronizado na nuvem";
    if (state.syncStatus === "saving") {
      pill.classList.add("saving");
      label = "Salvando...";
    } else if (state.syncStatus === "connecting") {
      pill.classList.add("saving");
      label = "Conectando...";
    } else if (state.syncStatus === "offline") {
      pill.classList.add("offline");
      label = "Salvo localmente";
    }
    pill.innerHTML = `<span class="sync-dot"></span><span>${label}</span>`;
  });
}

async function initFirestoreSync() {
  const cached = loadLocalCache();
  if (cached && cached.projects) {
    state.data = cached;
  } else {
    state.data = createInitialData();
  }
  render();

  const mesaRef = doc(db, "mesas", EXPECTED_PIN_HASH);
  try {
    const snap = await getDoc(mesaRef);
    if (!snap.exists()) {
      await setDoc(mesaRef, state.data);
      state.syncStatus = "synced";
    } else {
      const remoteData = snap.data();
      if (remoteData && Array.isArray(remoteData.projects)) {
        state.data = remoteData;
        saveLocalCache();
      }
      state.syncStatus = "synced";
    }
    render();

    if (unsubscribeSnapshot) unsubscribeSnapshot();
    unsubscribeSnapshot = onSnapshot(
      mesaRef,
      (docSnap) => {
        if (isSaving || saveTimer !== null && state.syncStatus === "saving") return;
        if (docSnap.exists()) {
          const incoming = docSnap.data();
          if (incoming && Array.isArray(incoming.projects)) {
            const activeTag = document.activeElement?.tagName;
            const isTyping = activeTag === "INPUT" || activeTag === "TEXTAREA";
            state.data = incoming;
            saveLocalCache();
            state.syncStatus = "synced";
            if (!isTyping) {
              render();
            } else {
              updateSyncIndicator();
            }
          }
        }
      },
      (err) => {
        console.warn("Listener em tempo real pausado:", err);
        state.syncStatus = "offline";
        updateSyncIndicator();
      }
    );
  } catch (err) {
    console.error("Falha na conexão inicial com Firestore:", err);
    state.syncStatus = "offline";
    render();
  }
}

function lockMesa() {
  localStorage.removeItem(SESSION_KEY);
  if (unsubscribeSnapshot) {
    unsubscribeSnapshot();
    unsubscribeSnapshot = null;
  }
  state.unlocked = false;
  document.getElementById("app").hidden = true;
  document.getElementById("pin-gate").hidden = false;
  const input = document.getElementById("pin-input");
  if (input) {
    input.value = "";
    input.focus();
  }
}

function unlockMesa() {
  state.unlocked = true;
  document.getElementById("pin-gate").hidden = true;
  document.getElementById("app").hidden = false;
  initFirestoreSync();
}

function setupPinGate() {
  const savedHash = localStorage.getItem(SESSION_KEY);
  if (savedHash === EXPECTED_PIN_HASH) {
    unlockMesa();
  }

  const form = document.getElementById("pin-form");
  const input = document.getElementById("pin-input");
  const toggle = document.getElementById("pin-toggle");
  const errorEl = document.getElementById("pin-error");

  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
    input.focus();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const entered = input.value || "";
    const digest = await hashPin(entered);
    if (digest === EXPECTED_PIN_HASH) {
      errorEl.hidden = true;
      localStorage.setItem(SESSION_KEY, digest);
      unlockMesa();
    } else {
      errorEl.hidden = false;
      input.select();
    }
  });
}

// Helpers de dados
function getActiveProject() {
  return state.data?.projects.find((p) => p.id === state.projectId) || null;
}

function stageClass(stage) {
  if (stage === "Em exploração") return "stage-exploring";
  if (stage === "Protótipo") return "stage-prototype";
  if (stage === "Em desenvolvimento") return "stage-development";
  return "";
}

function renderBrandLogo() {
  return `
    <span class="logo" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="6" width="20" height="12" rx="4"></rect>
        <path d="M6 12h4"></path>
        <path d="M8 10v4"></path>
        <circle cx="15" cy="11" r="1"></circle>
        <circle cx="18" cy="13" r="1"></circle>
      </svg>
    </span>
  `;
}

function renderSyncPill() {
  let cls = "sync-pill";
  let label = "Sincronizado na nuvem";
  if (state.syncStatus === "saving") {
    cls += " saving";
    label = "Salvando...";
  } else if (state.syncStatus === "connecting") {
    cls += " saving";
    label = "Conectando...";
  } else if (state.syncStatus === "offline") {
    cls += " offline";
    label = "Salvo localmente";
  }
  return `<span class="${cls}" data-sync-pill><span class="sync-dot"></span><span>${label}</span></span>`;
}

// ==================== RENDERIZAÇÃO DO HUB ====================
function renderHub() {
  const projects = state.data.projects || [];
  const activeProjects = projects.filter((p) => !p.archived);
  const archivedProjects = projects.filter((p) => p.archived);
  const totalAgreed = activeProjects.reduce(
    (acc, p) => acc + (p.checklist || []).filter((s) => s.agreed).length,
    0
  );

  const list = (state.hubTab === "active" ? activeProjects : archivedProjects).filter((p) => {
    if (!state.hubSearch.trim()) return true;
    const q = state.hubSearch.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.description || "").toLowerCase().includes(q) ||
      (p.stage || "").toLowerCase().includes(q)
    );
  });

  return `
    <header class="hub-header">
      <a href="#projetos" class="brand" data-action="go-hub">
        ${renderBrandLogo()}
        <div>
          Mesa de criação
          <small>IDEIAS QUE GANHAM FORMA</small>
        </div>
      </a>
      <div class="hub-right">
        <span class="hub-shared">Um espaço compartilhado para criar juntos</span>
        ${renderSyncPill()}
        <button type="button" class="btn-lock" data-action="lock-mesa" title="Bloquear acesso com senha">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          Bloquear
        </button>
      </div>
    </header>

    <main class="hub-main">
      <div class="hub-hero">
        <div>
          <div class="eyebrow">NOSSA MESA, MUITAS POSSIBILIDADES</div>
          <h1>Nossos projetos<span class="title-dot">.</span></h1>
          <p class="intro">Cada ideia tem seu espaço. Escolham uma para explorar e construam a próxima etapa juntos.</p>
        </div>
        <button type="button" class="primary new-project" data-action="open-new-project">+ Novo projeto</button>
      </div>

      <div class="hub-stats">
        <div>
          <span class="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2"></polygon>
              <polyline points="2 17 12 22 22 17"></polyline>
              <polyline points="2 12 12 17 22 12"></polyline>
            </svg>
          </span>
          <strong>${activeProjects.length}</strong> ${activeProjects.length === 1 ? "projeto ativo" : "projetos ativos"}
        </div>
        <div>
          <span class="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </span>
          <strong>${totalAgreed}</strong> ${totalAgreed === 1 ? "etapa combinada" : "etapas combinadas"}
        </div>
        <div>
          <span class="stat-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="21 8 21 21 3 21 3 8"></polyline>
              <rect x="1" y="3" width="22" height="5"></rect>
              <line x1="10" y1="12" x2="14" y2="12"></line>
            </svg>
          </span>
          <strong>${archivedProjects.length}</strong> ${archivedProjects.length === 1 ? "arquivado" : "arquivados"}
        </div>
      </div>

      <div class="hub-controls">
        <div class="filter-tabs">
          <button type="button" class="${state.hubTab === "active" ? "selected" : ""}" data-action="hub-tab" data-tab="active">
            Ativos <span>${activeProjects.length}</span>
          </button>
          <button type="button" class="${state.hubTab === "archived" ? "selected" : ""}" data-action="hub-tab" data-tab="archived">
            Arquivados <span>${archivedProjects.length}</span>
          </button>
        </div>

        <label class="project-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="hub-search-input" placeholder="Buscar um projeto..." value="${esc(state.hubSearch)}" />
        </label>
      </div>

      ${
        list.length === 0
          ? `<div class="hub-empty">
              <p>Nenhum projeto encontrado nesta visualização.</p>
              <button type="button" class="outline" data-action="open-new-project">+ Criar novo projeto</button>
            </div>`
          : `<div class="project-grid">
              ${list.map((proj, idx) => renderProjectCard(proj, idx)).join("")}
            </div>`
      }

      <div class="hub-footer-bar">
        <div>
          <p class="hub-footnote">As respostas de cada projeto são independentes. Arquivar guarda a ideia para outro momento.</p>
          <p class="public-note">Mesa protegida por chave de acesso · Sincronizada em tempo real para Gabriel e Jeferson.</p>
        </div>
        <div class="backup-tools">
          <button type="button" class="outline" data-action="export-backup">Exportar backup (.json)</button>
          <button type="button" class="outline" data-action="trigger-import">Importar backup</button>
          <input type="file" id="import-file-input" accept=".json" hidden />
        </div>
      </div>
    </main>
  `;
}

function renderProjectCard(proj, idx) {
  const agreedCount = (proj.checklist || []).filter((s) => s.agreed).length;
  const totalSteps = (proj.checklist || []).length || 7;
  const pct = Math.round((agreedCount / totalSteps) * 100);
  const tone = proj.tone ?? idx % 4;
  const desc = proj.description || "Sem descrição curta ainda.";

  return `
    <article class="project-card tone-${tone}">
      <div class="card-top">
        <div class="project-symbol">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="6" width="20" height="12" rx="4"></rect>
            <path d="M6 12h4"></path>
            <path d="M8 10v4"></path>
            <circle cx="15" cy="11" r="1"></circle>
            <circle cx="18" cy="13" r="1"></circle>
          </svg>
        </div>
        <span class="project-stage ${stageClass(proj.stage)}">${esc(proj.stage || "Ideia")}</span>
      </div>

      <button type="button" class="project-title" data-action="open-project" data-id="${esc(proj.id)}">
        <h2>${esc(proj.name)}</h2>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="7" y1="17" x2="17" y2="7"></line>
          <polyline points="7 7 17 7 17 17"></polyline>
        </svg>
      </button>

      <div class="project-description">${esc(desc)}</div>

      <div>
        <div class="card-progress-label">
          <span>Checklist de definição</span>
          <strong>${agreedCount} / ${totalSteps}</strong>
        </div>
        <div class="progress"><span style="width: ${pct}%"></span></div>
      </div>

      <div class="card-actions">
        <button type="button" class="plain" data-action="edit-project" data-id="${esc(proj.id)}">Editar dados</button>
        <button type="button" class="plain" data-action="toggle-archive-project" data-id="${esc(proj.id)}">
          ${proj.archived ? "Reabrir projeto" : "Arquivar"}
        </button>
        <button type="button" class="card-open" data-action="open-project" data-id="${esc(proj.id)}">
          Abrir projeto ↗
        </button>
      </div>
    </article>
  `;
}

// ==================== RENDERIZAÇÃO DO PROJETO ====================
function renderProjectSpace(proj) {
  const activeRefs = (proj.references || []).filter((r) => r.status === "active");
  const activeIdeas = (proj.ideas || []).filter((i) => i.status === "active");
  const archivedCount =
    (proj.references || []).filter((r) => r.status === "archived").length +
    (proj.ideas || []).filter((i) => i.status === "archived").length;
  const trashCount =
    (proj.references || []).filter((r) => r.status === "trash").length +
    (proj.ideas || []).filter((i) => i.status === "trash").length;

  let bodyHtml = "";
  if (state.projectTab === "checklist") {
    bodyHtml = renderChecklistWorkspace(proj);
  } else if (state.projectTab === "references") {
    bodyHtml = renderReferencesTab(proj, activeRefs);
  } else if (state.projectTab === "ideas") {
    bodyHtml = renderIdeasTab(proj, activeIdeas);
  } else if (state.projectTab === "archived") {
    bodyHtml = renderArchivedTab(proj);
  } else if (state.projectTab === "trash") {
    bodyHtml = renderTrashTab(proj);
  } else if (state.projectTab === "search") {
    bodyHtml = renderSearchTab(proj);
  }

  return `
    <div class="project-space">
      <div class="space-bar">
        <button type="button" class="space-name" data-action="go-hub" title="Voltar para Nossos projetos">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
          </svg>
          <strong>${esc(proj.name)}</strong>
        </button>

        <div class="space-tabs">
          <button type="button" class="${state.projectTab === "checklist" ? "selected" : ""}" data-action="project-tab" data-tab="checklist">
            ✓ Checklist
          </button>
          <button type="button" class="${state.projectTab === "references" ? "selected" : ""}" data-action="project-tab" data-tab="references">
            ||| Referências (${activeRefs.length})
          </button>
          <button type="button" class="${state.projectTab === "ideas" ? "selected" : ""}" data-action="project-tab" data-tab="ideas">
            💡 Ideias (${activeIdeas.length})
          </button>
          <button type="button" class="${state.projectTab === "archived" ? "selected" : ""}" data-action="project-tab" data-tab="archived">
            Arquivados${archivedCount ? ` (${archivedCount})` : ""}
          </button>
          <button type="button" class="${state.projectTab === "trash" ? "selected" : ""}" data-action="project-tab" data-tab="trash">
            Lixeira${trashCount ? ` (${trashCount})` : ""}
          </button>
          <button type="button" class="${state.projectTab === "search" ? "selected" : ""}" data-action="project-tab" data-tab="search">
            🔍 Buscar no projeto
          </button>
        </div>

        <div class="space-right">
          ${renderSyncPill()}
          <button type="button" class="btn-lock" data-action="lock-mesa" title="Bloquear acesso">Bloquear</button>
        </div>
      </div>

      ${bodyHtml}
    </div>
  `;
}

// ==================== CHECKLIST & SIDEBAR ====================
function renderChecklistWorkspace(proj) {
  const steps = proj.checklist || [];
  const agreedCount = steps.filter((s) => s.agreed).length;
  const pct = Math.round((agreedCount / (steps.length || 7)) * 100);

  let mainContent = "";
  if (state.checklistView === "later") {
    mainContent = renderIdeasParaDepois(proj);
  } else if (state.checklistView === "summary") {
    mainContent = renderProjectSummary(proj);
  } else if (state.checklistView === "dupla") {
    mainContent = renderNossaDupla(proj);
  } else {
    const step = steps[state.stepIndex] || steps[0];
    mainContent = renderStepContent(proj, step, state.stepIndex, steps.length);
  }

  return `
    <aside class="sidebar">
      <a href="#projetos" class="brand" data-action="go-hub">
        ${renderBrandLogo()}
        <div>
          Mesa de criação
          <small>DO CONCEITO AO PRIMEIRO JOGO</small>
        </div>
      </a>

      <button type="button" class="back-projects" data-action="go-hub">← Nossos projetos</button>

      <div class="project-label">PROJETO ATUAL</div>
      <h3>${esc(proj.name)}</h3>
      <div class="progress"><span style="width: ${pct}%"></span></div>
      <div class="muted" style="margin-top: 8px;">${agreedCount} de ${steps.length} etapas combinadas</div>

      <nav>
        ${steps
          .map(
            (s, i) => `
          <button type="button"
            class="${state.checklistView === "step" && state.stepIndex === i ? "active" : ""} ${s.agreed ? "complete" : ""}"
            data-action="select-step" data-index="${i}">
            <span class="number">${s.agreed ? "✓" : esc(s.num)}</span>
            ${esc(s.shortTitle)}
          </button>
        `
          )
          .join("")}
      </nav>

      <div class="nav-bottom">
        <button type="button" data-action="edit-project" data-id="${esc(proj.id)}">✎ Editar dados do projeto</button>
        <button type="button" class="${state.checklistView === "later" ? "active" : ""}" data-action="checklist-subview" data-view="later">💡 Ideias para depois</button>
        <button type="button" class="${state.checklistView === "summary" ? "active" : ""}" data-action="checklist-subview" data-view="summary">▤ Resumo do projeto</button>
        <button type="button" class="${state.checklistView === "dupla" ? "active" : ""}" data-action="checklist-subview" data-view="dupla">👥 Nossa dupla</button>
      </div>

      <div class="aside-note">
        Uma ideia de cada vez.<br />
        <strong>Um jogo com a cara dos dois.</strong>
      </div>
    </aside>

    <div class="workspace">
      <main>
        ${mainContent}
      </main>
    </div>
  `;
}

function renderStepContent(proj, step, idx, total) {
  return `
    <div class="eyebrow">ETAPA ${esc(step.num)} <span>/ 0${total}</span></div>
    <div class="title-row">
      <h1>${esc(step.title)}</h1>
      <span class="badge ${step.agreed ? "is-agreed" : ""}">
        ${step.agreed ? "Combinado ✓" : "Em discussão"}
      </span>
    </div>
    <p class="intro">${esc(step.intro)}</p>

    <div class="tip">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18h6"></path>
        <path d="M10 22h4"></path>
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"></path>
      </svg>
      <p>${esc(step.tip)}</p>
    </div>

    <div class="section-head">
      <h2>Vamos decidir juntos</h2>
      <span>Respostas da dupla</span>
    </div>

    <div class="questions">
      ${step.questions
        .map(
          (q, qIdx) => `
        <div class="question">
          <div class="question-num">${qIdx + 1}</div>
          <div>
            <label class="field">
              <span>${esc(q.label)}</span>
              <textarea
                data-step-question="${qIdx}"
                placeholder="Escrevam aqui a direção combinada ou ideias em aberto..."
              >${esc(q.answer)}</textarea>
            </label>
            ${
              q.chips && q.chips.length > 0
                ? `<div class="chips">
                    ${q.chips
                      .map((chip) => {
                        const isSelected = (q.answer || "").toLowerCase().includes(chip.toLowerCase());
                        return `<button type="button" class="${isSelected ? "chip-selected" : ""}" data-action="toggle-chip" data-q="${qIdx}" data-chip="${esc(chip)}">+ ${esc(chip)}</button>`;
                      })
                      .join("")}
                  </div>`
                : ""
            }
            ${q.hint ? `<span class="muted">${esc(q.hint)}</span>` : ""}
          </div>
        </div>
      `
        )
        .join("")}
    </div>

    <details class="opinions" ${step.opinionGabriel || step.opinionJeferson ? "open" : ""}>
      <summary>
        👥 Antes do acordo, a ideia de cada um
        <span>Opcional</span>
      </summary>
      <div class="two-cols">
        <label class="field">
          <span>Visão do Gabriel</span>
          <textarea data-step-opinion="gabriel" placeholder="O que o Gabriel imagina para esta etapa...">${esc(step.opinionGabriel || "")}</textarea>
        </label>
        <label class="field">
          <span>Visão do Jeferson</span>
          <textarea data-step-opinion="jeferson" placeholder="O que o Jeferson imagina para esta etapa...">${esc(step.opinionJeferson || "")}</textarea>
        </label>
      </div>
    </details>

    <div class="agreement">
      <div>
        <h3>Chegamos a uma direção?</h3>
        <p>Marcar como combinado não impede mudanças depois.</p>
      </div>
      <button type="button" class="${step.agreed ? "agreed" : "outline"}" data-action="toggle-step-agreed">
        ${step.agreed ? "✓ Etapa combinada" : "✓ Marcar como combinado"}
      </button>
    </div>

    <footer>
      <button type="button" class="plain" ${idx === 0 ? "disabled" : ""} data-action="prev-step">
        ← Anterior
      </button>
      <span>${idx + 1} de ${total}</span>
      <button type="button" class="primary small" ${idx === total - 1 ? "disabled" : ""} data-action="next-step">
        Próxima etapa →
      </button>
    </footer>
  `;
}

function renderIdeasParaDepois(proj) {
  const laterIdeas = (proj.ideas || []).filter(
    (i) => i.status !== "trash" && (i.tags || []).some((t) => t.toLowerCase().includes("depois"))
  );
  return `
    <div class="eyebrow">CONTROLE DE ESCOPO</div>
    <div class="title-row">
      <h1>Ideias para depois<span class="title-dot">.</span></h1>
      <button type="button" class="primary small" data-action="new-later-idea">+ Guardar ideia para depois</button>
    </div>
    <p class="intro">Ideias legais que não entram na versão atual ficam registradas aqui para não inflar o primeiro protótipo.</p>

    ${
      laterIdeas.length === 0
        ? `<div class="hub-empty">
            <p>Nenhuma ideia marcada com a etiqueta <strong>para depois</strong> neste projeto ainda.</p>
            <button type="button" class="outline" data-action="new-later-idea">+ Registrar primeira ideia futura</button>
          </div>`
        : `<div class="content-grid">
            ${laterIdeas.map((idea) => renderIdeaCard(proj, idea, 0, 1, false)).join("")}
          </div>`
    }
  `;
}

function renderProjectSummary(proj) {
  const steps = proj.checklist || [];
  const activeRefs = (proj.references || []).filter((r) => r.status === "active");
  const activeIdeas = (proj.ideas || []).filter((i) => i.status === "active");

  return `
    <div class="eyebrow">VISÃO CONSOLIDADA</div>
    <div class="title-row">
      <h1>Resumo do projeto<span class="title-dot">.</span></h1>
      <button type="button" class="primary small" data-action="copy-summary">Copiar resumo</button>
    </div>
    <p class="intro">Fotografia atual das escolhas do checklist, ideias em exploração e referências de <strong>${esc(proj.name)}</strong>.</p>

    <div class="summary-card">
      <h2>${esc(proj.name)} (${esc(proj.stage)})</h2>
      <p>${esc(proj.description || "Sem descrição.")}</p>
      <p><strong>Referências ativas:</strong> ${activeRefs.length} · <strong>Ideias ativas:</strong> ${activeIdeas.length}</p>
    </div>

    ${steps
      .map(
        (s) => `
      <div class="summary-card">
        <div class="title-row">
          <h2>${esc(s.num)}. ${esc(s.title)}</h2>
          <span class="badge ${s.agreed ? "is-agreed" : ""}">${s.agreed ? "Combinado ✓" : "Em discussão"}</span>
        </div>
        ${s.questions
          .map(
            (q) => `
          <h4>${esc(q.label)}</h4>
          <p>${esc(q.answer || "Ainda em aberto.")}</p>
        `
          )
          .join("")}
      </div>
    `
      )
      .join("")}
  `;
}

function renderNossaDupla(proj) {
  return `
    <div class="eyebrow">ALINHAMENTO DE TRABALHO</div>
    <div class="title-row">
      <h1>Nossa dupla<span class="title-dot">.</span></h1>
    </div>
    <p class="intro">Combinados de divisão de tarefas, disponibilidade semanal, GitHub e organização entre Gabriel e Jeferson.</p>

    <div class="panel">
      <label class="field">
        <span>Combinados da dupla neste projeto</span>
        <textarea data-project-dupla rows="10" placeholder="Registrem aqui responsabilidades, horários, regras de commits e metas da semana...">${esc(proj.duplaNotes || "")}</textarea>
      </label>
    </div>
  `;
}

// ==================== ABA REFERÊNCIAS ====================
function renderReferencesTab(proj, activeRefs) {
  if (state.editingRefId) {
    const ref = (proj.references || []).find((r) => r.id === state.editingRefId);
    if (ref) return renderReferenceEditor(proj, ref);
    state.editingRefId = null;
  }

  const allTags = Array.from(new Set(activeRefs.flatMap((r) => r.tags || [])));
  const types = ["Jogo", "Filme", "Série", "Música", "Livro", "Imagem", "Vídeo", "Conceito", "Outro"];

  const filtered = activeRefs.filter((r) => {
    if (state.refFavOnly && !r.favorite) return false;
    if (state.refType !== "all" && r.type !== state.refType) return false;
    if (state.refTag !== "all" && !(r.tags || []).includes(state.refTag)) return false;
    if (state.refSearch.trim()) {
      const q = state.refSearch.toLowerCase();
      const hay = `${r.title} ${r.attention} ${r.contribution} ${r.excerpt} ${(r.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Referências<span class="title-dot">.</span></h1>
          <p>Obras que inspiram o projeto — e o que queremos aproveitar de cada uma.</p>
        </div>
        <button type="button" class="primary" data-action="new-reference">+ Nova referência</button>
      </div>

      <div class="content-filters">
        <label class="project-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="ref-search-input" placeholder="Buscar título, texto ou etiqueta..." value="${esc(state.refSearch)}" />
        </label>

        <select id="ref-type-filter">
          <option value="all" ${state.refType === "all" ? "selected" : ""}>Todos os tipos</option>
          ${types.map((t) => `<option value="${t}" ${state.refType === t ? "selected" : ""}>${t}</option>`).join("")}
        </select>

        <select id="ref-tag-filter">
          <option value="all" ${state.refTag === "all" ? "selected" : ""}>Todas as etiquetas</option>
          ${allTags.map((t) => `<option value="${esc(t)}" ${state.refTag === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
        </select>

        <button type="button" class="outline ${state.refFavOnly ? "is-favorite" : ""}" data-action="toggle-ref-fav-filter">
          ☆ Favoritos da dupla
        </button>
      </div>

      ${
        filtered.length === 0
          ? `<div class="hub-empty">
              <p>Nenhuma referência encontrada com os filtros atuais.</p>
              <button type="button" class="outline" data-action="new-reference">+ Adicionar referência</button>
            </div>`
          : `<div class="reference-catalog">
              ${filtered.map((ref, idx) => renderReferenceCard(proj, ref, idx, filtered.length)).join("")}
            </div>`
      }
    </main>
  `;
}

function renderReferenceCard(proj, ref, idx, total) {
  return `
    <article class="content-card reference-card">
      <div class="content-card-top">
        <span class="content-kind">📄 ${esc(ref.type || "Jogo")}</span>
        <button type="button" class="favorite-button ${ref.favorite ? "is-favorite" : ""}" data-action="toggle-ref-fav" data-id="${esc(ref.id)}" title="Favoritar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        <div class="order-actions">
          <button type="button" ${idx === 0 ? "disabled" : ""} data-action="move-ref" data-id="${esc(ref.id)}" data-dir="-1" title="Mover para cima">↑</button>
          <button type="button" ${idx === total - 1 ? "disabled" : ""} data-action="move-ref" data-id="${esc(ref.id)}" data-dir="1" title="Mover para baixo">↓</button>
        </div>
      </div>

      <button type="button" class="content-title" data-action="open-ref" data-id="${esc(ref.id)}">
        ${esc(ref.title)}
      </button>

      <div class="content-tags">
        ${(ref.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}
      </div>

      <div class="reference-contribution">
        <small>O QUE TRAZ PARA O PROJETO</small>
        <p>${esc(ref.contribution || ref.attention || "Clique em Abrir e editar para detalhar a contribuição desta obra.")}</p>
      </div>

      <div class="entry-date">Atualizado em ${esc(ref.updatedAt || nowFormatted())}</div>

      <div class="entry-actions">
        <button type="button" class="plain" data-action="open-ref" data-id="${esc(ref.id)}">Abrir e editar</button>
        <button type="button" class="plain" data-action="archive-ref" data-id="${esc(ref.id)}">Arquivar</button>
        <button type="button" class="plain trash-action" data-action="trash-ref" data-id="${esc(ref.id)}">Lixeira</button>
      </div>
    </article>
  `;
}

function renderReferenceEditor(proj, ref) {
  const types = ["Jogo", "Filme", "Série", "Música", "Livro", "Imagem", "Vídeo", "Conceito", "Outro"];
  const allOtherItems = [
    ...(proj.ideas || [])
      .filter((i) => i.status !== "trash")
      .map((i) => ({ id: i.id, label: `Ideia · ${i.title}`, kind: "idea" })),
    ...(proj.references || [])
      .filter((r) => r.status !== "trash" && r.id !== ref.id)
      .map((r) => ({ id: r.id, label: `Referência · ${r.title}`, kind: "ref" }))
  ];

  const linkedItems = (ref.connections || [])
    .map((cid) => allOtherItems.find((x) => x.id === cid))
    .filter(Boolean);

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Referências<span class="title-dot">.</span></h1>
          <p>Obras que inspiram o projeto — e o que queremos aproveitar de cada uma.</p>
        </div>
      </div>

      <div class="entry-editor">
        <div class="editor-top">
          <button type="button" class="plain" data-action="close-ref-editor">← Voltar à lista</button>
          <span>Salvo automaticamente</span>
          <button type="button" class="primary small" data-action="save-ref-now">💾 Salvar</button>
        </div>

        <label class="field">
          <span>Nome da obra ou referência</span>
          <input type="text" data-ref-field="title" value="${esc(ref.title)}" placeholder="Ex.: Project Zomboid, Skyrim, Blade Runner..." />
        </label>

        <label class="field tags-field">
          <span>Etiquetas <small>Opcional · separadas por vírgula · até 12</small></span>
          <input type="text" data-ref-tags value="${esc((ref.tags || []).join(", "))}" placeholder="visual, atmosfera, exploração" />
        </label>

        <div class="reference-fields">
          <div class="reference-section-title">A obra e sua contribuição</div>

          <label class="field">
            <span>Tipo de referência</span>
            <select data-ref-field="type">
              ${types.map((t) => `<option value="${t}" ${ref.type === t ? "selected" : ""}>${t}</option>`).join("")}
            </select>
          </label>

          <label class="field">
            <span>Link ou onde encontrar</span>
            <textarea data-ref-field="link" rows="2" placeholder="Cole um link ou indique onde encontrar a obra.">${esc(ref.link || "")}</textarea>
          </label>

          <label class="field">
            <span>O que chamou nossa atenção?</span>
            <textarea data-ref-field="attention" rows="3" placeholder="Atmosfera, mecânica, câmera, som, narrativa...">${esc(ref.attention || "")}</textarea>
          </label>

          <label class="field">
            <span>O que isso traz para nosso projeto?</span>
            <textarea data-ref-field="contribution" rows="3" placeholder="Explique como essa inspiração ajuda o nosso projeto sem copiar todo o escopo.">${esc(ref.contribution || "")}</textarea>
          </label>

          <label class="field">
            <span>Trecho específico</span>
            <textarea data-ref-field="excerpt" rows="2" placeholder="Cena, episódio, minuto da música, capítulo...">${esc(ref.excerpt || "")}</textarea>
          </label>
        </div>

        <div class="entry-relations">
          <h2>Conexões</h2>
          <p>Relacione esta referência com outras ideias e referências do projeto.</p>

          <details>
            <summary>Escolher conteúdos relacionados</summary>
            <div class="relation-picker">
              ${
                allOtherItems.length === 0
                  ? `<div style="padding: 12px; color: #8b93a2; font-size: 12px;">Nenhum outro item cadastrado ainda.</div>`
                  : allOtherItems
                      .map(
                        (item) => `
                    <label>
                      <input type="checkbox" data-ref-conn="${esc(item.id)}" ${(ref.connections || []).includes(item.id) ? "checked" : ""} />
                      <div>
                        <strong>${esc(item.label)}</strong>
                      </div>
                    </label>
                  `
                      )
                      .join("")
              }
            </div>
          </details>

          <div class="linked-entries">
            ${
              linkedItems.length === 0
                ? `<span class="muted">Nenhuma conexão ainda.</span>`
                : linkedItems
                    .map(
                      (item) => `
                  <button type="button" class="outline" data-action="jump-item" data-kind="${item.kind}" data-id="${esc(item.id)}">
                    ↗ ${esc(item.label)}
                  </button>
                `
                    )
                    .join("")
            }
          </div>
        </div>

        <div class="editor-context-label">
          Anotações complementares
          <small>O conteúdo das páginas anteriores permanece neste espaço.</small>
        </div>

        ${renderBlocksEditor(ref.blocks || [], "ref")}

        <div class="entry-comments">
          <h2>Conversa sobre a referência</h2>
          <p>Comentários ficam separados do conteúdo principal.</p>
          ${renderCommentsSection(ref.comments || [], "ref")}
        </div>
      </div>
    </main>
  `;
}

// ==================== ABA IDEIAS ====================
function renderIdeasTab(proj, activeIdeas) {
  if (state.editingIdeaId) {
    const idea = (proj.ideas || []).find((i) => i.id === state.editingIdeaId);
    if (idea) return renderIdeaEditor(proj, idea);
    state.editingIdeaId = null;
  }

  const allTags = Array.from(new Set(activeIdeas.flatMap((i) => i.tags || [])));

  const filtered = activeIdeas.filter((idea) => {
    if (state.ideaFavOnly && !idea.favorite) return false;
    if (state.ideaTag !== "all" && !(idea.tags || []).includes(state.ideaTag)) return false;
    if (state.ideaSearch.trim()) {
      const q = state.ideaSearch.toLowerCase();
      const blocksText = (idea.blocks || []).map((b) => b.content).join(" ");
      const hay = `${idea.title} ${blocksText} ${idea.questions} ${(idea.tags || []).join(" ")}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Ideias<span class="title-dot">.</span></h1>
          <p>Capture uma possibilidade, desenvolva os caminhos e conversem sobre ela.</p>
        </div>
        <button type="button" class="primary" data-action="new-idea">+ Nova ideia</button>
      </div>

      <div class="content-filters">
        <label class="project-search">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input type="text" id="idea-search-input" placeholder="Buscar título, texto ou etiqueta..." value="${esc(state.ideaSearch)}" />
        </label>

        <select id="idea-tag-filter">
          <option value="all" ${state.ideaTag === "all" ? "selected" : ""}>Todas as etiquetas</option>
          ${allTags.map((t) => `<option value="${esc(t)}" ${state.ideaTag === t ? "selected" : ""}>${esc(t)}</option>`).join("")}
        </select>

        <button type="button" class="outline ${state.ideaFavOnly ? "is-favorite" : ""}" data-action="toggle-idea-fav-filter">
          ☆ Favoritos da dupla
        </button>
      </div>

      ${
        filtered.length === 0
          ? `<div class="hub-empty">
              <p>Nenhuma ideia encontrada com os filtros atuais.</p>
              <button type="button" class="outline" data-action="new-idea">+ Criar nova ideia</button>
            </div>`
          : `<div class="content-grid idea-grid">
              ${filtered.map((idea, idx) => renderIdeaCard(proj, idea, idx, filtered.length, true)).join("")}
            </div>`
      }
    </main>
  `;
}

function renderIdeaCard(proj, idea, idx, total, allowReorder = true) {
  const fullText = (idea.blocks || []).map((b) => b.content).filter(Boolean).join("\n\n");
  const excerpt = fullText.length > 210 ? fullText.slice(0, 210) + "..." : fullText;

  return `
    <article class="content-card">
      <div class="content-card-top">
        <span class="content-kind">💡 Ideia</span>
        <button type="button" class="favorite-button ${idea.favorite ? "is-favorite" : ""}" data-action="toggle-idea-fav" data-id="${esc(idea.id)}" title="Favoritar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </button>
        ${
          allowReorder
            ? `<div class="order-actions">
                <button type="button" ${idx === 0 ? "disabled" : ""} data-action="move-idea" data-id="${esc(idea.id)}" data-dir="-1" title="Mover para cima">↑</button>
                <button type="button" ${idx === total - 1 ? "disabled" : ""} data-action="move-idea" data-id="${esc(idea.id)}" data-dir="1" title="Mover para baixo">↓</button>
              </div>`
            : ""
        }
      </div>

      <button type="button" class="content-title" data-action="open-idea" data-id="${esc(idea.id)}">
        ${esc(idea.title)}
      </button>

      <p class="content-excerpt">${esc(excerpt || "Clique em Abrir e editar para desenvolver esta ideia.")}</p>

      <div class="content-tags">
        ${(idea.tags || []).map((t) => `<span>${esc(t)}</span>`).join("")}
      </div>

      <div class="entry-date">Atualizado em ${esc(idea.updatedAt || nowFormatted())}</div>

      <div class="entry-actions">
        <button type="button" class="plain" data-action="open-idea" data-id="${esc(idea.id)}">Abrir e editar</button>
        <button type="button" class="plain" data-action="archive-idea" data-id="${esc(idea.id)}">Arquivar</button>
        <button type="button" class="plain trash-action" data-action="trash-idea" data-id="${esc(idea.id)}">Lixeira</button>
      </div>
    </article>
  `;
}

function renderIdeaEditor(proj, idea) {
  const allOtherItems = [
    ...(proj.references || [])
      .filter((r) => r.status !== "trash")
      .map((r) => ({ id: r.id, label: `Referência · ${r.title}`, kind: "ref" })),
    ...(proj.ideas || [])
      .filter((i) => i.status !== "trash" && i.id !== idea.id)
      .map((i) => ({ id: i.id, label: `Ideia · ${i.title}`, kind: "idea" }))
  ];

  const linkedItems = (idea.connections || [])
    .map((cid) => allOtherItems.find((x) => x.id === cid))
    .filter(Boolean);

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Ideias<span class="title-dot">.</span></h1>
          <p>Capture uma possibilidade, desenvolva os caminhos e conversem sobre ela.</p>
        </div>
        <button type="button" class="primary" data-action="new-idea">+ Nova ideia</button>
      </div>

      <div class="entry-editor">
        <div class="editor-top">
          <button type="button" class="plain" data-action="close-idea-editor">← Voltar à lista</button>
          <span>Salvo automaticamente</span>
          <button type="button" class="primary small" data-action="save-idea-now">💾 Salvar</button>
        </div>

        <label class="field">
          <span>Título da ideia</span>
          <input type="text" data-idea-field="title" value="${esc(idea.title)}" placeholder="Dê um título claro para a possibilidade..." />
        </label>

        <label class="field tags-field">
          <span>Etiquetas <small>Opcional · separadas por vírgula · até 12</small></span>
          <input type="text" data-idea-tags value="${esc((idea.tags || []).join(", "))}" placeholder="em exploração, universo, combate, para depois" />
        </label>

        <div class="editor-context-label">
          Desenvolvimento livre da ideia
          <small>Comece com uma frase. Títulos, listas e outros recursos continuam disponíveis.</small>
        </div>

        <div class="idea-section-tools">
          <span>Se ajudar a pensar:</span>
          <button type="button" class="outline" data-action="insert-idea-template" data-tpl="Alternativas">+ Alternativas</button>
          <button type="button" class="outline" data-action="insert-idea-template" data-tpl="Exemplos">+ Exemplos</button>
          <button type="button" class="outline" data-action="insert-idea-template" data-tpl="Perguntas">+ Perguntas</button>
        </div>

        ${renderBlocksEditor(idea.blocks || [], "idea")}

        <div class="idea-questions">
          <h2>Dúvidas e pontos a explorar</h2>
          <p>Guarde perguntas e caminhos possíveis, sem precisar criar tarefas.</p>
          <label class="field">
            <span>O que queremos investigar?</span>
            <textarea data-idea-field="questions" rows="3" placeholder="Quais dúvidas precisamos responder antes de fechar esta mecânica ou conceito?">${esc(idea.questions || "")}</textarea>
          </label>
        </div>

        <div class="entry-relations">
          <h2>Conexões</h2>
          <p>Relacione esta ideia com outras ideias e referências do projeto.</p>

          <details>
            <summary>Escolher conteúdos relacionados</summary>
            <div class="relation-picker">
              ${
                allOtherItems.length === 0
                  ? `<div style="padding: 12px; color: #8b93a2; font-size: 12px;">Nenhum outro item cadastrado ainda.</div>`
                  : allOtherItems
                      .map(
                        (item) => `
                    <label>
                      <input type="checkbox" data-idea-conn="${esc(item.id)}" ${(idea.connections || []).includes(item.id) ? "checked" : ""} />
                      <div>
                        <strong>${esc(item.label)}</strong>
                      </div>
                    </label>
                  `
                      )
                      .join("")
              }
            </div>
          </details>

          <div class="linked-entries">
            ${
              linkedItems.length === 0
                ? `<span class="muted">Nenhuma conexão ainda.</span>`
                : linkedItems
                    .map(
                      (item) => `
                  <button type="button" class="outline" data-action="jump-item" data-kind="${item.kind}" data-id="${esc(item.id)}">
                    ↗ ${esc(item.label)}
                  </button>
                `
                    )
                    .join("")
            }
          </div>
        </div>

        <div class="entry-comments">
          <h2>Conversa sobre a ideia</h2>
          <p>Comentários ficam separados do conteúdo principal.</p>
          ${renderCommentsSection(idea.comments || [], "idea")}
        </div>
      </div>
    </main>
  `;
}

// ==================== COMPONENTES DO EDITOR (BLOCOS E COMENTÁRIOS) ====================
function renderBlocksEditor(blocks, ownerKind) {
  return `
    <div class="block-list">
      ${blocks
        .map(
          (b, idx) => `
        <div class="editor-block ${b.type === "heading" ? "block-heading" : ""}">
          <div class="block-toolbar">
            <label>
              Tipo
              <select data-block-type="${idx}" data-owner="${ownerKind}">
                <option value="text" ${b.type === "text" ? "selected" : ""}>Texto</option>
                <option value="heading" ${b.type === "heading" ? "selected" : ""}>Título</option>
                <option value="list" ${b.type === "list" ? "selected" : ""}>Lista</option>
                <option value="checkbox" ${b.type === "checkbox" ? "selected" : ""}>Checkbox</option>
                <option value="link" ${b.type === "link" ? "selected" : ""}>Link</option>
              </select>
            </label>
            <div>
              <button type="button" ${idx === 0 ? "disabled" : ""} data-action="move-block" data-owner="${ownerKind}" data-idx="${idx}" data-dir="-1" title="Subir bloco">↑</button>
              <button type="button" ${idx === blocks.length - 1 ? "disabled" : ""} data-action="move-block" data-owner="${ownerKind}" data-idx="${idx}" data-dir="1" title="Descer bloco">↓</button>
              <button type="button" data-action="remove-block" data-owner="${ownerKind}" data-idx="${idx}" title="Remover bloco">×</button>
            </div>
          </div>

          ${
            b.type === "checkbox"
              ? `<div class="block-input">
                  <input type="checkbox" data-block-checked="${idx}" data-owner="${ownerKind}" ${b.checked ? "checked" : ""} />
                  <textarea data-block-content="${idx}" data-owner="${ownerKind}" placeholder="Item verificável...">${esc(b.content)}</textarea>
                </div>`
              : `<textarea data-block-content="${idx}" data-owner="${ownerKind}" placeholder="${
                  b.type === "heading"
                    ? "Título da seção..."
                    : b.type === "list"
                    ? "Um item por linha..."
                    : b.type === "link"
                    ? "Texto do link..."
                    : "Escreva aqui..."
                }">${esc(b.content)}</textarea>`
          }

          ${
            b.type === "link"
              ? `<input type="url" data-block-url="${idx}" data-owner="${ownerKind}" value="${esc(b.url || "")}" placeholder="https://..." />`
              : ""
          }
        </div>
      `
        )
        .join("")}
    </div>

    <div class="add-blocks">
      <span>Adicionar:</span>
      <button type="button" class="outline" data-action="add-block" data-owner="${ownerKind}" data-type="text">+ Texto</button>
      <button type="button" class="outline" data-action="add-block" data-owner="${ownerKind}" data-type="heading">+ Título</button>
      <button type="button" class="outline" data-action="add-block" data-owner="${ownerKind}" data-type="list">+ Lista</button>
      <button type="button" class="outline" data-action="add-block" data-owner="${ownerKind}" data-type="checkbox">+ Checkbox</button>
      <button type="button" class="outline" data-action="add-block" data-owner="${ownerKind}" data-type="link">+ Link</button>
    </div>

    <details class="preview-blocks">
      <summary>Prévia do conteúdo</summary>
      <div class="rendered-blocks">
        ${blocks
          .map((b) => {
            if (!b.content && !b.url) return "";
            if (b.type === "heading") return `<h2>${esc(b.content)}</h2>`;
            if (b.type === "list") {
              const items = b.content.split("\n").filter(Boolean);
              return `<ul>${items.map((it) => `<li>${esc(it)}</li>`).join("")}</ul>`;
            }
            if (b.type === "checkbox") {
              return `<p class="${b.checked ? "checked-line" : ""}">${b.checked ? "☑" : "☐"} ${esc(b.content)}</p>`;
            }
            if (b.type === "link") {
              return `<p><a href="${esc(b.url || "#")}" target="_blank" rel="noopener noreferrer">↗ ${esc(b.content || b.url)}</a></p>`;
            }
            return `<p>${esc(b.content)}</p>`;
          })
          .join("")}
      </div>
    </details>
  `;
}

function renderCommentsSection(comments, ownerKind) {
  return `
    ${
      comments.length === 0
        ? `<p class="muted">Ainda não há comentários.</p>`
        : comments
            .map(
              (c) => `
          <div class="comment">
            <strong>${esc(c.author || "Dupla")}</strong>
            <time>${esc(c.createdAt)}</time>
            <p>${esc(c.text)}</p>
          </div>
        `
            )
            .join("")
    }

    <form class="comment-form" data-comment-form="${ownerKind}">
      <label class="field">
        <span>Seu nome <small>Gabriel ou Jeferson</small></span>
        <input type="text" name="author" placeholder="Como quer se identificar?" required />
      </label>
      <label class="field">
        <span>Comentário</span>
        <textarea name="text" rows="2" placeholder="Compartilhe uma observação ou pergunta..." required></textarea>
      </label>
      <button type="submit" class="primary small">Adicionar comentário</button>
    </form>
  `;
}

// ==================== ABAS SECUNDÁRIAS (ARQUIVADOS, LIXEIRA, BUSCA) ====================
function renderArchivedTab(proj) {
  const archivedRefs = (proj.references || []).filter((r) => r.status === "archived");
  const archivedIdeas = (proj.ideas || []).filter((i) => i.status === "archived");
  const total = archivedRefs.length + archivedIdeas.length;

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Arquivados<span class="title-dot">.</span></h1>
          <p>Conteúdos guardados para consultar ou reabrir depois.</p>
        </div>
      </div>

      ${
        total === 0
          ? `<div class="hub-empty">
              <p><strong>Nenhum conteúdo arquivado</strong></p>
              <p>Os conteúdos aparecerão aqui quando forem movidos.</p>
            </div>`
          : `<div class="content-grid">
              ${archivedIdeas
                .map(
                  (i) => `
                <article class="content-card">
                  <div class="content-card-top"><span class="content-kind">💡 Ideia arquivada</span></div>
                  <div class="content-title">${esc(i.title)}</div>
                  <div class="entry-actions">
                    <button type="button" class="plain" data-action="restore-idea" data-id="${esc(i.id)}">Reabrir</button>
                    <button type="button" class="plain trash-action" data-action="trash-idea" data-id="${esc(i.id)}">Lixeira</button>
                  </div>
                </article>
              `
                )
                .join("")}
              ${archivedRefs
                .map(
                  (r) => `
                <article class="content-card">
                  <div class="content-card-top"><span class="content-kind">📄 Referência arquivada (${esc(r.type)})</span></div>
                  <div class="content-title">${esc(r.title)}</div>
                  <div class="entry-actions">
                    <button type="button" class="plain" data-action="restore-ref" data-id="${esc(r.id)}">Reabrir</button>
                    <button type="button" class="plain trash-action" data-action="trash-ref" data-id="${esc(r.id)}">Lixeira</button>
                  </div>
                </article>
              `
                )
                .join("")}
            </div>`
      }
    </main>
  `;
}

function renderTrashTab(proj) {
  const trashRefs = (proj.references || []).filter((r) => r.status === "trash");
  const trashIdeas = (proj.ideas || []).filter((i) => i.status === "trash");
  const total = trashRefs.length + trashIdeas.length;

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Lixeira<span class="title-dot">.</span></h1>
          <p>O conteúdo removido fica guardado aqui, sem exclusão automática.</p>
        </div>
      </div>

      ${
        total === 0
          ? `<div class="hub-empty">
              <p><strong>A lixeira está vazia</strong></p>
              <p>Os conteúdos aparecerão aqui quando forem movidos.</p>
            </div>`
          : `<div class="content-grid">
              ${trashIdeas
                .map(
                  (i) => `
                <article class="content-card">
                  <div class="content-card-top"><span class="content-kind">💡 Ideia na lixeira</span></div>
                  <div class="content-title">${esc(i.title)}</div>
                  <div class="entry-actions">
                    <button type="button" class="plain" data-action="restore-idea" data-id="${esc(i.id)}">Restaurar</button>
                    <button type="button" class="plain trash-action" data-action="delete-idea-forever" data-id="${esc(i.id)}">Excluir definitivamente</button>
                  </div>
                </article>
              `
                )
                .join("")}
              ${trashRefs
                .map(
                  (r) => `
                <article class="content-card">
                  <div class="content-card-top"><span class="content-kind">📄 Referência na lixeira</span></div>
                  <div class="content-title">${esc(r.title)}</div>
                  <div class="entry-actions">
                    <button type="button" class="plain" data-action="restore-ref" data-id="${esc(r.id)}">Restaurar</button>
                    <button type="button" class="plain trash-action" data-action="delete-ref-forever" data-id="${esc(r.id)}">Excluir definitivamente</button>
                  </div>
                </article>
              `
                )
                .join("")}
            </div>`
      }
    </main>
  `;
}

function renderSearchTab(proj) {
  const q = state.projectSearch.trim().toLowerCase();
  const results = [];

  if (q) {
    (proj.checklist || []).forEach((step, idx) => {
      step.questions.forEach((qu) => {
        if (`${step.title} ${qu.label} ${qu.answer}`.toLowerCase().includes(q)) {
          results.push({
            kind: "step",
            stepIndex: idx,
            badge: `Checklist · Etapa ${step.num}`,
            title: `${step.title} — ${qu.label}`,
            snippet: qu.answer || "(Sem resposta preenchida)"
          });
        }
      });
    });

    (proj.ideas || [])
      .filter((i) => i.status !== "trash")
      .forEach((idea) => {
        const text = (idea.blocks || []).map((b) => b.content).join(" ");
        if (`${idea.title} ${text} ${idea.questions} ${(idea.tags || []).join(" ")}`.toLowerCase().includes(q)) {
          results.push({
            kind: "idea",
            id: idea.id,
            badge: idea.status === "archived" ? "Ideia (Arquivada)" : "Ideia",
            title: idea.title,
            snippet: text || idea.questions
          });
        }
      });

    (proj.references || [])
      .filter((r) => r.status !== "trash")
      .forEach((ref) => {
        if (`${ref.title} ${ref.attention} ${ref.contribution} ${(ref.tags || []).join(" ")}`.toLowerCase().includes(q)) {
          results.push({
            kind: "ref",
            id: ref.id,
            badge: ref.status === "archived" ? `Referência (${ref.type} · Arquivada)` : `Referência · ${ref.type}`,
            title: ref.title,
            snippet: ref.contribution || ref.attention
          });
        }
      });
  }

  return `
    <main class="content-main">
      <div class="content-heading">
        <div>
          <div class="eyebrow">ESPAÇO LIVRE DO PROJETO</div>
          <h1>Buscar no projeto<span class="title-dot">.</span></h1>
          <p>Encontre referências, ideias e respostas do checklist.</p>
        </div>
      </div>

      <label class="project-search content-search">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input type="text" id="project-search-input" placeholder="Busque por uma palavra, título ou etiqueta..." value="${esc(state.projectSearch)}" />
      </label>

      ${
        !q
          ? `<div class="hub-empty">
              <p><strong>O que você quer encontrar?</strong></p>
              <p>A busca inclui conteúdos ativos e arquivados. A lixeira fica separada.</p>
            </div>`
          : results.length === 0
          ? `<div class="hub-empty">
              <p>Nenhum resultado encontrado para "${esc(state.projectSearch)}".</p>
            </div>`
          : results
              .map(
                (res) => `
              <div class="search-checklist" data-action="open-search-result" data-kind="${res.kind}" data-id="${esc(res.id || "")}" data-step="${res.stepIndex ?? 0}">
                <div class="eyebrow" style="margin-bottom: 6px;">${esc(res.badge)}</div>
                <h2>${esc(res.title)}</h2>
                <p>${esc((res.snippet || "").slice(0, 260))}</p>
              </div>
            `
              )
              .join("")
      }
    </main>
  `;
}

// ==================== MODAIS ====================
function openProjectModal(existingProj = null) {
  const modalRoot = document.getElementById("modal-root");
  const stages = ["Ideia", "Em exploração", "Protótipo", "Em desenvolvimento"];
  modalRoot.innerHTML = `
    <div class="modal-backdrop" data-action="close-modal">
      <div class="project-modal" onclick="event.stopPropagation()">
        <button type="button" class="modal-close" data-action="close-modal" aria-label="Fechar">✕</button>
        <div class="eyebrow">${existingProj ? "CONFIGURAÇÕES DO PROJETO" : "ESPAÇO PARA UMA NOVA IDEIA"}</div>
        <h2>${existingProj ? "Editar dados do projeto" : "Novo projeto"}</h2>
        <p class="muted">${existingProj ? "Atualize o nome, descrição ou momento atual deste espaço." : "Um nome provisório e uma ideia já são suficientes."}</p>

        <form id="project-modal-form">
          <label class="field">
            <span>Nome do projeto</span>
            <input type="text" name="name" value="${esc(existingProj ? existingProj.name : "")}" placeholder="Como vamos chamar essa ideia?" required autofocus />
          </label>

          <label class="field">
            <span>Descrição curta <small>Opcional</small></span>
            <textarea name="description" rows="4" placeholder="O que queremos experimentar ou criar?">${esc(existingProj ? existingProj.description : "")}</textarea>
          </label>

          <label class="field">
            <span>Momento do projeto</span>
            <select name="stage">
              ${stages
                .map(
                  (st) =>
                    `<option value="${st}" ${(existingProj ? existingProj.stage : "Ideia") === st ? "selected" : ""}>${st}</option>`
                )
                .join("")}
            </select>
          </label>

          <div class="modal-actions">
            <button type="button" class="plain" data-action="close-modal">Cancelar</button>
            <button type="submit" class="primary">${existingProj ? "Salvar alterações" : "Criar projeto"}</button>
          </div>
        </form>
      </div>
    </div>
  `;

  document.getElementById("project-modal-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = String(fd.get("name") || "").trim();
    const description = String(fd.get("description") || "").trim();
    const stage = String(fd.get("stage") || "Ideia");
    if (!name) return;

    if (existingProj) {
      existingProj.name = name;
      existingProj.description = description;
      existingProj.stage = stage;
      showToast("Dados do projeto atualizados.");
    } else {
      const newProj = {
        id: uid("proj"),
        name,
        description,
        stage,
        archived: false,
        tone: state.data.projects.length % 4,
        duplaNotes: "",
        checklist: createDefaultChecklist(),
        references: [],
        ideas: []
      };
      state.data.projects.unshift(newProj);
      showToast("Novo projeto criado na mesa.");
    }

    closeModal();
    scheduleSave(true);
    render();
  });
}

function closeModal() {
  const modalRoot = document.getElementById("modal-root");
  if (modalRoot) modalRoot.innerHTML = "";
}

// ==================== RENDER PRINCIPAL & EVENTOS ====================
function render() {
  if (!state.unlocked || !state.data) return;
  const appEl = document.getElementById("app");
  const proj = getActiveProject();

  if (proj) {
    appEl.innerHTML = renderProjectSpace(proj);
  } else {
    state.projectId = null;
    appEl.innerHTML = renderHub();
  }
}

document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;
  const proj = getActiveProject();

  if (action === "lock-mesa") {
    lockMesa();
    return;
  }

  if (action === "close-modal") {
    closeModal();
    return;
  }

  if (action === "go-hub") {
    e.preventDefault();
    state.projectId = null;
    state.editingIdeaId = null;
    state.editingRefId = null;
    render();
    return;
  }

  if (action === "hub-tab") {
    state.hubTab = btn.dataset.tab;
    render();
    return;
  }

  if (action === "open-new-project") {
    openProjectModal(null);
    return;
  }

  if (action === "edit-project") {
    const target = state.data.projects.find((p) => p.id === btn.dataset.id);
    if (target) openProjectModal(target);
    return;
  }

  if (action === "toggle-archive-project") {
    const target = state.data.projects.find((p) => p.id === btn.dataset.id);
    if (target) {
      target.archived = !target.archived;
      showToast(target.archived ? "Projeto arquivado." : "Projeto reaberto.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "open-project") {
    state.projectId = btn.dataset.id;
    state.projectTab = "checklist";
    state.checklistView = "step";
    state.stepIndex = 0;
    state.editingIdeaId = null;
    state.editingRefId = null;
    render();
    window.scrollTo(0, 0);
    return;
  }

  if (action === "export-backup") {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mesa-de-criacao-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup JSON baixado.");
    return;
  }

  if (action === "trigger-import") {
    document.getElementById("import-file-input")?.click();
    return;
  }

  if (!proj) return;

  // Navegação do projeto
  if (action === "project-tab") {
    state.projectTab = btn.dataset.tab;
    state.editingIdeaId = null;
    state.editingRefId = null;
    render();
    return;
  }

  if (action === "select-step") {
    state.checklistView = "step";
    state.stepIndex = Number(btn.dataset.index);
    render();
    return;
  }

  if (action === "checklist-subview") {
    state.checklistView = btn.dataset.view;
    render();
    return;
  }

  if (action === "prev-step") {
    if (state.stepIndex > 0) {
      state.stepIndex -= 1;
      render();
      window.scrollTo(0, 0);
    }
    return;
  }

  if (action === "next-step") {
    if (state.stepIndex < proj.checklist.length - 1) {
      state.stepIndex += 1;
      render();
      window.scrollTo(0, 0);
    }
    return;
  }

  if (action === "toggle-chip") {
    const step = proj.checklist[state.stepIndex];
    const q = step.questions[Number(btn.dataset.q)];
    const chip = btn.dataset.chip;
    const current = (q.answer || "").trim();
    if (!current) {
      q.answer = chip;
    } else if (!current.toLowerCase().includes(chip.toLowerCase())) {
      q.answer = `${current}, ${chip}`;
    }
    scheduleSave();
    render();
    return;
  }

  if (action === "toggle-step-agreed") {
    const step = proj.checklist[state.stepIndex];
    step.agreed = !step.agreed;
    showToast(step.agreed ? "Etapa marcada como combinada!" : "Etapa voltou para discussão.");
    scheduleSave(true);
    render();
    return;
  }

  if (action === "copy-summary") {
    const lines = [`# ${proj.name} (${proj.stage})`, proj.description || "", ""];
    proj.checklist.forEach((s) => {
      lines.push(`## ${s.num}. ${s.title} [${s.agreed ? "Combinado" : "Em discussão"}]`);
      s.questions.forEach((q) => {
        lines.push(`- ${q.label}: ${q.answer || "Em aberto"}`);
      });
      lines.push("");
    });
    navigator.clipboard?.writeText(lines.join("\n"));
    showToast("Resumo copiado para a área de transferência.");
    return;
  }

  // Referências
  if (action === "new-reference") {
    const newRef = {
      id: uid("ref"),
      title: "Nova referência",
      type: "Jogo",
      tags: [],
      link: "",
      attention: "",
      contribution: "",
      excerpt: "",
      connections: [],
      blocks: [],
      comments: [],
      favorite: false,
      status: "active",
      updatedAt: nowFormatted()
    };
    proj.references.unshift(newRef);
    state.editingRefId = newRef.id;
    scheduleSave(true);
    render();
    return;
  }

  if (action === "open-ref") {
    state.editingRefId = btn.dataset.id;
    render();
    window.scrollTo(0, 0);
    return;
  }

  if (action === "close-ref-editor") {
    state.editingRefId = null;
    render();
    return;
  }

  if (action === "save-ref-now") {
    const ref = proj.references.find((r) => r.id === state.editingRefId);
    if (ref) ref.updatedAt = nowFormatted();
    scheduleSave(true);
    showToast("Referência salva.");
    return;
  }

  if (action === "toggle-ref-fav") {
    const ref = proj.references.find((r) => r.id === btn.dataset.id);
    if (ref) {
      ref.favorite = !ref.favorite;
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "toggle-ref-fav-filter") {
    state.refFavOnly = !state.refFavOnly;
    render();
    return;
  }

  if (action === "move-ref") {
    const idx = proj.references.findIndex((r) => r.id === btn.dataset.id);
    const dir = Number(btn.dataset.dir);
    if (idx >= 0 && proj.references[idx + dir]) {
      const [item] = proj.references.splice(idx, 1);
      proj.references.splice(idx + dir, 0, item);
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "archive-ref") {
    const ref = proj.references.find((r) => r.id === btn.dataset.id);
    if (ref) {
      ref.status = "archived";
      showToast("Referência arquivada.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "trash-ref") {
    const ref = proj.references.find((r) => r.id === btn.dataset.id);
    if (ref) {
      ref.status = "trash";
      showToast("Referência movida para a lixeira.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "restore-ref") {
    const ref = proj.references.find((r) => r.id === btn.dataset.id);
    if (ref) {
      ref.status = "active";
      showToast("Referência restaurada.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "delete-ref-forever") {
    if (confirm("Excluir esta referência definitivamente? Esta ação não pode ser desfeita.")) {
      proj.references = proj.references.filter((r) => r.id !== btn.dataset.id);
      scheduleSave(true);
      render();
    }
    return;
  }

  // Ideias
  if (action === "new-idea" || action === "new-later-idea") {
    const newIdea = {
      id: uid("idea"),
      title: action === "new-later-idea" ? "Nova ideia para depois" : "Nova ideia",
      tags: action === "new-later-idea" ? ["para depois"] : ["em exploração"],
      blocks: [{ id: uid("blk"), type: "text", content: "", url: "", checked: false }],
      questions: "",
      connections: [],
      comments: [],
      favorite: false,
      status: "active",
      updatedAt: nowFormatted()
    };
    proj.ideas.unshift(newIdea);
    state.projectTab = "ideas";
    state.editingIdeaId = newIdea.id;
    scheduleSave(true);
    render();
    return;
  }

  if (action === "open-idea") {
    state.editingIdeaId = btn.dataset.id;
    render();
    window.scrollTo(0, 0);
    return;
  }

  if (action === "close-idea-editor") {
    state.editingIdeaId = null;
    render();
    return;
  }

  if (action === "save-idea-now") {
    const idea = proj.ideas.find((i) => i.id === state.editingIdeaId);
    if (idea) idea.updatedAt = nowFormatted();
    scheduleSave(true);
    showToast("Ideia salva.");
    return;
  }

  if (action === "toggle-idea-fav") {
    const idea = proj.ideas.find((i) => i.id === btn.dataset.id);
    if (idea) {
      idea.favorite = !idea.favorite;
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "toggle-idea-fav-filter") {
    state.ideaFavOnly = !state.ideaFavOnly;
    render();
    return;
  }

  if (action === "move-idea") {
    const idx = proj.ideas.findIndex((i) => i.id === btn.dataset.id);
    const dir = Number(btn.dataset.dir);
    if (idx >= 0 && proj.ideas[idx + dir]) {
      const [item] = proj.ideas.splice(idx, 1);
      proj.ideas.splice(idx + dir, 0, item);
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "archive-idea") {
    const idea = proj.ideas.find((i) => i.id === btn.dataset.id);
    if (idea) {
      idea.status = "archived";
      showToast("Ideia arquivada.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "trash-idea") {
    const idea = proj.ideas.find((i) => i.id === btn.dataset.id);
    if (idea) {
      idea.status = "trash";
      showToast("Ideia movida para a lixeira.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "restore-idea") {
    const idea = proj.ideas.find((i) => i.id === btn.dataset.id);
    if (idea) {
      idea.status = "active";
      showToast("Ideia restaurada.");
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "delete-idea-forever") {
    if (confirm("Excluir esta ideia definitivamente? Esta ação não pode ser desfeita.")) {
      proj.ideas = proj.ideas.filter((i) => i.id !== btn.dataset.id);
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "insert-idea-template") {
    const idea = proj.ideas.find((i) => i.id === state.editingIdeaId);
    if (idea) {
      idea.blocks = idea.blocks || [];
      idea.blocks.push({ id: uid("blk"), type: "heading", content: btn.dataset.tpl, url: "", checked: false });
      idea.blocks.push({ id: uid("blk"), type: "list", content: "", url: "", checked: false });
      idea.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  // Blocos (Ideias e Referências)
  if (action === "add-block") {
    const target =
      btn.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    if (target) {
      target.blocks = target.blocks || [];
      target.blocks.push({ id: uid("blk"), type: btn.dataset.type, content: "", url: "", checked: false });
      target.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "move-block") {
    const target =
      btn.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    const idx = Number(btn.dataset.idx);
    const dir = Number(btn.dataset.dir);
    if (target && target.blocks[idx + dir]) {
      const [blk] = target.blocks.splice(idx, 1);
      target.blocks.splice(idx + dir, 0, blk);
      target.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  if (action === "remove-block") {
    const target =
      btn.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    const idx = Number(btn.dataset.idx);
    if (target) {
      target.blocks.splice(idx, 1);
      target.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  // Navegação por conexões e busca
  if (action === "jump-item") {
    if (btn.dataset.kind === "idea") {
      state.projectTab = "ideas";
      state.editingIdeaId = btn.dataset.id;
      state.editingRefId = null;
    } else {
      state.projectTab = "references";
      state.editingRefId = btn.dataset.id;
      state.editingIdeaId = null;
    }
    render();
    window.scrollTo(0, 0);
    return;
  }

  if (action === "open-search-result") {
    const kind = btn.dataset.kind;
    if (kind === "step") {
      state.projectTab = "checklist";
      state.checklistView = "step";
      state.stepIndex = Number(btn.dataset.step);
    } else if (kind === "idea") {
      state.projectTab = "ideas";
      state.editingIdeaId = btn.dataset.id;
    } else if (kind === "ref") {
      state.projectTab = "references";
      state.editingRefId = btn.dataset.id;
    }
    render();
    window.scrollTo(0, 0);
  }
});

// Inputs em tempo real (sem perder foco ao digitar)
document.addEventListener("input", (e) => {
  const el = e.target;

  if (el.id === "hub-search-input") {
    state.hubSearch = el.value;
    render();
    const restored = document.getElementById("hub-search-input");
    if (restored) {
      restored.focus();
      restored.setSelectionRange(restored.value.length, restored.value.length);
    }
    return;
  }

  if (el.id === "ref-search-input") {
    state.refSearch = el.value;
    render();
    const restored = document.getElementById("ref-search-input");
    if (restored) {
      restored.focus();
      restored.setSelectionRange(restored.value.length, restored.value.length);
    }
    return;
  }

  if (el.id === "idea-search-input") {
    state.ideaSearch = el.value;
    render();
    const restored = document.getElementById("idea-search-input");
    if (restored) {
      restored.focus();
      restored.setSelectionRange(restored.value.length, restored.value.length);
    }
    return;
  }

  if (el.id === "project-search-input") {
    state.projectSearch = el.value;
    render();
    const restored = document.getElementById("project-search-input");
    if (restored) {
      restored.focus();
      restored.setSelectionRange(restored.value.length, restored.value.length);
    }
    return;
  }

  const proj = getActiveProject();
  if (!proj) return;

  if (el.dataset.stepQuestion !== undefined) {
    const step = proj.checklist[state.stepIndex];
    step.questions[Number(el.dataset.stepQuestion)].answer = el.value;
    scheduleSave();
    return;
  }

  if (el.dataset.stepOpinion !== undefined) {
    const step = proj.checklist[state.stepIndex];
    if (el.dataset.stepOpinion === "gabriel") step.opinionGabriel = el.value;
    if (el.dataset.stepOpinion === "jeferson") step.opinionJeferson = el.value;
    scheduleSave();
    return;
  }

  if (el.dataset.projectDupla !== undefined) {
    proj.duplaNotes = el.value;
    scheduleSave();
    return;
  }

  if (el.dataset.refField !== undefined) {
    const ref = proj.references.find((r) => r.id === state.editingRefId);
    if (ref) {
      ref[el.dataset.refField] = el.value;
      ref.updatedAt = nowFormatted();
      scheduleSave();
    }
    return;
  }

  if (el.dataset.refTags !== undefined) {
    const ref = proj.references.find((r) => r.id === state.editingRefId);
    if (ref) {
      ref.tags = el.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);
      ref.updatedAt = nowFormatted();
      scheduleSave();
    }
    return;
  }

  if (el.dataset.ideaField !== undefined) {
    const idea = proj.ideas.find((i) => i.id === state.editingIdeaId);
    if (idea) {
      idea[el.dataset.ideaField] = el.value;
      idea.updatedAt = nowFormatted();
      scheduleSave();
    }
    return;
  }

  if (el.dataset.ideaTags !== undefined) {
    const idea = proj.ideas.find((i) => i.id === state.editingIdeaId);
    if (idea) {
      idea.tags = el.value
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 12);
      idea.updatedAt = nowFormatted();
      scheduleSave();
    }
    return;
  }

  if (el.dataset.blockContent !== undefined) {
    const target =
      el.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    if (target && target.blocks[Number(el.dataset.blockContent)]) {
      target.blocks[Number(el.dataset.blockContent)].content = el.value;
      target.updatedAt = nowFormatted();
      scheduleSave();
    }
    return;
  }

  if (el.dataset.blockUrl !== undefined) {
    const target =
      el.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    if (target && target.blocks[Number(el.dataset.blockUrl)]) {
      target.blocks[Number(el.dataset.blockUrl)].url = el.value;
      target.updatedAt = nowFormatted();
      scheduleSave();
    }
  }
});

// Selects, Checkboxes e Importação de Arquivo
document.addEventListener("change", (e) => {
  const el = e.target;

  if (el.id === "import-file-input" && el.files && el.files[0]) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (parsed && Array.isArray(parsed.projects)) {
          state.data = parsed;
          scheduleSave(true);
          render();
          showToast("Backup restaurado com sucesso!");
        } else {
          showToast("Arquivo de backup inválido.");
        }
      } catch {
        showToast("Não foi possível ler o arquivo JSON.");
      }
    };
    reader.readAsText(el.files[0]);
    return;
  }

  if (el.id === "ref-type-filter") {
    state.refType = el.value;
    render();
    return;
  }

  if (el.id === "ref-tag-filter") {
    state.refTag = el.value;
    render();
    return;
  }

  if (el.id === "idea-tag-filter") {
    state.ideaTag = el.value;
    render();
    return;
  }

  const proj = getActiveProject();
  if (!proj) return;

  if (el.dataset.refField === "type") {
    const ref = proj.references.find((r) => r.id === state.editingRefId);
    if (ref) {
      ref.type = el.value;
      ref.updatedAt = nowFormatted();
      scheduleSave(true);
    }
    return;
  }

  if (el.dataset.refConn !== undefined) {
    const ref = proj.references.find((r) => r.id === state.editingRefId);
    if (ref) {
      ref.connections = ref.connections || [];
      const cid = el.dataset.refConn;
      if (el.checked && !ref.connections.includes(cid)) ref.connections.push(cid);
      if (!el.checked) ref.connections = ref.connections.filter((x) => x !== cid);
      ref.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  if (el.dataset.ideaConn !== undefined) {
    const idea = proj.ideas.find((i) => i.id === state.editingIdeaId);
    if (idea) {
      idea.connections = idea.connections || [];
      const cid = el.dataset.ideaConn;
      if (el.checked && !idea.connections.includes(cid)) idea.connections.push(cid);
      if (!el.checked) idea.connections = idea.connections.filter((x) => x !== cid);
      idea.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  if (el.dataset.blockType !== undefined) {
    const target =
      el.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    const idx = Number(el.dataset.blockType);
    if (target && target.blocks[idx]) {
      target.blocks[idx].type = el.value;
      target.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
    return;
  }

  if (el.dataset.blockChecked !== undefined) {
    const target =
      el.dataset.owner === "idea"
        ? proj.ideas.find((i) => i.id === state.editingIdeaId)
        : proj.references.find((r) => r.id === state.editingRefId);
    const idx = Number(el.dataset.blockChecked);
    if (target && target.blocks[idx]) {
      target.blocks[idx].checked = el.checked;
      target.updatedAt = nowFormatted();
      scheduleSave(true);
      render();
    }
  }
});

// Envio de comentários
document.addEventListener("submit", (e) => {
  const form = e.target;
  if (!form.dataset.commentForm) return;
  e.preventDefault();
  const proj = getActiveProject();
  if (!proj) return;

  const fd = new FormData(form);
  const author = String(fd.get("author") || "").trim();
  const text = String(fd.get("text") || "").trim();
  if (!author || !text) return;

  const target =
    form.dataset.commentForm === "idea"
      ? proj.ideas.find((i) => i.id === state.editingIdeaId)
      : proj.references.find((r) => r.id === state.editingRefId);

  if (target) {
    target.comments = target.comments || [];
    target.comments.push({
      id: uid("cmt"),
      author,
      text,
      createdAt: nowFormatted()
    });
    target.updatedAt = nowFormatted();
    scheduleSave(true);
    render();
    showToast("Comentário adicionado.");
  }
});

setupPinGate();
