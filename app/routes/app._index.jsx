import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate, useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useState } from "react";
import {
  Card,
  EmptyState,
  Layout,
  Page,
  IndexTable,
  Thumbnail,
  Text,
  Icon,
  InlineStack,
  Button,
  ButtonGroup,
} from "@shopify/polaris";

import { getQRCodes } from "../models/QRCode.server";
import { AlertDiamondIcon, ImageIcon, ExportIcon } from "@shopify/polaris-icons";

export async function loader({ request }) {
  const { admin, session } = await authenticate.admin(request);
  const qrCodes = await getQRCodes(session.shop, admin.graphql);

  return json({
    qrCodes,
  });
}

const EmptyQRCodeState = ({ onAction }) => (
  <EmptyState
    heading="Create unique QR codes for your product"
    action={{
      content: "Create QR code",
      onAction,
    }}
    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
  >
    <p>Allow customers to scan codes and buy products using their phones.</p>
  </EmptyState>
);

function truncate(str, { length = 25 } = {}) {
  if (!str) return "";
  if (str.length <= length) return str;
  return str.slice(0, length) + "…";
}

const QRTable = ({ qrCodes, selectedResources, onSelectionChange }) => (
  <IndexTable
    resourceName={{
      singular: "QR code",
      plural: "QR codes",
    }}
    itemCount={qrCodes.length}
    selectedItemsCount={
      selectedResources === "All" ? "All" : selectedResources.length
    }
    onSelectionChange={onSelectionChange}
    headings={[
      { title: "Thumbnail", hidden: true },
      { title: "Title" },
      { title: "Product" },
      { title: "Date created" },
      { title: "Scans" },
      { title: "Recent Activity" },
    ]}
    selectable={true}
  >
    {qrCodes.map((qrCode) => (
      <QRTableRow key={qrCode.id} qrCode={qrCode} />
    ))}
  </IndexTable>
);

const QRTableRow = ({ qrCode }) => {
  const recentScan = qrCode.scanLogs && qrCode.scanLogs.length > 0 ? qrCode.scanLogs[0] : null;
  
  return (
    <IndexTable.Row id={qrCode.id} position={qrCode.id}>
      <IndexTable.Cell>
        <Thumbnail
          source={qrCode.productImage || ImageIcon}
          alt={qrCode.productTitle}
          size="small"
        />
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Link to={`qrcodes/${qrCode.id}`}>{truncate(qrCode.title)}</Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {qrCode.productDeleted ? (
          <InlineStack align="start" gap="200">
            <span style={{ width: "20px" }}>
              <Icon source={AlertDiamondIcon} tone="critical" />
            </span>
            <Text tone="critical" as="span">
              product has been deleted
            </Text>
          </InlineStack>
        ) : (
          truncate(qrCode.productTitle)
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(qrCode.createdAt).toDateString()}
      </IndexTable.Cell>
      <IndexTable.Cell>{qrCode.scans}</IndexTable.Cell>
      <IndexTable.Cell>
        {recentScan ? (
          <InlineStack gap="100">
            <Text as="span" variant="bodySm">
              {recentScan.deviceType || 'Unknown'}
            </Text>
            <Text as="span" variant="bodySm" tone="subdued">
              from {recentScan.city || 'Unknown'}
            </Text>
          </InlineStack>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">
            No scans yet
          </Text>
        )}
      </IndexTable.Cell>
    </IndexTable.Row>
  );
};

export default function Index() {
  const { qrCodes } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [selectedResources, setSelectedResources] = useState([]);

  const handleSelectionChange = (selection) => {
    setSelectedResources(selection);
  };

  const handleBulkDownload = async () => {
    const selectedIds = selectedResources === "All"
      ? qrCodes.map(qr => qr.id)
      : selectedResources;

    if (selectedIds.length === 0) {
      alert("Please select QR codes to download");
      return;
    }

    try {
      console.log("Starting download for IDs:", selectedIds);
      
      const formData = new FormData();
      formData.append("selectedIds", JSON.stringify(selectedIds));

      const response = await fetch("/api/qrcodes/bulk-download", {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const blob = await response.blob();
        console.log("Blob size:", blob.size);
        
        if (blob.size === 0) {
          alert("No QR code images found to download");
          return;
        }
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `qr-codes-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log("Download completed successfully");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Download failed:", errorData);
        alert(`Failed to download QR codes: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Download error:", error);
      alert(`Failed to download QR codes: ${error.message}`);
    }
  };

  const selectedCount = selectedResources === "All" ? qrCodes.length : selectedResources.length;

  const handleDownloadAll = async () => {
    if (qrCodes.length === 0) {
      alert("No QR codes available to download");
      return;
    }

    try {
      console.log("Starting download all QR codes");
      
      const formData = new FormData();
      formData.append("selectedIds", JSON.stringify([])); // Empty array means download all

      const response = await fetch("/api/qrcodes/bulk-download", {
        method: "POST",
        body: formData,
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const blob = await response.blob();
        console.log("Blob size:", blob.size);
        
        if (blob.size === 0) {
          alert("No QR code images found to download");
          return;
        }
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `all-qr-codes-${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        console.log("Download all completed successfully");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Download all failed:", errorData);
        alert(`Failed to download QR codes: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Download all error:", error);
      alert(`Failed to download QR codes: ${error.message}`);
    }
  };

  return (
    <Page>
      <ui-title-bar title="QR codes">
        <button variant="primary" onClick={() => navigate("/app/qrcodes/new")}>
          Create QR code
        </button>
        <button variant="secondary" onClick={() => navigate("/app/qrcodes/bulk-create")}>
          Bulk Create by Product Names
        </button>
        {qrCodes.length > 0 && (
          <button variant="secondary" onClick={handleDownloadAll}>
            Download All QR Codes
          </button>
        )}
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <Card padding="0">
            {qrCodes.length === 0 ? (
              <EmptyQRCodeState onAction={() => navigate("qrcodes/new")} />
            ) : (
              <>
                {selectedCount > 0 && (
                  <div style={{ padding: "16px", borderBottom: "1px solid #e1e3e5" }}>
                    <InlineStack gap="300" align="space-between">
                      <Text as="p" variant="bodyMd">
                        {selectedCount} QR code{selectedCount > 1 ? "s" : ""} selected
                      </Text>
                      <ButtonGroup>
                        <Button
                          icon={ExportIcon}
                          onClick={handleBulkDownload}
                          loading={fetcher.state === "submitting"}
                        >
                          Download Selected
                        </Button>
                      </ButtonGroup>
                    </InlineStack>
                  </div>
                )}
                <QRTable
                  qrCodes={qrCodes}
                  selectedResources={selectedResources}
                  onSelectionChange={handleSelectionChange}
                />
              </>
            )}
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
