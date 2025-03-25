# CodingCam - Extension

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Overview

This repository contains the code for the CodingCam extension, designed for IDEs like VS Code.  The extension is the core data collection component of the CodingCam system.  It runs in the background, monitoring your coding activity in real-time and sending the data securely to the [CodingCam Backend](https://github.com/Haseeb-Arshad/codingcam-backend). The data is then used to power the visualizations and insights in the [CodingCam Frontend]([<your-frontend-repo-url>](https://github.com/Haseeb-Arshad/CodingCam)).

## Features

*   **Real-time Activity Tracking:**  Monitors coding activity as it happens, capturing keystrokes, active file, project, and language.
*   **Idle Detection:**  Detects periods of inactivity (7 minutes by default) to accurately track focused coding sessions.
*   **Project and Language Detection:**  Identifies the current project and programming language being used.
*   **Secure Data Transmission:**  Sends collected data securely to the CodingCam backend using HTTPS.
*   **Minimal Performance Impact:**  Designed to run efficiently in the background without significantly impacting IDE performance.
*   **User Authentication:** Securely authenticates with the backend using user credentials.

## Technologies Used
* **Typescript:**  A superset of JavaScript that adds static typing.
* **VS Code API** (if targeting VS Code):  The API provided by VS Code for building extensions.  If you're building for other IDEs, you'll need to list their respective APIs.
*   **Node.js:**  Used for the extension's backend logic (if applicable).

## Installation (For Developers)
*Detailed installation/development instructions will be highly specific to the IDE you're targeting (VS Code, IntelliJ, etc.).  Here's a general outline, assuming you're building a VS Code extension:*

1.  **Prerequisites:**
    *   Node.js (v16 or higher recommended)
    *   npm (or yarn)
    *   VS Code
    *   The `yo` and `generator-code` packages (for scaffolding a VS Code extension): `npm install -g yo generator-code`

2.  **Clone the repository:**

    ```bash
    git clone https://github.com/Haseeb-Arshad/codingcam-extension.git
    cd codingcam-extension
    ```

3.  **Install dependencies:**

    ```bash
    npm install
    # or
    yarn install
    ```
4.  **Create the .env file:**
    Create a .env file in the root of your project
    ```
    API_BASE_URL=http://localhost:3001/api  
    ```
    Adjust the 'API_BASE_URL' variable based on where your local backend is running.
5. **Open in VS Code:**
  ```bash
    code .
