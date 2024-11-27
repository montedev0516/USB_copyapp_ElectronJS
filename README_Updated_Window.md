# Project Setup and Usage Guide for Windows

## 🖥️ Environment Setup

### Prerequisites
Ensure you have the following installed:

- **Node.js**: v18.19.0  
- **npm**: v10.9.0  
- **Visual Studio Community 2022**  
- **Visual Studio DevTools 2022**  
- **Cygwin**: Install with the following packages:
  - `asar`
  - `zip`
  - `unzip`



## 🚀 Running the Project

### 1. Set Up the Encryption Tool

1. **Navigate to the `sys/encrypt` directory** in your project.
2. **Clean up existing dependencies**:
   - Remove `node_modules` and `package-lock.json`.
     ```bash
     rm -rf node_modules package-lock.json
     ```
3. **Install dependencies** and start the encryption tool:
   ```bash
   npm install
   npm start
   ```
4. The encryption tool should now be running successfully.

---

### 2. Modify the `sys` Folder

1. **Copy the `password.js` file** from `encrypt/src` to `sys/src`.
2. **Encrypt a sample audio** file and place it in the desired output folder.
3. In `sys/src/locator.json`, update the `shared` variable to point to the output folder you just created.

---

### 3. Set Up the USB Copy Tool

1. **Open `enctooldoor`** and set the `vid` and `pid` values to match the ones configured in the encryption tool.
2. In `sys/src/usbcopypro.json`, set the path to the shared folder where the encrypted files are stored.
3. **Run the `link.sh` script** in the Cygwin terminal to link everything together.

---

### 4. Run the Viewer Tool

1. Go to the `sys` directory.
2. **Remove `node_modules` and `package-lock.json`** again:
   ```bash
   rm -rf node_modules package-lock.json
   ```
3. **Install dependencies** and start the viewer tool:
   ```bash
   npm install
   npm start
   ```
4. The viewer tool should now be running successfully.

---

## 📦 Packaging the Project

Follow these steps to package the project for deployment.

### 1. Build the Project

1. Navigate to the **root directory** of your project.
2. **Run the `build_everything.sh` script** using the Cygwin terminal:
   ```bash
   ./build_everything.sh
   ```
   - This will first run the `package.sh` script in the `encrypt` folder.
   - Then, it will run the `package.sh` script in the `sys` folder.
   - Both tools will build and zip the encrypt and viewer projects.

### 2. Install the Project

1. After the build completes, **run the `install.sh` script** to unzip the packaged files to `C:/Program Files (x86)/usbcopypro`.
   ```bash
   ./install.sh
   ```

---

## 📋 Summary of Commands

### Encryption Tool Setup

```bash
# In sys/encrypt directory:
rm -rf node_modules package-lock.json
npm install
npm start
```

### Viewer Tool Setup

```bash
# In sys directory:
rm -rf node_modules package-lock.json
npm install
npm start
```

### Packaging

```bash
# In root directory:
./build_everything.sh
./install.sh
```

---

## 🚧 Troubleshooting

- **Error: "Missing dependencies"**: Ensure all necessary packages (such as `asar`, `zip`, and `unzip`) are installed in Cygwin.
- **Error: "Module not found"**: Double-check that you’ve copied `password.js` to the correct location.
- **Error: "Failed to encrypt"**: Verify that your output folder is correctly specified in `locator.json`.

---
