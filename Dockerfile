FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY . .
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV HIPPO_ROLE=all
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/src/queries ./src/queries
COPY --from=build /app/src/sql ./src/sql
COPY --from=build /app/db ./db
EXPOSE 3000
CMD ["npm", "run", "start"]
