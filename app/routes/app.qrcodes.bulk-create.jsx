import { useState } from "react";
import { json, redirect } from "@remix-run/node";
import {
  useActionData,
  useNavigation,
  useSubmit,
  useNavigate,
} from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Card,
  Button,
  Layout,
  Page,
  Text,
  TextField,
  BlockStack,
  PageActions,
  Banner,
  List,
  InlineStack,
} from "@shopify/polaris";

import db from '../db.server';
import { validateQRCode } from "../models/QRCode.server";

export async function action({ request }) {
  const { session, admin } = await authenticate.admin(request);
  const { shop } = session;

  const formData = await request.formData();
  const productNames = formData.get("productNames");
  const destination = formData.get("destination") || "product";

  if (!productNames) {
    return json({ error: "Product names are required" }, { status: 422 });
  }

  const names = productNames.split('\n').map(name => name.trim()).filter(name => name);
  
  if (names.length === 0) {
    return json({ error: "Please enter at least one product name" }, { status: 422 });
  }

  const results = [];
  const errors = [];

  for (const productName of names) {
    try {
      // Search for product by title using GraphQL
      const response = await admin.graphql(
        `
          query searchProducts($query: String!) {
            products(first: 1, query: $query) {
              nodes {
                id
                title
                handle
                variants(first: 1) {
                  nodes {
                    id
                  }
                }
                media(first: 1) {
                  nodes {
                    preview {
                      image {
                        altText
                        url
                      }
                    }
                  }
                }
              }
            }
          }
        `,
        {
          variables: {
            query: `title:*${productName}*`,
          },
        }
      );

      const {
        data: { products },
      } = await response.json();

      if (products.nodes.length > 0) {
        const product = products.nodes[0];
        
        const qrCodeData = {
          title: `QR Code for ${product.title}`,
          productId: product.id,
          productVariantId: product.variants.nodes[0]?.id || "",
          productHandle: product.handle,
          destination,
          shop,
        };

        const validationErrors = validateQRCode(qrCodeData);
        
        if (!validationErrors) {
          const qrCode = await db.qRCode.create({ data: qrCodeData });
          results.push({
            productName,
            productTitle: product.title,
            qrCodeId: qrCode.id,
            success: true,
          });
        } else {
          errors.push({
            productName,
            error: "Validation failed",
            details: validationErrors,
          });
        }
      } else {
        errors.push({
          productName,
          error: "Product not found",
        });
      }
    } catch (error) {
      errors.push({
        productName,
        error: error.message,
      });
    }
  }

  return json({ results, errors });
}

export default function BulkCreateQRCodes() {
  const actionData = useActionData();
  const [productNames, setProductNames] = useState("");
  const [destination, setDestination] = useState("product");
  
  const nav = useNavigation();
  const isSubmitting = nav.state === "submitting";
  
  const navigate = useNavigate();
  const submit = useSubmit();

  function handleSubmit() {
    const formData = new FormData();
    formData.append("productNames", productNames);
    formData.append("destination", destination);
    
    submit(formData, { method: "post" });
  }

  return (
    <Page>
      <ui-title-bar title="Bulk Create QR Codes">
        <button variant="breadcrumb" onClick={() => navigate("/app")}>
          QR codes
        </button>
      </ui-title-bar>
      
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            {actionData?.error && (
              <Banner status="critical">
                {actionData.error}
              </Banner>
            )}
            
            {actionData?.results && (
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Results
                  </Text>
                  
                  {actionData.results.length > 0 && (
                    <Banner status="success">
                      Successfully created {actionData.results.length} QR code{actionData.results.length > 1 ? 's' : ''}
                    </Banner>
                  )}
                  
                  {actionData.errors && actionData.errors.length > 0 && (
                    <Banner status="warning">
                      <BlockStack gap="200">
                        <Text>Failed to create QR codes for the following products:</Text>
                        <List>
                          {actionData.errors.map((error, index) => (
                            <List.Item key={index}>
                              <strong>{error.productName}</strong>: {error.error}
                            </List.Item>
                          ))}
                        </List>
                      </BlockStack>
                    </Banner>
                  )}
                  
                  {actionData.results.length > 0 && (
                    <InlineStack gap="200">
                      <Button onClick={() => navigate("/app")}>
                        View All QR Codes
                      </Button>
                      <Button 
                        variant="plain" 
                        onClick={() => {
                          setProductNames("");
                          navigate("/app/qrcodes/bulk-create", { replace: true });
                        }}
                      >
                        Create More
                      </Button>
                    </InlineStack>
                  )}
                </BlockStack>
              </Card>
            )}
            
            <Card>
              <BlockStack gap="500">
                <Text as="h2" variant="headingLg">
                  Product Names
                </Text>
                <TextField
                  label="Enter product names (one per line)"
                  value={productNames}
                  onChange={setProductNames}
                  multiline={6}
                  placeholder={`Example:
T-Shirt Blue
Wireless Headphones
Coffee Mug
Running Shoes`}
                  helpText="Enter each product name on a new line. The system will search for products matching these names."
                />
              </BlockStack>
            </Card>
            
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingLg">
                  QR Code Settings
                </Text>
                <TextField
                  label="Destination"
                  value={destination}
                  onChange={setDestination}
                  select
                  options={[
                    { label: "Product page", value: "product" },
                    { label: "Add to cart", value: "cart" },
                  ]}
                  helpText="Choose where customers will be directed when they scan the QR code"
                />
              </BlockStack>
            </Card>
          </BlockStack>
        </Layout.Section>
        
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Create QR Codes",
              loading: isSubmitting,
              disabled: !productNames.trim() || isSubmitting,
              onAction: handleSubmit,
            }}
            secondaryActions={[
              {
                content: "Cancel",
                onAction: () => navigate("/app"),
              },
            ]}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}