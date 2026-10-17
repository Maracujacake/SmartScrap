import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { transaction } from './database.js';
import { fail } from './validation.js';
import { materials as materialTypes } from './constants.js';
import { projectRoot, defaultPython, defaultWeights } from './visual-analysis/config.js';
import { PythonWorker } from './visual-analysis/python-worker.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const MAX_BYTES = 8 * 1024 * 1024;

export function createVisualAnalysisService(db, options = {}) {
  const root = resolve(
    options.root || process.env.CORROSION_DATA_DIR || join(projectRoot, 'data/visual-analyses'),
  );
  const worker = new PythonWorker(
    root,
    process.env.CORROSION_PYTHON || defaultPython,
    process.env.CORROSION_WEIGHTS || defaultWeights,
  );
  const runner = options.runner || ((job) => worker.run(job));
  const queue = [];
  let processing = false;
  let closed = false; // A dev restart must not leave a job permanently marked as running.
  db.prepare(
    "UPDATE visual_analyses SET status='failed',error='A análise foi interrompida pela reinicialização do serviço. Tente novamente.',updated_at=datetime('now') WHERE status IN ('queued','processing')",
  ).run();
  db.prepare('UPDATE visual_photos SET uploaded=0 WHERE uploaded=-1').run();
  function record(analysisId, user, requireOwner = false) {
    if (!uuid.test(String(analysisId))) {
      fail('Análise não encontrada.', 404);
    }
    const row = db.prepare('SELECT * FROM visual_analyses WHERE id=?').get(analysisId);
    if (!row) {
      fail('Análise não encontrada.', 404);
    }
    if (row.organization_id !== user.organization_id && (requireOwner || !row.lot_id)) {
      fail('Análise não encontrada.', 404);
    }
    if (
      user.organization_type === 'carrier' &&
      row.lot_id &&
      !db
        .prepare(
          `SELECT p.id FROM pickups p JOIN trades t ON t.id=p.trade_id JOIN transport_companies tc ON tc.id=p.transport_company_id WHERE t.lot_id=? AND p.transport_kind='external' AND tc.organization_id=?`,
        )
        .get(row.lot_id, user.organization_id)
    ) {
      fail('Análise não encontrada.', 404);
    }
    return row;
  }
  function serialize(row) {
    const result = row.result_json ? JSON.parse(row.result_json) : null;
    const photos = db
      .prepare(
        'SELECT position,original_name,uploaded FROM visual_photos WHERE analysis_id=? ORDER BY position',
      )
      .all(row.id);
    return {
      id: row.id,
      material: row.material,
      status: row.status,
      error: row.error,
      lot_id: row.lot_id,
      organization_id: row.organization_id,
      photo_count: row.photo_count,
      created_at: row.created_at,
      operator_verdict: row.operator_verdict,
      operator_notes: row.operator_notes,
      reviewed_by: row.reviewed_by,
      reviewed_at: row.reviewed_by ? row.updated_at : null,
      reviewed_by_name: row.reviewed_by
        ? db.prepare('SELECT name FROM users WHERE id=?').get(row.reviewed_by)?.name
        : null,
      result,
      photos: photos.map((photo) => ({
        ...photo,
        original_url:
          row.status === 'completed'
            ? `/api/visual-analyses/${row.id}/images/${photo.position}/original`
            : null,
        overlay_url:
          row.status === 'completed' && result?.scope === 'steel_corrosion'
            ? `/api/visual-analyses/${row.id}/images/${photo.position}/overlay`
            : null,
        mask_url:
          row.status === 'completed' && result?.scope === 'steel_corrosion'
            ? `/api/visual-analyses/${row.id}/images/${photo.position}/mask`
            : null,
      })),
    };
  }
  async function drain() {
    if (processing || closed) {
      return;
    }
    processing = true;
    try {
      while (queue.length && !closed) {
        const analysisId = queue.shift();
        const row = db.prepare('SELECT * FROM visual_analyses WHERE id=?').get(analysisId);
        if (!row || row.status !== 'queued') {
          continue;
        }
        db.prepare(
          "UPDATE visual_analyses SET status='processing',updated_at=datetime('now') WHERE id=?",
        ).run(analysisId);
        try {
          const result = await runner({
            id: analysisId,
            directory: join(root, analysisId),
            material: row.material,
            photo_count: row.photo_count,
          });
          if (closed) {
            break;
          }
          if (
            !result ||
            !['steel_corrosion', 'unsupported_material'].includes(result.scope) ||
            result.photos?.length !== row.photo_count
          ) {
            throw new Error('O modelo retornou uma resposta inválida.');
          }
          db.prepare(
            "UPDATE visual_analyses SET status='completed',result_json=?,error=NULL,updated_at=datetime('now') WHERE id=?",
          ).run(JSON.stringify(result), analysisId);
        } catch (error) {
          if (closed) {
            break;
          }
          db.prepare(
            "UPDATE visual_analyses SET status='failed',error=?,updated_at=datetime('now') WHERE id=?",
          ).run(String(error.message).slice(0, 500), analysisId);
        }
      }
    } finally {
      processing = false;
    }
  }
  return {
    status: () => ({
      available: Boolean(options.runner) || worker.available(),
      model: 'DeepLabV3+',
      backbone: 'ResNet101',
      supported_materials: ['Aço', 'Ferro'],
      max_photos: 3,
      max_bytes: MAX_BYTES,
    }),
    async create(user, body) {
      if (user.organization_type === 'carrier')
        fail(
          'Transportadoras consultam as fotografias dos seus fretes, sem cadastrar análises de lotes.',
          403,
        );
      if (!materialTypes.includes(body.material)) {
        fail('Selecione o material do lote.');
      }
      if (!Array.isArray(body.photos) || body.photos.length < 1 || body.photos.length > 3) {
        fail('Envie entre uma e três fotografias.');
      }
      const names = body.photos.map((photo) => {
        if (typeof photo !== 'string' || photo.trim().length < 1 || photo.length > 180) {
          fail('Nome de fotografia inválido.');
        }
        return photo.trim();
      });
      if (!options.runner && !existsSync(worker.python)) {
        fail(
          'O ambiente de análise local não está configurado. Consulte o guia de instalação.',
          503,
        );
      }
      if (body.material === 'Aço' || body.material === 'Ferro')
        if (!options.runner && !worker.available()) {
          fail('O modelo local não está configurado. Consulte o guia de análise visual.', 503);
        }
      const active = db
        .prepare(
          "SELECT COUNT(*) AS count FROM visual_analyses WHERE organization_id=? AND status IN ('uploading','queued','processing') AND created_at>datetime('now','-1 hour')",
        )
        .get(user.organization_id).count;
      if (active >= 10) {
        fail(
          'Sua organização tem muitas análises em aberto. Aguarde ou conclua as anteriores.',
          429,
        );
      }
      const analysisId = randomUUID();
      await mkdir(join(root, analysisId), {
        recursive: true,
      });
      transaction(db, () => {
        db.prepare(
          'INSERT INTO visual_analyses (id,organization_id,created_by,material,photo_count) VALUES (?,?,?,?,?)',
        ).run(analysisId, user.organization_id, user.id, body.material, names.length);
        names.forEach((name, index) =>
          db
            .prepare(
              'INSERT INTO visual_photos (analysis_id,position,original_name) VALUES (?,?,?)',
            )
            .run(analysisId, index, name),
        );
      });
      return serialize(record(analysisId, user));
    },
    async upload(user, analysisId, position, buffer) {
      const row = record(analysisId, user, true);
      if (row.status !== 'uploading' || row.lot_id) {
        fail('As fotografias desta análise não podem ser alteradas.', 409);
      }
      const index = Number(position);
      if (!Number.isInteger(index) || index < 0 || index >= row.photo_count) {
        fail('Posição da fotografia inválida.');
      }
      if (!Buffer.isBuffer(buffer) || buffer.length < 16 || buffer.length > MAX_BYTES) {
        fail('Envie uma fotografia de até 8 MB.');
      }
      const jpeg = buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255;
      const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      const webp =
        buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
      if (!jpeg && !png && !webp) {
        fail('Envie uma fotografia JPG, PNG ou WebP válida.');
      }
      const claimed = db
        .prepare(
          'UPDATE visual_photos SET uploaded=-1 WHERE analysis_id=? AND position=? AND uploaded=0',
        )
        .run(analysisId, index);
      if (!claimed.changes) {
        fail('Esta fotografia já foi enviada.', 409);
      }
      try {
        await writeFile(join(root, analysisId, `raw-${index}.bin`), buffer);
        db.prepare(
          'UPDATE visual_photos SET uploaded=1,bytes=? WHERE analysis_id=? AND position=?',
        ).run(buffer.length, analysisId, index);
      } catch (error) {
        db.prepare('UPDATE visual_photos SET uploaded=0 WHERE analysis_id=? AND position=?').run(
          analysisId,
          index,
        );
        throw error;
      }
    },
    start(user, analysisId) {
      const row = record(analysisId, user, true);
      if (!['uploading', 'failed'].includes(row.status) || row.lot_id) {
        fail('Esta análise já foi iniciada.', 409);
      }
      if (queue.length >= 20) {
        fail('A fila de análises está cheia. Tente novamente em alguns instantes.', 429);
      }
      const uploaded = db
        .prepare('SELECT COUNT(*) AS count FROM visual_photos WHERE analysis_id=? AND uploaded=1')
        .get(analysisId).count;
      if (uploaded !== row.photo_count) {
        fail('Envie todas as fotografias antes de iniciar a análise.', 409);
      }
      db.prepare(
        "UPDATE visual_analyses SET status='queued',error=NULL,updated_at=datetime('now') WHERE id=?",
      ).run(analysisId);
      queue.push(analysisId);
      void drain();
      return serialize(record(analysisId, user));
    },
    get: (user, analysisId) => serialize(record(analysisId, user)),
    forLot(user, lotId) {
      const row = db.prepare('SELECT * FROM visual_analyses WHERE lot_id=?').get(lotId);
      return row ? serialize(record(row.id, user)) : null;
    },
    image(user, analysisId, position, kind) {
      const row = record(analysisId, user);
      const index = Number(position);
      if (
        row.status !== 'completed' ||
        !Number.isInteger(index) ||
        index < 0 ||
        index >= row.photo_count ||
        !['original', 'overlay', 'mask'].includes(kind)
      ) {
        fail('Imagem não encontrada.', 404);
      }
      const result = JSON.parse(row.result_json);
      if (kind !== 'original' && result.scope !== 'steel_corrosion') {
        fail('Imagem não encontrada.', 404);
      }
      const file = kind === 'original' ? `photo-${index}.jpg` : `photo-${index}_${kind}.png`;
      const path = join(root, analysisId, file);
      if (!existsSync(path)) {
        fail('Imagem não encontrada.', 404);
      }
      return path;
    },
    validateLink(user, body) {
      if (!body.visualAnalysisId) {
        return null;
      }
      const row = record(body.visualAnalysisId, user, true);
      if (row.status !== 'completed' || row.lot_id) {
        fail(
          'Conclua a análise antes de vinculá-la ao lote, ou selecione uma análise ainda não utilizada.',
          409,
        );
      }
      if (row.material !== body.material) {
        fail('O material do lote mudou. Analise novamente as fotografias.');
      }
      const supported = JSON.parse(row.result_json).scope === 'steel_corrosion';
      if (supported && !['agree', 'disagree'].includes(body.visualReview)) {
        fail('Confirme se concorda com a avaliação visual.');
      }
      const notes = body.visualNotes ?? '';
      if (typeof notes !== 'string' || notes.length > 2000) {
        fail('As observações devem ter até 2.000 caracteres.');
      }
      if (body.visualReview === 'disagree' && notes.trim().length < 5) {
        fail('Explique sua discordância em pelo menos cinco caracteres.');
      }
      return {
        id: row.id,
        verdict: supported ? body.visualReview : 'not_applicable',
        notes: notes.trim(),
      };
    },
    link(user, lotId, validated) {
      if (validated) {
        db.prepare(
          "UPDATE visual_analyses SET lot_id=?,operator_verdict=?,operator_notes=?,reviewed_by=?,updated_at=datetime('now') WHERE id=? AND lot_id IS NULL",
        ).run(lotId, validated.verdict, validated.notes, user.id, validated.id);
      }
    },
    async discard(user, analysisId) {
      const row = record(analysisId, user, true);
      if (row.lot_id || ['queued', 'processing'].includes(row.status)) {
        fail('Esta análise não pode ser descartada agora.', 409);
      }
      if (
        db
          .prepare(
            'SELECT COUNT(*) AS count FROM visual_photos WHERE analysis_id=? AND uploaded=-1',
          )
          .get(analysisId).count
      ) {
        fail('Aguarde o envio das fotografias antes de descartar.', 409);
      }
      db.prepare('DELETE FROM visual_photos WHERE analysis_id=?').run(analysisId);
      db.prepare('DELETE FROM visual_analyses WHERE id=?').run(analysisId);
      // Remove only known files belonging to this validated UUID, never recursive paths.
      for (let index = 0; index < row.photo_count; index++)
        for (const name of [
          `raw-${index}.bin`,
          `photo-${index}.jpg`,
          `photo-${index}_ids.png`,
          `photo-${index}_mask.png`,
          `photo-${index}_overlay.png`,
          `photo-${index}_comparison.png`,
          `photo-${index}_result.json`,
        ])
          await unlink(join(root, analysisId, name)).catch(() => {});
    },
    close() {
      closed = true;
      queue.length = 0;
      worker.stop();
    },
  };
}
