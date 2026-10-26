FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=47831
COPY --chown=node:node package.json ./
COPY --chown=node:node server ./server
COPY --chown=node:node js ./js
COPY --chown=node:node css ./css
COPY --chown=node:node assets ./assets
COPY --chown=node:node index.html ./
USER node
EXPOSE 47831
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["node", "server/index.cjs"]
