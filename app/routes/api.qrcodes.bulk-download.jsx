import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getQRCodes } from "../models/QRCode.server";
import JSZip from "jszip";

export async function action({ request }) {
  try {
    const { admin, session } = await authenticate.admin(request);
    
    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, { status: 405 });
    }

    const formData = await request.formData();
    const selectedIds = JSON.parse(formData.get("selectedIds") || "[]");
    
    console.log("Selected IDs:", selectedIds);
    
    // Get all QR codes
    const allQRCodes = await getQRCodes(session.shop, admin.graphql);
    console.log("All QR codes count:", allQRCodes.length);
    
    // Filter QR codes based on selection
    const qrCodesToDownload = selectedIds.length > 0
      ? allQRCodes.filter(qr => selectedIds.includes(qr.id))
      : allQRCodes;

    console.log("QR codes to download:", qrCodesToDownload.length);

    if (qrCodesToDownload.length === 0) {
      return json({ error: "No QR codes found to download" }, { status: 404 });
    }

    // Create ZIP file
    const zip = new JSZip();
    let addedFiles = 0;
    
    // Add each QR code to the ZIP
    for (const qrCode of qrCodesToDownload) {
      if (qrCode.image) {
        try {
          // Extract base64 data from data URL
          const base64Data = qrCode.image.split(',')[1];
          const fileName = `${(qrCode.title || qrCode.id).replace(/[^a-z0-9]/gi, '_')}.png`;
          
          // Add file to ZIP
          zip.file(fileName, base64Data, { base64: true });
          addedFiles++;
          console.log(`Added file: ${fileName}`);
        } catch (fileError) {
          console.error(`Error adding file for QR code ${qrCode.id}:`, fileError);
        }
      } else {
        console.log(`No image for QR code ${qrCode.id}`);
      }
    }

    if (addedFiles === 0) {
      return json({ error: "No QR code images found to download" }, { status: 404 });
    }

    console.log(`Generating ZIP with ${addedFiles} files`);

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    
    console.log("ZIP generated successfully, size:", zipBuffer.length);
    
    // Return ZIP file
    return new Response(zipBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="qr-codes-${new Date().toISOString().split('T')[0]}.zip"`,
        "Content-Length": zipBuffer.length.toString(),
      },
    });

  } catch (error) {
    console.error("Bulk download error:", error);
    return json({
      error: "Failed to create download",
      details: error.message
    }, { status: 500 });
  }
}