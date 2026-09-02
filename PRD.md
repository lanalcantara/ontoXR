# Documento de Requisitos de Produto (PRD) - OntoXR

**Nome do Projeto:** OntoXR (Ontology Extended Reality Explorer)  
**Versão:** 1.0.0  
**Data:** 31 de Agosto de 2026  
**Autor:** Equipe OntoXR / UFPE - Centro de Informática (CIn)  
**Status:** Aprovado / Em Produção  

---

## 1. Visão Geral do Produto

### 1.1. Resumo Executivo
O **OntoXR** é uma plataforma distribuída de visualização e exploração tridimensional interativa de ontologias em navegadores modernos. A plataforma atua como uma ponte em tempo real entre o principal editor de ontologias do mercado — o **Stanford Protégé 5.x** — e um ambiente gráfico 3D fluido e enxuto na web, suportando navegação espacial por meio de **controles físicos sem fio (joysticks de PS4/PS5 e Xbox)** e periféricos tradicionais (teclado e mouse).

### 1.2. Problema a ser Resolvido
Editores tradicionais de ontologia (como o Protégé) utilizam interfaces 2D baseadas em árvores hierárquicas e tabelas de axiomas. Essa abordagem torna a compreensão de grafos de conhecimento densos, com centenas de classes, axiomas inferidos e propriedades de objetos, uma tarefa cognitiva exaustiva e de difícil visualização espacial.

### 1.3. Proposta de Valor
- **Visualização Topológica Universal:** Renderização procedural e agnóstica de qualquer ontologia (`.owl`, `.rdf`, `.ttl`) em grafos tridimensionais dinâmicos.
- **Sincronização em Tempo Real com Protégé:** Qualquer alteração, importação de arquivo ou execução do raciocinador no Protégé é refletida instantaneamente no visualizador 3D via WebSocket.
- **Navegação Ergonômica por Joystick:** Exploração fluida estilo voo espacial 3D com controle sem fio de PS4/PS5, mira telescópica (Zoom FOV), teletransporte (*Dash*) e inspeção frontal de elementos.
- **Colaboração e Anotações em Tempo Real:** Sistema de comentários colaborativos voláteis transmitidos entre múltiplos clientes conectados.

---

## 2. Arquitetura do Sistema

```mermaid
graph TD
    subgraph Host["💻 Ambiente Local / Desktop"]
        subgraph Protege["🖥️ Stanford Protégé 5.5+ (Java OSGi)"]
            OWL[Ontologia Ativa (.owl / .rdf / .ttl)] --> OMM[OWLModelManager]
            OMM -->|ModelChangeEvent| Plugin[OntoXRViewComponent]
            Plugin --> Reasoner[HermiT / Structural Reasoner]
            Reasoner --> Parser[OntologyParser]
            Parser --> WS[OntoXR WebSocket Server :8080]
        end

        subgraph WebXR["🥽 OntoXR Web Client (:5173)"]
            WS -->|JSON Graph Stream :8080| Client[App.tsx - React & Three.js]
            Client -->|Renderização 3D| ForceGraph[3D ForceGraph Engine]
            Client -->|UI Overlay| UI[Status Panel & Sidebar Details]
            GamepadAPI[Gamepad API] -->|Input Polling 60 FPS| Client
            WebXRAPIS[WebXR Session] -->|Imersão VR| Client
        end

        Gamepad[🎮 Controle PS4 / Xbox Wireless] --> GamepadAPI
        HMD[🥽 Óculos VR / Meta Quest] --> WebXRAPIS
    end
```

---

## 3. Especificações Técnicas dos Componentes

### 3.1. Módulo Backend: Plugin Nativo do Protégé (`plugin-protege`)
- **Linguagem & Ambiente:** Java 8 / 11, Apache Maven, Apache Felix (OSGi Bundle).
- **Dependências Principais:**
  - `protege-editor-owl 5.5.0`: Integração com o ciclo de vida do Protégé.
  - `owlapi-distribution 4.5.20`: Manipulação de axiomas, entidades, classes e propriedades.
  - `org.semanticweb.hermit 1.4.3.456`: Raciocinador semântico para precomputar inferências de hierarquia e propriedades de objetos.
  - `Java-WebSocket 1.5.4`: Servidor WebSocket assíncrono rodando na porta TCP `8080`.
  - `gson 2.8.9`: Serialização JSON de alta performance.
