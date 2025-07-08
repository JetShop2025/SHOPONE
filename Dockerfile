# Use official Node.js runtime as parent image
FROM node:18-alpine

# Set the working directory
WORKDIR /app

# Copy package.json files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd backend && npm install

# Copy the rest of the application
COPY . .

# Build the React app
RUN npm run build

# Expose port
EXPOSE 10000

# Set environment to production
ENV NODE_ENV=production

# Start the server
CMD ["npm", "start"]
