package com.incidentapp.android;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;

import androidx.exifinterface.media.ExifInterface;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;

public final class PhotoProcessor {
    public static final int MAX_DIMENSION = 1600;
    public static final long MAX_BYTES = 4_500_000L;

    public static final class Result {
        public final File file;
        public final int width;
        public final int height;
        public final long bytes;

        Result(File file, int width, int height, long bytes) {
            this.file = file;
            this.width = width;
            this.height = height;
            this.bytes = bytes;
        }
    }

    private PhotoProcessor() {}

    /** Decodes with bounded sampling, applies EXIF orientation, then writes a metadata-free JPEG. */
    public static Result process(Context context, Uri source, File destination) throws IOException {
        int orientation;
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        try {
            try (InputStream stream = context.getContentResolver().openInputStream(source)) {
                if (stream == null) throw new IOException("Photo could not be opened");
                orientation = new ExifInterface(new BufferedInputStream(stream))
                        .getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            }
            try (InputStream stream = context.getContentResolver().openInputStream(source)) {
                if (stream == null) throw new IOException("Photo could not be opened");
                BitmapFactory.decodeStream(stream, null, bounds);
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IOException("Unsupported image");

            BitmapFactory.Options options = new BitmapFactory.Options();
            options.inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, MAX_DIMENSION * 2);
            options.inPreferredConfig = Bitmap.Config.ARGB_8888;
            Bitmap decoded;
            try (InputStream stream = context.getContentResolver().openInputStream(source)) {
                if (stream == null) throw new IOException("Photo could not be opened");
                decoded = BitmapFactory.decodeStream(stream, null, options);
            }
            if (decoded == null) throw new IOException("Image decoding failed");
            Bitmap oriented = applyOrientation(decoded, orientation);
            Bitmap resized = scaleToFit(oriented, MAX_DIMENSION);
            if (resized != oriented) oriented.recycle();

            File parent = destination.getParentFile();
            if (parent != null && !parent.isDirectory() && !parent.mkdirs()) {
                resized.recycle();
                throw new IOException("Photo output directory could not be created");
            }
            writeWithinLimit(resized, destination);
            int width = resized.getWidth();
            int height = resized.getHeight();
            resized.recycle();
            return new Result(destination, width, height, destination.length());
        } catch (IOException | RuntimeException error) {
            if (destination.exists() && !destination.delete()) destination.deleteOnExit();
            if (error instanceof IOException) throw (IOException) error;
            throw new IOException("Photo processing failed", error);
        }
    }

    static int sampleSize(int width, int height, int maximumDecodeDimension) {
        int largest = Math.max(width, height);
        int sample = 1;
        while (largest / sample > maximumDecodeDimension && sample <= (1 << 20)) {
            sample *= 2;
        }
        return sample;
    }

    private static Bitmap applyOrientation(Bitmap source, int orientation) {
        Matrix matrix = new Matrix();
        switch (orientation) {
            case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: matrix.postScale(-1f, 1f); break;
            case ExifInterface.ORIENTATION_ROTATE_180: matrix.postRotate(180f); break;
            case ExifInterface.ORIENTATION_FLIP_VERTICAL: matrix.postScale(1f, -1f); break;
            case ExifInterface.ORIENTATION_TRANSPOSE:
                matrix.postScale(-1f, 1f);
                matrix.postRotate(90f);
                break;
            case ExifInterface.ORIENTATION_ROTATE_90: matrix.postRotate(90f); break;
            case ExifInterface.ORIENTATION_TRANSVERSE:
                matrix.postScale(1f, -1f);
                matrix.postRotate(90f);
                break;
            case ExifInterface.ORIENTATION_ROTATE_270: matrix.postRotate(270f); break;
            default: return source;
        }
        Bitmap result = Bitmap.createBitmap(source, 0, 0, source.getWidth(), source.getHeight(), matrix, true);
        if (result != source) source.recycle();
        return result;
    }

    private static Bitmap scaleToFit(Bitmap source, int maximumDimension) {
        int largest = Math.max(source.getWidth(), source.getHeight());
        if (largest <= maximumDimension) return source;
        float scale = maximumDimension / (float) largest;
        int width = Math.max(1, Math.round(source.getWidth() * scale));
        int height = Math.max(1, Math.round(source.getHeight() * scale));
        return Bitmap.createScaledBitmap(source, width, height, true);
    }

    private static void writeWithinLimit(Bitmap bitmap, File destination) throws IOException {
        int[] qualities = {85, 76, 67, 58, 49, 40};
        boolean stored = false;
        for (int quality : qualities) {
            try (OutputStream output = new FileOutputStream(destination, false)) {
                if (!bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) {
                    throw new IOException("JPEG compression failed");
                }
                output.flush();
            }
            if (destination.length() <= MAX_BYTES) {
                stored = true;
                break;
            }
        }
        if (!stored) throw new IOException("Compressed photo exceeds the size limit");
    }
}
