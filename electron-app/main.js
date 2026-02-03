const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { SerialPort } = require('serialport');
require('dotenv').config();

let mainWindow;
let activePort = null;

const createMainWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        title: "Kasaba POS Native",
        icon: path.join(__dirname, 'icon.png'), // Ensure this file exists or is handled
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
    });

    // Smart URL Handling
    const isDev = process.env.NODE_ENV === 'development';
    const startUrl = isDev ? 'http://localhost:3000' : 'https://kasaba-saas.vercel.app';

    console.log(`Loading: ${startUrl}`);
    mainWindow.loadURL(startUrl);

    // Open DevTools
    // mainWindow.webContents.openDevTools();

    // Open DevTools in Dev mode
    if (isDev) {
        mainWindow.webContents.openDevTools();
    }
};

app.whenReady().then(() => {
    createMainWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});


// --- IPC Handlers for Serial Port ---

// 1. List Ports
ipcMain.handle('scale-list-ports', async () => {
    try {
        const ports = await SerialPort.list();
        return { success: true, ports };
    } catch (error) {
        console.error('List Ports Error:', error);
        return { success: false, error: error.message };
    }
});

// 2. Connect to Port
ipcMain.handle('scale-connect', async (event, path) => {
    if (activePort && activePort.isOpen) {
        activePort.close();
    }

    return new Promise((resolve) => {
        activePort = new SerialPort({
            path: path,
            baudRate: 9600,
            dataBits: 8,
            stopBits: 1,
            parity: 'none',
            autoOpen: false,
        });

        activePort.open((err) => {
            if (err) {
                console.error('Error opening port:', err);
                resolve({ success: false, error: err.message });
            } else {
                console.log(`Connected to ${path}`);
                resolve({ success: true });
            }
        });

        // Handle errors globally regarding this port
        activePort.on('error', (err) => {
            console.error('Port Error:', err);
            if (mainWindow) {
                mainWindow.webContents.send('scale-error', err.message);
            }
        });
    });
});

// 3. Send Data (Raw String)
ipcMain.handle('scale-send-data', async (event, data) => {
    if (!activePort || !activePort.isOpen) {
        return { success: false, error: "Port not open" };
    }

    return new Promise((resolve) => {
        activePort.write(data, 'utf8', (err) => {
            if (err) {
                resolve({ success: false, error: err.message });
            } else {
                resolve({ success: true });
            }
        });
    });
});

// 4. Test Connection
ipcMain.handle('scale-test-connection', async (event) => {
    console.log("Testing connection...");
    if (!activePort || !activePort.isOpen) {
        return { success: false, error: "Port not open" };
    }

    // Send a safe/command query if known, or just a dummy string to verify write
    // For Rongta, often just sending data works, but maybe a status command?
    // Using a safe test string.
    const testPayload = "TEST_CONNECTION\n";

    return new Promise((resolve) => {
        activePort.write(testPayload, (err) => {
            if (err) resolve({ success: false, error: err.message });
            else resolve({ success: true, message: "Data Sent" });
        });
    });
});
