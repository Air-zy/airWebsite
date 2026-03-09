# airWebsite
[![Ask DeepWiki](https://devin.ai/assets/askdeepwiki.png)](https://deepwiki.com/Air-zy/airWebsite)

This repository contains the source code for a MONOLITH full-stack personal portfolio and project showcase website. Built with Node.js and Express.
The app  serves as both a personal hub and a platform for hosting a variety of web-based tools and demos, from an AI-powered Connect 4 game to an in-depth anime relationship graph.

## Features

*   **Dynamic Personal Website**: Serves a personal portfolio with skills, contact information, and a project showcase powered by a backend database.
*   **Interactive Tools & Visualizations**:
    *   **Anime Graph**: A D3.js-based force-directed graph visualizing relationships and recommendations between anime series.
    *   **Connect 4 AI**: A playable Connect 4 game against a Minimax-based AI.
    *   **Data Visualizers**: Includes tools for viewing server traffic, quadtree simulations, and game data leaderboards.
    *   **Web Apps**: A variety of smaller applications like a coin sorter, quadratic equation solver, and journal app.
*   **Backend API**: A RESTful API built with Express to serve data for projects, game statistics, system info, and handle authenticated user actions.
*   **Roblox Integration (ROWA)**:
    *   Features a dedicated PostgreSQL database (`rowaDB`) to log and retrieve player data and fight statistics for the Roblox game ROWA.
    *   Provides API endpoints for fetching player data, fight histories, and leaderboards.
    *   Includes a webhook to push code from Roblox Studio directly to a GitHub repository.
*   **Real-time Presence**: A WebSocket-based system to monitor and broadcast live status information, visible on the homepage.
*   **Custom Authentication**: A self-built user account system using Argon2 for secure password hashing and a session-based login mechanism.
*   **Custom Tooling**:
    *   **On-the-fly Asset Minification**: A custom build script minifies HTML, CSS, and JavaScript files from `/public` into a `/dist` directory upon server startup.
    *   **Environment Variable Encryption**: A custom AES-128-CBC implementation is used to encrypt and decrypt sensitive keys stored in the environment configuration.

## Tech Stack

*   **Backend**: Node.js, Express.js
*   **Frontend**: HTML5, CSS3, Vanilla JavaScript, D3.js
*   **Databases**: PostgreSQL, Firebase Firestore
*   **Real-time Communication**: WebSockets (`ws`)
*   **Key Libraries**:
    *   `argon2`: For password hashing.
    *   `express-rate-limit`: For API rate limiting.
    *   `node-fetch`: For making server-to-server HTTP requests.
    *   `html-minifier-terser`, `terser`, `clean-css`: For frontend asset minification.

## Getting Started

Follow these instructions to get a local copy of the project up and running.

### Prerequisites

*   Node.js (v18.x or later)
*   NPM (Node Package Manager)

### Installation

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/air-zy/airWebsite.git
    cd airWebsite
    ```

2.  **Install NPM packages:**
    ```sh
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and populate it with the necessary keys. Use the `.env.example` file as a template.

    | Variable                 | Description                                                                     |
    | ------------------------ | ------------------------------------------------------------------------------- |
    | `airKey`                 | The master secret key for the custom AES encryption/decryption module.          |
    | `airWebToken`            | A secret token for authorizing specific backend functionalities and webhooks.     |
    | `animePass`              | API password for commiting changes to the anime database.                       |
    | `discord`, `dwebhook`    | Discord invite link and webhook URL for notifications.                          |
    | `firebaseJsonKey`        | The encrypted Firebase service account JSON key.                                |
    | `publicClusterKey`       | Key for decrypting the list of cluster URLs for the heartbeat system.           |
    | `airClusterAcolyteToken` | Authorization token for the cluster's internal fetch gateway.                   |
    | `repoPat`                | A GitHub Personal Access Token (PAT) for pushing code from Roblox Studio.       |
    | `whookPass`              | Password for authenticating incoming webhooks.                                  |
    | `ROWA_DB`, `UTIL_DB`     | Encrypted JSON strings containing PostgreSQL connection details.                  |
    | `rowaDBPass`             | Middleware password to protect the `/api/rowadb` endpoint.                       |
    | `rowaCloudApi`           | API key for the Roblox Open Cloud API.                                          |

### Running the Application

Start the server using the following command:

```sh
npm start
```

The application will be available at `http://localhost:3000`. The server will first minify all frontend assets into the `src/dist` directory before serving them.

## Project Structure

The repository is organized into several key directories:

```
/
├── src/
│   ├── server.js              # Main application entry point
│   ├── DATABASE/              # PostgreSQL connection, schemas, and helpers
│   ├── FallbackEncryption/    # Custom AES encryption implementation
│   ├── firebase/              # Firebase Firestore integration logic
│   ├── heartSystem/           # Heartbeat service to keep external services warm
│   ├── modules/               # Reusable backend modules (account management, minifier)
│   ├── public/                # Source frontend assets (HTML, CSS, JS)
│   └── routes/                # Express route handlers and API logic
├── .env.example             # Template for environment variables
└── package.json             # Project dependencies and scripts

```
this readme is AI generated
