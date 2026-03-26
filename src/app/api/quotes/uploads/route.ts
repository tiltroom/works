import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { env } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const MAX_IMAGE_SIZE_BYTES = 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const bucketCandidates = [env.quotesUploadsBucket, process.env.PREVENTIVI_UPLOADS_BUCKET ?? "preventivi-assets"];

function getStorageErrorMessage(error: unknown) {
  if (!error || typeof error !== "object") {
    return "";
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const name = "name" in error && typeof error.name === "string" ? error.name : "";
  return `${name} ${message}`.trim().toLowerCase();
}

function isBucketMissingError(error: unknown) {
  const message = getStorageErrorMessage(error);
  return message.includes("bucket not found") || message.includes("not found") || message.includes("does not exist");
}

async function ensureBucketExists(admin: ReturnType<typeof createAdminClient>, bucketName: string) {
  const { data, error } = await admin.storage.getBucket(bucketName);

  if (!error && data) {
    return;
  }

  if (error && !isBucketMissingError(error)) {
    throw error;
  }

  const { error: createError } = await admin.storage.createBucket(bucketName, {
    public: false,
    fileSizeLimit: `${MAX_IMAGE_SIZE_BYTES}`,
    allowedMimeTypes: [...ACCEPTED_IMAGE_TYPES],
  });

  if (createError && !getStorageErrorMessage(createError).includes("already exists")) {
    throw createError;
  }
}

async function uploadWithFallback(admin: ReturnType<typeof createAdminClient>, path: string, file: File) {
  let lastError: unknown = null;

  for (const bucketName of bucketCandidates) {
    try {
      await ensureBucketExists(admin, bucketName);
      const { error } = await admin.storage
        .from(bucketName)
        .upload(path, file, {
          cacheControl: "3600",
          contentType: file.type,
          upsert: false,
        });

      if (!error) {
        return { bucketName };
      }

      lastError = error;
      if (!isBucketMissingError(error)) {
        throw error;
      }
    } catch (error) {
      lastError = error;
      if (!isBucketMissingError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Bucket not found");
}

async function downloadWithFallback(admin: ReturnType<typeof createAdminClient>, path: string) {
  let lastError: unknown = null;

  for (const bucketName of bucketCandidates) {
    const { data, error } = await admin.storage.from(bucketName).download(path);
    if (!error && data) {
      return data;
    }

    lastError = error;
    if (!isBucketMissingError(error)) {
      break;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("File not found");
}

function getExtension(mimeType: string) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/png") {
    return "png";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "gif";
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    return NextResponse.json({ error: "Image exceeds 1MB" }, { status: 400 });
  }

  const admin = createAdminClient();
  const extension = getExtension(file.type);
  const path = `quotes/${user.id}/${randomUUID()}.${extension}`;
  try {
    await uploadWithFallback(admin, path, file);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const imageUrl = new URL("/api/quotes/uploads", env.appUrl);
  imageUrl.searchParams.set("path", path);

  return NextResponse.json({ url: imageUrl.toString() });
}

export async function GET(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path")?.trim();

  if (!path || !path.startsWith("quotes/")) {
    return NextResponse.json({ error: "Missing path" }, { status: 400 });
  }

  const admin = createAdminClient();
  try {
    const data = await downloadWithFallback(admin, path);
    return new NextResponse(data, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": data.type || "application/octet-stream",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "File not found";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
