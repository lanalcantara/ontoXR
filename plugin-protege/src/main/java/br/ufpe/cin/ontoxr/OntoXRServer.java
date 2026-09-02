package br.ufpe.cin.ontoxr;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public class OntoXRServer extends WebSocketServer {

    private Consumer<WebSocket> onClientConnectCallback;
    private final ConcurrentHashMap<String, List<Map<String, String>>> collaborativeComments = new ConcurrentHashMap<>();

    public OntoXRServer(int port) {
        super(new InetSocketAddress(port));
    }

    public void setOnClientConnectCallback(Consumer<WebSocket> callback) {
        this.onClientConnectCallback = callback;
    }

    public ConcurrentHashMap<String, List<Map<String, String>>> getCollaborativeComments() {
        return collaborativeComments;
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("[OntoXRServer] Client connected from: " + conn.getRemoteSocketAddress());
        if (onClientConnectCallback != null) {
            onClientConnectCallback.accept(conn);
        }
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        System.out.println("[OntoXRServer] Client disconnected: " + conn.getRemoteSocketAddress() + " (Reason: " + reason + ")");
    }

    @Override
    public void onMessage(WebSocket conn, String message) {
        System.out.println("[OntoXRServer] Message received from client: " + message);
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            if (json.has("action") && "add_comment".equals(json.get("action").getAsString())) {
                String nodeId = json.has("nodeId") ? json.get("nodeId").getAsString() : "";
                String author = json.has("author") && !json.get("author").getAsString().trim().isEmpty()
                        ? json.get("author").getAsString().trim()
                        : "Anônimo";
                String text = json.has("text") ? json.get("text").getAsString().trim() : "";
                String timestamp = json.has("timestamp") ? json.get("timestamp").getAsString() : String.valueOf(System.currentTimeMillis());

                if (!nodeId.isEmpty() && !text.isEmpty()) {
                    Map<String, String> commentData = new LinkedHashMap<>();
                    commentData.put("author", author);
                    commentData.put("text", text);
                    commentData.put("timestamp", timestamp);

                    collaborativeComments.computeIfAbsent(nodeId, k -> new CopyOnWriteArrayList<>()).add(commentData);

                    // Broadcast instantaneo do novo comentario para todas as conexoes ativas
                    JsonObject broadcastMsg = new JsonObject();
                    broadcastMsg.addProperty("type", "comment_added");
                    broadcastMsg.addProperty("nodeId", nodeId);
                    broadcastMsg.addProperty("author", author);
                    broadcastMsg.addProperty("text", text);
                    broadcastMsg.addProperty("timestamp", timestamp);

                    broadcast(broadcastMsg.toString());
                    System.out.println("[OntoXRServer] Comentário colaborativo adicionado ao nó " + nodeId + " por " + author + ". Broadcast efetuado.");
                }
            }
        } catch (Exception e) {
            System.err.println("[OntoXRServer] Erro ao processar mensagem do cliente: " + e.getMessage());
        }
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        System.err.println("[OntoXRServer] WebSocket Error: " + (ex != null ? ex.getMessage() : "Unknown error"));
        if (ex != null) {
            ex.printStackTrace();
        }
    }

    @Override
    public void onStart() {
        System.out.println("[OntoXRServer] WebSocket server started successfully on port " + getPort());
    }

    public void broadcastOntology(String jsonData) {
        if (jsonData != null && !jsonData.isEmpty()) {
            broadcast(jsonData);
            System.out.println("[OntoXRServer] Broadcasted ontology JSON to " + getConnections().size() + " client(s).");
        }
    }
}
