import { NextResponse } from "next/server";

export async function GET() {
  const fileId = "19zV-mujQLNQbHGdr0JzGORhrTtj57qI1";
  const driveUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  try {
    const response = await fetch(driveUrl);

    if (!response.ok) {
      return new NextResponse("Error fetching video stream", { status: 502 });
    }

    return new NextResponse(response.body, {
      headers: {
        "Content-Type": "video/mp4",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}