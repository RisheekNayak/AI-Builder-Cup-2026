FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build the Next.js app
# (We pass a dummy NEXT_PUBLIC_API_URL so it compiles if it requires it, but we can override at runtime if using a proxy, or build time is strictly needed for static generation)
# Next.js bundles NEXT_PUBLIC_ vars at BUILD time. So we need it here.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
