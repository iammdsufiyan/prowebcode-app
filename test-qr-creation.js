// Simple test script to demonstrate QR code creation by product name
// This shows how the app searches for products and creates QR codes

const testProductNames = [
  "T-Shirt",
  "Coffee Mug", 
  "Wireless Headphones",
  "Running Shoes"
];

console.log("Testing QR Code Creation by Product Names:");
console.log("==========================================");

testProductNames.forEach((productName, index) => {
  console.log(`${index + 1}. Product Name: "${productName}"`);
  console.log(`   - Search Query: title:*${productName}*`);
  console.log(`   - QR Code Title: "QR Code for ${productName}"`);
  console.log(`   - Destination: Product page or Add to cart`);
  console.log("");
});

console.log("Features Available:");
console.log("- Single QR code creation with product search");
console.log("- Bulk QR code creation by entering multiple product names");
console.log("- Download individual QR codes");
console.log("- Download selected QR codes as ZIP");
console.log("- Download all QR codes as ZIP");