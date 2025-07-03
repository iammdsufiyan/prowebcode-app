import { useState, useCallback, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import {
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  Bleed,
  Button,
  ChoiceList,
  Divider,
  EmptyState,
  InlineStack,
  InlineError,
  Layout,
  Page,
  Text,
  TextField,
  Thumbnail,
  BlockStack,
  PageActions,
  DataTable,
  Badge,
  ColorPicker,
  RangeSlider,
  Select,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";

import db from '../db.server';
import { getQRCode, validateQRCode } from "../models/QRCode.server";
import { CustomQRCodeGenerator } from "../components/CustomQRCodeGenerator";

export async function loader({ request, params }) {
  const { admin } = await authenticate.admin(request);

  if (params.id === "new") {
    return json({
      destination: "product",
      title: "",
      foregroundColor: "#000000",
      backgroundColor: "#FFFFFF",
      frameStyle: "square",
      callToAction: "Scan to Shop",
      cornerRadius: 0,
      dotStyle: "square",
      eyeStyle: "square",
    });
  }

  return json(await getQRCode(params.id, admin.graphql));
}

export async function action({ request, params }) {
  const { session } = await authenticate.admin(request);
  const { shop } = session;

  /** @type {any} */
  const formData = Object.fromEntries(await request.formData());
  
  // Convert cornerRadius to integer to match database schema
  const data = {
    ...formData,
    shop,
    cornerRadius: formData.cornerRadius ? parseInt(formData.cornerRadius) || 0 : 0,
  };

  if (data.action === "delete") {
    await db.qRCode.delete({ where: { id: params.id } });
    return redirect("/app");
  }

  const errors = validateQRCode(data);

  if (errors) {
    return json({ errors }, { status: 422 });
  }

  const qrCode =
    params.id === "new"
      ? await db.qRCode.create({ data })
      : await db.qRCode.update({ where: { id: params.id }, data });

  return redirect(`/app/qrcodes/${qrCode.id}`);
}

export default function QRCodeForm() {
  const errors = useActionData()?.errors || {};

  const qrCode = useLoaderData();
  const [formState, setFormState] = useState(qrCode);
  const [cleanFormState, setCleanFormState] = useState(qrCode);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [customQRImage, setCustomQRImage] = useState(null);
  const [isClient, setIsClient] = useState(false);
  const isDirty = JSON.stringify(formState) !== JSON.stringify(cleanFormState);

  // Set client-side flag
  useEffect(() => {
    setIsClient(true);
  }, []);

  const nav = useNavigation();
  const isSaving =
    nav.state === "submitting" && nav.formData?.get("action") !== "delete";
  const isDeleting =
    nav.state === "submitting" && nav.formData?.get("action") === "delete";

  const navigate = useNavigate();

  function downloadQRCode() {
    // Prefer custom QR image if available, otherwise use the saved QR code image
    const imageToDownload = customQRImage || qrCode?.image;
    if (!imageToDownload) return;
    
    try {
      // Convert data URL to blob for better browser compatibility
      const dataURL = imageToDownload;
      const byteString = atob(dataURL.split(',')[1]);
      const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
      
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      
      const blob = new Blob([ab], { type: mimeString });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary anchor element for download
      const link = document.createElement('a');
      link.href = url;
      link.download = `qr-code-${formState.title || qrCode.title || qrCode.id || 'custom'}.png`;
      
      // For Safari compatibility, we need to add the link to the DOM
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      // Fallback to simple data URL download
      const link = document.createElement('a');
      link.href = imageToDownload;
      link.download = `qr-code-${formState.title || qrCode.title || qrCode.id || 'custom'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }

  async function selectProduct() {
    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "select", // customized action verb, either 'select' or 'add',
      query: productSearchQuery, // Use search query if provided
    });

    if (products) {
      const { images, id, variants, title, handle } = products[0];

      setFormState({
        ...formState,
        productId: id,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: images[0]?.altText,
        productImage: images[0]?.originalSrc,
      });
    }
  }

  const searchAndSelectProduct = useCallback(async () => {
    if (!productSearchQuery.trim()) {
      await selectProduct();
      return;
    }

    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "select",
      query: productSearchQuery, // Search by product name
    });

    if (products) {
      const { images, id, variants, title, handle } = products[0];

      setFormState({
        ...formState,
        productId: id,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: images[0]?.altText,
        productImage: images[0]?.originalSrc,
      });
      setProductSearchQuery(""); // Clear search after selection
    }
  }, [productSearchQuery, formState]);

  const submit = useSubmit();
  function handleSave() {
    const data = {
      title: formState.title,
      productId: formState.productId || "",
      productVariantId: formState.productVariantId || "",
      productHandle: formState.productHandle || "",
      destination: formState.destination,
      // Design customization fields
      foregroundColor: formState.foregroundColor || "#000000",
      backgroundColor: formState.backgroundColor || "#FFFFFF",
      logoUrl: formState.logoUrl || "",
      frameStyle: formState.frameStyle || "square",
      callToAction: formState.callToAction || "Scan to Shop",
      cornerRadius: parseInt(formState.cornerRadius) || 0, // Convert to integer
      dotStyle: formState.dotStyle || "square",
      eyeStyle: formState.eyeStyle || "square",
      gradientType: formState.gradientType || "",
      gradientColor1: formState.gradientColor1 || "",
      gradientColor2: formState.gradientColor2 || "",
    };

    setCleanFormState({ ...formState });
    submit(data, { method: "post" });
  }

  return (
    <Page>
      <ui-title-bar title={qrCode.id ? "Edit QR code" : "Create new QR code"}>
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          QR codes
        </button>
      </ui-title-bar>
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="500">
                <Text as={"h2"} variant="headingLg">
                  Title
                </Text>
                <TextField
                  id="title"
                  helpText="Only store staff can see this title"
                  label="title"
                  labelHidden
                  autoComplete="off"
                  value={formState.title}
                  onChange={(title) => setFormState({ ...formState, title })}
                  error={errors.title}
                />
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="500">
                <InlineStack align="space-between">
                  <Text as={"h2"} variant="headingLg">
                    Product
                  </Text>
                  {formState.productId ? (
                    <Button variant="plain" onClick={selectProduct}>
                      Change product
                    </Button>
                  ) : null}
                </InlineStack>
                {formState.productId ? (
                  <InlineStack blockAlign="center" gap="500">
                    <Thumbnail
                      source={formState.productImage || ImageIcon}
                      alt={formState.productAlt}
                    />
                    <Text as="span" variant="headingMd" fontWeight="semibold">
                      {formState.productTitle}
                    </Text>
                  </InlineStack>
                ) : (
                  <BlockStack gap="300">
                    <TextField
                      label="Search for product by name"
                      value={productSearchQuery}
                      onChange={setProductSearchQuery}
                      placeholder="Enter product name to search..."
                      helpText="Enter a product name and click 'Search & Select' to find products quickly"
                    />
                    <InlineStack gap="200">
                      <Button onClick={searchAndSelectProduct} id="select-product">
                        {productSearchQuery.trim() ? "Search & Select" : "Browse Products"}
                      </Button>
                      {productSearchQuery.trim() && (
                        <Button variant="plain" onClick={() => setProductSearchQuery("")}>
                          Clear
                        </Button>
                      )}
                    </InlineStack>
                    {errors.productId ? (
                      <InlineError
                        message={errors.productId}
                        fieldID="myFieldID"
                      />
                    ) : null}
                  </BlockStack>
                )}
                <Bleed marginInlineStart="200" marginInlineEnd="200">
                  <Divider />
                </Bleed>
                <InlineStack gap="500" align="space-between" blockAlign="start">
                  <ChoiceList
                    title="Scan destination"
                    choices={[
                      { label: "Link to product page", value: "product" },
                      {
                        label: "Link to checkout page with product in the cart",
                        value: "cart",
                      },
                    ]}
                    selected={[formState.destination]}
                    onChange={(destination) =>
                      setFormState({
                        ...formState,
                        destination: destination[0],
                      })
                    }
                    error={errors.destination}
                  />
                  {qrCode.destinationUrl ? (
                    <Button
                      variant="plain"
                      url={qrCode.destinationUrl}
                      target="_blank"
                    >
                      Go to destination URL
                    </Button>
                  ) : null}
                </InlineStack>
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Design Customization
                </Text>
                
                <InlineStack gap="500" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Foreground Color"
                      value={formState.foregroundColor || "#000000"}
                      onChange={(value) => setFormState({ ...formState, foregroundColor: value })}
                      type="color"
                      helpText="Color of the QR code dots"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Background Color"
                      value={formState.backgroundColor || "#FFFFFF"}
                      onChange={(value) => setFormState({ ...formState, backgroundColor: value })}
                      type="color"
                      helpText="Background color of the QR code"
                    />
                  </div>
                </InlineStack>
                
                <TextField
                  label="Call to Action Text"
                  value={formState.callToAction || "Scan to Shop"}
                  onChange={(value) => setFormState({ ...formState, callToAction: value })}
                  placeholder="e.g., Scan to Shop, Scan Me, Get Product Info"
                  helpText="Text that appears with the QR code"
                />
                
                <InlineStack gap="500" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Frame Style"
                      options={[
                        { label: "Square", value: "square" },
                        { label: "Rounded", value: "rounded" },
                        { label: "Circle", value: "circle" },
                        { label: "None", value: "none" },
                      ]}
                      value={formState.frameStyle || "square"}
                      onChange={(value) => setFormState({ ...formState, frameStyle: value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Dot Style"
                      options={[
                        { label: "Square", value: "square" },
                        { label: "Rounded", value: "rounded" },
                        { label: "Circle", value: "circle" },
                        { label: "Diamond", value: "diamond" },
                      ]}
                      value={formState.dotStyle || "square"}
                      onChange={(value) => setFormState({ ...formState, dotStyle: value })}
                    />
                  </div>
                </InlineStack>
                
                <InlineStack gap="500" wrap={false}>
                  <div style={{ flex: 1 }}>
                    <Select
                      label="Eye Style"
                      options={[
                        { label: "Square", value: "square" },
                        { label: "Rounded", value: "rounded" },
                        { label: "Circle", value: "circle" },
                      ]}
                      value={formState.eyeStyle || "square"}
                      onChange={(value) => setFormState({ ...formState, eyeStyle: value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Corner Radius"
                      type="number"
                      value={formState.cornerRadius?.toString() || "0"}
                      onChange={(value) => setFormState({ ...formState, cornerRadius: parseInt(value) || 0 })}
                      min={0}
                      max={50}
                      helpText="0-50 pixels"
                    />
                  </div>
                </InlineStack>
                
                <TextField
                  label="Logo URL (Optional)"
                  value={formState.logoUrl || ""}
                  onChange={(value) => setFormState({ ...formState, logoUrl: value })}
                  placeholder="https://example.com/logo.png"
                  helpText="URL to a logo image to embed in the center of the QR code"
                />
                
                <Divider />
                
                <Text as="h3" variant="headingMd">
                  Gradient Options (Optional)
                </Text>
                
                <Select
                  label="Gradient Type"
                  options={[
                    { label: "None", value: "" },
                    { label: "Linear", value: "linear" },
                    { label: "Radial", value: "radial" },
                  ]}
                  value={formState.gradientType || ""}
                  onChange={(value) => setFormState({ ...formState, gradientType: value })}
                />
                
                {formState.gradientType && (
                  <InlineStack gap="500" wrap={false}>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Gradient Color 1"
                        value={formState.gradientColor1 || "#000000"}
                        onChange={(value) => setFormState({ ...formState, gradientColor1: value })}
                        type="color"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <TextField
                        label="Gradient Color 2"
                        value={formState.gradientColor2 || "#666666"}
                        onChange={(value) => setFormState({ ...formState, gradientColor2: value })}
                        type="color"
                      />
                    </div>
                  </InlineStack>
                )}
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="400">
              <Text as={"h2"} variant="headingLg">
                QR Code Preview
              </Text>
              
              {qrCode.id ? (
                <div>
                  <Text as="h3" variant="headingMd" tone="subdued">
                    Current QR Code
                  </Text>
                  <EmptyState image={qrCode.image} imageContained={true} />
                </div>
              ) : null}
              
              {formState.productId && isClient && (
                <div>
                  <Text as="h3" variant="headingMd" tone="subdued">
                    Live Preview
                  </Text>
                  <CustomQRCodeGenerator
                    url={`${typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/qrcodes/${qrCode.id || 'preview'}/scan`}
                    customization={{
                      foregroundColor: formState.foregroundColor,
                      backgroundColor: formState.backgroundColor,
                      logoUrl: formState.logoUrl,
                      frameStyle: formState.frameStyle,
                      callToAction: formState.callToAction,
                      cornerRadius: formState.cornerRadius,
                      dotStyle: formState.dotStyle,
                      eyeStyle: formState.eyeStyle,
                      gradientType: formState.gradientType,
                      gradientColor1: formState.gradientColor1,
                      gradientColor2: formState.gradientColor2,
                    }}
                    onImageGenerated={setCustomQRImage}
                  />
                </div>
              )}
              
              {formState.productId && !isClient && (
                <div>
                  <Text as="h3" variant="headingMd" tone="subdued">
                    Live Preview
                  </Text>
                  <div style={{
                    textAlign: 'center',
                    padding: '20px',
                    backgroundColor: '#f9f9f9',
                    border: '1px dashed #ccc',
                    borderRadius: '8px'
                  }}>
                    <div style={{
                      width: '300px',
                      height: '300px',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px dashed #ccc',
                      margin: '0 auto',
                      borderRadius: '4px'
                    }}>
                      Loading QR Code Preview...
                    </div>
                    {formState.callToAction && (
                      <div style={{
                        marginTop: '10px',
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: formState.foregroundColor || '#000000'
                      }}>
                        {formState.callToAction}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {!formState.productId && !qrCode.id && (
                <EmptyState image="">
                  Select a product to see QR code preview
                </EmptyState>
              )}
            </BlockStack>
            
            <BlockStack gap="300">
              <Button
                disabled={!qrCode?.image && !customQRImage}
                onClick={downloadQRCode}
                variant="primary"
              >
                Download
              </Button>
              <Button
                disabled={!qrCode.id}
                url={`/qrcodes/${qrCode.id}`}
                target="_blank"
              >
                Go to public URL
              </Button>
            </BlockStack>
          </Card>
          
          {qrCode.scanLogs && qrCode.scanLogs.length > 0 && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingLg">
                  Recent Scan Analytics
                </Text>
                <DataTable
                  columnContentTypes={[
                    'text',
                    'text',
                    'text',
                    'text',
                    'text',
                    'text'
                  ]}
                  headings={[
                    'Date & Time',
                    'Device Type',
                    'Browser',
                    'Operating System',
                    'Location',
                    'IP Address'
                  ]}
                  rows={qrCode.scanLogs.map((scan) => [
                    new Date(scan.scannedAt).toLocaleString(),
                    <Badge tone={scan.deviceType === 'Mobile' ? 'info' : scan.deviceType === 'Tablet' ? 'attention' : 'success'}>
                      {scan.deviceType || 'Unknown'}
                    </Badge>,
                    scan.browser || 'Unknown',
                    scan.os || 'Unknown',
                    `${scan.city || 'Unknown'}, ${scan.country || 'Unknown'}`,
                    scan.ipAddress || 'Unknown'
                  ])}
                />
                {qrCode.scans > qrCode.scanLogs.length && (
                  <Text as="p" variant="bodyMd" tone="subdued">
                    Showing {qrCode.scanLogs.length} of {qrCode.scans} total scans
                  </Text>
                )}
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
        <Layout.Section>
          <PageActions
            secondaryActions={[
              {
                content: "Delete",
                loading: isDeleting,
                disabled: !qrCode.id || !qrCode || isSaving || isDeleting,
                destructive: true,
                outline: true,
                onAction: () =>
                  submit({ action: "delete" }, { method: "post" }),
              },
            ]}
            primaryAction={{
              content: "Save",
              loading: isSaving,
              disabled: !isDirty || isSaving || isDeleting,
              onAction: handleSave,
            }}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
