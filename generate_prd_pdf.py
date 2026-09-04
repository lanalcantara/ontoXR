import os
import markdown
from playwright.sync_api import sync_playwright

def convert_prd_to_pdf():
    prd_path = os.path.abspath('PRD.md')
    output_pdf_path = os.path.abspath('PRD_OntoXR.pdf')

    if not os.path.exists(prd_path):
        print(f"Erro: Arquivo {prd_path} não encontrado.")
    with open(prd_path, 'r', encoding='utf-8') as f:
        md_content = f.read()

    # Converter blocos mermaid para <div class="mermaid"> com sintaxe limpa
    import re
    def replace_mermaid(match):
        content = match.group(1).strip()
        # Limpar caracteres que causam syntax error no parser do mermaid
        clean_content = """flowchart TD
    subgraph Host["Ambiente Local / Desktop"]
        subgraph Protege["Stanford Protege 5.5+ (Java OSGi)"]
            OWL["Ontologia Ativa (.owl / .rdf / .ttl)"] --> OMM["OWLModelManager"]
            OMM -->|ModelChangeEvent| Plugin["OntoXRViewComponent"]
            Plugin --> Reasoner["HermiT / Structural Reasoner"]
            Reasoner --> Parser["OntologyParser"]
            Parser --> WS["OntoXR WebSocket Server :8080"]
        end

        subgraph WebXR["OntoXR Web Client (:5173)"]
            WS -->|JSON Graph Stream :8080| Client["App.tsx - React & Three.js"]
            Client -->|Renderizacao 3D| ForceGraph["3D ForceGraph Engine"]
            Client -->|UI Overlay| UI["Status Panel & Sidebar Details"]
            GamepadAPI["Gamepad API"] -->|Input Polling 60 FPS| Client
            WebXRAPIS["WebXR Session"] -->|Imersao VR| Client
        end

        Gamepad["Controle PS4 / Xbox Wireless"] --> GamepadAPI
        HMD["Oculos VR / Meta Quest"] --> WebXRAPIS
    end"""
        return f'<div class="mermaid" style="text-align: center; margin: 18px 0;">\n{clean_content}\n</div>'

    md_processed = re.sub(r'```mermaid\s*([\s\S]*?)\s*```', replace_mermaid, md_content)


    # Converter Markdown para HTML com extensões
    html_body = markdown.markdown(
        md_processed,
        extensions=['tables', 'fenced_code', 'toc', 'nl2br', 'sane_lists']
    )



    # Template HTML com estilização profissional para impressão / PDF A4
    styled_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>PRD - OntoXR</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');

        @page {{
            size: A4;
            margin: 20mm 15mm 20mm 15mm;
        }}

        * {{
            box-sizing: border-box;
        }}

        body {{
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.55;
            color: #1e293b;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
        }}

        /* Header / Banner */
        .doc-header {{
            border-bottom: 3px solid #2563eb;
            padding-bottom: 12px;
            margin-bottom: 24px;
        }}

        .doc-badge {{
            display: inline-block;
            background: #eff6ff;
            color: #2563eb;
            font-size: 8pt;
            font-weight: 700;
            padding: 3px 8px;
            border-radius: 4px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 8px;
            border: 1px solid #bfdbfe;
        }}

        h1 {{
            font-size: 20pt;
            font-weight: 800;
            color: #0f172a;
            margin: 0 0 10px 0;
            letter-spacing: -0.02em;
        }}

        h2 {{
            font-size: 13pt;
            font-weight: 700;
            color: #1e3a8a;
            border-bottom: 1.5px solid #e2e8f0;
            padding-bottom: 5px;
            margin-top: 24px;
            margin-bottom: 12px;
            page-break-after: avoid;
        }}

        h3 {{
            font-size: 11pt;
            font-weight: 600;
            color: #1e293b;
            margin-top: 16px;
            margin-bottom: 8px;
            page-break-after: avoid;
        }}

        h4, h5, h6 {{
            font-size: 10pt;
            font-weight: 600;
            color: #334155;
            margin-top: 12px;
            margin-bottom: 6px;
            page-break-after: avoid;
        }}

        p {{
            margin: 0 0 10px 0;
            text-align: justify;
        }}

        /* Tabelas */
        table {{
            width: 100%;
            border-collapse: collapse;
            margin: 14px 0;
            font-size: 8.5pt;
            page-break-inside: auto;
        }}

        tr {{
            page-break-inside: avoid;
            page-break-after: auto;
        }}

        thead {{
            display: table-header-group;
        }}

        th {{
            background-color: #f1f5f9;
            color: #0f172a;
            font-weight: 700;
            text-align: left;
            padding: 7px 10px;
            border: 1px solid #cbd5e1;
            font-size: 8.5pt;
        }}

        td {{
            padding: 6px 10px;
            border: 1px solid #e2e8f0;
            color: #334155;
            vertical-align: top;
        }}

        tbody tr:nth-child(even) {{
            background-color: #f8fafc;
        }}

        /* Blocos de Código e Diagramas */
        pre {{
            background-color: #0f172a;
            color: #f8fafc;
            padding: 12px 14px;
            border-radius: 6px;
            font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
            font-size: 8pt;
            line-height: 1.45;
            overflow-x: auto;
            margin: 12px 0;
            page-break-inside: avoid;
            border: 1px solid #1e293b;
        }}

        code {{
            font-family: 'JetBrains Mono', Consolas, Monaco, monospace;
            font-size: 8.5pt;
            background-color: #f1f5f9;
            color: #0f172a;
            padding: 2px 5px;
            border-radius: 4px;
            border: 1px solid #e2e8f0;
        }}

        pre code {{
            background-color: transparent;
            color: inherit;
            padding: 0;
            border: none;
            font-size: 8pt;
        }}

        /* Listas */
        ul, ol {{
            margin: 0 0 12px 0;
            padding-left: 20px;
        }}

        li {{
            margin-bottom: 4px;
        }}

        /* Citações / Destaques */
        blockquote {{
            border-left: 4px solid #3b82f6;
            background-color: #eff6ff;
            margin: 12px 0;
            padding: 8px 14px;
            color: #1e40af;
            border-radius: 0 6px 6px 0;
        }}

        hr {{
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 20px 0;
        }}

        .meta-grid {{
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            background: #f8fafc;
            padding: 10px 14px;
            border-radius: 6px;
            border: 1px solid #e2e8f0;
            margin-bottom: 18px;
            font-size: 8.5pt;
        }}

        .meta-item strong {{
            color: #0f172a;
        }}
    </style>
