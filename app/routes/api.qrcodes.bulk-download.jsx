import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { getQRCodes } from "../models/QRCode.server";
import JSZip from "jszip";

export async function action({ request }) {
  const { admin, session } = await authenticate.admin(request);
  
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const selectedIds = JSON.parse(formData.get("selectedIds") || "[]");
    
    // If no specific IDs provided, get all QR codes
    const allQRCodes = await getQRCodes(session.shop, admin.graphql);
    
    // Filter QR codes based on selection
    const qrCodesToDownload = selectedIds.length > 0 
      ? allQRCodes.filter(qr => selectedIds.includes(qr.id))
      : allQRCodes;

    if (qrCodesToDownload.length === 0) {
      return json({ error: "No QR codes found" }, { status: 404 });
    }

    // Create ZIP file
    const zip = new JSZip();
    
    // Add each QR code to the ZIP
    for (const qrCode of qrCodesToDownload) {
      if (qrCode.image) {
        // Extract base64 data from data URL
        const base64Data = qrCode.image.split(',')[1];
        const fileName = `${qrCode.title || qrCode.id}.png`;
        
        // Add file to ZIP
        zip.file(fileName, base64Data, { base64: true });
      }
    }

    // Generate ZIP buffer
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    
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
    return json({ error: "Failed to create download" }, { status: 500 });
  }
}