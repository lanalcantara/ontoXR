import { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';

// Configurações de Câmera e Navegação
const CONFIG = {
  frontalDistance: 55, // Distância ideal de recuo ao enquadrar um nó
  navDuration: 650,    // Duração do voo suave de foco (ms)
  dashDuration: 320,   // Duração do pulo rápido / Dash com R1 (ms)
  minZoomDist: 25,
  maxZoomDist: 600
};

interface GamepadInfo {
  connected: boolean;
  name: string;
  type: 'ps4' | 'xbox' | 'nintendo' | 'generic' | 'none';
}

const detectGamepadInfo = (gamepad: Gamepad | null): GamepadInfo => {
  if (!gamepad) return { connected: false, name: 'Desconectado', type: 'none' };
  const id = (gamepad.id || '').toLowerCase();
  
  if (id.includes('playstation') || id.includes('dualshock') || id.includes('dualsense') || id.includes('wireless controller') || id.includes('sony') || id.includes('054c')) {
    return { connected: true, name: 'Controle PS4 / PS5', type: 'ps4' };
  }
  if (id.includes('xbox') || id.includes('xinput') || id.includes('microsoft')) {
    return { connected: true, name: 'Controle Xbox', type: 'xbox' };
  }
  if (id.includes('nintendo') || id.includes('switch') || id.includes('pro controller') || id.includes('joy-con')) {
    return { connected: true, name: 'Controle Nintendo', type: 'nintendo' };
  }
  return { connected: true, name: 'Controle Xbox / Wireless', type: 'xbox' };
};

const getGamepadColor = (type: GamepadInfo['type'], connected: boolean): string => {
  if (!connected) return '#94a3b8';
  switch (type) {
    case 'ps4': return '#38bdf8';     // Azul PlayStation
    case 'xbox': return '#10b981';    // Verde Xbox
    case 'nintendo': return '#ef4444';// Vermelho Nintendo
    case 'generic': return '#a855f7'; // Roxo Genérico
    default: return '#10b981';
  }
};

// Cache de texturas para as caixas 3D do modo R3
const cardTextureCache = new Map<string, THREE.CanvasTexture>();

const getCardCanvasTexture = (name: string, isClass: boolean, isFocused: boolean): THREE.CanvasTexture => {
  const cacheKey = `${name}_${isClass}_${isFocused}`;
  if (cardTextureCache.has(cacheKey)) {
    return cardTextureCache.get(cacheKey)!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Fundo
  ctx.fillStyle = isFocused 
    ? (isClass ? '#1e3a8a' : '#78350f') 
    : (isClass ? '#0f172a' : '#1c1917');
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 120, 16);
  ctx.fill();

  // Borda
  ctx.lineWidth = isFocused ? 8 : 4;
  ctx.strokeStyle = isFocused 
    ? (isClass ? '#00f2fe' : '#fbbf24') 
    : (isClass ? '#38bdf8' : '#f59e0b');
  ctx.beginPath();
  ctx.roundRect(4, 4, 504, 120, 16);
  ctx.stroke();

  // Ícone e Nome do Conceito
  ctx.font = 'bold 34px "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = isFocused ? '#ffffff' : (isClass ? '#e2e8f0' : '#fef3c7');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const icon = isClass ? '🔷' : '🔶';
  const displayTitle = name.length > 22 ? name.slice(0, 20) + '…' : name;
  ctx.fillText(`${icon} ${displayTitle}`, 28, 64);

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  cardTextureCache.set(cacheKey, texture);
  return texture;
};

// 1. Constrói o Fluxo Cíclico Sequencial Fiel à Hierarquia de Classes do Protégé (Preorder DFS)
const buildProtegeHierarchyFlow = (nodes: any[], links: any[]): { node: any; depth: number }[] => {
  if (!nodes || nodes.length === 0) return [];

  const childrenMap = new Map<string, string[]>();
  const parentMap = new Map<string, string>();
  const nodeMap = new Map<string, any>();

  nodes.forEach(n => {
    nodeMap.set(n.id, n);
    childrenMap.set(n.id, []);
  });

  // Identifica hierarquia de classes (subClassOf) e instâncias (instância_de)
  links.forEach((link: any) => {
    const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
    const targetId = typeof link.target === 'object' ? link.target.id : link.target;

    if (link.relation === 'subClassOf' || link.relation === 'instância_de') {
      if (childrenMap.has(targetId) && nodeMap.has(sourceId)) {
        if (!childrenMap.get(targetId)!.includes(sourceId)) {
          childrenMap.get(targetId)!.push(sourceId);
        }
        parentMap.set(sourceId, targetId);
      }
    }
  });

  // Raízes: classes sem pai no arquivo atual
  let rootIds = nodes
    .filter(n => n.group === 'class' && (!parentMap.has(n.id) || parentMap.get(n.id) === n.id))
    .map(n => n.id);

  if (rootIds.length === 0) {
    rootIds = [nodes[0].id];
  }

  const orderedList: { node: any; depth: number }[] = [];
  const visited = new Set<string>();

  const traverse = (nodeId: string, depth: number) => {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const node = nodeMap.get(nodeId);
    if (node) {
      orderedList.push({ node, depth });
    }

    const children = childrenMap.get(nodeId) || [];
    children.sort((aId, bId) => {
      const a = nodeMap.get(aId);
      const b = nodeMap.get(bId);
      if (!a || !b) return 0;
      if (a.group !== b.group) return a.group === 'class' ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    children.forEach(childId => traverse(childId, depth + 1));
  };

  rootIds.forEach(rootId => traverse(rootId, 0));

  nodes.forEach(n => {
    if (!visited.has(n.id)) traverse(n.id, 0);
  });

  return orderedList;
};

// 2. Aplica a Diagramação em Fluxograma Vertical com Caixas 3D e Linhas Diretas
const applyOrderedFlowchartLayout = (nodes: any[], links: any[]) => {
  const orderedFlow = buildProtegeHierarchyFlow(nodes, links);
  if (orderedFlow.length === 0) return;

  const total = orderedFlow.length;
  const rowHeight = 20.0;       // Espaçamento vertical perfeito para as caixas 3D
  const indentSpacing = 24.0;   // Indentação horizontal por nível hierárquico
  const startY = (total * rowHeight) / 2.3;

  orderedFlow.forEach((item, index) => {
    const node = item.node;
    node.fx = -70 + item.depth * indentSpacing; // X proporcional à profundidade
    node.fy = startY - index * rowHeight;       // Y vertical de cima para baixo
    node.fz = 0;
  });
};

const releaseOrderedFlowchartLayout = (nodes: any[]) => {
  if (!nodes) return;
  nodes.forEach(n => {
    n.fx = undefined;
    n.fy = undefined;
    n.fz = undefined;
  });
};

export default function App() {
  const [status, setStatus] = useState('Desconectado');
  const [stats, setStats] = useState({ nodes: 0, links: 0, classes: 0, individuals: 0 });
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] }>({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [currentFocusedNode, setCurrentFocusedNode] = useState<any>(null);
  const [gamepadInfo, setGamepadInfo] = useState<GamepadInfo>({ connected: false, name: 'Desconectado', type: 'none' });

  // Modal / Abinha de Informações dos Controles
  const [showControlsModal, setShowControlsModal] = useState<boolean>(false);
  const [controlsTab, setControlsTab] = useState<'ps4' | 'xbox'>('xbox');

  // Modo de Apresentação (Select / Share / Tecla P): Oculta toda a UI para exibição cinematográfica pura
  const [isPresentationMode, setIsPresentationMode] = useState<boolean>(false);

  // Modo de Diagramação Ordenada / Fluxograma com Caixas 3D (R3 / Tecla O)
  const [isOrderedLayout, setIsOrderedLayout] = useState<boolean>(false);

  // Filtro de Navegação Semântica por Tipo: 'all' | 'class' (Quadrado/X) | 'individual' (Triângulo/Y)
  const [navTypeFilter, setNavTypeFilter] = useState<'all' | 'class' | 'individual'>('all');

  // Navegação de Opções de Interface (D-Pad)
  // 0: Classes, 1: Entidades, 2: Pesquisar, 3: Início, 4: Anterior, 5: Próximo, 6: Detalhes, 7: Diagramação, 8: Panorâmica
  const [focusedUiIndex, setFocusedUiIndex] = useState<number | null>(null);

  // Filtros Visuais e Busca
  const [showClasses, setShowClasses] = useState<boolean>(true);
  const [showIndividuals, setShowIndividuals] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Comentários Colaborativos
  const [authorName, setAuthorName] = useState<string>(() => {
    try {
      return localStorage.getItem('ontoxr_author') || '';
    } catch {
      return '';
    }
  });
  const [commentText, setCommentText] = useState<string>('');

  const fgRef = useRef<any>();
  const socketRef = useRef<WebSocket | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  
  // Refs para controle do fluxo ordenado e câmera
  const focusedNodeRef = useRef<any>(null);
  const orbitStateRef = useRef<{ theta: number; phi: number; radius: number }>({ theta: 0, phi: 0, radius: 120 });
  const lastNavTimeRef = useRef<number>(0);
  const lastDpadTimeRef = useRef<number>(0);
  
  // Debounce refs para botões físicos
  const crossButtonPressedRef = useRef<boolean>(false);
  const circleButtonPressedRef = useRef<boolean>(false);
  const squareButtonPressedRef = useRef<boolean>(false);
  const triangleButtonPressedRef = useRef<boolean>(false);
  const r1ButtonPressedRef = useRef<boolean>(false);
  const l3ButtonPressedRef = useRef<boolean>(false);
  const r3ButtonPressedRef = useRef<boolean>(false);
  const selectButtonPressedRef = useRef<boolean>(false);

  // Sincroniza a aba do modal com o controle detectado
  useEffect(() => {
    if (gamepadInfo.type === 'ps4') {
      setControlsTab('ps4');
    } else if (gamepadInfo.type === 'xbox') {
      setControlsTab('xbox');
    }
  }, [gamepadInfo.type]);

  // Responsividade
  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Enquadramento frontal suave com luz/destaque no nó focado
  const focusOnNode = useCallback((node: any, duration: number = CONFIG.navDuration) => {
    if (!node || node.x === undefined || !fgRef.current) return;

    setCurrentFocusedNode(node);
    focusedNodeRef.current = node;

    const targetCamPos = {
      x: node.x,
      y: node.y,
      z: node.z + (isOrderedLayout ? 75 : CONFIG.frontalDistance)
    };

    orbitStateRef.current = {
      theta: 0,
      phi: 0,
      radius: isOrderedLayout ? 75 : CONFIG.frontalDistance
    };

    fgRef.current.cameraPosition(
      targetCamPos,
      { x: node.x, y: node.y, z: node.z },
      duration
    );
  }, [isOrderedLayout]);

  // Reiniciar e focar no Primeiro Conceito / Raiz da Ontologia (Botão L3 / Tecla I / Home)
  const resetToRootStart = useCallback(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) return;

    const orderedFlow = buildProtegeHierarchyFlow(graphData.nodes, graphData.links);
    let candidateNodes = orderedFlow.map(item => item.node);

    if (navTypeFilter === 'class') {
      candidateNodes = candidateNodes.filter(n => n.group === 'class');
    } else if (navTypeFilter === 'individual') {
      candidateNodes = candidateNodes.filter(n => n.group === 'individual');
    }

    const rootNode = candidateNodes.length > 0 ? candidateNodes[0] : graphData.nodes[0];
    if (rootNode) {
      focusOnNode(rootNode, 900);
      setSelectedNode((prev: any) => (prev ? { ...rootNode } : null));
    }
  }, [graphData.nodes, graphData.links, navTypeFilter, focusOnNode]);

  // Resetar câmera para visão geral panorâmica
  const resetCameraView = useCallback(() => {
    if (!fgRef.current) return;
    fgRef.current.zoomToFit(1000, 80);
    setSelectedNode(null);
    setCurrentFocusedNode(null);
    focusedNodeRef.current = null;
    orbitStateRef.current = { theta: 0, phi: 0, radius: 180 };
  }, []);

  // Alternar abertura/fechamento do painel de detalhes do nó focado
  const toggleCurrentNodeDetails = useCallback(() => {
    const node = focusedNodeRef.current || currentFocusedNode;
    if (!node) return;

    setSelectedNode((prev: any) => {
      if (prev && prev.id === node.id) {
        return null;
      }
      const fresh = graphData.nodes.find((n: any) => n.id === node.id) || node;
      return { ...fresh };
    });
  }, [currentFocusedNode, graphData.nodes]);

  // Alternar Modo de Diagramação em Caixas 3D (R3)
  const toggleOrderedLayout = useCallback(() => {
    setIsOrderedLayout(prev => {
      const next = !prev;
      if (next) {
        applyOrderedFlowchartLayout(graphData.nodes, graphData.links);
        setTimeout(() => {
          if (fgRef.current) fgRef.current.zoomToFit(850, 70);
        }, 150);
      } else {
        releaseOrderedFlowchartLayout(graphData.nodes);
        if (fgRef.current) {
          fgRef.current.d3ReheatSimulation();
          setTimeout(() => {
            if (fgRef.current) fgRef.current.zoomToFit(850, 80);
          }, 300);
        }
      }
      return next;
    });
  }, [graphData.nodes, graphData.links]);

  // 3. Navegação Cíclica Passo a Passo de um Item ao Outro
  const navigateCyclicStep = useCallback((direction: 'forward' | 'back' = 'forward') => {
    if (!graphData.nodes || graphData.nodes.length === 0) return;

    const orderedFlow = buildProtegeHierarchyFlow(graphData.nodes, graphData.links);
    let candidateNodes = orderedFlow.map(item => item.node);

    if (navTypeFilter === 'class') {
      candidateNodes = candidateNodes.filter(n => n.group === 'class');
    } else if (navTypeFilter === 'individual') {
      candidateNodes = candidateNodes.filter(n => n.group === 'individual');
    }

    if (candidateNodes.length === 0) return;

    const current = focusedNodeRef.current || currentFocusedNode || candidateNodes[0];
    const currentIndex = candidateNodes.findIndex(n => n.id === current.id);

    let nextIndex: number;
    if (direction === 'forward') {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % candidateNodes.length;
    } else {
      nextIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + candidateNodes.length) % candidateNodes.length;
    }

    const targetNode = candidateNodes[nextIndex];
    if (targetNode) {
      focusOnNode(targetNode, CONFIG.navDuration);
      setSelectedNode((prev: any) => (prev ? { ...targetNode } : null));
    }
  }, [graphData.nodes, graphData.links, currentFocusedNode, navTypeFilter, focusOnNode]);

  // Modo Dash Livre (R1 / RB)
  const performFreeDash = useCallback((direction: 'left' | 'right' | 'up' | 'down' | 'next' = 'next') => {
    let candidateNodes = graphData.nodes.filter((n: any) => {
      if (navTypeFilter === 'class') return n.group === 'class';
      if (navTypeFilter === 'individual') return n.group === 'individual';
      return true;
    });

    if (candidateNodes.length === 0) candidateNodes = graphData.nodes;
    const current = focusedNodeRef.current || currentFocusedNode || candidateNodes[0];
    let filtered = candidateNodes.filter((n: any) => n.id !== current.id);

    if (direction === 'right') {
      const r = filtered.filter((n: any) => (n.x ?? 0) > (current.x ?? 0) + 1.0);
      if (r.length > 0) filtered = r;
    } else if (direction === 'left') {
      const l = filtered.filter((n: any) => (n.x ?? 0) < (current.x ?? 0) - 1.0);
      if (l.length > 0) filtered = l;
    } else if (direction === 'up') {
      const u = filtered.filter((n: any) => (n.y ?? 0) > (current.y ?? 0) + 1.0);
      if (u.length > 0) filtered = u;
    } else if (direction === 'down') {
      const d = filtered.filter((n: any) => (n.y ?? 0) < (current.y ?? 0) - 1.0);
      if (d.length > 0) filtered = d;
    }

    filtered.sort((a: any, b: any) => {
      const distA = Math.hypot((a.x ?? 0) - (current.x ?? 0), (a.y ?? 0) - (current.y ?? 0), (a.z ?? 0) - (current.z ?? 0));
      const distB = Math.hypot((b.x ?? 0) - (current.x ?? 0), (b.y ?? 0) - (current.y ?? 0), (b.z ?? 0) - (current.z ?? 0));
      return distA - distB;
    });

    const targetNode = filtered[0];
    if (targetNode) {
      focusOnNode(targetNode, CONFIG.dashDuration);
      setSelectedNode((prev: any) => (prev ? { ...targetNode } : null));
    }
  }, [graphData.nodes, currentFocusedNode, navTypeFilter, focusOnNode]);

  // Ação ao selecionar uma opção de UI via Botão ✕ / A
  const triggerFocusedUiOption = useCallback((index: number) => {
    switch (index) {
      case 0:
        setShowClasses(prev => !prev);
        break;
      case 1:
        setShowIndividuals(prev => !prev);
        break;
      case 2:
        if (searchInputRef.current) searchInputRef.current.focus();
        break;
      case 3:
        resetToRootStart();
        break;
      case 4:
        navigateCyclicStep('back');
        break;
      case 5:
        navigateCyclicStep('forward');
        break;
      case 6:
        toggleCurrentNodeDetails();
        break;
      case 7:
        toggleOrderedLayout();
        break;
      case 8:
        resetCameraView();
        break;
      default:
        break;
    }
  }, [resetToRootStart, navigateCyclicStep, toggleCurrentNodeDetails, toggleOrderedLayout, resetCameraView]);

  // Controles de Teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        navigateCyclicStep('forward');
      } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        e.preventDefault();
        navigateCyclicStep('back');
      } else if (e.key === 'Home' || e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        resetToRootStart();
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        setIsPresentationMode(prev => !prev);
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setShowControlsModal(prev => !prev);
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        toggleCurrentNodeDetails();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (showControlsModal) {
          setShowControlsModal(false);
        } else if (isPresentationMode) {
          setIsPresentationMode(false);
        } else {
          setSelectedNode(null);
          setFocusedUiIndex(null);
        }
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        resetCameraView();
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        toggleOrderedLayout();
      } else if (e.key === '1') {
        setNavTypeFilter(prev => prev === 'class' ? 'all' : 'class');
      } else if (e.key === '2') {
        setNavTypeFilter(prev => prev === 'individual' ? 'all' : 'individual');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateCyclicStep, resetToRootStart, toggleCurrentNodeDetails, resetCameraView, toggleOrderedLayout, isPresentationMode, showControlsModal]);

  // Polling contínuo do Gamepad API (60 FPS)
  useEffect(() => {
    let animationFrameId: number;

    const updateGamepad = () => {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      let activeGp: Gamepad | null = null;

      for (let i = 0; i < gamepads.length; i++) {
        if (gamepads[i]) {
          activeGp = gamepads[i];
          break;
        }
      }

      if (activeGp) {
        const detected = detectGamepadInfo(activeGp);
        setGamepadInfo(prev => {
          if (!prev.connected || prev.name !== detected.name || prev.type !== detected.type) {
            return detected;
          }
          return prev;
        });

        const deadzone = 0.18;
        const nowTime = Date.now();

        // Leitura dos Eixos Analógicos
        const axisLX = activeGp.axes[0] || 0;
        const axisLY = activeGp.axes[1] || 0;
        const axisRX = Math.abs(activeGp.axes[2] || 0) > deadzone ? (activeGp.axes[2] || 0) : 0;
        const rawAxisRY = activeGp.axes[3] !== undefined ? activeGp.axes[3] : (activeGp.axes[5] || 0);
        const axisRY = Math.abs(rawAxisRY) > deadzone ? rawAxisRY : 0;

        // Gatilhos de Zoom (L2/LT = Zoom -, R2/RT = Zoom +)
        const l2Value = activeGp.buttons[6]?.value || (activeGp.buttons[6]?.pressed ? 1.0 : 0);
        const r2Value = activeGp.buttons[7]?.value || (activeGp.buttons[7]?.pressed ? 1.0 : 0);
        const isZooming = l2Value > 0.1 || r2Value > 0.1;

        // 1. CÂMERA 360° com Analógico R + ZOOM contínuo com L2 (-) e R2 (+)
        if ((axisRX !== 0 || axisRY !== 0 || isZooming) && fgRef.current) {
          const targetNode = focusedNodeRef.current;
          const center = targetNode && targetNode.x !== undefined 
            ? { x: targetNode.x, y: targetNode.y, z: targetNode.z } 
            : { x: 0, y: 0, z: 0 };

          orbitStateRef.current.theta += axisRX * 0.045;
          orbitStateRef.current.phi = Math.max(-1.42, Math.min(1.42, orbitStateRef.current.phi - axisRY * 0.045));

          if (l2Value > 0.1) {
            orbitStateRef.current.radius = Math.min(CONFIG.maxZoomDist, orbitStateRef.current.radius + l2Value * 3.2);
          }
          if (r2Value > 0.1) {
            orbitStateRef.current.radius = Math.max(CONFIG.minZoomDist, orbitStateRef.current.radius - r2Value * 3.2);
          }

          const { theta, phi, radius } = orbitStateRef.current;
          const newCamX = center.x + radius * Math.cos(phi) * Math.sin(theta);
          const newCamY = center.y + radius * Math.sin(phi);
          const newCamZ = center.z + radius * Math.cos(phi) * Math.cos(theta);

          fgRef.current.cameraPosition(
            { x: newCamX, y: newCamY, z: newCamZ },
            center,
            0
          );
        }

        // 2. DASH com R1 / RB (Botão 5): Pulo Livre Rápido na direção do L-Stick
        const isR1Pressed = Boolean(activeGp.buttons[5]?.pressed);
        if (isR1Pressed && !r1ButtonPressedRef.current && nowTime - lastNavTimeRef.current > 200) {
          r1ButtonPressedRef.current = true;
          lastNavTimeRef.current = nowTime;

          let dashDir: 'left' | 'right' | 'up' | 'down' | 'next' = 'next';
          if (Math.abs(axisLX) > Math.abs(axisLY)) {
            if (axisLX > 0.3) dashDir = 'right';
            else if (axisLX < -0.3) dashDir = 'left';
          } else {
            if (axisLY > 0.3) dashDir = 'down';
            else if (axisLY < -0.3) dashDir = 'up';
          }
          performFreeDash(dashDir);
        } else if (!isR1Pressed) {
          r1ButtonPressedRef.current = false;
        }

        // 3. NAVEGAÇÃO CÍCLICA com ANALÓGICO L: Caminha item a item seguindo a hierarquia do Protégé
        const lMag = Math.hypot(axisLX, axisLY);
        if (lMag > 0.55 && nowTime - lastNavTimeRef.current > 280) {
          lastNavTimeRef.current = nowTime;

          if (Math.abs(axisLX) > Math.abs(axisLY)) {
            if (axisLX > 0.5) navigateCyclicStep('forward');
            else if (axisLX < -0.5) navigateCyclicStep('back');
          } else {
            if (axisLY > 0.5) navigateCyclicStep('forward');
            else if (axisLY < -0.5) navigateCyclicStep('back');
          }
        }

        // 4. BOTÃO L3 (Botão 10 - Clique do Analógico Esquerdo): Reiniciar e ir para o Início da Ontologia
        const isL3Pressed = Boolean(activeGp.buttons[10]?.pressed);
        if (isL3Pressed && !l3ButtonPressedRef.current) {
          l3ButtonPressedRef.current = true;
          resetToRootStart();
        } else if (!isL3Pressed) {
          l3ButtonPressedRef.current = false;
        }

        // 5. BOTÃO R3 (Botão 11 - Clique do Analógico Direito): Toggle Diagramação em Caixas 3D
        const isR3Pressed = Boolean(activeGp.buttons[11]?.pressed);
        if (isR3Pressed && !r3ButtonPressedRef.current) {
          r3ButtonPressedRef.current = true;
          toggleOrderedLayout();
        } else if (!isR3Pressed) {
          r3ButtonPressedRef.current = false;
        }

        // 6. BOTÃO SELECT / SHARE / BACK (Botão 8): Toggle Modo de Apresentação (Oculta toda a UI)
        const isSelectPressed = Boolean(activeGp.buttons[8]?.pressed);
        if (isSelectPressed && !selectButtonPressedRef.current) {
          selectButtonPressedRef.current = true;
          setIsPresentationMode(prev => !prev);
        } else if (!isSelectPressed) {
          selectButtonPressedRef.current = false;
        }

        // 7. BOTÃO □ / Quadrado / X (Botão 2): Toggle Modo "Apenas Classes" (Azuis)
        const isSquarePressed = Boolean(activeGp.buttons[2]?.pressed);
        if (isSquarePressed && !squareButtonPressedRef.current) {
          squareButtonPressedRef.current = true;
          setNavTypeFilter(prev => prev === 'class' ? 'all' : 'class');
        } else if (!isSquarePressed) {
          squareButtonPressedRef.current = false;
        }

        // 8. BOTÃO △ / Triângulo / Y (Botão 3): Toggle Modo "Apenas Entidades" (Amarelas)
        const isTrianglePressed = Boolean(activeGp.buttons[3]?.pressed);
        if (isTrianglePressed && !triangleButtonPressedRef.current) {
          triangleButtonPressedRef.current = true;
          setNavTypeFilter(prev => prev === 'individual' ? 'all' : 'individual');
        } else if (!isTrianglePressed) {
          triangleButtonPressedRef.current = false;
        }

        // 9. D-PAD (Setinhas): Navegar entre opções da interface
        if (nowTime - lastDpadTimeRef.current > 220) {
          const dpadUp = activeGp.buttons[12]?.pressed;
          const dpadDown = activeGp.buttons[13]?.pressed;
          const dpadLeft = activeGp.buttons[14]?.pressed;
          const dpadRight = activeGp.buttons[15]?.pressed;

          if (dpadRight || dpadDown) {
            lastDpadTimeRef.current = nowTime;
            setFocusedUiIndex(prev => (prev === null ? 4 : (prev + 1) % 9));
          } else if (dpadLeft || dpadUp) {
            lastDpadTimeRef.current = nowTime;
            setFocusedUiIndex(prev => (prev === null ? 8 : (prev - 1 + 9) % 9));
          }
        }

        // 10. BOTÃO ✕ / Cruz (Botão 0): Selecionador
        const isCrossPressed = Boolean(activeGp.buttons[0]?.pressed);
        if (isCrossPressed && !crossButtonPressedRef.current) {
          crossButtonPressedRef.current = true;
          if (focusedUiIndex !== null) {
            triggerFocusedUiOption(focusedUiIndex);
          } else {
            toggleCurrentNodeDetails();
          }
        } else if (!isCrossPressed) {
          crossButtonPressedRef.current = false;
        }

        // 11. BOTÃO ◯ / Círculo / B (Botão 1): Voltar / Desmarcar
        const isCirclePressed = Boolean(activeGp.buttons[1]?.pressed);
        if (isCirclePressed && !circleButtonPressedRef.current) {
          circleButtonPressedRef.current = true;
          if (showControlsModal) {
            setShowControlsModal(false);
          } else if (isPresentationMode) {
            setIsPresentationMode(false);
          } else if (focusedUiIndex !== null) {
            setFocusedUiIndex(null);
          } else if (selectedNode) {
            setSelectedNode(null);
          }
        } else if (!isCirclePressed) {
          circleButtonPressedRef.current = false;
        }
      } else {
        setGamepadInfo(prev => prev.connected ? { connected: false, name: 'Desconectado', type: 'none' } : prev);
      }

      animationFrameId = requestAnimationFrame(updateGamepad);
    };

    animationFrameId = requestAnimationFrame(updateGamepad);
    return () => cancelAnimationFrame(animationFrameId);
  }, [navigateCyclicStep, performFreeDash, resetToRootStart, toggleCurrentNodeDetails, triggerFocusedUiOption, toggleOrderedLayout, focusedUiIndex, selectedNode, isPresentationMode, showControlsModal]);

  // Carga de dados da Ontologia (Live WebSocket ou Arquivo Padrão)
  const applyOntologyData = useCallback((data: any) => {
    if (!data || !data.nodes || !data.links) return;

    const classes = data.nodes.filter((n: any) => n.group === 'class').length;
    const individuals = data.nodes.filter((n: any) => n.group === 'individual').length;

    setStats({
      nodes: data.nodes.length,
      links: data.links.length,
      classes: classes || data.nodes.length,
      individuals: individuals
    });
    setGraphData(data);

    // Início fiel no Primeiro Conceito da Árvore
    if (data.nodes.length > 0) {
      const orderedFlow = buildProtegeHierarchyFlow(data.nodes, data.links);
      const firstNode = orderedFlow.length > 0 ? orderedFlow[0].node : data.nodes[0];
      setTimeout(() => {
        focusOnNode(firstNode, 1000);
      }, 600);
    }
  }, [focusOnNode]);

  // Conexão WebSocket com o Servidor / Plugin do Protégé & Fallback para GitHub Pages
  useEffect(() => {
    // 1. Tenta carregar a ontologia padrão imediatamente para exibição instantânea
    fetch('./default-ontology.json')
      .then(res => res.json())
      .then(defaultData => {
        applyOntologyData(defaultData);
        setStatus(prev => (prev === 'Desconectado' ? 'Demonstração (BioHack.owl)' : prev));
      })
      .catch(err => {
        console.warn('Ontologia padrão não carregada via fetch:', err);
      });

    // 2. Conexão WebSocket em tempo real com o servidor Java local (se disponível)
    let socket: WebSocket | null = null;
    try {
      socket = new WebSocket('ws://localhost:8080');
      socketRef.current = socket;

      socket.onopen = () => setStatus('Conectado ao Protégé');

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Novo comentário colaborativo via streaming
          if (data.type === 'comment_added') {
            const newComment = {
              author: data.author || 'Anônimo',
              text: data.text || '',
              timestamp: data.timestamp || ''
            };

            setGraphData((prevData: any) => {
              if (!prevData || !prevData.nodes) return prevData;
              const updatedNodes = prevData.nodes.map((node: any) => {
                if (node.id === data.nodeId) {
                  return {
                    ...node,
                    collaborativeComments: [...(node.collaborativeComments || []), newComment]
                  };
                }
                return node;
              });
              return { ...prevData, nodes: updatedNodes };
            });

            setSelectedNode((prevSelected: any) => {
              if (prevSelected && prevSelected.id === data.nodeId) {
                return {
                  ...prevSelected,
                  collaborativeComments: [...(prevSelected.collaborativeComments || []), newComment]
                };
              }
              return prevSelected;
            });
            return;
          }

          // Carga da ontologia ativa do Protégé
          if (data.nodes && data.links) {
            applyOntologyData(data);
          }
        } catch (e) {
          console.error('Erro no processamento do WebSocket:', e);
        }
      };

      socket.onclose = () => {
        setStatus(prev => (prev === 'Conectado ao Protégé' ? 'Demonstração (BioHack.owl)' : prev));
      };

      socket.onerror = () => {
        setStatus(prev => (prev === 'Conectado ao Protégé' ? 'Demonstração (BioHack.owl)' : prev));
      };
    } catch {
      setStatus('Demonstração (BioHack.owl)');
    }

    return () => {
      if (socket) {
        socket.close();
      }
      socketRef.current = null;
    };
  }, [applyOntologyData]);

  // Pesquisa de Nós
  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return;

      const matchedNode = graphData.nodes.find((n: any) =>
        n.name && n.name.toLowerCase().includes(query)
      );

      if (matchedNode) {
        if (matchedNode.group === 'class' && !showClasses) setShowClasses(true);
        if (matchedNode.group === 'individual' && !showIndividuals) setShowIndividuals(true);

        setSelectedNode({ ...matchedNode });
        focusOnNode(matchedNode, 1000);
      }
    }
  };

  // Envio de Comentário (com suporte a fallback offline / GitHub Pages)
  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commentText.trim() || !selectedNode) return;

    const now = new Date();
    const timeFormatted = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const currentAuthor = authorName.trim() || 'Anônimo';

    try {
      localStorage.setItem('ontoxr_author', currentAuthor);
    } catch {}

    const payload = {
      action: 'add_comment',
      nodeId: selectedNode.id,
      author: currentAuthor,
      text: commentText.trim(),
      timestamp: timeFormatted
    };

    const newComment = {
      author: currentAuthor,
      text: commentText.trim(),
      timestamp: timeFormatted
    };

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(payload));
    } else {
      // Suporte local quando rodando em modo Demonstração / GitHub Pages
      setGraphData((prevData: any) => {
        if (!prevData || !prevData.nodes) return prevData;
        const updatedNodes = prevData.nodes.map((node: any) => {
          if (node.id === selectedNode.id) {
            return {
              ...node,
              collaborativeComments: [...(node.collaborativeComments || []), newComment]
            };
          }
          return node;
        });
        return { ...prevData, nodes: updatedNodes };
      });

      setSelectedNode((prevSelected: any) => {
        if (prevSelected && prevSelected.id === selectedNode.id) {
          return {
            ...prevSelected,
            collaborativeComments: [...(prevSelected.collaborativeComments || []), newComment]
          };
        }
        return prevSelected;
      });
    }

    setCommentText('');
  };


  // Renderização 3D: Caixas 3D no modo R3 e Esferas no modo normal
  const nodeThreeObject = useCallback((node: any) => {
    const isClass = node.group === 'class';
    const isIndividual = node.group === 'individual';
    const isFocused = (focusedNodeRef.current && focusedNodeRef.current.id === node.id) || (selectedNode && selectedNode.id === node.id);

    if (isOrderedLayout) {
      // 📦 MODO R3: Caixa 3D Elegante com Nome e Borda Colorida
      const group = new THREE.Group();
      const cardWidth = 24.0;
      const cardHeight = 6.4;
      const cardDepth = 1.0;

      // Caixa 3D base
      const boxGeo = new THREE.BoxGeometry(cardWidth, cardHeight, cardDepth);
      const boxMat = new THREE.MeshBasicMaterial({
        color: isClass ? (isFocused ? 0x1e3a8a : 0x0f172a) : (isFocused ? 0x78350f : 0x1c1917),
        transparent: true,
        opacity: isFocused ? 1.0 : (navTypeFilter === 'all' ? 0.92 : (node.group === navTypeFilter ? 0.95 : 0.25))
      });
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      group.add(boxMesh);

      // Face frontal com Textura Canvas em Alta Resolução
      const texture = getCardCanvasTexture(node.name || node.id, isClass, isFocused);
      const frontGeo = new THREE.PlaneGeometry(cardWidth, cardHeight);
      const frontMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
      });
      const frontMesh = new THREE.Mesh(frontGeo, frontMat);
      frontMesh.position.z = cardDepth / 2 + 0.05;
      group.add(frontMesh);

      // Halo Luminoso para Nó Focado
      if (isFocused) {
        const glowGeo = new THREE.PlaneGeometry(cardWidth + 2.4, cardHeight + 2.4);
        const glowMat = new THREE.MeshBasicMaterial({
          color: isClass ? 0x00f2fe : 0xfbbf24,
          transparent: true,
          opacity: 0.55,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const glowMesh = new THREE.Mesh(glowGeo, glowMat);
        glowMesh.position.z = cardDepth / 2 + 0.02;
        group.add(glowMesh);
      }

      return group;
    } else {
      // 🌐 MODO NORMAL: Grafo Esférico 3D Fluido
      const group = new THREE.Group();
      const radius = isIndividual ? 5.0 : 6.8;
      const color = isIndividual ? 0xf59e0b : 0x38bdf8;

      const sphereGeo = new THREE.SphereGeometry(radius, 20, 20);
      const sphereMat = new THREE.MeshBasicMaterial({
        color: color,
        transparent: !isFocused,
        opacity: isFocused ? 1.0 : (navTypeFilter === 'all' ? 0.7 : (node.group === navTypeFilter ? 0.9 : 0.2))
      });
      const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
      group.add(sphereMesh);

      if (isFocused) {
        const auraGeo = new THREE.SphereGeometry(radius * 1.6, 16, 16);
        const auraMat = new THREE.MeshBasicMaterial({
          color: isIndividual ? 0xfbbf24 : 0x00f2fe,
          transparent: true,
          opacity: 0.6,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const auraMesh = new THREE.Mesh(auraGeo, auraMat);
        group.add(auraMesh);
      }

      return group;
    }
  }, [isOrderedLayout, selectedNode, navTypeFilter]);

  // Visibilidade de Nós
  const isNodeVisible = useCallback((node: any) => {
    if (!node) return false;
    if (node.group === 'class') return showClasses;
    if (node.group === 'individual') return showIndividuals;
    return true;
  }, [showClasses, showIndividuals]);

  // Visibilidade de Links: No modo R3 mostra APENAS conexões diretas da árvore para linhas retas limpas
  const isLinkVisible = useCallback((link: any) => {
    if (!link) return false;
    const source = typeof link.source === 'object' ? link.source : graphData.nodes.find((n: any) => n.id === link.source);
    const target = typeof link.target === 'object' ? link.target : graphData.nodes.find((n: any) => n.id === link.target);
    if (!source || !target) return false;

    if (isOrderedLayout) {
      const isHierarchy = link.relation === 'subClassOf' || link.relation === 'instância_de';
      return isHierarchy && isNodeVisible(source) && isNodeVisible(target);
    }

    return isNodeVisible(source) && isNodeVisible(target);
  }, [graphData.nodes, isNodeVisible, isOrderedLayout]);

  // Estilo auxiliar para destaque do D-Pad nas opções da UI
  const getUiFocusStyle = (index: number) => {
    if (focusedUiIndex === index) {
      return {
        boxShadow: '0 0 0 2px #38bdf8, 0 0 14px rgba(56, 189, 248, 0.7)',
        borderColor: '#38bdf8',
        transform: 'scale(1.04)',
        transition: 'all 0.15s ease'
      };
    }
    return {};
  };

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, backgroundColor: '#080e1a', overflow: 'hidden', position: 'relative' }}>
      
      {/* Mira Central Discreta (oculta no modo de apresentação) */}
      {!isPresentationMode && (
        <div 
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '20px',
            height: '20px'
          }} 
        >
          <div style={{ width: '5px', height: '5px', backgroundColor: '#38bdf8', borderRadius: '50%', border: '1px solid #0f172a' }} />
        </div>
      )}

      {/* Indicador Minimalista do Modo de Apresentação */}
      {isPresentationMode && (
        <div
          onClick={() => setIsPresentationMode(false)}
          title="Clique ou pressione Select / Tecla P para sair do modo apresentação"
          style={{
            position: 'absolute',
            top: 16,
            right: 20,
            zIndex: 40,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(56, 189, 248, 0.4)',
            color: '#94a3b8',
            padding: '6px 14px',
            borderRadius: '20px',
            fontSize: '0.74em',
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          <span style={{ color: '#38bdf8' }}>🎬 Modo Apresentação</span>
          <span style={{ fontSize: '0.9em', color: '#64748b' }}>[Select / P para sair]</span>
        </div>
      )}

      {/* Painel de Status & Filtros (Canto Superior Esquerdo - Oculto no Modo Apresentação) */}
      {!isPresentationMode && (
        <div 
          style={{ 
            position: 'absolute', 
            top: 20, 
            left: 20, 
            zIndex: 20, 
            backgroundColor: 'rgba(15, 23, 42, 0.94)', 
            backdropFilter: 'blur(10px)',
            padding: '16px 20px', 
            color: '#f8fafc', 
            borderRadius: '12px', 
            fontFamily: "'Segoe UI', Roboto, sans-serif", 
            border: '1px solid #334155',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            width: '320px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05em', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🌐 OntoXR</span>
              <span style={{ fontSize: '0.75em', color: '#94a3b8', fontWeight: 400 }}>Protégé Live</span>
            </h3>
            <span 
              style={{ 
                fontSize: '0.74em', 
                padding: '3px 8px', 
                borderRadius: '4px', 
                backgroundColor: status.includes('Conectado') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: status.includes('Conectado') ? '#34d399' : '#ef4444',
                border: `1px solid ${status.includes('Conectado') ? '#10b981' : '#ef4444'}`,
                fontWeight: 600
              }}
            >
              {status}
            </span>
          </div>

          <p style={{ margin: '0 0 10px 0', fontSize: '0.82em', color: '#94a3b8' }}>
            Total de Nós: <strong>{stats.nodes}</strong> | Relações: <strong>{stats.links}</strong>
          </p>
          
          {/* Barra de Pesquisa (Opção UI 2) */}
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
            placeholder="Pesquisar conceito (Enter)..."
            style={{
              width: '100%',
              boxSizing: 'border-box',
              padding: '8px 12px',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid #475569',
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '0.82em',
              outline: 'none',
              marginBottom: '10px',
              ...getUiFocusStyle(2)
            }}
          />

          {/* Filtros de Classes e Indivíduos (Opções UI 0 e 1) */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={() => setShowClasses(!showClasses)}
              style={{
                flex: 1,
                padding: '6px 8px',
                backgroundColor: showClasses ? '#1e3a8a' : '#1e293b',
                color: showClasses ? '#93c5fd' : '#64748b',
                border: `1px solid ${showClasses ? '#3b82f6' : '#334155'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.78em',
                fontWeight: 600,
                ...getUiFocusStyle(0)
              }}
            >
              ● Classes: {stats.classes}
            </button>
            <button
              onClick={() => setShowIndividuals(!showIndividuals)}
              style={{
                flex: 1,
                padding: '6px 8px',
                backgroundColor: showIndividuals ? '#78350f' : '#1e293b',
                color: showIndividuals ? '#fde68a' : '#64748b',
                border: `1px solid ${showIndividuals ? '#d97706' : '#334155'}`,
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.78em',
                fontWeight: 600,
                ...getUiFocusStyle(1)
              }}
            >
              ● Entidades: {stats.individuals}
            </button>
          </div>

          {/* Indicadores Interativos de Modo Ativo */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <button 
              onClick={() => setNavTypeFilter(prev => prev === 'class' ? 'all' : 'class')}
              title="Filtrar apenas classes"
              style={{
                flex: 1,
                padding: '5px 4px',
                borderRadius: '6px',
                fontSize: '0.72em',
                textAlign: 'center',
                backgroundColor: navTypeFilter === 'class' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(30, 41, 59, 0.6)',
                border: navTypeFilter === 'class' ? '1px solid #38bdf8' : '1px solid #475569',
                color: navTypeFilter === 'class' ? '#38bdf8' : '#94a3b8',
                fontWeight: navTypeFilter === 'class' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              □ Classes: {navTypeFilter === 'class' ? 'ON' : 'OFF'}
            </button>
            <button 
              onClick={() => setNavTypeFilter(prev => prev === 'individual' ? 'all' : 'individual')}
              title="Filtrar apenas entidades"
              style={{
                flex: 1,
                padding: '5px 4px',
                borderRadius: '6px',
                fontSize: '0.72em',
                textAlign: 'center',
                backgroundColor: navTypeFilter === 'individual' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(30, 41, 59, 0.6)',
                border: navTypeFilter === 'individual' ? '1px solid #f59e0b' : '1px solid #475569',
                color: navTypeFilter === 'individual' ? '#fbbf24' : '#94a3b8',
                fontWeight: navTypeFilter === 'individual' ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              △ Entidades: {navTypeFilter === 'individual' ? 'ON' : 'OFF'}
            </button>
            <button 
              onClick={toggleOrderedLayout}
              title="Alternar modo de diagramação em caixas 3D"
              style={{
                flex: 1,
                padding: '5px 4px',
                borderRadius: '6px',
                fontSize: '0.72em',
                textAlign: 'center',
                backgroundColor: isOrderedLayout ? 'rgba(16, 185, 129, 0.3)' : 'rgba(30, 41, 59, 0.6)',
                border: isOrderedLayout ? '1px solid #10b981' : '1px solid #475569',
                color: isOrderedLayout ? '#34d399' : '#94a3b8',
                fontWeight: isOrderedLayout ? 700 : 500,
                cursor: 'pointer'
              }}
            >
              R3 Caixas: {isOrderedLayout ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Botão Compacto e Limpo para Abrir Abinha de Controles */}
          <button
            onClick={() => setShowControlsModal(prev => !prev)}
            style={{
              width: '100%',
              padding: '7px 10px',
              backgroundColor: showControlsModal ? 'rgba(56, 189, 248, 0.22)' : 'rgba(30, 41, 59, 0.75)',
              border: `1px solid ${showControlsModal ? '#38bdf8' : '#475569'}`,
              borderRadius: '6px',
              color: '#f8fafc',
              fontSize: '0.78em',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              transition: 'all 0.15s ease'
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎮 <strong>Controles ({gamepadInfo.name})</strong>
            </span>
            <span 
              style={{ 
                fontSize: '0.76em', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                backgroundColor: gamepadInfo.connected ? `${getGamepadColor(gamepadInfo.type, true)}25` : 'rgba(100, 116, 139, 0.2)',
                color: getGamepadColor(gamepadInfo.type, gamepadInfo.connected),
                border: `1px solid ${getGamepadColor(gamepadInfo.type, gamepadInfo.connected)}`,
                fontWeight: 600
              }}
            >
              {gamepadInfo.connected ? 'Ativo' : 'Ver Guia'}
            </span>
          </button>
        </div>
      )}

      {/* Abinha / Modal Flutuante de Controles */}
      {!isPresentationMode && showControlsModal && (
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 360,
            zIndex: 25,
            backgroundColor: 'rgba(15, 23, 42, 0.96)',
            backdropFilter: 'blur(12px)',
            padding: '16px 18px',
            color: '#f8fafc',
            borderRadius: '12px',
            fontFamily: "'Segoe UI', Roboto, sans-serif",
            border: `1px solid ${controlsTab === 'ps4' ? '#38bdf8' : '#10b981'}`,
            boxShadow: '0 10px 30px rgba(0,0,0,0.6)',
            width: '320px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ fontWeight: 700, fontSize: '0.92em', color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              🎮 Guia de Controles
            </span>
            <button
              onClick={() => setShowControlsModal(false)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.1em', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>

          {/* Abas Alternáveis PS4 / Xbox */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
            <button
              onClick={() => setControlsTab('ps4')}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '4px',
                border: `1px solid ${controlsTab === 'ps4' ? '#38bdf8' : '#334155'}`,
                backgroundColor: controlsTab === 'ps4' ? 'rgba(56, 189, 248, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                color: controlsTab === 'ps4' ? '#38bdf8' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.74em',
                cursor: 'pointer'
              }}
            >
              PlayStation
            </button>
            <button
              onClick={() => setControlsTab('xbox')}
              style={{
                flex: 1,
                padding: '4px 6px',
                borderRadius: '4px',
                border: `1px solid ${controlsTab === 'xbox' ? '#10b981' : '#334155'}`,
                backgroundColor: controlsTab === 'xbox' ? 'rgba(16, 185, 129, 0.25)' : 'rgba(30, 41, 59, 0.6)',
                color: controlsTab === 'xbox' ? '#34d399' : '#94a3b8',
                fontWeight: 600,
                fontSize: '0.74em',
                cursor: 'pointer'
              }}
            >
              Xbox
            </button>
          </div>

          {/* Imagem do Controle Selecionado */}
          <div style={{ textAlign: 'center', marginBottom: '12px', backgroundColor: 'rgba(2, 6, 23, 0.6)', padding: '8px', borderRadius: '8px', border: '1px solid #1e293b' }}>
            {controlsTab === 'ps4' ? (
              <img 
                src="/ps4-controller.png" 
                alt="Controle PS4" 
                style={{ width: '120px', height: 'auto', display: 'block', margin: '0 auto' }} 
              />
            ) : (
              <img 
                src="/xbox-controller.png" 
                alt="Controle Xbox" 
                style={{ width: '120px', height: 'auto', display: 'block', margin: '0 auto' }} 
              />
            )}
            <div style={{ fontSize: '0.74em', color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399', fontWeight: 600, marginTop: '4px' }}>
              ● {controlsTab === 'ps4' ? 'Controle PlayStation (DualShock / DualSense)' : 'Controle Xbox / Wireless'}
            </div>
          </div>

          {/* Mapeamento Detalhado */}
          <div style={{ color: '#cbd5e1', fontSize: '0.76em', lineHeight: '1.5' }}>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>{controlsTab === 'ps4' ? 'Share' : 'View / Back'}:</strong> 🎬 Modo Apresentação</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>L3 (Stick Esq.):</strong> ⏮ Início da Ontologia</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>Analógico L:</strong> Fluxo Cíclico Sequencial</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>{controlsTab === 'ps4' ? 'R1' : 'RB'}:</strong> Dash Livre (Pulo Rápido)</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>Analógico R:</strong> Câmera 360° Tridimensional</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>R3 (Stick Dir.):</strong> Modo Caixas 3D</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>{controlsTab === 'ps4' ? 'L2 / R2' : 'LT / RT'}:</strong> Zoom - / Zoom +</div>
            <div style={{ marginBottom: '4px' }}>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>{controlsTab === 'ps4' ? '□ / △' : 'X / Y'}:</strong> Filtro Classes / Entidades</div>
            <div>• <strong style={{ color: controlsTab === 'ps4' ? '#38bdf8' : '#34d399' }}>{controlsTab === 'ps4' ? '✕ / ◯' : 'A / B'}:</strong> Selecionar / Voltar</div>
          </div>
        </div>
      )}

      {/* Painel Lateral de Detalhes do Elemento Selecionado (Permitido ao clicar no elemento) */}
      {selectedNode && (
        <div 
          style={{ 
            position: 'absolute', 
            top: 20, 
            right: 20, 
            zIndex: 30, 
            backgroundColor: 'rgba(15, 23, 42, 0.95)', 
            backdropFilter: 'blur(12px)',
            padding: '18px 20px', 
            color: '#f8fafc', 
            borderRadius: '12px', 
            fontFamily: "'Segoe UI', Roboto, sans-serif", 
            border: '1px solid #334155',
            boxShadow: '0 10px 28px rgba(0,0,0,0.55)',
            width: '330px',
            maxHeight: 'calc(100vh - 40px)',
            overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.74em', textTransform: 'uppercase', color: selectedNode.group === 'class' ? '#38bdf8' : '#f59e0b', fontWeight: 700, letterSpacing: '0.5px' }}>
              {selectedNode.group === 'class' ? '🔷 Classe Ontológica' : '🔶 Entidade / Instância'}
            </span>
            <button 
              onClick={() => setSelectedNode(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2em', fontWeight: 'bold' }}
            >
              ✕
            </button>
          </div>

          <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25em', color: '#ffffff', wordBreak: 'break-word' }}>
            {selectedNode.name || selectedNode.id}
          </h3>

          <p style={{ margin: '0 0 10px 0', fontSize: '0.82em', color: '#94a3b8', lineHeight: '1.4' }}>
            {selectedNode.comment || 'Sem anotação de descrição explícita na ontologia.'}
          </p>

          <p style={{ margin: '0 0 12px 0', fontSize: '0.74em', color: '#64748b', wordBreak: 'break-all' }}>
            <strong>URI:</strong> {selectedNode.id}
          </p>

          {/* Data Properties */}
          {selectedNode.dataProperties && Object.keys(selectedNode.dataProperties).length > 0 && (
            <div style={{ marginBottom: '14px', backgroundColor: 'rgba(30, 41, 59, 0.6)', padding: '10px', borderRadius: '6px', border: '1px solid #334155' }}>
              <div style={{ fontSize: '0.78em', color: '#38bdf8', fontWeight: 700, marginBottom: '6px' }}>Data Properties:</div>
              {Object.entries(selectedNode.dataProperties).map(([prop, val]) => (
                <div key={prop} style={{ fontSize: '0.76em', color: '#cbd5e1', marginBottom: '4px' }}>
                  <strong style={{ color: '#94a3b8' }}>{prop}:</strong> {String(val)}
                </div>
              ))}
            </div>
          )}

          {/* Comentários Colaborativos */}
          <div style={{ borderTop: '1px solid #334155', paddingTop: '12px' }}>
            <div style={{ fontSize: '0.82em', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              💬 Comentários ({selectedNode.collaborativeComments ? selectedNode.collaborativeComments.length : 0})
            </div>

            <div style={{ maxHeight: '130px', overflowY: 'auto', marginBottom: '10px' }}>
              {selectedNode.collaborativeComments && selectedNode.collaborativeComments.length > 0 ? (
                selectedNode.collaborativeComments.map((c: any, i: number) => (
                  <div key={i} style={{ backgroundColor: 'rgba(30, 41, 59, 0.5)', padding: '6px 8px', borderRadius: '4px', marginBottom: '6px', fontSize: '0.75em' }}>
                    <strong style={{ color: '#38bdf8' }}>{c.author}</strong> <span style={{ color: '#64748b' }}>({c.timestamp}):</span>
                    <div style={{ color: '#e2e8f0', marginTop: '2px' }}>{c.text}</div>
                  </div>
                ))
              ) : (
                <div style={{ fontSize: '0.74em', color: '#64748b', fontStyle: 'italic' }}>Nenhum comentário registrado ainda.</div>
              )}
            </div>

            {/* Formulário de Comentário */}
            <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Seu nome..."
                style={{ padding: '6px 10px', backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc', fontSize: '0.76em', outline: 'none' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Escrever nota colaborativa..."
                  style={{ flex: 1, padding: '6px 10px', backgroundColor: 'rgba(30, 41, 59, 0.8)', border: '1px solid #475569', borderRadius: '4px', color: '#f8fafc', fontSize: '0.76em', outline: 'none' }}
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  style={{ padding: '6px 12px', backgroundColor: commentText.trim() ? '#10b981' : '#334155', color: 'white', border: 'none', borderRadius: '4px', cursor: commentText.trim() ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: '0.76em' }}
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grafo 3D ForceGraph */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#080e1a"
          nodeThreeObject={nodeThreeObject}
          nodeLabel="name"
          nodeVisibility={(node: any) => isNodeVisible(node)}
          linkVisibility={(link: any) => isLinkVisible(link)}
          linkLabel={(link: any) => link.label || link.relation || ''}
          linkDirectionalArrowLength={isOrderedLayout ? 4.5 : 4.0}
          linkDirectionalArrowRelPos={1}
          linkCurvature={isOrderedLayout ? 0 : 0.12}
          linkColor={(link: any) => {
            if (isOrderedLayout) {
              return link.relation === 'instância_de' ? 'rgba(245, 158, 11, 0.8)' : 'rgba(56, 189, 248, 0.8)';
            }
            return 'rgba(148, 163, 184, 0.35)';
          }}
          linkWidth={isOrderedLayout ? 1.8 : 1.2}
          linkDirectionalParticles={isOrderedLayout ? 1 : 2}
          linkDirectionalParticleWidth={isOrderedLayout ? 2.5 : 2.0}
          linkDirectionalParticleSpeed={0.005}
          linkDirectionalParticleColor={(link: any) => link.relation === 'instância_de' ? '#f59e0b' : '#38bdf8'}
          width={dimensions.width}
          height={dimensions.height}
          onNodeClick={(node: any) => {
            const currentFresh = graphData.nodes.find((n: any) => n.id === node.id) || node;
            setSelectedNode({ ...currentFresh });
            focusOnNode(node, CONFIG.navDuration);
          }}
        />
      </div>

      {/* Barra de Navegação Rápida (Oculta no Modo Apresentação) */}
      {!isPresentationMode && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            backdropFilter: 'blur(10px)',
            border: '1px solid #334155',
            borderRadius: '30px',
            padding: '6px 14px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
            maxWidth: '94vw',
            overflowX: 'auto'
          }}
        >
          <button
            onClick={resetToRootStart}
            title="Reiniciar no Início da Ontologia (L3 / Tecla I)"
            style={{
              background: 'rgba(56, 189, 248, 0.2)',
              border: '1px solid #38bdf8',
              color: '#38bdf8',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8em',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              ...getUiFocusStyle(3)
            }}
          >
            <span>⏮</span> Início (L3)
          </button>

          <button
            onClick={() => navigateCyclicStep('back')}
            title="Voltar ao Item Anterior no Fluxo (Cíclico)"
            style={{
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid #475569',
              color: '#f8fafc',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8em',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              ...getUiFocusStyle(4)
            }}
          >
            <span>◀</span> Anterior
          </button>

          <button
            onClick={() => navigateCyclicStep('forward')}
            title="Avançar ao Próximo Item no Fluxo (Cíclico)"
            style={{
              background: 'rgba(30, 41, 59, 0.9)',
              border: '1px solid #475569',
              color: '#f8fafc',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8em',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              ...getUiFocusStyle(5)
            }}
          >
            Próximo <span>▶</span>
          </button>

          <button
            onClick={toggleCurrentNodeDetails}
            title="Abrir / Fechar Card de Detalhes"
            style={{
              background: selectedNode ? 'rgba(16, 185, 129, 0.25)' : 'rgba(56, 189, 248, 0.2)',
              border: `1px solid ${selectedNode ? '#10b981' : '#38bdf8'}`,
              color: selectedNode ? '#34d399' : '#38bdf8',
              padding: '6px 14px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8em',
              fontWeight: 700,
              ...getUiFocusStyle(6)
            }}
          >
            {selectedNode ? '✖ Fechar Card' : '📄 Ver Detalhes'}
          </button>

          <button
            onClick={toggleOrderedLayout}
            title="Alternar Modo de Diagramação em Caixas 3D (R3)"
            style={{
              background: isOrderedLayout ? 'rgba(16, 185, 129, 0.3)' : 'rgba(30, 41, 59, 0.9)',
              border: isOrderedLayout ? '1px solid #10b981' : '1px solid #475569',
              color: isOrderedLayout ? '#34d399' : '#f8fafc',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8em',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              ...getUiFocusStyle(7)
            }}
          >
            <span>{isOrderedLayout ? '📦 Caixas 3D Ativas' : '📊 Modo Caixas 3D (R3)'}</span>
          </button>

          <button
            onClick={resetCameraView}
            title="Visão Geral Panorâmica"
            style={{
              background: 'rgba(148, 163, 184, 0.15)',
              border: '1px solid #64748b',
              color: '#cbd5e1',
              padding: '6px 12px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontSize: '0.8em',
              fontWeight: 600,
              ...getUiFocusStyle(8)
            }}
          >
            🌐 Panorâmica
          </button>
        </div>
      )}
      
    </div>
  );
}
