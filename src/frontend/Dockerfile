# # Stage 1: Build the React app with Node.js
# FROM node:18-alpine as build

# WORKDIR /app

# # Copy package files
# COPY package*.json ./

# # Install ALL dependencies (including devDependencies like Vite)
# RUN npm ci

# # Accept build arguments
# ARG REACT_APP_HOST_IP
# ARG REACT_APP_WS_PROTOCOL
# ARG REACT_APP_WS_PATH

# # Set environment variables
# ENV REACT_APP_HOST_IP=$REACT_APP_HOST_IP
# ENV REACT_APP_WS_PROTOCOL=$REACT_APP_WS_PROTOCOL
# ENV REACT_APP_WS_PATH=$REACT_APP_WS_PATH
# # Copy the rest of the app
# COPY . .

# # Ensure vite binary is accessible
# ENV PATH=/app/node_modules/.bin:$PATH

# # Build for production (Vite builds to 'dist' folder)
# RUN npm run build

# # Stage 2: Export build files to volume
# FROM alpine:latest
# WORKDIR /app
# COPY --from=build /app/dist ./dist
# VOLUME ["/app/dist"]


# Stage 1: Build React app
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build

# Stage 2: NGINX
FROM nginx:alpine

# Copy built app
COPY --from=build /app/dist /usr/share/nginx/html/app
COPY nginx.conf /etc/nginx/conf.d/default.conf
# Expose nginx port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]