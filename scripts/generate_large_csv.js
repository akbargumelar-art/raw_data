import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const FILENAME = 'products_large.csv';
const TARGET_ROWS = 100000; // 100k rows ~ 8-10MB. Increase to 500000 for ~50MB.
const OUTPUT_PATH = path.join(__dirname, '..', 'dummy', FILENAME);

// Ensure directory exists
if (!fs.existsSync(path.join(__dirname, '..', 'dummy'))) {
    fs.mkdirSync(path.join(__dirname, '..', 'dummy'));
}

const stream = fs.createWriteStream(OUTPUT_PATH);

console.log(`Generating ${TARGET_ROWS} rows of dummy data...`);
console.time('Generation Time');

// Write Headers
stream.write('sku,name,category,price,stock,warehouse_location\n');

// Helpers
const categories = ['Electronics', 'Furniture', 'Accessories', 'Office Supplies', 'Kitchen'];
const locations = ['A-01', 'B-12', 'C-05', 'D-99', 'E-10', 'W-Warehouse'];

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// Write Data
let i = 0;
function write() {
    let ok = true;
    do {
        i++;
        const sku = `SKU-${1000000 + i}`;
        const name = `Product Item Number ${i} - ${Math.random().toString(36).substring(7)}`;
        const category = getRandomElement(categories);
        const price = (Math.random() * 1000).toFixed(2);
        const stock = getRandomInt(0, 5000);
        const loc = getRandomElement(locations);

        const row = `${sku},${name},${category},${price},${stock},${loc}\n`;

        if (i === TARGET_ROWS) {
            stream.write(row, () => {
                stream.end();
                console.timeEnd('Generation Time');
                console.log(`Successfully created ${OUTPUT_PATH}`);
                console.log(`File size: ${(fs.statSync(OUTPUT_PATH).size / (1024 * 1024)).toFixed(2)} MB`);
            });
        } else {
            // See if we should continue, or wait
            // don't pass the callback, because we're not done yet.
            ok = stream.write(row);
        }
    } while (i < TARGET_ROWS && ok);

    if (i < TARGET_ROWS) {
        // Had to stop early!
        // Write some more once it drains
        stream.once('drain', write);
    }
}

write();