package br.ufpe.cin.ontoxr;

import org.semanticweb.HermiT.ReasonerFactory;
import org.semanticweb.owlapi.model.AxiomType;
import org.semanticweb.owlapi.model.OWLAnnotationAssertionAxiom;
import org.semanticweb.owlapi.model.OWLClass;
import org.semanticweb.owlapi.model.OWLClassAssertionAxiom;
import org.semanticweb.owlapi.model.OWLDataProperty;
import org.semanticweb.owlapi.model.OWLLiteral;
import org.semanticweb.owlapi.model.OWLNamedIndividual;
import org.semanticweb.owlapi.model.OWLObjectProperty;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.model.OWLSubClassOfAxiom;
import org.semanticweb.owlapi.reasoner.InferenceType;
import org.semanticweb.owlapi.reasoner.NodeSet;
import org.semanticweb.owlapi.reasoner.OWLReasoner;
import org.semanticweb.owlapi.reasoner.OWLReasonerFactory;
import org.semanticweb.owlapi.reasoner.structural.StructuralReasonerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class OntologyParser {

    public static String parseToJson(OWLOntology ontology) {
        return parseToJson(ontology, null);
    }

    /**
     * Parses an OWLOntology using the HermiT Reasoner (with fallback to Structural Reasoner)
     * and generates a rich JSON representation with classes, individuals, annotations,
     * declared + inferred object properties, data properties, subclass relations,
     * and injected collaborative comments from volatile memory.
     */
    public static String parseToJson(OWLOntology ontology, Map<String, List<Map<String, String>>> collaborativeComments) {
        if (ontology == null) {
            return "{\"nodes\":[],\"links\":[]}";
        }

        System.out.println("[OntologyParser] Iniciando inferência e parsing com HermiT Reasoner...");

        OWLReasoner reasoner = null;
        try {
            OWLReasonerFactory reasonerFactory = new ReasonerFactory();
            reasoner = reasonerFactory.createReasoner(ontology);
            reasoner.precomputeInferences(
                InferenceType.CLASS_HIERARCHY,
                InferenceType.OBJECT_PROPERTY_ASSERTIONS
            );
            System.out.println("[OntologyParser] HermiT Reasoner inicializado com sucesso.");
        } catch (Exception e) {
            System.err.println("[OntologyParser] Aviso: Falha ao inicializar HermiT Reasoner (" + e.getMessage() + "). Usando Structural Reasoner como fallback.");
            try {
                OWLReasonerFactory fallbackFactory = new StructuralReasonerFactory();
                reasoner = fallbackFactory.createReasoner(ontology);
            } catch (Exception ex) {
                System.err.println("[OntologyParser] Erro no reasoner fallback: " + ex.getMessage());
            }
        }

        StringBuilder sb = new StringBuilder();
        sb.append("{\"nodes\":[");

        boolean firstNode = true;

        // 1. Extrair Classes Ontológicas (group: "class")
        for (OWLClass cls : ontology.getClassesInSignature()) {
            if (cls.isOWLNothing()) continue; // Ignora Nothing

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
              .append("\",\"group\":\"class\"")
              .append(",\"comment\":\"").append(escapeJson(comment))
              .append("\",\"dataProperties\":{}")
              .append(",\"collaborativeComments\":");
            
            appendCommentsJson(sb, iri, collaborativeComments);
            sb.append("}");
        }

        // 2. Extrair Entidades / Indivíduos (group: "individual") com Data Properties
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

            // Extração de Data Properties do indivíduo
            Map<String, List<String>> dataPropsMap = new LinkedHashMap<>();
            for (OWLDataProperty dataProp : ontology.getDataPropertiesInSignature()) {
                Set<OWLLiteral> literals = null;
                if (reasoner != null) {
                    try {
                        literals = reasoner.getDataPropertyValues(ind, dataProp);
                    } catch (Exception ignored) {}
                }

                if (literals != null && !literals.isEmpty()) {
                    String propName = dataProp.getIRI().getShortForm();
                    if (propName == null || propName.isEmpty()) {
                        propName = dataProp.getIRI().toString();
                    }
                    for (OWLAnnotationAssertionAxiom ax : ontology.getAnnotationAssertionAxioms(dataProp.getIRI())) {
                        if (ax.getProperty().isLabel() && ax.getValue() instanceof OWLLiteral) {
                            String lbl = ((OWLLiteral) ax.getValue()).getLiteral().trim();
                            if (!lbl.isEmpty()) propName = lbl;
                        }
                    }

                    List<String> litList = new ArrayList<>();
                    for (OWLLiteral lit : literals) {
                        litList.add(lit.getLiteral());
                    }
                    dataPropsMap.put(propName, litList);
                }
            }

            sb.append("{\"id\":\"").append(escapeJson(iri))
              .append("\",\"name\":\"").append(escapeJson(name))
              .append("\",\"group\":\"individual\"")
              .append(",\"comment\":\"").append(escapeJson(comment))
              .append("\",\"dataProperties\":{");

            boolean firstProp = true;
            for (Map.Entry<String, List<String>> entry : dataPropsMap.entrySet()) {
                if (!firstProp) sb.append(",");
                firstProp = false;

                sb.append("\"").append(escapeJson(entry.getKey())).append("\":[");
                boolean firstVal = true;
                for (String val : entry.getValue()) {
                    if (!firstVal) sb.append(",");
                    firstVal = false;
                    sb.append("\"").append(escapeJson(val)).append("\"");
                }
                sb.append("]");
            }
            sb.append("},\"collaborativeComments\":");
            appendCommentsJson(sb, iri, collaborativeComments);
            sb.append("}");
        }

        sb.append("],\"links\":[");

        boolean firstLink = true;
        Set<String> linkKeySet = new HashSet<>();

        // 3. Extrair Axiomas SubClassOf como links
        for (OWLSubClassOfAxiom axiom : ontology.getAxioms(AxiomType.SUBCLASS_OF)) {
            if (!axiom.getSubClass().isAnonymous() && !axiom.getSuperClass().isAnonymous()) {
                String subIri = axiom.getSubClass().asOWLClass().getIRI().toString();
                String superIri = axiom.getSuperClass().asOWLClass().getIRI().toString();
                String key = subIri + "|subClassOf|" + superIri;

                if (!linkKeySet.contains(key)) {
                    linkKeySet.add(key);
                    if (!firstLink) sb.append(",");
                    firstLink = false;

                    sb.append("{\"source\":\"").append(escapeJson(subIri))
                      .append("\",\"target\":\"").append(escapeJson(superIri))
                      .append("\",\"relation\":\"subClassOf\"")
                      .append(",\"label\":\"subClassOf\"}");
                }
            }
        }

        // 4. Extrair Axiomas ClassAssertion (instância -> classe, relation: "instância_de")
        for (OWLClassAssertionAxiom axiom : ontology.getAxioms(AxiomType.CLASS_ASSERTION)) {
            if (!axiom.getIndividual().isAnonymous() && !axiom.getClassExpression().isAnonymous()) {
                String indIri = axiom.getIndividual().asOWLNamedIndividual().getIRI().toString();
                String clsIri = axiom.getClassExpression().asOWLClass().getIRI().toString();
                String key = indIri + "|instância_de|" + clsIri;

                if (!linkKeySet.contains(key)) {
                    linkKeySet.add(key);
                    if (!firstLink) sb.append(",");
                    firstLink = false;

                    sb.append("{\"source\":\"").append(escapeJson(indIri))
                      .append("\",\"target\":\"").append(escapeJson(clsIri))
                      .append("\",\"relation\":\"instância_de\"")
                      .append(",\"label\":\"instância_de\"}");
                }
            }
        }

        // 5. Extrair Object Properties Inferidas e Declaradas (Links entre Indivíduos)
        if (reasoner != null) {
            for (OWLNamedIndividual ind : ontology.getIndividualsInSignature()) {
                String sourceIri = ind.getIRI().toString();

                for (OWLObjectProperty prop : ontology.getObjectPropertiesInSignature()) {
                    if (prop.isOWLBottomObjectProperty() || prop.isOWLTopObjectProperty()) continue;

                    String propLabel = prop.getIRI().getShortForm();
                    if (propLabel == null || propLabel.isEmpty()) {
                        propLabel = prop.getIRI().toString();
                    }

                    for (OWLAnnotationAssertionAxiom ax : ontology.getAnnotationAssertionAxioms(prop.getIRI())) {
                        if (ax.getProperty().isLabel() && ax.getValue() instanceof OWLLiteral) {
                            String lbl = ((OWLLiteral) ax.getValue()).getLiteral().trim();
                            if (!lbl.isEmpty()) propLabel = lbl;
                        }
                    }

                    try {
                        NodeSet<OWLNamedIndividual> targetInds = reasoner.getObjectPropertyValues(ind, prop);
                        for (OWLNamedIndividual targetInd : targetInds.getFlattened()) {
                            String targetIri = targetInd.getIRI().toString();
                            String key = sourceIri + "|" + propLabel + "|" + targetIri;

                            if (!linkKeySet.contains(key)) {
                                linkKeySet.add(key);
                                if (!firstLink) sb.append(",");
                                firstLink = false;

                                sb.append("{\"source\":\"").append(escapeJson(sourceIri))
                                  .append("\",\"target\":\"").append(escapeJson(targetIri))
                                  .append("\",\"relation\":\"").append(escapeJson(propLabel))
                                  .append("\",\"label\":\"").append(escapeJson(propLabel))
                                  .append("\"}");
                            }
                        }
                    } catch (Exception e) {
                        // Ignora falhas em propriedades específicas
                    }
                }
            }
        }

        sb.append("]}");

        if (reasoner != null) {
            try {
                reasoner.dispose();
            } catch (Exception ignored) {}
        }

        System.out.println("[OntologyParser] Parsing concluído com sucesso. Links gerados: " + linkKeySet.size());
        return sb.toString();
    }

    private static void appendCommentsJson(StringBuilder sb, String nodeIri, Map<String, List<Map<String, String>>> commentsMap) {
        sb.append("[");
        if (commentsMap != null && commentsMap.containsKey(nodeIri)) {
            List<Map<String, String>> list = commentsMap.get(nodeIri);
            if (list != null) {
                boolean first = true;
                for (Map<String, String> item : list) {
                    if (!first) sb.append(",");
                    first = false;
                    sb.append("{\"author\":\"").append(escapeJson(item.getOrDefault("author", "Anônimo")))
                      .append("\",\"text\":\"").append(escapeJson(item.getOrDefault("text", "")))
                      .append("\",\"timestamp\":\"").append(escapeJson(item.getOrDefault("timestamp", "")))
                      .append("\"}");
                }
            }
        }
        sb.append("]");
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
