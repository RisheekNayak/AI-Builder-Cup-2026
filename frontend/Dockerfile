FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Next.js bundles this public URL at build time. Fail before building
# if deployment omitted it, instead of shipping a localhost fallback.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN test -n "$NEXT_PUBLIC_API_URL"

RUN npm run build

ENV PORT=8080
EXPOSE 8080

CMD ["npm", "start"]
