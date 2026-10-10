FROM node:20-bookworm AS deps

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-bookworm AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# The project currently has no /public directory; ensure it exists so the
# COPY below always has a source, even if it stays empty.
RUN mkdir -p public && npm run build

FROM node:20-bookworm-slim AS production

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public

RUN groupadd --system nextjs && useradd --system --gid nextjs nextjs \
    && chown -R nextjs:nextjs /app
USER nextjs

EXPOSE 3000

CMD ["npm", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
