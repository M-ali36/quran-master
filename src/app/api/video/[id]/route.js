// src/app/api/video/[id]/route.js
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return new NextResponse("File ID is required", { status: 400 });
  }

  const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${id}&confirm=t`;

  // Forward range header if browser requests partial video segments (scrubbing/seeking)
  const rangeHeader = request.headers.get("range");
  const forwardHeaders = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };

  if (rangeHeader) {
    forwardHeaders["Range"] = rangeHeader;
  }

  try {
    const driveRes = await fetch(driveDownloadUrl, {
      headers: forwardHeaders,
      redirect: "follow",
    });

    if (!driveRes.ok && driveRes.status !== 206) {
      return new NextResponse(`Upstream Drive error: ${driveRes.status}`, {
        status: 502,
      });
    }

    // Construct response headers for video playback & browser Cache API
    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "video/mp4");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");

    // Forward byte length and partial-content range if available
    const contentLength = driveRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const contentRange = driveRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    return new NextResponse(driveRes.body, {
      status: driveRes.status === 206 ? 206 : 200,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error("Video proxy streaming failure:", err);
    return new NextResponse("Failed to stream video", { status: 500 });
  }
}

// Support pre-flight checks if fetched across domains or workers
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range, Content-Type",
    },
  });
}