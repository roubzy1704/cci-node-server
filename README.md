# Express OAuth2 Application with Redis Session Management

This project demonstrates a secure OAuth2 authentication flow with Express, integrating Redis for session management and emphasizing advanced security configurations.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Setup & Installation](#setup--installation)
- [Environment Configuration](#environment-configuration)
- [Usage](#usage)
- [Utilities](#utilities)
- [Error Handling](#error-handling)

## Features

- **OAuth2 Authentication**: Provides a secure method for user authentication using the OAuth2 protocol.
- **Redis Integration**: Utilizes Redis for robust and persistent session management.
- **Rate Limiting**: Implements throttling to prevent request abuse.
- **Enhanced Security**: Adopts best-practice security headers and configurations.

## Prerequisites

- [Node.js and npm](https://nodejs.org/)
- [Redis](https://redis.io/download)

## Setup & Installation


1. **Clone the Repository**:
    ```
    git clone <repository_url>
       
    ```
2. **Navigate to Project Directory**:
	```
	cd <project_directory>
	``` 
3. **Install Dependencies**:
	```
	npm install
	```
4. **Set Up Environment Variables**:
	```
	cp .env.example .env
	```
	
## Environment Configuration

Populate the `.env` file with the following required values:
```
CLIENT_ID: Your OAuth2 client ID.
CLIENT_SECRET: Your OAuth2 client secret.
REDIRECT_URI: Redirect URI for OAuth2.
OAUTH_STEP_ONE_GET_ENDPOINT: OAuth2 first step endpoint.
OAUTH_STEP_TWO_POST_ENDPOINT: OAuth2 second step endpoint.
SCOPE: OAuth2 scope.
SERVER_PORT: Port number for the Express server.
REDIS_HOST: Host for the Redis server.
REDIS_PORT: Port number for the Redis server.
RATE_LIMIT_MINUTES: Rate limit duration in minutes.
RATE_LIMIT_MAX_REQUESTS: Maximum number of requests in the rate limit duration.
NODE_ENV: Application environment (either development or production).
```

## Usage

Start the server with:
```
node main.js
```

This will initialize the Express server, and it will be listening on the port specified in the `.env` file.

## Utilities

Utility functions in `utils.js` assist in generating random state values, code verifiers, and code challenges essential for the OAuth2 authentication process.

## Error Handling

Centralized error handling is managed using `errorHandlers.js`, which provides responses for `404 (Not Found)` and `500 (Internal Server Error)` errors.