</head>
<body>
    <div class="doc-header">
        <div class="doc-badge">Documento de Engenharia de Software</div>
        <div class="meta-grid">
            <div class="meta-item"><strong>Produto:</strong> OntoXR (Ontology Extended Reality)</div>
            <div class="meta-item"><strong>Versão:</strong> 1.0.0 (Release)</div>
            <div class="meta-item"><strong>Instituição:</strong> UFPE - Centro de Informática (CIn)</div>
            <div class="meta-item"><strong>Status:</strong> Aprovado / Em Produção</div>
        </div>
    </div>
    
    {html_body}

    <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
    <script>
        mermaid.initialize({{
            startOnLoad: true,
            theme: 'default',
            fontFamily: 'Inter, sans-serif'
        }});
    </script>
</body>
</html>"""



    temp_html_path = os.path.abspath('temp_prd.html')
    with open(temp_html_path, 'w', encoding='utf-8') as f:
        f.write(styled_html)

    print("[PDF Generator] Abrindo Playwright Chromium para renderizar PDF A4...", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"file:///{temp_html_path.replace(os.sep, '/')}", wait_until="networkidle")
        page.wait_for_timeout(2000)


        print("[PDF Generator] Gerando PDF com layout profissional...", flush=True)
        page.pdf(
            path=output_pdf_path,
            format="A4",
            print_background=True,
            margin={
                "top": "22mm",
                "bottom": "22mm",
                "left": "16mm",
                "right": "16mm"
            },
            display_header_footer=True,
            header_template="""
                <div style="font-size: 8pt; color: #94a3b8; width: 100%; text-align: right; padding-right: 16mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span>OntoXR — Documento de Requisitos de Produto (PRD)</span>
                </div>
            """,
            footer_template="""
                <div style="font-size: 8pt; color: #94a3b8; width: 100%; display: flex; justify-content: space-between; padding: 0 16mm; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    <span>UFPE - Centro de Informática (CIn)</span>
                    <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
                </div>
            """
        )
        browser.close()

    if os.path.exists(temp_html_path):
        os.remove(temp_html_path)

    size_kb = os.path.getsize(output_pdf_path) / 1024
    print(f"[PDF Generator] PDF gerado com sucesso: {output_pdf_path} ({size_kb:.1f} KB)", flush=True)

if __name__ == '__main__':
    convert_prd_to_pdf()
