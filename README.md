# Graphical System v2 - Work Orders Management

This is a comprehensive work order management system built with React and Node.js, featuring inventory tracking, work order processing, and PDF generation capabilities.

## System Features

- **Work Order Management**: Create, edit, and track work orders with complete lifecycle management
- **Inventory Integration**: Real-time inventory tracking with FIFO (First In, First Out) deduction
- **PDF Generation**: Automatic PDF generation for work orders with invoice links
- **Multi-mechanic Support**: Track multiple mechanics and hours per work order
- **Status Tracking**: PROCESSING → APPROVED → FINISHED workflow
- **Trailer Management**: Integration with trailer location and pending parts
- **Real-time Updates**: Smart polling system with server status monitoring

## Deployment on Render

This application is configured for deployment on Render.com with the following setup:

### Prerequisites

1. GitHub repository connected to Render
2. Railway MySQL database (or compatible MySQL database)
3. Environment variables configured in Render

### Environment Variables (Configure in Render Dashboard)

```
MYSQL_HOST=your-database-host
MYSQL_USER=your-database-user  
MYSQL_PASSWORD=your-database-password
MYSQL_DATABASE=your-database-name
MYSQL_PORT=3306
NODE_ENV=production
```

### Deployment Steps

1. **Connect Repository**: Link your GitHub repository to Render
2. **Configure Service**: 
   - Type: Web Service
   - Build Command: `npm install && npm run build`
   - Start Command: `npm start`
   - Environment: Node
3. **Set Environment Variables**: Add all MySQL configuration variables
4. **Deploy**: Render will automatically deploy when you push to main branch

### Build Configuration

The project uses these key scripts:
- `npm run build`: Builds React frontend and installs backend dependencies
- `npm start`: Starts the Node.js backend server (serves both API and static files)
- `npm run dev`: Runs frontend in development mode

### Architecture

- **Frontend**: React 19 with TypeScript, Material-UI components
- **Backend**: Node.js/Express API server
- **Database**: MySQL with optimized queries and connection pooling
- **File Storage**: Local file system for PDFs and uploads
- **PDF Generation**: jsPDF with custom templates and invoice links

---

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
