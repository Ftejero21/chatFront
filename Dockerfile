FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG BACKEND_BASE_URL=http://localhost:8080/TejeChat
RUN sed -i "s|https://tu-backend-produccion.com/TejeChat|${BACKEND_BASE_URL}|g" src/app/environments.prod.ts
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/chat-front/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
