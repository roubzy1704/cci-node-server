# Express Server with OAuth2 Authentication and Oracle NetSuite REST API Integration.

This project demonstrates a secure OAuth2 authentication flow with Express, integrating Oracle NetSuite REST API.

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
- **Oracle NetSuite REST API**: Implements several routes to retrieve and update Oracle NetSuite records.
- **Rate Limiting**: Implements throttling to prevent request abuse.
- **Enhanced Security**: Adopts best-practice security headers and configurations.

## Prerequisites

- [Node.js and npm](https://nodejs.org/)

## Setup & Installation

* **Clone the Repository**:

###`git clone <repository_url>`

* **Navigate to Project Directory**:

###`cd <project_directory>`

* **Install Dependencies**:
   
###`npm install`

* **Set Up Environment Variables**:

###`cp .env.example .env`

## Environment Configuration

Populate the `.env` file with the required values.

## Usage

Start the server with:
`node main.js`
This will initialize the Express server, and it will be listening on the port specified in the `.env` file.

## Utilities

Utility functions in `utils.js` assist in generating random state values, code verifiers, and code challenges essential for the OAuth2 authentication process.

## Error Handling

Centralized error handling is managed using `errorHandlers.js`, which provides responses for `404 (Not Found)` and `500 (Internal Server Error)` errors.
