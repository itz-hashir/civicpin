package com.incidentapp.android;

public final class ApiError extends Exception {
    public enum Reason { OFFLINE, TIMEOUT, NETWORK, HTTP, NOT_FOUND, INVALID_RESPONSE, CANCELLED }

    public final Reason reason;
    public final int httpCode;
    public final String serverMessage;

    public ApiError(Reason reason, String message) {
        this(reason, message, 0, "", null);
    }

    public ApiError(Reason reason, String message, Throwable cause) {
        this(reason, message, 0, "", cause);
    }

    public ApiError(Reason reason, String message, int httpCode, String serverMessage, Throwable cause) {
        super(message, cause);
        this.reason = reason;
        this.httpCode = httpCode;
        this.serverMessage = serverMessage == null ? "" : serverMessage;
    }
}
