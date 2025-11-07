FROM node:20-alpine AS build
WORKDIR /app
COPY apps/web/package.json apps/web/package-lock.json* ./ 
RUN npm i --silent || yarn
# Build-time configuration
ARG VITE_API_URL
ARG VITE_CESIUM_ION_TOKEN
ENV VITE_API_URL=${VITE_API_URL}
ENV VITE_CESIUM_ION_TOKEN=${VITE_CESIUM_ION_TOKEN}
COPY apps/web/ .
RUN mkdir -p public/cesium && cp -R node_modules/cesium/Build/Cesium/* public/cesium/
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80



