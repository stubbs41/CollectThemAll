/**
 * Create Missing Card Files Script
 * 
 * This script creates empty JSON files for the missing card data files
 * that are causing 404 errors in the browser.
 */

const fs = require('fs');
const path = require('path');

// List of missing card files from the browser console
const missingFiles = [
  'ecard3.json',
  'base3.json',
  'swsh10.json',
  'ex7.json',
  'base6.json'
];

// Directory to create the files in
const cardsDir = path.join(process.cwd(), 'public', 'data', 'cards');

// Create the directory if it doesn't exist
if (!fs.existsSync(cardsDir)) {
  fs.mkdirSync(cardsDir, { recursive: true });
  console.log(`Created directory: ${cardsDir}`);
}

// Create empty JSON files for each missing file
missingFiles.forEach(filename => {
  const filePath = path.join(cardsDir, filename);
  
  // Check if the file already exists
  if (fs.existsSync(filePath)) {
    console.log(`File already exists: ${filePath}`);
    return;
  }
  
  // Create an empty array as the file content
  fs.writeFileSync(filePath, '[]');
  console.log(`Created empty file: ${filePath}`);
});

console.log('Done creating missing card files!');
