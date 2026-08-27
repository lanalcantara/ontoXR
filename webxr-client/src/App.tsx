import { useEffect, useState, useRef } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';

export default function App() {
  const [status, setStatus] = useState('Desconectado');
  const [stats, setStats] = useState({ nodes: 0, links: 0, classes: 0, individuals: 0 });
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const fgRef = useRef<any>();

  useEffect(() => {
    const handleResize = () => setDimensions({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');
    
    socket.onopen = () => setStatus('Conectado');
    
    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const classes = data.nodes.filter((n: any) => n.group === 'class').length;
        const individuals = data.nodes.filter((n: any) => n.group === 'individual').length;
        
        setStats({ 
          nodes: data.nodes.length, 
          links: data.links.length,
          classes: classes || data.nodes.length, 
          individuals: individuals
        });
        setGraphData(data);
      } catch (e) {
        console.error(e);
      }
    };
    
    socket.onclose = () => setStatus('Desconectado');
    
    return () => socket.close();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (fgRef.current) {
        const renderer = fgRef.current.renderer();
        if (renderer) {
          renderer.xr.enabled = true;
          const vrButton = VRButton.createButton(renderer);
          vrButton.style.zIndex = '100';
          document.body.appendChild(vrButton);
        }
      }
    }, 1000);

    return () => {
      clearTimeout(timer);
      const btn = document.getElementById('VRButton');
      if (btn && btn.parentNode) btn.parentNode.removeChild(btn);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', margin: 0, padding: 0, backgroundColor: '#0f172a', overflow: 'hidden', position: 'relative' }}>
      
      {/* Painel de Status */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.85)', padding: '15px 20px', color: 'white', borderRadius: '8px', fontFamily: 'sans-serif', pointerEvents: 'none', border: '1px solid #334155' }}>
        <h3 style={{ margin: '0 0 10px 0', fontSize: '1.1em' }}>OntoXR Status</h3>
        <p style={{ margin: '0 0 5px 0' }}>Status: <strong style={{ color: status === 'Conectado' ? '#4ade80' : '#ef4444' }}>{status}</strong></p>
        <p style={{ margin: '0 0 5px 0', fontSize: '0.9em', color: '#cbd5e1' }}>Total de Nós: {stats.nodes} | Links: {stats.links}</p>
        <div style={{ display: 'flex', gap: '15px', marginTop: '10px', fontSize: '0.85em' }}>
          <span style={{ color: '#3b82f6' }}>● Classes: {stats.classes}</span>
          <span style={{ color: '#f59e0b' }}>● Entidades: {stats.individuals}</span>
        </div>
      </div>

      {/* Painel de Detalhes do Nó */}
      {selectedNode && (
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, backgroundColor: 'rgba(15, 23, 42, 0.95)', border: `2px solid ${selectedNode.group === 'individual' ? '#f59e0b' : '#3b82f6'}`, padding: '20px', color: 'white', borderRadius: '8px', fontFamily: 'sans-serif', width: '320px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
          <h3 style={{ margin: '0 0 10px 0', color: selectedNode.group === 'individual' ? '#f59e0b' : '#3b82f6', borderBottom: '1px solid #334155', paddingBottom: '8px' }}>
            {selectedNode.group === 'individual' ? 'Entidade / Instância' : 'Classe Ontológica'}
          </h3>
          <p style={{ margin: '0 0 8px 0' }}><strong>Nome:</strong> {selectedNode.name || 'Desconhecido'}</p>
          <p style={{ margin: '0 0 10px 0', color: '#cbd5e1', fontSize: '0.9em' }}>
            <strong>Descrição:</strong> {selectedNode.comment || 'Sem descrição cadastrada.'}
          </p>
          <p style={{ margin: '0 0 15px 0', fontSize: '0.75em', color: '#64748b', wordBreak: 'break-all' }}>
            <strong>URI:</strong> {selectedNode.id}
          </p>
          
          <button 
            onClick={() => setSelectedNode(null)}
            style={{ width: '100%', padding: '10px', backgroundColor: '#334155', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            Fechar
          </button>
        </div>
      )}

      {/* Grafo 3D */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
        <ForceGraph3D
          ref={fgRef}
          graphData={graphData}
          backgroundColor="#0f172a"
          nodeLabel="name"
          nodeColor={(node: any) => node.group === 'individual' ? '#f59e0b' : '#3b82f6'}
          linkColor={() => '#94a3b8'}
          width={dimensions.width}
          height={dimensions.height}
          onNodeClick={(node: any) => setSelectedNode(node)}
        />
      </div>
      
    </div>
  );
}
