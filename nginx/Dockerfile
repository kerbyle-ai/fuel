FROM node:22-alpine AS frontend-builder
WORKDIR /app/frontend
ARG VITE_API_URL=/api
ARG VITE_DONATION_URL=https://boosty.to/toplivo
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_DONATION_URL=${VITE_DONATION_URL}
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci 2>/dev/null || npm install
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=frontend-builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
