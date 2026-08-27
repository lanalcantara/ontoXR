package br.ufpe.cin.ontoxr;

import org.protege.editor.owl.model.event.OWLModelManagerChangeEvent;
import org.protege.editor.owl.model.event.OWLModelManagerListener;
import org.protege.editor.owl.ui.view.AbstractOWLViewComponent;
import org.semanticweb.owlapi.model.AxiomType;
import org.semanticweb.owlapi.model.OWLAnnotationAssertionAxiom;
import org.semanticweb.owlapi.model.OWLClass;
import org.semanticweb.owlapi.model.OWLClassAssertionAxiom;
import org.semanticweb.owlapi.model.OWLLiteral;
import org.semanticweb.owlapi.model.OWLNamedIndividual;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.model.OWLSubClassOfAxiom;

import javax.swing.*;
import java.awt.*;

public class OntoXRViewComponent extends AbstractOWLViewComponent {

    private static final long serialVersionUID = 1L;
    private OntoXRServer server;
    private OWLModelManagerListener modelListener;
    private JLabel statusLabel;

    @Override
    protected void initialiseOWLView() throws Exception {
        setLayout(new BorderLayout());
        statusLabel = new JLabel("OntoXR Server initializing...", JLabel.CENTER);
        statusLabel.setFont(new Font("SansSerif", Font.BOLD, 14));
        add(statusLabel, BorderLayout.CENTER);

        // Start WebSocket Server on port 8080
        try {
            server = new OntoXRServer(8080);
            server.start();
            statusLabel.setText("<html><center><h2>OntoXR 3D WebXR View</h2><p>WebSocket Server running on <b>ws://localhost:8080</b></p></center></html>");
        } catch (Exception e) {
            statusLabel.setText("Error starting WebSocket server: " + e.getMessage());
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

        StringBuilder sb = new StringBuilder();
        sb.append("{\"nodes\":[");

        boolean firstNode = true;

        // 1. Extract OWL Classes as nodes (group: "class")
        for (OWLClass cls : ontology.getClassesInSignature()) {
            if (!firstNode) {
                sb.append(",");
            }
            firstNode = false;

            String iri = cls.getIRI().toString();
            String name = cls.getIRI().getShortForm();
            if (name == null || name.isEmpty()) {
                name = iri;
            }

            String comment = "Sem descrição disponível";

            for (OWLAnnotationAssertionAxiom axiom : ontology.getAnnotationAssertionAxioms(cls.getIRI())) {
                if (axiom.getProperty().isComment() && axiom.getValue() instanceof OWLLiteral) {
                    OWLLiteral val = (OWLLiteral) axiom.getValue();
                    if (val.getLiteral() != null && !val.getLiteral().trim().isEmpty()) {
                        comment = val.getLiteral().trim();
                    }
                } else if (axiom.getProperty().isLabel() && axiom.getValue() instanceof OWLLiteral) {
                    OWLLiteral val = (OWLLiteral) axiom.getValue();
                    if (val.getLiteral() != null && !val.getLiteral().trim().isEmpty()) {
                        name = val.getLiteral().trim();
                    }
                }
            }

            sb.append("{\"id\":\"").append(escapeJson(iri))
              .append("\",\"name\":\"").append(escapeJson(name))
              .append("\",\"group\":\"class")
              .append("\",\"comment\":\"").append(escapeJson(comment))
              .append("\"}");
        }

        // 2. Extract OWLNamedIndividual as nodes (group: "individual")
        for (OWLNamedIndividual ind : ontology.getIndividualsInSignature()) {
            if (!firstNode) {
                sb.append(",");
            }
            firstNode = false;

            String iri = ind.getIRI().toString();
            String name = ind.getIRI().getShortForm();
            if (name == null || name.isEmpty()) {
                name = iri;
            }

            String comment = "Sem descrição disponível";

            for (OWLAnnotationAssertionAxiom axiom : ontology.getAnnotationAssertionAxioms(ind.getIRI())) {
                if (axiom.getProperty().isComment() && axiom.getValue() instanceof OWLLiteral) {
                    OWLLiteral val = (OWLLiteral) axiom.getValue();
                    if (val.getLiteral() != null && !val.getLiteral().trim().isEmpty()) {
                        comment = val.getLiteral().trim();
                    }
                } else if (axiom.getProperty().isLabel() && axiom.getValue() instanceof OWLLiteral) {
                    OWLLiteral val = (OWLLiteral) axiom.getValue();
                    if (val.getLiteral() != null && !val.getLiteral().trim().isEmpty()) {
                        name = val.getLiteral().trim();
                    }
                }
            }

            sb.append("{\"id\":\"").append(escapeJson(iri))
              .append("\",\"name\":\"").append(escapeJson(name))
              .append("\",\"group\":\"individual")
              .append("\",\"comment\":\"").append(escapeJson(comment))
              .append("\"}");
        }

        sb.append("],\"links\":[");

        boolean firstLink = true;

        // 3. Extract OWL SubClassOf Axioms as links
        for (OWLSubClassOfAxiom axiom : ontology.getAxioms(AxiomType.SUBCLASS_OF)) {
            if (!axiom.getSubClass().isAnonymous() && !axiom.getSuperClass().isAnonymous()) {
                if (!firstLink) {
                    sb.append(",");
                }
                firstLink = false;

                String subIri = axiom.getSubClass().asOWLClass().getIRI().toString();
                String superIri = axiom.getSuperClass().asOWLClass().getIRI().toString();

                sb.append("{\"source\":\"").append(escapeJson(subIri))
                  .append("\",\"target\":\"").append(escapeJson(superIri))
                  .append("\",\"relation\":\"subClassOf\"}");
            }
        }

        // 4. Extract OWL ClassAssertion Axioms as links (individual -> class, relation: "instância_de")
        for (OWLClassAssertionAxiom axiom : ontology.getAxioms(AxiomType.CLASS_ASSERTION)) {
            if (!axiom.getIndividual().isAnonymous() && !axiom.getClassExpression().isAnonymous()) {
                if (!firstLink) {
                    sb.append(",");
                }
                firstLink = false;

                String indIri = axiom.getIndividual().asOWLNamedIndividual().getIRI().toString();
                String clsIri = axiom.getClassExpression().asOWLClass().getIRI().toString();

                sb.append("{\"source\":\"").append(escapeJson(indIri))
                  .append("\",\"target\":\"").append(escapeJson(clsIri))
                  .append("\",\"relation\":\"instância_de\"}");
            }
        }

        sb.append("]}");

        String jsonString = sb.toString();
        server.broadcastOntology(jsonString);
    }

    private String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\b", "\\b")
                    .replace("\f", "\\f")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
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
