// src/app/api/video/[id]/route.js
import { NextResponse } from "next/server";

export async function GET(request, { params }) {
  const { id } = await params;

  if (!id) {
    return new NextResponse("File ID is required", { status: 400 });
  }

  const driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;

  try {
    const driveRes = await fetch(driveDownloadUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!driveRes.ok) {
      return new NextResponse(`Upstream Drive error: ${driveRes.status}`, {
        status: 502,
      });
    }

    return new NextResponse(driveRes.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (err) {
    console.error("Video proxy streaming failure:", err);
    return new NextResponse("Failed to stream video", { status: 500 });
  }
}