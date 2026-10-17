FROM node:24-bookworm-slim AS frontend
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.js ./
COPY src ./src
COPY public ./public
RUN npm run build && npm prune --omit=dev

FROM python:3.12-slim-bookworm AS runtime
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libstdc++6 libgomp1 \
    && rm -rf /var/lib/apt/lists/*
COPY --from=frontend /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend /app/node_modules ./node_modules
COPY --from=frontend /app/dist ./dist
COPY package.json ./
COPY server ./server
COPY experiments/corrosion/model_src ./experiments/corrosion/model_src
COPY experiments/corrosion/infer.py experiments/corrosion/worker.py experiments/corrosion/download_weights.py ./experiments/corrosion/
RUN python -m venv /opt/corrosion \
    && /opt/corrosion/bin/pip install --no-cache-dir torch==2.10.0 torchvision==0.25.0 --index-url https://download.pytorch.org/whl/cpu \
    && /opt/corrosion/bin/pip install --no-cache-dir numpy==2.5.2 pillow==12.3.0
RUN python experiments/corrosion/download_weights.py \
    --member "Corrosion Condition State Classification - Trained Model/l2_loss/weights_35.pt" \
    --output experiments/corrosion/weights/l2_loss_weights_35.pt \
    && python -c "import hashlib,pathlib; p=pathlib.Path('experiments/corrosion/weights/l2_loss_weights_35.pt'); assert hashlib.file_digest(p.open('rb'),'sha256').hexdigest() == '07278842fb12931fa5aca2ed5573fe2d2d7529be8150ddecf65bc31f9a1ea477', 'Unexpected model checksum'"
RUN useradd --uid 10001 --create-home smartscrap && mkdir -p /app/data && chown smartscrap:smartscrap /app/data
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 \
    DB_PATH=/app/data/smartscrap.sqlite \
    CORROSION_DATA_DIR=/app/data/visual-analyses \
    CORROSION_PYTHON=/opt/corrosion/bin/python \
    CORROSION_WEIGHTS=/app/experiments/corrosion/weights/l2_loss_weights_35.pt \
    PYTHONDONTWRITEBYTECODE=1 PYTHONNOUSERSITE=1
USER smartscrap
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD ["node", "--input-type=module", "-e", "const r=await fetch('http://127.0.0.1:'+process.env.PORT+'/api/health');if(!r.ok)process.exit(1)"]
CMD ["node", "server/index.js"]