- **Modos de Execução:**
  1. **Modo Plugin:** Embutido no Protégé via `AbstractOWLViewComponent` e `plugin.xml` (Aba `OntoXR`).
  2. **Modo Standalone (`OntoXRStandalone.java`):** Executável autônomo via CLI para carregar ontologias de arquivos locais sem abrir a GUI do Protégé.

#### Protocolo de Comunicação WebSocket (JSON Schema)

##### Carga da Ontologia (Servidor -> Cliente):
```json
{
  "nodes": [
    {
      "id": "http://cin.ufpe.br/ontoxr/BioHack#PlasmodiumFalciparum",
      "name": "PlasmodiumFalciparum",
      "group": "individual",
      "comment": "Parasita causador da malária grave.",
      "dataProperties": {
        "virulenceLevel": "Extreme",
        "genomeSizeMB": 23.26
      },
      "collaborativeComments": [
        {
          "author": "Dr. Silva",
          "text": "Sequenciamento validado.",
          "timestamp": "14:32"
        }
      ]
    }
  ],
  "links": [
    {
      "source": "http://cin.ufpe.br/ontoxr/BioHack#PlasmodiumFalciparum",
      "target": "http://cin.ufpe.br/ontoxr/BioHack#ParasiteThreatAgent",
      "label": "instância_de",
      "relation": "instância_de"
    }
  ]
}
```

##### Adição de Comentário Colaborativo (Cliente -> Servidor -> Broadcast):
```json
{
  "action": "add_comment",
  "nodeId": "http://cin.ufpe.br/ontoxr/BioHack#PlasmodiumFalciparum",
  "author": "Pesquisador A",
  "text": "Possível alvo para inibidores de protease.",
  "timestamp": "17:45"
}
```

---

### 3.2. Módulo Frontend: Visualizador WebXR (`webxr-client`)
- **Linguagem & Framework:** TypeScript 5.x, React 18, Vite 5.
- **Motor Gráfico:** Three.js r160+, `react-force-graph-3d`.
- **Estilização:** Vanilla CSS com Design System baseado em Glassmorphism escuro (`#080e1a` / `#0f172a`), tipografia moderna do sistema e componentes translúcidos com `backdrop-filter: blur(10px)`.

---

## 4. Requisitos Funcionais (FR)

