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

            // 3. Iniciar o servidor WebSocket na porta 8080
            // 4. Ajustar o evento onOpen do WebSocket para enviar o JSON da ontologia com os comentarios colaborativos
            server.setOnClientConnectCallback(conn -> {
                System.out.println("[OntoXRStandalone] Cliente WebXR conectado (" + conn.getRemoteSocketAddress() + "). Enviando JSON da ontologia...");
                String jsonPayload = OntologyParser.parseToJson(ontology, server.getCollaborativeComments());
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
}
