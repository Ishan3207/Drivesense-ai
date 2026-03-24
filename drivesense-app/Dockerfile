FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install --legacy-peer-deps

# Copy application files
COPY . .

# Expose Expo web port
EXPOSE 8081

# Command to start Expo web
CMD ["npm", "run", "web"]
