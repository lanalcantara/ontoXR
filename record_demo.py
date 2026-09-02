import os
import sys
import time
import io
from playwright.sync_api import sync_playwright
from PIL import Image

def record_ontoxr():
    os.makedirs('docs', exist_ok=True)
    frames = []

    print("[OntoXR Recorder] Iniciando Playwright Chromium...", flush=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                '--enable-webgl',
                '--ignore-gpu-blocklist',
                '--use-gl=angle',
                '--enable-accelerated-2d-canvas'
            ]
        )
        context = browser.new_context(viewport={'width': 1200, 'height': 720})
        page = context.new_page()

        print("[OntoXR Recorder] Navegando para http://localhost:5173...", flush=True)
        page.goto("http://localhost:5173", wait_until="domcontentloaded")
        
        # Espera o Three.js e o WebSocket inicializarem e renderizarem os nós
        print("[OntoXR Recorder] Aguardando renderizacao do grafo 3D...", flush=True)
        time.sleep(3.5)

        def capture(count=1, delay=0.03):
            for _ in range(count):
                img_bytes = page.screenshot()
                img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
                frames.append(img)
                if delay > 0:
                    time.sleep(delay)

        print("[OntoXR Recorder] 1. Capturando estado inicial e dados carregados...", flush=True)
        capture(8, 0.04)

        # 1. Órbita 3D suave com o mouse
        print("[OntoXR Recorder] 2. Orbitando grafo tridimensional...", flush=True)
        page.mouse.move(600, 360)
        page.mouse.down()
        for i in range(24):
            x = 600 + (i * 12)
            y = 360 - int((i % 6) * 4)
            page.mouse.move(x, y)
            capture(1, 0.02)
        page.mouse.up()
        capture(6, 0.04)

        # 2. Navegação cíclica: Foco no nó via botão Próximo
        print("[OntoXR Recorder] 3. Clicando em 'Próximo' para focar no nó...", flush=True)
        next_btn = page.locator('button:has-text("Próximo")')
        if next_btn.count() > 0:
            next_btn.click()
            capture(12, 0.04)

        # 3. Abrir Card de Detalhes
        print("[OntoXR Recorder] 4. Abrindo painel de detalhes do nó...", flush=True)
        details_btn = page.locator('button:has-text("Ver Detalhes")')
        if details_btn.count() > 0:
            details_btn.click()
            capture(14, 0.04)

        # 4. Navegar para próximo item com card aberto
        print("[OntoXR Recorder] 5. Navegando para outro nó com detalhes abertos...", flush=True)
        if next_btn.count() > 0:
            next_btn.click()
            capture(12, 0.04)
            next_btn.click()
            capture(12, 0.04)

        # 5. Alternar para modo Diagrama em Caixas 3D (R3)
        print("[OntoXR Recorder] 6. Alternando para Modo Caixas 3D...", flush=True)
        boxes_btn = page.locator('button:has-text("Modo Caixas 3D")')
        if boxes_btn.count() > 0:
            boxes_btn.click()
            capture(16, 0.04)

        # 6. Panorâmica / Visão Geral
        print("[OntoXR Recorder] 7. Retornando para Panorâmica...", flush=True)
        pano_btn = page.locator('button:has-text("Panorâmica")')
        if pano_btn.count() > 0:
            pano_btn.click()
            capture(10, 0.04)

        browser.close()

    print(f"[OntoXR Recorder] Total de frames capturados: {len(frames)}", flush=True)
    if not frames:
        print("[OntoXR Recorder] Erro: Nenhum frame capturado.", flush=True)
        return

    print("[OntoXR Recorder] Processando e otimizando GIF animado...", flush=True)
    resized_frames = []
    for f in frames:
        # Redimensiona para 900x540
        rf = f.resize((900, 540), Image.Resampling.LANCZOS)
        # Converte para paleta quantizada adaptativa de 128 cores para otimização extrema
        qf = rf.quantize(colors=128, method=Image.Quantize.MEDIANCUT)
        resized_frames.append(qf)

    gif_path = os.path.abspath('docs/demo.gif')
    resized_frames[0].save(
        gif_path,
        save_all=True,
        append_images=resized_frames[1:],
        duration=65, # ~15 fps
        loop=0,
        optimize=True
    )
    file_size_mb = os.path.getsize(gif_path) / (1024 * 1024)
    print(f"[OntoXR Recorder] GIF gerado com sucesso em: {gif_path} ({file_size_mb:.2f} MB)", flush=True)

if __name__ == '__main__':
    record_ontoxr()
