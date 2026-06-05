import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

function getContentType(fileName: string) {
  const lowerFileName = fileName.toLowerCase();
  if (lowerFileName.endsWith(".png")) return "image/png";
  if (lowerFileName.endsWith(".jpg") || lowerFileName.endsWith(".jpeg")) return "image/jpeg";
  if (lowerFileName.endsWith(".webp")) return "image/webp";
  if (lowerFileName.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

function buildCandidatePaths(fileName: string) {
  const downloadsDir = path.join(process.cwd(), "public", "downloads", "images");
  const generatedImagesDir = path.join(process.cwd(), "public", "generated-images");

  return [
    path.join(generatedImagesDir, fileName),
    path.join(downloadsDir, fileName),
    path.join(downloadsDir, `result-${fileName}`),
  ];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ fileName: string }> }
) {
  try {
    const { fileName } = await params;
    const candidatePaths = buildCandidatePaths(fileName);
    const matchedPath = candidatePaths.find((candidatePath) => fs.existsSync(candidatePath));

    if (!matchedPath) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const fileBuffer = fs.readFileSync(matchedPath);

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": getContentType(matchedPath),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    return new NextResponse(
      `Failed to read image: ${error instanceof Error ? error.message : "Unknown error"}`,
      { status: 500 }
    );
  }
}