| ID | Nome do Requisito | Descrição | Prioridade |
| :--- | :--- | :--- | :--- |
| **RF-01** | **Captura Automática da Ontologia** | O plugin deve capturar automaticamente a ontologia ativa no Protégé ao carregar ou alternar ontologias. | **P0 (Crítico)** |
| **RF-02** | **Inferência Semântica com HermiT** | O parser deve rodar o HermiT Reasoner (com fallback para Structural Reasoner) para inferir hierarquias de subclasses e relações entre indivíduos. | **P0 (Crítico)** |
| **RF-03** | **Streaming WebSocket** | O servidor deve manter conexões ativas na porta `8080` e realizar broadcast da ontologia para todos os clientes conectados. | **P0 (Crítico)** |
| **RF-04** | **Renderização Tridimensional de Grafos** | A aplicação web deve renderizar classes em Azul/Ciano (`#38bdf8`) e indivíduos em Âmbar/Dourado (`#f59e0b`). | **P0 (Crítico)** |
| **RF-05** | **Navegação 3D Livre por Joystick** | O usuário deve conseguir voar no plano XY pelo L-Stick e controlar a profundidade/zoom Z pelo R-Stick de controles sem fio. | **P0 (Crítico)** |
| **RF-06** | **Navegação Direcional Passo a Passo (D-Pad)** | O D-Pad deve permitir saltar diretamente para o nó visível mais próximo na direção pressionada, com alinhamento frontal da câmera a 55 unidades de distância. | **P0 (Crítico)** |
| **RF-07** | **Modo Mira com Zoom FOV (Gatilho L2)** | Pressionar L2/LT deve aplicar um zoom cinematográfico reduzindo o FOV da câmera de 75° para 40° via interpolação linear suave. | **P1 (Alto)** |
| **RF-08** | **Dash / Teletransporte por Raycast (Gatilho R2)** | Pressionar R2/RT ou o botão de disparo deve emitir um raio do retículo central e voar imediatamente até o elemento mirado. | **P1 (Alto)** |
| **RF-09** | **Painel Lateral de Detalhes** | Selecionar um conceito (via Botão ✕, clique ou mira) deve abrir um painel com Nome, URI, Descrição, *Data Properties* e Comentários. | **P0 (Crítico)** |
| **RF-10** | **Comentários Colaborativos em Tempo Real** | Usuários devem poder submeter notas de texto vinculadas ao nó selecionado, sendo refletidas instantaneamente sem recarregar a tela. | **P1 (Alto)** |
| **RF-11** | **Filtros Visuais de Classes e Indivíduos** | Botões interativos devem permitir ocultar/exibir seletivamente todas as classes ou todos os indivíduos da ontologia. | **P1 (Alto)** |
| **RF-12** | **Busca com Teletransporte (Search & Fly-To)** | Uma barra de busca com autocompletar deve localizar nós por nome ao pressionar Enter e voar a câmera diretamente para ele. | **P1 (Alto)** |
| **RF-13** | **Visão Panorâmica (Reset)** | O botão △ (Triângulo) ou a tecla 'R' deve reajustar a câmera para o enquadramento de visão geral de todo o grafo (*Zoom to Fit*). | **P2 (Médio)** |
| **RF-14** | **Suporte a Realidade Virtual (WebXR)** | Um botão nativo `ENTER VR` deve iniciar a sessão WebXR imersiva em dispositivos compatíveis (Meta Quest, Apple Vision Pro, WebXR Emulator). | **P1 (Alto)** |
| **RF-15** | **Suporte Híbrido Teclado + Mouse** | Todas as ações do joystick devem possuir atalhos equivalentes no teclado (`WASD`, `Setas`, `Espaço`, `Tab`, `Esc`, `R`) e mouse. | **P0 (Crítico)** |

---

## 5. Requisitos Não-Funcionais (NFR)

| Categoria | Requisito | Métrica / Critério de Aceitação |
| :--- | :--- | :--- |
| **Performance** | Taxa de Quadros (FPS) | Manter taxa mínima estável de **60 FPS** no desktop e **72/90 FPS** em headsets VR para grafos de até 1.000 nós. |
| **Latência** | Tempo de Resposta WebSocket | Latência de sincronização inferior a **100 ms** em conexões locais. |
| **Usabilidade** | Deadzone de Gamepad | Zona morta calibrada em **0.15** nos eixos analógicos para evitar *stick drift*. |
| **Compatibilidade** | Navegadores e Plataformas | Compatível com Google Chrome, Microsoft Edge, Mozilla Firefox e navegadores WebXR nativos (Oculus Browser). |
| **Compatibilidade** | Versões do Protégé | Compatível com Stanford Protégé versões **5.2.x, 5.5.x e 5.6.x**. |
| **Segurança & Privacidade** | Execução 100% Offline | Nenhuma informação ontológica ou comentário trafega fora da máquina do usuário (porta local `8080`). |

---

## 6. Mapeamento Completo de Controles e Joysticks

```
                       [ L2 / LT: Zoom - ]              [ R2 / RT: Zoom + ]
                       [ L1: Reservado ]                [ R1 / RB: Dash Direcional (Pulo no Nó) ]
                                     
                                  ▲ (Pular Opção Cima)
(Pular Opção Esq)  ◀    D-PAD    ▶ (Pular Opção Dir)   △ (Visão Panorâmica)
                                  ▼ (Pular Opção Baixo)  □ (Reservado)     ◯ (Voltar / Desmarcar)
                                                                           ✕ (Selecionar / Abrir Card)
                    [ L-STICK: Navegar entre Nós ]      [ R-STICK: Câmera 360° (Órbita) ]
                    (Foca e Acende Brilho no Nó)
```

### Tabela de Mapeamento:

