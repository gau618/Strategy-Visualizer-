// backend/utils/configLoader.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let config = null;

function loadConfig(configPath = '../../config.json') {
  if (config) {
    return config;
  }
  try {
    const absolutePath = path.join(__dirname, configPath);
    const rawData = fs.readFileSync(absolutePath, 'utf8');
    config = JSON.parse(rawData);
    console.log('✅ Configuration loaded successfully.');
    return config;
  } catch (error) {
    console.error('❌ FATAL ERROR: Could not load or parse config.json. The application cannot start.', error);
    process.exit(1); // Exit because the config is essential for operation.
  }
}

// Load the config once and export it for other modules to use.
export const AppConfig = loadConfig();
