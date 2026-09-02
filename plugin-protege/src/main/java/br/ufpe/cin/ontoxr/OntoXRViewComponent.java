package br.ufpe.cin.ontoxr;

import org.protege.editor.owl.model.event.OWLModelManagerChangeEvent;
import org.protege.editor.owl.model.event.OWLModelManagerListener;
import org.protege.editor.owl.ui.view.AbstractOWLViewComponent;
import org.semanticweb.owlapi.model.OWLOntology;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.net.URI;

public class OntoXRViewComponent extends AbstractOWLViewComponent {

    private static final long serialVersionUID = 1L;
    private static final String CLIENT_URL = "http://localhost:5173";
    private OntoXRServer server;
    private OWLModelManagerListener modelListener;
    private JLabel statusLabel;
    private JButton openBrowserBtn;
    private JButton resyncBtn;

    @Override
    protected void initialiseOWLView() throws Exception {
        setLayout(new BorderLayout());
        setBackground(new Color(15, 23, 42)); // Dark theme matching OntoXR

        JPanel mainPanel = new JPanel();
        mainPanel.setLayout(new BoxLayout(mainPanel, BoxLayout.Y_AXIS));
        mainPanel.setBackground(new Color(15, 23, 42));
        mainPanel.setBorder(new EmptyBorder(20, 20, 20, 20));

        JLabel titleLabel = new JLabel("🌐 OntoXR - Visualizador 3D de Ontologias");
        titleLabel.setFont(new Font("Segoe UI", Font.BOLD, 16));
        titleLabel.setForeground(new Color(56, 189, 248));
        titleLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        mainPanel.add(titleLabel);

        mainPanel.add(Box.createRigidArea(new Dimension(0, 10)));

        statusLabel = new JLabel("Iniciando servidor WebSocket...", JLabel.CENTER);
        statusLabel.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        statusLabel.setForeground(new Color(148, 163, 184));
        statusLabel.setAlignmentX(Component.CENTER_ALIGNMENT);
        mainPanel.add(statusLabel);

        mainPanel.add(Box.createRigidArea(new Dimension(0, 20)));

        // Botão Principal: Abrir Navegador no OntoXR
        openBrowserBtn = new JButton("🚀 Abrir Visualizador 3D no Navegador");
        openBrowserBtn.setFont(new Font("Segoe UI", Font.BOLD, 14));
        openBrowserBtn.setBackground(new Color(16, 185, 129));
        openBrowserBtn.setForeground(Color.WHITE);
        openBrowserBtn.setFocusPainted(false);
        openBrowserBtn.setCursor(new Cursor(Cursor.HAND_CURSOR));
        openBrowserBtn.setAlignmentX(Component.CENTER_ALIGNMENT);
        openBrowserBtn.setPreferredSize(new Dimension(320, 42));
        openBrowserBtn.setMaximumSize(new Dimension(340, 44));

        openBrowserBtn.addActionListener(e -> {
            broadcastActiveOntology();
            openBrowser(CLIENT_URL);
        });
        mainPanel.add(openBrowserBtn);

        mainPanel.add(Box.createRigidArea(new Dimension(0, 12)));

        // Botão Secundário: Sincronizar Ontologia
        resyncBtn = new JButton("🔄 Reenviar Ontologia Atual");
        resyncBtn.setFont(new Font("Segoe UI", Font.PLAIN, 12));
        resyncBtn.setBackground(new Color(30, 41, 59));
        resyncBtn.setForeground(new Color(203, 213, 225));
        resyncBtn.setFocusPainted(false);
        resyncBtn.setCursor(new Cursor(Cursor.HAND_CURSOR));
        resyncBtn.setAlignmentX(Component.CENTER_ALIGNMENT);
        resyncBtn.setPreferredSize(new Dimension(320, 34));
        resyncBtn.setMaximumSize(new Dimension(340, 36));

        resyncBtn.addActionListener(e -> {
            broadcastActiveOntology();
            JOptionPane.showMessageDialog(this, "Ontologia sincronizada com sucesso com o visualizador!", "OntoXR", JOptionPane.INFORMATION_MESSAGE);
        });
        mainPanel.add(resyncBtn);

        add(mainPanel, BorderLayout.CENTER);

        // Start WebSocket Server on port 8080
        try {
            server = new OntoXRServer(8080);
            server.start();
            statusLabel.setText("● Servidor ativo na porta 8080 (ws://localhost:8080)");
            statusLabel.setForeground(new Color(52, 211, 153));
        } catch (Exception e) {
            statusLabel.setText("Erro ao iniciar servidor WebSocket: " + e.getMessage());
            statusLabel.setForeground(new Color(239, 68, 68));
            e.printStackTrace();
        }

        // Register listener for ontology model changes
        modelListener = new OWLModelManagerListener() {
            @Override
            public void handleChange(OWLModelManagerChangeEvent event) {
                broadcastActiveOntology();
            }
        };
        getOWLModelManager().addListener(modelListener);

        // Broadcast initial ontology data
        broadcastActiveOntology();
    }

    private void broadcastActiveOntology() {
        if (server == null) return;

        OWLOntology ontology = getOWLModelManager().getActiveOntology();
        if (ontology == null) return;

        try {
            String jsonString = OntologyParser.parseToJson(ontology);
            server.broadcastOntology(jsonString);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void openBrowser(String url) {
        try {
            if (Desktop.isDesktopSupported() && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
                Desktop.getDesktop().browse(new URI(url));
                return;
            }
        } catch (Exception ignored) {}

        // Fallback cross-platform
        String os = System.getProperty("os.name", "").toLowerCase();
        Runtime rt = Runtime.getRuntime();
        try {
            if (os.contains("win")) {
                rt.exec(new String[]{"rundll32", "url.dll,FileProtocolHandler", url});
            } else if (os.contains("mac")) {
                rt.exec(new String[]{"open", url});
            } else {
                rt.exec(new String[]{"xdg-open", url});
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    protected void disposeOWLView() {
        if (modelListener != null) {
            getOWLModelManager().removeListener(modelListener);
        }
        if (server != null) {
            try {
                server.stop(1000);
                System.out.println("[OntoXRViewComponent] OntoXR WebSocket server stopped.");
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
