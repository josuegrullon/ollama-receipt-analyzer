// Example Express endpoint to handle receipt processing
import express from 'express';

// Types for our data structures
interface Vendor {
    id: number;
    name: string;
  }
  
  interface Product {
    id: number;
    name: string;
  }
  
  interface ProcessedReceipt {
    merchant: {
      extracted_name: string;
      confidence: number;
      suggested_matches: Array<{ id: number; name: string; confidence: number }>;
    };
    items: Array<{
      raw_text: string;
      normalized_name: string;
      price: number;
      in_database: boolean;
      similar_products: Array<{ id: number; name: string }>;
    }>;
    transaction: {
      date: string;
      total: number;
      tax: number;
      payment_method: string | null;
    };
  }
  
  async function processReceipt(
    ocrText: string,
    knownVendors: Vendor[],
    knownProducts: Product[]
  ): Promise<ProcessedReceipt> {
    // Format database context
    const context = {
      known_vendors: knownVendors.map(v => ({ id: v.id, name: v.name })),
      known_products: knownProducts.map(p => ({ id: p.id, name: p.name }))
    };
  
    // Prepare prompt with context
    const prompt = `
      CONTEXT:
      Known Vendors: ${JSON.stringify(context.known_vendors)}
      Known Products: ${JSON.stringify(context.known_products)}
  
      RECEIPT TEXT:
      ${ocrText}
  
      Analyze this receipt text. Match vendors and products with the provided database entries.
    `;
  
    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'receipt-analyzer',
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.3,
            num_predict: 1000
          }
        })
      });
  
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
  
      const data = await response.json();
      return JSON.parse(data.response);
    } catch (error) {
      console.error('Error processing receipt:', error);
      throw error;
    }
  }
  

  const app = express();
  app.use(express.json());
  
  app.post('/api/process-receipt', async (req, res) => {
    try {
      const { ocrText, vendors, products } = req.body;
      
      const result = await processReceipt(
        ocrText,
        vendors as Vendor[],
        products as Product[]
      );
      
      res.json(result);
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ error: 'Failed to process receipt' });
    }
  });
  
  // Example usage:
  const testReceipt = `WALMART
  123 Main St
  2024-12-22
  Milk 2% 3.99
  Bread 2.49
  Total: 6.48`;
  
  const testVendors: Vendor[] = [
    { id: 1, name: "WALMART SUPERCENTER" },
    { id: 2, name: "WALMART NEIGHBORHOOD" },
    { id: 3, name: "TARGET" }
  ];
  
  const testProducts: Product[] = [
    { id: 101, name: "Great Value 2% Milk" },
    { id: 102, name: "Wonder Bread White" }
  ];
  
  // Example API test
  async function test() {
    try {
      const result = await processReceipt(testReceipt, testVendors, testProducts);
      console.log(JSON.stringify(result, null, 2));
    } catch (error) {
      console.error('Test failed:', error);
    }
  }