package br.ufpe.cin.ontoxr;

import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;
import org.java_websocket.server.WebSocketServer;

import java.net.InetSocketAddress;
import java.util.function.Consumer;

public class OntoXRServer extends WebSocketServer {

    private Consumer<WebSocket> onClientConnectCallback;

    public OntoXRServer(int port) {
        super(new InetSocketAddress(port));
    }

    public void setOnClientConnectCallback(Consumer<WebSocket> callback) {
        this.onClientConnectCallback = callback;
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
        if (onClientConnectCallback != null) {
            onClientConnectCallback.accept(conn);
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