| Botão / Analógico (PS4 / PS5) | Controle de Xbox | Ação no OntoXR |
| :--- | :--- | :--- |
| **Botão Select / Share / Back (Botão 8)** | **Botão View / Back** | **Modo Apresentação (Cinematográfico):** Oculta instantaneamente todos os painéis, botões, ícones, mira e menus da interface, deixando na tela **apenas o fluxo tridimensional limpo**. Ao clicar ou selecionar um elemento com ✕, **apenas o card lateral de informações daquele elemento** é exibido sob demanda. Pressionar Select novamente (ou Tecla `P`) restaura toda a interface. |
| **L3 (Clique do Analógico L / Botão 10)** | **L3 (Stick Click)** | **Reiniciar no Início da Ontologia (Raiz):** Enquadra e reinicia o fluxo a partir do primeiro conceito raiz (`owl:Thing`), tanto no modo comum quanto no modo Caixas 3D. |
| **Analógico L (L-Stick)** | **L-Stick** | **Fluxo Cíclico Sequencial:** Caminha item a item seguindo rigorosamente a ordem hierárquica do Protégé (Preorder DFS). Ao atingir o final da ontologia, avança ciclicamente de volta ao primeiro item (`owl:Thing`), e vice-versa. |
| **R1 / RB (Botão 5)** | **RB** | **Dash Livre:** Pula diretamente e em alta velocidade (320ms) para qualquer nó na direção apontada pelo L-Stick. |
| **Analógico R (R-Stick)** | **R-Stick** | **Câmera 360°:** Órbita esférica tridimensional suave contínua ao redor do nó focado. |
| **R3 (Clique do Analógico R / Botão 11)** | **R3 (Stick Click)** | **Modo Caixas 3D / Fluxograma:** Organiza instantaneamente todas as classes e entidades em caixas 3D verticais elegantes com linhas retas diretas da hierarquia, sem linhas se chocando. |
| **Gatilho L2 / LT (Botão 6)** | **Gatilho LT** | **Zoom - (Afastar):** Afasta a câmera gradualmente em relação ao centro focado. |
| **Gatilho R2 / RT (Botão 7)** | **Gatilho RT** | **Zoom + (Aproximar):** Aproxima a câmera gradualmente em relação ao centro focado. |
| **Botão □ / Quadrado (Botão 2)** | **Botão X** | **Toggle Apenas Classes (Azuis):** Ativa/desativa o filtro para que o Analógico L navegue exclusivamente entre Classes. |
| **Botão △ / Triângulo (Botão 3)**| **Botão Y** | **Toggle Apenas Entidades (Amarelas):** Ativa/desativa o filtro para que o Analógico L navegue exclusivamente entre Entidades/Indivíduos. |
| **D-Pad (Setinhas)** | **D-Pad** | **Navegar Opções da UI:** Percorre visualmente os botões da tela com contorno de destaque. |
| **Botão ✕ / Cruz (Botão 0)** | **Botão A** | **Selecionador:** Executa o botão ativo selecionado pelo D-Pad ou abre o painel de detalhes do nó focado. |
| **Botão ◯ / Círculo (Botão 1)** | **Botão B** | **Voltar / Desmarcar:** Desmarca a seleção dos botões do D-Pad ou fecha o painel lateral de detalhes. |

---

## 7. Guia de Instalação e Execução

### 7.1. Compilação do Plugin Protégé
```bash
# Navegar até o diretório do plugin
cd plugin-protege

# Compilar e gerar o pacote OSGi (JAR)
mvn clean package -DskipTests
```
*O artefato gerado estará em: `plugin-protege/target/ontoxr-1.0.0-SNAPSHOT.jar`.*  
*Copie este arquivo `.jar` para o diretório `plugins/` do seu Stanford Protégé.*

### 7.2. Execução da Aplicação Web
```bash
# Navegar até o diretório do cliente WebXR
cd webxr-client

# Instalar dependências
npm install

# Iniciar o servidor de desenvolvimento Vite
npm run dev
```
*Acesse no navegador: `http://localhost:5173`.*

---

## 8. Roteiro Futuro (Roadmap pós-v1.0)

1. **Rastreamento de Mãos (*Hand Tracking*):** Suporte a pinça e gestos espaciais no Meta Quest sem necessidade de controle físico.
2. **Edição Bidirecional em VR:** Criação de novas classes e axiomas diretamente no ambiente 3D/VR com escrita de volta no arquivo do Protégé.
3. **Salas Espaciais Multi-usuário:** Avatares 3D e áudio espacial para sessões conjuntas de engenharia de ontologias em equipe.
