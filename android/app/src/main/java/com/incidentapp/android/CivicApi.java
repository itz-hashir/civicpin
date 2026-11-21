package com.incidentapp.android;

import org.json.JSONObject;

import java.io.File;
import java.io.IOException;
import java.net.ConnectException;
import java.net.NoRouteToHostException;
import java.net.UnknownHostException;
import java.util.Objects;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Callback;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import okhttp3.ResponseBody;

public final class CivicApi {
    public interface ResultCallback<T> {
        void onSuccess(T result);
        void onError(ApiError error);
    }

    private final OkHttpClient client = new OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .writeTimeout(45, TimeUnit.SECONDS)
            .callTimeout(60, TimeUnit.SECONDS)
            .build();
    private final HttpUrl baseUrl;

    public CivicApi() {
        this(BuildConfig.API_BASE_URL);
    }

    CivicApi(String url) {
        baseUrl = Objects.requireNonNull(HttpUrl.parse(url), "Invalid API base URL");
    }

    public Call submitReport(String type, String description, double latitude, double longitude,
                             File photo, ResultCallback<String> callback) {
        RequestBody body = new MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("type", type)
                .addFormDataPart("description", description)
                .addFormDataPart("lat", Double.toString(latitude))
                .addFormDataPart("lng", Double.toString(longitude))
                .addFormDataPart("photo", photo.getName(),
                        RequestBody.create(MediaType.parse("image/jpeg"), photo))
                .build();
        Request request = new Request.Builder().url(baseUrl.resolve("/api/reports")).post(body).build();
        Call call = client.newCall(request);
        call.enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException error) {
                callback.onError(networkError(call, error));
            }

            @Override public void onResponse(Call call, Response response) {
                try (Response closeable = response) {
                    String responseText = readBody(response);
                    if (response.code() != 201) {
                        callback.onError(httpError(response.code(), responseText));
                        return;
                    }
                    callback.onSuccess(ReportJsonParser.parseCreatedCode(responseText));
                } catch (IOException error) {
                    callback.onError(networkError(call, error));
                } catch (Exception error) {
                    callback.onError(new ApiError(ApiError.Reason.INVALID_RESPONSE,
                            "Invalid report creation response", error));
                }
            }
        });
        return call;
    }

    public Call trackReport(String code, ResultCallback<TrackedReport> callback) {
        HttpUrl url = baseUrl.resolve("/api/reports/").newBuilder().addPathSegment(code).build();
        Request request = new Request.Builder().url(url).get().build();
        Call call = client.newCall(request);
        call.enqueue(new Callback() {
            @Override public void onFailure(Call call, IOException error) {
                callback.onError(networkError(call, error));
            }

            @Override public void onResponse(Call call, Response response) {
                try (Response closeable = response) {
                    String responseText = readBody(response);
                    if (response.code() == 404) {
                        callback.onError(new ApiError(ApiError.Reason.NOT_FOUND, "Report not found",
                                404, serverMessage(responseText), null));
                        return;
                    }
                    if (response.code() != 200) {
                        callback.onError(httpError(response.code(), responseText));
                        return;
                    }
                    callback.onSuccess(ReportJsonParser.parseTrackedReport(responseText));
                } catch (IOException error) {
                    callback.onError(networkError(call, error));
                } catch (Exception error) {
                    callback.onError(new ApiError(ApiError.Reason.INVALID_RESPONSE,
                            "Invalid tracking response", error));
                }
            }
        });
        return call;
    }

    private static String readBody(Response response) throws IOException {
        ResponseBody body = response.body();
        return body == null ? "" : body.string();
    }

    private static ApiError httpError(int code, String responseText) {
        return new ApiError(ApiError.Reason.HTTP, "Server returned " + code, code,
                serverMessage(responseText), null);
    }

    private static String serverMessage(String responseText) {
        try {
            String message = new JSONObject(responseText).optString("error", "").trim();
            return message.length() > 180 ? message.substring(0, 180) : message;
        } catch (Exception ignored) {
            return "";
        }
    }

    private static ApiError networkError(Call call, IOException error) {
        if (call.isCanceled()) return new ApiError(ApiError.Reason.CANCELLED, "Request cancelled", error);
        if (error instanceof java.net.SocketTimeoutException) {
            return new ApiError(ApiError.Reason.TIMEOUT, "Request timed out", error);
        }
        if (error instanceof UnknownHostException || error instanceof ConnectException
                || error instanceof NoRouteToHostException) {
            return new ApiError(ApiError.Reason.OFFLINE, "Device appears offline", error);
        }
        return new ApiError(ApiError.Reason.NETWORK, "Network request failed", error);
    }
}
