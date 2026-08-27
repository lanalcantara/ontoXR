package br.ufpe.cin.ontoxr;

import org.semanticweb.owlapi.apibinding.OWLManager;
import org.semanticweb.owlapi.model.AxiomType;
import org.semanticweb.owlapi.model.OWLAnnotationAssertionAxiom;
import org.semanticweb.owlapi.model.OWLClass;
import org.semanticweb.owlapi.model.OWLClassAssertionAxiom;
import org.semanticweb.owlapi.model.OWLLiteral;
import org.semanticweb.owlapi.model.OWLNamedIndividual;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.model.OWLOntologyManager;
import org.semanticweb.owlapi.model.OWLSubClassOfAxiom;

import java.io.File;

public class OntoXRStandalone {

    public static void main(String[] args) {
        System.out.println("==================================================");
        System.out.println("Iniciando OntoXR Standalone Server...");
        System.out.println("==================================================");

        try {
            // 1. Criar e iniciar uma instancia de OntoXRServer na porta 8080
            OntoXRServer server = new OntoXRServer(8080);

            // 2. Carregar a ontologia do arquivo local
            File file = new File("C:/Users/Lana/Documents/ontologia final/BioHack.owl");
            if (!file.exists()) {
                System.err.println("[ERRO] Arquivo de ontologia nao encontrado: " + file.getAbsolutePath());
                return;
            }

            OWLOntologyManager manager = OWLManager.createOWLOntologyManager();
            OWLOntology ontology = manager.loadOntologyFromOntologyDocument(file);

            System.out.println("[OntoXRStandalone] Ontologia carregada com sucesso: " + ontology.getOntologyID());
            System.out.println("[OntoXRStandalone] Total de Classes (OWLClass): " + ontology.getClassesInSignature().size());
            System.out.println("[OntoXRStandalone] Total de Individuos (OWLNamedIndividual): " + ontology.getIndividualsInSignature().size());
            System.out.println("[OntoXRStandalone] Total de Axiomas SubClassOf: " + ontology.getAxioms(AxiomType.SUBCLASS_OF).size());
            System.out.println("[OntoXRStandalone] Total de Axiomas ClassAssertion: " + ontology.getAxioms(AxiomType.CLASS_ASSERTION).size());

            // 3. Extrair classes, individuos, anotaçoes e relacoes para o JSON
            final String jsonPayload = buildOntologyJson(ontology);

            // 4. Ajustar o evento onOpen do WebSocket para enviar imediatamente esse JSON serializado assim que o front-end se conectar
            server.setOnClientConnectCallback(conn -> {
                System.out.println("[OntoXRStandalone] Cliente WebXR conectado (" + conn.getRemoteSocketAddress() + "). Enviando JSON da ontologia...");
                conn.send(jsonPayload);
            });

            server.start();

            // 5. Imprimir no console
            System.out.println("=== SERVIDOR ONTOXR STANDALONE PRONTO NA PORTA 8080 ===");

        } catch (Exception e) {
            System.err.println("[ERRO] Falha ao iniciar o servidor OntoXR Standalone:");
            e.printStackTrace();
        }
    }

    public static String buildOntologyJson(OWLOntology ontology) {
        if (ontology == null) return "{\"nodes\":[],\"links\":[]}";

        StringBuilder sb = new StringBuilder();
        sb.append("{\"nodes\":[");

        boolean firstNode = true;

        // 1. Extrair OWL Classes (group: "class")
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

        // 2. Extrair OWLNamedIndividual (group: "individual")
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

        // 3. Extrair axiomas SubClassOf como links
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

        // 4. Extrair axiomas ClassAssertion (instancia -> classe) como links (relation: "instância_de")
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
        return sb.toString();
    }

    private static String escapeJson(String input) {
        if (input == null) return "";
        return input.replace("\\", "\\\\")
                    .replace("\"", "\\\"")
                    .replace("\b", "\\b")
                    .replace("\f", "\\f")
                    .replace("\n", "\\n")
                    .replace("\r", "\\r")
                    .replace("\t", "\\t");
    }
}
