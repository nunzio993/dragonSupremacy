FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json ./

# Copy workspace packages
COPY ../packages ./packages

# Install dependencies
RUN npm install

# Copy source
COPY . .

# Build
RUN npm run build

# Expose port
EXPOSE 3001

# Run migrations and start
CMD ["sh", "-c", "npm run db:migrate && npm start"]
